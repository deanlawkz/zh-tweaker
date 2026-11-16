// Unit icons: MappedImage -> TGA crop -> PNG.
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function decodeTga(buf) {
  const idLen = buf[0], cmapType = buf[1], type = buf[2];
  const cmapLen = buf.readUInt16LE(5), cmapDepth = buf[7];
  const w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
  if (type !== 2 && type !== 10) throw new Error(`TGA тип ${type} не поддерживается`);
  if (bpp !== 24 && bpp !== 32) throw new Error(`TGA ${bpp} бит не поддерживается`);
  const bytes = bpp / 8;
  let p = 18 + idLen + (cmapType ? cmapLen * Math.ceil(cmapDepth / 8) : 0);
  const n = w * h;
  const raw = Buffer.alloc(n * 4);
  const put = (i, q) => {
    raw[i * 4] = buf[q + 2]; raw[i * 4 + 1] = buf[q + 1]; raw[i * 4 + 2] = buf[q];
    raw[i * 4 + 3] = bytes === 4 ? buf[q + 3] : 255;
  };
  if (type === 2) {
    for (let i = 0; i < n; i++, p += bytes) put(i, p);
  } else {
    let i = 0;
    while (i < n) {
      const hdr = buf[p++], count = (hdr & 0x7f) + 1;
      if (hdr & 0x80) { for (let k = 0; k < count; k++) put(i++, p); p += bytes; }
      else { for (let k = 0; k < count; k++, p += bytes) put(i++, p); }
    }
  }
  const topDown = (desc & 0x20) !== 0;
  if (topDown) return { w, h, data: raw };
  const data = Buffer.alloc(n * 4);
  for (let y = 0; y < h; y++) raw.copy(data, y * w * 4, (h - 1 - y) * w * 4, (h - y) * w * 4);
  return { w, h, data };
}

export function crop(img, l, t, r, b) {
  l = Math.max(0, l); t = Math.max(0, t); r = Math.min(img.w, r); b = Math.min(img.h, b);
  const w = r - l, h = b - t, data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(data, y * w * 4, ((t + y) * img.w + l) * 4, ((t + y) * img.w + r) * 4);
  return { w, h, data };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng({ w, h, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

let _placeholder;
export function placeholderPng() {
  return _placeholder ||= encodePng({ w: 60, h: 48, data: Buffer.alloc(60 * 48 * 4).fill(Buffer.from([60, 64, 72, 255])) });
}

const texCache = new Map();
function texture(vfs, name) {
  const base = name.toLowerCase().replace(/\.(tga|dds)$/, '');
  if (texCache.has(base)) return texCache.get(base);
  let img = null;
  for (const d of ['data\\english\\art\\textures\\', 'art\\textures\\']) {
    if (vfs.has(d + base + '.tga')) { try { img = decodeTga(vfs.read(d + base + '.tga')); } catch { img = null; } break; }
  }
  texCache.set(base, img);
  return img;
}

export function iconFromMappedImage(db, vfs, imageName) {
  const mi = db.get('MappedImage', imageName);
  if (!mi) return null;
  const get = k => mi.block.props.find(p => p.key.toLowerCase() === k)?.value;
  const tex = get('texture'), coords = get('coords');
  if (!tex || !coords) return null;
  const img = texture(vfs, tex);
  if (!img) return null;
  const c = Object.fromEntries([...coords.matchAll(/(\w+):\s*(-?\d+)/g)].map(m => [m[1].toLowerCase(), +m[2]]));
  // Coords are given for TextureWidth x TextureHeight; scale if the real texture differs.
  const tw = +(get('texturewidth') || img.w), th = +(get('textureheight') || img.h);
  const sx = img.w / tw, sy = img.h / th;
  const part = crop(img, Math.round(c.left * sx), Math.round(c.top * sy), Math.round(c.right * sx), Math.round(c.bottom * sy));
  if (part.w <= 0 || part.h <= 0) return null;
  return encodePng(part);
}

export async function iconPng(db, vfs, objName, size) {
  const base = objName.startsWith('Cmdr_') ? objName.slice(5) : objName;
  const dir = join(process.env.ZHT_DIR || (await import('./paths.js')).TWEAKER_DIR, 'cache', 'icons');
  const file = join(dir, `${base}-${size}.png`);
  if (existsSync(file)) return readFileSync(file);
  const key = size === 'portrait' ? 'SelectPortrait' : 'ButtonImage';
  const imageName = db.prop('Object', base, key);
  if (!imageName) return null;
  const png = iconFromMappedImage(db, vfs, imageName);
  if (!png) return null;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, png);
  return png;
}
