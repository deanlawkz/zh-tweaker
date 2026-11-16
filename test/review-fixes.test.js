// Regression tests for the final review findings.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { buildCommander, remapLine } from '../src/commander.js';
import { buildOutput, loadTweaks } from '../src/tweaks.js';
import { applyOutput, resetOutput } from '../src/output.js';
import { parseIni, setPropAt } from '../src/ini.js';
import { createApp } from '../src/server.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

let db, vfs, r;
before(async () => { if (!hasGame) return; vfs = await Vfs.open([GAME_ZH, GAME_GEN]); db = await loadGameDb(vfs); r = buildCommander(db, { aimFix: true }); });
const OBJ = 'Data/INI/Object/ZHT_Commander.ini';

test('C1: ГЛА строит настоящие здания, приманки не заменяют их', { skip: !hasGame }, () => {
  for (const n of ['GLABarracks', 'GLASupplyStash', 'GLAArmsDealer', 'GLACommandCenter', 'AmericaVehicleChinook', 'GLAVehicleCombatBikeTerrorist']) {
    assert.equal(r.rep.get(n), n, n);
  }
  for (const [m, k] of r.rep) {
    const fake = s => /\bFS_FAKE\b/.test(db.prop('Object', s, 'KindOf') || '');
    assert.ok(!fake(k) || fake(m), `${m} -> ${k}`);
  }
});

test('I1: метки DisplayName не переименовываются', () => {
  const m = new Map([['AmericaSupplyDropZone', 'Cmdr_AmericaSupplyDropZone']]);
  assert.equal(remapLine('  DisplayName = OBJECT:AmericaSupplyDropZone\n', m), '  DisplayName = OBJECT:AmericaSupplyDropZone\n');
  assert.equal(remapLine('  Object = AmericaSupplyDropZone\n', m), '  Object = Cmdr_AmericaSupplyDropZone\n');
});

test('C2: setPropAt работает со строками без =', () => {
  const f = parseIni('Object A\n  Draw = W3DModelDraw ModuleTag_01\n    AliasConditionState RIDER1\n  End\nEnd\n', 'x');
  const p = f.blocks[0].modules[0].props[0];
  assert.equal(setPropAt(f, p, 'RIDER2').blocks[0].modules[0].props[0].value, 'RIDER2');
});

test('C2: битый текст целиком = ошибка правки, а не исключение', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 9, op: 'raw', block: 'Object:Cmdr_AmericaVehicleHumvee', text: 'Object Cmdr_AmericaVehicleHumvee\n  BuildCost = 5\n' }]);
  assert.equal(o.errors[0].tweakId, 9);
});

test('C2: битый tweaks.json не роняет запуск', () => {
  const d = tmp(); writeFileSync(join(d, 'tweaks.json'), '{oops');
  assert.deepEqual(loadTweaks(d), []);
});

