# Simulation session handoff

Updated 2026-10-26 15:39:47 +08:00 (Asia/Manila). Read root/scoped AGENTS.md first.
Preserve existing working-tree edits; do not restart the application or replace data.

## Current continuation — Render engine startup

User's separate Render frontend/engine deployments work only after manually
opening the engine URL, despite configured `ENGINE_BASE_URL`. The existing BFF
times out after 20 seconds; Render documents roughly one minute for free-tier
cold starts. Added on-demand `/api/engine/health` BFF to the existing `/health`
endpoint (eight-second timeout, uncached, sanitized, server-only configuration).
`lib/engine-connection.ts` polls liveness for at most 120 seconds, then performs
the requested research/simulation call once. Both QC workspace tabs and the
research page display connection/startup state. Cancellation propagates through
the browser and BFF; tab/parameter changes and unmount discard old results.
Typed configuration failures stop immediately, and model/data errors remain
visible. No periodic keep-alive traffic or automatic POST retries were added.

See [Render deployment](render-deployment.md) and the timestamped change-request
log. Only frontend deployment is needed for this change; actual deployed Render
cold-start behavior still requires verification. Models, raw sources, scientific
assumptions, engine calculations and simulation validation gates are unchanged.

Verification: 30 frontend tests passed, including cold-start/loading-page recovery,
deadline, cancellation, late-response rejection, configuration failure, single
POST and preserved model errors. Production build (including lint/type checks)
passed. A temporary production Next server and constructed local upstream passed
actual HTTP checks: hosting HTML startup response, liveness recovery, sanitized
uncached health, single POST with preserved data error, and workspace loading
markup. Both temporary servers were stopped. This is not a deployed Render or
browser interaction test. Restored `next-env.d.ts` to its existing `.next-dev`
reference after production build. Existing dependencies were reused; no install
was needed. No Python changes or raw/reference edits.

## Current continuation — forecasting/month/day/season/parameter audit

See `docs/forecast-parameter-audit.md` for the complete audit, limits and reproduction.
Raw sources remain unchanged. Corrected final-block daily normalization (8/9 days
in week 52 under the explicit calendar assumption), dated residual indexing over
year transitions, and historical partial-window offsets. Historical requests now
reject dates outside actual saved target coverage with typed 422 and available
windows. Historical selectors persist after control edits. The source's true
epidemiological calendar remains unresolved; no calendar reconciliation is claimed.

Seasonal model v3 compares four fixed XGBoost weather/season-only × all-year/
4-year-half-life candidates using 2018–2023 only. Original weather/all-years wins
65.148 MAE; retain it. Central 2024/2025 errors remain 79.06/112.94 cases/week,
worse than seasonal baseline 74.43/110.75; WAPE 47.94%/52.88%, mean bias
−72.07/−112.59. No claim of sufficient operational accuracy. The report/app now
expose assumed-calendar monthly diagnostics, source-quarter errors, window-length
diagnostics and parameter effects. Daily/monthly labels are disaggregated weekly
proxies, not observed daily/monthly surveillance. Future year growth is unmodeled.

Added matched central-case evaluation with source-year gaps 1, 2 and 3. XGBoost
still loses to seasonal baseline in all comparisons (gap-2 MAE 80.56/121.10 vs
74.36/115.14; gap-3 75.90/120.41 vs 72.84/114.05 for 2024/2025). Parameter audit
reports the requested gap; >3 lacks matched evaluation. Range coverage is only
evaluated at gap 1. January 2027 from 2025 evidence is gap 2. A 1× multiplier now
explicitly means no added surge, including in the parameter-status metadata.
Gap metadata covers the last case date too, including Dec/Jan windows. Weather
stress has no matched error evaluation; added surge has no observed coverage
validation. Flags/text do not claim otherwise for those combinations.

