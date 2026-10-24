# Engineering, analytical validation and release checklist

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

## A. Source QA (fail closed)
- [ ] Pin source workbook version/license/hash; store reproducible retrieval instructions.
- [ ] Confirm QC and NCR source sheet schema, consistent `YR/WN`, negative/missing cases, 2020–2021 NCR gap, 2025 data cutoff and data-quality flags.
- [ ] Verify NHFR `Bed Capacity` field definition and individual licensing/eligibility; don't use stale license date to assert current operation.
- [ ] **Active QC primary:** 46 PhilHealth hospital/infirmary records; 9,389 accredited beds; 46 finite/provisional facility points inside the QC polygon; **zero verified entrances**. NHFR 165-NCR/41-QC remains separate as historical/crosswalk only.
- [ ] Do **not merge or append** NHFR to the active QC PhilHealth hospital roster. Test dashboard and simulator both use the canonical PhilHealth 46-row IDs; no fallback to old `/data/facilities.json`.
- [ ] Acquire/check QC annual barangay table and boundary geometry for hotspots; no unauthorized data fabrication.
- [ ] Record source and transform hashes, unit, scope, as-of, quality limitations.

## B. Forecast tests
- [ ] Historical issue dates, target horizons 1–4, no target/weather/spatial future leakage.
- [ ] Holdout/backtest forecast rows are aligned to common dates and target values.
- [ ] Distinguish model historical one-week validation from multi-horizon evaluation.
- [ ] No missing ISO week filled as 0; NCR data gap preserved.
- [ ] Per-horizon MAE, baseline, cases-only ablation, uncertainty coverage, sample sizes, high-case precision/recall.
- [ ] Explicitly label whether 2024–2025 results were previously used for model selection; no unsupported significance claim.
- [ ] Missing workbook/artifact produces actionable failure, not invented 2026 forecast.

## C. Spatial tests
- [ ] Every mapped QC barangay has unique verified PSGC mapping and valid polygon; annual case counts have year/source.
- [ ] Test annual held-out spatial allocations, not fake weekly barangay ground truth.
- [ ] Sum of QC allocated projected cases equals QC forecast per week/day; zero and missing counts handled differently.
- [ ] Early-2025 replay does not use 2025 completed-year weights.
- [ ] Label projected burden vs observed annual count; optional population rates only with verified denominators.

## D. Patient-flow and optimization tests
- [ ] Daily case totals reconcile to four weekly forecasts; admission delay + LOS + warm start explicit.
- [ ] Daily patient flow conserves arrivals, placements, holding, queue, transfer and exits without negative/ghost people.
- [ ] Null/zero/missing facility capacity blocks verified admissions and avoids divide by zero.
- [ ] Specialty/non-general/pediatric/lying-in eligibility unknown by default; no automatic all-hospital availability.
- [ ] Example with 100 normal beds + 30 supported surge beds + 135 present yields 130 supported census + 5 holding (if holding enabled), occupancy 130% of normal and 100% of supported; on-site headcount 135% of normal.
- [ ] Surge activation lag and finite staffing/space constraints enforced; activation zero disables extra supported beds.
- [ ] Optimizer and baseline share same demand, capacities, clinical restrictions and RNG seed. Report unresolved/holding, travel/access, distribution of burden, solver feasibility.
- [ ] No claim that a modeled difference equals actual intervention effectiveness or patient referral guidance.

## E. UI / API quality
- [ ] `/dashboard` still works, NCR 17-boundary file loads, hospital markers remain provisional where necessary, non-geocoded hospitals remain in table.
- [ ] Historical forecast endpoints return immutable dated run metadata and validated schema; error codes distinguish missing run vs unavailable engine.
- [ ] `/outbreak-response` handles input validation, localized mode unavailable without geometry, on-demand simulation, day 0–28, day 7/14/28 shortcuts, cumulative vs snapshot numbers and stale response clearing.
- [ ] Normal-bed occupancy can exceed 100% with distinct staffed surge, holding, unserved and supported denominator statuses.
- [ ] Accessibility: keyboard sliders, map fallback, meaningful labels, focus states, non-color-only legends, narrow mobile viewport, source citation drawer.
- [ ] CORS/server-only URLs/timeouts and input bounds; no PHI; no browser-submitted arbitrary authoritative facility records.

## F. Reproducibility / commands

```bash
# From repository root:
python -m compileall -q scripts services/engine
python -m pip install -r services/engine/requirements.txt
# After adding pytest to declared dependencies:
python -m pytest

# From the Next.js application folder:
cd apps/web
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

Commands above are the **required execution targets**, not claims that installation/tests/build were executed in this review. Run only against actual available dependencies; report missing inputs instead of silently skipping. Create CI workflows for tests, schema contracts, lint/type-check/build with locked versions; keep a clean sample `.env.example`. Ensure no credentials, cache directories, giant raw licensed files or patient records committed.

## G. Reporting / 3-minute demonstration
- [ ] At least one *real sourced historical* QC forecast-origin backtest shown against observed cases with dated cutoff.
- [ ] Uncertainty and annual-spatial allocation caveat visible.
- [ ] Hospital pressure example shows staffed vs surge vs holding accounting and thresholds.
- [ ] Day 7, 14, 28 slider changes map, chart and KPIs from same computed run.
- [ ] Honest baseline-vs-optimized comparison with output units and caveat.
- [ ] Sources/metadata/export and simple steps to reproduce included.
- [ ] Final release explicitly labeled research prototype unless live calibration, performance/security testing, clinical review and real data partnerships are completed.
