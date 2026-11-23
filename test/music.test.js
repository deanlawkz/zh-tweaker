import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { musicIni, musicSettings, checkFolder, renderFolder, findFfmpeg, audioFiles, MUSIC_INI } from '../src/music.js';
import { buildOutput } from '../src/tweaks.js';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

const ffmpeg = findFfmpeg();
const tone = (file, sec, hz) => execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${sec}`, file]);

test('папка: проверка, порядок имён, настройки по последней правке', () => {
  const d = tmp();
  assert.match(checkFolder(d), /нет музыки|No music/);
  assert.match(checkFolder(join(d, 'nope')), /не найдена|not found/);
  for (const n of ['10 b.mp3', '2 a.wav', 'cover.jpg', '.hidden.mp3']) writeFileSync(join(d, n), 'x');
  assert.deepEqual(audioFiles(d).map(f => f.slice(d.length + 1)), ['2 a.wav', '10 b.mp3']);
  assert.equal(checkFolder(d), null);
  const s = musicSettings([{ op: 'music', slot: 'usa', folder: '/a' }, { op: 'music', slot: 'shell', folder: '/b' }, { op: 'music', slot: 'usa', folder: null }]);
  assert.deepEqual(s, { shell: '/b' });
});

test('Music INI: все треки стороны и меню ведут на один файл', () => {
  const ini = musicIni({ usa: '/x', shell: '/y' });
  for (const n of ['Load_USA', 'Game_USA_01', 'Game_USA_11', 'Shell']) assert.match(ini, new RegExp(`MusicTrack ${n}\\r\\n`));
  assert.match(ini, /MusicTrack Game_USA_11\r\n  Filename = ZHT_usa\.mp3\r\nEnd/);
  assert.match(ini, /MusicTrack Shell\r\n  Filename = ZHT_shell\.mp3/);
  assert.doesNotMatch(ini, /Game_CHI/);
});

test('склейка папки в один mp3 с ограничением длины и кэшем', { skip: !ffmpeg }, async () => {
  const d = tmp(); const cache = tmp();
  tone(join(d, '1.mp3'), 2, 440); tone(join(d, '2.wav'), 2, 660); tone(join(d, '3.mp3'), 2, 880);
  const r = await renderFolder(d, cache, { cap: 3 });
  assert.equal(r.tracks, 2, 'third track is past the cap');
  const len = Number(execFileSync(ffmpeg.replace(/ffmpeg$/, 'ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', '-'], { input: r.buffer }).toString());
  assert.ok(len > 2.8 && len < 3.3, `length ${len}`);
  const again = await renderFolder(d, cache, { cap: 3 });
  assert.ok(again.buffer.equals(r.buffer), 'second run comes from the cache');
});

test('buildOutput: Music INI и музыка загрузки Commander', { skip: !hasGame }, async () => {
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  const db = await loadGameDb(vfs);
  const d = tmp(); mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'a.mp3'), 'x');
  const out = buildOutput(db, [{ id: 1, op: 'music', slot: 'commander', folder: d }, { id: 2, op: 'music', slot: 'gla', folder: join(d, 'missing') }]);
  assert.deepEqual(out.music, { commander: d });
  assert.match(out.files.get(MUSIC_INI), /MusicTrack ZHT_Commander/);
  const pt = [...out.files.values()].find(t => typeof t === 'string' && /PlayerTemplate\s+FactionCommander/.test(t));
  assert.match(pt, /LoadScreenMusic\s*=\s*ZHT_Commander/);
  assert.ok(out.errors.some(e => e.tweakId === 2), 'missing folder is reported on its change');
  const none = buildOutput(db, []);
  assert.equal(none.files.has(MUSIC_INI), false);
});
