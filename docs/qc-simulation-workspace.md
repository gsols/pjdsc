# Automatic QC forecasting and capacity workspace

Extension 2026-10-24 21:19:03 +08:00: the sidebar now has Historical replay and
Future surge forecast tabs, arbitrary 1–28-day horizons, future-season controls
and case-to-bed demand projections. Historical methods below remain applicable
to replay. See [future seasonal methods](future-seasonal-simulation.md) for the
separate future model, evaluation and capacity limitations.

User revision recorded **2026-10-24 20:14:55 +08:00**; both uncertainty ranges
and numeric input limits were explicitly confirmed. See `change-request-log.md`.

`/outbreak-response` (also reached via `/simulate`) now defaults to the data-based
QC workspace. There is no mandatory barangay, outbreak-origin, hospital or model
run selector. Choose only a date window and scenario/policy, then update. Seven-,
14- and 28-day buttons calculate matching windows. The highest modeled full-window
barangay burden is focused automatically; map/table selection is optional
inspection and does not change demand inputs.

## Cases, environmental inputs and ranges

`scripts/build_qc_environmental_forecasts.py` reuses existing lag features and
Poisson-compatible gradient boosting settings for a predeclared cases + weather
variant. Rainfall (`RF_NASA`), temperature (`Temp_ERA5-Land`) and humidity
(`RH_ERA5-Land`) enter only at lags 1/2/4; case history is lagged and each direct
1–4-block model uses training targets no later than its own origin. Citywide
weather observations are not presented as barangay microclimate.

Eight QC reference origins in 2024–2025 are exported separately in
`qc-environmental-forecasts.json`, with a dedicated manifest, workbook/commit
lineage and software/code hashes. Legacy QC/NCR runs are retained unchanged.
Weather use is a requested model variant, not proof of superiority to persistence.

For each reference, 38–39 four-horizon calibration trajectories are completed
before issue. Calibration origins are spaced four source blocks apart within
the prior 156 blocks; each calibration model uses only labels known at that
calibration origin. Weekly ranges use a finite-sample 80%-target absolute residual
quantile. Window ranges use **joint trajectory errors** with the correct partial
week fractions, preserving within-path horizon correlation rather than summing
independent weekly bounds.

These are experimental empirical ranges, **not validated 80% guarantees**.
Observed holdout coverage is 50%, 62.5%, 62.5%, 62.5% at horizons 1–4 respectively,
with only eight evaluation origins per horizon. This shortfall is visible in
the main UI and the full matched-origin score table. Model/weather changes were
not selected to hide this result. Model uncertainty is not hospital-admission
uncertainty.

Annual complete prior burden, with the existing additional-full-year availability
lag and add-one smoothing, supplies 142 fixed spatial weights. Each barangay
window estimate and range is conditional on those weights; spatial uncertainty
is unmeasured and excluded. Annual observations remain separately labeled and
shown with their year. No weekly barangay observations were invented.

The source's `WN` calendar conflict remains unresolved. The automatic prior
reference uses `Jan 1 + 7×WN` as an explicitly assumed display cutoff, not a
verified reconstruction. User dates remain planning labels for a historical
reference trajectory. Forecast-reference starts stop at 2025; dates beyond the
available historical source require explicit hypothetical mode. No authoritative
2026 surveillance is inferred.

## Geography and UI arrangement

- The calculation scope is QC alone. NCR forecasts remain a separate research
  scope and are never assigned to the QC hospital network.
- `scripts/build_philippines_context.py` extracts only name/ID/geometry from the
  audited archive's 17-region layer, simplifies at 100 m with topology preserved,
  reprojects EPSG:32651 to 4326, and writes a hashed context manifest. It imports
  no regional case attributes into the simulation.
- Philippines geometry remains on the main map, a permanent national inset
  highlights QC, and QC/Philippines camera controls allow geographic exploration.
- Map bands are explicit display ranges for accumulated expected cases:
  0–<5, 5–<10, 10–<25, 25–<50, 50+. They are not official outbreak thresholds.
- The fixed bottom bar begins with observed source-year-to-origin cases and the
  latest observed source block, then shows daily expected cases/range, cumulative
  expected cases/range, supported patients, unstaffed holding and cumulative
  unresolved demand. Missing results show unavailable placeholders, not zeros.
- The right sidebar automatically shows the focused hotspot's three nearest
  registered hospital points, accredited bed source/date, unknown actual staffed
  and dengue-usable beds, and separate assumed/activated/residual capacity,
  occupancy and holding. Provisional straight-line coordinates are not routes.

## Admission and allocation policies

The same 28-day cohort engine owns both policies. Cases are daily-disaggregated
historical projections; admission fraction, LOS, delay, background occupancy,
hospital eligibility and operational capacity remain explicit bounded assumptions.
All 46 approved PhilHealth records are in the hypothetical eligible network;
9,389 accredited beds are inventory metadata, never the default bed denominator.

The baseline uses nearest residual supported capacity then finite holding. The
optional transportation LP first fixes supported flow to the maximum possible
given residual staffed capacity and minimizes expected straight-line patient-km;
remaining demand is allocated to finite holding with the same objective. It is
day-specific and retains cohort discharges, prior occupancy and surge activation.
It is not a road-route solver, a clinical referral policy or a future-aware
staff/bed procurement optimizer. The same-input comparison reports unresolved
demand, holding, peak normal-relative occupancy and expected patient-km without
claiming all metrics must improve or estimating causal health benefits.

`GET/POST /v1/qc-simulation` resolves source runs, hotspot ranking and all hospital
IDs server-side. The browser submits only dates and bounded scenario assumptions,
not a source hospital register or invented case arrays. Request body limits and
timeouts remain enforced by the shared engine/BFF. The exported workspace hash
covers its evidence/presentation envelope; the separate simulation hash identifies
the immutable underlying saved flow result.

## Reproduce and verify

After the original source audit/integration:

```powershell
$env:OMP_NUM_THREADS='2'
$env:OPENBLAS_NUM_THREADS='2'
python scripts/build_qc_environmental_forecasts.py
python scripts/build_philippines_context.py
python -m pytest -q
python scripts/smoke_qc_workspace.py --web-url http://127.0.0.1:3000
```

Executed: 33 Python tests, 13 frontend tests, lint, TypeScript and production
build passed. The actual HTTP smoke passed root/dashboard/simulation routes,
country context, 142 conditional ranges, all 46 capacities, observed source
counts, 7/14/28 windows, comparison and QC-only rejection. Browser visual and
interaction testing remains unavailable: Browser reported no connected browser.
Raw and original reference hashes remain unchanged.
