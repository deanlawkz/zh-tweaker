// "Commander": what the faction contains and what did not fit.
import { h, fill, api, state, icon } from '../app.js';
import { t } from '../i18n.js';

export async function renderCommander(view) {
  const s = await api.get('/api/state');
  const counts = { unit: 0, building: 0 };
  for (const o of state.objects) counts[o.kind] = (counts[o.kind] || 0) + 1;
  fill(view, h('div', { class: 'panel', style: 'max-width:900px' },
    h('div', { class: 'card-head' }, h('img', { src: icon('Cmdr_AmericaCommandCenter', 'portrait') }),
      h('div', {}, h('h2', {}, t('Фракция Commander', 'Commander faction')), h('div', { class: 'code' }, t('В лобби схватки выберите сторону «Commander»', 'Pick “Commander” in the skirmish lobby')))),
    h('p', {}, t(`Юнитов: ${counts.unit}, зданий: ${counts.building}. Старт: командный центр и бульдозер США. Командный центр строит ещё бульдозер Китая и рабочего ГЛА, у каждого свои здания. Все генеральские способности открыты сразу.`, `Units: ${counts.unit}, buildings: ${counts.building}. Start: USA Command Center and Dozer. The Command Center also builds the China Dozer and the GLA Worker, each with its own buildings. All general powers are unlocked from the start.`)),
    h('h3', {}, t('Не поместилось в наборы кнопок (лимит игры 14)', 'Did not fit into button sets (game limit is 14)')),
    s.report.overflow.length ? h('div', { class: 'list' }, s.report.overflow.map(o => h('div', { class: 'item' },
      h('div', {}, h('b', {}, o.commandSet.replace(/^Cmdr_|_CommandSet$/g, '')), h('br'), h('div', { class: 'grid', style: 'margin-top:6px' }, o.dropped.map(b => h('div', { class: 'tile', title: b }, h('img', { src: `/api/button-image/${encodeURIComponent(b)}` }), h('span', {}, b.replace(/^(Cmdr_)?Command_(Build_)?/, '')))))))))
      : h('p', {}, t('Всё поместилось.', 'Everything fits.')),
    h('p', { class: 'code' }, t('Недостающее можно поставить вручную во вкладке «Что строят здания»: юниты и здания кнопкой «Поставить юнит/здание», способности и улучшения кнопкой «Способность или улучшение».', 'You can add what is missing on the Build lists tab: units and buildings with “Put a unit/building”, powers and upgrades with “Power or upgrade”.'))));
}
