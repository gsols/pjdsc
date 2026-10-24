type Hit = { layer: { id: string }; properties: Record<string, unknown> | null };

/** Hospital markers take priority over the polygon beneath them. */
export function mapSelection(hits: Hit[]): { kind: 'hospital' | 'barangay'; id: string } | null {
  const hospital = hits.find(hit => hit.layer.id === 'hospital-dot' && hit.properties?.id);
  if (hospital) return { kind: 'hospital', id: String(hospital.properties!.id) };
  const hotspot = hits.find(hit => hit.layer.id === 'hotspot-dot' && hit.properties?.id);
  if (hotspot) return { kind: 'barangay', id: String(hotspot.properties!.id) };
  const barangay = hits.find(hit => ['barangays', 'selected-raised'].includes(hit.layer.id) && hit.properties?.ADM4_PCODE);
  return barangay ? { kind: 'barangay', id: String(barangay.properties!.ADM4_PCODE) } : null;
}
