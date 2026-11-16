// Read-only access to C&C Generals BIG archives (BIGF / BIG4).
import { openSync, readSync, closeSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const norm = name => name.replace(/\//g, '\\').toLowerCase();

export function readBigIndex(file) {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    readSync(fd, head, 0, 16, 0);
    const magic = head.toString('latin1', 0, 4);
    if (magic !== 'BIGF' && magic !== 'BIG4') throw new Error(`Не архив BIG: ${file}`);
    const count = head.readUInt32BE(8);
    const headerSize = head.readUInt32BE(12);
    const buf = Buffer.alloc(headerSize);
    readSync(fd, buf, 0, headerSize, 0);
    const out = [];
    let p = 16;
    for (let i = 0; i < count; i++) {
      const offset = buf.readUInt32BE(p), size = buf.readUInt32BE(p + 4);
      p += 8;
      const end = buf.indexOf(0, p);
      out.push({ name: buf.toString('latin1', p, end), offset, size });
      p = end + 1;
    }
    return out;
  } finally { closeSync(fd); }
}

export function writeBig(file, entries) {
  let headerSize = 16;
  for (const e of entries) headerSize += 8 + Buffer.byteLength(e.name, 'latin1') + 1;
  const head = Buffer.alloc(headerSize);
  head.write('BIGF', 0, 'latin1');
  const total = headerSize + entries.reduce((a, e) => a + e.data.length, 0);
  head.writeUInt32LE(total, 4);
  head.writeUInt32BE(entries.length, 8);
  head.writeUInt32BE(headerSize, 12);
  let pos = 16, off = headerSize;
  for (const e of entries) {
    head.writeUInt32BE(off, pos); head.writeUInt32BE(e.data.length, pos + 4); pos += 8;
    pos += head.write(e.name + '\0', pos, 'latin1');
    off += e.data.length;
  }
  writeFileSync(file, Buffer.concat([head, ...entries.map(e => e.data)]));
}

export class Vfs {
  constructor() { this.map = new Map(); }

  static async open(dirs) {
    const v = new Vfs();
    for (const dir of dirs) {
      let names;
      try { names = readdirSync(dir); } catch { continue; }
      const bigs = names.filter(n => n.toLowerCase().endsWith('.big')).sort();
      for (const b of bigs) {
        const file = join(dir, b);
        if (!statSync(file).isFile()) continue;
        for (const e of readBigIndex(file)) {
          const key = norm(e.name);
          if (!v.map.has(key)) v.map.set(key, { file, offset: e.offset, size: e.size, name: e.name });
        }
      }
    }
    return v;
  }

  has(name) { return this.map.has(norm(name)); }
  sourceOf(name) { return this.map.get(norm(name))?.file; }
  list(prefix) {
    const p = norm(prefix);
    return [...this.map.keys()].filter(k => k.startsWith(p)).sort();
  }
  read(name) {
    const e = this.map.get(norm(name));
    if (!e) throw new Error(`Нет файла в архивах: ${name}`);
    const fd = openSync(e.file, 'r');
    try {
      const buf = Buffer.alloc(e.size);
      readSync(fd, buf, 0, e.size, e.offset);
      return buf;
    } finally { closeSync(fd); }
  }
}
