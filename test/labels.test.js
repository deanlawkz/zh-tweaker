import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_LABELS, MODULE_LABELS, labelFor, moduleLabel } from '../src/labels.js';
import { TYPES } from '../src/gamedb.js';

test('подписи частых полей', () => {
  assert.equal(labelFor('TransportContain', 'Slots').ru, 'Мест для пассажиров');
  assert.equal(labelFor('TransportContain', 'PassengersAllowedToFire').type, 'bool');
  assert.equal(labelFor(null, 'BuildCost').ru, 'Цена');
  assert.equal(labelFor('ActiveBody', 'MaxHealth').ru, 'Здоровье');
  assert.equal(labelFor(null, 'AcceptableAimDelta').max, 180);
  assert.equal(labelFor('Whatever', 'NoSuchField'), null);
  assert.equal(moduleLabel('TransportContain'), 'Транспорт');
});

test('ссылки указывают на типы базы, без длинного тире', () => {
  for (const [k, v] of Object.entries(FIELD_LABELS)) {
    if (v.type === 'ref') assert.ok(TYPES.includes(v.ref), k);
    assert.ok(!JSON.stringify(v).includes('—'), k);
  }
  assert.ok(!JSON.stringify(MODULE_LABELS).includes('—'));
});
