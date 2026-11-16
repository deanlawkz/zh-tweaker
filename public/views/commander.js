// "Commander": what the faction contains and what did not fit.
import { h, fill, api, state, icon } from '../app.js';

export async function renderCommander(view) {
  const s = await api.get('/api/state');
  const counts = { unit: 0, building: 0 };
  for (const o of state.objects) counts[o.kind] = (counts[o.kind] || 0) + 1;
  fill(view, h('div', { class: 'panel', style: 'max-width:900px' },
    h('div', { class: 'card-head' }, h('img', { src: icon('Cmdr_AmericaCommandCenter', 'portrait') }),
      h('div', {}, h('h2', {}, 'Фракция Commander'), h('div', { class: 'code' }, 'В лобби схватки выберите сторону «Commander»'))),
    h('p', {}, `Юнитов: ${counts.unit}, зданий: ${counts.building}. Старт: командный центр и бульдозер США. Командный центр строит ещё бульдозер Китая и рабочего ГЛА, у каждого свои здания. Все генеральские способности открыты сразу.`),
    h('h3', {}, 'Не поместилось в наборы кнопок (лимит игры 14)'),
    s.report.overflow.length ? h('div', { class: 'list' }, s.report.overflow.map(o => h('div', { class: 'item' },
      h('div', {}, h('b', {}, o.commandSet.replace(/^Cmdr_|_CommandSet$/g, '')), h('br'), h('small', {}, o.dropped.join(', '))))))
      : h('p', {}, 'Всё поместилось.'),
    h('p', { class: 'code' }, 'Недостающее можно поставить вручную во вкладке «Что строят здания», заменив ненужные кнопки.')));
}
