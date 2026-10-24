import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hospitalConnections } from './hospital-links.ts';

test('all hospitals inside a barangay remain linked alongside the nearest outside site', () => {
  const link = (facilityId, distanceKm) => ({ facilityId, distanceKm });
  const nearest = link('HOSP-614', .2);
  const inside = [link('HOSP-626', .5), link('HOSP-627', .8), link('HOSP-659', 1.2)];
  assert.deepEqual(hospitalConnections({ nearestHospitals: [nearest], hospitalsWithinBarangay: inside }), [nearest, ...inside]);
  assert.deepEqual(hospitalConnections({ nearestHospitals: [inside[0]], hospitalsWithinBarangay: inside }), inside);
  assert.deepEqual(hospitalConnections({ nearestHospitals: [nearest], hospitalsWithinBarangay: [] }), [nearest]);
  assert.deepEqual(hospitalConnections({ nearestHospitals: [], hospitalsWithinBarangay: [] }), []);
});
