// ZH Tweaker UI shell: API, shared state, modal pickers, tab switching.
import { t, lang, switchLang } from './i18n.js';
import { renderUnits } from './views/units.js';
import { renderBuild } from './views/build.js';
import { renderWeapons } from './views/weapons.js';
import { renderGeneral } from './views/general.js';
import { renderCommander } from './views/commander.js';
import { renderChanges } from './views/changes.js';

export const $ = (s, el = document) => el.querySelector(s);
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
};

export const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k != null && k !== false));

export const api = {
  async get(p) { const r = await fetch(p); if (!r.ok) throw new Error((await r.json()).error || r.statusText); return r.json(); },
  async post(p, b) { const r = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return r.json(); },
  async del(p) { const r = await fetch(p, { method: 'DELETE' }); return r.json(); },
};

export const SIDES = { America: t('США', 'USA'), China: t('Китай', 'China'), GLA: t('ГЛА', 'GLA'), Other: t('Прочее', 'Other') };
export const GENERALS = lang === 'en'
  ? { null: 'Standard', AirForce: 'Air Force', Laser: 'Laser', SuperWeapon: 'Superweapon', Tank: 'Tank', Infantry: 'Infantry', Nuke: 'Nuke', Toxin: 'Toxin', Demolition: 'Demolition', Stealth: 'Stealth', Boss: 'Boss' }
  : { null: 'Обычные', AirForce: 'ВВС', Laser: 'Лазерный', SuperWeapon: 'Супероружие', Tank: 'Танковый', Infantry: 'Пехотный', Nuke: 'Ядерный', Toxin: 'Токсичный', Demolition: 'Подрывник', Stealth: 'Скрытный', Boss: 'Босс' };
export const icon = (name, size = 'button') => `/icon/${encodeURIComponent(name)}/${size}.png`;

export const state = { objects: [], tab: 'units', selected: null };

export function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), 3500);
}

export function showErrors(errors) {
  const box = $('#errors');
  if (!errors?.length) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(h('b', {}, t('Что мешает применить:', 'What blocks applying:')), h('ul', {}, errors.slice(0, 12).map(e =>
    h('li', {}, `${e.block ? e.block + (e.key ? ' · ' + e.key : '') + ': ' : ''}${e.message}`))));
}

export async function refreshStatus() {
  const s = await api.get('/api/state');
  $('#changes-count').textContent = s.tweaks ? `(${s.tweaks})` : '';
  $('#status').replaceChildren(
    t(`Правок: ${s.tweaks}. `, `Changes: ${s.tweaks}. `),
    s.errors.length ? h('span', { class: 'bad' }, t(`Ошибок: ${s.errors.length}`, `Errors: ${s.errors.length}`)) : t('Ошибок нет.', 'No errors.'));
  showErrors(s.errors);
  return s;
}

// Add a tweak; returns server answer. Re-renders status.
export async function tweak(tw, okMsg = t('Сохранено. Нажмите «Применить», чтобы записать в игру.', 'Saved. Press Apply to write it to the game.')) {
  const r = await api.post('/api/tweaks', tw);
  await refreshStatus();
  if (r.error) { toast(r.error, true); return r; }
  const mine = r.errors.filter(e => e.tweakId === r.tweak.id);
  if (mine.length) toast(mine[0].message, true); else toast(okMsg);
  return r;
}

// ---------- modal pickers ----------
export function openModal(title, body) {
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren(body);
  $('#modal').hidden = false;
}
export function closeModal() { $('#modal').hidden = true; }
$('#modal-close').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Upgrade / special power buttons with their game pictures.
export function pickButton(title) {
  return new Promise(resolve => {
    const search = h('input', { type: 'text', placeholder: t('Поиск: Paradrop, Carpet, Flash…', 'Search: Paradrop, Carpet, Flash…') });
    const holder = h('div', { class: 'grid' });
    let timer;
    const draw = async () => {
      const items = await api.get(`/api/buttons?q=${encodeURIComponent(search.value)}`);
      fill(holder, items.filter(b => b.image).map(b => h('div', { class: 'tile', title: `${b.text || b.name}\n${b.name}`, onclick: () => { closeModal(); resolve(b); } },
        h('img', { src: `/img/${encodeURIComponent(b.image)}.png`, loading: 'lazy' }), h('span', {}, b.text || b.name))));
    };
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 200); };
    openModal(title, h('div', {}, h('div', { class: 'filters' }, search), holder));
    draw(); search.focus();
  });
}

// Icon grid of Commander objects; resolves with the chosen object.
export function pickObject(title, { kind } = {}) {
  return new Promise(resolve => {
    const search = h('input', { type: 'text', placeholder: t('Поиск по названию', 'Search by name') });
    const holder = h('div');
    const draw = () => {
      const q = search.value.toLowerCase();
      const list = state.objects.filter(o => (!kind || o.kind === kind) && (!q || o.display.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)));
      holder.replaceChildren(objectGrid(list, o => { closeModal(); resolve(o); }));
    };
    search.oninput = draw;
    openModal(title, h('div', {}, h('div', { class: 'filters' }, search), holder));
    draw(); search.focus();
  });
}