Selection calibration stays pre-2024. Separate range evidence now uses completed
out-of-sample errors available through each prior year; production through 2025.
2025 weekly coverage improves from stale-pool 55.77% to 57.69%, still below 80%.
2024 remains 76.92%. Residual paths never mix different fitted-model cutoffs.
Production registration versions its range policy and validates its cutoff.
Scenario method is dated-calendar-surge-capacity-v3; runtime code identity now
also covers the source-calendar and seasonal inference/repository modules.

All twelve months × four weather profiles × every 1–28-day horizon are tested.
Added complete-year conservation/leap/year-crossing, historical-window rejection,
surge equations, zero-admission and unreached-peak checks. Model selection and
reported errors/monthly sums are independently recomputed in tests. Final checks:
82 Python tests, 23 frontend tests, compileall, lint, TypeScript and production
build passed. Live web/BFF/engine smoke passed historical offsets/rejection,
future day windows/source gaps, conservation, surge and bed percentages. All
seven immutable raw sources verified; no raw/reference changes. Browser visual
QA remains unverified. This verifies implementation, not adequate model accuracy.

Windows StatReload hung while reloading: stopped only the known engine processes
and launched a stable hidden worker without --reload (port 8000, ignored logs
`data/processed/upri_noah/scenarios/engine-runtime.*.log`), current PID 28640.
Refresh the worker after engine Python changes; its guard blocks stale domain/
inference calculations. Keep the
existing Next.js dev server on port 3000. No dependency install or source edits.
Production builds must restore next-env.d.ts to .next-dev/types/routes.d.ts.

## Latest request — color animation and explicit bed-demand percentages

Added a real requestAnimationFrame color/halo tween over each candidate's dated
forecast values. New runs start in accumulated-case mode; daily remains selectable.
Continuous colors use a fixed full-window maximum instead of saturating above 50.
Only ten annual XGBoost candidates are colored, and non-candidates stay neutral.
Reduced-motion bypasses animation; no route/contagion chain was added. Day-zero
counts remain hidden. The actual map color effect is tested with a controlled
frame clock and paint sink (not claimed as browser/WebGL visual QA).

Bed forecasts now expose demandUtilizationPct and peakDemandUtilizationPct:
expected dengue beds / assumed residual dengue slots × 100, before diversions.
Zero slots yield null; >100% pressure remains visible. Nearby hospital usage cards
and sidebar show numerator, denominator, percentage, configured-surge status and
separate simulated total staffed occupancy. Three-way arrival shares are explicitly
labeled as choice shares, not bed use. Actual staffed capacity/occupancy is unknown.
No case/model/source data or raw files changed; new scenario identities follow the
changed bed-forecast code hash. Frontend 23 tests, lint, TypeScript and production
build passed. Browser discovery returned none; no browser/WebGL visual QA claim.

Live checks exposed a stale Uvicorn worker that was writing old outputs under
new on-disk code hashes. Refreshed that local engine (supervisor PID 32640, port
8000, reload scoped to services/engine, hidden window; logs in ignored scenario
folder). Method version is now dated-forecast-capacity-bed-percent-v2, so affected
older results are retained separately rather than reused. Simulation identity
uses import-time module hashes; requests reject ENGINE_RESTART_REQUIRED if module
files change during that worker's lifetime. Added a regression test for that guard.
After restart: all 66 Python tests passed; live web/API smoke passed, including
all daily hospital demand percentages, zero-capacity nulls, 2/12/14/28-day future
windows, surge comparison, conservation, and invalid-input rejection. The 23
frontend tests include the actual map color effect and bed-percentage visibility.

## Latest correction — only ranked candidates; separate annual barangay XGBoost

User correctly challenged the all-positive-demand marker rule. That was a mistake:
positive demand is not hotspot status. Markers and case-band coloring now cover
only the ten highest predicted annual-burden candidates; selecting another
barangay only outlines/lifts it, without an orange hotspot marker. This supersedes
prior all-barangay marker guidance below.

