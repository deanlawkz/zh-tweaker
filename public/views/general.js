// "Камера и общее".
import { h, fill, api, tweak } from '../app.js';
import { t } from '../i18n.js';

export async function renderGeneral(view) {
  const tweaks = await api.get('/api/tweaks');
  const cam = [...tweaks].reverse().find(t => t.op === 'camera');
  const aim = [...tweaks].reverse().find(t => t.op === 'aimFix');
  const fx = [...tweaks].reverse().find(t => t.op === 'battleFx');
  const fxCb = h('input', { type: 'checkbox' });
  fxCb.checked = fx ? !!fx.on : true;
  const height = h('input', { type: 'number', min: 100, max: 2000, step: 10, value: cam ? cam.value : 690, style: 'width:120px' });
  const aimCb = h('input', { type: 'checkbox' });
  aimCb.checked = aim ? !!aim.on : true;
  fill(view, h('div', { class: 'panel', style: 'max-width:760px' },
    h('h2', {}, t('Камера', 'Camera')),
    h('div', { class: 'row' }, h('div', { class: 'lab' }, t('Максимальная высота камеры', 'Maximum camera height'), h('small', {}, `MaxCameraHeight · ${t('в игре по умолчанию 310', 'game default 310')}${cam ? '' : t(' · сейчас не задано', ' · not set yet')}`)),
      h('div', { class: 'tools' }, height, h('button', { class: 'primary', onclick: () => tweak({ op: 'camera', value: Number(height.value) }).then(() => renderGeneral(view)) }, t('Сохранить', 'Save')))),
    h('h2', { style: 'margin-top:24px' }, t('Стрельба из транспорта', 'Firing from transports')),
    h('label', { class: 'switch' }, aimCb, t('Стрельба изнутри во все стороны', 'Fire from inside in all directions')),
    h('p', { class: 'code' }, t('Пехота Commander стреляет в любую сторону, не разворачиваясь. Так пассажиры хаммеров и других транспортов бьют по целям сбоку и сзади. Побочный эффект: на улице солдаты тоже стреляют «боком». Ракетчиков это не касается: ракета, пущенная вбок, падает в землю, поэтому они сначала поворачиваются к цели.', 'Commander infantry fire in any direction without turning, so passengers of Humvees and other transports hit targets on the sides and behind. Side effect: soldiers outside also fire sideways. Rocket soldiers still turn first, because a rocket fired sideways falls into the ground.')),
    h('h2', { style: 'margin-top:24px' }, t('Дым и звук в больших боях', 'Smoke and sound in big battles')),
    h('label', { class: 'switch' }, fxCb, t('Не терять дым ракет и звуки выстрелов', 'Keep missile smoke and weapon sounds')),
    h('p', { class: 'code' }, t('Обычно игра держит не больше 3000 частиц дыма и 24 звуков одновременно, а при падении FPS перестаёт рисовать следы снарядов. В бою на 8 армий ракеты тогда летят чёрными точками без звука. Настройка поднимает лимиты до 12 000 частиц и 64 звуков и оставляет следы ракет при низком FPS. Действует на всю игру, не только на Commander. Если игра начнёт тормозить, выключите.', 'By default the game keeps at most 3000 smoke particles and 24 sounds at once, and stops drawing projectile trails when FPS drops. In an 8-army battle missiles then fly as silent black dots. This raises the limits to 12,000 particles and 64 sounds and keeps missile trails at low FPS. It affects the whole game, not only Commander. Turn it off if the game slows down.')),
    h('h2', { style: 'margin-top:24px' }, t('Важно', 'Important')),
    h('p', {}, t('Все правки юнитов действуют только у фракции Commander. Остальные фракции и компьютер играют по обычным правилам. Онлайн с изменениями играть нельзя: перед сетевой игрой нажмите «Сбросить всё».', 'All unit changes apply only to the Commander faction. Other factions and the AI play by the standard rules. Do not play online with changes: press Reset all before an online game.'))));
  aimCb.onchange = () => tweak({ op: 'aimFix', on: aimCb.checked });
  fxCb.onchange = () => tweak({ op: 'battleFx', on: fxCb.checked });
}
