# Simulation session handoff

Updated 2026-10-24 22:03:31 +08:00 (Asia/Manila). Read root/scoped AGENTS.md first.
Preserve existing working-tree edits; do not restart the application or replace data.

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
