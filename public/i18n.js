// Interface language. First visit: Russian browsers get Russian, everyone else English.
let saved = { lang: 'ru', saved: true };
try { saved = await (await fetch('/api/lang')).json(); } catch {}
export let lang = saved.lang;
if (!saved.saved) {
  lang = /^ru|^uk|^be|^kk/i.test(navigator.language || '') ? 'ru' : 'en';
  try { await fetch('/api/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang }) }); } catch {}
}
document.documentElement.lang = lang;
// Inline pair: t('Применить', 'Apply').
export const t = (ru, en) => (lang === 'en' ? en : ru);
export async function switchLang() {
  await fetch('/api/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: lang === 'en' ? 'ru' : 'en' }) });
  location.reload();
}
