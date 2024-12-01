/*
  Credits:
    https://github.com/IDCs/vortex-download-helper
    https://github.com/Nexus-Mods/game-palworld
*/

import semver from 'semver';
import { actions, log, selectors, types, util } from 'vortex-api';
import axios from 'axios';

import { IPluginRequirement, IGitHubAsset, IGitHubRelease } from './types';
import { PLUGIN_REQUIREMENTS, GAME_ID, UE4SS } from './common';
import { findModsByFile } from './util';

const GITHUB_TAG = 'experimental';

function getAssetVersion(asset: IGitHubAsset, requirement: IPluginRequirement) {
  let version = semver.valid(semver.coerce(asset.release.tag_name));

  if (version == null && !!requirement.fileVersionPattern) {
    const match = requirement.fileVersionPattern.exec(asset.name);
    if (match) {
      version = semver.valid(match[1]);
    }
  }

  return version || '0.0.0';
}

async function findLatestUE4SSMod(api: types.IExtensionApi): Promise<types.IMod> {
  // find all UE4SS mods installed in Vortex
  const mods = await findModsByFile(api, '', UE4SS.DLL_FILE)

  // get the latest version of the UE4SS mod installed
  return mods.toSorted((a, b) =>
    new Date(b.attributes?.updatedTimestamp).getTime() - new Date(a.attributes?.updatedTimestamp).getTime())[0];
}

export async function checkUE4SSVersion(api: types.IExtensionApi, gameId: string) {
  if (gameId !== GAME_ID) {
    return Promise.resolve();
  }
  const store = api.store;
  const req = PLUGIN_REQUIREMENTS[0];
  const ue4ssMod = await findLatestUE4SSMod(api);
  if (!ue4ssMod) {
    return Promise.resolve();
  }

  const asset = await getLatestGithubReleaseAssetByTagName(api, req, GITHUB_TAG);
  const version = getAssetVersion(asset, req);
  const actualVersion = ue4ssMod?.attributes?.version;

  if (!!actualVersion && actualVersion !== version) {
    store.dispatch(actions.setModAttribute(gameId, ue4ssMod.id, 'newestVersion', version));
  }
}

export async function updateUE4SS(api: types.IExtensionApi) {
  // get the latest version of the UE4SS mod installed
  const ue4ssMod = await findLatestUE4SSMod(api);
  if (!ue4ssMod) {
    return Promise.resolve();
  }

  if (ue4ssMod.attributes.version === ue4ssMod.attributes.newestVersion) {
    log('warn', `UE4SS will not be updated. version (ue4ssMod.attributes.version) = newestVersion (${ue4ssMod.attributes.newestVersion}).`)
    return Promise.resolve();
  }
  await downloadUE4SS(api, ue4ssMod.attributes.newestVersion);
}


export async function downloadUE4SS(api: types.IExtensionApi, version?: string) {
  const req = PLUGIN_REQUIREMENTS[0];
  if (!!version) {
    req.fileArchivePattern = null;
    req.archiveFileName = `UE4SS_v${version}.zip`
  }

  const dlInfo = {
    game: GAME_ID,
    name: req.name, // IMPORTANT
    modName: req.name,
    logicalFileName: req.name,
    customFileName: req.name,
    author: 'UE4SS',
    source: 'user-generated',
    sourceURI: 'https://github.com/UE4SS-RE/RE-UE4SS',
  };

  const NOTIFICATION_ID = 'grounded-installing-requirements';

  api.sendNotification({
    id: NOTIFICATION_ID,
    message: 'Installing UE4SS...',
    type: 'activity',
    noDismiss: true,
    allowSuppress: false,
  });

  const batchActions = [];

  try {
    const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);

    // search for an existing installed UE4SS mod if it exists
    const ue4ssMods = await findModsByFile(api, '', UE4SS.DLL_FILE)
    // To avoid conflicts, if UE4SS mods already exist, they will be disabled.
    if (ue4ssMods) {
      for (const mod of ue4ssMods) {
        if (mod.state === 'installed') {
          batchActions.push(actions.setModEnabled(profileId, mod.id, false));
        }
      }
    }

    const asset = await getLatestGithubReleaseAssetByTagName(api, req, GITHUB_TAG);

    const dlId = await util.toPromise<string>((cb) =>
      api.events.emit(
        'start-download',
        [asset.browser_download_url],
        dlInfo, undefined, cb, 'replace', { allowInstall: false }) // replace / never
    );

    const modId = await util.toPromise<string>((cb) =>
      api.events.emit('start-install-download', dlId, { allowAutoEnable: false }, cb)
    );

    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'version', getAssetVersion(asset, req)));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'author', dlInfo.author));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'source', dlInfo.source));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'name', dlInfo.name));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'logicalFileName', dlInfo.logicalFileName));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'modName', dlInfo.name));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'sourceURI', dlInfo.sourceURI));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'customFileName', dlInfo.customFileName));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'modId', dlInfo.name));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'updatedTimestamp', new Date(asset.updated_at).getTime()));
    batchActions.push(actions.setModAttribute(GAME_ID, modId, 'uploadedTimestamp', new Date(asset.created_at).getTime()));

    batchActions.push(actions.setModsEnabled(api, profileId, [modId], true, {
      allowAutoDeploy: true,
      installed: true
    }));
  } catch (err) {
    log('error', 'failed to download UE4SS', err);
    return;
  } finally {
    if (batchActions.length > 0) {
      util.batchDispatch(api.store, batchActions);
    }
    api.dismissNotification(NOTIFICATION_ID);
  }
}

export async function getLatestGithubReleaseAssetByTagName(
  api: types.IExtensionApi, requirement: IPluginRequirement, tag: string): Promise<IGitHubAsset | null> {
  const chooseAsset = (release: IGitHubRelease) => {
    let assets = release.assets;

    if (!!requirement.fileArchivePattern) {
      assets = assets
        .filter(asset => requirement.fileArchivePattern.exec(asset.name))
    } else if (!!requirement.archiveFileName) {
      // Try to find the asset based on the filename we provided
      assets = assets
        .filter(asset => asset.name === requirement.archiveFileName)
    } else {
      log('error', 'fileArchivePattern or archiveFileName is required.');
    }

    // sort by datetime and get the first element (normally the last version)
    const asset = assets.toSorted((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

    return {
      ...asset,
      release,
    }
  }

  try {
    const response = await axios.get(`${requirement.githubUrl}/releases/tags/${tag}`);
    const resHeaders = response.headers;
    const callsRemaining = parseInt(util.getSafe(resHeaders, ['x-ratelimit-remaining'], '0'), 10);
    if ([403, 404].includes(response?.status) && (callsRemaining === 0)) {
      const resetDate = parseInt(util.getSafe(resHeaders, ['x-ratelimit-reset'], '0'), 10);
      log('info', 'GitHub rate limit exceeded', { reset_at: (new Date(resetDate)).toString() });
      return Promise.reject(new util.ProcessCanceled('GitHub rate limit exceeded'));
    }
    if (response.status === 200) {
      const release: IGitHubRelease = response.data;
      if (release.assets.length > 0) {
        return chooseAsset(release);
      }
    }
  } catch (error) {
    api?.showErrorNotification(
      'Error fetching the latest release url for {{repName}}',
      error, { allowReport: false, replace: { repName: requirement.name } });
  }

  return null;
}
