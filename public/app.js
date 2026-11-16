// ZH Tweaker UI shell: API, shared state, modal pickers, tab switching.
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

export const SIDES = { America: 'США', China: 'Китай', GLA: 'ГЛА', Other: 'Прочее' };
export const GENERALS = { null: 'Обычные', AirForce: 'ВВС', Laser: 'Лазерный', SuperWeapon: 'Супероружие', Tank: 'Танковый', Infantry: 'Пехотный', Nuke: 'Ядерный', Toxin: 'Токсичный', Demolition: 'Подрывник', Stealth: 'Скрытный', Boss: 'Босс' };
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
  box.replaceChildren(h('b', {}, 'Что мешает применить:'), h('ul', {}, errors.slice(0, 12).map(e =>
    h('li', {}, `${e.block ? e.block + (e.key ? ' · ' + e.key : '') + ': ' : ''}${e.message}`))));
}

export async function refreshStatus() {
  const s = await api.get('/api/state');
  $('#changes-count').textContent = s.tweaks ? `(${s.tweaks})` : '';
  $('#status').replaceChildren(
    `Правок: ${s.tweaks}. `,
    s.errors.length ? h('span', { class: 'bad' }, `Ошибок: ${s.errors.length}`) : 'Ошибок нет.');
  showErrors(s.errors);
  return s;
}

// Add a tweak; returns server answer. Re-renders status.
export async function tweak(t, okMsg = 'Сохранено. Нажмите «Применить», чтобы записать в игру.') {
  const r = await api.post('/api/tweaks', t);
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
    const search = h('input', { type: 'text', placeholder: 'Поиск: Paradrop, Carpet, Flash…' });
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
    const search = h('input', { type: 'text', placeholder: 'Поиск по названию' });
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
    const search = h('input', { type: 'text', placeholder: 'Поиск' });
    const holder = h('div', { class: 'list' });
    let timer;
    const draw = async () => {
      const items = await api.get(`/api/refs/${type}?q=${encodeURIComponent(search.value)}`);
      holder.replaceChildren(...items.slice(0, 200).map(it => {
        const pic = type === 'Object' ? it.name : type === 'Weapon' && it.users?.[0];
        return h('div', { class: 'item', onclick: () => { closeModal(); resolve(it.name); } },
          pic ? h('img', { src: icon(pic), loading: 'lazy' }) : null,
          h('div', {}, it.display || it.name, h('br'), h('small', {}, it.name, it.users?.length ? ` · у ${it.users.join(', ')}` : '')));
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
  if (!wrap.children.length) wrap.append(h('div', { class: 'empty' }, 'Ничего не найдено'));
  return wrap;
}

// ---------- tabs ----------
const VIEWS = { units: renderUnits, build: renderBuild, weapons: renderWeapons, general: renderGeneral, commander: renderCommander, changes: renderChanges };
export async function show(tab) {
  state.tab = tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  const view = $('#view');
  view.replaceChildren(h('div', { class: 'empty' }, 'Загрузка…'));
  try { await VIEWS[tab](view); } catch (e) { view.replaceChildren(h('div', { class: 'empty' }, 'Ошибка: ' + e.message)); }
}
$('#tabs').onclick = e => { const t = e.target.closest('button')?.dataset.tab; if (t) show(t); };

$('#btn-apply').onclick = async () => {
  const r = await api.post('/api/apply');
  await refreshStatus();
  if (r.ok) toast(`Записано в игру: ${r.written.length} файлов. Можно играть.`);
  else if (r.error) toast(`Не применено: ${r.error}`, true);
  else { showErrors(r.errors); toast('Не применено: есть ошибки (список вверху)', true); }
};
$('#btn-reset').onclick = async () => {
  if (!confirm('Убрать все файлы твикера из игры? Игра станет ванильной. Список правок сохранится, его можно применить снова.')) return;
  const r = await api.post('/api/reset');
  if (r.error) return toast(r.error, true);
  toast(r.kept?.length ? `Сброшено, но оставлены изменённые вручную: ${r.kept.join(', ')}` : 'Игра снова ванильная.');
};
$('#btn-play').onclick = async () => { await api.post('/api/play'); toast('Запускаю игру…'); };

state.objects = await api.get('/api/objects');
await refreshStatus();
show('units');
