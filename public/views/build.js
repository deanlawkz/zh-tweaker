// "Что строят здания": building/builder grid + 14 slots like the game control bar.
import { h, fill, api, state, icon, objectGrid, pickObject, pickButton, openModal, closeModal, tweak } from '../app.js';
import { t } from '../i18n.js';

export async function renderBuild(view) {
  const left = h('div', { class: 'panel' });
  const right = h('div', { class: 'panel sticky' }, h('div', { class: 'empty' }, t('Выберите здание или строителя', 'Pick a building or a builder')));
  fill(view, h('div', { class: 'split' }, left, right));
  const producers = state.objects.filter(o => o.kind === 'building' || /Dozer|Worker/.test(o.name));
  const draw = sel => fill(left, objectGrid(producers, o => { state.buildSel = o.name; draw(o.name); openSet(right, o); }, sel));
  draw(state.buildSel);
  if (state.buildSel) openSet(right, producers.find(o => o.name === state.buildSel));
}

async function openSet(box, o) {
  const card = await api.get(`/api/object/${encodeURIComponent(o.name)}`);
  const setName = card.props.find(p => p.key === 'CommandSet')?.value;
  if (!setName) { fill(box, h('div', { class: 'empty' }, t('У этого объекта нет кнопок', 'This object has no buttons'))); return; }
  const cs = await api.get(`/api/commandset/${encodeURIComponent(setName)}`);
  const bySlot = new Map(cs.slots.map(s => [s.slot, s]));
  const reload = () => openSet(box, o);
  const slots = [];
  for (let i = 1; i <= 14; i++) {
    const s = bySlot.get(i);
    const img = s ? (s.object ? icon(s.object) : s.image ? `/img/${encodeURIComponent(s.image)}.png` : null) : null;
    slots.push(h('div', { class: 'slot', title: s ? `${s.display || s.button}` : t('Пустой слот', 'Empty slot'), onclick: () => slotMenu(setName, i, s, reload) },
      h('span', { class: 'n' }, i), img ? h('img', { src: img }) : null));
  }
  fill(box, 
    h('div', { class: 'card-head' }, h('img', { src: icon(o.name, 'portrait') }), h('div', {}, h('h2', {}, o.display), h('div', { class: 'code' }, setName))),
    h('div', {}, t('Нажмите на слот, чтобы поставить туда юнит или здание, или очистить его. Слоты расположены как в игре (две строки по 7).', 'Click a slot to put a unit or building there, or to clear it. Slots are laid out as in the game (two rows of 7).')),
    h('div', { class: 'slots' }, slots),
    h('div', { class: 'list', style: 'margin-top:12px' }, cs.slots.map(s => h('div', { class: 'item' }, `${s.slot}. `, s.display || s.button, ' ', h('small', {}, s.command || '')))));
}

function slotMenu(setName, slot, cur, reload) {
  const put = async () => {
    closeModal();
    const o = await pickObject(t(`Слот ${slot}: что строить?`, `Slot ${slot}: what to build?`));
    if (!o) return;
    await tweak({ op: 'commandSlot', commandSet: setName, slot, button: `build:${o.name}` }, t(`Слот ${slot}: ${o.display}`, `Slot ${slot}: ${o.display}`));
    reload();
  };
  const putButton = async () => {
    closeModal();
    const b = await pickButton(t(`Слот ${slot}: способность или улучшение`, `Slot ${slot}: power or upgrade`));
    if (!b) return;
    await tweak({ op: 'commandSlot', commandSet: setName, slot, button: b.name }, t(`Слот ${slot}: ${b.text || b.name}`, `Slot ${slot}: ${b.text || b.name}`));
    reload();
  };
  const clear = async () => { closeModal(); await tweak({ op: 'commandSlot', commandSet: setName, slot, button: null }, t(`Слот ${slot} очищен`, `Slot ${slot} cleared`)); reload(); };
  openModal(t(`Слот ${slot}`, `Slot ${slot}`) + (cur ? ': ' + (cur.display || cur.button) : ''), h('div', { class: 'tools' },
    h('button', { class: 'primary', onclick: put }, cur ? t('Заменить на юнит/здание…', 'Replace with a unit/building…') : t('Поставить юнит/здание…', 'Put a unit/building…')),
    h('button', { onclick: putButton }, t('Способность или улучшение…', 'Power or upgrade…')),
    cur ? h('button', { class: 'danger', onclick: clear }, t('Очистить слот', 'Clear slot')) : null));
}
