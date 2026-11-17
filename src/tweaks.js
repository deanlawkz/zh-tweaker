// User tweaks: stored as a list, applied on top of a freshly built Commander.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { parseIni, setProp, setPropAt, removeModule, insertModule, blockText, findModule, findBlock } from './ini.js';
import { buildCommander, PREFIX, SLOT_LIMIT, INI_MAX_LINE, firesProjectile } from './commander.js';
import { writeCsf } from './csf.js';
import { labelFor } from './labels.js';
import { TWEAKER_DIR } from './paths.js';

const TYPE_FILE = t => `Data/INI/${t}/ZHT_Commander.ini`;
export const GAMEDATA_FILE = 'Data/INI/GameData/ZHT_GameData.ini';
export const CSF_FILE = 'Data/English/generals.csf';
const SLOTS = ['PRIMARY', 'SECONDARY', 'TERTIARY'];
const REF_TYPES = ['Object', 'Weapon', 'Locomotor', 'CommandSet', 'CommandButton', 'Upgrade'];

export function loadTweaks(dir = TWEAKER_DIR) {
  const f = join(dir, 'tweaks.json');
  if (!existsSync(f)) return [];
  try {
    const list = JSON.parse(readFileSync(f, 'utf8'));
    if (Array.isArray(list)) return list;
  } catch { /* fall through */ }
  // Keep the broken file for the user, start with an empty list.
  renameSync(f, join(dir, `tweaks.broken-${Date.now()}.json`));
  return [];
}

export function saveTweaks(list, dir = TWEAKER_DIR) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tweaks.json'), JSON.stringify(list, null, 2));
}

class Fail extends Error {}

// Working set: generated INI files, editable, with lookup of their blocks.
class Work {
  constructor(db, files) {
    this.db = db;
    this.files = new Map([...files].map(([p, t]) => [p, parseIni(t, p)]));
  }
  locate(type, name) {
    const f = this.files.get(TYPE_FILE(type));
    const b = f && findBlock(f, type, name);
    return b ? { path: TYPE_FILE(type), file: f, block: b } : null;
  }
  exists(type, name) { return !!(this.locate(type, name) || this.db.get(type, name)); }
  edit(path, fn) { this.files.set(path, fn(this.files.get(path))); }
  ensureFile(type) {
    const p = TYPE_FILE(type);
    if (!this.files.has(p)) this.files.set(p, parseIni('', p));
    return p;
  }
  append(type, text) {
    const p = this.ensureFile(type);
    const f = this.files.get(p);
    const sep = f.text && !f.text.endsWith('\n') ? '\r\n' : '';
    this.files.set(p, parseIni(f.text + sep + text + (text.endsWith('\n') ? '' : '\r\n'), p));
  }
  // Text of a block from generated files or from vanilla.
  source(type, name) {
    const w = this.locate(type, name);
    if (w) return blockText(w.file, w.block);
    const v = this.db.get(type, name);
    return v ? blockText(this.db.files.get(v.file), v.block) : null;
  }
}

const parseRef = ref => { const i = ref.indexOf(':'); return { type: ref.slice(0, i), name: ref.slice(i + 1) }; };

function mustBeCommander(name) {
  if (!name.startsWith(PREFIX)) throw new Fail(`«${name}» не из фракции Commander: менять можно только Cmdr_-копии`);
}

function target(w, ref) {
  const { type, name } = parseRef(ref);
  mustBeCommander(name);
  const loc = w.locate(type, name);
  if (!loc) throw new Fail(`Нет записи ${type} ${name}`);
  return loc;
}

