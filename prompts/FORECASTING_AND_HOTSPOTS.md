# Codex task — integrate historical dengue forecasting and QC hotspot allocation

**Hospital data interface:** When a QC forecast is passed to hospital simulation, resolve facility identifiers from the **active** PhilHealth QC 46-row dataset described in `docs/hospital-dataset-source-of-truth.md`, not old NHFR `facilities.json`. Forecast QC/NCR case series remain UPRI-NOAH; this migration changes **hospital input only**.

Read `AGENTS.md`, `services/engine/AGENTS.md`, `scripts/AGENTS.md`, `data/AGENTS.md`, `docs/forecasting-validation-spec.md`, `docs/spatial-hotspots-spec.md`, `docs/architecture-and-contracts.md` and the existing `scripts/*.py` before editing.

## Desired deliverable
A **working, testable historical** 1–4-week forecast inference/replay pipeline for QC and NCR (separately), an explicitly modeled QC weekly barangay demand allocation engine when verified annual inputs exist, immutable dated forecast runs, API endpoints, and honest frontend presentation. **Not** an invented 2026 real-time feed or fabricated weekly barangay observations.

### Step 1 — source audit
- Confirm whether the original UPRI-NOAH Excel workbook exists **outside this uploaded ZIP** in the local repository. If absent, describe exact expected schema/sheets, checksum requirement and acquisition from a verified version; build reproducible code and fixture tests but do not create a fake production forecast.
- Audit existing saved `validation_report.json`, `rolling_backtest.json`, `four_week_backtest.json`, `autoets_backtest.json` and script assumptions. Do not quote absent `model_comparison.json` as completed.
- Identify real source case cutoff and missing weather/quality flags; prevent NCR 2020–2021 from being treated as uninterrupted weekly data.

### Step 2 — train/backtest/refactor
- Extract reusable loaders, predictors, evaluators and run serialization from `scripts/train_dengue.py`, `backtest_four_week.py`, `backtest_rolling.py`, `benchmark_autoets.py`, `compare_forecasters.py`. Preserve existing script CLI behavior or update it with documented migration.
- Implement explicit issue-date-based direct 1–4-week forecasts. For every model, require feature and target availability at forecast issue. Add date-shift tests, calendar gap tests and year boundary tests.
- Use matched-origin comparisons of persistence, seasonal naive, case-only and cases+weather; optionally AutoETS/negative-binomial if dependencies are declared. Report MAE, RMSE, high-case alert metrics, sample count and interval coverage per horizon. Do not assume that a more complex algorithm wins or that weather always improves skill.
- Generate valid intervals only with empirical evaluation; record calibration method. Immutable `ForecastRun` must include source/model/checksum, issue date, `QUEZON_CITY` or `NCR`, week starts, central + interval cases, validation, and uncertainty caveat.
- Expose readonly `/v1/forecast-runs` listing/retrieval API, plus Next.js BFF and `/forecast` page. Keep model-specific scores sourced from stored reports, not hardcoded into UI.

### Step 3 — QC hotspots
- Confirm annual barangay case counts and QC polygons are present and licensed; currently **absent from the uploaded project**. Build schema/readers/checks regardless, but with the UI disabled until verified data are supplied.
- Validate 142 entities, PSGC joins, boundary versions, years and lack of future annual information at replay origin.
- Compute predeclared source-cutoff-safe smoothed historic weights; `allocatedCases[b,w] = w_b × QCCases[w]`, conserving total exactly (float precision or fixed-sum integer rounding).
- Provide annual observed barangay burden and modeled weekly allocation as separate geospatial layers/legends. Only show rates per population after joining verified population denominators; otherwise label raw counts.
- Validate historic annual holdouts for spatial weights if annual years permit; do not call this weekly hotspot forecast accuracy.
- Add an optional localized **hypothetical scenario** shock weight distribution, separately labeled, not predicted contagion between barangays.

### Step 4 — integration/tests
- Connect source and forecast validation state to `apps/web/app/dashboard/page.tsx` without gutting current MapLibre map. Preserve NCR boundary selection, provisional hospital points and missing-data guards.
- Add automated tests for source schema mismatch, missing workbook, unknown geography, cutoff leakage, no-future weather, QC vs NCR non-additivity, 4-horizon date alignment, allocated sum, missing polygons and uncertainty labeling.
- Run actual checks when dependencies/data available; deliver working CLI, API docs, source manifest and changed-file summary with explicit remaining blockers.

## Completion rules
Do not display future 2026 cases without authoritative 2026 observations; do not claim a weather-driven relationship is causal; do not predict week-specific barangay outbreaks absent weekly training labels. One **correct historical QC forecast** with honest uncertainty is more valuable than a synthetic high-resolution map.
