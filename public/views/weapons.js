// "Оружие": pick a unit by icon, then edit any of its weapons.
import { h, fill, api, state, icon, objectGrid, tweak, show } from '../app.js';
import { propRow } from './fields.js';

export async function renderWeapons(view) {
  const left = h('div', { class: 'panel' });
  const right = h('div', { class: 'panel sticky' }, h('div', { class: 'empty' }, 'Выберите юнит, затем его оружие'));
  fill(view, h('div', { class: 'split' }, left, right));
  const armed = state.objects;
  const draw = sel => fill(left, objectGrid(armed, o => { state.weaponUnit = o.name; state.weaponFrom = null; draw(o.name); listWeapons(right, o); }, sel));
  draw(state.weaponUnit);
  if (state.weapon) openWeapon(right, state.weapon);
  else if (state.weaponUnit) listWeapons(right, armed.find(o => o.name === state.weaponUnit));
}

async function listWeapons(box, o) {
  const card = await api.get(`/api/object/${encodeURIComponent(o.name)}`);
  fill(box, 
    h('div', { class: 'card-head' }, h('img', { src: icon(o.name, 'portrait') }), h('div', {}, h('h2', {}, o.display), h('div', { class: 'code' }, o.name))),
    card.weapons.length ? h('div', { class: 'list' }, card.weapons.map(w => h('div', { class: 'item', onclick: () => { state.weaponFrom = null; openWeapon(box, w); } }, h('img', { src: icon(o.name) }), h('div', {}, w))))
      : h('div', { class: 'empty' }, 'Без оружия. Добавить оружие можно в карточке юнита.'));
}

const NUKE_OCL = 'OCL_Cmdr_NukeBlast';
const num = v => (v == null ? '?' : String(v).replace(/\.0+$/, ''));

// One line for cards: "урон 400 · радиус 20 · дальность 300 · ☢ ядерный взрыв".
export function weaponLine(s) {
  if (!s) return '';
  return [`урон ${num(s.damage)}`, `радиус ${num(s.radius)}`, `дальность ${num(s.range)}`, s.nuke ? '☢ ядерный взрыв' : null].filter(Boolean).join(' · ');
}

export async function openWeapon(box, name) {
  state.weapon = null;
  const w = await api.get(`/api/weapon/${encodeURIComponent(name)}`);
  const reload = () => openWeapon(box, name);
  const owner = { block: `Weapon:${name}` };
  const known = w.props.filter(p => p.label), other = w.props.filter(p => !p.label);
  const from = state.weaponFrom, unit = state.objects.find(o => o.name === state.weaponUnit);
  const back = from
    ? h('button', { class: 'back', onclick: () => { state.selected = from; state.weaponFrom = null; show('units'); } }, '← Назад к карточке юнита')
    : unit ? h('button', { class: 'back', onclick: () => listWeapons(box, unit) }, '← Назад к оружию юнита') : null;
  fill(box, back,
    h('div', { class: 'card-head' }, w.users?.[0] ? h('img', { src: icon(w.users[0], 'portrait') }) : null, h('div', {}, h('h2', {}, name), h('div', { class: 'code' }, w.users?.length ? 'У: ' + w.users.join(', ') : ''))),
    h('div', { class: 'wsum' + (w.summary?.nuke ? ' nuke' : '') }, weaponLine(w.summary)),
    name.startsWith('Cmdr_') ? h('div', { class: 'tools', style: 'margin:8px 0 12px' },
      w.summary?.nuke
        ? h('button', { onclick: () => tweak({ op: 'set', block: `Weapon:${name}`, key: 'ProjectileDetonationOCL', value: 'None' }, 'Ядерный взрыв убран. Нажмите «Применить».').then(reload) }, 'Убрать ядерный взрыв')
        : h('button', { class: 'primary', onclick: () => tweak({ op: 'set', block: `Weapon:${name}`, key: 'ProjectileDetonationOCL', value: NUKE_OCL }, 'Теперь при попадании ядерный взрыв, как у ракетной шахты. Нажмите «Применить».').then(reload) }, '☢ Ядерный взрыв при попадании')) : null,
    name.startsWith('Cmdr_') ? null : h('div', { class: 'errors' }, 'Это ванильное оружие, его менять нельзя. Сначала поставьте его юниту Commander (карточка юнита → «Сменить»).'),
    h('details', { class: 'module known', open: true }, h('summary', {}, 'Главное'), h('div', { class: 'rows' }, known.map(p => propRow(owner, p, reload)))),
    h('details', { class: 'module' }, h('summary', {}, 'Прочие параметры'), h('div', { class: 'rows' }, other.map(p => propRow(owner, p, reload)))));
}