const OPS = {
  camera(w, t, out) {
    const v = Number(t.value);
    if (!Number.isFinite(v) || v < 100 || v > 5000) throw new Fail(`Высота камеры: «${t.value}» вне 100..5000`);
    out.camera = v;
  },
  aimFix() {},
  battleFx() {},
  set(w, t) {
    const loc = target(w, t.block);
    let owner = loc.block;
    if (t.module) {
      owner = findModule(loc.block, t.module);
      if (!owner) throw new Fail(`В ${loc.block.name} нет модуля ${t.module}`);
    }
    const lab = labelFor(owner.className || owner.kind || null, t.key);
    if (lab?.type === 'number') {
      const v = parseFloat(t.value);
      if (!Number.isFinite(v)) throw new Fail(`${lab.ru}: «${t.value}» не число`);
      if ((lab.min != null && v < lab.min) || (lab.max != null && v > lab.max)) throw new Fail(`${lab.ru}: ${v} вне ${lab.min}..${lab.max}`);
    }
    w.edit(loc.path, f => setProp(f, owner, t.key, String(t.value)));
  },
  removeModule(w, t) {
    const loc = target(w, t.block);
    const m = findModule(loc.block, t.module);
    if (!m) throw new Fail(`В ${loc.block.name} нет модуля ${t.module}`);
    w.edit(loc.path, f => removeModule(f, loc.block, m));
  },
  copyModule(w, t) {
    const from = parseRef(t.from);
    const srcLoc = w.locate(from.type, from.name) || (() => {
      const v = w.db.get(from.type, from.name);
      return v && { file: w.db.files.get(v.file), block: v.block };
    })();
    if (!srcLoc) throw new Fail(`Нет записи ${t.from}`);
    const m = findModule(srcLoc.block, t.module);
    if (!m) throw new Fail(`В ${from.name} нет модуля ${t.module}`);
    const loc = target(w, t.to);
    const text = blockText(srcLoc.file, m).replace(/^(\s*\w+\s*=\s*\w+)\s+\S+/, `$1 ModuleTag_ZHT_C${t.id}`);
    w.edit(loc.path, f => insertModule(f, findBlock(f, loc.block.type, loc.block.name), text));
  },
  weaponSlot(w, t) {
    if (!SLOTS.includes(t.slot)) throw new Fail(`Неизвестный слот ${t.slot}`);
    const loc = target(w, `Object:${t.object}`);
    let weapon = t.weapon;
    if (weapon && weapon.toLowerCase() !== 'none') {
      const src = w.source('Weapon', weapon);
      if (!src) throw new Fail(`Нет оружия ${weapon}`);
      const base = weapon.startsWith(PREFIX) ? weapon.slice(PREFIX.length).replace(/__.*$/, '') : weapon;
      const clone = `${PREFIX}${base}__${t.object.slice(PREFIX.length)}`;
      if (!w.locate('Weapon', clone)) {
        let text = src.replace(/^(\s*Weapon\s+)\S+/, `$1${clone}`);
        const kindOf = loc.block.props.find(p => p.key === 'KindOf')?.value || '';
        // A ground gun limits barrel pitch (tank: ±15°); from a flying unit every ground target is steeper,
        // so the order to attack is refused. Aircraft get the clone without the limit.
        if (/\bAIRCRAFT\b/.test(kindOf)) text = text.replace(/^[ \t]*M(?:in|ax)TargetPitch\b[^\n]*\n/gm, '');
        if (/\bINFANTRY\b/.test(kindOf) && w.aimFix && !firesProjectile(text)) {
          text = setProp(parseIni(text, 'w'), parseIni(text, 'w').blocks[0], 'AcceptableAimDelta', '180').toString();
        }
        w.append('Weapon', text);
      }
      weapon = clone;
    }
    const want = `${t.slot} ${weapon || 'NONE'}`;
    w.edit(loc.path, f => {
      let g = f;
      for (let i = 0; ; i++) {
        const sets = findBlock(g, 'Object', t.object).modules.filter(m => m.kind.toLowerCase() === 'weaponset');
        if (i >= sets.length) return g;
        const s = sets[i];
        const p = s.props.find(x => x.key.toLowerCase() === 'weapon' && x.value.split(/\s+/)[0].toUpperCase() === t.slot);
        g = p ? setPropAt(g, p, want) : insertModule(g, s, `    Weapon = ${want}`);
      }
    });
  },
  commandSlot(w, t) {
    mustBeCommander(t.commandSet);
    const loc = w.locate('CommandSet', t.commandSet);
    if (!loc) throw new Fail(`Нет набора ${t.commandSet}`);
    const slot = Number(t.slot);
    if (!(slot >= 1 && slot <= SLOT_LIMIT)) throw new Fail(`Слот ${t.slot} вне 1..${SLOT_LIMIT}`);
    const existing = loc.block.props.find(p => Number(p.key) === slot);
    if (t.button == null) {
      if (existing) w.edit(loc.path, f => parseIni(f.text.slice(0, existing.start) + f.text.slice(existing.end), f.file));
      return;
    }
    let button = t.button;
    if (button.startsWith('build:')) button = buildButtonFor(w, button.slice(6));
    if (!w.exists('CommandButton', button)) throw new Fail(`Нет кнопки ${button}`);
    w.edit(loc.path, f => setProp(f, findBlock(f, 'CommandSet', t.commandSet), String(slot), button));
  },
  raw(w, t) {
    const loc = target(w, t.block);
    const text = t.text.endsWith('\n') ? t.text : t.text + '\r\n';
    let parsed;
    try { parsed = parseIni(text, 'raw'); } catch (e) { throw new Fail(`Текст не разобран: ${e.message.replace(/^raw: /, '')}`); }
    if (parsed.blocks.length !== 1) throw new Fail('Текст должен содержать ровно один блок с End');
    const b = parsed.blocks[0];
    if (b.type !== loc.block.type || b.name !== loc.block.name) {
      throw new Fail(`Первая строка должна остаться «${loc.block.type} ${loc.block.name}», а не «${b.type} ${b.name}»`);
    }
    w.edit(loc.path, f => parseIni(f.text.slice(0, loc.block.start) + text + f.text.slice(loc.block.end), f.file));
  },
};

