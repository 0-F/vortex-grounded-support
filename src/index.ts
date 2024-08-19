import path from 'path';
import { access } from 'fs/promises';
import { types, selectors, fs, util } from 'vortex-api';
import { IExtensionApi } from 'vortex-api/lib/types/IExtensionContext';
import { PLUGIN_REQUIREMENTS } from './common';
import { download } from './downloader';

interface IGitHubRelease {
  url: string;
  id: number;
  tag_name: string;
  name: string;
  assets: IGitHubAsset[];
}

interface IGitHubAsset {
  url: string;
  id: number;
  name: string;
  label: string | null;
  state: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
  release: IGitHubRelease;
}


const GAME_ID = 'grounded';

const APP_ID = {
  steam: '962130'
  //TODO: xbox
}

const BINARIES_PATH = {
  steam: 'Maine\\Binaries\\Win64', // Steam
  xbox: 'Maine\\Binaries\\WinGDK'  // Microsoft Windows Store/Xbox Pass
}

const UE4SS_MODS_PATH = 'Mods'
const UE4SS_SETTINGS_FILE = 'UE4SS-settings.ini';
const UE4SS_MODS_FILE = 'mods.txt';
const UE4SS_MODS_FILE_BACKUP = 'mods.txt.original';

/**
 * Test if a file exists.
 * 
 * @param path File path
 * @returns 
 */
async function isFileExists(path: string) {
  return access(path).then(() => true, () => false);
}

/**
 * Check UE4SS installation.
 * Send a notification if UE4SS is not installed correctly or if an old version is installed.
 * 
 * @param api Vortex API
 */
async function checkForUE4SS(api: IExtensionApi) {
  const discovery = selectors.currentGameDiscovery(api.getState())
  const binariesPath = path.join(discovery.path, BINARIES_PATH[discovery.store])

  const ue4ssdll = await isFileExists(path.join(binariesPath, 'UE4SS.dll'));
  const dwmapidll = await isFileExists(path.join(binariesPath, 'dwmapi.dll'));
  const xinput13dll = await isFileExists(path.join(binariesPath, 'xinput1_3.dll'));
  const xinput14dll = await isFileExists(path.join(binariesPath, 'xinput1_4.dll'));

  // Two UE4SS versions installed
  if ((ue4ssdll || dwmapidll) && (xinput13dll || xinput14dll)) {
    api.sendNotification({
      id: 'ue4ss-two-versions',
      type: 'warning',
      title: 'Two UE4SS versions installed',
      message:
        'UE4SS 3.0 uses two new dlls: UE4SS.dll and ' +
        'dwmapi.dll and no longer uses the older xinput1_3.dll (or xinput1_4.dll). ' +
        'If you want to use UE4SS version 2, you have to delete xinput1_3.dll and xinput1_4.dll.',
      actions: [
        {
          title: 'Open folder',
          action: () => util.opn(binariesPath).catch(() => undefined)
        }
      ]
    });
  }

  // UE4SS v2 installed
  if (xinput13dll || xinput14dll) {
    api.sendNotification({
      id: 'ue4ss-v2-installed',
      type: 'warning',
      title: 'UE4SS v2 installed',
      message:
        'It look like UE4SS v2 is installed. ' +
        'The mod may need UE4SS v3. ' +
        'Remember that you have to uninstall UE4SS v2 before installing UE4SS v3.',
      actions: [
        {
          title: 'See installation guide',
          action: () => util.opn('https://docs.ue4ss.com/installation-guide.html').catch(() => undefined)
        }
      ]
    });
  }

  // UE4SS not installed
  else if (!ue4ssdll || !dwmapidll) {
    api.sendNotification({
      id: 'ue4ss-missing',
      type: 'warning',
      title: 'UE4SS is not installed or some files are missing',
      message: 'UE4SS seems to be required for this mod.',
      actions: [
        {
          title: 'Download UE4SS',
          action: () => util.opn('https://github.com/UE4SS-RE/RE-UE4SS/releases').catch(() => undefined)
        }
      ]
    });
  }
}

/**
 * Test if this is a supported UE4SS injector release.
 * @param files 
 * @param gameId 
 * @returns 
 */
