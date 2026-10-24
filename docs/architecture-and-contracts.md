# Repository-specific architecture and integration contracts

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

## Audited state vs target
**Audited from uploaded `pjdsc-main.zip` on 2026-10-24:**

| Concern | Exists already | Still required |
|---|---|---|
| Web | Next.js `/dashboard`, MapLibre NCR map, controls and basic facility selection | Forecast pages, hotspot visualization, day-based scenarios, errors, accessible controls |
| Boundaries | `apps/web/public/data/ncr-cities.geojson`: 17 NCR cities/municipality features | QC barangay polygons, identifier QA; do not conflate the two |
| Hospitals | `apps/web/public/data/qc-philhealth-hospitals.json`: **active** 46 QC PhilHealth hospital/infirmary entries (9,389 accredited beds; all 46 provisionally geocoded). Legacy NHFR 165-NCR/41-QC file is inactive for QC simulations. | Regulatory field-definition audit, clinical eligibility, source crosswalk, verified operational capacity |
| Forecast evaluation | Existing scripts and stored JSON reports for QC/NCR one-week and 1–4-week retrospective tests | Dated executable forecast runs and model artifacts, calibrated uncertainty, API read endpoints |
| Backend | FastAPI `/health` and deliberately unavailable `/simulate` | Real forecast-run repository, day-level patient flow, capacity model, optimization, API tests |
| Dashboard scenario | `/api/simulate` guards missing run and unavailable engine | Validated BFF with error mapping and durable result schema |
| Source workbook | Not contained in ZIP | Acquire official version under documented permission and hash |
| Barangay counts / boundaries | Not contained in ZIP | Acquire annual QC barangay table and polygon IDs, validate mapping |

The existing README and `docs/data-sources.md` describe an older empty scaffold; update after actual code changes. Do not confuse these files with current repository state.

## End-to-end pipeline

1. `scripts/` ingests immutable, dated originals, applies QA and records a provenance manifest.
2. `services/engine/domain/forecast...` or equivalent loads **historical** QC/NCR sources, trains/evaluates at strict issue dates, saves run artifacts and scorecards.
3. `services/engine/domain/spatial...` allocates the QC-specific forecast to QC barangays using **cutoff-safe annual weights**. If not available, QC city-only simulation may run without claiming locations of individual hotspots.
4. `services/engine/domain/patient_flow...` converts weekly cases to daily expected/admitted demand and simulates flows into eligible QC hospital resources, with explicit normal/surge/holding/unmet states.
5. `services/engine/domain/optimizer...` contrasts fixed-rule allocation against a constrained alternative under identical scenario parameters; every comparison includes constraints and caveats.
6. FastAPI returns immutable, versioned forecast/scenario outputs; Next.js `app/api/*` proxies and validates requests; React renders one common scenario result across all controls and map layers.

## Contract conventions
Use JSON camelCase in browser/Next.js responses, mapping explicitly to Python snake_case Pydantic fields. This is a **design target**, not the currently implemented API. Keep migration adapters for current `ScenarioResult` (`weeks`, `facilityResults` keyed by week) if older UI is retained.

Common metadata:

```json
{
  "schemaVersion": "1.0",
  "mode": "historical_replay",
  "scope": "QUEZON_CITY",
  "asOf": "2025-01-27",
  "sourceHashes": {"qcCases": "sha256:..."},
  "methodVersion": "...",
  "assumptionSetId": "...",
  "disclaimer": "Historical research scenario, not a live bed forecast"
}
```

Illustrative **shape only** (not a real run):

```json
{
  "forecastRunId": "historical-qc-example",
  "mode": "historical_replay",
  "scope": "QUEZON_CITY",
  "issueDate": "2025-01-27",
  "horizonWeeks": 4,
  "weeklyPredictions": [
    {"weekStart": "2025-02-03", "meanCases": null, "lowerCases": null, "upperCases": null, "intervalKind": "not_estimated"}
  ],
  "validation": {"method": null, "maeByHorizon": null},
  "dataProvenance": {"casesSource": null, "trainingCutoff": null}
}
```

Real `ForecastRun` creation **must validate populated predictions** before allowing `/simulate`; null shape above only documents contract without fabricating values. Ensure weeks 1–4 are complete and ordered.