Added `domain/barangay_forecast.py`, `scripts/train_qc_barangay.py` and approved
`repositories/barangay_runs.py`. The model is pooled annual XGBoost, using five
past counts and missingness/history features; no DC_Mean or future target labels.
Issue Y only uses labels/features through Y−2 under the existing publication-lag
assumption. Generated origin-specific forecasts cover 2018–2026. Automatic
QC/future scenarios use its normalized predicted annual burden as spatial shares;
the citywide weekly model and hospital/bed math are unchanged. Future ranking year
is the actual issue year, held fixed for the scenario; it is not claimed as a
validated weekly barangay forecast. Legacy explicit radial contexts remain separate.

Context schema 1.2 includes annual predictions, ranks, ten candidate IDs and
validation. Observed annual counts stay nullable/separate. Saved scenario identities
include the spatial artifact checksum. Model/source/software/code mismatches give
typed `BARANGAY_RANKING_UNAVAILABLE` with a rebuild command; no observed-share fallback.
Readiness now separately checks the ranking and both workspace readiness states.

Annual 2024/2025 XGBoost MAE 29.25/44.34, top-ten overlap 6/10 and 7/10. Five-year
mean ranking overlap is 7/10 and 8/10; no superiority claim. See
`docs/barangay-xgboost-ranking.md`. Both annual model and seasonal model artifacts
must be regenerated on a clean setup; their local joblib files remain ignored.

Verification: full 65 Python tests and 21 frontend tests passed, including
no-future-label leakage, null preservation, ten-vs-142 membership and failed-model
blocking. After readiness changes, 18 targeted tests also passed. Final lint,
TypeScript, production build and actual HTTP smoke passed. Live API verifies
142 positive-demand barangays but exactly 10 XGBoost candidate IDs/membership flags,
and QC workspace readiness is true. No browser is connected, so
visual QA remains unverified; raw sources were not edited.

## Current continuation — full markers, direct progression and XGBoost surge beds

Completed the user's marker/progression request and subsequent XGBoost/shared-bed
extension together. All positive-demand barangays now have markers, not only the
top ten. Numbered top ranks and smaller orange dots use screen-space collision
separation, viewport/control exclusion and adaptive sizing; gray stems link to
unaltered points. Markers persist during playback. Panels are outside the map.
Tests cover 188 collocated icons in desktop and narrow 320×420 viewports.

Map intensity defaults to daily cases, with cumulative optional. A selected-place
daily chart reads saved values directly. Forecasts use a dedicated direct spatial
allocation path, independent of seed/radius/neighbor events; route particles were
removed. Explicit legacy radial stress tests remain separate. Local curves are
still annual-share allocations of QC forecasts, not independent barangay models.

Installed XGBoost 3.1.3 in the engine's Python environment with approved escalation,
pinned it in requirements, and regenerated seasonal model/report/manifest. Future
cases use the explicitly requested XGBoost model; original boosting/baseline are
retained as comparisons. Calibration XGB MAE 65.15 vs original 64.28 vs baseline
65.88. Later XGB 2024/2025 MAE 79.06/112.94; experimental 80% coverage 76.92%/55.77%.
Baseline still has better MAE in both evaluation years; no superiority claim.

`hospital_demand.py` defines equal expected shares across up to three nearest
assumed eligible sites, now the QC/future workspace default; nearest-only remains
configurable. Both preferred placements and bed curves use the same shares.
LP optimization aggregates same-origin subgroups to avoid tripling its size.
New per-place table/sidebar show each hospital's share, admissions, no-added-surge
peak beds, with-surge peak beds and extra demand from surge. Hospital/network views
include all-origin demand and shortfalls. Actual staffed/vacant beds remain unknown;
there are no observed hospital targets for direct XGBoost occupancy validation.

Checks: final full Python suite passed **60 tests**, including three-hospital
splitting, surge/bed conservation and rounded-baseline staffing increments.
Final 21 frontend tests, lint, TypeScript and production
build passed. Actual web/BFF/engine smoke passed both tabs,
XGBoost and bed outputs. Browser discovery returned no browsers: visual QA remains
unverified. Raw source data are unchanged and models/scenarios remain ignored.

