/*
  Credits:
    https://github.com/IDCs/vortex-download-helper
    https://github.com/Nexus-Mods/game-palworld
*/

import path from 'path';
import semver from 'semver';
import { fs, log, selectors, types, util } from 'vortex-api';
import turbowalk, { IWalkOptions, IEntry } from 'turbowalk';

import { GAME_ID, UE4SS, STEAM_DIR_NAME, XBOX_DIR_NAME, BINARIES_PATH } from './common';
import { IPluginRequirement } from './types';

export function resolveUE4SSPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const architecture = discovery?.store === 'xbox' ? XBOX_DIR_NAME : STEAM_DIR_NAME;
  return path.join(UE4SS.PATH_PREFIX, architecture);
}

export async function resolveVersionByPattern(api: types.IExtensionApi, requirement: IPluginRequirement): Promise<string> {
  const state = api.getState();
  const files: types.IDownload[] = util.getSafe(state, ['persistent', 'downloads', 'files'], []);
  const latestVersion = Object.values(files).reduce((prev, file) => {
    const match = requirement.fileVersionPattern.exec(file.localPath);
    if (match?.[1] && semver.gt(match[1], prev)) {
      prev = match[1];
    }
    return prev;
  }, '0.0.0');
  return latestVersion;
}

export function getEnabledMods(api: types.IExtensionApi, modType: string): types.IMod[] {
  const state = api.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = util.getSafe(state, ['persistent', 'profiles', profileId], {});
  const isEnabled = (modId) => util.getSafe(profile, ['modState', modId, 'enabled'], false);
  return Object.values(mods).filter((mod: types.IMod) => isEnabled(mod.id) && (mod.type === modType || mod.type === '')) as types.IMod[];
}

export function getMods(api: types.IExtensionApi, modType: string): types.IMod[] {
  const state = api.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return Object.values(mods).filter((mod: types.IMod) => (mod.type === modType || mod.type === '')) as types.IMod[];
}

export async function findModByFile(api: types.IExtensionApi, modType: string, fileName: string): Promise<types.IMod> {
  const mods: types.IMod[] = getMods(api, modType);
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  for (const mod of mods) {
    const modPath = path.join(installationPath, mod.installationPath);
    const files = await walkPath(modPath);
    if (files.find(file => file.filePath.endsWith(fileName))) {
      return mod;
    }
  }
  return undefined;
}

export async function findModsByFile(api: types.IExtensionApi, modType: string, fileName: string): Promise<types.IMod[]> {
  const mods: types.IMod[] = getMods(api, modType);
  const modsList = [];
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  for (const mod of mods) {
    const modPath = path.join(installationPath, mod.installationPath);
    const files = await walkPath(modPath);
    if (files.find(file => file.filePath.endsWith(fileName))) {
      modsList.push(mod);
    }
  }
  return modsList;
}

export function findDownloadIdByPattern(api: types.IExtensionApi, requirement: IPluginRequirement): string | null {
  if (!requirement.fileArchivePattern) {
    log('warn', `no fileArchivePattern defined`, 'findDownloadIdByPattern');
    return null;
  }
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(state, ['persistent', 'downloads', 'files'], {});
  const id: string | null = Object.entries(downloads).reduce((prev: string | null, [dlId, dl]: [string, types.IDownload]) => {
    if (!prev && !!requirement.fileArchivePattern) {
      const match = requirement.fileArchivePattern.exec(dl.localPath);
      if (match) {
        prev = dlId;
      }
    }
    return prev;
  }, null);
  return id;
}

export function findDownloadIdByFile(api: types.IExtensionApi, fileName: string): string {
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(state, ['persistent', 'downloads', 'files'], {});
  return Object.entries(downloads).reduce((prev, [dlId, dl]) => {
    if (path.basename(dl.localPath).toLowerCase() === fileName.toLowerCase()) {
      prev = dlId;
    }
    return prev;
  }, '');
}

// This function is used to find the mod folder of a mod which is still in the installation phase.
export async function findInstallFolderByFile(api: types.IExtensionApi, filePath: string): Promise<string> {
  const installationPath = selectors.installPathForGame(api.getState(), GAME_ID);
  const pathContents = await fs.readdirAsync(installationPath);
  const modFolders = pathContents.filter(folder => path.extname(folder) === '.installing');
  if (modFolders.length === 1) {
    return path.join(installationPath, modFolders[0]);
  } else {
    for (const folder of modFolders) {
      const modPath = path.join(installationPath, folder);
      const files = await walkPath(modPath);
      if (files.find(file => file.filePath.endsWith(filePath))) {
        return path.join(installationPath, folder);
      }
    }
  }
  return undefined;
}

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntry[]> {
  walkOptions = !!walkOptions
    ? { ...walkOptions, skipHidden: true, skipInaccessible: true, skipLinks: true }
    : { skipLinks: true, skipHidden: true, skipInaccessible: true };
  const walkResults: IEntry[] = [];
  return new Promise<IEntry[]>(async (resolve, reject) => {
    await turbowalk(dirPath, (entries: IEntry[]) => {
      walkResults.push(...entries);
      return Promise.resolve() as any;
      // If the directory is missing when we try to walk it; it's most probably down to a collection being
      //  in the process of being installed/removed. We can safely ignore this.
    }, walkOptions).catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
    return resolve(walkResults);
  });
}

// Staging folder file operations require the mod to be purged and re-deployed once the
//  staging operation is complete. This function will remove the mod with the specified modId
//  and run the specified function before re-deploying the mod.
// IMPORTANT: all operations within the provided functor should ensure to only apply to the provided
//  modId to ensure we avoid deployment corruption.
export async function runStagingOperationOnMod(api: types.IExtensionApi, modId: string, func: (...args: any[]) => Promise<void>): Promise<void> {
  try {
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId, false);
    await func(api, modId);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, modId);
  } catch (err) {
    api.showErrorNotification('Failed to run staging operation', err);
    return;
  }
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getBinariesPath(discovery: types.IDiscoveryResult) {
  const isCorrectPath = (binPath: string) => {
    try {
      fs.statSync(binPath);
      return true;
    } catch (err) {
      return false;
    }
  };

  if (discovery.store) {
    return BINARIES_PATH[discovery.store];
  }

  // try to find the binaries path
  for (const prop in BINARIES_PATH) {
    if (isCorrectPath(path.join(discovery.path, BINARIES_PATH[prop]))) {
      return BINARIES_PATH[prop];
    }
  }

  log('error', 'Unable to find BINARIES_PATH.');
}