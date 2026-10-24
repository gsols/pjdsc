# Codex instructions — `services/engine` (existing Python / FastAPI backend)

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

Read the root instructions and all `docs/*-spec.md` first. Maintain separation of `forecasting`, `spatial`, `simulation`, `optimization`, `api` and `validation` code, using testable pure functions; avoid a monolithic `main.py`.

## Current code and what not to assume
- `main.py` currently implements `GET /health` and `POST /simulate`, but the latter deliberately returns 503. The Python engine is **not a finished simulation**.
- `requirements.txt`: FastAPI/Pydantic, pandas, NumPy, scikit-learn, joblib, openpyxl. `requirements-benchmarks.txt` optionally adds `statsforecast` for AutoETS. A solver such as SciPy `linprog` or OR-Tools is **not preinstalled as a declared dependency**; add/relock dependencies before using one.
- Historical forecast comparisons live in `scripts/` and `services/engine/models/*.json`. Model objects (`.joblib`), the source workbook, observed hospital admissions and staff/operational bed counts are **not provided in the uploaded repository**. Never imply they exist at runtime.
- Preserve the current `/simulate` explicit failure until implemented; add versioned endpoints and a tested legacy adaptor if necessary.

## Proposed domain modules
Use an incremental structure inside `services/engine/`, e.g. `domain/{forecast,spatial,patient_flow,optimizer,eligibility}.py`, `api/{schemas,routes}.py`, `repositories/{facility,model_runs}.py`, `validation/{metrics,invariants}.py`. Names are proposals; fit actual architecture. `main.py` should primarily assemble routes and lifespan dependencies.

## Forecasting

**User revision — 2026-10-24 20:14:55 +08:00:** automatic QC workspace uses a
cases-plus-lagged-environment model with strictly pre-origin residual ranges.
Ranges are experimental; report observed coverage and fixed-spatial-weight
conditioning. Compute full-window barangay totals, source-observed baseline and
nearest hospital capacity server-side. Keep QC demand separate from NCR and
country-map context. Compare allocation policies on identical inputs. See
`docs/qc-simulation-workspace.md`.
- Historical QC and NCR models are separate; a region total includes QC and must not be added to QC forecast counts.
- Forecast 1, 2, 3, 4 weekly horizons from one specified **issue/origin date**, with identical temporal availability rules for cases, climate covariates and spatial weights.
- Use features known at origin: historic lagged cases/weather, week seasonality, source quality flags. Future measured climate inputs are forbidden. If ex-ante weather forecast is used, its issue date and error assumptions must be tracked separately.
- Compare predeclared seasonal-naive, last-observation persistence, cases-only and cases-plus-weather variants, with optional negative-binomial and AutoETS when supported. Use expanding/rolling-origin backtests; split by **label availability**, not target-era lookahead.
- Report per-horizon MAE, RMSE/MASE as appropriate, high-case alert precision/recall, interval coverage, sample sizes, performance in high-count weeks. Do not claim statistical significance from a handful of high-case weeks; use blocked resampling if uncertainty tests are performed.
- Fit interpolation/imputation/scaling only on training spans at each origin; do not silently fill missing weeks as zero, especially NCR's missing 2020–2021 observations.
- Store immutable `ForecastRun` with area, origin date, training cutoff, source hash, target dates, predictions, interval method, backtest evidence, model version and actuals if historical and available. No `live` mode without actual 2026 surveillance ingest and dating.

## QC hotspots

**User extension — 2026-10-24 19:15:49 +08:00:** provide a saved dated hypothetical
movie trajectory, representative-point nearest-hospital distances and spatial
placement records from the existing patient-flow engine. No calibrated contagion
or road-route claim. Record future additional requests with timestamps in
`docs/change-request-log.md`.
- Use city-level weekly predicted cases and **historic annual** barangay counts to create explicitly modeled within-QC allocations. No inference that source supplies observed weekly barangay counts.
- Require a correct 142-barangay identifier crosswalk and QC boundary dataset before area choropleths; records/polygons are not in this ZIP. Future annual totals must not leak into prior forecast origins.
- Apply source-weight smoothing where zero/missing barangays are treated carefully; optionally population-weight allocation if denominators and year are verified. Preserve total projected QC count per horizon (to floating tolerance or using deterministic largest-remainder allocation for integers).
- Model heterogeneity/uncertainty in weights separately from citywide forecast intervals. Theoretical spatial distribution must not be marketed as clinically or epidemiologically validated weekly hotspot forecasts. See `docs/spatial-hotspots-spec.md`.

