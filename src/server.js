// HTTP API and static UI on 127.0.0.1:4170.
import { NUKE_OCL } from './commander.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vfs } from './big.js';
import { GameDb, loadGameDb } from './gamedb.js';
import { parseIni, blockText } from './ini.js';
import { buildOutput, loadTweaks, saveTweaks } from './tweaks.js';
import { applyOutput, resetOutput } from './output.js';
import { iconPng, placeholderPng, iconFromMappedImage } from './icons.js';
import { labelFor, moduleLabel } from './labels.js';
import { PREFIX } from './commander.js';
import { GAME_ZH, GAME_GEN, TWEAKER_DIR, USER_DIR } from './paths.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = 4170;

// Only the tweaker's own page may change things (protects against other sites in the browser).
function sameOrigin(req) {
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return false;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.origin;
  return !origin || origin === `http://${host}`;
}

// Vanilla db plus generated files layered on top.
function overlay(db, files) {
  const v = Object.create(GameDb.prototype);
  v.files = new Map(db.files);
  v.index = Object.fromEntries(Object.entries(db.index).map(([k, m]) => [k, new Map(m)]));
  v.warnings = [];
  v.csf = db.csf; v.csfRaw = db.csfRaw;
  for (const [p, text] of files) if (typeof text === 'string' && p.startsWith('Data/INI/')) v.replaceFile(p, parseIni(text, p));
  return v;
}

const baseOf = n => (n.startsWith(PREFIX) ? n.slice(PREFIX.length).replace(/__.*$/, '') : n);
const baseSide = s => (/^America/.test(s) ? 'America' : /^China|^Boss/.test(s) ? 'China' : /^GLA/.test(s) ? 'GLA' : s || 'Other');

// Short weapon summary for the cards: damage, radius, projectile, nuclear blast.
export function weaponSummary(view, name) {
  const P = k => view.prop('Weapon', name, k);
  const ocl = [P('ProjectileDetonationOCL'), P('FireOCL')].filter(Boolean).join(' ');
  return { damage: P('PrimaryDamage'), radius: P('PrimaryDamageRadius'), range: P('AttackRange'),
    projectile: P('ProjectileObject'), ocl: ocl || null, nuke: ocl.includes(NUKE_OCL) };
}

function describe(view, entry) {
  const props = (node, cls) => node.props.map(p => ({ key: p.key, value: p.value, label: labelFor(cls, p.key) }));
  const mod = m => ({
    kind: m.kind, className: m.className, tag: m.tag, arg: m.arg,
    label: moduleLabel(m.className || m.kind), props: props(m, m.className || m.kind), modules: m.modules.map(mod),
  });
  return {
    name: entry.block.name, type: entry.block.type,
    props: props(entry.block, null), modules: entry.block.modules.map(mod),
    text: blockText(view.files.get(entry.file), entry.block),
  };
}

// Original SagePatch.ini (before our edit): the backup if we already changed it.
function readSagePatch(userDir) {
  for (const f of [join(userDir, 'SagePatch.ini.zht-backup'), join(userDir, 'SagePatch.ini')]) {
    try { return readFileSync(f, 'latin1'); } catch {}
  }
  return null;
}

