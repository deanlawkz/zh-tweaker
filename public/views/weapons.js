// "Оружие": pick a unit by icon, then edit any of its weapons.
import { h, fill, api, state, icon, objectGrid } from '../app.js';
import { propRow } from './fields.js';

export async function renderWeapons(view) {
  const left = h('div', { class: 'panel' });
  const right = h('div', { class: 'panel sticky' }, h('div', { class: 'empty' }, 'Выберите юнит, затем его оружие'));
  fill(view, h('div', { class: 'split' }, left, right));
  const armed = state.objects;
  const draw = sel => fill(left, objectGrid(armed, o => { state.weaponUnit = o.name; draw(o.name); listWeapons(right, o); }, sel));
  draw(state.weaponUnit);
  if (state.weapon) openWeapon(right, state.weapon);
  else if (state.weaponUnit) listWeapons(right, armed.find(o => o.name === state.weaponUnit));
}

async function listWeapons(box, o) {
  const card = await api.get(`/api/object/${encodeURIComponent(o.name)}`);
  fill(box, 
    h('div', { class: 'card-head' }, h('img', { src: icon(o.name, 'portrait') }), h('div', {}, h('h2', {}, o.display), h('div', { class: 'code' }, o.name))),
    card.weapons.length ? h('div', { class: 'list' }, card.weapons.map(w => h('div', { class: 'item', onclick: () => openWeapon(box, w) }, h('img', { src: icon(o.name) }), h('div', {}, w))))
      : h('div', { class: 'empty' }, 'Без оружия. Добавить оружие можно в карточке юнита.'));
}

export async function openWeapon(box, name) {
  state.weapon = null;
  const w = await api.get(`/api/weapon/${encodeURIComponent(name)}`);
  const reload = () => openWeapon(box, name);
  const owner = { block: `Weapon:${name}` };
  const known = w.props.filter(p => p.label), other = w.props.filter(p => !p.label);
  fill(box, 
    h('div', { class: 'card-head' }, w.users?.[0] ? h('img', { src: icon(w.users[0], 'portrait') }) : null, h('div', {}, h('h2', {}, name), h('div', { class: 'code' }, w.users?.length ? 'У: ' + w.users.join(', ') : ''))),
    name.startsWith('Cmdr_') ? null : h('div', { class: 'errors' }, 'Это ванильное оружие, его менять нельзя. Сначала поставьте его юниту Commander (карточка юнита → «Сменить»).'),
    h('details', { class: 'module known', open: true }, h('summary', {}, 'Главное'), h('div', { class: 'rows' }, known.map(p => propRow(owner, p, reload)))),
    h('details', { class: 'module' }, h('summary', {}, 'Прочие параметры'), h('div', { class: 'rows' }, other.map(p => propRow(owner, p, reload)))));
}
