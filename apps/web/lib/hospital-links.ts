type HospitalLink = { facilityId: string; distanceKm: number };

/** Display links only: containment and distances are supplied by the engine. */
export function hospitalConnections(area: { nearestHospitals: HospitalLink[]; hospitalsWithinBarangay?: HospitalLink[] }) {
  const links = [...area.nearestHospitals.slice(0, 1), ...(area.hospitalsWithinBarangay ?? [])];
  return [...new Map(links.map(link => [link.facilityId, link])).values()];
}