## 28-day patient flow and explicit overflow
- Inputs: dated QC case trajectory, optional spatial allocation, eligible facilities, explicitly sourced normal staffed/dengue-care capacity **or labeled assumptions**, admission fraction, reported-to-admission delay, length-of-stay distribution, baseline non-dengue occupancy, surge activation trigger/lag/resource constraint, optional on-site temporary holding and transfer policies.
- Model normal staffed inpatient placements, activated surge-supported inpatient placements, temporary **un-staffed** holding/queue, discharges, transfers and truly unresolved demand as **different states**. Holding is not quietly counted as an ordinary staffed inpatient bed.
- Occupancy may exceed 100% of *normal* capacity, but the model must not create infinite supported surge capacity. Maintain explicit capacity definitions and a finite maximum for authorized scenarios. Neither 107% nor 200% nor 700% is a universal dengue rate.
- Track normal denominator occupancy, supported denominator occupancy, daily holding census and unmet demand. Preserve mass balance every day and for every facility. Test the 100 normal, 130 supported, 135 on-site patients case: **100 normal + 30 supported surge + 5 holding**, if those spaces and policies were explicitly configured.
- Never assume every hospital including specialty/lying-in can accept dengue patients. Unknown eligibility -> excluded from verified scenario; include only if explicitly hypothetical with warning and separately accounted.
- Back-calculate warm-start patients using only pre-origin records, clearly assumed when only case counts are available. Multi-scenario stochastic simulation uses fixed-seed runs and percentile outputs, with honest uncertainties.

## Resource optimization
- Implement a basic, fully documented assignment baseline and a constrained optimizer (min-cost flow / LP / MILP if justified). Objective priority: minimize unserved/delayed placement under clinical/service constraints, then travel/access cost, then unstaffed overflow and surge activation cost; document any weighted trade-off.
- Optimize over *day-specific residual staffed capacity* after non-dengue occupancy and earlier dengue inpatients; account for length of stay and newly activated resources. Don't re-allocate the same bed each day without discharge.
- Exactly the same forecast, candidate facilities, capacities and shock inputs must feed baseline and optimized runs. Report over-capacity burden, queue, time in holding, unmet demand, travel cost and geographic equity. Don't claim historical real-world causal benefit.

## API interfaces
Versioned endpoints (or equivalent contracts with compatibility adapters):
- `GET /health` for process status; separate `GET /readiness` for dataset/model readiness, without conflating the two.
- `GET /v1/forecast-runs?area=QUEZON_CITY`, `GET /v1/forecast-runs/{id}` for stored valid historical runs.
- `POST /v1/scenarios` to calculate validated normal/surge scenarios; `GET /v1/scenarios/{id}` retrieves saved inputs/outputs.
- `POST /v1/outbreak-scenarios` with `shockKind`, `onsetDate`, `area`, `seedBarangayId?`, shock duration/shape and clinical/capacity assumptions.
- `POST /v1/scenarios/compare` comparing baseline and optimized methods on identical immutable inputs.
Strict Pydantic `extra='forbid'`, bounded payload, finite values, typed error responses, allowed area/run constraints, and stable API schemas; translate existing frontend camelCase fields in the Next.js server route or define explicit Pydantic aliases. Do not accept client-supplied real bed counts or facility coordinates as facts.

## Reproducibility and security
- Store metadata, source checksums, model/config versions, seeds, scenario date and provenance for exports. No PHI, no patient-level mock records masquerading as observed cases.
- Separate historical replay, hypothetical outbreak, and real-time (unavailable unless sourced) modes. Use type-safe error codes for missing data and unsupported geographic scope.
- Write unit tests for forecasts/no-leakage, source cutoffs, conservation, 0/100/>100% denominators, activation lag, holding overflow, empty facilities, unknown eligibility, RNG reproducibility, scenario comparability, and API validation. Validate all floating outputs are finite; avoid divide-by-zero, negative census, fractional count leakage in integer census mode.
- Do not claim engine is production-deployed, medically verified or operationally calibrated. See `docs/test-and-release-checklist.md`.