test('C2: сервер не сохраняет правку, которая падает, и стартует снова', { skip: !hasGame }, async () => {
  const dir = tmp(), game = tmp();
  const s = await createApp({ vfs, db, gameDir: game, tweakerDir: dir, play: () => {} });
  await new Promise(res => s.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${s.address().port}`;
  const res = await fetch(base + '/api/tweaks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'raw', block: 'Object:Cmdr_AmericaVehicleHumvee', text: 'garbage' }) });
  const body = await res.json();
  assert.equal(res.status, 200); assert.ok(body.errors.length);
  s.close();
  const s2 = await createApp({ vfs, db, gameDir: game, tweakerDir: dir, play: () => {} });
  s2.close();
});

test('I2: битый Locomotor и Prerequisites ловятся проверкой', { skip: !hasGame }, () => {
  const e = db.get('Object', 'AmericaVehicleHumvee');
  const text = r.files.get(OBJ);
  const i = text.indexOf('Object Cmdr_AmericaVehicleHumvee'); const j = text.indexOf('\nEnd', i) + 5;
  let blk = text.slice(i, j).replace(/(Locomotor\s*=\s*SET_NORMAL\s+)\S+/, '$1Cmdr_NoSuchLoco');
  let o = buildOutput(db, [{ id: 4, op: 'raw', block: 'Object:Cmdr_AmericaVehicleHumvee', text: blk }]);
  assert.ok(o.errors.some(x => x.tweakId === 4 && /NoSuchLoco/.test(x.message)), JSON.stringify(o.errors));
  blk = text.slice(i, j).replace(/(Prerequisites[\s\S]*?Object\s*=\s*)\S+/, '$1Cmdr_NoSuchBuilding');
  o = buildOutput(db, [{ id: 5, op: 'raw', block: 'Object:Cmdr_AmericaVehicleHumvee', text: blk }]);
  assert.ok(o.errors.some(x => x.tweakId === 5 && /NoSuchBuilding/.test(x.message)), JSON.stringify(o.errors));
  void e;
});

test('I3: текст целиком не может переименовать блок', { skip: !hasGame }, () => {
  const o = buildOutput(db, [{ id: 6, op: 'raw', block: 'Object:Cmdr_AmericaVehicleHumvee', text: 'Object AmericaVehicleHumvee\n  BuildCost = 5\nEnd\n' }]);
  assert.equal(o.errors[0].tweakId, 6);
});

test('I4: чужой файл сохраняется в копию и восстанавливается при сбросе', async () => {
  const game = tmp(), dir = tmp();
  mkdirSync(join(game, 'Data/English'), { recursive: true });
  writeFileSync(join(game, 'Data/English/generals.csf'), 'USER');
  await applyOutput(new Map([['Data/English/generals.csf', Buffer.from('OURS')]]), { gameDir: game, tweakerDir: dir });
  assert.equal(readFileSync(join(game, 'Data/English/generals.csf'), 'utf8'), 'OURS');
  await applyOutput(new Map([['Data/English/generals.csf', Buffer.from('OURS2')]]), { gameDir: game, tweakerDir: dir });
  await resetOutput({ gameDir: game, tweakerDir: dir });
  assert.equal(readFileSync(join(game, 'Data/English/generals.csf'), 'utf8'), 'USER');
  assert.ok(!existsSync(join(game, 'Data/English/generals.csf.zht-backup')));
});

test('копия модуля получает тег по номеру правки', { skip: !hasGame }, () => {
  const tag = db.get('Object', 'AmericaVehicleHumvee').block.modules.find(m => m.className === 'TransportContain').tag;
  const o = buildOutput(db, [{ id: 42, op: 'copyModule', from: 'Object:AmericaVehicleHumvee', module: tag, to: 'Object:Cmdr_AmericaVehicleDozer' }]);
  assert.match(o.files.get(OBJ), /ModuleTag_ZHT_C42/);
});

test('чужой сайт не может вызвать действия сервера', { skip: !hasGame }, async () => {
  let played = false;
  const s = await createApp({ vfs, db, gameDir: tmp(), tweakerDir: tmp(), play: () => { played = true; } });
  await new Promise(res => s.listen(0, '127.0.0.1', res));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/api/play`, { method: 'POST', headers: { 'content-type': 'text/plain', origin: 'https://evil.example' }, body: '{}' });
  assert.equal(res.status, 403); assert.equal(played, false);
  s.close();
});

test('справочник кнопок способностей и улучшений с картинками', { skip: !hasGame }, async () => {
  const s = await createApp({ vfs, db, gameDir: tmp(), tweakerDir: tmp(), play: () => {} });
  await new Promise(res => s.listen(0, '127.0.0.1', res));
  const list = await (await fetch(`http://127.0.0.1:${s.address().port}/api/buttons?q=paradrop`)).json();
  s.close();
  assert.ok(list.some(b => b.name === 'Command_Paradrop' && b.image));
});
