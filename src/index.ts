import path from 'path';
import { types } from 'vortex-api';

const GAME_ID = 'grounded';

const STEAM_APPID = '962130';
// const MS_APPID = '' //TODO: xbox

const PAK_EXTENSION = '.pak';

const DEFAULT_BINARIES_PATH = 'Maine\\Binaries\\Win64'
const MS_BINARIES_PATH = 'Maine\\Binaries\\WinGDK' // Microsoft Windows Store/Xbox Pass

let BinariesPath = DEFAULT_BINARIES_PATH

function testSupportedContent_ue4ss_lua(files: string[], gameId: string) {
  // required: <mod_name>\Scripts\main.lua
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\Scripts\\main\.lua$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_lua(files: string[]) {
  /*
    UE4SS Lua mods
  */

  // The main.lua file is expected to always be positioned in "<MOD_NAME>\Scripts\main.lua".
  const regex = /[^\\]+\\Scripts\\main\.lua$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace('\\Scripts\\main.lua', '')

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
    ((file.indexOf(rootPath) !== -1) && (!file.endsWith(path.sep))));

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(BinariesPath, 'Mods', file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function testSupportedContent_ue4ss_cpp(files: string[], gameId: string) {
  // required: <mod_name>\dlls\main.dll
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\dlls\\main\.dll$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_cpp(files: string[]) {
  /*
    UE4SS C++ mods
  */

  // The main.dll file is expected to always be positioned in "<MOD_NAME>\dlls\main.dll".
  const regex = /[^\\]+\\dlls\\main\.dll$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace('\\dlls\\main.dll', '')

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter((file: string) =>
  ((file.indexOf(rootPath) !== -1)
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map((file: string) => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(BinariesPath, 'Mods', file.substring(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function testSupportedContent_ue4ss_BPLogicMods(files: string[], gameId: string) {
  // required: LogicMods\*.pak
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /LogicMods\\.+\.pak$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_BPLogicMods(files: string[]) {
  /*
    UE4SS Blueprint (.pak) mods
  */

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

function testSupportedContent_paks(files: string[], gameId: string) {
  // required: *.pak
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => path.extname(file).toLowerCase() === PAK_EXTENSION) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_paks(files: string[]) {
  /*
    .pak mods
  */

  // The .pak file is expected to always be positioned in the Paks directory.
  const modFile = files.find((file: string) => path.extname(file).toLowerCase() === PAK_EXTENSION);
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

function testSupportedContent_generic(_files: string[], gameId: string) {
  const supported = (gameId === GAME_ID)

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_generic(files: string[]) {
  /*
    Generic mods

    Example:

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

//TODO: xbox
// function setup(discovery: types.IDiscoveryResult) {
//   if (discovery.store === 'xbox') {
//     BinariesPath = MS_BINARIES_PATH
//   }
// }

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: 'Grounded',
    mergeMods: true,
    queryArgs: {
      steam: [{ id: STEAM_APPID }],
      // xbox: [{ id: MS_APPID }] //TODO: xbox
    },
    supportedTools: [],
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: () => 'Grounded.exe',
    requiredFiles: [
      'Grounded.exe'
    ],
    // setup: (discovery) => setup(discovery), //TODO: xbox
    environment: {
      SteamAPPId: STEAM_APPID,
    },
    details: {
      steamAppId: STEAM_APPID,
    },
    requiresCleanup: true,
  });

  // UE4SS Lua mods
  context.registerInstaller('grounded-ue4ss_lua', 25, testSupportedContent_ue4ss_lua, installContent_ue4ss_lua);
  // UE4SS C++ mods
  context.registerInstaller('grounded-ue4ss_cpp', 30, testSupportedContent_ue4ss_cpp, installContent_ue4ss_cpp);
  // UE4SS Blueprint mods
  context.registerInstaller('grounded-ue4ss_BPLogicMods', 35, testSupportedContent_ue4ss_BPLogicMods, installContent_ue4ss_BPLogicMods);
  // .pak mods
  context.registerInstaller('grounded-paks', 40, testSupportedContent_paks, installContent_paks);
  // Generic mods
  context.registerInstaller('grounded-generic', 90, testSupportedContent_generic, installContent_generic)

  return true
}

export default main;