## Urgent correction — markers are visible before playback

The user found no hotspot markers because day-zero gating also hid their IDs.
Decoupled marker IDs from simulated-value visibility. Orange numbered hotspot
location previews and proximity links now show immediately after approved data
loads, with a preview legend. Case counts/charts remain hidden until day > 0.
This supersedes earlier instructions here about withholding hotspot locations.
The actual-component render regression now verifies preview marker IDs at day zero
while sentinel projected counts remain absent. Targeted regression passed.

## Latest request — SurgeWise, local hospital connections and day-zero gating

Renamed visible brand/header/dashboard/browser metadata and API title to SurgeWise.
Removed all persistent hotspot name labels; numbered markers show names via click
cards only. The backend context schema 1.1 now includes hospitalsWithinBarangay
using covers against canonical provisional hospital points. Map connections for
all ten ranked hotspots and any selected polygon include the nearest site plus
all sites inside the polygon, without duplicate IDs. Popups list local sites.
No source coordinates, capacity definitions or patient-flow policies changed.

At day zero, initial/restart/scrub-to-zero views withhold simulation projections,
charts, hotspots, bed/occupancy results and exports. Exact-date base cases are
unavailable, explicitly shown as such; older source-year totals are not substituted.
Static dated inventory, scenario inputs and source/model evidence remain visible.
After advancing, window projections and playback-day accumulations display with
their existing labels. `workspace-visibility.test.mjs` renders the actual component
with controlled loaded state and verifies day-zero hiding, day-one display and reset.

Checks: compileall and 55 Python tests passed (including full geometry containment
validation and multiple-site barangays). 17 frontend tests including the visibility
render regression passed; final lint, TypeScript and production build passed.
Extended live web/BFF/engine HTTP smoke passed both tabs and new context/brand state.
Live context confirms eight multiple-hospital barangays (largest group five).
Browser visual QA remains unverified.

## Latest UI correction — marker stacking and restrained selected labels

Isolated the map stacking context beneath opaque legend/detail overlays to stop
DOM markers covering text. Hotspots now use 29px orange numbered buttons and
larger static halos; numbers match the guide. Selected labels retain regular
weight/size/padding, and selected table names are no longer bold. Polygon lift,
outline and stronger connections remain. Presentation only; 15 frontend tests,
lint, TypeScript and production build passed. Browser discovery returned no
browsers, so rendered visual QA remains unverified.

## Latest UI request — results collapse, medical icons and hotspot cards

Added a native Show/Hide wrapper around provenance, export and all six bottom
metrics. Hospital labels are now compact medical-cross buttons for all 46 sites;
the map legend distinguishes hospitals from modeled hotspot markers. Clicking a
hotspot/polygon/guide row opens a map inspection card with full-window projected
cases/range, playback-day accumulation and nearest hospital/distance. Hospital
inspection and source-capacity/nearest-hotspot details are retained. Marker hit
priority is hospital, hotspot, then polygon. Backend/data/artifacts are unchanged.
15 frontend tests, TypeScript and production build passed. Removed an unused
variable flagged during the build; the final lint check passed. Running web HTML
confirms the footer disclosure and marker key. Browser visual QA remains unverified.

## Latest UI request — collapsible case summary

The full-window QC expected cases, experimental range, date assumption and range
validation warning now share a native Show/Hide disclosure, expanded initially.
It works on both tabs and supports keyboard toggling. Only JSX/CSS/docs changed;
map, playback and forecast calculations are unaffected. Lint, TypeScript and
production build passed; running web HTML confirms the disclosure and both labels.

## Latest extension — hotspot guide, hospital inspection and stronger selection

