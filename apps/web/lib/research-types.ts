export interface ResearchRun {
  id: string; area: string; issueBlock: { YR: number; WN: number };
  sourceSha256: string; availabilityAssumption: string;
  weeklyPredictions: { YR: number; WN: number; meanCases: number; observedCases: number }[];
}
export interface AnnualRecord { ADM4_PCODE: string; Barangay: string; [key: string]: string | number | null }
export interface SpatialResult {
  weightYear: number; caveat: string;
  records: { ADM4_PCODE: string; weight: number; expectedCases: number[] }[];
}
export interface ResearchScenario {
  scenarioId: string; disclaimer: string; assumptions: string;
  days: { dayIndex: number; arrivals: number; cumulativeArrivals: number; cumulativeDischarges: number;
    cumulativeUnresolved: number; supportedCensus: number; holdingCensus: number;
    facilities: { facilityId: string; normalOccupancyPct: number; supportedOccupancyPct: number;
      surgeDengueCensus: number; holdingCensus: number }[] }[];
}