// List picker for references (weapons, objects, effects...).
export function pickRef(type, title) {
  return new Promise(resolve => {
    const search = h('input', { type: 'text', placeholder: t('Поиск', 'Search') });
    const holder = h('div', { class: 'list' });
    let timer;
    const draw = async () => {
      const items = await api.get(`/api/refs/${type}?q=${encodeURIComponent(search.value)}`);
      holder.replaceChildren(...items.slice(0, 200).map(it => {
        const pic = type === 'Object' ? it.name : type === 'Weapon' && it.users?.[0];
        return h('div', { class: 'item', onclick: () => { closeModal(); resolve(it.name); } },
          pic ? h('img', { src: icon(pic), loading: 'lazy' }) : null,
          h('div', {}, it.display || it.name, h('br'), h('small', {}, it.name, it.users?.length ? t(` · у ${it.users.join(', ')}`, ` · used by ${it.users.join(', ')}`) : '')));
      }));
    };
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 200); };
    openModal(title, h('div', {}, h('div', { class: 'filters' }, search), holder));
    draw(); search.focus();
  });
}

export function objectGrid(list, onPick, selected) {
  const bySide = {};
  for (const o of list) ((bySide[o.side] ||= {})[o.general ?? 'null'] ||= []).push(o);
  const wrap = h('div');
  for (const side of Object.keys(SIDES)) {
    const gens = bySide[side];
    if (!gens) continue;
    for (const [g, items] of Object.entries(gens)) {
      items.sort((a, b) => a.display.localeCompare(b.display));
      wrap.append(h('div', { class: 'group' },
        h('h4', {}, `${SIDES[side]} · ${GENERALS[g] || g}`),
        h('div', { class: 'grid' }, items.map(o => h('div', {
          class: `tile side-${o.side}${selected === o.name ? ' sel' : ''}`, title: `${o.display}\n${o.name}`, onclick: () => onPick(o),
        }, h('img', { src: icon(o.name), loading: 'lazy', alt: '' }), h('span', {}, o.display))))));
    }
  }
  if (!wrap.children.length) wrap.append(h('div', { class: 'empty' }, t('Ничего не найдено', 'Nothing found')));
  return wrap;
}

// ---------- tabs ----------
const VIEWS = { units: renderUnits, build: renderBuild, weapons: renderWeapons, general: renderGeneral, commander: renderCommander, changes: renderChanges };
export async function show(tab) {
  state.tab = tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  const view = $('#view');
  view.replaceChildren(h('div', { class: 'empty' }, t('Загрузка…', 'Loading…')));
  try { await VIEWS[tab](view); } catch (e) { view.replaceChildren(h('div', { class: 'empty' }, t('Ошибка: ', 'Error: ') + e.message)); }
}
$('#tabs').onclick = e => { const t = e.target.closest('button')?.dataset.tab; if (t) show(t); };

$('#btn-apply').onclick = async () => {
  const r = await api.post('/api/apply');
  await refreshStatus();
  if (r.ok) toast(t(`Записано в игру: ${r.written.length} файлов. Можно играть.`, `Written to the game: ${r.written.length} files. Ready to play.`));
  else if (r.error) toast(t(`Не применено: ${r.error}`, `Not applied: ${r.error}`), true);
  else { showErrors(r.errors); toast(t('Не применено: есть ошибки (список вверху)', 'Not applied: there are errors (list at the top)'), true); }
};
$('#btn-reset').onclick = async () => {
  if (!confirm(t('Убрать все файлы твикера из игры? Игра станет ванильной. Список правок сохранится, его можно применить снова.', 'Remove all tweaker files from the game? The game becomes vanilla again. Your changes are kept and can be applied again.'))) return;
  const r = await api.post('/api/reset');
  if (r.error) return toast(r.error, true);
  toast(r.kept?.length ? t(`Сброшено, но оставлены изменённые вручную: ${r.kept.join(', ')}`, `Reset, but files edited by hand were kept: ${r.kept.join(', ')}`) : t('Игра снова ванильная.', 'The game is vanilla again.'));
};
$('#btn-play').onclick = async () => { await api.post('/api/play'); toast(t('Запускаю игру…', 'Starting the game…')); };
$('#btn-lang').textContent = lang === 'en' ? 'RU' : 'EN';
$('#btn-lang').onclick = switchLang;
if (lang === 'en') for (const el of document.querySelectorAll('[data-en]')) el.textContent = el.dataset.en;

state.objects = await api.get('/api/objects');
await refreshStatus();
show('units');
