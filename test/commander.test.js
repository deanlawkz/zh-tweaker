import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { buildCommander, mergeSlots, remapLine } from '../src/commander.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame } from './helpers.js';

test('remapLine меняет только значения, сохраняя комментарий', () => {
  const m = new Map([['A', 'Cmdr_A'], ['W', 'Cmdr_W']]);
  assert.equal(remapLine('    Object = A B ; A here\r\n', m), '    Object = Cmdr_A B ; A here\r\n');
  assert.equal(remapLine('  Weapon = PRIMARY W\n', m), '  Weapon = PRIMARY Cmdr_W\n');
  assert.equal(remapLine('  A = 1\n', m), '  A = 1\n');
});

test('mergeSlots: свои слоты на месте, лишнее в переполнение', () => {
  const base = new Map([[1, 'a'], [3, 'b']]);
  const extra = Array.from({ length: 14 }, (_, i) => 'x' + i);
  const r = mergeSlots(base, extra, 14);
  assert.equal(r.slots.get(1), 'a'); assert.equal(r.slots.get(3), 'b');
  assert.equal(r.slots.size, 14);
  assert.deepEqual(r.overflow, ['x12', 'x13']);
});

let db, r, db2;
before(async () => {
  if (!hasGame) return;
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  db = await loadGameDb(vfs);
  r = buildCommander(db, { aimFix: true });
  db2 = await loadGameDb(vfs);
  for (const [p, text] of r.files) db2.addFile(p.toLowerCase().replace(/\//g, '\\'), text);
});

test('Commander собирается', { skip: !hasGame }, () => {
  assert.ok(db2.get('Object', 'Cmdr_AmericaVehicleHumvee'));
  assert.equal(db2.side('Cmdr_AmericaVehicleHumvee'), 'Commander');
  assert.ok(db2.get('PlayerTemplate', 'FactionCommander'));
  assert.equal(db2.prop('PlayerTemplate', 'FactionCommander', 'StartingBuilding'), 'Cmdr_AmericaCommandCenter');
  assert.equal(r.csfAdd.get('SIDE:Commander'), 'Commander');
  assert.ok(db2.get('ControlBarScheme', 'Commander8x6'));
  assert.ok(r.report.cloned > 100);
});

test('командный центр строит трёх строителей', { skip: !hasGame }, () => {
  const set = db2.prop('Object', 'Cmdr_AmericaCommandCenter', 'CommandSet');
  const built = db2.get('CommandSet', set).block.props.map(p => db2.prop('CommandButton', p.value, 'Object'));
  for (const d of ['Cmdr_AmericaVehicleDozer', 'Cmdr_ChinaVehicleDozer', 'Cmdr_GLAInfantryWorker']) assert.ok(built.includes(d), d);
});

test('все ссылки Cmdr_ разрешаются', { skip: !hasGame }, () => {
  const bad = [];
  for (const [p, text] of r.files) {
    for (const m of text.matchAll(/\bCmdr_\w+/g)) {
      const n = m[0];
      const ok = ['Object', 'Weapon', 'Locomotor', 'CommandSet', 'CommandButton'].some(t => db2.get(t, n));
      if (!ok) bad.push(`${p}: ${n}`);
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 10), []);
});

test('пехота получает AcceptableAimDelta 180 только при aimFix', { skip: !hasGame }, () => {
  const w = db2.weaponsOf('Cmdr_AmericaInfantryRanger')[0];
  assert.ok(w.startsWith('Cmdr_'));
  assert.equal(db2.prop('Weapon', w, 'AcceptableAimDelta'), '180');
  const r2 = buildCommander(db, { aimFix: false });
  const wt = r2.files.get('Data/INI/Weapon/ZHT_Commander.ini');
  const i = wt.indexOf('Weapon Cmdr_RangerAdvancedCombatRifle');
  assert.ok(i >= 0);
  assert.ok(!/AcceptableAimDelta/.test(wt.slice(i, wt.indexOf('\nEnd', i))));
});

test('ванильные записи не изменились', { skip: !hasGame }, () => {
  for (const text of r.files.values()) {
    assert.ok(!/^Object AmericaVehicleHumvee\b/m.test(text));
    assert.ok(!/^Weapon\s+(?!\s|Cmdr_)/m.test(text));
    assert.ok(!/^Object\s+(?!\s|Cmdr_)/m.test(text));
  }
});

test('наборы не длиннее 14 кнопок, лишнее в отчёте', { skip: !hasGame }, () => {
  for (const [, e] of db2.index.CommandSet) {
    if (!e.block.name.startsWith('Cmdr_')) continue;
    assert.ok(e.block.props.every(p => +p.key >= 1 && +p.key <= 14), e.block.name);
  }
  assert.ok(Array.isArray(r.report.overflow));
});

test('ни одна строка не длиннее предела движка (1028)', { skip: !hasGame }, () => {
  for (const [p, text] of r.files) for (const l of text.split(/\r?\n/)) assert.ok(l.length < 1028, `${p}: ${l.slice(0, 60)}...`);
});

test('все генеральские способности выдаются командным центром', { skip: !hasGame }, () => {
  const cc = db2.get('Object', 'Cmdr_AmericaCommandCenter').block;
  const granted = cc.modules.filter(m => m.className === 'GrantScienceUpgrade' && m.tag.startsWith('ModuleTag_ZHT_Sci')).map(m => m.props.find(p => p.key === 'GrantScience').value);
  assert.equal(granted.length, db.index.Science.size);
  assert.ok(db2.get('Upgrade', 'Upgrade_ZHT_AllSciences'));
});