async function testSupportedContent_ue4ss_injector(files: string[], gameId: string) {
  // required: UE4SS-settings.ini
  const supported = gameId === GAME_ID && files.some(
    file => file.toLowerCase() === UE4SS_SETTINGS_FILE.toLowerCase());

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a UE4SS injector release.
 * @param files 
 * @param api 
 * @param destinationPath 
 * @param gameId 
 * @returns 
 */
async function installContent_ue4ss_injector(files: string[], api: types.IExtensionApi, destinationPath: string) {
  // get the binaries path
  // Maine\\Binaries\\Win64 for Steam
  // Maine\\Binaries\\WinGDK for Microsoft Windows Store/Xbox Pass
  const gameStore = selectors.currentGameDiscovery(api.getState()).store;
  const binariesPath = BINARIES_PATH[gameStore]

  const instructions = await files.reduce(async (accumP, iter) => {
    const accum = await accumP;
    const segments = iter.split(path.sep);
    if (path.extname(segments[segments.length - 1]) !== '') {
      const destination = path.join(binariesPath, iter);

      if (path.basename(iter) === UE4SS_MODS_FILE) {
        const modsData: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
        const modsInstr: types.IInstruction = {
          type: 'generatefile',
          data: modsData,
          destination: UE4SS_MODS_FILE_BACKUP,
        }
        accum.push(modsInstr);

        return accum;
      }

      if (iter === UE4SS_SETTINGS_FILE) {
        // Disable the use of Unreal's object array cache regardless of game store - it's causing crashes.
        const data: string = await fs.readFileAsync(path.join(destinationPath, iter), { encoding: 'utf8' });
        const newData = data.replace(/bUseUObjectArrayCache = true/gm, 'bUseUObjectArrayCache = false');
        const createInstr: types.IInstruction = {
          type: 'generatefile',
          data: newData,
          destination,
        }
        accum.push(createInstr);

        return accum;
      }

      const instruction: types.IInstruction = {
        type: 'copy',
        source: iter,
        destination,
      }
      accum.push(instruction);
    }

    return accum;

  }, Promise.resolve([]))
  instructions.push({
    type: 'setmodtype',
    value: '',
  })

  return { instructions };
}

/**
 * Test if this is a supported UE4SS Lua mod.
 * @param files 
 * @param gameId 
 * @param api 
 * @returns 
 */
async function testSupportedContent_ue4ss_lua(files: string[], gameId: string, api: IExtensionApi) {
  // required: <mod_name>\Scripts\main.lua
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\Scripts\\main\.lua$/.test(file)) !== undefined);

  if (supported) {
    await checkForUE4SS(api);
  }

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a UE4SS Lua mod.
 * @param files 
 * @param api 
 * @returns 
 */
async function installContent_ue4ss_lua(files: string[], api: IExtensionApi) {
  // The main.lua file is expected to always be positioned in "<MOD_NAME>\Scripts\main.lua".
  const regex = /[^\\]+\\Scripts\\main\.lua$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace('\\Scripts\\main.lua', '')

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
    ((file.indexOf(rootPath) !== -1) && (!file.endsWith(path.sep))));

  // get the binaries path
  // Maine\\Binaries\\Win64 for Steam
  // Maine\\Binaries\\WinGDK for Microsoft Windows Store/Xbox Pass
  const gameStore = selectors.currentGameDiscovery(api.getState()).store;
  const binariesPath = BINARIES_PATH[gameStore]

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(binariesPath, UE4SS_MODS_PATH, file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

/**
 * Test if this is a supported UE4SS C++ mod.
 * @param files 
 * @param gameId 
 * @param api 
 * @returns 
 */
async function testSupportedContent_ue4ss_cpp(files: string[], gameId: string, api: IExtensionApi) {
  // required: <mod_name>\dlls\main.dll
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\dlls\\main\.dll$/.test(file)) !== undefined);

  if (supported) {
    await checkForUE4SS(api);
  }

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a UE4SS C++ mod.
 * @param files 
 * @param api 
 * @returns 
 */
function installContent_ue4ss_cpp(files: string[], api: IExtensionApi) {
  // The main.dll file is expected to always be positioned in "<MOD_NAME>\dlls\main.dll".
  const regex = /[^\\]+\\dlls\\main\.dll$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace('\\dlls\\main.dll', '')

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
  ((file.indexOf(rootPath) !== -1)
    && (!file.endsWith(path.sep))));

  // get the binaries path
  // Maine\\Binaries\\Win64 for Steam
  // Maine\\Binaries\\WinGDK for Microsoft Windows Store/Xbox Pass
  const gameStore = selectors.currentGameDiscovery(api.getState()).store;
  const binariesPath = BINARIES_PATH[gameStore]

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(binariesPath, UE4SS_MODS_PATH, file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

/**
 * Test if this is a supported UE4SS Blueprint (.pak) mod.
 * @param files 
 * @param gameId 
 * @param api 
 * @returns 
 */
async function testSupportedContent_ue4ss_BPLogicMods(files: string[], gameId: string, api: IExtensionApi) {
  // required: LogicMods\*.pak
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /LogicMods\\.+\.pak$/.test(file)) !== undefined);

  if (supported) {
    await checkForUE4SS(api);
  }

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a UE4SS Blueprint (.pak) mod.
 * @param files 
 * @returns 
 */
