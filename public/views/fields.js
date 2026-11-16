// Editable rows for INI props, shared by unit and weapon cards.
import { h, icon, pickRef, tweak } from '../app.js';

const isBool = v => /^(yes|no)$/i.test(v);

// owner: {block:'Object:Cmdr_X', module?: tag}
export function propRow(owner, p, onSaved) {
  const lab = p.label;
  const title = h('div', { class: 'lab' }, lab ? lab.ru : p.key,
    h('small', {}, p.key, lab?.hint ? h('span', { class: 'hint' }, ' · ' + lab.hint) : null));
  const save = value => tweak({ op: 'set', ...owner, key: p.key, value }).then(onSaved);
  let input;
  if (lab?.type === 'bool' || (!lab && isBool(p.value))) {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = /^yes$/i.test(p.value);
    cb.onchange = () => save(cb.checked ? 'Yes' : 'No');
    input = h('label', { class: 'switch' }, cb, cb.checked ? 'Да' : 'Нет');
    cb.addEventListener('change', () => (input.lastChild.textContent = cb.checked ? 'Да' : 'Нет'));
  } else if (lab?.type === 'ref') {
    const name = p.value.split(/\s+/)[0];
    input = h('button', { class: 'refbtn', onclick: async () => { const v = await pickRef(lab.ref, lab.ru); if (v) save(v); } },
      lab.ref === 'Object' ? h('img', { src: icon(name) }) : null, name || '(нет)', ' ▾');
  } else if (lab?.type === 'enum') {
    const sel = h('select', {}, [...new Set([p.value, ...lab.options])].map(o => h('option', { value: o, selected: o === p.value }, o)));
    sel.onchange = () => save(sel.value);
    input = sel;
  } else {
    const num = lab?.type === 'number';
    const inp = h('input', { type: 'text', value: p.value, inputmode: num ? 'decimal' : null });
    inp.oninput = () => inp.classList.toggle('changed', inp.value !== p.value);
    inp.onchange = () => { if (inp.value !== p.value) save(inp.value); };
    input = inp;
  }
  return h('div', { class: 'row' }, title, input);
}
