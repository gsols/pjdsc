# Forecasting engine: methodological specification and acceptance tests

## Forecast scope and data availability
Forecast **weekly reported dengue cases** separately for `QUEZON_CITY` and `NCR` for horizons 1–4 weeks. Neither has live 2026 surveillance data in the uploaded repo. The available saved reports are **retrospective, historical** validation; the original UPRI-NOAH workbook must be provided with exact version, license and checksum before retraining. Existing code expects:

```text
QC: worksheet "QC Data", `YR`, `WN`, target `DC_QC`,
    features `RF_NASA`, `Temp_ERA5-Land`, `RH_ERA5-Land`.
NCR: worksheet "Regional Data", `REGION == NCR`, `YR`, `WN`,
     target `DC_DOH`, weather `RF_HDX`, `Temp_ERA5-Land`, `SH_ERA5-Land`.
```

These are the field names used by `scripts/train_dengue.py`, **not** a guarantee every future release exposes the same schema. Validate source before analysis. Preserve quality flags, known missingness, and absence of NCR 2020–2021 observations. UTC timestamps are not appropriate replacements for original local epidemiological week rules; use documented ISO week start/zone consistently and check year-boundary week 53.

## Date leakage definition
For forecast issued at epidemiological week `t`, predictors may only use information actually published/available by that issue. Training examples whose **target** dates exceed `t` are forbidden. If the publication/reporting delay is not known, define a transparent observed-through cutoff earlier than issue. No target actuals from `t+1` onward, annual 2025 barangay totals, or weather observations from target weeks may be used in a Jan 2025 replay.

Existing scripts use lag features with a row/target shift; unit-test that their `feature_date`, `issue_date`, and `target_date` agree for each 1–4 horizon, particularly near year boundaries and NCR missing-year gap.

## Baselines and candidates
- Seasonal naive: comparable week in prior year, with missing-week handling; 52-week shift may be imperfect around ISO week 53 — document and test.
- Persistence: latest observed weekly cases known at issue; **do not** confuse persistence with seasonal naive.
- Cases-only Poisson-compatible gradient boosting: existing `HistGradientBoostingRegressor(loss='poisson')` where target is nonnegative.
- Cases + lagged weather gradient boosting: compare fairly on same origins/target values. Report when adding weather harms out-of-time accuracy.
- Optional interpretable negative binomial count regression and `AutoETS` for benchmarking; package dependency is currently in `requirements-benchmarks.txt`.

The compared models need not match exact internal features, but their forecast origin, horizon, target actuals and reporting-cutoff policy must match. Use a deterministic retraining/selection process; do not tune on the final reported holdout without disclosure.

## Operational forecast workflow
1. Validate the source and build a continuous **calendar index** without changing missing years/weeks to 0 cases.
2. Generate lagged case features and lagged weather features only where observations were available at that issue; log coverage and missing values.
3. For each rolling origin and each horizon `h∈{1,2,3,4}`, train on known targets and forecast exactly `targetWeek = origin + h weeks` (document whether issue week counted as day 0).
4. Compare all methods on **matched** forecast rows. Aggregate MAE, RMSE, MASE (if defined), interval coverage and mean interval width by scope/horizon and outbreak strata. Show sample counts.
5. For 2025 outbreak replay, choose issue dates before observed outbreak milestones; **freeze** data and spatial weights at each issue. Plot forecast, actual and baseline on aligned weekly dates.
6. Select model by predefined criteria including general performance and underprediction cost; model complexity is not a reason to choose an inferior forecast. Record fallback if trained model is absent.
7. Generate central weekly `expectedCases` and intervals from an empirically evaluated method (conformal/blocked residual bootstrap, appropriate count distributions), track target-week correlation. Never fabricate `±20%` as a predictive interval.
8. Store immutable historical run with `forecastRunId`, issue date, source hash, model hash, feature schema, code version, run seed and metrics; only then expose for simulation.

## Uncertainty propagation
Forecast weekly cases `C_{t+h}` with a central prediction and honest interval; map to daily expected arrivals using a documented day profile summing to 1 for each 7-day block. Let `q` be hospitalization fraction **assumption**, `L` length-of-stay distribution, `δ` report-to-admission delay; expected admissions `E[A_d] = q∑_s C_s p(d-s|δ)` where `p` is a normalized delay distribution. Scenario stochastic runs may sample from count model and assumptions with a recorded seed; preserve conservation per run and distinguish expected fractions from sampled integer individuals. Spatial uncertainty is additional, not automatically included in the city-level interval.

## Existing historical evidence and limitations

**Implemented experimental extension — 2026-10-24 20:14:55 +08:00:** the QC
environmental variant now exports ranges from 38–39 completed pre-origin
four-horizon residual paths per issue. Partial-window ranges preserve within-path
correlation. Eight-origin weekly holdout coverage is only 50%, 62.5%, 62.5%,
62.5% (horizons 1–4) against the 80% target, so no calibrated coverage guarantee
is claimed. The UI discloses undercoverage and conditional annual-weight spatial
allocation. These separate artifacts do not overwrite legacy evaluations or
resolve the source calendar conflict. See `qc-simulation-workspace.md`.
- `services/engine/models/validation_report.json` and `apps/web/public/data/forecast-validation.json` report **one-week-ahead** out-of-time experiments; the 2024–2025 test years have been used during model exploration. Not untouched prospective validation.
- `services/engine/models/four_week_backtest.json`, `rolling_backtest.json` and `autoets_backtest.json` report historical multi-horizon and method evidence; **read their own assumptions** and do not extrapolate results to 2026 operations.
- `scripts/compare_forecasters.py` writes `model_comparison.json` only after executing against the actual workbook and AutoETS report. That file is absent from this upload; do not assert aligned comparison succeeded today.
- High-case thresholds at the 90th training percentile are **research thresholds**, not official DOH outbreak declarations. True small samples need confidence intervals/cautions.

## Acceptance tests
- Reject nonnegative violations, duplicate ISO weeks, missing target observations, future target-label leakage, future weather, mismatched year-week, mismatched AutoETS actuals, invalid run dates.
- Verify model fit uses only features/training labels available at issue date across 2019–2022 regional gap.
- Verify horizon `h=1..4` precisely aligns origin -> target in exported rows and 2025 replay.
- Verify source flags/missing weather are handled and reported, never silently filled as zero; transformations fitted within folds only.
- Verify identical matched-origin actuals for method comparison and stable metrics on deterministic fixtures.
- Verify predictive intervals are monotonic `0<=lower<=central<=upper` if model defines central appropriately; report coverage by horizon and interval method.
- Verify NCR total already contains QC (no double-count when displaying both).
- Full actual-file test is blocked and clearly reported when source workbook is missing.
