import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { patchCamera, SAGE_FILE } from '../src/tweaks.js';
import { applyOutput, resetOutput } from '../src/output.js';

const SAGE = 'GameData\r\n  ; comment\r\n  MaxCameraHeight = 350.0\r\n  MinCameraHeight = 100.0\r\nEnd\r\n';

test('patchCamera меняет высоту в SagePatch и не трогает остальное', () => {
  const t = patchCamera(SAGE, 690);
  assert.match(t, /MaxCameraHeight = 690\.0/);
  assert.doesNotMatch(t, /350/);
  assert.match(t, /MinCameraHeight = 100\.0/);
});

test('patchCamera без строки дописывает её, без файла создаёт блок', () => {
  assert.match(patchCamera('GameData\r\n  UseFPSLimit = Yes\r\nEnd\r\n', 500), /UseFPSLimit = Yes\r\n  MaxCameraHeight = 500\.0\r\nEnd/);
  assert.equal(patchCamera(null, 500), 'GameData\r\n  MaxCameraHeight = 500.0\r\nEnd\r\n');
});

test('SagePatch пишется в папку настроек и возвращается при сбросе', async () => {
  const game = mkdtempSync(join(tmpdir(), 'zht-g-')), tw = mkdtempSync(join(tmpdir(), 'zht-t-')), user = mkdtempSync(join(tmpdir(), 'zht-u-'));
  writeFileSync(join(user, 'SagePatch.ini'), SAGE);
  await applyOutput(new Map([[SAGE_FILE, patchCamera(SAGE, 690)]]), { gameDir: game, tweakerDir: tw, userDir: user });
  assert.match(readFileSync(join(user, 'SagePatch.ini'), 'latin1'), /690/);
  assert.ok(!existsSync(join(game, '@user')));
  await resetOutput({ gameDir: game, tweakerDir: tw, userDir: user });
  assert.equal(readFileSync(join(user, 'SagePatch.ini'), 'latin1'), SAGE);
});
