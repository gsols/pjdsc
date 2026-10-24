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

- On desktop (above 1180 px), the left controls, center content and right hospital
  sidebar scroll independently within the viewport; reaching a panel edge does
  not scroll the page. Smaller screens retain the existing responsive layout.
- Desktop sidebars start open at their original widths. Drag an inner edge to
  resize (or focus it and use arrow keys; Shift makes larger steps). Double-click
  an edge to reset its width. Each top toggle collapses/expands that sidebar,
  preserving its chosen width until page reload. The map canvas follows changes.
  Toggle buttons sit at the inner top corners, beside the map, mirroring each other.
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

## Hotspot guide and inspection (2026-10-24)

The full-window QC case summary, experimental range, date assumption and coverage
warning share a native Show/Hide disclosure. It starts expanded and can be toggled
with a pointer or keyboard, independently of the map and playback.

### Latest playback and connection contract

As of 2026-10-25 07:11 +08:00, accumulated cases are again the default for new
playback runs. Colors and halo sizes are explicitly interpolated between dated
forecast frames using a stable full-window color maximum. The legend shows
continuous reference values, not categorical outbreak thresholds. Daily demand
remains available; weekly-source daily forecasts can legitimately stay flat within
a block. Reduced-motion mode disables interpolation, and day-zero counts stay
hidden. This visual tween never alters the saved case forecasts or triggers a
neighbor sequence. Only ranked candidate polygons are colored.

The surge panel and sidebar explicitly separate three percentages:

- Arrival split: assumed proportion choosing a candidate hospital, such as 33.3%.
- Demand percentage: expected dengue beds needed divided by scenario-assumed
  dengue slots, before diversions. It may exceed 100%; a zero denominator gives
  null, never zero/infinity. The current and peak percentages are server-calculated.
- Simulated total staffed-bed occupancy: supported placed dengue census plus
  assumed non-dengue census, divided by assumed normal-plus-activated-surge beds.
  Holding and unresolved demand are excluded.

Nearby cards show the bed-demand numerator, capacity denominator and percentage
for all origins at each hospital. The place-level table remains that barangay's
contribution. A configured-surge badge shows active/scheduled/baseline status
without declaring an observed outbreak. Real occupancy/vacancies remain unknown.

**Current correction (2026-10-25):** only ten XGBoost annual high-burden candidates
are marked/colored as hotspots. All-positive-demand marker behavior below is
superseded. A selected non-candidate only gets an outline/lift. Annual XGBoost
forecast shares now allocate citywide cases; observed annual counts are separate
and nullable. See [annual ranking definition, evidence and limits](barangay-xgboost-ranking.md).

As of 2026-10-25, location previews include **all positive-demand barangays**.
Ranks 1–10 are numbered; remaining locations have orange dots. Marker icons are
separated in screen space, with gray display stems linking them to unmodified
source points. Adaptive sizing handles narrow viewports. Panels sit outside the
map viewport and marker objects persist across frames. The selected barangay
always has a marker, including places outside the top ten.

The map defaults to daily forecast allocations, so intensity can rise or fall
according to that place's current-day values. Accumulated cases are optional.
The selected-place chart reads its daily trajectory directly from saved engine
results. No route particles or neighbor-triggered activation animate disease
progression. Automatic scenarios call `allocated_forecast_trajectory`, entirely
separate from the legacy explicit radial stress-test path. Tests verify invariance
to neighbor locations, seed and iteration order. These are still modeled QC-forecast
allocations from dated prior annual shares, not independent barangay models.

Workspace defaults now assume expected arrivals divide equally across the nearest
three eligible scenario sites (one third each when three exist), configurable
against nearest-only arrival preference. Both hospital bed-demand curves and
placement preferences use those shares. An optimized capacity LP can subsequently
reroute placements; it aggregates identical-origin subgroups without changing total
demand. Actual patient preferences/clinical eligibility remain unobserved.

