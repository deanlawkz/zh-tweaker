import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { createApp } from '../src/server.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

let srv, base, game, dir;
before(async () => {
  if (!hasGame) return;
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  game = tmp(); dir = tmp();
  srv = await createApp({ vfs, db: await loadGameDb(vfs), gameDir: game, tweakerDir: dir, play: () => {} });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => srv?.close());
const get = async p => { const r = await fetch(base + p); return { status: r.status, type: r.headers.get('content-type'), body: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) }; };
const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) }); return { status: r.status, body: await r.json() }; };

test('список объектов Commander с поиском', { skip: !hasGame }, async () => {
  const r = await get('/api/objects?q=humvee');
  assert.equal(r.status, 200);
  const h = r.body.find(o => o.name === 'Cmdr_AmericaVehicleHumvee');
  assert.equal(h.display, 'Humvee'); assert.equal(h.side, 'America'); assert.equal(h.kind, 'unit');
  assert.ok((await get('/api/objects')).body.every(o => o.name.startsWith('Cmdr_')));
});

test('карточка объекта с подписями', { skip: !hasGame }, async () => {
  const r = await get('/api/object/Cmdr_AmericaVehicleHumvee');
  const tc = r.body.modules.find(m => m.className === 'TransportContain');
  assert.equal(tc.label, 'Транспорт');
  assert.equal(tc.props.find(p => p.key === 'Slots').label.ru, 'Мест для пассажиров');
  assert.ok(r.body.text.startsWith('Object Cmdr_AmericaVehicleHumvee'));
  assert.equal((await get('/api/object/Nope')).status, 404);
});

test('иконка и заглушка', { skip: !hasGame }, async () => {
  const r = await get('/icon/Cmdr_AmericaVehicleHumvee/button.png');
  assert.equal(r.type, 'image/png'); assert.equal(r.body.readUInt32BE(16), 60);
  assert.equal((await get('/icon/Nothing/button.png')).body.readUInt32BE(16), 60);
});

test('правка, повторная правка того же поля заменяет, применение и сброс', { skip: !hasGame }, async () => {
  const tag = (await get('/api/object/Cmdr_AmericaVehicleHumvee')).body.modules.find(m => m.className === 'TransportContain').tag;
  await post('/api/tweaks', { op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', module: tag, key: 'Slots', value: '10' });
  await post('/api/tweaks', { op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', module: tag, key: 'Slots', value: '15' });
  const list = (await get('/api/tweaks')).body;
  assert.equal(list.filter(t => t.key === 'Slots').length, 1);
  const card = (await get('/api/object/Cmdr_AmericaVehicleHumvee')).body;
  assert.equal(card.modules.find(m => m.tag === tag).props.find(p => p.key === 'Slots').value, '15');
  const a = await post('/api/apply');
  assert.equal(a.body.ok, true);
  assert.ok(existsSync(join(game, 'Data/INI/Object/ZHT_Commander.ini')));
  await post('/api/reset');
  assert.ok(!existsSync(join(game, 'Data/INI/Object/ZHT_Commander.ini')));
});

test('битая правка не применяется', { skip: !hasGame }, async () => {
  const t = (await post('/api/tweaks', { op: 'weaponSlot', object: 'Cmdr_AmericaJetAurora', slot: 'PRIMARY', weapon: 'NoSuch' })).body.tweak;
  const a = await post('/api/apply');
  assert.equal(a.body.ok, false); assert.equal(a.body.errors[0].tweakId, t.id);
  assert.ok(!existsSync(join(game, 'Data/INI/Object/ZHT_Commander.ini')));
  const d = await fetch(`${base}/api/tweaks/${t.id}`, { method: 'DELETE' });
  assert.equal(d.status, 200);
});

test('набор кнопок и справочники', { skip: !hasGame }, async () => {
  const cs = (await get('/api/commandset/Cmdr_AmericaBarracks_CommandSet')).body;
  assert.equal(cs.slots.find(s => s.slot === 1).object, 'Cmdr_AmericaInfantryRanger');
  const w = (await get('/api/refs/Weapon?q=neutron')).body;
  assert.ok(w.some(x => x.name === 'NeutronMissileWeapon'));
});

test('картинка кнопки улучшения по имени', { skip: !hasGame }, async () => {
  const r = await get('/img/SAHummer.png');
  assert.equal(r.type, 'image/png'); assert.equal(r.body.readUInt32BE(16), 60);
});
