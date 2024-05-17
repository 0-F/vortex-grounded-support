//Import some assets from Vortex we'll need.
import path from 'path';
import { log, selectors, types, util } from 'vortex-api';

// Nexus Mods domain for the game. e.g. nexusmods.com/bloodstainedritualofthenight
const GAME_ID = 'grounded';

//Steam Application ID, you can get this from https://steamdb.info/apps/
const STEAM_APPID = '962130';
// const MS_APPID = ''

const PAK_EXTENSION = '.pak';

const STEAM_BINARIES_PATH = 'Maine\\Binaries\\Win64' // Steam
// const MS_BINARIES_PATH = 'Maine\\Binaries\\WinGDK'   // Microsoft Windows Store/Xbox Pass

let BinariesPath = STEAM_BINARIES_PATH

function testSupportedContent_ue4ss_lua(files: string[], gameId: string) {
  // Make sure we're able to support this mod.

  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\Scripts\\main\.lua$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_lua(files: string[]) {
  // The main.lua file is expected to always be positioned in "<MOD_NAME>\Scripts\main.lua".
  const regex = /[^\\]+\\Scripts\\main\.lua$/
  const modFile = files.find((file: string) => regex.test(file));
  const idx = modFile.search(regex);
  const rootPath = modFile.replace('\\Scripts\\main.lua', '')

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

function testSupportedContent_ue4ss_cpp(files: string[], gameId: string) {
  // Make sure we're able to support this mod.

  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /[^\\]+\\dlls\\main\.dll$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_cpp(files: string[]) {
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
  // Make sure we're able to support this mod.

  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => /LogicMods\\.+\.pak$/.test(file)) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_ue4ss_BPLogicMods(files: string[]) {
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
  // Make sure we're able to support this mod.
  const supported = (gameId === GAME_ID) &&
    (files.find((file: string) => path.extname(file).toLowerCase() === PAK_EXTENSION) !== undefined);

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_paks(files: string[]) {
  // The .pak file is expected to always be positioned in the Paks directory we're going to disregard anything placed outside the root.
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

function testSupportedContent_generic(files: string[], gameId: string) {
  // Make sure we're able to support this mod.
  const supported = (gameId === GAME_ID)

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent_generic(files: string[]) {
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
      // xbox: [{ id: MS_APPID }]
    },
    supportedTools: [],
    queryModPath: () => '.',
    logo: 'gameart.jpg',
    executable: () => 'Grounded.exe',
    requiredFiles: [
      'Grounded.exe'
    ],
    // setup: (discovery) => setup(discovery),
    environment: {
      SteamAPPId: STEAM_APPID,
    },
    details: {
      steamAppId: STEAM_APPID,
    },
    requiresCleanup: true,
  });

  context.registerInstaller('grounded-ue4ss_lua', 25, testSupportedContent_ue4ss_lua, installContent_ue4ss_lua);
  context.registerInstaller('grounded-ue4ss_cpp', 30, testSupportedContent_ue4ss_cpp, installContent_ue4ss_cpp);
  context.registerInstaller('grounded-ue4ss_BPLogicMods', 35, testSupportedContent_ue4ss_BPLogicMods, installContent_ue4ss_BPLogicMods);
  context.registerInstaller('grounded-paks', 40, testSupportedContent_paks, installContent_paks);
  context.registerInstaller('grounded-generic', 90, testSupportedContent_generic, installContent_generic)

  return true
}

export default main;
