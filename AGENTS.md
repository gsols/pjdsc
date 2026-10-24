# PJDSC / NCR Dengue Intelligence — repository-wide Codex instructions

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

## Session continuity

Read `docs/SESSION_HANDOFF.md` before continuing simulation work in a new model or
conversation. Verify its checkpoint against the actual working tree and update it
after substantive progress. Preserve existing edits and raw-source immutability.

## Mission and non-negotiable scientific claim boundary

User extension recorded 2026-10-24 19:15:49 +08:00: maintain timestamped additional
product requirements in `docs/change-request-log.md` and link the relevant scoped
specifications. Movie playback, nearest-hospital context and connection lines are
authorized; preserve hypothetical/observed boundaries and raw-source immutability.
Build on the **existing** map-first public-health research prototype. Connect historical, appropriately backtested dengue case forecasts to explainable Quezon City (QC) spatial-demand estimates, hospital surge/overflow simulation, and transparent resource-allocation comparisons. The result is a **research and preparedness decision-support application**, **not** live disease surveillance, verified hospital vacancy reporting, clinical triage, or an automated referral service.

Never invent observations, hospital coordinates, clinical capability, vacancy, operating hours, observed admissions, model performance, or optimization benefits. A configured assumption or synthetic stress test must always be labeled as such. When required source data are absent, expose an honest blocked/unknown state; do not manufacture a demo dataset labeled real.

## This actual repository (inspected 2026-10-24)

Current integration update (2026-10-24 22:03:31 +08:00): the original workbook,
annual barangay CSV and official archive-derived boundaries have now been audited
and integrated. Historical forecast runs, seasonal trained local artifacts,
versioned simulation endpoints and the two-tab workspace exist. The original
upload descriptions below are historical context; consult
`docs/upri-integration-audit.md`, `docs/future-seasonal-simulation.md` and the
session handoff for current availability and verification. Operational hospital
capacity, verified entrances and current surveillance remain absent.

- `apps/web/`: Next.js 15 / React 19 / TypeScript / MapLibre UI. The existing dashboard is `apps/web/app/dashboard/page.tsx`; current map is `apps/web/components/ncr-map.tsx`; app types are `apps/web/lib/types.ts`.
- `apps/web/app/api/boundaries/route.ts`: reads **already present** `apps/web/public/data/ncr-cities.geojson` with 17 NCR local-government polygons. Do not state that NCR boundaries have not been imported.
- `apps/web/app/api/simulate/route.ts`: intentionally returns 422 when `forecastRunId` is absent and 503 when the backend is not connected. **Do not bypass its safety gating by injecting made-up case counts.**
- `services/engine/main.py`: FastAPI foundation; `/health` works; `/simulate` intentionally raises 503. Implement actual engine services behind validated, dated inputs.
- `scripts/train_dengue.py`, `backtest_four_week.py`, `backtest_rolling.py`, `benchmark_autoets.py`, `compare_forecasters.py`: existing historical forecasting/benchmarking scripts. Reuse and audit; do not replace them blindly.
- `apps/web/public/data/qc-philhealth-hospitals.json`: **ACTIVE QC hospital/infirmary layer: 46 PhilHealth 2026-09-30 records with 9,389 accredited beds and 46 provisional coordinates (not verified entrances)**. `apps/web/public/data/facilities.json` is the **legacy NHFR 165-NCR / 41-QC** reference only; no active QC hospital map or simulation may use it.
- The new package ships the 46-row PhilHealth QC hospital JSON and 116-row source-traceable admissions/lying-in CSV. **Replace the active QC hospital source** with the PhilHealth JSON; retain NHFR only for separate comparative reconciliation. Their counts/beds must never be summed.
- `data/processed/hospital_coordinate_review.csv`, `data/processed/qc_coordinate_candidates.json`, `data/reference/historical_hospital_coordinate_candidates.json`: **candidate** coordinate evidence, not verified hospital entry points.
- `apps/web/public/data/forecast-validation.json` and `services/engine/models/*.json`: historical evaluation outputs, **not runnable forecast-run objects**. `*.joblib` models and the original UPRI-NOAH Excel workbook are **not in this upload**.
- The QC annual-barangay dataset and QC barangay boundary polygons are **not in this upload**. Do not render fictional barangay hotspots.
- Existing `README.md` and `docs/data-sources.md` contain obsolete scaffold statements (e.g. no facilities/no city boundaries). Update them **after** confirming facts, without erasing attribution or caveats.

## Directory guidance
Follow this file and the more specific scoped instructions:

- `apps/web/AGENTS.md` — UI, map layers, access, API integration.
- `services/engine/AGENTS.md` — statistical code, patient-flow simulator, optimizer, FastAPI.
- `scripts/AGENTS.md` — reproducible ingest/backtests/provenance.
- `data/AGENTS.md` — raw/processed/reference artifact safety and identifiers.

Task specifications: `docs/architecture-and-contracts.md`, `docs/forecasting-validation-spec.md`, `docs/spatial-hotspots-spec.md`, `docs/surge-capacity-simulation-spec.md`, `docs/unexpected-outbreak-spec.md`, `docs/data-provenance-and-limitations.md`, `docs/test-and-release-checklist.md`. Task kickoff prompts are in `prompts/` and do **not** auto-run just because they exist.