Implemented the user's hotspot legend/connection request in the same workspace.
`qc-simulation-workspace.tsx` now lists ten ranked full-window hotspots with
projected cases/ranges and nearest hospital/distances. Every hospital is inspectable
through its marker, hospital-name buttons or the keyboard-accessible 46-site picker.
Inspection shows a map card and reveals the right sidebar, with accredited beds,
unknown staffed/vacant capacity and nearest ranked full-window hotspot/cases.
The engine adds nullable `nearestHotspot` to each daily facility result, computed
against the ten ranked hotspots; day zero is null. Existing code hashes invalidate
old saved movie identities, so results regenerate without modifying raw sources.

`outbreak-map.tsx` gives selection a decorative extrusion/shadow, bold outline and
label, dark-cased purple nearest-hospital lines, emphasized placement lines and a
gold hospital-to-hotspot connection. Top-five proximity links stay visible alongside
the selected barangay. A single prioritized hit handler prevents a hospital click
from also selecting its underlying polygon. The new map-layer test validates the
actual style declarations against MapLibre's installed schema.

Executed: 55 Python tests and 15 frontend tests (including the style validator)
passed; final lint, TypeScript, production build and extended HTTP smoke passed.
`git diff --check` passed. Browser discovery
still returns no browsers; rendered selection/occlusion/visual QA is unverified.
See `docs/change-request-log.md` and `docs/qc-simulation-workspace.md` for scope.

## Latest repair — recurring forecasting subtab validation failure

The user reported the generic historical-input validation error in the future
forecasting tab. Reproduced four failing tests plus one fixture error. Base
historical/environmental runs and all eight integration output hashes validated.
Root cause: the seasonal manifest hashed the validation report with CRLF, while
Git retained LF bytes; Windows checkout converted both pinned Python training
files to CRLF although their manifest hashes were LF. No source values changed.

Rebuilt seasonal artifacts from all seven hash-verified original sources.
Model checksum and evaluation results reproduce the prior model. Training now
atomically publishes explicit UTF-8/LF JSON and model files, manifest last;
`.gitattributes` keeps both hash-pinned Python files LF. Validation still rejects
missing/modified artifacts without fallback. Future failures now give a typed
seasonal diagnostic with rebuild instructions, and `/readiness` separately
reports seasonal model readiness. Reload preserves the active controls.

Validation: compileall and **54 Python tests passed**, including seven new
artifact/publication regression cases; **13 frontend tests**, lint and TypeScript
passed. Actual web/BFF/engine `smoke_qc_workspace.py` passed both tabs, date windows,
January 2027, surge/bed demand and invalid input checks. The running engine's
`/readiness` confirms historical replay and seasonal artifacts ready (global
operational readiness remains false). `git diff --check` and production build
passed. Browser runtime discovery returned no browsers;
visual interaction QA remains unverified. Existing development services are still
on ports 3000/8000; reuse them. No dependencies or raw files changed, no commit.

## Active request

Finish the two left-sidebar simulation tabs: historical replay, and future seasonal
surge planning for arbitrary 1–28-day windows (including January 2027). Forecast
required staffed beds as well as cases. Preserve automatic QC hotspots, nearest
hospital sidebar/lines, movie playback, Philippine geographic context, observed-first
bottom metrics, input limits and case ranges. Record new requirements with timestamps.
The user also requests continuity when changing models.

## Implemented in the current working tree

- `services/engine/domain/seasonal_forecast.py` and `scripts/train_qc_seasonal.py`:
  existing scikit-learn histogram gradient boosting plus seasonal baseline,
  training-only weather analogs, expanding 2018–2025 year holdouts. Model selection
  uses 2018–2023 only; 2024–2025 are evaluation. Final model trained through 2025.
- `repositories/seasonal_runs.py`: approved hashed local model and saved immutable
  future-date forecast runs. `/v1/future-simulation` is exposed through the existing
  bounded Next.js research proxy; `forecast_runs.py` resolves seasonal IDs.
- `domain/bed_forecast.py`: admission/delay/LOS convolution for unconstrained bed
  demand, integer staffing requirements, sensitivity bounds, capacity shortfalls,
  daily/per-hospital and peak summaries. Supported placements remain separate.
