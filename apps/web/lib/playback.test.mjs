import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPlaybackDay, validateDateWindow, formatScenarioDate } from './playback.ts';
test('playback reaches day endpoints and stops at the actual scenario duration', () => {
  for (const day of [0, 6, 13, 27]) assert.equal(nextPlaybackDay(day, 28), day + 1);
  assert.equal(nextPlaybackDay(28, 28), 28);
  assert.equal(nextPlaybackDay(7, 7), 7);
});
test('QC dates preserve elapsed days across calendar/year boundaries', () => {
  assert.equal(validateDateWindow('2024-12-25', '2025-01-22'), null);
  assert.equal(validateDateWindow('2025-01-27', '2025-02-24'), null);
  assert.ok(validateDateWindow('2025-01-27', '2025-01-27'));
  assert.ok(validateDateWindow('2025-01-27', '2025-02-25'));
  assert.ok(validateDateWindow('', ''));
  assert.match(formatScenarioDate('2025-02-03'), /Feb.*3.*2025/);
});
