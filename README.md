# SurgeWise

Map-first public-health research and preparedness prototype using Next.js/MapLibre and FastAPI. Not live surveillance, verified hospital vacancy reporting, clinical triage or a referral service.

## Current implementation

- The simulation sidebar now separates **Historical replay** and **Future surge
  forecast**, with arbitrary **1–28-day** windows and 2/7/12/14/28 shortcuts.
  Future dates, including January 2027, use newly generated XGBoost seasonal
  case forecasts and assumed historical weather analogs. Configure surge
  onset/ramp/multiplier; view daily/peak required staffed beds, sensitivity bounds
  and hospital catchment demand. Actual vacancies remain unknown. The simpler
  baseline outperformed the selected model on later holdouts; the validation table
  exposes this limitation. See [future methods](docs/future-seasonal-simulation.md)
  and [model-switch handoff](docs/SESSION_HANDOFF.md). Historical behavior below
  remains available in its own tab. Future mode requires the local approved model:
  `python scripts/train_qc_seasonal.py` regenerates it from audited source inputs.
  `python scripts/train_qc_barangay.py` separately rebuilds the approved annual
  barangay-burden ranking and its validation/manifests. Both local artifacts are
  required for the QC workspace; missing/invalid artifacts block it without fallback.

- `/outbreak-response` is the automatic QC forecast/capacity workspace
  (`/simulate` redirects there). No place selection is required. Choose a date
  window or 7/14/28-day horizon; source case history and lagged rainfall,
  temperature and humidity inform QC forecasts. A separate annual XGBoost model
  supplies modeled spatial shares across 142 barangays; only its ten highest-burden
  candidates receive hotspot markers/coloring. Positive demand alone does not mean
  hotspot status. See [annual ranking methods](docs/barangay-xgboost-ranking.md).
  The entire Philippines remains geographic
  context, including a permanent overview; numerical simulation is QC only.
  The bottom bar starts with dated observed source cases and retains daily/
  cumulative expected cases, supported census, holding and unresolved demand.
  The right sidebar automatically shows nearest-hospital capacity, separating
  source-reported accredited beds from unknown real staffed beds and assumed
  normal/surge/residual capacity.

  Case estimates have explicit experimental ranges and map display bins; editable
  assumptions have visible numeric limits. The 80%-target empirical city ranges
  achieved only 50–62.5% retrospective weekly coverage (eight origins/horizon),
  disclosed in the UI. Barangay ranges are conditional on fixed annual weights,
  not validated weekly barangay intervals. Dates remain explicitly assumed
  labels because source-week alignment is unresolved; no live 2026 forecast.

  The normal mode adds no invented shock. Unexpected/off-season mode separately
  adds bounded hypothetical demand. All 46 registered sites are assumed eligible
  for planning, with 20 normal + 10 surge beds and 5 holding spaces/site by
  default, 15% admission fraction, 4-day LOS and 75% background occupancy.
  These are assumptions, not observations or vacancies. Compare the baseline
  against a capacity-constrained minimum-distance placement LP on identical
  inputs; no real-world benefit is claimed. See [workspace methods and limits](docs/qc-simulation-workspace.md)
  and [timestamped user extensions](docs/change-request-log.md).

- `/dashboard` retains the existing map and 17 NCR city/municipality polygons. QC hospital markers use the canonical PhilHealth registry only, with search, ownership filtering, provisional point symbols, source details and a table independent of map availability.
- Active inventory: **46 QC hospital/infirmary source rows; 9,389 accredited beds**, as of **2026-09-30**. All 46 points are provisional; **zero independently verified emergency entrances**. Accredited beds are not staffed, free or dengue-usable capacity. Local HOSP IDs identify source rows, not official accreditation numbers.
- Frontend and backend validate the pinned hospital SHA-256, exact IDs, counts, bed meaning, source evidence, corrected branch points and containment in the shipped QC city polygon. Missing/corrupt data fail closed, with no NHFR fallback.
- FastAPI `/v1/facilities` exposes the server-approved inventory; `/readiness` separates source readiness from process health. `/simulate` and `/api/simulate` remain guarded; the dashboard Run button is disabled.
- `/research` connects the official UPRI-NOAH workbook, observed annual barangay CSV and archive-derived polygons to separate QC/NCR historical source-block forecasts and a QC-only 28-day expected-patient simulation. All six raw files match pinned upstream commit `02926278d570db8950da368d44db544ae0097615` and remain unchanged.
- The pre-training [source audit](docs/upri-integration-audit.md) identifies unresolved week/calendar semantics, stale upstream validation-report schema, annual/city total discrepancies, and two missing polygon IDs reconciled through explicit project name crosswalks. These limitations remain visible. Annual burden is never labeled weekly ground truth; spatial allocations use complete prior years under an assumed availability lag.
- Versioned research endpoints validate source/artifact hashes, resolve forecast/facility IDs server-side and separate hypothetical hospital assumptions. The 2026 inventory is not evidence of historical hospital operations. Actual capacity, validated predictive intervals and clinical calibration remain unavailable. The automatic QC workspace adds experimental case ranges and a transparent day-specific placement LP; the original seeded/radial hypothetical API remains for legacy experiments.
- Legacy forecast experiments/reports are retained separately, with unverified source hashes and ISO-calendar assumptions. Their shared loader now refuses this workbook's unresolved week metadata with an actionable error. Use the source-block pipeline below. Saved forecast runs contain predictions and provenance; `.joblib` models are not needed to replay them.

## Run locally

