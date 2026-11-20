// Main numbers of a unit card (health, speed, money, energy...) and the change list grouped by unit.
import { labelFor, moduleLabel } from './labels.js';
import { PREFIX } from './commander.js';

const baseOf = n => (n.startsWith(PREFIX) ? n.slice(PREFIX.length).replace(/__.*$/, '') : n);
const num = v => { const m = String(v ?? '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const propOf = (node, key) => node?.props.find(p => p.key.toLowerCase() === key.toLowerCase())?.value ?? null;
const SLOT_RU = { PRIMARY: 'Основное оружие', SECONDARY: 'Дополнительное оружие', TERTIARY: 'Третье оружие' };

// Locomotor used for normal movement (the "SET_NORMAL" line, otherwise the first one).
function mainLocomotor(block) {
  const lines = block.props.filter(p => p.key === 'Locomotor').map(p => p.value.split(/\s+/));
  return (lines.find(l => l[0] === 'SET_NORMAL') || lines[0])?.[1] || null;
}

export function unitStats(view, name) {
  const block = view.get('Object', name)?.block;
  if (!block) return [];
  const own = { block: `Object:${name}` };
  const out = [];
  const add = (id, ru, sym, raw, edits, extra = {}) => {
    const v = num(raw);
    if (v == null) return;
    out.push({ id, ru, sym, value: extra.scale ? v / extra.scale : v, edits, ...extra });
  };
  const top = (id, ru, sym, key, extra) => add(id, ru, sym, propOf(block, key), [{ ...own, key }], extra);
  const inModule = (id, ru, sym, test, key, extra) => {
    const m = block.modules.find(x => x.tag && test(x) && propOf(x, key) != null);
    if (m) add(id, ru, sym, propOf(m, key), [{ ...own, module: m.tag, key }], extra);
  };

  const body = block.modules.find(m => m.kind === 'Body' && propOf(m, 'MaxHealth') != null);
  if (body) {
    add('health', 'Здоровье', '❤', propOf(body, 'MaxHealth'), ['MaxHealth', 'InitialHealth']
      .filter(k => propOf(body, k) != null).map(key => ({ ...own, module: body.tag, key })));
  }
  const loco = mainLocomotor(block);
  if (loco && view.get('Locomotor', loco)) {
    const shared = [...view.index.Object.values()].filter(e => e.block.name.startsWith(PREFIX) && mainLocomotor(e.block) === loco).length;
    add('speed', 'Скорость', '➜', view.prop('Locomotor', loco, 'Speed'), [{ block: `Locomotor:${loco}`, key: 'Speed' }],
      shared > 1 ? { hint: `Ходовая общая для ${shared} юнитов Commander` } : {});
  }
  top('cost', 'Цена', '$', 'BuildCost');
  top('buildTime', 'Время постройки', '⏱', 'BuildTime', { unit: 'с' });
  top('vision', 'Обзор', '👁', 'VisionRange');
  inModule('slots', 'Мест внутри', '👥', () => true, 'Slots');
  if (!out.some(s => s.id === 'slots')) inModule('slots', 'Мест внутри', '👥', () => true, 'ContainMax');
  top('energy', 'Энергия', '⚡', 'EnergyProduction', { hint: 'Плюс даёт энергию, минус потребляет' });
  top('energyBonus', 'Энергия от улучшения', '⚡', 'EnergyBonus');
  inModule('income', 'Доход', '$', m => m.className === 'AutoDepositUpdate', 'DepositAmount');
  inModule('incomeEvery', 'Доход раз в', '⏱', m => m.className === 'AutoDepositUpdate', 'DepositTiming', { unit: 'с', scale: 1000 });
  inModule('boxes', 'Ящиков на складе', '📦', m => m.className === 'SupplyWarehouseDockUpdate', 'StartingBoxes');
  inModule('carry', 'Везёт ящиков за рейс', '📦', m => /AIUpdate$/.test(m.className || ''), 'MaxBoxes');
  inModule('hackCash', 'Деньги за взлом', '$', m => m.className === 'HackInternetAIUpdate', 'RegularCashAmount');
  if (/\bSTRUCTURE\b/.test(propOf(block, 'KindOf') || '')) inModule('queue', 'Очередь постройки', '🏭', m => m.className === 'ProductionUpdate', 'MaxQueueEntries');
  return out;
}

// What the object builds: units and buildings from its command buttons.
export function unitBuilds(view, db, name) {
  const set = view.prop('Object', name, 'CommandSet');
  const cs = set && view.get('CommandSet', set);
  if (!cs) return [];
  return cs.block.props.map(p => p.value).filter(b => /^(UNIT_BUILD|DOZER_CONSTRUCT)$/.test(view.prop('CommandButton', b, 'Command') || ''))
    .map(b => view.prop('CommandButton', b, 'Object')).filter(Boolean)
    .map(o => ({ name: o, display: db.displayName(baseOf(o)) || baseOf(o) }));
}

// ---- Change list ----

function ownerOf(view, t) {
  if (t.object) return t.object;
  if (t.to) return t.to.split(':')[1];
  if (t.commandSet) return cmdrObjects(view).find(e => propOf(e.block, 'CommandSet') === t.commandSet)?.block.name || null;
  if (!t.block) return null;
  const [type, name] = t.block.split(':');
  if (type === 'Object') return name;
  if (type === 'Weapon') {
    const unit = name.includes('__') ? PREFIX + name.split('__')[1] : null;
    if (unit && view.get('Object', unit)) return unit;
    return cmdrObjects(view).find(e => view.weaponsOf(e.block.name).includes(name))?.block.name || null;
  }
  if (type === 'Locomotor') return cmdrObjects(view).find(e => mainLocomotor(e.block) === name)?.block.name || null;
  return null;
}
const cmdrObjects = view => [...view.index.Object.values()].filter(e => e.block.name.startsWith(PREFIX) && !e.block.name.includes('__'));

const show = v => /^OCL_Cmdr_NukeBlast$/.test(String(v).trim()) ? '☢ ядерный взрыв' : /^none$/i.test(String(v).trim()) ? 'нет' : showNum(v);
const showNum = v => { const n = num(v); return n != null && /^\s*-?[\d.]+%?\s*$/.test(String(v)) ? String(v).trim().replace(/^(-?\d+)\.0+(%?)$/, '$1$2') : String(v); };

function vanillaValue(db, t) {
  const [type, name] = t.block.split(':');
  const e = db.get(type, baseOf(name));
  if (!e) return null;
  const node = t.module ? e.block.modules.find(m => m.tag === t.module) : e.block;
  return propOf(node, t.key);
}

function setText(view, db, t) {
  const [type, name] = t.block.split(':');
  let label;
  if (type === 'Locomotor' && t.key === 'Speed') label = 'Скорость';
  else if (t.key === 'MaxHealth') label = 'Здоровье';
  else if (t.key === 'InitialHealth') label = 'Начальное здоровье';
  else {
    const mod = t.module && view.get(type, name)?.block.modules.find(m => m.tag === t.module);
    const cls = mod ? mod.className || mod.kind : null;
    label = labelFor(cls, t.key)?.ru || (cls && moduleLabel(cls) ? `${moduleLabel(cls)}: ${t.key}` : t.key);
  }
  if (type === 'Weapon') label = `Оружие «${baseOf(name)}»: ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  const from = vanillaValue(db, t);
  return `${label}: ${from != null && show(from) !== show(t.value) ? `${show(from)} → ` : ''}${show(t.value)}`;
}

function describeTweak(view, db, t) {
  const disp = n => db.displayName(baseOf(n)) || baseOf(n);
  switch (t.op) {
    case 'camera': return `Камера: высота ${t.value}`;
    case 'aimFix': return `Стрельба изнутри во все стороны: ${t.on ? 'включена' : 'выключена'}`;
    case 'battleFx': return `Дым и звук в больших боях: ${t.on ? 'включены' : 'выключены'}`;
    case 'set': return setText(view, db, t);
    case 'weaponSlot': return `${SLOT_RU[t.slot] || t.slot}: ${t.weapon && t.weapon.toLowerCase() !== 'none' ? baseOf(t.weapon) : 'убрано'}`;
    case 'commandSlot': {
      if (t.button == null) return `Кнопка ${t.slot}: убрана`;
      if (t.button.startsWith('build:')) return `Кнопка ${t.slot}: строит «${disp(t.button.slice(6))}»`;
      return `Кнопка ${t.slot}: ${view.prop('CommandButton', t.button, 'TextLabel') && db.csf.get(view.prop('CommandButton', t.button, 'TextLabel').toLowerCase())?.replace(/&/g, '') || t.button}`;
    }
    case 'removeModule': {
      const m = db.get('Object', baseOf(t.block.split(':')[1]))?.block.modules.find(x => x.tag === t.module);
      return `Удалён модуль «${(m && moduleLabel(m.className || m.kind)) || m?.className || t.module}»`;
    }
    case 'copyModule': {
      const from = t.from.split(':')[1];
      const m = view.get('Object', from)?.block.modules.find(x => x.tag === t.module);
      return `Добавлен модуль «${(m && moduleLabel(m.className || m.kind)) || m?.className || t.module}» от «${disp(from)}»`;
    }
    case 'raw': return 'Запись изменена вручную (текст целиком)';
    default: return t.op;
  }
}

// [{ object|null, display, items: [{ ids, text, createdAt, icon? }] }], groups in order of first change.
export function groupChanges(view, db, tweaks) {
  const groups = new Map();
  const healthItems = new Map();
  for (const t of tweaks) {
    const object = ownerOf(view, t);
    const key = object || '';
    if (!groups.has(key)) groups.set(key, { object, display: object ? db.displayName(baseOf(object)) || baseOf(object) : 'Общие настройки', items: [] });
    const g = groups.get(key);
    const hk = t.op === 'set' && /^(Max|Initial)Health$/.test(t.key) ? `${t.block}|${t.module || ''}` : null;
    if (hk && healthItems.has(hk)) {
      const it = healthItems.get(hk);
      it.ids.push(t.id);
      if (t.key === 'MaxHealth') it.text = describeTweak(view, db, t);
      continue;
    }
    const item = { ids: [t.id], text: describeTweak(view, db, t), createdAt: t.createdAt,
      icon: t.op === 'commandSlot' && t.button?.startsWith('build:') ? t.button.slice(6) : null };
    if (hk) healthItems.set(hk, item);
    g.items.push(item);
  }
  return [...groups.values()];
}