function buildButtonFor(w, obj) {
  mustBeCommander(obj);
  if (!w.exists('Object', obj)) throw new Fail(`Нет объекта ${obj}`);
  const name = `${PREFIX}Command_Build_${obj.slice(PREFIX.length)}`;
  if (w.exists('CommandButton', name)) return name;
  const base = obj.slice(PREFIX.length);
  const kind = /\bSTRUCTURE\b/.test(w.db.prop('Object', base, 'KindOf') || '') ? 'DOZER_CONSTRUCT' : 'UNIT_BUILD';
  const img = w.db.prop('Object', base, 'ButtonImage');
  const label = w.db.prop('Object', base, 'DisplayName');
  w.append('CommandButton', [
    `CommandButton ${name}`, `  Command = ${kind}`, `  Object = ${obj}`,
    label ? `  TextLabel = ${label}` : null, img ? `  ButtonImage = ${img}` : null,
    '  ButtonBorderType = BUILD', 'End', '',
  ].filter(x => x !== null).join('\r\n'));
  return name;
}

// Reference check over generated files.
function validate(w) {
  const errors = [];
  const err = (block, key, message) => errors.push({ block, key, message });
  for (const [path, f] of w.files) {
    for (const l of f.text.split(/\r?\n/)) if (l.length >= INI_MAX_LINE) err(path, null, `Строка длиннее ${INI_MAX_LINE} символов`);
    for (const b of f.blocks) {
      const walk = (node, cls) => {
        for (const p of node.props) {
          const lab = labelFor(cls, p.key);
          if (lab?.type === 'ref' && p.value && !/^none$/i.test(p.value)) {
            const name = p.value.split(/\s+/)[0];
            if (!w.exists(lab.ref, name)) err(`${b.type} ${b.name}`, p.key, `${lab.ru}: нет записи «${name}»`);
          }
          const kl = p.key.toLowerCase();
          if (kl === 'locomotor') {
            for (const l of p.value.split(/\s+/).slice(1)) if (l && !w.exists('Locomotor', l)) err(`${b.type} ${b.name}`, p.key, `Ходовая: нет записи «${l}»`);
          }
          if (node.kind?.toLowerCase() === 'prerequisites' && kl === 'object') {
            for (const o of p.value.split(/\s+/)) if (o && !w.exists('Object', o)) err(`${b.type} ${b.name}`, 'Prerequisites', `Требование для постройки: нет объекта «${o}»`);
          }
          for (const tok of p.value.match(/\bCmdr_\w+/g) || []) {
            if (!REF_TYPES.some(rt => w.exists(rt, tok))) err(`${b.type} ${b.name}`, p.key, `Нет записи «${tok}»`);
          }
          if (node.kind?.toLowerCase() === 'weaponset' && p.key.toLowerCase() === 'weapon') {
            const wn = p.value.split(/\s+/)[1];
            if (wn && !/^none$/i.test(wn) && !w.exists('Weapon', wn)) err(`${b.type} ${b.name}`, 'Weapon', `Оружие: нет записи «${wn}»`);
          }
        }
        for (const m of node.modules) walk(m, m.className || m.kind);
      };
      walk(b, null);
      if (b.type === 'CommandSet') for (const p of b.props) if (!w.exists('CommandButton', p.value)) err(`CommandSet ${b.name}`, p.key, `Нет кнопки «${p.value}»`);
      if (b.type === 'CommandButton') {
        const o = b.props.find(p => p.key === 'Object')?.value;
        if (o && !w.exists('Object', o)) err(`CommandButton ${b.name}`, 'Object', `Нет объекта «${o}»`);
      }
    }
  }
  return errors;
}

