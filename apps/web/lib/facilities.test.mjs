import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { adaptFacilities, FACILITY_SHA256 } from './facilities.ts';
const raw = readFileSync(new URL('../public/data/qc-philhealth-hospitals.json', import.meta.url));
const records = JSON.parse(raw);
const geometry = JSON.parse(readFileSync(new URL('../public/data/ncr-cities.geojson', import.meta.url))).features.find(f => f.properties.area_id === 'QUEZON_CITY').geometry;

test('canonical version, QC scope, bed meaning, provisional adaptation', () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), FACILITY_SHA256);
  const result = adaptFacilities(records, geometry);
  assert.equal(result.length, 46);
  assert.equal(result.reduce((s, f) => s + f.accreditedBeds, 0), 9389);
  assert.ok(result.every(f => f.coordinateStatus === 'PROVISIONAL_HISTORICAL_MATCH' && f.normalStaffedCapacity === null && f.dengueInpatientEligible === null));
  assert.ok(result.some(f => f.coordinateEvidenceStatus === 'PROVISIONAL_OSM'));
  assert.ok(result.some(f => f.coordinateEvidenceStatus === 'PROVISIONAL_THIRD_PARTY'));
});
test('missing, corrupt, duplicate, out-of-QC, operational claims rejected', () => {
  for (const value of [null, [], records.slice(1)]) assert.throws(() => adaptFacilities(value, geometry));
  for (const [key, value] of [['id', 'HOSP-615'], ['longitude', 0], ['latitude', NaN], ['coordinateStatus', 'VERIFIED'], ['accreditedBeds', -1], ['normalStaffedCapacity', 100], ['coordinateSourceUrl', ''], ['dengueInpatientEligible', true]]) {
    const fixture = structuredClone(records);
    fixture[0][key] = value;
    assert.throws(() => adaptFacilities(fixture, geometry));
  }
});
test('dashboard never reads legacy source or sends browser facility facts', () => {
  const page = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.ok(!page.includes('/data/facilities.json'));
  assert.ok(!page.includes('          facilities,'));
  assert.ok(page.includes('disabled={true}'));
  assert.ok(page.includes('Hospital table / map fallback'));
});
import { loadFacilities } from './facilities.ts';
test('browser loader rejects missing/corrupt registry without NHFR fallback', async () => {
  const original = globalThis.fetch;
  const paths = [];
  try {
    globalThis.fetch = async url => { paths.push(url); return new Response('', { status: 503 }); };
    await assert.rejects(loadFacilities(), /unavailable/);
    assert.deepEqual(paths.sort(), ['/api/boundaries', '/data/qc-philhealth-hospitals.json'].sort());
    globalThis.fetch = async url => new Response(url === '/api/boundaries' ? JSON.stringify({ features: [] }) : '[]');
    await assert.rejects(loadFacilities(), /checksum mismatch/);
    globalThis.fetch = async url => new Response(url === '/api/boundaries' ? readFileSync(new URL('../public/data/ncr-cities.geojson', import.meta.url)) : raw);
    assert.equal((await loadFacilities()).length, 46);
  } finally { globalThis.fetch = original; }
});
