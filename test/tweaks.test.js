import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { buildOutput } from '../src/tweaks.js';
import { applyOutput, resetOutput } from '../src/output.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

let db;
before(async () => { if (hasGame) db = await loadGameDb(await Vfs.open([GAME_ZH, GAME_GEN])); });
const OBJ = 'Data/INI/Object/ZHT_Commander.ini';
const blockOf = (text, header) => { const i = text.indexOf(header); return text.slice(i, text.indexOf('\nEnd', i)); };
const HUMVEE_TAG = () => db.get('Object', 'AmericaVehicleHumvee').block.modules.find(m => m.className === 'TransportContain').tag;

test('камера 690', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 1, op: 'camera', value: 690 }]);
  assert.deepEqual(o.errors, []);
  assert.match(o.files.get('Data/INI/GameData/ZHT_GameData.ini'), /MaxCameraHeight = 690\.0/);
});

test('Хаммер на 15 мест, ванильный не тронут', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 1, op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', module: HUMVEE_TAG(), key: 'Slots', value: '15' }]);
  assert.deepEqual(o.errors, []);
  assert.match(blockOf(o.files.get(OBJ), 'Object Cmdr_AmericaVehicleHumvee'), /Slots\s*=\s*15/);
  assert.ok(![...o.files.values()].some(t => typeof t === 'string' && /^Object\s+AmericaVehicleHumvee\b/m.test(t)));
});

test('правка не-Commander объекта отклоняется', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 7, op: 'set', block: 'Object:AmericaVehicleHumvee', key: 'BuildCost', value: '1' }]);
  assert.equal(o.errors[0].tweakId, 7);
});

test('битая ссылка → ошибка с объектом и полем', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 3, op: 'weaponSlot', object: 'Cmdr_AmericaJetAurora', slot: 'PRIMARY', weapon: 'NoSuchWeapon' }]);
  assert.equal(o.errors.length, 1);
  assert.equal(o.errors[0].tweakId, 3);
  assert.match(o.errors[0].message, /NoSuchWeapon/);
});

test('смена оружия и снаряд ядерной ракеты для Авроры', { skip: !hasGame }, () => {
  const bomb = db.weaponsOf('AmericaJetAurora')[0];
  const missile = db.prop('Weapon', 'NeutronMissileWeapon', 'ProjectileObject');
  assert.ok(missile, 'нет объекта ядерной ракеты');
  const o = buildOutput(db, [
    { id: 1, op: 'weaponSlot', object: 'Cmdr_AmericaJetAurora', slot: 'PRIMARY', weapon: bomb },
    { id: 2, op: 'set', block: `Weapon:Cmdr_${bomb}__AmericaJetAurora`, key: 'ProjectileObject', value: missile },
  ]);
  assert.deepEqual(o.errors, []);
  assert.match(blockOf(o.files.get(OBJ), 'Object Cmdr_AmericaJetAurora'), new RegExp(`PRIMARY\\s+Cmdr_${bomb}__AmericaJetAurora`));
  assert.match(o.files.get('Data/INI/Weapon/ZHT_Commander.ini'), new RegExp(`ProjectileObject\\s*=\\s*${missile}`));
});

test('снайпер в казармы США', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 1, op: 'commandSlot', commandSet: 'Cmdr_AmericaBarracks_CommandSet', slot: 5, button: 'build:Cmdr_GLAInfantryJarmenKell' }]);
  assert.deepEqual(o.errors, []);
  assert.match(blockOf(o.files.get('Data/INI/CommandSet/ZHT_Commander.ini'), 'CommandSet Cmdr_AmericaBarracks_CommandSet'), /5 = Cmdr_Command_Build_GLAInfantryJarmenKell/);
});

test('взять модуль у другого и удалить модуль', { skip: !hasGame }, () => {
  const dozerTag = db.get('Object', 'AmericaVehicleDozer').block.modules.find(m => m.className === 'DozerAIUpdate').tag;
  const o = buildOutput(db, [
    { id: 1, op: 'copyModule', from: 'Object:AmericaVehicleHumvee', module: HUMVEE_TAG(), to: 'Object:Cmdr_AmericaVehicleDozer' },
  ]);
  assert.deepEqual(o.errors, []);
  assert.match(blockOf(o.files.get(OBJ), 'Object Cmdr_AmericaVehicleDozer'), /TransportContain ModuleTag_ZHT_C1/);
  const o2 = buildOutput(db, [
    { id: 1, op: 'copyModule', from: 'Object:AmericaVehicleHumvee', module: HUMVEE_TAG(), to: 'Object:Cmdr_AmericaVehicleDozer' },
    { id: 2, op: 'removeModule', block: 'Object:Cmdr_AmericaVehicleDozer', module: dozerTag },
  ]);
  assert.deepEqual(o2.errors, []);
  const d = blockOf(o2.files.get(OBJ), 'Object Cmdr_AmericaVehicleDozer');
  assert.ok(!d.includes('DozerAIUpdate')); assert.ok(d.includes('ModuleTag_ZHT_C1'));
});

test('двойное применение идемпотентно; сброс удаляет только свои файлы', { skip: !hasGame }, async () => {
  const game = tmp(), dir = tmp();
  const o = buildOutput(db, [{ id: 1, op: 'camera', value: 690 }]);
  await applyOutput(o.files, { gameDir: game, tweakerDir: dir });
  const first = readFileSync(join(game, OBJ));
  await applyOutput(buildOutput(db, [{ id: 1, op: 'camera', value: 690 }]).files, { gameDir: game, tweakerDir: dir });
  assert.deepEqual(readFileSync(join(game, OBJ)), first);
  mkdirSync(join(game, 'Data/INI/Object'), { recursive: true });
  writeFileSync(join(game, 'Data/INI/Object/user_own.ini'), 'mine');
  const res = await resetOutput({ gameDir: game, tweakerDir: dir });
  assert.ok(!existsSync(join(game, OBJ)));
  assert.ok(existsSync(join(game, 'Data/INI/Object/user_own.ini')));
  assert.ok(existsSync(join(game, 'Data/English/generals.csf')) === false);
  assert.deepEqual(res.kept, []);
});
