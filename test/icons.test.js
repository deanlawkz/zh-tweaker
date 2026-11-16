import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeTga, encodePng, crop, iconPng, placeholderPng } from '../src/icons.js';
import { Vfs } from '../src/big.js';
import { loadGameDb } from '../src/gamedb.js';
import { GAME_ZH, GAME_GEN } from '../src/paths.js';
import { hasGame, tmp } from './helpers.js';

function tga({ type = 2, bpp = 32, top = false, w = 2, h = 2, pixels }) {
  const head = Buffer.alloc(18);
  head[2] = type; head.writeUInt16LE(w, 12); head.writeUInt16LE(h, 14); head[16] = bpp; head[17] = top ? 0x20 : 0;
  return Buffer.concat([head, Buffer.from(pixels)]);
}

test('TGA 32 бит снизу вверх: верхний левый пиксель — из последней строки файла', () => {
  // BGRA, rows bottom-up: row0 (bottom) red,red ; row1 (top) blue, green
  const img = decodeTga(tga({ pixels: [0,0,255,255, 0,0,255,255, 255,0,0,255, 0,255,0,255] }));
  assert.deepEqual([...img.data.subarray(0, 4)], [0, 0, 255, 255]); // top-left = blue (RGBA)
  assert.deepEqual([...img.data.subarray(12, 16)], [255, 0, 0, 255]); // bottom-right = red
});

test('TGA RLE 24 бит', () => {
  // one RLE packet of 4 pixels, color BGR(10,20,30)
  const img = decodeTga(tga({ type: 10, bpp: 24, top: true, pixels: [0x83, 10, 20, 30] }));
  assert.deepEqual([...img.data.subarray(12, 16)], [30, 20, 10, 255]);
});

test('PNG: сигнатура и размер', () => {
  const p = encodePng(crop({ w: 4, h: 4, data: Buffer.alloc(64, 200) }, 1, 1, 3, 4));
  assert.equal(p.toString('latin1', 1, 4), 'PNG');
  assert.equal(p.readUInt32BE(16), 2); assert.equal(p.readUInt32BE(20), 3);
  assert.equal(placeholderPng().readUInt32BE(16), 60);
});

test('иконки реальных объектов', { skip: !hasGame }, async () => {
  process.env.ZHT_DIR = tmp();
  const vfs = await Vfs.open([GAME_ZH, GAME_GEN]);
  const db = await loadGameDb(vfs);
  const p = await iconPng(db, vfs, 'AmericaVehicleHumvee', 'button');
  assert.equal(p.readUInt32BE(16), 60); assert.equal(p.readUInt32BE(20), 48);
  assert.ok(await iconPng(db, vfs, 'Cmdr_AmericaVehicleHumvee', 'button'));
  const por = await iconPng(db, vfs, 'AmericaVehicleHumvee', 'portrait');
  assert.equal(por.readUInt32BE(16), 120); assert.equal(por.readUInt32BE(20), 96);
  assert.equal(await iconPng(db, vfs, 'NoSuchObject', 'button'), null);
  assert.equal(await iconPng(db, vfs, 'GenericTree', 'button'), null);
});
