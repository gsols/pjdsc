import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseBand, caseColor, interpolateCaseValues, addDateDays } from './case-bands.ts';

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

test('forecast colors change smoothly inside a display band and across the full window scale', () => {
  assert.notEqual(caseColor(2, 50), caseColor(4, 50));
  assert.notEqual(caseColor(100, 1000), caseColor(500, 1000));
  assert.equal(caseColor(1000, 1000), '#ed645b');
  assert.equal(caseColor(5000, 1000), '#ed645b');
  for (const args of [[NaN, 1], [-1, 50], [1, 0], [1, Infinity]]) assert.throws(() => caseColor(...args));
  const start = new Map([['A', 0], ['B', 10]]), target = new Map([['A', 10], ['B', 2]]);
  assert.deepEqual([...interpolateCaseValues(start, target, .5)], [['A', 5], ['B', 6]]);
  assert.deepEqual(interpolateCaseValues(start, target, 1), target);
  assert.deepEqual([...start], [['A', 0], ['B', 10]]);
});