- `qc-simulation-workspace.tsx`: historical/future tabs, independent form state,
  1–28-day input and 2/7/12/14/28 shortcuts, future month/weather/surge controls,
  case evidence, bed chart and hospital forecasts. Existing map/playback retained.
- Prior tasks already integrated original audited UPRI-NOAH workbook, annual
  barangay data/boundaries, automatic QC hotspots and 46 PhilHealth hospitals.
- Prior Next.js ENOENT fix: singleton `npm run dev` launcher and `.next-dev`
  separate from production `.next`. Do not run a second direct Next dev process.

## Scientific limits that must remain visible

- No 2026/2027 surveillance or measured future weather: future curves are conditional
  seasonal planning projections, not a current operational outbreak forecast.
- Week/date mapping remains explicitly assumed; source WN calendar is unresolved.
- Annual barangay shares are modeled allocations, never observed weekly cases.
- All 46 hospital points are provisional; actual staffed capacity, dengue eligibility,
  census and vacancies are unknown. 9,389 accredited beds are inventory metadata.
- Beds assume admission fraction, delay, LOS, zero initial dengue census and finite
  operational resources. Ranges are case-demand sensitivity, not validated occupancy intervals.
- Boosting won pre-2024 selection (MAE 64.28 vs 65.88) but the seasonal baseline
  performed better in BOTH later evaluation years. Selected-model 2024/2025 MAE
  83.34/118.74; experimental 80% range coverage 75%/53.85%. No superiority claim.
- Raw source files remain immutable; source hashes and pinned commit are preserved
  in the audit/manifests. QC demand must never include all NCR forecast cases.

## Runtime and reproduction

Existing development endpoints were running at web `http://127.0.0.1:3000` and
engine `http://127.0.0.1:8000` (reload enabled). Verify before starting processes.
Do not run npm ci against a running dev server; no new dependencies were added.

Generated local model is ignored by Git. To regenerate from audited sources:

```powershell
$env:OMP_NUM_THREADS='2'
$env:LOKY_MAX_CPU_COUNT='2'
python scripts/train_qc_seasonal.py
python -m compileall -q scripts services/engine
python -m pytest -q
```

From `apps/web`: `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
Source/model manifests: `data/processed/upri_noah/qc-seasonal-manifest.json` and
`qc-seasonal-validation.json`. Generated scenario/run JSON stays ignored.

## Verification checkpoint and remaining work

Implementation and automated validation of this request are complete:

- `python -m compileall -q scripts services/engine`: passed.
- `python -m pytest -q`: **44 passed**, including 11 new future/bed tests.
- `npm run test`: **13 passed**; lint, TypeScript and production build passed.
- `python scripts/smoke_qc_workspace.py`: actual web/BFF/engine HTTP smoke passed
  historical routes, two tab markup, Philippines context, 46 hospitals, 142
  barangays, same-input allocation comparison, arbitrary 2/12/14/28-day future
  windows, January 2027 seasonality, surge effects, beds and invalid-input guards.
- Seasonal model retrained after final training-code changes; manifest/code
  validation is enforced. A stale code hash initially caused the guard to reject
  loading as intended; regeneration resolved it. Raw inputs were not edited.

Browser visual/interaction QA remains unverified: browser connection returned
"No browser is available" on the latest attempt. HTTP checks do not substitute
for map/render/keyboard/playback inspection. Known pre-existing nonfatal tooling
warnings: Starlette testclient/httpx deprecation and Node TS module-type detection.
No production deployment or clinical/operational validation is claimed. No commit
was created. User may switch models now; start from the actual files and this
checkpoint, and continue any subsequent user requirements.

## Prompt for another model

Continue in this same workspace. Read AGENTS.md and docs/SESSION_HANDOFF.md first.
Preserve all existing changes, inspect actual files/status, and complete outstanding
checks and requirements without restarting the implementation. Keep source-data,
forecast, allocation and hospital-assumption boundaries intact.
