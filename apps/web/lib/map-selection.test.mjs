import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSelection } from './map-selection.ts';

test('hospital click wins over both the raised and underlying barangay', () => {
  const polygon = { layer: { id: 'barangays' }, properties: { ADM4_PCODE: 'PH1307404001' } };
  const raised = { ...polygon, layer: { id: 'selected-raised' } };
  const hospital = { layer: { id: 'hospital-dot' }, properties: { id: 'HOSP-659' } };
  for (const hits of [[polygon, hospital], [raised, polygon, hospital], [hospital, raised]]) {
    assert.deepEqual(mapSelection(hits), { kind: 'hospital', id: 'HOSP-659' });
  }
  assert.deepEqual(mapSelection([raised, polygon]), { kind: 'barangay', id: 'PH1307404001' });
  assert.equal(mapSelection([]), null);
  assert.equal(mapSelection([{ layer: { id: 'hospital-dot' }, properties: null }]), null);
  const hotspot = { layer: { id: 'hotspot-dot' }, properties: { id: 'PH1307404002' } };
  assert.deepEqual(mapSelection([polygon, hotspot]), { kind: 'barangay', id: 'PH1307404002' });
  assert.deepEqual(mapSelection([polygon, hotspot, hospital]), { kind: 'hospital', id: 'HOSP-659' });
});
