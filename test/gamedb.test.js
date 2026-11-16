import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame } from './helpers.js';

test('реальная БД', { skip: !hasGame }, async () => {
  const db = await loadGameDb(await Vfs.open([GAME_ZH, GAME_GEN]));
  assert.equal(db.displayName('AmericaVehicleHumvee'), 'Humvee');
  assert.equal(db.side('AmericaVehicleHumvee'), 'America');
  assert.equal(db.kind('AmericaVehicleHumvee'), 'unit');
  assert.equal(db.kind('AmericaBarracks'), 'building');
  assert.equal(db.general('AirF_AmericaJetAurora'), 'AirForce');
  assert.equal(db.general('AmericaJetAurora'), null);
  assert.ok(db.index.PlayerTemplate.has('FactionBossGeneral'));
  assert.ok(db.index.Weapon.size > 300);
  assert.ok(db.index.MappedImage.has('SAHummer'));
  const w = db.weaponsOf('AmericaJetAurora');
  assert.ok(w.length > 0);
  assert.ok(db.usersOfWeapon(w[0]).includes('AmericaJetAurora'));
  assert.ok(db.get('Object', 'AmericaVehicleHumvee').block.modules.length > 5);
});