export async function createApp({ vfs, db, gameDir = GAME_ZH, tweakerDir = TWEAKER_DIR, userDir = USER_DIR, play } = {}) {
  vfs ||= await Vfs.open([GAME_ZH, GAME_GEN]);
  db ||= await loadGameDb(vfs);
  let tweaks = loadTweaks(tweakerDir);
  let out, view;
  const recompute = () => { out = buildOutput(db, tweaks, { sagePatch: readSagePatch(userDir) }); view = overlay(db, out.files); };
  recompute();
  let nextId = tweaks.reduce((m, t) => Math.max(m, t.id || 0), 0) + 1;
  play ||= () => spawn('open', ['-a', '/Applications/GeneralsXZH.app'], { detached: true, stdio: 'ignore' }).unref();

  const sameTarget = (a, b) => a.op === b.op && (
    ['camera', 'aimFix', 'battleFx'].includes(a.op) ||
    (a.op === 'set' && a.block === b.block && (a.module || '') === (b.module || '') && a.key === b.key) ||
    (a.op === 'weaponSlot' && a.object === b.object && a.slot === b.slot) ||
    (a.op === 'commandSlot' && a.commandSet === b.commandSet && +a.slot === +b.slot) ||
    (a.op === 'raw' && a.block === b.block));

  const objectsList = () => [...view.index.Object.keys()].filter(n => n.startsWith(PREFIX) && !n.includes('__')).map(n => {
    const base = baseOf(n);
    return { name: n, base, display: db.displayName(base) || base, side: baseSide(db.side(base)), general: db.general(base), kind: db.kind(base) };
  });

  const routes = {
    'GET /api/state': () => ({ tweaks: tweaks.length, errors: out.errors, report: out.report }),
    'GET /api/objects': (q) => {
      const s = (q.get('q') || '').toLowerCase();
      return objectsList().filter(o => (!q.get('side') || o.side === q.get('side')) && (!q.get('kind') || o.kind === q.get('kind'))
        && (!s || o.display.toLowerCase().includes(s) || o.name.toLowerCase().includes(s)));
    },
    'GET /api/object/:name': (q, [name]) => {
      const e = view.get('Object', name);
      if (!e) return [404, { error: `Нет объекта ${name}` }];
      const base = baseOf(name);
      const weapons = view.weaponsOf(name);
      return { ...describe(view, e), display: db.displayName(base) || base, base, weapons, kind: db.kind(base),
        weaponInfo: Object.fromEntries(weapons.map(w => [w, weaponSummary(view, w)])) };
    },
    'GET /api/weapon/:name': (q, [name]) => {
      const e = view.get('Weapon', name);
      if (!e) return [404, { error: `Нет оружия ${name}` }];
      return { ...describe(view, e), summary: weaponSummary(view, name), users: view.usersOfWeapon ? [...view.index.Object.keys()].filter(o => view.weaponsOf(o).includes(name)) : [] };
    },
    'GET /api/refs/:type': (q, [type]) => {
      const idx = view.index[type];
      if (!idx) return [404, { error: `Нет справочника ${type}` }];
      const s = (q.get('q') || '').toLowerCase();
      const out2 = [];
      for (const n of idx.keys()) {
        const display = type === 'Object' ? db.displayName(baseOf(n)) : null;
        if (s && !n.toLowerCase().includes(s) && !(display || '').toLowerCase().includes(s)) continue;
        out2.push({ name: n, display, users: type === 'Weapon' ? db.usersOfWeapon(n).slice(0, 3) : undefined });
        if (out2.length >= 300) break;
      }
      return out2;
    },
    'GET /api/commandset/:name': (q, [name]) => {
      const e = view.get('CommandSet', name);
      if (!e) return [404, { error: `Нет набора ${name}` }];
      return {
        name, slots: e.block.props.map(p => {
          const object = view.prop('CommandButton', p.value, 'Object');
          return { slot: +p.key, button: p.value, command: view.prop('CommandButton', p.value, 'Command'), object,
            upgrade: view.prop('CommandButton', p.value, 'Upgrade'), image: view.prop('CommandButton', p.value, 'ButtonImage'),
            display: object ? db.displayName(baseOf(object)) : null };
        }),
      };
    },
    'GET /api/buttons': (q) => {
      const s = (q.get('q') || '').toLowerCase();
      const out2 = [];
      for (const n of view.index.CommandButton.keys()) {
        const cmd = view.prop('CommandButton', n, 'Command') || '';
        if (/^(UNIT_BUILD|DOZER_CONSTRUCT)$/.test(cmd)) continue;
        const label = view.prop('CommandButton', n, 'TextLabel');
        const text = (label && db.csf.get(label.toLowerCase())) || null;
        if (s && !n.toLowerCase().includes(s) && !(text || '').toLowerCase().includes(s)) continue;
        out2.push({ name: n, command: cmd, text: text ? text.replace(/&/g, '') : null, image: view.prop('CommandButton', n, 'ButtonImage'),
          upgrade: view.prop('CommandButton', n, 'Upgrade'), power: view.prop('CommandButton', n, 'SpecialPower') });
        if (out2.length >= 300) break;
      }
      return out2;
    },
    'GET /api/tweaks': () => tweaks,
    'POST /api/tweaks': (q, _p, body) => {
      const t = { ...body, id: nextId++, createdAt: new Date().toISOString() };
      const before = tweaks;
      tweaks = tweaks.filter(x => !sameTarget(x, t)).concat(t);
      try { recompute(); } catch (e) { tweaks = before; recompute(); return [400, { error: `Правка не принята: ${e.message}` }]; }
      saveTweaks(tweaks, tweakerDir);
      return { tweak: t, errors: out.errors };
    },
    'DELETE /api/tweaks/:id': (q, [id]) => {
      tweaks = tweaks.filter(t => String(t.id) !== id);
      saveTweaks(tweaks, tweakerDir); recompute();
      return { ok: true, errors: out.errors };
    },
    'POST /api/apply': async () => {
      recompute();
      if (out.errors.length) return { ok: false, errors: out.errors };
      const written = await applyOutput(out.files, { gameDir, tweakerDir, userDir });
      return { ok: true, written };
    },
    'POST /api/reset': async () => ({ ok: true, ...(await resetOutput({ gameDir, tweakerDir, userDir })) }),
    'POST /api/play': () => { play(); return { ok: true }; },
  };

  const match = (method, path) => {
    for (const [k, fn] of Object.entries(routes)) {
      const [m, pat] = k.split(' ');
      if (m !== method) continue;
      const re = new RegExp('^' + pat.replace(/:\w+/g, '([^/]+)') + '$');
      const mm = path.match(re);
      if (mm) return [fn, mm.slice(1).map(decodeURIComponent)];
    }
    return null;
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'GET' && !sameOrigin(req)) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'Запрос с чужой страницы отклонён' }));
    }
    try {
      const icon = url.pathname.match(/^\/icon\/([A-Za-z0-9_]+)\/(button|portrait)\.png$/);
      if (icon) {
        const png = (await iconPng(db, vfs, decodeURIComponent(icon[1]).replace(/__.*$/, ''), icon[2]).catch(() => null)) || placeholderPng();
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' });
        return res.end(png);
      }
      const bimg = url.pathname.match(/^\/api\/button-image\/([A-Za-z0-9_]+)$/);
      if (bimg) {
        const b = decodeURIComponent(bimg[1]);
        const o = view.prop('CommandButton', b, 'Object');
        const png = (o ? await iconPng(db, vfs, o.replace(/^Cmdr_/, '').replace(/__.*$/, ''), 'button').catch(() => null)
          : (() => { try { return iconFromMappedImage(db, vfs, view.prop('CommandButton', b, 'ButtonImage') || ''); } catch { return null; } })()) || placeholderPng();
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(png);
      }
      const img = url.pathname.match(/^\/img\/([A-Za-z0-9_]+)\.png$/);
      if (img) {
        const png = (() => { try { return iconFromMappedImage(db, vfs, decodeURIComponent(img[1])); } catch { return null; } })() || placeholderPng();
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=86400' });
        return res.end(png);
      }
      const r = match(req.method, url.pathname);
      if (r) {
        let body = {};
        if (req.method === 'POST') {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        }
        let result = await r[0](url.searchParams, r[1], body);
        let status = 200;
        if (Array.isArray(result) && typeof result[0] === 'number') [status, result] = result;
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(result));
      }
      const file = join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
      if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      const status = e.code === 'ENOENT' ? 404 : 500;
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createApp();
  app.listen(PORT, '127.0.0.1', () => console.log(`ZH Tweaker: http://127.0.0.1:${PORT}`));
}
