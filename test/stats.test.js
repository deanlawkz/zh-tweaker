import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { createApp } from '../src/server.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

let srv, base;
before(async () => {
  if (!hasGame) return;
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  const dir = tmp();
  srv = await createApp({ vfs, db: await loadGameDb(vfs), gameDir: tmp(), tweakerDir: dir, userDir: dir, play: () => {} });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => srv?.close());
const get = async p => (await fetch(base + p)).json();
const post = async (p, b) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();
const stat = (o, id) => o.stats.find(s => s.id === id);

test('главные цифры юнита: здоровье, скорость, цена, время, места', { skip: !hasGame }, async () => {
  const o = await get('/api/object/Cmdr_AmericaVehicleHumvee');
  assert.equal(stat(o, 'health').value, 240);
  assert.deepEqual(stat(o, 'health').edits.map(e => e.key), ['MaxHealth', 'InitialHealth']);
  assert.equal(stat(o, 'health').edits[0].module, 'ModuleTag_02');
  assert.equal(stat(o, 'speed').value, 60);
  assert.deepEqual(stat(o, 'speed').edits, [{ block: 'Locomotor:Cmdr_HumveeLocomotor', key: 'Speed' }]);
  assert.equal(stat(o, 'cost').value, 700);
  assert.equal(stat(o, 'buildTime').value, 10);
  assert.equal(stat(o, 'slots').value, 5);
});

test('здания: энергия, доход и что строит', { skip: !hasGame }, async () => {
  const pp = await get('/api/object/Cmdr_AmericaPowerPlant');
  assert.equal(stat(pp, 'energy').value, 5);
  assert.equal(stat(pp, 'energyBonus').value, 5);
  const bm = await get('/api/object/Cmdr_GLABlackMarket');
  assert.equal(stat(bm, 'income').value, 20);
  assert.equal(stat(bm, 'incomeEvery').value, 2);
  assert.equal(stat(bm, 'incomeEvery').scale, 1000);
  const br = await get('/api/object/Cmdr_AmericaBarracks');
  assert.ok(br.builds.some(b => b.name === 'Cmdr_AmericaInfantryRanger' && b.display));
});

test('изменения сгруппированы по юнитам, со словами вместо ключей', { skip: !hasGame }, async () => {
  await post('/api/tweaks', { op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', module: 'ModuleTag_02', key: 'MaxHealth', value: '999.0' });
  await post('/api/tweaks', { op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', module: 'ModuleTag_02', key: 'InitialHealth', value: '999.0' });
  await post('/api/tweaks', { op: 'set', block: 'Locomotor:Cmdr_HumveeLocomotor', key: 'Speed', value: '90' });
  await post('/api/tweaks', { op: 'weaponSlot', object: 'Cmdr_AmericaJetAurora', slot: 'PRIMARY', weapon: 'AuroraBombWeapon' });
  await post('/api/tweaks', { op: 'set', block: 'Weapon:Cmdr_AuroraBombWeapon__AmericaJetAurora', key: 'PrimaryDamage', value: '900' });
  await post('/api/tweaks', { op: 'camera', value: 690 });
  const groups = await get('/api/changes');
  const hv = groups.find(g => g.object === 'Cmdr_AmericaVehicleHumvee');
  assert.equal(hv.display, 'Humvee');
  const health = hv.items.find(i => i.text.startsWith('Здоровье'));
  assert.equal(health.ids.length, 2, 'здоровье и начальное здоровье одной строкой');
  assert.match(health.text, /240 → 999/);
  assert.ok(hv.items.some(i => /^Скорость/.test(i.text) && /60 → 90/.test(i.text)));
  const au = groups.find(g => g.object === 'Cmdr_AmericaJetAurora');
  assert.equal(au.items.length, 2, 'смена оружия и урон оружия у Авроры');
  assert.ok(au.items.every(i => !/Cmdr_|ModuleTag/.test(i.text)), au.items.map(i => i.text).join(' | '));
  assert.ok(groups.find(g => g.object == null).items.some(i => /Камера/.test(i.text)));
});
