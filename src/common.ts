/*
  Credits:
    https://github.com/IDCs/vortex-download-helper
    https://github.com/Nexus-Mods/game-palworld
*/

import path from 'path';
import { types } from 'vortex-api';
import { IPluginRequirement } from './types';
import { findModByFile, findDownloadIdByPattern } from './util';

export const NAMESPACE = 'game-grounded';
export const GAME_ID = 'grounded';
export const DEFAULT_EXECUTABLE = 'Grounded.exe'; // path to executable, relative to game root
export const XBOX_EXECUTABLE = 'gamelaunchhelper.exe';

export const STEAM_DIR_NAME = 'Win64'
export const XBOX_DIR_NAME = 'WinGDK'

export const APP_ID = {
  steam: '962130',
  xbox: 'Microsoft.Maine'
}

export const BINARIES_PATH = {
  steam: 'Maine\\Binaries\\' + STEAM_DIR_NAME, // Steam
  xbox: 'Maine\\Binaries\\' + XBOX_DIR_NAME // Microsoft Windows Store/Xbox Pass
}

const UE4SS_DIR_NAME = 'ue4ss';
const UE4SS_DLL = 'UE4SS.dll';
export const UE4SS = {
  NAME: 'UE4SS v3',
  DIR_NAME: UE4SS_DIR_NAME,
  DLL_FILE: UE4SS_DLL,
  MODS_MODS_PATH: UE4SS_DIR_NAME + '\\Mods',
  SETTINGS_FILE: 'UE4SS-settings.ini',
  MODS_FILE: 'mods.txt',
  MODS_FILE_BACKUP: 'mods.txt.original',
  ENABLED_FILE: 'enabled.txt',
  PATH_PREFIX: path.join('Maine', 'Binaries')
}

export const NOTIF_ID_BP_MODLOADER_DISABLED = 'notif-grounded-bp-modloader-disabled';

export const PAK_MODSFOLDER_PATH = path.join('Maine', 'Content', 'Paks', '~mods'); // relative to game root
export const BPPAK_MODSFOLDER_PATH = path.join('Maine', 'Content', 'Paks', 'LogicMods');

export const LUA_EXTENSIONS = ['.lua'];
export const PAK_EXTENSIONS = ['.pak', '.utoc', '.ucas'];

export const IGNORE_CONFLICTS = [UE4SS.ENABLED_FILE, 'ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];
export const IGNORE_DEPLOY = [UE4SS.MODS_FILE, UE4SS.MODS_FILE_BACKUP, UE4SS.ENABLED_FILE];

export const MOD_TYPE_PAK = 'grounded-pak-modtype';
export const MOD_TYPE_LUA = 'grounded-lua-modtype';
export const MOD_TYPE_LUA_V2 = 'grounded-lua-modtype-v2';
export const MOD_TYPE_BP_PAK = 'grounded-blueprint-modtype';
export const MOD_TYPE_UNREAL_PAK_TOOL = 'grounded-unreal-pak-tool-modtype';

export type PakModType = 'grounded-pak-modtype' | 'grounded-blueprint-modtype';

export const PLUGIN_REQUIREMENT_UE4SS: IPluginRequirement = {
  name: UE4SS.NAME,
  modType: '',
  assemblyFileName: UE4SS.DLL_FILE,
  userFacingName: 'UE4 Scripting System',
  githubUrl: 'https://api.github.com/repos/UE4SS-RE/RE-UE4SS',
  findMod: (api: types.IExtensionApi) => findModByFile(api, '', UE4SS.DLL_FILE),
  findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, PLUGIN_REQUIREMENT_UE4SS),
  fileVersionPattern: new RegExp(/^UE4SS_v(.+)\.zip/),
  fileArchivePattern: new RegExp(/^UE4SS_v(\d+\.\d+\.\d+-\d+-[a-z\d]+)\.zip/), // pattern for experimental version
};

export const PLUGIN_REQUIREMENTS: IPluginRequirement[] = [PLUGIN_REQUIREMENT_UE4SS];
