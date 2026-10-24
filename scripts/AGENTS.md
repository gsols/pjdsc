# Codex instructions — `scripts` (existing data science and ingestion scripts)

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

Preserve and extend `train_dengue.py`, `backtest_four_week.py`, `backtest_rolling.py`, `benchmark_autoets.py`, `compare_forecasters.py`, `import_nhfr.py`, `build_facility_map.py`, and `match_hospital_coordinates.py` rather than replacing working experiments.

## Script-specific concerns found in the upload
- `train_dengue.py` creates **one-week** historical holdout results using observed past weeks. Its `forecast-validation.json` should not be used as proof of operational 1–4-week prospective forecast performance.
- `backtest_four_week.py` and `backtest_rolling.py` provide historical direct-horizon comparisons; `compare_forecasters.py` provides matched-origin comparisons against stored AutoETS output, but there is **no current** `model_comparison.json` in the ZIP and the original workbook is missing. Do not claim those full comparisons were rerun in this review.
- `scripts/build_facility_map.py` asserts exactly 165 NHFR NCR hospitals; treat this as an expected-count fixture for the **particular saved extract**, not a universal invariant for future exports.
- `scripts/import_nhfr.py` labels NHFR `Bed Capacity` as `authorizedBeds`; source dictionary verification is required before this transformation can be treated as regulatory definition rather than a project convention.
- Candidate facility coordinates are based on historical name/barangay matching and remain **provisional**, even where string similarity = 1.0.

## Upgrade requirements
- Make all scripts accept explicit CLI input and output paths, `--as-of`/origin where relevant, reproducible seeds and `--help`. Resolve paths relative to project root reliably. Do not hardcode a user-specific Windows/macOS folder.
- Never depend on hidden private Excel workbooks or network responses without declaring their version, checksum, and acquisition instructions.
- Write a source manifest with license/terms, URL, published or accessed date as appropriate, SHA-256 hash, source schema, transform version, and output hash. For data unavailable due to licensing/size, provide instructions and a meaningful missing-data error.
- Validate source sheet/column names, ISO week/year, duplicate weeks, invalid/negative cases, weather flags, gaps, source CRS, region and municipality PSGC, ambiguous facility names and capacity definitions.
- Check all forecast features and train labels are actually known **by each model issue date**. Fit any transforms and selection only on training periods. Compare methods on identical observed cases, origins, targets, definitions and available input sets.
- Do not optimize hyperparameters on a holdout then still call that holdout untouched. Keep exploratory 2024–2025 comparisons labeled retrospective; do not promise prospective accuracy.
- Keep no future annual barangay data in spatial weights for replay years. Verify totals and reconcile missing barangay IDs, no silent redistribution of unmapped features.
- When updating `apps/web/public/data` outputs, use atomic writes, version them by provenance and regenerate contract fixtures from verified source, never hand-edit numbers in UI artifacts.
- Refactor shared I/O and metrics into importable modules only if it simplifies current code; preserve CLI compatibility or update documentation.
- Add dedicated tests with miniature synthetic fixtures *labeled fixtures*, evaluating deterministic output, source mismatch handling, NA preservation, calendar gap and target leakage.
