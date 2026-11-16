import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readBigIndex, Vfs, writeBig } from '../src/big.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp, makeBig } from './helpers.js';

test('readBigIndex читает синтетический BIGF', () => {
  const f = join(tmp(), 'a.big');
  makeBig(f, [{ name: 'Data\\INI\\A.ini', data: 'aaa' }, { name: 'Data\\INI\\B.ini', data: 'bb' }]);
  assert.deepEqual(readBigIndex(f).map(e => e.name), ['Data\\INI\\A.ini', 'Data\\INI\\B.ini']);
  assert.deepEqual(readBigIndex(f).map(e => e.size), [3, 2]);
});

test('Vfs: первый архив по алфавиту побеждает, имена без регистра', async () => {
  const d = tmp();
  makeBig(join(d, 'b.big'), [{ name: 'Data\\INI\\X.ini', data: 'from b' }]);
  makeBig(join(d, '!a.big'), [{ name: 'Data\\INI\\X.ini', data: 'from a' }]);
  const v = await Vfs.open([d]);
  assert.equal(v.read('data/ini/x.ini').toString(), 'from a');
  assert.ok(v.has('DATA\\INI\\X.INI'));
  assert.equal(v.sourceOf('data\\ini\\x.ini'), join(d, '!a.big'));
  assert.deepEqual(v.list('data\\ini\\'), ['data\\ini\\x.ini']);
});

test('Vfs: второй каталог уступает первому', async () => {
  const d1 = tmp(), d2 = tmp();
  makeBig(join(d1, 'z.big'), [{ name: 'Q.ini', data: '1' }]);
  makeBig(join(d2, 'a.big'), [{ name: 'Q.ini', data: '2' }, { name: 'R.ini', data: '3' }]);
  const v = await Vfs.open([d1, d2]);
  assert.equal(v.read('q.ini').toString(), '1');
  assert.equal(v.read('r.ini').toString(), '3');
});

test('writeBig → readBigIndex круговая запись', async () => {
  const d = tmp(); mkdirSync(join(d, 'x'));
  writeBig(join(d, 'x', 'o.big'), [{ name: 'Data\\INI\\GameData.ini', data: Buffer.from('hello') }]);
  const v = await Vfs.open([join(d, 'x')]);
  assert.equal(v.read('data\\ini\\gamedata.ini').toString(), 'hello');
});

test('реальный INIZH.big', { skip: !hasGame }, async () => {
  const v = await Vfs.open([GAME_ZH, GAME_GEN]);
  assert.match(v.read('data\\ini\\gamedata.ini').toString('latin1'), /MaxCameraHeight = 310\.0/);
  assert.ok(v.list('data\\ini\\object\\').length >= 30);
});