The selected-place surge-bed table and sidebar show hospital shares, expected
admissions, peak no-added-surge demand, peak with-surge demand and additional beds
attributable to the configured shock. Network/hospital panels also show all-origin
demand and shortfall against explicitly assumed resources. Beds are calculated
using admission fraction, delay and LOS with zero initial census. Whole-site
staffing rounds up; sums of rounded local estimates can exceed a rounded network
estimate. Neither these curves nor accredited beds measure real vacancy.

Latest correction: hotspot locations and rank numbers are visible immediately as
explicit location previews. Only numeric simulated case/bed outputs remain gated
at day zero. Marker IDs use the loaded approved window independently of playback;
the before-start legend labels the preview. This supersedes day-zero marker hiding.

The product name is SurgeWise. On day zero, including initial load and restart,
modeled case counts/ranges, charts, hotspot ranks, bed projections, occupancy and
exports are withheld until the user plays or advances the day. Exact-date observed
base cases are unavailable: source-week/calendar alignment is unresolved and no
current surveillance has been ingested. The UI reports that gap and does not use
source-year historical totals as a current-date base. Source/model validation and
dated inventory remain separate evidence. Once started, full-window projections
remain explicitly labeled, separately from accumulated playback-day values.

Context schema 1.1 adds `hospitalsWithinBarangay` per barangay. The backend derives
membership using polygon `covers` on each approved provisional hospital point;
points exactly on shared boundaries may be covered by both polygons. Every ranked
hotspot and selected barangay draws a deduplicated set containing its nearest
hospital plus all hospitals within its polygon. These connections show geometry,
not clinical eligibility, staffed capacity or referrals. Demand allocation and
patient-flow policies are unaffected. Persistent hotspot names/case labels have
been removed; the numbered icons reveal those details on click. This supersedes
earlier references to top-five-only links and persistent hotspot name labels.

The lower reproducibility/export/six-metric panel has its own Show/Hide disclosure,
also expanded initially. It collapses all those outputs together, including the
previously fixed bottom metrics on smaller screens. Hospital map labels use compact
medical-cross buttons for all 46 points, with full names revealed on inspection;
the marker key identifies hospitals and orange modeled hotspots. Clicking a hotspot
marker, polygon or guide row opens a map card with projected window cases/range,
cases accumulated to the playback day and nearest hospital/distance. Hospital
inspection continues to show accredited capacity and nearest ranked hotspot.

Map rendering is isolated below the legend/detail overlays so marker z-indices
cannot cover their content. Larger orange numbered hotspot buttons match guide
ranks. Per the latest styling request, selection emphasizes polygon geometry and
connections while keeping label size and weight unchanged; earlier bold-label
descriptions below are superseded.

The ten ranked full-window modeled hotspots have a guide listing barangay,
expected window cases/range and nearest hospital with source-derived point distance.
Map colors and marker case counts remain cumulative to the playback day; the guide
and hospital inspection explicitly use the full date window. Leading five hotspot
links plus the selected barangay stay visible to limit clutter. Selecting any other
guide/table row exposes its label and nearest-hospital connection.

Clicking any of the 46 hospital markers or a hospital name opens its accredited-bed
details and closest of the ten ranked full-window hotspots, even when that hospital
is outside the selected barangay's nearest three. Distances are calculated by the
engine from representative/provisional points, with deterministic ID tie breaking;
no positive hotspot demand gives null, including day zero. These distances are not
road routes, entrances or referrals. Operational capacity/vacancy stays unknown.

Hospital hits take precedence over the underlying polygon. Selected polygons use
a fixed decorative extrusion, shadow, bright outline and bold label. Purple dashed
nearest-hospital lines and solid patient-placement lines have dark casings and
stronger widths for the selected barangay; a gold dotted line identifies a selected
hospital's nearest ranked hotspot. Raised height has no geographic or burden unit.
Reduced-motion disables transitions/playback; selection remains static and legible.
