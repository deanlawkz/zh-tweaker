import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCsf, writeCsf, emptyCsf } from '../src/csf.js';
import { Vfs } from '../src/big.js';
import { GAME_ZH } from '../src/paths.js';
import { hasGame } from './helpers.js';

test('csf: круговая запись', () => {
  const b = writeCsf(emptyCsf(), new Map([['SIDE:Commander', 'Commander'], ['X:Y', 'Привет']]));
  const m = readCsf(b);
  assert.equal(m.get('side:commander'), 'Commander');
  assert.equal(m.get('x:y'), 'Привет');
  assert.equal(readCsf(writeCsf(b, new Map([['SIDE:Commander', 'другое']]))).get('side:commander'), 'Commander');
});

test('реальный generals.csf', { skip: !hasGame }, async () => {
  const v = await Vfs.open([GAME_ZH]);
  const buf = v.read('data\\english\\generals.csf');
  const m = readCsf(buf);
  assert.equal(m.get('object:humvee'), 'Humvee');
  assert.ok(m.has('side:america'));
  const m2 = readCsf(writeCsf(buf, new Map([['SIDE:Commander', 'Commander']])));
  assert.equal(m2.size, m.size + 1);
  assert.equal(m2.get('object:humvee'), 'Humvee');
});
