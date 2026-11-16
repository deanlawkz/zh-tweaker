// Writing generated files into the game folder, with a manifest for a safe reset.
// A file that already existed and is not ours is moved aside to "<file>.zht-backup"
// and put back on reset.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, readdirSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GAME_ZH, TWEAKER_DIR } from './paths.js';

const sha1 = b => createHash('sha1').update(b).digest('hex');
const manifestPath = dir => join(dir, 'manifest.json');
const BACKUP = '.zht-backup';

function readManifest(dir) {
  const p = manifestPath(dir);
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { files: [] }; } catch { return { files: [] }; }
}

function writeManifest(dir, files) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath(dir), JSON.stringify({ appliedAt: new Date().toISOString(), files }, null, 2));
}

function pruneEmptyDirs(gameDir, rel) {
  let d = dirname(join(gameDir, rel));
  while (d.startsWith(join(gameDir, 'Data')) && d !== join(gameDir, 'Data')) {
    try { if (readdirSync(d).length) break; rmdirSync(d); } catch { break; }
    d = dirname(d);
  }
}

export async function resetOutput({ gameDir = GAME_ZH, tweakerDir = TWEAKER_DIR } = {}) {
  const m = readManifest(tweakerDir);
  const removed = [], kept = [];
  for (const { path, sha1: h, backup } of m.files) {
    const f = join(gameDir, path);
    if (existsSync(f)) {
      if (sha1(readFileSync(f)) !== h) { kept.push(path); continue; }
      rmSync(f);
      removed.push(path);
    }
    if (backup && existsSync(f + BACKUP)) renameSync(f + BACKUP, f);
    else pruneEmptyDirs(gameDir, path);
  }
  if (existsSync(manifestPath(tweakerDir))) rmSync(manifestPath(tweakerDir));
  return { removed, kept };
}

export async function applyOutput(files, { gameDir = GAME_ZH, tweakerDir = TWEAKER_DIR } = {}) {
  const prev = new Map(readManifest(tweakerDir).files.map(x => [x.path, x]));
  const written = [];
  for (const [path, content] of files) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1');
    const f = join(gameDir, path);
    mkdirSync(dirname(f), { recursive: true });
    let backup = prev.get(path)?.backup || false;
    if (!prev.has(path) && existsSync(f) && !existsSync(f + BACKUP)) { renameSync(f, f + BACKUP); backup = true; }
    writeFileSync(f, buf);
    written.push({ path, sha1: sha1(buf), backup });
    writeManifest(tweakerDir, [...written, ...[...prev.values()].filter(x => !written.some(w => w.path === x.path))]);
  }
  // Files from the previous apply that are no longer produced.
  for (const [path, x] of prev) {
    if (files.has(path)) continue;
    const f = join(gameDir, path);
    if (existsSync(f) && sha1(readFileSync(f)) === x.sha1) rmSync(f);
    if (x.backup && existsSync(f + BACKUP)) renameSync(f + BACKUP, f);
    else pruneEmptyDirs(gameDir, path);
  }
  writeManifest(tweakerDir, written);
  return written.map(x => x.path);
}