async function installContent_ue4ss_BPLogicMods(files: string[]) {
  // The .pak file is expected to always be positioned in "LogicMods\*\*.pak".
  const regex = /LogicMods\\.+\.pak$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace(regex, '')

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) => ((file.indexOf(rootPath) !== -1)
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join('Maine\\Content\\Paks', file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

/**
 * Test if this is a supported Pak mod.
 * @param files 
 * @param gameId 
 * @returns 
 */
async function testSupportedContent_paks(files: string[], gameId: string) {
  // required: *.pak
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => path.extname(file).toLowerCase() === '.pak') !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a Pak mod.
 * @param files 
 * @returns 
 */
async function installContent_paks(files: string[]) {
  // The .pak file is expected to always be positioned in the Paks directory.
  const modFile = files.find((file: string) => path.extname(file).toLowerCase() === '.pak');
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
  ((file.indexOf(rootPath) !== -1)
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join('\\Maine\\Content\\Paks', file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

/**
 * Test if this is a supported generic mod.
 * @param files 
 * @param gameId 
 * @returns 
 */
async function testSupportedContent_generic(files: string[], gameId: string) {
  const supported = (gameId === GAME_ID && files.length > 0)

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

/**
 * Install a generic mod.
 * @param files 
 * @returns 
 */
async function installContent_generic(files: string[]) {
  /*
    Generic mod example:
 
    Grounded-mod.zip
    ├── Grounded
    └── readme.txt
        └── Maine
            └── Content
                └── Movies
                    └── intro_1080p60.bk2
    
    modFile: intro_1080p60.bk2
    rootPath: Maine
    intro_1080p60.bk2 will be copied into Maine\Content\Movies\
  */

  const modFile = files.find((file) => !file.endsWith('/'));
  const rootPath = modFile.match(/.*\\?(?:Grounded\\|^)/)[0];
  const idx = rootPath.length;

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
    ((file.indexOf(rootPath) !== -1) && (!file.endsWith(path.sep))));

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

/**
 * Prepare for modding.
 * @param discovery 
 */
async function prepareForModding(api: types.IExtensionApi, discovery: types.IDiscoveryResult) {
  const binariesPath = BINARIES_PATH[discovery.store]
  const contentPath = 'Maine\\Content'

  // ensure these paths are writable

  // Maine\Binaries\Win64
  await fs.ensureDirWritableAsync(path.join(discovery.path, binariesPath))

  // Maine\Binaries\Win64\Mods
  await fs.ensureDirWritableAsync(path.join(discovery.path, binariesPath, UE4SS_MODS_PATH))

  // Maine\Content\Movies
  await fs.ensureDirWritableAsync(path.join(discovery.path, contentPath, 'Movies'))

  // Maine\Content\Paks
  await fs.ensureDirWritableAsync(path.join(discovery.path, contentPath, 'Paks'))

  // Maine\Content\Paks\LogicMods
  await fs.ensureDirWritableAsync(path.join(discovery.path, contentPath, 'Paks\\LogicMods'))

  await download(api, PLUGIN_REQUIREMENTS);

  await checkForUE4SS(api);
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: 'Grounded',
    mergeMods: true,
    queryArgs: {
      steam: [{ id: APP_ID.steam }],
      // xbox: [{ id: MS_APPID }] //TODO: xbox
    },
    supportedTools: [],
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: () => 'Grounded.exe',
    requiredFiles: [
      'Grounded.exe'
    ],
    setup: (discovery) => prepareForModding(context.api, discovery) as any,
    environment: {
      SteamAPPId: APP_ID.steam,
    },
    details: {
      steamAppId: APP_ID.steam,
    },
    requiresCleanup: true,
  });

  // UE4SS injector (required for some mods)
  context.registerInstaller('grounded-ue4ss_injector', 10,
    (files, gameId) => testSupportedContent_ue4ss_injector(files, gameId),
    (files, destinationPath) => installContent_ue4ss_injector(files, context.api, destinationPath));

  // UE4SS Lua mods
  context.registerInstaller('grounded-ue4ss_lua', 25,
    (files, gameId) => testSupportedContent_ue4ss_lua(files, gameId, context.api),
    (files) => installContent_ue4ss_lua(files, context.api));

  // UE4SS C++ mods
  context.registerInstaller('grounded-ue4ss_cpp', 30,
    (files, gameId) => testSupportedContent_ue4ss_cpp(files, gameId, context.api),
    (files) => installContent_ue4ss_cpp(files, context.api));

  // UE4SS Blueprint mods
  context.registerInstaller('grounded-ue4ss_BPLogicMods', 35,
    (files, gameId) => testSupportedContent_ue4ss_BPLogicMods(files, gameId, context.api),
    installContent_ue4ss_BPLogicMods);

  // .pak mods
  context.registerInstaller('grounded-paks', 40,
    testSupportedContent_paks,
    installContent_paks);

  // Generic mods
  context.registerInstaller('grounded-generic', 90,
    testSupportedContent_generic,
    installContent_generic)

  return true
}

export default main;
