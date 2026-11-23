// "Изменения": grouped by unit, with the unit icon and plain words.
import { h, fill, api, refreshStatus, toast, icon, state, show } from '../app.js';
import { t } from '../i18n.js';

export async function renderChanges(view) {
  const [groups, s] = await Promise.all([api.get('/api/changes'), api.get('/api/state')]);
  const bad = new Map(s.errors.filter(e => e.tweakId != null).map(e => [e.tweakId, e.message]));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const undo = async ids => { for (const id of ids) await api.del(`/api/tweaks/${id}`); await refreshStatus(); toast(t('Правка отменена', 'Change undone')); renderChanges(view); };
  const open = name => { state.selected = name; show('units'); };
  fill(view, h('div', { class: 'panel changes', style: 'max-width:980px' },
    h('h2', {}, t(`Изменения (${total})`, `Changes (${total})`)),
    groups.length ? h('div', { class: 'cgroups' }, groups.map(g => h('section', { class: 'cgroup' },
      h('div', { class: 'chead' },
        g.object ? h('img', { src: icon(g.object), onclick: () => open(g.object), title: t('Открыть карточку', 'Open card') }) : h('span', { class: 'gear' }, '⚙'),
        h('div', { class: 'grow' }, h('b', {}, g.display), h('small', {}, ` · ${g.items.length}`)),
        g.object ? h('button', { class: 'small', onclick: () => open(g.object) }, t('Открыть', 'Open')) : null,
        h('button', { class: 'small danger', onclick: () => confirm(t(`Отменить все правки «${g.display}»?`, `Undo all changes of “${g.display}”?`)) && undo(g.items.flatMap(i => i.ids)) }, t('Отменить всё', 'Undo all'))),
      g.items.map(i => {
        const err = i.ids.map(id => bad.get(id)).find(Boolean);
        return h('div', { class: 'item' + (err ? ' err' : '') },
          i.icon ? h('img', { class: 'mini', src: icon(i.icon) }) : null,
          h('div', { class: 'grow' }, i.text, err ? h('div', { class: 'code' }, '⚠ ' + err) : null),
          h('small', { class: 'code' }, new Date(i.createdAt).toLocaleString(t('ru-RU', 'en-GB'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
          h('button', { class: 'small danger', onclick: () => undo(i.ids) }, t('Отменить', 'Undo')));
      }))))
      : h('div', { class: 'empty' }, t('Правок пока нет', 'No changes yet'))));
}
