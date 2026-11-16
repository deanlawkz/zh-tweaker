// "Изменения": every tweak with undo.
import { h, fill, api, refreshStatus, toast } from '../app.js';

const describe = t => ({
  camera: () => `Камера: высота ${t.value}`,
  aimFix: () => `Стрельба изнутри во все стороны: ${t.on ? 'включена' : 'выключена'}`,
  set: () => `${t.block.split(':')[1]}${t.module ? ' · ' + t.module : ''}: ${t.key} = ${t.value}`,
  removeModule: () => `${t.block.split(':')[1]}: удалён модуль ${t.module}`,
  copyModule: () => `${t.to.split(':')[1]}: взят модуль ${t.module} у ${t.from.split(':')[1]}`,
  weaponSlot: () => `${t.object}: ${t.slot} = ${t.weapon}`,
  commandSlot: () => `${t.commandSet}: слот ${t.slot} = ${t.button ?? 'пусто'}`,
  raw: () => `${t.block.split(':')[1]}: текст целиком`,
}[t.op] || (() => t.op))();

export async function renderChanges(view) {
  const [list, s] = await Promise.all([api.get('/api/tweaks'), api.get('/api/state')]);
  const bad = new Map(s.errors.filter(e => e.tweakId != null).map(e => [e.tweakId, e.message]));
  fill(view, h('div', { class: 'panel changes', style: 'max-width:980px' },
    h('h2', {}, `Изменения (${list.length})`),
    list.length ? list.map(t => h('div', { class: 'item' + (bad.has(t.id) ? ' err' : '') },
      h('div', { class: 'grow' }, describe(t), bad.has(t.id) ? h('div', { class: 'code' }, '⚠ ' + bad.get(t.id)) : null),
      h('small', { class: 'code' }, new Date(t.createdAt).toLocaleString('ru-RU')),
      h('button', { class: 'small danger', onclick: async () => { await api.del(`/api/tweaks/${t.id}`); await refreshStatus(); toast('Правка отменена'); renderChanges(view); } }, 'Отменить')))
      : h('div', { class: 'empty' }, 'Правок пока нет')));
}