Scenario request should reference **server-stored** `forecastRunId` and a centrally resolved facility dataset version. Browser may edit `scenarioKind`, nonclinical assumptions, `surgeMultiplier`, `admissionFraction`, `baselineOccupancyFraction`, `meanLengthOfStayDays`, `staffedCapacityFractionAssumption`, `surgeActivation`, geographic/access policies, solver objective settings, and seed. Require explicit `assumed: true` for unverifiable clinical/operational inputs.

Day-level response minimal required fields (numeric values omitted here because no run exists):

```text
scenarioId, forecastRunId, scope, mode, scenarioKind, issueDate,
startDate, horizonDays=28, datasetVersions, assumptions, solver,
summary, dailyResults[], facilityResults[], barangayResults[],
validationWarnings[], modelLimitations[], disclaimer

dailyResults[]: dayIndex (0..28), snapshotAt, intervalStart?, intervalEnd?, dailyCases,
 cumulativeCases, newAdmissions, discharges,
 normalInpatientCensus, surgeInpatientCensus, holdingCensus,
 externalUnmetDemand, normalCapacityTotal,
 activatedSupportedCapacityTotal

facilityResults[]: facilityId, dayIndex, normalStaffedCapacity,
 activatedSurgeCapacity, normalCensus, surgeCensus,
 temporaryHoldingCensus, waitingForTransfer, unmetDemand,
 occupancyPctNormal, occupancyPctSupported,
 coordinateStatus, clinicalEligibilityStatus, evidence

barangayResults[]: barangayId, dayIndex, expectedCases,
 expectedAdmissions, allocationMethod, uncertainty,
 annualHistoricalCountSource
```

Day 0 is a pre-shock initial snapshot at onset (00:00 Asia/Manila); Day k (1..28) closes the k-th complete 24-hour period after onset. `dailyCases`/`newAdmissions` for Day k refer to the interval immediately preceding that snapshot; Day 0 daily flow is zero. Day 7 cumulative totals include exactly **seven** completed days, not eight. Clearly distinguish daily incidence, cumulative totals and point-in-time census.

## API routing and startup
- FastAPI `GET /health`, `GET /readiness`, `GET /v1/forecast-runs`, `GET /v1/forecast-runs/{runId}`, `POST /v1/scenarios`, `GET /v1/scenarios/{scenarioId}`, `POST /v1/outbreak-scenarios`, `POST /v1/scenarios/compare`.
- Next.js BFF `/api/forecast-runs`, `/api/simulate`, `/api/outbreak-response` proxies with server-only `ENGINE_BASE_URL`, validates and standardizes errors and typed responses. Keep `GET /api/boundaries` working; add `/api/barangay-boundaries` only after verified geometry exists.
- Keep computation in Python. Avoid sending full authoritative `facilities` arrays from browser to server (the current client does this); accept IDs and scenario knobs while backend resolves trusted records.
- `422` for invalid/inconsistent input (missing run, unmatched scope, unsupported dates, nonfinite assumption), `404` unknown run, `409` run/data version mismatch, `503` source/artifact unavailable, `500` unexpected internal error with sanitized logs.
- Server-only allowed CORS origins for local dev, configured for deployment; protect expensive endpoints with timeouts/rate limits and scenario caching.
- Use stable serialization and storage for replay. A run ID should resolve to an immutable snapshot; never silently substitute current training output under an old ID.

## Practical integration sequence

1. Add contract schemas and a tiny fixture-only unit test without changing user-facing dashboard.
2. Generate and validate a dated historic QC forecast run **from real workbook** (if not available, deliver clean blocked status and ingestion command).
3. Implement one QC-only simple single-hospital/synthetic fixture patient-flow unit test, then real QC inventory with explicit eligibility assumptions and 28-day dates.
4. Wire `apps/web/app/api/simulate/route.ts` and dashboard controls to versioned backend; eliminate client-submitted facility truth.
5. Add QC barangay verified layer and allocations, then optimizer.
6. Add `/outbreak-response` and 0–28 day controls reusing same backend run schema; add charts, uncertainties and citations.
7. Update `README.md`, source docs and release validation only after executed checks.
