// "Юниты и здания": icon grid + full object card.
import { h, fill, api, state, icon, objectGrid, pickObject, pickRef, openModal, closeModal, tweak, toast, show, SIDES } from '../app.js';
import { propRow } from './fields.js';
import { t } from '../i18n.js';
import { weaponLine } from './weapons.js';

const SLOT_RU = { PRIMARY: t('Основное оружие', 'Main weapon'), SECONDARY: t('Дополнительное оружие', 'Second weapon'), TERTIARY: t('Третье оружие', 'Third weapon') };
const filt = { side: null, kind: null, q: '' };

export async function renderUnits(view) {
  const left = h('div', { class: 'panel' });
  const right = h('div', { class: 'panel sticky' }, h('div', { class: 'empty' }, t('Выберите юнит или здание слева', 'Pick a unit or building on the left')));
  fill(view, h('div', { class: 'split' }, left, right));

  const search = h('input', { type: 'text', placeholder: t('Поиск: Humvee, Aurora, Barracks…', 'Search: Humvee, Aurora, Barracks…'), value: filt.q });
  const btn = (label, key, val) => h('button', { class: filt[key] === val ? 'on' : '', onclick: () => { filt[key] = filt[key] === val ? null : val; drawLeft(); } }, label);
  const drawLeft = () => {
    const list = state.objects.filter(o => (!filt.side || o.side === filt.side) && (!filt.kind || o.kind === filt.kind)
      && (!filt.q || o.display.toLowerCase().includes(filt.q) || o.name.toLowerCase().includes(filt.q)));
    fill(left, 
      h('div', { class: 'filters' }, ...Object.entries(SIDES).filter(([k]) => k !== 'Other').map(([k, v]) => btn(v, 'side', k)),
        btn(t('Юниты', 'Units'), 'kind', 'unit'), btn(t('Здания', 'Buildings'), 'kind', 'building')),
      h('div', { class: 'filters' }, search),
      objectGrid(list, o => { state.selected = o.name; drawLeft(); openCard(right, o.name); }, state.selected));
  };
  search.oninput = () => { filt.q = search.value.toLowerCase(); drawLeft(); search.focus(); };
  drawLeft();
  if (state.selected) openCard(right, state.selected);
}

export async function openCard(box, name) {
  const o = await api.get(`/api/object/${encodeURIComponent(name)}`);
  const reload = () => openCard(box, name);
  const owner = { block: `Object:${name}` };

  const tools = h('div', { class: 'tools' },
    h('button', { onclick: () => takeFromOther(name, reload) }, t('＋ Взять у другого', '＋ Take from another unit')),
    h('button', { onclick: () => rawEdit(o, reload) }, t('Текст целиком', 'Full text')));

  const known = o.props.filter(p => p.label);
  const other = o.props.filter(p => !p.label);
  const main = h('details', { class: 'module known', open: true }, h('summary', {}, h('span', { class: 'grow' }, t('Главное', 'Main'))),
    h('div', { class: 'rows' }, known.map(p => propRow(owner, p, reload))));
  const misc = other.length ? h('details', { class: 'module' }, h('summary', {}, h('span', { class: 'grow' }, t('Прочие параметры', 'Other parameters')), h('span', { class: 'cls' }, other.length)),
    h('div', { class: 'rows' }, other.map(p => propRow(owner, p, reload)))) : null;

  const stats = o.stats?.length ? h('div', { class: 'stats' }, o.stats.map(st => statTile(st, reload))) : null;
  const builds = o.builds?.length ? h('div', { class: 'builds' }, h('div', { class: 'lab' }, t('Строит', 'Builds')),
    h('div', { class: 'chips' }, o.builds.map(b => h('button', { class: 'chip', title: b.display, onclick: () => { state.selected = b.name; openCard(box, b.name); } },
      h('img', { src: icon(b.name) }), h('span', {}, b.display))))) : null;

  const mods = [...o.modules].sort((a, b) => rank(a) - rank(b)).map(m => moduleBox(name, m, reload, o.weaponInfo));
  fill(box, 
    h('div', { class: 'card-head' }, h('img', { src: icon(name, 'portrait') }),
      h('div', {}, h('h2', {}, o.display), h('div', { class: 'code' }, name))),
    stats, builds, tools, main, misc, ...mods);
}

// One main number: icon, name, editable value. Health also sets the starting health.
function statTile(st, reload) {
  const input = h('input', { type: 'number', value: st.value, step: 'any' });
  const save = async () => {
    const v = Number(input.value);
    if (!Number.isFinite(v) || v === st.value) return;
    const raw = st.scale ? Math.round(v * st.scale) : v;
    for (const e of st.edits) {
      const r = await tweak({ op: 'set', ...e, value: String(raw) }, `${st.ru}: ${v}${st.unit ? ' ' + st.unit : ''}. ${t('Нажмите «Применить».', 'Press Apply.')}`);
      if (r.error) return;
    }
    reload();
  };
  input.onchange = save;
  input.onkeydown = ev => { if (ev.key === 'Enter') input.blur(); };
  return h('label', { class: 'stat', title: st.hint || '' }, h('span', { class: 'sym' }, st.sym),
    h('span', { class: 'name' }, st.ru, st.hint ? ' ⓘ' : null),
    h('span', { class: 'val' }, input, st.unit ? h('em', {}, st.unit) : null));
}

const rank = m => (m.kind === 'WeaponSet' ? 0 : m.label && !/Draw/.test(m.className || '') ? 1 : /Draw/.test(m.className || m.kind) ? 3 : 2);