// Problems already present in the untouched Commander (vanilla data quirks) are not the user's errors.
const baselineCache = new WeakMap();
function baselineErrors(db) {
  if (!baselineCache.has(db)) {
    const w = new Work(db, buildCommander(db, { aimFix: true }).files);
    baselineCache.set(db, new Set(validate(w).map(e => `${e.block}|${e.key}|${e.message}`)));
  }
  return baselineCache.get(db);
}

// Files under "@user/" go to the GeneralsX settings folder (USER_DIR), not the game folder.
export const SAGE_FILE = '@user/SagePatch.ini';
export const GAMELOD_FILE = 'Data/INI/GameLOD/ZHT_GameLOD.ini';

// Big battles (8 armies) hit the stock limits: 3000 particles and 24 world sounds at "High",
// and when FPS drops the game stops drawing weapon trails. Missiles then fly as black dots with no sound.
// The engine reads Data/INI/GameLOD/ after GameLOD.ini; a block with the same name updates only the listed fields.
export const BATTLE_FX_LOD = [
  'StaticGameLOD = High', '  MaxParticleCount = 12000', '  SampleCount2D = 12', '  SampleCount3D = 64', 'End',
  'DynamicGameLOD = Medium', '  MinParticlePriority = WEAPON_TRAIL', '  ParticleSkipMask = 0', 'End',
  'DynamicGameLOD = Low', '  MinParticlePriority = WEAPON_TRAIL', '  ParticleSkipMask = 1', 'End', ''].join('\r\n');

// Sets MaxCameraHeight in SagePatch.ini text, keeping everything else.
export function patchCamera(text, value) {
  const v = Number(value).toFixed(1);
  if (!text) return `GameData\r\n  MaxCameraHeight = ${v}\r\nEnd\r\n`;
  if (/^\s*MaxCameraHeight\s*=/mi.test(text)) return text.replace(/^(\s*MaxCameraHeight\s*=\s*)[^;\r\n]*/mi, `$1${v}`);
  return text.replace(/^End\b/m, `  MaxCameraHeight = ${v}\r\nEnd`);
}

export function buildOutput(db, tweaks, { sagePatch = null } = {}) {
  const aimFixT = [...tweaks].reverse().find(t => t.op === 'aimFix');
  const aimFix = aimFixT ? !!aimFixT.on : true;
  const cmd = buildCommander(db, { aimFix });
  const w = new Work(db, cmd.files);
  w.aimFix = aimFix;
  const out = { camera: null };
  const errors = [];
  const touched = new Map();
  for (const t of tweaks) {
    const op = OPS[t.op];
    if (!op) { errors.push({ tweakId: t.id, message: `Неизвестная правка ${t.op}` }); continue; }
    try {
      op(w, t, out);
      for (const k of [t.block, t.to, t.object && `Object:${t.object}`, t.commandSet && `CommandSet:${t.commandSet}`].filter(Boolean)) {
        touched.set(k.replace(':', ' '), t.id);
      }
      if (t.op === 'weaponSlot' && t.weapon) touched.set(`Object ${t.object}`, t.id);
    } catch (e) {
      errors.push({ tweakId: t.id, message: e instanceof Fail ? e.message : `Правка не выполнена: ${e.message}` });
    }
  }
  const key = e => `${e.block}|${e.key}|${e.message}`;
  const baseline = baselineErrors(db);
  for (const e of validate(w)) if (!baseline.has(key(e))) errors.push({ ...e, tweakId: touched.get(e.block) ?? null });

  const files = new Map([...w.files].map(([p, f]) => [p, f.toString()]));
  if (out.camera != null && Number.isFinite(out.camera)) {
    files.set(GAMEDATA_FILE, `GameData\r\n  MaxCameraHeight = ${out.camera.toFixed(1)}\r\nEnd\r\n`);
    files.set(SAGE_FILE, patchCamera(sagePatch, out.camera));
  }
  const fxT = [...tweaks].reverse().find(t => t.op === 'battleFx');
  if (fxT ? fxT.on : true) files.set(GAMELOD_FILE, BATTLE_FX_LOD);
  if (db.csfRaw) files.set(CSF_FILE, writeCsf(db.csfRaw, cmd.csfAdd));
  return { files, errors, report: cmd.report };
}
