/*
  Credits:
    https://github.com/IDCs/vortex-download-helper
    https://github.com/Nexus-Mods/game-palworld
*/

import path from 'path';
import { types } from 'vortex-api';
import { IPluginRequirement } from './types';
import { findModByFile, resolveVersionByPattern, findDownloadIdByPattern } from './util';

export const NAMESPACE = 'game-grounded';

export const NOTIF_ID_BP_MODLOADER_DISABLED = 'notif-grounded-bp-modloader-disabled';
export const NOTIF_ID_REQUIREMENTS = 'grounded-requirements-download-notification';
export const NOTIF_ID_UE4SS_UPDATE = 'grounded-ue4ss-version-update';

export const DEFAULT_EXECUTABLE = 'Grounded.exe'; // path to executable, relative to game root
export const XBOX_EXECUTABLE = 'gamelaunchhelper.exe';

export const NS = 'game-grounded';
export const GAME_ID = 'grounded';

export const UE4SS_PATH_PREFIX = path.join('Maine', 'Binaries');
export const PAK_MODSFOLDER_PATH = path.join('Maine', 'Content', 'Paks', '~mods'); // relative to game root
export const BPPAK_MODSFOLDER_PATH = path.join('Maine', 'Content', 'Paks', 'LogicMods');

export const LUA_EXTENSIONS = ['.lua'];
export const PAK_EXTENSIONS = ['.pak', '.utoc', '.ucas'];

export const MODS_FILE = 'mods.txt';
export const MODS_FILE_BACKUP = 'mods.txt.original';
export const UE4SS_ENABLED_FILE = 'enabled.txt';

export const IGNORE_CONFLICTS = [UE4SS_ENABLED_FILE, 'ue4sslogicmod.info', '.ue4sslogicmod', '.logicmod'];
export const IGNORE_DEPLOY = [MODS_FILE, MODS_FILE_BACKUP, UE4SS_ENABLED_FILE];

export const UE4SS_DWMAPI = 'dwmapi.dll';
export const XBOX_UE4SS_XINPUT_REPLACEMENT = 'xinput1_4.dll';
export const UE4SS_SETTINGS_FILE = 'UE4SS-settings.ini';
export const UE4SS_2_5_2_FILES = ['xinput1_3.dll', UE4SS_SETTINGS_FILE];
export const UE4SS_3_0_0_FILES = [UE4SS_DWMAPI, UE4SS_SETTINGS_FILE];

export const MOD_TYPE_PAK = 'grounded-pak-modtype';
export const MOD_TYPE_LUA = 'grounded-lua-modtype';
export const MOD_TYPE_LUA_V2 = 'grounded-lua-modtype-v2';
export const MOD_TYPE_BP_PAK = 'grounded-blueprint-modtype';
export const MOD_TYPE_UNREAL_PAK_TOOL = 'grounded-unreal-pak-tool-modtype';

export type PakModType = 'grounded-pak-modtype' | 'grounded-blueprint-modtype';

export const UE4SS_ARCHIVE_FILENAME = 'UE4SS_v3.0.1.zip';

export const PLUGIN_REQUIREMENTS: IPluginRequirement[] = [
  {
    archiveFileName: UE4SS_ARCHIVE_FILENAME,
    modType: '',
    assemblyFileName: UE4SS_DWMAPI,
    userFacingName: 'UE4 Scripting System',
    githubUrl: 'https://api.github.com/repos/UE4SS-RE/RE-UE4SS',
    findMod: (api: types.IExtensionApi) => findModByFile(api, '', UE4SS_SETTINGS_FILE),
    findDownloadId: (api: types.IExtensionApi) => findDownloadIdByPattern(api, PLUGIN_REQUIREMENTS[0]),
    fileArchivePattern: new RegExp(/^UE4SS.*v(\d+\.\d+\.\d+)/, 'i'),
    resolveVersion: (api: types.IExtensionApi) => resolveVersionByPattern(api, PLUGIN_REQUIREMENTS[0]),
  },
]
