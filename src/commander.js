// Builds the Commander faction: Cmdr_ copies of every buildable object of every side and general.
import { blockText } from './ini.js';

export const PREFIX = 'Cmdr_';
export const SLOT_LIMIT = 14;
const BUILDERS = ['AmericaVehicleDozer', 'ChinaVehicleDozer', 'GLAInfantryWorker'];
const BUILD_CMDS = /^(UNIT_BUILD|DOZER_CONSTRUCT)$/;
const SP_MODULE = /SpecialPower|SpecialAbility/;
export const ALL_SCIENCES = 'Upgrade_ZHT_AllSciences';
export const INI_MAX_LINE = 1028;
const FILE = t => `Data/INI/${t}/ZHT_Commander.ini`;

// Replace whole-word tokens in the value part of an "Key = value ; comment" line.
export function remapLine(line, map) {
  const m = line.match(/^(\s*[^=;]*=)([^;\r\n]*?)(\s*(?:;.*|\/\/.*)?)(\r?\n)?$/);
  if (!m) return line;
  const value = m[2].replace(/[A-Za-z0-9_]+/g, tok => map.get(tok) ?? tok);
  return m[1] + value + m[3] + (m[4] || '');
}

export function remapText(text, map) {
  return text.split(/(?<=\n)/).map(l => (l.includes('=') ? remapLine(l, map) : l)).join('');
}

// Keep base slot positions, fill free slots 1..limit with extras in order.
export function mergeSlots(base, extras, limit) {
  const slots = new Map(base);
  const overflow = [];
  let next = 1;
  for (const x of extras) {
    while (next <= limit && slots.has(next)) next++;
    if (next > limit) overflow.push(x);
    else slots.set(next, x);
  }
  return { slots, overflow };
}

const baseSide = side => (/^America/.test(side) ? 'America' : /^China|^Boss/.test(side) ? 'China' : /^GLA/.test(side) ? 'GLA' : side);

function setLine(text, key, value) {
  const re = new RegExp(`^(\\s*${key}\\s*=\\s*)[^;\\r\\n]*`, 'mi');
  if (re.test(text)) return text.replace(re, `$1${value}`);
  // insert after the header line
  const nl = text.indexOf('\n') + 1;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return text.slice(0, nl) + `  ${key} = ${value}${eol}` + text.slice(nl);
}