## Build on the code, do not restart it
1. Inspect the repo and note what already works before editing. Preserve the Next.js App Router, MapLibre, existing styling unless explicitly upgraded, historical model baselines, facility identifiers, and source files.
2. First complete an **end-to-end vertical slice**: one reproducible **historical QC** forecast run -> validated API -> admissions simulation -> honest dashboard output -> tests. Then extend to hotspot allocations, optimization, and the dedicated unexpected-outbreak lab.
3. Treat NCR forecasting as a separate scope. **Do not allocate an NCR-wide total entirely to QC hospitals**. QC simulation takes QC case demand only; a region-wide simulation needs regional facility and demand coverage.
4. Keep source observations, predicted cases, spatial allocations, and simulated patients separated in data models and UX. Forecast intervals are not equivalent to empirical hospital-admission uncertainty.
5. If a requirement conflicts with the data, preserve the validity requirement and explain the gap in documentation and UI. Never quietly weaken validation to make a demo look complete.

## Stable data categories and naming
For every displayed number, track its `measurementKind` (`observed`, `source_reported`, `forecast`, `modeled_allocation`, `assumption`, `unknown`), `asOf`/`issueDate`, geography, units, source, and if modeled, run/assumption version.

- `authorizedBeds`: use **only** where DOH explicitly defines the imported field as authorized capacity; otherwise retain the raw `Bed Capacity` value under `nhfrReportedBedCapacity` or mark its definition pending verification. No silent renaming.
- `accreditedBeds`: PhilHealth figure from its dated hospital register; **not** authorized, implemented, staffed, free or dengue-usable beds.
- `implementedBeds` / `normalStaffedCapacity` / `activatedSurgeBeds` / `dengueUsableBeds`: separate, nullable or explicitly scenario-assumed. Never infer dengue eligibility from hospital level alone.
- `coordinateStatus`: `UNAVAILABLE` / `PROVISIONAL_HISTORICAL_MATCH` / `VERIFIED`; do not auto-upgrade historic matched points to verified.
- Preserve NHFR `Health Facility Code` in legacy/crosswalk data; local `HOSP-614`..`HOSP-659` are PhilHealth row-derived project IDs, not official facility accreditation numbers. Any crosswalk requires reviewed matching; distinct Montano branches must remain distinct.
- All counts and probabilities must be finite, nonnegative and unit-tested. Missing is `null`/not available, not `0`.

## API, architecture, and security
- Backend owns calculations, model artifacts, provenance checks, and saved reproducible scenario results; frontend owns display and interaction. Python mathematical logic must be pure/testable, not embedded inside API handlers.
- Provide versioned validated FastAPI contracts and thin Next.js BFF route handlers; don't trust browser-submitted facility bed counts or forecast case arrays as verified inputs. Resolve approved facility/run IDs server-side.
- Keep the existing `/api/simulate` and `/simulate` routes guarded until a validated real implementation is available; then evolve them with clear compatibility/migration notes rather than silently changing client contracts.
- Require explicit scenario types (`historical_replay`, `hypothetical_shock`, and `live` only when authoritative live inputs exist). Deny unsupported combinations with actionable typed errors.
- Never ingest/display patient-level or personally identifiable medical data. Sanitize input, validate JSON sizes/ranges, enforce API timeouts and appropriate caching/error messages, and avoid exposing backend internals or secrets to the client.
- Use deterministic seeds for stochastic research scenarios; capture model version, dataset checksums, training cutoff, spatial weights cutoff, scenario knobs, run timestamp, and software version.

## Engineering workflow
- Inspect dependencies and existing scripts; do not add unneeded libraries or overhaul the entire stack. If adding dependencies, update appropriate `package-lock.json` / Python dependency declarations and document reproducible versions.
- Add unit, API contract, numerical invariant, and UI tests. Include failure/empty/missing-data tests, not just success snapshots.
- Make scoped changes; run the checks relevant to each change. Python syntax baseline: `python -m compileall -q scripts services/engine`. From `apps/web`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (network/tool availability permitting). After test tooling is introduced, run `python -m pytest` and frontend component/E2E tests.
- Do not claim commands succeeded unless actually executed. Record why checks could not run (e.g. missing dependencies/data).
- Preserve `.env*`, secrets, huge workbooks and generated models out of source control unless explicitly approved. Add safe `.env.example` and hashed data manifest where needed.
- Keep documentation and APA 7 data/literature citations aligned with **actual** versions and available sources; do not fabricate access dates, DOIs or literature evidence.

## Definition of done
Working integrated UI and backend on **dated historical data**, reproducible 1–4-week backtests without future leakage, QC-specific spatial allocation only if geographic source inputs exist, tested 28-day patient-flow and >100%-of-normal overflow scenarios, demonstrable baseline-vs-optimized simulations on identical inputs, per-number provenance/uncertainty labeling, clean loading/blocked/error states, reproducible commands, and an auditable 3-minute historical demo. See `docs/test-and-release-checklist.md` for acceptance tests and honest release labeling.
