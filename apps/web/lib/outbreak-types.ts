export interface MovieHospital {
  id: string; name: string; coordinates: [number, number]; coordinateStatus: string;
  coordinateSourceUrl: string; sourceAsOf: string; dengueInpatientEligible: null;
  accreditedBeds: number; normalStaffedCapacity: null; dengueUsableBeds: null;
  primarySourceUrl: string;
}
export interface MovieBarangay {
  id: string; name: string; coordinates: [number, number]; weight: number;
  observedAnnualCases: number | null;
  predictedAnnualCases?: number | null; burdenRank?: number | null; isHighBurdenCandidate?: boolean;
  nearestHospitals: { facilityId: string; distanceKm: number }[];
  hospitalsWithinBarangay?: { facilityId: string; distanceKm: number }[];
}
export interface MovieContext {
  hotspotRanking?: { model: string; forecastYear: number; trainingCutoffYear: number; criterion: string;
    artifactSha256: string; candidateIds: string[]; limitations: string;
    validation: { targetYear: number; model: string; n: number; maeAnnualCases: number; top10Overlap: number; topCount: number }[] } | null;
  referenceForecastRunId: string; weightYear: number; distanceMethod: string;
  barangays: MovieBarangay[]; hospitals: MovieHospital[];
}
export interface MovieParameters {
  forecastRunId: string; scenarioKind: 'hypothetical_shock' | 'historical_replay'; acknowledgeHypotheticalHospitalNetwork: true;
  autoHotspots?: boolean; allocationPolicy?: 'nearest' | 'optimized';
  arrivalSplitPolicy?: 'nearest' | 'nearest_three_equal';
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
    nearestHotspot?: { barangayId: string; distanceKm: number } | null;
    bedForecast?: BedForecast;
    supportedCapacity: number; remainingSupportedCapacity: number; assumedNonDengueCensus: number;
    normalDengueCensus: number; surgeDengueCensus: number; holdingCensus: number; normalOccupancyPct: number; supportedOccupancyPct: number }[];
}
export interface BedForecast {
  demandUtilizationPct?: number | null; utilizationDefinition?: string;
  baselineExpectedBeds?: number; baselineStaffedBedsRequired?: number; additionalStaffedBedsDueToSurge?: number;
  expectedBeds: number; lowerBeds: number | null; upperBeds: number | null;
  staffedBedsRequired: number; lowerStaffedBedsRequired: number | null; upperStaffedBedsRequired: number | null;
  assumedSupportedDengueCapacity: number; additionalStaffedBedsNeeded: number; additionalBedsUpperScenario: number | null;
  rangeKind: string;
}
export interface BedProjection extends BedForecast {
  peakDemandUtilizationPct?: number | null;
  baselinePeakStaffedBedsRequired?: number; peakAdditionalStaffedBedsDueToSurge?: number;
  arrivalSplitPolicy?: 'nearest' | 'nearest_three_equal';
  placePeaks?: { barangayId: string; hospitals: { facilityId: string; share: number; expectedAdmissions: number;
    peakStaffedBedsRequired: number; baselinePeakStaffedBedsRequired: number; additionalStaffedBedsDueToSurge: number }[] }[];
  peakDate: string; peakDayIndex: number; peakLowerStaffedBedsRequired: number | null; peakUpperStaffedBedsRequired: number | null;
  peakAdditionalStaffedBedsNeeded: number; initialCensusAssumption: string;
  hospitalPeaks: { facilityId: string; peakStaffedBedsRequired: number; baselinePeakStaffedBedsRequired?: number; additionalStaffedBedsDueToSurge?: number; peakDemandUtilizationPct?: number | null }[];
}
export interface CaseRange { lowerCases: number; upperCases: number; coverageTarget: number; calibrationSamples: number; method: string }
export interface QCControls {
  startDate: string; endDate: string; mode: 'forecast' | 'hypothetical_shock'; extraCasesPerWeek: number;
  growthDays: number; normalCapacity: number; surgeCapacity: number; holdingCapacity: number;
  hospitalizationRate: number; baselineOccupancy: number; lengthOfStayDays: number;
  admissionDelayDays: number; surgeActivationDay: number; acknowledgeAssumedCapacity: true;
  allocationPolicy: 'nearest' | 'optimized'; compareAllocation: boolean;
  arrivalSplitPolicy?: 'nearest' | 'nearest_three_equal';
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
  progressionMethod?: 'dated_QC_forecast_allocated_by_xgboost_annual_burden_shares' | 'dated_QC_forecast_allocated_by_prior_annual_barangay_shares' | 'explicit_hypothetical_radial_shock';
  schemaVersion: string; scenarioId: string; resultSha256: string; runTimestamp: string;
  parameters: MovieParameters; context: MovieContext; days: MovieDay[]; durationDays: number;
  mapScaleMaxDailyCases: number; assumptions: string; disclaimer: string;
  bedProjection?: BedProjection;
}
