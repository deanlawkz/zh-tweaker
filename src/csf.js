// generals.csf string table: read and append labels.
const HDR = 24;

export function readCsf(buf) {
  if (buf.toString('latin1', 0, 4) !== ' FSC') throw new Error('Не CSF-файл');
  const n = buf.readInt32LE(8);
  const out = new Map();
  let p = HDR;
  for (let i = 0; i < n; i++) {
    if (buf.toString('latin1', p, p + 4) !== ' LBL') throw new Error(`CSF: ожидалась метка на ${p}`);
    const pairs = buf.readInt32LE(p + 4);
    const llen = buf.readInt32LE(p + 8);
    const label = buf.toString('latin1', p + 12, p + 12 + llen);
    p += 12 + llen;
    let value = '';
    for (let k = 0; k < pairs; k++) {
      const tag = buf.toString('latin1', p, p + 4);
      const len = buf.readInt32LE(p + 4);
      const raw = Buffer.from(buf.subarray(p + 8, p + 8 + len * 2));
      for (let j = 0; j < raw.length; j++) raw[j] = ~raw[j] & 0xff;
      if (k === 0) value = raw.toString('utf16le');
      p += 8 + len * 2;
      if (tag === 'WRTS') { const el = buf.readInt32LE(p); p += 4 + el; }
    }
    out.set(label.toLowerCase(), value);
  }
  return out;
}

function encodeLabel(label, value) {
  const lb = Buffer.from(label, 'latin1');
  const vb = Buffer.from(value, 'utf16le');
  for (let j = 0; j < vb.length; j++) vb[j] = ~vb[j] & 0xff;
  const head = Buffer.alloc(12);
  head.write(' LBL', 0, 'latin1'); head.writeInt32LE(1, 4); head.writeInt32LE(lb.length, 8);
  const rts = Buffer.alloc(8);
  rts.write(' RTS', 0, 'latin1'); rts.writeInt32LE(value.length, 4);
  return Buffer.concat([head, lb, rts, vb]);
}

export function writeCsf(original, add) {
  const existing = readCsf(original);
  const parts = [];
  let labels = 0;
  for (const [k, v] of add) {
    if (existing.has(k.toLowerCase())) continue;
    parts.push(encodeLabel(k, v)); labels++;
  }
  const out = Buffer.concat([original, ...parts]);
  out.writeInt32LE(original.readInt32LE(8) + labels, 8);
  out.writeInt32LE(original.readInt32LE(12) + labels, 12);
  return out;
}

export function emptyCsf() {
  const b = Buffer.alloc(HDR);
  b.write(' FSC', 0, 'latin1'); b.writeInt32LE(3, 4);
  return b;
}
