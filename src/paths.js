import { homedir } from 'node:os';
import { join } from 'node:path';

const H = homedir();
export const GAME_ZH = process.env.ZHT_GAME_ZH || join(H, 'GeneralsX', 'GeneralsZH');
export const GAME_GEN = process.env.ZHT_GAME_GEN || join(H, 'GeneralsX', 'Generals');
export const TWEAKER_DIR = process.env.ZHT_DIR || join(H, 'GeneralsX', 'zh-tweaker');
// GeneralsX user settings: SagePatch.ini is read after Data/INI/GameData and wins over it.
export const USER_DIR = process.env.ZHT_USER_DIR || join(H, 'Library', 'Application Support', 'GeneralsX', 'GeneralsZH');
