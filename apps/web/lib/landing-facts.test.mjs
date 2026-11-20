import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDING_FACTS, formatCount } from './landing-facts.ts';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('landing hospital figures match the active PhilHealth QC register', () => {
  const hospitals = read('../public/data/qc-philhealth-hospitals.json');
  assert.equal(LANDING_FACTS.hospitals, hospitals.length);
  assert.equal(LANDING_FACTS.accreditedBeds, hospitals.reduce((sum, h) => sum + h.accreditedBeds, 0));
  // The page calls the date "30 Sep 2026": every row must cite that register extract.
  assert.ok(hospitals.every(h => h.accreditedBedsSource.endsWith('HOSP_093026.pdf')));
  // The page says hospital points are provisional: none may be verified entrances.
  assert.ok(hospitals.every(h => h.coordinateStatus !== 'VERIFIED'));
});

test('landing barangay figures match the observed annual burden file', () => {
  const burden = read('../public/data/qc-annual-burden.json');
  assert.equal(burden.measurementKind, 'observed');
  assert.equal(LANDING_FACTS.barangays, burden.records.length);
  const years = Object.keys(burden.records[0])
    .filter(key => /^DC_\d{4}$/.test(key))
    .map(key => Number(key.slice(3)));
  assert.equal(LANDING_FACTS.firstYear, Math.min(...years));
  assert.equal(LANDING_FACTS.lastYear, Math.max(...years));
});

test('landing page never hard-codes copies of the checked figures', () => {
  // Home shows no figures at the moment; if it does again, they must come from LANDING_FACTS.
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  for (const literal of ['9,389', '9389', '>46<', '>142<']) assert.ok(!page.includes(literal), `hard-coded ${literal}`);
  assert.equal(formatCount(LANDING_FACTS.accreditedBeds), '9,389');
});
