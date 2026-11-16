// User tweaks: stored as a list, applied on top of a freshly built Commander.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseIni, setProp, setPropAt, removeModule, insertModule, blockText, findModule, findBlock } from './ini.js';
import { buildCommander, PREFIX, SLOT_LIMIT, INI_MAX_LINE } from './commander.js';
import { writeCsf } from './csf.js';
import { labelFor } from './labels.js';
import { TWEAKER_DIR } from './paths.js';

const TYPE_FILE = t => `Data/INI/${t}/ZHT_Commander.ini`;
export const GAMEDATA_FILE = 'Data/INI/GameData/ZHT_GameData.ini';
export const CSF_FILE = 'Data/English/generals.csf';
const SLOTS = ['PRIMARY', 'SECONDARY', 'TERTIARY'];

export function loadTweaks(dir = TWEAKER_DIR) {
  const f = join(dir, 'tweaks.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
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

let copyN = 0;
const OPS = {
  camera(w, t, out) { out.camera = Number(t.value); },
  aimFix() {},
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
    const text = blockText(srcLoc.file, m).replace(/^(\s*\w+\s*=\s*\w+)\s+\S+/, `$1 ModuleTag_ZHT_C${++copyN}`);
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
        if (/\bINFANTRY\b/.test(loc.block.props.find(p => p.key === 'KindOf')?.value || '') && w.aimFix) {
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
    const parsed = parseIni(text, 'raw');
    if (parsed.blocks.length !== 1) throw new Fail('Текст должен содержать ровно один блок с End');
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

export function buildOutput(db, tweaks) {
  const aimFixT = [...tweaks].reverse().find(t => t.op === 'aimFix');
  const aimFix = aimFixT ? !!aimFixT.on : true;
  const cmd = buildCommander(db, { aimFix });
  const w = new Work(db, cmd.files);
  w.aimFix = aimFix;
  copyN = 0;
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
      if (!(e instanceof Fail)) throw e;
      errors.push({ tweakId: t.id, message: e.message });
    }
  }
  const key = e => `${e.block}|${e.key}|${e.message}`;
  const baseline = baselineErrors(db);
  for (const e of validate(w)) if (!baseline.has(key(e))) errors.push({ ...e, tweakId: touched.get(e.block) ?? null });

  const files = new Map([...w.files].map(([p, f]) => [p, f.toString()]));
  if (out.camera != null && Number.isFinite(out.camera)) {
    files.set(GAMEDATA_FILE, `GameData\r\n  MaxCameraHeight = ${out.camera.toFixed(1)}\r\nEnd\r\n`);
  }
  if (db.csfRaw) files.set(CSF_FILE, writeCsf(db.csfRaw, cmd.csfAdd));
  return { files, errors, report: cmd.report };
}