export function buildCommander(db, opts = { aimFix: true }) {
  const P = (t, n, k) => db.prop(t, n, k);
  const eol = '\r\n';

  // 1. Reachable buildable objects.
  const factions = [...db.index.PlayerTemplate.keys()].filter(n => !/Civilian|Observer|Boss|Commander/.test(n));
  const B = new Set();
  const setsOf = new Map(); // object -> [command sets]
  const seenSets = new Set();
  const buttonsOfSet = s => (db.get('CommandSet', s)?.block.props || []).map(p => ({ slot: +p.key, button: p.value }));
  const builds = btn => {
    const c = P('CommandButton', btn, 'Command');
    const o = P('CommandButton', btn, 'Object');
    return c && o && BUILD_CMDS.test(c) && db.get('Object', o) ? o : null;
  };
  const objSets = o => {
    const e = db.get('Object', o);
    const out = [];
    const cs = P('Object', o, 'CommandSet');
    if (cs) out.push(cs);
    for (const m of e?.block.modules || []) {
      if (m.className === 'CommandSetUpgrade') {
        for (const p of m.props) if (/^CommandSet(Alt)?$/i.test(p.key)) out.push(p.value);
      }
    }
    return out;
  };
  const visitSet = s => {
    if (!s || seenSets.has(s)) return;
    seenSets.add(s);
    for (const { button } of buttonsOfSet(s)) { const o = builds(button); if (o) visitObj(o); }
  };
  const visitObj = o => {
    if (!o || B.has(o) || !db.get('Object', o)) return;
    B.add(o);
    setsOf.set(o, objSets(o));
    for (const s of setsOf.get(o)) visitSet(s);
  };
  for (const f of factions) { visitObj(P('PlayerTemplate', f, 'StartingBuilding')); visitObj(P('PlayerTemplate', f, 'StartingUnit0')); }

  // 2. Representatives: one object per (base side, kind, display name), vanilla preferred.
  const groups = new Map();
  for (const o of B) {
    const key = `${baseSide(db.side(o) || '')}|${db.kind(o)}|${db.displayName(o) || o}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  const rep = new Map();
  for (const members of groups.values()) {
    members.sort((a, b) => (db.general(a) ? 1 : 0) - (db.general(b) ? 1 : 0) || a.localeCompare(b));
    for (const m of members) rep.set(m, members[0]);
  }
  for (const b of BUILDERS) if (B.has(b)) rep.set(b, b);
  const K = [...new Set(rep.values())];
  const variants = k => [...B].filter(o => rep.get(o) === k);

  // 3. Rename map.
  const map = new Map();
  for (const o of B) map.set(o, PREFIX + rep.get(o));
  const weapons = new Set(), locos = new Set();
  for (const k of K) {
    for (const w of db.weaponsOf(k)) if (db.get('Weapon', w)) weapons.add(w);
    const e = db.get('Object', k);
    const scan = node => {
      for (const p of node.props) {
        if (/^(Locomotor)$/i.test(p.key)) for (const t of p.value.split(/\s+/).slice(1)) if (db.get('Locomotor', t)) locos.add(t);
        if (/^(DeathWeapon|Weapon)$/i.test(p.key)) for (const t of p.value.split(/\s+/)) if (db.get('Weapon', t)) weapons.add(t);
      }
      node.modules.forEach(scan);
    };
    scan(e.block);
  }
  for (const w of weapons) map.set(w, PREFIX + w);
  for (const l of locos) map.set(l, PREFIX + l);

  // 4. Command sets and buttons.
  const report = { cloned: 0, overflow: [] };
  const out = { Object: [], Weapon: [], Locomotor: [], CommandSet: [], CommandButton: [], PlayerTemplate: [], ControlBarScheme: [], Upgrade: [] };
  const newButtons = new Map(); // target object -> button name
  const buildButton = (srcBtn, target) => {
    if (newButtons.has(target)) return newButtons.get(target);
    const name = `${PREFIX}Command_Build_${target.slice(PREFIX.length)}`;
    const src = db.get('CommandButton', srcBtn);
    let t = blockText(db.files.get(src.file), src.block).replace(/^(\s*CommandButton\s+)\S+/, `$1${name}`);
    t = setLine(t, 'Object', target);
    out.CommandButton.push(t);
    newButtons.set(target, name);
    return name;
  };
  const buttonKey = btn => {
    const o = builds(btn);
    if (o) return { key: 'build:' + rep.get(o), make: () => buildButton(btn, PREFIX + rep.get(o)) };
    const up = P('CommandButton', btn, 'Upgrade');
    if (up) return { key: 'upg:' + up, make: () => btn };
    const sp = P('CommandButton', btn, 'SpecialPower');
    if (sp) return { key: 'sp:' + sp, make: () => btn };
    return { key: 'btn:' + btn, make: () => btn };
  };
  const writeSet = (name, slots) => {
    const lines = [...slots].sort((a, b) => a[0] - b[0]).map(([s, b]) => `  ${s} = ${b}`);
    out.CommandSet.push(`CommandSet ${name}${eol}${lines.join(eol)}${eol}End${eol}`);
  };
  const setName = new Map(); // object -> merged set name
  for (const k of K) {
    const main = P('Object', k, 'CommandSet');
    if (!main) continue;
    const name = `${PREFIX}${k}_CommandSet`;
    setName.set(k, name);
    const seen = new Set();
    const base = new Map();
    for (const { slot, button } of buttonsOfSet(main)) {
      const bk = buttonKey(button);
      if (seen.has(bk.key) || slot > SLOT_LIMIT) continue;
      seen.add(bk.key); base.set(slot, bk.make());
    }
    const extras = [];
    if (k === 'AmericaCommandCenter') {
      for (const d of BUILDERS.slice(1)) {
        const btn = [...db.index.CommandButton.keys()].find(b => builds(b) === d && P('CommandButton', b, 'Command') === 'UNIT_BUILD');
        if (btn) { const bk = buttonKey(btn); if (!seen.has(bk.key)) { seen.add(bk.key); extras.push(bk.make()); } }
      }
    }
    for (const v of variants(k)) {
      if (v === k) continue;
      const vs = P('Object', v, 'CommandSet');
      for (const { button } of buttonsOfSet(vs)) {
        const bk = buttonKey(button);
        if (seen.has(bk.key)) continue;
        seen.add(bk.key); extras.push(bk.make());
      }
    }
    const merged = mergeSlots(base, extras, SLOT_LIMIT);
    if (merged.overflow.length) report.overflow.push({ commandSet: name, dropped: merged.overflow });
    writeSet(name, merged.slots);
  }
  // Alternate sets switched by upgrades: plain copies with remapped buttons.
  for (const k of K) {
    for (const s of setsOf.get(k).slice(1)) {
      if (map.has(s) || !db.get('CommandSet', s)) continue;
      map.set(s, PREFIX + s);
      const slots = new Map();
      for (const { slot, button } of buttonsOfSet(s)) if (slot <= SLOT_LIMIT) slots.set(slot, buttonKey(button).make());
      writeSet(PREFIX + s, slots);
    }
  }

  // 5. Objects.
  let tagN = 0;
  for (const k of K) {
    const e = db.get('Object', k);
    let t = blockText(db.files.get(e.file), e.block);
    // Special powers of other generals' variants (e.g. their command centers).
    const have = new Set(e.block.modules.map(m => m.props.find(p => p.key === 'SpecialPowerTemplate')?.value).filter(Boolean));
    const add = [];
    for (const v of variants(k)) {
      if (v === k) continue;
      const ve = db.get('Object', v);
      for (const m of ve.block.modules) {
        if (!m.className || !SP_MODULE.test(m.className)) continue;
        const sp = m.props.find(p => p.key === 'SpecialPowerTemplate')?.value;
        if (!sp || have.has(sp)) continue;
        have.add(sp);
        add.push(blockText(db.files.get(ve.file), m).replace(/(ModuleTag_\w+|\S+)(\s*(?:;.*)?\r?\n)/, `ModuleTag_ZHT_${++tagN}$2`));
      }
    }
    t = remapText(t, map);
    t = t.replace(/^(\s*Object\s+)\S+/, `$1${PREFIX}${k}`);
    t = setLine(t, 'Side', 'Commander');
    if (setName.has(k)) t = setLine(t, 'CommandSet', setName.get(k));
    if (k === 'AmericaCommandCenter') {
      // All general powers: a hidden player upgrade granted on creation unlocks every science.
      // (IntrinsicSciences cannot hold them all: the engine limits an INI line to 1028 characters.)
      add.push(`  Behavior = GrantUpgradeCreate ModuleTag_ZHT_Grant${eol}    UpgradeToGrant = ${ALL_SCIENCES}${eol}  End${eol}`);
      let s = 0;
      for (const sc of db.index.Science.keys()) {
        add.push(`  Behavior = GrantScienceUpgrade ModuleTag_ZHT_Sci${++s}${eol}    GrantScience = ${sc}${eol}    TriggeredBy = ${ALL_SCIENCES}${eol}  End${eol}`);
      }
    }
    if (add.length) {
      const end = t.search(/^End\b[^\n]*\n?$/m);
      t = t.slice(0, end) + add.map(a => remapText(a, map)).join('') + t.slice(end);
    }
    out.Object.push(t);
    report.cloned++;
  }

  // 6. Weapons (aim fix for infantry) and locomotors.
  const infantryWeapons = new Set();
  for (const k of K) if (/\bINFANTRY\b/.test(P('Object', k, 'KindOf') || '')) db.weaponsOf(k).forEach(w => infantryWeapons.add(w));
  for (const w of weapons) {
    const e = db.get('Weapon', w);
    let t = blockText(db.files.get(e.file), e.block).replace(/^(\s*Weapon\s+)\S+/, `$1${PREFIX}${w}`);
    if (opts.aimFix && infantryWeapons.has(w)) t = setLine(t, 'AcceptableAimDelta', '180');
    out.Weapon.push(t);
  }
  for (const l of locos) {
    const e = db.get('Locomotor', l);
    out.Locomotor.push(blockText(db.files.get(e.file), e.block).replace(/^(\s*Locomotor\s+)\S+/, `$1${PREFIX}${l}`));
  }

  // 7. Faction, control bar, strings.
  const am = db.get('PlayerTemplate', 'FactionAmerica');
  let pt = blockText(db.files.get(am.file), am.block).replace(/^(\s*PlayerTemplate\s+)\S+/, '$1FactionCommander');
    for (const [k, v] of [['Side', 'Commander'], ['BaseSide', 'USA'], ['PlayableSide', 'Yes'], ['OldFaction', 'No'],
    ['DisplayName', 'SIDE:Commander'], ['StartingBuilding', PREFIX + 'AmericaCommandCenter'],
    ['StartingUnit0', PREFIX + 'AmericaVehicleDozer'], ['IntrinsicSciences', 'SCIENCE_AMERICA SCIENCE_CHINA SCIENCE_GLA'], ['PreferredColor', 'R:255 G:200 B:0']]) pt = setLine(pt, k, v);
  out.PlayerTemplate.push(pt);
  out.Upgrade.push(`Upgrade ${ALL_SCIENCES}${eol}  Type = PLAYER${eol}  BuildTime = 0.0${eol}  BuildCost = 0${eol}End${eol}`);
  const cb = db.get('ControlBarScheme', 'America8x6');
  if (cb) out.ControlBarScheme.push(setLine(blockText(db.files.get(cb.file), cb.block).replace(/^(\s*ControlBarScheme\s+)\S+/, '$1Commander8x6'), 'Side', 'Commander'));

  const files = new Map();
  for (const [type, blocks] of Object.entries(out)) {
    if (blocks.length) files.set(FILE(type), blocks.map(b => (b.endsWith('\n') ? b : b + eol)).join(eol));
  }
  const csfAdd = new Map([['SIDE:Commander', 'Commander'], ['INI:FactionCommander', 'Commander']]);
  return { files, csfAdd, report, map, rep };
}
