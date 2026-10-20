# Aligned dengue forecasting comparison

This experiment evaluates the **same** 26 historical forecast issue weeks for each area (13 in 2024 and 13 in 2025), each with 1-4 week targets.

## Run from repository root

```bash
# Existing FastAPI Python dependencies (scikit-learn, pandas, openpyxl)
python -m pip install -r services/engine/requirements.txt

# Requires existing committed / generated AutoETS benchmark JSON
python scripts/compare_forecasters.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"
```

If `services/engine/models/autoets_backtest.json` is absent, install the additional benchmark dependency and run:

```bash
python -m pip install -r services/engine/requirements-benchmarks.txt
python scripts/benchmark_autoets.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"
```

Output: `services/engine/models/model_comparison.json`

## Fairness rules

- At each origin, persistence, AutoETS and both gradient boosting variants are evaluated on the **same** target week, actual case count, and high-case cutoff.
- Historical AutoETS output is reused without retraining. A date/count check prevents comparing incompatible datasets.
- Gradient boosting models are re-fitted for each origin and each horizon. Training targets must be on or **before the issue week**. Lagged weather inputs are historical only.
- Weekly training time series are reindexed by actual calendar dates. Missing data are not treated as zero or adjacent observations.
- The high-case definition is the pre-existing historical training-data 90th percentile, **not** an official outbreak declaration.
- High-case sample size may be as small as 1-3, making estimated outbreak recall and MAE unstable.
- The same years have been used for previous model exploration: this is retrospective comparison, **not** an untouched external holdout or prospective validation.

## What to inspect

- `areas[].annual_horizon_metrics`: methods evaluated in 2024 and 2025, separated by horizon.
- `areas[].overall_horizon_metrics`: matched 2024+2025 horizon comparisons.
- `areas[].forecast_rows`: individual dated predictions, actual cases, model training sample counts, and cutoffs.
- Primary benchmark: **persistence**. Do not select a more complex model solely due to lower error in a handful of high-case test weeks.

No model is yet wired into live 2026 surveillance or hospital demand simulation.
