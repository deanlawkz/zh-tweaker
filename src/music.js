// Custom music from folders on disk: main menu, Commander and each side.
//
// How the game plays music (GeneralsX 1.0.7 source):
// - main menu: MusicTrack "Shell", started by the shell map script;
// - skirmish: Data\Scripts\SkirmishScripts.scb plays Game_<SIDE>_01, 02... by the player's Side
//   (America*, China*, GLA*). The Commander side is not in that script, so it keeps the load-screen
//   music (PlayerTemplate LoadScreenMusic), which nothing stops;
// - on macOS (MiniAudio) a track never "completes" and loops forever, so the playlist never moves on.
// So each folder becomes ONE long mp3 (up to MUSIC_CAP_SEC) that all tracks of that slot point to.
// Files go loose into Data/Audio/Tracks/ and Data/INI/Music/ZHT_Music.ini overrides the Filename.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { L } from './i18n.js';

const run = promisify(execFile);
export const MUSIC_CAP_SEC = 30 * 60;
export const MUSIC_INI = 'Data/INI/Music/ZHT_Music.ini';
const AUDIO = /\.(mp3|wav|m4a|aac|flac|ogg|aif|aiff)$/i;
const nn = (p, n) => Array.from({ length: n }, (_, i) => `${p}_${String(i + 1).padStart(2, '0')}`);

export const MUSIC_SLOTS = {
  shell: { tracks: ['Shell'] },
  commander: { tracks: ['ZHT_Commander'] },
  usa: { tracks: ['Load_USA', ...nn('Game_USA', 11)] },
  china: { tracks: ['Load_China', ...nn('Game_CHI', 10)] },
  gla: { tracks: ['Load_GLA', ...nn('Game_GLA', 11)] },
};
export const musicFile = slot => `ZHT_${slot}.mp3`;
export const musicPath = slot => `Data/Audio/Tracks/${musicFile(slot)}`;

export function audioFiles(folder) {
  return readdirSync(folder, { withFileTypes: true })
    .filter(d => d.isFile() && AUDIO.test(d.name) && !d.name.startsWith('.'))
    .map(d => join(folder, d.name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

// Latest folder per slot from the tweak list; null folder = back to the game's music.
export function musicSettings(tweaks) {
  const s = {};
  for (const t of tweaks) if (t.op === 'music' && MUSIC_SLOTS[t.slot]) s[t.slot] = t.folder || null;
  for (const k of Object.keys(s)) if (!s[k]) delete s[k];
  return s;
}

// Checks a folder; returns an error message or null.
export function checkFolder(folder) {
  if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) return L(`Папка не найдена: ${folder}`, `Folder not found: ${folder}`);
  if (!audioFiles(folder).length) return L(`В папке нет музыки (mp3, wav, m4a, flac, ogg): ${folder}`, `No music in the folder (mp3, wav, m4a, flac, ogg): ${folder}`);
  return null;
}

export function musicIni(settings) {
  let out = '; ZH Tweaker: custom music\r\n';
  for (const slot of Object.keys(settings)) {
    for (const name of MUSIC_SLOTS[slot].tracks) out += `\r\nMusicTrack ${name}\r\n  Filename = ${musicFile(slot)}\r\nEnd\r\n`;
  }
  return out;
}

export function findFfmpeg() {
  for (const dir of [...(process.env.PATH || '').split(':'), '/opt/homebrew/bin', '/usr/local/bin']) {
    const p = join(dir, 'ffmpeg');
    if (dir && existsSync(p)) return p;
  }
  return null;
}

async function duration(ffmpeg, file) {
  const probe = ffmpeg.replace(/ffmpeg$/, 'ffprobe');
  try {
    const { stdout } = await run(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    return Number(stdout.trim()) || 0;
  } catch { return 0; }
}

// Builds (or takes from cache) one mp3 for a folder. Returns { buffer, tracks, seconds, note }.
export async function renderFolder(folder, cacheDir, { ffmpeg = findFfmpeg(), cap = MUSIC_CAP_SEC } = {}) {
  const files = audioFiles(folder);
  if (!ffmpeg) {
    const f = files.find(x => /\.(mp3|wav)$/i.test(x));
    if (!f) throw new Error(L('Нет ffmpeg, а в папке нет mp3 или wav. Установите ffmpeg: brew install ffmpeg',
      'No ffmpeg and no mp3 or wav in the folder. Install ffmpeg: brew install ffmpeg'));
    return { buffer: readFileSync(f), tracks: 1, seconds: null,
      note: L('ffmpeg не найден: играет только первый трек папки', 'ffmpeg not found: only the first track of the folder plays') };
  }
  const picked = [];
  let total = 0;
  for (const f of files) {
    if (total >= cap) break;
    const d = await duration(ffmpeg, f);
    if (!d) continue;
    picked.push(f); total += d;
  }
  if (!picked.length) throw new Error(L(`Не удалось прочитать музыку в ${folder}`, `Could not read the music in ${folder}`));
  const key = createHash('sha1').update(JSON.stringify([cap, picked.map(f => [f, statSync(f).size, statSync(f).mtimeMs])])).digest('hex').slice(0, 16);
  mkdirSync(cacheDir, { recursive: true });
  const out = join(cacheDir, `${key}.mp3`);
  if (!existsSync(out)) {
    const inputs = picked.flatMap(f => ['-i', f]);
    const chains = picked.map((_, i) => `[${i}:a:0]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`).join(';');
    const filter = `${chains};${picked.map((_, i) => `[a${i}]`).join('')}concat=n=${picked.length}:v=0:a=1[out]`;
    const tmp = out + '.part.mp3';
    await run(ffmpeg, ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-t', String(cap),
      '-c:a', 'libmp3lame', '-b:a', '192k', tmp], { maxBuffer: 1 << 24 });
    renameSync(tmp, out);
  }
  return { buffer: readFileSync(out), file: out, tracks: picked.length, seconds: Math.min(total, cap), note: null };
}

// Native macOS folder picker. Returns a POSIX path or null when cancelled.
export async function pickFolder(prompt) {
  const script = `tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt ${JSON.stringify(prompt)})`;
  try { const { stdout } = await run('osascript', ['-e', script]); return stdout.trim().replace(/\/$/, '') || null; }
  catch { return null; }
}


// Removes cached mixes that are no longer used.
export function pruneCache(cacheDir, keep) {
  let names = [];
  try { names = readdirSync(cacheDir); } catch { return; }
  for (const n of names) { const p = join(cacheDir, n); if (!keep.includes(p)) rmSync(p, { force: true }); }
}
