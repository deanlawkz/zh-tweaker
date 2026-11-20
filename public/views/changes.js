// "Изменения": grouped by unit, with the unit icon and plain words.
import { h, fill, api, refreshStatus, toast, icon, state, show } from '../app.js';

export async function renderChanges(view) {
  const [groups, s] = await Promise.all([api.get('/api/changes'), api.get('/api/state')]);
  const bad = new Map(s.errors.filter(e => e.tweakId != null).map(e => [e.tweakId, e.message]));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const undo = async ids => { for (const id of ids) await api.del(`/api/tweaks/${id}`); await refreshStatus(); toast('Правка отменена'); renderChanges(view); };
  const open = name => { state.selected = name; show('units'); };
  fill(view, h('div', { class: 'panel changes', style: 'max-width:980px' },
    h('h2', {}, `Изменения (${total})`),
    groups.length ? h('div', { class: 'cgroups' }, groups.map(g => h('section', { class: 'cgroup' },
      h('div', { class: 'chead' },
        g.object ? h('img', { src: icon(g.object), onclick: () => open(g.object), title: 'Открыть карточку' }) : h('span', { class: 'gear' }, '⚙'),
        h('div', { class: 'grow' }, h('b', {}, g.display), h('small', {}, ` · ${g.items.length}`)),
        g.object ? h('button', { class: 'small', onclick: () => open(g.object) }, 'Открыть') : null,
        h('button', { class: 'small danger', onclick: () => confirm(`Отменить все правки «${g.display}»?`) && undo(g.items.flatMap(i => i.ids)) }, 'Отменить всё')),
      g.items.map(i => {
        const err = i.ids.map(id => bad.get(id)).find(Boolean);
        return h('div', { class: 'item' + (err ? ' err' : '') },
          i.icon ? h('img', { class: 'mini', src: icon(i.icon) }) : null,
          h('div', { class: 'grow' }, i.text, err ? h('div', { class: 'code' }, '⚠ ' + err) : null),
          h('small', { class: 'code' }, new Date(i.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
          h('button', { class: 'small danger', onclick: () => undo(i.ids) }, 'Отменить'));
      }))))
      : h('div', { class: 'empty' }, 'Правок пока нет')));
}
