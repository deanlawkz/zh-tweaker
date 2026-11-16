import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAME_ZH } from '../src/paths.js';

export const hasGame = existsSync(join(GAME_ZH, 'INIZH.big'));
export const tmp = () => mkdtempSync(join(tmpdir(), 'zht-'));

// Builds a BIGF archive from [{name, data}]
export function makeBig(file, entries) {
  const bufs = entries.map(e => Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'latin1'));
  let headerSize = 16;
  for (const e of entries) headerSize += 8 + Buffer.byteLength(e.name, 'latin1') + 1;
  const head = Buffer.alloc(headerSize);
  head.write('BIGF', 0, 'latin1');
  const total = headerSize + bufs.reduce((a, b) => a + b.length, 0);
  head.writeUInt32LE(total, 4);
  head.writeUInt32BE(entries.length, 8);
  head.writeUInt32BE(headerSize, 12);
  let pos = 16, off = headerSize;
  entries.forEach((e, i) => {
    head.writeUInt32BE(off, pos); head.writeUInt32BE(bufs[i].length, pos + 4); pos += 8;
    pos += head.write(e.name + '\0', pos, 'latin1');
    off += bufs[i].length;
  });
  writeFileSync(file, Buffer.concat([head, ...bufs]));
}
