// Writing generated files into the game folder, with a manifest for a safe reset.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { GAME_ZH, TWEAKER_DIR } from './paths.js';

const sha1 = b => createHash('sha1').update(b).digest('hex');
const manifestPath = dir => join(dir, 'manifest.json');

function readManifest(dir) {
  const p = manifestPath(dir);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { files: [] };
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
  for (const { path, sha1: h } of m.files) {
    const f = join(gameDir, path);
    if (!existsSync(f)) continue;
    if (sha1(readFileSync(f)) !== h) { kept.push(path); continue; }
    rmSync(f);
    removed.push(path);
    pruneEmptyDirs(gameDir, path);
  }
  if (existsSync(manifestPath(tweakerDir))) rmSync(manifestPath(tweakerDir));
  return { removed, kept };
}

export async function applyOutput(files, { gameDir = GAME_ZH, tweakerDir = TWEAKER_DIR } = {}) {
  await resetOutput({ gameDir, tweakerDir });
  const written = [];
  for (const [path, content] of files) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1');
    const f = join(gameDir, path);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, buf);
    written.push({ path, sha1: sha1(buf) });
  }
  mkdirSync(tweakerDir, { recursive: true });
  writeFileSync(manifestPath(tweakerDir), JSON.stringify({ appliedAt: new Date().toISOString(), files: written }, null, 2));
  return written.map(x => x.path);
}
