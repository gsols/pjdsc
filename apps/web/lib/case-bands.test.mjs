import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseBand, addDateDays } from './case-bands.ts';

test('specific case display bands preserve all boundaries without labeling official outbreak thresholds', () => {
  for (const [count, label] of [[0, '0–<5'], [4.99, '0–<5'], [5, '5–<10'], [10, '10–<25'], [25, '25–<50'], [50, '50+'], [2000, '50+']])
    assert.equal(caseBand(count).label, label);
  for (const invalid of [-1, NaN, Infinity]) assert.throws(() => caseBand(invalid));
});
test('7/14/28 day windows preserve local display dates across month/year and leap boundaries', () => {
  assert.equal(addDateDays('2025-01-29', 7), '2025-02-05');
  assert.equal(addDateDays('2025-01-29', 14), '2025-02-12');
  assert.equal(addDateDays('2025-01-29', 28), '2025-02-26');
  assert.equal(addDateDays('2024-02-25', 7), '2024-03-03');
  assert.equal(addDateDays('2024-12-25', 14), '2025-01-08');
});
