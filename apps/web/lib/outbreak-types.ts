export interface MovieHospital {
  id: string; name: string; coordinates: [number, number]; coordinateStatus: string;
  coordinateSourceUrl: string; sourceAsOf: string; dengueInpatientEligible: null;
  accreditedBeds: number; normalStaffedCapacity: null; dengueUsableBeds: null;
  primarySourceUrl: string;
}
export interface MovieBarangay {
  id: string; name: string; coordinates: [number, number]; weight: number;
  observedAnnualCases: number;
  nearestHospitals: { facilityId: string; distanceKm: number }[];
}
export interface MovieContext {
  referenceForecastRunId: string; weightYear: number; distanceMethod: string;
  barangays: MovieBarangay[]; hospitals: MovieHospital[];
}
export interface MovieParameters {
  forecastRunId: string; scenarioKind: 'hypothetical_shock' | 'historical_replay'; acknowledgeHypotheticalHospitalNetwork: true;
  autoHotspots?: boolean; allocationPolicy?: 'nearest' | 'optimized';
  acknowledgeHypotheticalDates: true; startDate: string; endDate: string; seedBarangayId: string;
  extraCasesPerWeek: number; initialRadiusKm: number; expansionKmPerDay: number; growthDays: number;
  shockProfile: 'step' | 'ramp'; hospitalizationRate: number; lengthOfStayDays: number;
  baselineOccupancy: number; admissionDelayDays: number; surgeActivationDay: number;
  facilities: { facilityId: string; assumedDengueEligible: true; normalCapacity: number; surgeCapacity: number; holdingCapacity: number }[];
}
export interface MovieDay {
  dayIndex: number; date: string; snapshotAt: string; intervalStart: string; intervalEnd: string;
  expectedCases: number; baselineCases: number; shockCases: number; cumulativeCases: number;
  cumulativeBaselineCases: number; cumulativeShockCases: number; assumedRadiusKm: number;
  arrivals: number; discharges: number; supportedCensus: number; holdingCensus: number;
  cumulativeArrivals: number; cumulativeDischarges: number; cumulativeUnresolved: number; balanceError: number;
  hotspotIds: string[];
  expansionRing: [number, number][];
  caseRange?: CaseRange; dailyCaseRange?: Pick<CaseRange, 'lowerCases' | 'upperCases'>;
  bedForecast?: BedForecast;
  barangays: { barangayId: string; expectedCases: number; baselineCases: number; shockCases: number; cumulativeCases: number; caseRange?: Pick<CaseRange, 'lowerCases' | 'upperCases'> }[];
  assignments: { barangayId: string; facilityId: string; supportedPlacements: number; holdingPlacements: number; distanceKm: number }[];
  facilities: { facilityId: string; normalCapacity: number; activatedSurgeCapacity: number; supportedCensus: number;
    bedForecast?: BedForecast;
    supportedCapacity: number; remainingSupportedCapacity: number; assumedNonDengueCensus: number;
    normalDengueCensus: number; surgeDengueCensus: number; holdingCensus: number; normalOccupancyPct: number; supportedOccupancyPct: number }[];
}
export interface BedForecast {
  expectedBeds: number; lowerBeds: number | null; upperBeds: number | null;
  staffedBedsRequired: number; lowerStaffedBedsRequired: number | null; upperStaffedBedsRequired: number | null;
  assumedSupportedDengueCapacity: number; additionalStaffedBedsNeeded: number; additionalBedsUpperScenario: number | null;
  rangeKind: string;
}
export interface BedProjection extends BedForecast {
  peakDate: string; peakDayIndex: number; peakLowerStaffedBedsRequired: number | null; peakUpperStaffedBedsRequired: number | null;
  peakAdditionalStaffedBedsNeeded: number; initialCensusAssumption: string;
  hospitalPeaks: { facilityId: string; peakStaffedBedsRequired: number }[];
}
export interface CaseRange { lowerCases: number; upperCases: number; coverageTarget: number; calibrationSamples: number; method: string }
export interface QCControls {
  startDate: string; endDate: string; mode: 'forecast' | 'hypothetical_shock'; extraCasesPerWeek: number;
  growthDays: number; normalCapacity: number; surgeCapacity: number; holdingCapacity: number;
  hospitalizationRate: number; baselineOccupancy: number; lengthOfStayDays: number;
  admissionDelayDays: number; surgeActivationDay: number; acknowledgeAssumedCapacity: true;
  allocationPolicy: 'nearest' | 'optimized'; compareAllocation: boolean;
  horizonDays?: number; weatherProfile?: 'typical' | 'wetter' | 'drier' | 'hotter';
  surgeEnabled?: boolean; surgeOnsetDay?: number; surgeMultiplier?: number;
}
export interface QCWorkspaceResult extends OutbreakMovie {
  workspaceTab?: 'future' | 'historical';
  controlValues: QCControls; inputLimits: Record<string, { min: number; max: number; units: string }>;
  forecastEvidence: { id: string; issueBlock: { YR: number; WN: number }; model: string;
    environmentalInputs: { sourceColumn: string; valueAtOrigin: number; unit: string; lagsSourceBlocks: number[] }[];
    observedCasesAtOrigin: number; observedSourceYearToDateCases: number; intervalCoverageTarget: number;
    intervalCaveat: string; spatialCaveat: string; availabilityAssumption: string };
  periodSummary: { expectedCases: number; caseRange: CaseRange; barangays: MovieDay['barangays'] };
  forecastBacktest: { horizon: number; n: number; weatherMae: number; casesOnlyMae: number; persistenceMae: number; empiricalRangeCoverage: number }[];
  referenceSelectionAssumption: string; rangeInterpretation: string; simulationResultSha256: string;
  futureForecast?: { asOfDate: string; trainingCutoffBlock: { YR: number; WN: number }; weatherProfile: string;
    selectedModel: string; modelSha256: string; methodVersion: string;
    selection: { criterion: string; scores: Record<string, number> };
    validation: { year: number; model: string; n: number; mae: number; rmse: number; empiricalRangeCoverage: number }[];
    stalenessCaveat: string; weatherCaveat: string };
  allocationComparison?: { nearest: AllocationMetrics; optimized: AllocationMetrics; caveat: string };
}
export interface AllocationMetrics { cumulativeUnresolved: number; holdingCensus: number; maxNormalOccupancyPct: number; expectedPatientKm: number }
export interface OutbreakMovie {
  schemaVersion: string; scenarioId: string; resultSha256: string; runTimestamp: string;
  parameters: MovieParameters; context: MovieContext; days: MovieDay[]; durationDays: number;
  mapScaleMaxDailyCases: number; assumptions: string; disclaimer: string;
  bedProjection?: BedProjection;
}
