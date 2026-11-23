import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_LABELS, MODULE_LABELS } from '../src/labels.js';
import { EN, setLang } from '../src/i18n.js';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { createApp } from '../src/server.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

test('у каждой подписи есть английский перевод', () => {
  const missing = new Set();
  for (const l of Object.values(FIELD_LABELS)) { if (!EN[l.ru]) missing.add(l.ru); if (l.hint && !EN[l.hint]) missing.add(l.hint); }
  for (const m of Object.values(MODULE_LABELS)) if (!EN[m]) missing.add(m);
  assert.deepEqual([...missing], []);
});

let srv, base;
before(async () => {
  if (!hasGame) return;
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  const dir = tmp();
  srv = await createApp({ vfs, db: await loadGameDb(vfs), gameDir: tmp(), tweakerDir: dir, userDir: dir, play: () => {} });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => { srv?.close(); setLang('ru'); });
const get = async p => (await fetch(base + p)).json();
const post = async (p, b) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();

test('переключение языка: карточка, плитки, изменения и ошибки по-английски', { skip: !hasGame }, async () => {
  assert.deepEqual(await get('/api/lang'), { lang: 'ru', saved: false });
  assert.equal((await post('/api/lang', { lang: 'en' })).lang, 'en');
  assert.deepEqual(await get('/api/lang'), { lang: 'en', saved: true });
  const o = await get('/api/object/Cmdr_AmericaVehicleHumvee');
  assert.equal(o.stats.find(s => s.id === 'health').ru, 'Health');
  assert.equal(o.stats.find(s => s.id === 'buildTime').unit, 's');
  assert.equal(o.props.find(p => p.key === 'BuildCost').label.ru, 'Cost');
  await post('/api/tweaks', { op: 'set', block: 'Object:Cmdr_AmericaVehicleHumvee', key: 'BuildCost', value: 'abc' });
  const s = await get('/api/state');
  assert.equal(s.errors.length, 1, 'vanilla problems stay hidden in English too: ' + JSON.stringify(s.errors));
  assert.match(s.errors[0].message, /Cost: “abc” is not a number/);
  const groups = await get('/api/changes');
  assert.ok(groups.every(g => g.items.every(i => !/[А-Яа-яЁё]/.test(i.text))), JSON.stringify(groups));
  assert.equal((await post('/api/lang', { lang: 'xx' })).lang, 'ru', 'unknown language falls back to Russian');
});
