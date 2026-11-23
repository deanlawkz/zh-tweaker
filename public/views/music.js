// "Музыка": a folder of your own music for the main menu, Commander and each side.
import { h, fill, api, icon, tweak } from '../app.js';
import { t } from '../i18n.js';

const ROWS = {
  shell: { pic: null, sym: '🎬', name: () => t('Главное меню', 'Main menu'), what: () => t('Заставка и меню игры', 'Game intro screen and menus') },
  commander: { pic: 'Cmdr_AmericaCommandCenter', name: () => 'Commander', what: () => t('Ваша фракция: экран загрузки и вся игра', 'Your faction: loading screen and the whole match') },
  usa: { pic: 'Cmdr_AmericaCommandCenter', name: () => t('США', 'USA'), what: () => t('Все генералы США: загрузка и бой', 'All USA generals: loading and battle') },
  china: { pic: 'Cmdr_ChinaCommandCenter', name: () => t('Китай', 'China'), what: () => t('Все генералы Китая: загрузка и бой', 'All China generals: loading and battle') },
  gla: { pic: 'Cmdr_GLACommandCenter', name: () => t('ГЛА', 'GLA'), what: () => t('Все генералы ГЛА: загрузка и бой', 'All GLA generals: loading and battle') },
};

export async function renderMusic(view) {
  const m = await api.get('/api/music');
  const reload = () => renderMusic(view);
  const set = async (slot, folder) => {
    await tweak({ op: 'music', slot, folder }, folder ? t('Папка выбрана. Нажмите «Применить».', 'Folder set. Press Apply.') : t('Вернётся стандартная музыка. Нажмите «Применить».', 'Game music will be back. Press Apply.'));
    reload();
  };
  const choose = async slot => {
    const r = await api.post('/api/pick-folder', { prompt: t(`Музыка: ${ROWS[slot].name()}`, `Music: ${ROWS[slot].name()}`) });
    if (r.folder) set(slot, r.folder);
  };
  fill(view, h('div', { class: 'panel', style: 'max-width:900px' },
    h('h2', {}, t('Своя музыка', 'Your own music')),
    h('p', {}, t('Выберите папку с музыкой (mp3, wav, m4a, flac, ogg). При «Применить» твикер склеит треки папки по порядку имён в один длинный трек до 30 минут и подставит его в игру. Файлы в самой папке не меняются.',
      'Pick a folder with music (mp3, wav, m4a, flac, ogg). On Apply the tweaker joins its tracks in name order into one long track of up to 30 minutes and puts it into the game. Your files are not changed.')),
    m.ffmpeg ? null : h('div', { class: 'errors' }, t('Не найден ffmpeg, поэтому из папки будет играть только первый mp3 или wav. Чтобы играла вся папка, установите ffmpeg: brew install ffmpeg',
      'ffmpeg not found, so only the first mp3 or wav of the folder will play. To play the whole folder, install ffmpeg: brew install ffmpeg')),
    h('div', { class: 'cgroups' }, m.slots.map(s => {
      const r = ROWS[s.slot];
      return h('section', { class: 'cgroup' }, h('div', { class: 'chead' },
        r.pic ? h('img', { src: icon(r.pic) }) : h('span', { class: 'gear' }, r.sym),
        h('div', { class: 'grow' }, h('b', {}, r.name()), h('small', {}, ' · ', r.what()),
          h('div', { class: 'code' }, s.folder
            ? (s.error ? '⚠ ' + s.error : `📁 ${s.folder} · ${t('треков', 'tracks')}: ${s.tracks}`)
            : t('Стандартная музыка игры', 'Game music'))),
        h('button', { class: 'small primary', onclick: () => choose(s.slot) }, s.folder ? t('Другая папка…', 'Change folder…') : t('Выбрать папку…', 'Choose folder…')),
        s.folder ? h('button', { class: 'small danger', onclick: () => set(s.slot, null) }, t('Вернуть стандартную', 'Use game music')) : null));
    })),
    h('h3', { style: 'margin-top:24px' }, t('Как это работает', 'How it works')),
    h('ul', {},
      h('li', {}, t('На Маке GeneralsX не переключает треки сам: один трек играет по кругу. Поэтому папка склеивается в один длинный трек.', 'On Mac, GeneralsX does not move to the next track by itself: one track loops. That is why the folder is joined into one long track.')),
      h('li', {}, t('Для США, Китая и ГЛА музыка меняется у всех их генералов, в том числе у компьютерных противников. Слышите вы музыку той стороны, за которую играете.', 'For USA, China and GLA the music changes for all their generals. You hear the music of the side you play.')),
      h('li', {}, t('Commander играет музыку экрана загрузки до конца боя. Если папку для Commander не выбрать, будет музыка США.', 'Commander keeps the loading screen music for the whole match. Without a Commander folder it uses the USA music.')),
      h('li', {}, t('Склейка занимает до минуты при первом «Применить». Потом берётся готовый файл, пока папка не изменится.', 'Joining takes up to a minute on the first Apply. After that the ready file is reused until the folder changes.')))));
}