```powershell
cd apps/web
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000/dashboard. On shells without PowerShell script restrictions, `npm` works as usual. Map tiles require network access; the hospital table remains accessible without tiles.

Development output is isolated in `.next-dev`; production `build`/`start` use
`.next`. Always launch development with `npm.cmd run dev`: its project lock
prevents multiple development servers from writing the same cache, even on
different ports/hosts. Reuse the existing server when the launcher reports it is
already running. Do not invoke a second `npx next dev` directly.

From the repository root:

```powershell
python -m pip install -r services/engine/requirements-dev.txt
python -m uvicorn services.engine.main:app --reload --port 8000
```

The dashboard currently loads version-pinned public inventory directly and does not require the engine to browse hospitals. Check http://localhost:8000/readiness for engine blockers.

On Render, set the frontend service's server-only `ENGINE_BASE_URL` to the engine's
actual base URL and redeploy. Simulation/research pages automatically check and
wake a sleeping engine for up to two minutes before fetching data; users do not
need to open its URL separately. See [Render deployment](docs/render-deployment.md)
for configuration, startup behavior and troubleshooting.

The map-movie engine additionally uses declared Shapely 2.2.0 / pyproj 3.8.0
for projected polygon points. Install from `requirements-dev.txt` (which includes
base requirements), set server-only `ENGINE_BASE_URL=http://127.0.0.1:8000`, and
open http://localhost:3000/outbreak-response. No raw workbook is served publicly.

For `/research`, copy `apps/web/.env.example` to `apps/web/.env.local` and start
the engine above. `ENGINE_BASE_URL` stays server-only. Annual maps/tables work
without the engine; forecasts and simulation show a blocked state when it is
unavailable. The barangay map uses local geometry without external map tiles.

## Verification

```powershell
python -m pytest -q
python -m compileall -q scripts services/engine
cd apps/web
npm.cmd test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Frontend data tests require Node.js 22.18+ (tested on Node 24). See [UPRI verification](docs/upri-verification.md) and [hospital migration verification](docs/implementation-status.md) for executed results and limitations.

## Reproduce the UPRI integration

UPRI source files and manifest-pinned outputs must retain their exact bytes.
The repository's `.gitattributes` disables Git newline conversion for these
paths on Windows and macOS. Converting CRLF to LF invalidates SHA-256 checks
even when all values are unchanged. If the engine reports audited-input
validation failure, verify the pinned bytes before rebuilding or retraining;
do not replace expected hashes to accept an unverified checkout. See
[the newline recovery verification](docs/upri-verification.md#cross-platform-newline-recovery).

The immutable source inputs are in `data/raw/upri_noah/`. The embedded Data
Dictionary, original README and R validation script were reviewed before
preprocessing. The official validation report is separately pinned in
`data/reference/upri_noah/`; the upstream R workflow was not rerun (R unavailable).

```powershell
python -m pip install -r services/engine/requirements-ingest.txt
# Network only: retrieve report and verify local bytes against the pinned commit.
python scripts/fetch_upri_reference.py
# Audit and report discrepancies BEFORE preprocessing/training.
python scripts/audit_upri.py
$env:OMP_NUM_THREADS='2'
python scripts/integrate_upri.py
python scripts/build_qc_environmental_forecasts.py
python scripts/build_philippines_context.py
```

The integration reuses existing lag features and model settings, fits direct
1–4-block models at eight expanding quarterly origins per area in 2024–2025,
and compares persistence, seasonal naive, cases-only and weather variants on
identical targets. Training labels never exceed the origin; future weather is
excluded. This small retrospective evaluation does not establish prospective
accuracy. Cases-only is predeclared for replay, not chosen from test scores.
Legacy run intervals remain unestimated; the separate QC environmental artifact
adds experimental pre-origin residual ranges with disclosed poor coverage. Missing NCR years remain null; no
case/weather/annual missing values are imputed. Source-native 52-block indexing
avoids the legacy ISO conversion; exact issue dates remain null.

Outputs: `data/processed/upri_noah/{audit,geometry-audit,backtest,forecast-runs,manifest}.json`,
source-column observation copies, and public annual-count/GeoJSON derivatives.
Manifests carry original URLs, verified commit IDs, SHA-256s and transformations.
`DC_Mean` is preserved but never used for historical spatial weights.

API: `GET /v1/forecast-runs?area=QUEZON_CITY|NCR`, `GET /v1/research-evidence`,
`GET /v1/spatial-allocations/{forecastRunId}`, `POST /v1/scenarios`, and
`GET /v1/scenarios/{scenarioId}`. Legacy `/simulate` remains guarded; its old
contract does not imply consent to hypothetical hospital eligibility. New web
requests use the bounded, timed `/api/research/*` proxy. Saved scenarios are
local research artifacts, excluded from Git.

Three-minute demo: open `/research`, choose QC and an origin, compare four
forecasts with observed evaluation targets; toggle annual burden versus modeled
first-week allocation; select a hospital, review/acknowledge capacity assumptions,
run and inspect relative days 0/7/14/28, then export the reproducible JSON.

## Data and specifications

[Hospital source policy](docs/hospital-dataset-source-of-truth.md), [data sources](docs/data-sources.md), [architecture](docs/architecture-and-contracts.md), and [release checklist](docs/test-and-release-checklist.md) describe the provenance rules and remaining work. Legacy `public/data/facilities.json` and NHFR scripts remain available for separate reconciliation only. The 70 supplementary maternity/lying-in sites are outside the active hospital network and must never be summed into its capacity.
