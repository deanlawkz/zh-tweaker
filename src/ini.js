// SAGE INI model that keeps the original text intact.
// Edits are text splices; the file is re-parsed after each edit.

// Keys that open a nested block even though the line has '='.
const OPEN_WITH_EQ = new Set([
  'behavior', 'body', 'draw', 'clientupdate', 'clientbehavior',
  'conditionstate', 'transitionstate', 'animationstate', 'idleanimationstate',
]);
// A single-word line without '=' opens a nested block ("WeaponSet", "AttackAreaDecal").
// "Key value" lines without '=' are fields ("AliasConditionState RIDER1", "Delay 0 800").
// Inside Campaign blocks only "Mission" opens.
const BARE_FIELD_ROOTS = new Set(['campaign', 'credits']);
// Keys with '=' whose module carries "Class Tag" after '='.
const MODULE_KEYS = new Set(['behavior', 'body', 'draw', 'clientupdate', 'clientbehavior']);

function stripComment(line) {
  let i = line.indexOf(';');
  const j = line.indexOf('//');
  if (j >= 0 && (i < 0 || j < i)) i = j;
  return i >= 0 ? line.slice(0, i) : line;
}

function* lines(text) {
  let pos = 0;
  while (pos < text.length) {
    let nl = text.indexOf('\n', pos);
    const end = nl < 0 ? text.length : nl + 1;
    let body = text.slice(pos, nl < 0 ? text.length : nl);
    if (body.endsWith('\r')) body = body.slice(0, -1);
    yield { start: pos, end, body };
    pos = end;
  }
}

class IniFile {
  constructor(text, file, blocks) { this.text = text; this.file = file; this.blocks = blocks; }
  toString() { return this.text; }
}

export function parseIni(text, file = '?') {
  const blocks = [];
  const stack = []; // open nodes
  let lineNo = 0;
  for (const ln of lines(text)) {
    lineNo++;
    const code = stripComment(ln.body).trim();
    if (!code) continue;
    if (code.startsWith('#')) continue;
    const top = stack.at(-1);
    if (/^end\b/i.test(code)) {
      if (!top) continue; // stray End at top level: tolerated
      top.end = ln.end;
      stack.pop();
      continue;
    }
    const eq = code.indexOf('=');
    if (!top) {
      if (eq >= 0) { // single-line top-level entry, e.g. "BenchProfile = ..."
        blocks.push({ type: code.slice(0, eq).trim(), name: code.slice(eq + 1).trim(), start: ln.start, end: ln.end, props: [], modules: [], file, line: lineNo, single: true });
        continue;
      }
      const [type, ...rest] = code.split(/\s+/);
      const b = { type, name: rest.join(' '), start: ln.start, end: -1, props: [], modules: [], file, line: lineNo };
      blocks.push(b); stack.push(b);
      continue;
    }
    const key = (eq >= 0 ? code.slice(0, eq) : code.split(/\s+/)[0]).trim();
    const lk = key.toLowerCase();
    const root = stack[0].type.toLowerCase();
    const single = eq < 0 && !/\s/.test(code);
    const opens = eq < 0 ? (BARE_FIELD_ROOTS.has(root) ? lk === 'mission' : single || OPEN_WITH_EQ.has(lk)) : OPEN_WITH_EQ.has(lk);
    if (opens) {
      const after = eq >= 0 ? code.slice(eq + 1).trim() : code.split(/\s+/).slice(1).join(' ');
      const parts = after ? after.split(/\s+/) : [];
      const isMod = MODULE_KEYS.has(lk);
      const m = {
        kind: key, className: isMod ? parts[0] ?? null : null, tag: isMod ? parts[1] ?? null : null,
        arg: isMod ? null : after || null,
        start: ln.start, end: -1, props: [], modules: [], line: lineNo,
      };
      top.modules.push(m); stack.push(m);
      continue;
    }
    const value = eq >= 0 ? code.slice(eq + 1).trim() : code.slice(key.length).trim();
    top.props.push({ key, value, start: ln.start, end: ln.end, bare: eq < 0 });
  }
  if (stack.length) {
    const b = stack[0];
    throw new Error(`${file}: блок «${b.type} ${b.name}» (строка ${b.line}) не закрыт словом End`);
  }
  return new IniFile(text, file, blocks);
}

const splice = (f, start, end, ins) => parseIni(f.text.slice(0, start) + ins + f.text.slice(end), f.file);
const eol = f => (f.text.includes('\r\n') ? '\r\n' : '\n');

// Locate the same node in a freshly parsed file by start offset.
const lineOf = (f, pos) => {
  const s = f.text.lastIndexOf('\n', pos - 1) + 1;
  let e = f.text.indexOf('\n', pos);
  e = e < 0 ? f.text.length : e + 1;
  return { s, e, body: f.text.slice(s, e) };
};

export function setPropAt(f, prop, value) {
  const { body } = lineOf(f, prop.start);
  const m = body.match(/^(\s*[^=]*?\s*=\s*)(.*?)(\s*(?:;|\/\/).*?)?(\r?\n)?$/s);
  const line = m[1] + value + (m[3] || '') + (m[4] || '');
  return splice(f, prop.start, prop.end, line);
}

function endLineStart(f, owner) {
  // start of the owner's End line
  return f.text.lastIndexOf('\n', owner.end - 2) + 1;
}

function childIndent(f, owner) {
  const first = owner.props[0] || owner.modules[0];
  if (first) return lineOf(f, first.start).body.match(/^\s*/)[0];
  return lineOf(f, owner.start).body.match(/^\s*/)[0] + '  ';
}

export function setProp(f, owner, key, value) {
  const p = owner.props.find(x => x.key.toLowerCase() === key.toLowerCase());
  if (p) return setPropAt(f, p, value);
  const at = endLineStart(f, owner);
  return splice(f, at, at, `${childIndent(f, owner)}${key} = ${value}${eol(f)}`);
}

export function removeProp(f, prop) { return splice(f, prop.start, prop.end, ''); }

export function removeModule(f, owner, module) {
  void owner;
  return splice(f, module.start, module.end, '');
}

export function insertModule(f, owner, moduleText) {
  const at = endLineStart(f, owner);
  let t = moduleText;
  if (!t.endsWith('\n')) t += eol(f);
  return splice(f, at, at, t);
}

export function blockText(f, node) { return f.text.slice(node.start, node.end); }

export function findModule(owner, tag) {
  for (const m of owner.modules) {
    if (m.tag && m.tag.toLowerCase() === String(tag).toLowerCase()) return m;
  }
  return null;
}

// Re-find a node (block or module) after an edit, by its identity.
export function findBlock(f, type, name) {
  return f.blocks.find(b => b.type.toLowerCase() === type.toLowerCase() && b.name.toLowerCase() === name.toLowerCase()) || null;
}
