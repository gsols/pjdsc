# PJDSC repository audit used to tailor the Codex instructions

**Chronology:** This page describes the **original uploaded** repository before the new dataset overlay. The updated delivery now includes a **different active QC data source**: 46 PhilHealth hospital/infirmary rows with all 46 provisional coordinates and 9,389 accredited beds. Its full policy is in `docs/hospital-dataset-source-of-truth.md`. The original figures below remain historical findings, **not current-source instructions**.

**Snapshot**: uploaded `pjdsc-main.zip`, inspected 2026-10-24. No existing application source files were changed during this audit. Counts below were computed from files in the uploaded archive, not from a live NHFR/PhilHealth feed.

## Current implementation — verified in source

| Area | Evidence | Finding |
|---|---|---|
| App | `apps/web/package.json` | Next.js 15, React 19, MapLibre 5, Lucide; TypeScript. No Recharts or Tailwind declared. |
| UI | `apps/web/app/dashboard/page.tsx`, `components/ncr-map.tsx` | One map-first page; facility display, 1–4 week selection, illustrative surge/hospitalization/occupancy/LOS sliders; simulation button posts to blocked route. |
| Current Next API | `apps/web/app/api/simulate/route.ts` | Returns 422 when `forecastRunId` missing; otherwise 503. Backend not integrated. |
| Backend | `services/engine/main.py` | `GET /health` returns stage foundation; `POST /simulate` always raises 503. |
| NCR geography | `apps/web/public/data/ncr-cities.geojson` | 17 city/municipality features; normalized `properties.area_id`; **not** QC barangay polygons. |
| NHFR facility data | `apps/web/public/data/facilities.json` | 165 NCR hospital records; 41 QC records; QC raw stored `authorizedBeds` sum=7,068; two QC capacities null. |
| Coordinate evidence | Same facilities JSON and `data/processed/*` | 29 points have `PROVISIONAL_HISTORICAL_MATCH` and all are QC; 136 entries have `UNAVAILABLE`; no `VERIFIED` points found. |
| License currency | Same facilities JSON | `licenseValidUntil` present but potentially stale for some records, e.g. `01/01/2025`; no current active-license conclusion possible from this field alone. |
| Historical model experiments | `scripts/*.py`, `services/engine/models/*.json` | Training/backtests are implemented as scripts; historical report JSON exists but original source workbook and trained `.joblib` model artifacts are not included. |
| One-week report | `apps/web/public/data/forecast-validation.json` | Historical QC MAE=34.99 and seasonal-naive=109.83; NCR MAE=134.08 and seasonal-naive=502.42 as **stored experiment results only**, not rerun here. |
| QC barangays | Complete ZIP listing | No annual barangay dengue table and no QC barangay boundary GeoJSON included. |
| Previous guidance | Earlier conversation | Separate PhilHealth 46 QC hospitals/infirmaries / 9,389 accredited beds is a different, unmerged dataset and is **not present in this ZIP**. |
| Stale documentation | `README.md`, `docs/data-sources.md` | Claims facilities/geometry not imported, contradicted by actual checked-in JSON/GeoJSON. |

## Highest-risk implementation gaps

1. **Safety and data provenance**: real clinical eligibility, effective dengue beds, staffing, vacancy and surge activation are unknown. Generic NHFR `Bed Capacity` is copied to field named `authorizedBeds` without a reproduced source-field definition. Treat source-reported figure as inventory only pending audit.
2. **Temporal provenance**: saved historical validation reports are not runnable dated forecast-run artifacts; no 2026 live case surveillance included. A valid historical forecast cannot be substituted with stored MAE scores.
3. **Backend integration**: current browser posts editable `facilities` array and null `forecastRunId` to a Next API that refuses simulation; design should use centrally resolved immutable source records and a real dated forecast-run ID.
4. **Geographic granularity**: citywide QC weekly case labels exist conceptually upstream but actual repo lacks barangay annual data and boundaries; no weekly barangay case labels or validated weekly local hotspot forecasting.
5. **Overcapacity realism**: patient-flow simulator is not yet written. Require normal staffed vs surge staffed vs unstaffed holding/unserved states and conservation tests, rather than capping admissions at 100% or assuming unlimited overflow.
6. **Old instructions location**: user's real layout is `apps/web` + `services/engine`, not `frontend` + `backend`; all new AGENTS paths are scoped accordingly.

## Checks actually executed during audit
- Python `compileall` for `scripts` and `services/engine`: passed at time of inspection.
- JSON parsed and facility/city/coordinate/status totals checked by script; NCR boundaries 17 features inspected.
- No dependency installation, live source download, forecasting re-training, complete application build, end-to-end test, load test or clinical validation was performed in this audit. Those remain implementation/release tasks.

Use the more detailed technical specs and task prompts before coding. This audit is an input-data/code inventory, **not** a production readiness approval.
