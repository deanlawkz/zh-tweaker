import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIni, setProp, setPropAt, removeModule, insertModule, blockText, findModule } from '../src/ini.js';
import { Vfs } from '../src/big.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame } from './helpers.js';

const src = 'Object Foo\r\n  BuildCost = 700 ; цена\r\n  Body = ActiveBody ModuleTag_02\r\n    MaxHealth = 240.0\r\n  End\r\n  Behavior = TransportContain ModuleTag_05\r\n    Slots = 5\r\n  End\r\n  WeaponSet\r\n    Conditions = None\r\n    Weapon = PRIMARY GunA\r\n  End\r\nEnd\r\n\r\nWeapon GunA\r\n  PrimaryDamage = 10\r\nEnd\r\n';

test('разбор блоков, модулей и полей', () => {
  const f = parseIni(src, 'x.ini');
  assert.equal(f.blocks.length, 2);
  const o = f.blocks[0];
  assert.equal(o.type, 'Object'); assert.equal(o.name, 'Foo');
  assert.equal(o.props[0].key, 'BuildCost'); assert.equal(o.props[0].value, '700');
  assert.equal(o.modules[0].kind, 'Body'); assert.equal(o.modules[0].className, 'ActiveBody'); assert.equal(o.modules[0].tag, 'ModuleTag_02');
  assert.equal(o.modules[1].className, 'TransportContain'); assert.equal(o.modules[1].props[0].value, '5');
  assert.equal(o.modules[2].kind, 'WeaponSet'); assert.equal(o.modules[2].props[1].value, 'PRIMARY GunA');
  assert.equal(f.blocks[1].type, 'Weapon');
  assert.equal(f.toString(), src);
});

test('setProp сохраняет комментарий и \\r\\n', () => {
  const f = parseIni(src, 'x');
  const g = setProp(f, f.blocks[0], 'BuildCost', '100');
  assert.ok(g.toString().includes('  BuildCost = 100 ; цена\r\n'));
  assert.equal(g.blocks[0].props[0].value, '100');
});

test('setProp вставляет отсутствующее поле перед End модуля', () => {
  const f = parseIni(src, 'x');
  const g = setProp(f, findModule(f.blocks[0], 'ModuleTag_05'), 'PassengersAllowedToFire', 'Yes');
  assert.ok(g.toString().includes('    Slots = 5\r\n    PassengersAllowedToFire = Yes\r\n  End\r\n'));
});

test('setPropAt меняет конкретную строку', () => {
  const f = parseIni(src, 'x');
  const p = f.blocks[0].modules[2].props[1];
  const g = setPropAt(f, p, 'PRIMARY GunB');
  assert.equal(g.blocks[0].modules[2].props[1].value, 'PRIMARY GunB');
});

test('removeModule и insertModule', () => {
  const f = parseIni(src, 'x');
  const g = removeModule(f, f.blocks[0], f.blocks[0].modules[1]);
  assert.equal(g.blocks[0].modules.length, 2);
  assert.ok(!g.toString().includes('TransportContain'));
  const h = insertModule(g, g.blocks[0], '  Behavior = AutoHealBehavior ModuleTag_ZHT_1\r\n    HealingAmount = 2\r\n  End\r\n');
  assert.equal(h.blocks[0].modules.at(-1).className, 'AutoHealBehavior');
  assert.equal(h.blocks[1].name, 'GunA');
});

test('blockText и вложенные ConditionState с =', () => {
  const s = 'Object A\n  Draw = W3DModelDraw ModuleTag_01\n    DefaultConditionState\n      Model = X\n    End\n    ConditionState = DAMAGED\n      Model = Y\n    End\n    AliasConditionState = REALLYDAMAGED\n  End\n  KindOf = INFANTRY\nEnd\n';
  const f = parseIni(s, 'x');
  assert.equal(f.blocks[0].props[0].key, 'KindOf');
  assert.equal(f.blocks[0].modules[0].modules.length, 2);
  assert.equal(blockText(f, f.blocks[0]), s);
});

test('незакрытый блок → ошибка с именем файла', () => {
  assert.throws(() => parseIni('Object A\n  X = 1\n', 'bad.ini'), /bad\.ini/);
});

test('все реальные INI разбираются и печатаются без изменений', { skip: !hasGame }, async () => {
  const v = await Vfs.open([GAME_ZH, GAME_GEN]);
  let n = 0, blocks = 0;
  for (const p of v.list('data\\ini\\')) {
    if (!p.endsWith('.ini')) continue;
    const t = v.read(p).toString('latin1');
    const f = parseIni(t, p);
    assert.equal(f.toString(), t);
    n++; blocks += f.blocks.length;
  }
  assert.ok(n > 100); assert.ok(blocks > 5000);
});
