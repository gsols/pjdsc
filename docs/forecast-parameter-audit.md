# Forecasting and parameter audit

Recorded 2026-10-25 08:01:49 +08:00. Reproduction:
`python scripts/train_qc_seasonal.py`. Audited raw sources remain unchanged.

Software corrections do **not** establish adequate forecast accuracy. Current
surveillance, weekly barangay observations and hospital occupancy observations
remain unavailable. The original source `YR/WN` calendar remains unresolved.

## Model and selection

The saved estimator is XGBoost 3.1.3 `XGBRegressor`, CPU `hist`,
`count:poisson`, seed 42, 160 trees, depth 3, learning rate .04, minimum child
weight 20 and L2 regularization 5. The
[official reference](https://xgboost.readthedocs.io/en/release_3.1.0/parameter.html)
defines these settings; using them does not establish accuracy.

Four fixed candidates compare seasonal harmonics with/without lagged weather,
and all-year versus four-year-half-life training weights. Selection uses only
2018–2023 expanding-year MAE: weather/all-years 65.148; season/all-years 65.887;
weather/recency 65.685; season/recency 65.525. The original weather/all-years
configuration remains selected. The requested XGBoost is never silently replaced.

Each prediction year uses labels and weather analogs from earlier years only.
2024–2025 were excluded from candidate selection but already examined during
development; their results are retrospective evidence, not untouched prospective
validation. See [temporal validation guidance](https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split).

| Year | XGBoost MAE, cases/week | Seasonal baseline MAE | XGBoost weighted absolute error | Mean bias, cases/week | 80%-target weekly coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2024 | 79.06 | 74.43 | 47.94% | −72.07 | 76.92% |
| 2025 | 112.94 | 110.75 | 52.88% | −112.59 | 57.69% |

XGBoost underpredicts and loses to the seasonal baseline in both years. Weighted
absolute error is an error percentage, not an accuracy percentage. Ranges do
not achieve their nominal 80% target. No operational accuracy claim is supported.

Following-year evaluation alone does not match January 2027 with a 2025 training
cutoff. Additional frozen-configuration stale-source checks are now included;
XGBoost still loses to the baseline in every comparison:

| Evaluation year | Last training year | Source-year gap | XGBoost MAE | Seasonal baseline MAE |
| --- | --- | --- | ---: | ---: |
| 2024 | 2022 | 2 | 80.56 | 74.36 |
| 2025 | 2023 | 2 | 121.10 | 115.14 |
| 2024 | 2021 | 3 | 75.90 | 72.84 |
| 2025 | 2022 | 3 | 120.41 | 114.05 |

Central case errors were checked at gaps 1–3. Longer gaps have no matched
evaluation; range coverage remains evaluated only at gap 1. The API/UI report
the requested gap. These small retrospective comparisons do not validate future
performance or annual growth extrapolation.

## Calendar and horizon corrections

The explicit display assumption starts week 1 on Jan 1, gives seven days to
weeks 1–51 and eight/nine remaining days to week 52. Daily disaggregation now
divides by actual block length, preserving exactly 52 source totals per year.
The previous final-block division by seven inflated annual mass. This repairs
internal consistency without pretending to resolve the source calendar.

Residuals use the same dated blocks/divisors as central predictions, including
Dec/Jan transitions. Paths never combine different fitted-model cutoffs. The old
day-of-year-modulo-seven residual lookup mishandled extended week 52.

The month picker chooses a start date, not a complete month. Horizons are 1–28
whole days, end exclusive, with no horizon-dependent rescaling. Month/year and
leap-day transitions use calendar arithmetic. Short windows retain the same
prefix of the longer forecast.

Historical replay and its stress overlay must fit within one saved forecast's
actual four target blocks. Partial windows retain their offset. Unsupported dates
return typed 422 `HISTORICAL_WINDOW_UNAVAILABLE` with available windows. Another
month's forecast cannot silently be relabeled. Explicit legacy radial stress
tests remain a separately labeled mode.

## Parameter interpretation

| Parameter | Behavior and boundary |
| --- | --- |
| Month / season | Native-week harmonics and past lag-1/2/4 weather analogs; no measured future weather. |
| Future year | Conditional seasonal curve fitted through 2025; annual growth and current outbreak probability are not estimated. |
| Days | 1–28; exclusive end = start + days; no rescaling when slicing. |
| Surge onset | Zero-based interval offset from start; no added cases before it. |
| Growth / multiplier | After onset: `1 + (M−1) × min(1,(interval−onset+1)/growth)`; M is 1–10. API/UI report applied maximum and whether the requested peak fits in the window. |
| Staffed surge activation | Separate snapshot day/date; changes assumed capacity, not case incidence. May lie outside the selected window. |
| Hospitalization fraction | Assumed 0–1; converts reported cases to expected admissions. |
| Admission delay / LOS | Delay 0–28 days; stay 1–30 days. Zero pre-window dengue census is an explicit assumption. |
| Hospital choice | Equal expected share across three nearest assumed-eligible sites by default; nearest-only comparator; finite capacity diversions. |
| Bed demand percentage | Expected dengue bed need / assumed residual dengue slots × 100, before diversions; null for zero slots and uncapped above 100%. |

Surge is configured, not predicted by XGBoost. Admission fraction, LOS, eligibility,
staffed beds, occupancy and patient choice lack observed calibration targets.
Bed outputs are conditional demand modeling, not empirically validated occupancy.

Annual barangay XGBoost is a separate model. Its issue-year annual burden supplies
fixed spatial shares and ten candidates, not independently trained future weekly
hotspots. Existing annual top-ten recovery in 2024/2025 is 6/10 and 7/10 versus
7/10 and 8/10 for a five-year mean. No superiority claim.

## Diagnostics and verification

The report exposes weekly MAE/RMSE/bias/WAPE/coverage, 13-source-week quarters,
all twelve assumed calendar months and 1/2/7/12/14/28-day windows. The app exposes
these in its existing collapsible reproducibility panel and shows baseline skill
near the controls. Quarters are not official wet/dry-season labels.

Daily/monthly targets are uniform disaggregations of weekly observations, **not**
independently observed daily/monthly counts. Seven-day-spaced windows overlap.
Their ranges use the same prior-year-only evidence policy and 28-day path
selection as production. Selection remains frozen through 2023; range validation
for 2024 uses errors through 2023, and 2025 uses errors through 2024. Production
uses completed out-of-sample errors through 2025, replacing the stale frozen
2018–2023 range pool. This raises 2025 weekly coverage from 55.77% to 57.69%,
still below target. Weather-stress/surge ranges are not separately calibrated.

Tests cover annual mass, leap/month/year boundaries, all twelve months × four
profiles × every 1–28-day horizon, historical offsets/rejection, frozen selection,
surge equations, zero admissions, delay/LOS and finite bed capacity. Source/model/
report/code hashes remain mandatory; atomic rebuild publishes the manifest last.

```powershell
$env:OMP_NUM_THREADS='2'
$env:LOKY_MAX_CPU_COUNT='2'
python scripts/train_qc_seasonal.py
python -m compileall -q scripts services/engine
python -m pytest -q
python scripts/smoke_qc_workspace.py
# apps/web:
npm.cmd run test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Browser visual QA is separate from numerical/HTTP checks.

Final executed checks: 82 Python tests, 23 frontend tests, compileall, lint,
TypeScript, production build and live web/BFF/engine smoke all passed. All seven
original source hashes verified. No browser visual verification is claimed.
Passing these checks does not establish sufficient model accuracy.
