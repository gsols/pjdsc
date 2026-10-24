export type Area = 'NCR' | 'QUEZON_CITY' | string;
export interface Facility {
  id: string;
  name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  accreditedBeds: number;
  authorizedBeds: null;
  implementedBeds: null;
  normalStaffedCapacity: null;
  dengueUsableBeds: null;
  dengueInpatientEligible: null;
  sourceAsOf: string;
  primarySourceUrl: string;
  address: string;
  ownership: string;
  philHealthCategory: string;
  coordinateStatus: 'UNAVAILABLE' | 'PROVISIONAL_HISTORICAL_MATCH' | 'VERIFIED';
  coordinateEvidenceStatus: string;
  coordinateSourceUrl: string;
  coordinateQualityNote: string;
  coordinateIsVerifiedEntrance: false;
  coordinateVerifiedAt: null;
}
export interface FacilityResult {
  facilityId: string;
  week: number;
  availablePct: number | null;
  capacityGap: number | null;
  note: string;
}
export interface ScenarioResult {
  scenarioId: string;
  area: string;
  weeks: number;
  parameters: {
    hospitalizationRate: number;
    lengthOfStayDays: number;
    baselineOccupancy: number;
    surgeMultiplier: number;
  };
  facilityResults: FacilityResult[];
  disclaimer: string;
}
