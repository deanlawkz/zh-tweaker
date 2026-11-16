// "Камера и общее".
import { h, fill, api, tweak } from '../app.js';

export async function renderGeneral(view) {
  const tweaks = await api.get('/api/tweaks');
  const cam = [...tweaks].reverse().find(t => t.op === 'camera');
  const aim = [...tweaks].reverse().find(t => t.op === 'aimFix');
  const height = h('input', { type: 'number', min: 100, max: 2000, step: 10, value: cam ? cam.value : 690, style: 'width:120px' });
  const aimCb = h('input', { type: 'checkbox' });
  aimCb.checked = aim ? !!aim.on : true;
  fill(view, h('div', { class: 'panel', style: 'max-width:760px' },
    h('h2', {}, 'Камера'),
    h('div', { class: 'row' }, h('div', { class: 'lab' }, 'Максимальная высота камеры', h('small', {}, `MaxCameraHeight · в игре по умолчанию 310${cam ? '' : ' · сейчас не задано'}`)),
      h('div', { class: 'tools' }, height, h('button', { class: 'primary', onclick: () => tweak({ op: 'camera', value: Number(height.value) }).then(() => renderGeneral(view)) }, 'Сохранить'))),
    h('h2', { style: 'margin-top:24px' }, 'Стрельба из транспорта'),
    h('label', { class: 'switch' }, aimCb, 'Стрельба изнутри во все стороны'),
    h('p', { class: 'code' }, 'Пехота Commander стреляет в любую сторону, не разворачиваясь. Так пассажиры хаммеров и других транспортов бьют по целям сбоку и сзади. Побочный эффект: на улице солдаты тоже стреляют «боком».'),
    h('h2', { style: 'margin-top:24px' }, 'Важно'),
    h('p', {}, 'Все правки юнитов действуют только у фракции Commander. Остальные фракции и компьютер играют по обычным правилам. Онлайн с изменениями играть нельзя: перед сетевой игрой нажмите «Сбросить всё».')));
  aimCb.onchange = () => tweak({ op: 'aimFix', on: aimCb.checked });
}