function moduleBox(obj, m, reload, info) {
  const title = m.label || m.className || m.kind;
  const owner = { block: `Object:${obj}`, module: m.tag };
  let rows;
  if (m.kind === 'WeaponSet') {
    rows = m.props.map(p => {
      if (p.key.toLowerCase() !== 'weapon') return h('div', { class: 'row' }, h('div', { class: 'lab' }, p.key), h('div', { class: 'code' }, p.value));
      const [slot, w] = p.value.split(/\s+/);
      return h('div', { class: 'row' }, h('div', { class: 'lab' }, SLOT_RU[slot] || slot, h('small', {}, w), h('small', { class: 'wsum' + (info?.[w]?.nuke ? ' nuke' : '') }, weaponLine(info?.[w]))),
        h('div', { class: 'tools' },
          h('button', { onclick: async () => { const nw = await pickRef('Weapon', `${SLOT_RU[slot] || slot}: ${t('выберите оружие', 'pick a weapon')}`); if (nw) tweak({ op: 'weaponSlot', object: obj, slot, weapon: nw }).then(reload); } }, t('Сменить', 'Change')),
          w && w.startsWith('Cmdr_') ? h('button', { onclick: () => { state.weapon = w; state.weaponFrom = obj; state.weaponUnit = obj; show('weapons'); } }, t('Настроить', 'Tune')) : null));
    });
    const has = s => m.props.some(p => p.key.toLowerCase() === 'weapon' && p.value.startsWith(s));
    for (const s of ['PRIMARY', 'SECONDARY']) if (!has(s)) rows.push(h('div', { class: 'row' }, h('div', { class: 'lab' }, SLOT_RU[s], h('small', {}, t('пусто', 'empty'))),
      h('button', { onclick: async () => { const nw = await pickRef('Weapon', `${SLOT_RU[s]}: ${t('выберите оружие', 'pick a weapon')}`); if (nw) tweak({ op: 'weaponSlot', object: obj, slot: s, weapon: nw }).then(reload); } }, t('Добавить', 'Add'))));
    const cond = m.props.find(p => p.key === 'Conditions')?.value;
    return h('details', { class: 'module known', open: true }, h('summary', {}, h('span', { class: 'grow' }, t('Оружие', 'Weapons'), cond && cond !== 'None' ? t(` (когда: ${cond})`, ` (when: ${cond})`) : '')), h('div', { class: 'rows' }, rows));
  }
  if (!m.tag) {
    return h('details', { class: 'module' }, h('summary', {}, h('span', { class: 'grow' }, title), h('span', { class: 'cls' }, m.kind)),
      h('div', { class: 'rows' }, m.props.map(p => h('div', { class: 'row' }, h('div', { class: 'lab' }, p.label?.ru || p.key, h('small', {}, p.key)), h('div', { class: 'code' }, p.value))),
        h('div', { class: 'code' }, t('Этот блок правится через «Текст целиком».', 'Edit this block with Full text.'))));
  }
  return h('details', { class: 'module' + (m.label ? ' known' : ''), open: !!m.props.some(p => p.label) && !/Draw/.test(m.className) },
    h('summary', {}, h('span', { class: 'grow' }, title), h('span', { class: 'cls' }, `${m.className} · ${m.tag}`),
      h('button', { class: 'small danger', title: t('Удалить модуль', 'Remove module'), onclick: e => { e.preventDefault(); if (confirm(t(`Удалить «${title}» у этого объекта?`, `Remove “${title}” from this object?`))) tweak({ op: 'removeModule', block: `Object:${obj}`, module: m.tag }).then(reload); } }, '✕')),
    h('div', { class: 'rows' }, m.props.map(p => propRow(owner, p, reload)),
      m.modules.length ? h('div', { class: 'code' }, t(`Вложенных блоков: ${m.modules.length} (правятся через «Текст целиком»)`, `Nested blocks: ${m.modules.length} (edit with Full text)`)) : null));
}

async function takeFromOther(target, reload) {
  const src = await pickObject(t('Взять модуль: у кого?', 'Take a module from which unit?'));
  if (!src) return;
  const o = await api.get(`/api/object/${encodeURIComponent(src.name)}`);
  const list = h('div', { class: 'list' }, o.modules.filter(m => m.tag).map(m => h('div', {
    class: 'item', onclick: async () => {
      closeModal();
      await tweak({ op: 'copyModule', from: `Object:${src.name}`, module: m.tag, to: `Object:${target}` }, t(`Добавлено: ${m.label || m.className}`, `Added: ${m.label || m.className}`));
      reload();
    },
  }, h('div', {}, m.label || m.className, h('br'), h('small', {}, `${m.className} · ${m.props.slice(0, 3).map(p => `${p.key}=${p.value}`).join(', ')}`)))));
  openModal(t(`Что взять у «${src.display}»?`, `What to take from “${src.display}”?`), list);
}

function rawEdit(o, reload) {
  const ta = h('textarea', { class: 'raw' });
  ta.value = o.text;
  openModal(t(`Текст: ${o.name}`, `Text: ${o.name}`), h('div', {}, ta, h('div', { class: 'tools' },
    h('button', { class: 'primary', onclick: async () => { closeModal(); await tweak({ op: 'raw', block: `Object:${o.name}`, text: ta.value }); reload(); } }, t('Сохранить', 'Save')),
    h('span', { class: 'code' }, t('Первая строка должна остаться «Object ' + o.name + '», последняя «End».', 'Keep the first line “Object ' + o.name + '” and the last line “End”.')))));
}
void toast;
