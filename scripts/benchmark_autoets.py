"""Benchmark pretrained-free AutoETS against persistence on real 4-week forecasts.

AutoETS refits at each historical forecast origin (2024-2025), using ONLY
past observed dengue case counts. NCR's 2020-2021 gap is never bridged.
Use the same forecast origins for both methods and evaluate each horizon.

From repo root:
  python -m pip install -r services/engine/requirements-benchmarks.txt
  python scripts/benchmark_autoets.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"

Quick screen: --stride 8 --seasonality off
Default:      --stride 4 --seasonality auto
Output: services/engine/models/autoets_backtest.json
"""
import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from train_dengue import AREAS, ROOT, inspect_workbook, load_series

OUTPUT = ROOT / "services/engine/models/autoets_backtest.json"
FIRST_TARGET = pd.Timestamp("2024-01-01")
LAST_TARGET = pd.Timestamp("2025-12-22")
SEASON_LENGTH = 52


def continuous_history(data, origin, max_weeks):
    """Use only weekly observations up through origin; trim before last gap."""
    values = data.loc[:origin, "cases"]
    missing = values[values.isna()]
    if not missing.empty:
        values = values.loc[values.index > missing.index[-1]]
    return values.tail(max_weeks)


def forecast_autoets(values, seasonality):
    # Full seasonal models with 52 states need several complete cycles.
    # Test nonseasonal otherwise; do not interpolate missing cases.
    seasonal = seasonality == "auto" and len(values) >= 3 * SEASON_LENGTH
    from statsforecast.models import AutoETS
    model = AutoETS(
        season_length=SEASON_LENGTH if seasonal else 1,
        model="ZZZ" if seasonal else "ZZN",
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        prediction = model.fit(y=values.to_numpy(dtype=np.float64)).predict(h=4)["mean"]
    prediction = np.maximum(0, np.asarray(prediction, dtype=float))
    if prediction.shape != (4,) or not np.isfinite(prediction).all():
        raise ValueError("AutoETS returned an invalid four-week forecast")
    return prediction, ("seasonal_52" if seasonal else "nonseasonal")


def metrics(rows, method, outbreak_only=False):
    chosen = [r for r in rows if not outbreak_only or r["high_case_week"]]
    if not chosen:
        return None
    actual = np.array([r["actual_cases"] for r in chosen], dtype=float)
    pred = np.array([r[method] for r in chosen], dtype=float)
    gap = actual - pred
    under = np.maximum(0, gap)
    return {
        "weeks": len(chosen),
        "mae": round(float(mean_absolute_error(actual, pred)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, pred))), 2),
        "mean_underprediction_cases": round(float(under.mean()), 2),
        "underprediction_fraction": round(float((gap > 0).mean()), 3),
    }


def evaluate_area(workbook, area, stride, seasonality, context_weeks):
    data, _ = load_series(workbook, area)
    cases = data["cases"]
    origins = pd.date_range(
        FIRST_TARGET - pd.Timedelta(days=7),
        LAST_TARGET - pd.Timedelta(days=28),
        freq=f"{stride}W-MON",
    )
    rows = []
    variants = {}
    for origin in origins:
        history = continuous_history(data, origin, context_weeks)
        if len(history) < 80 or history.isna().any():
            continue
        future_dates = [origin + pd.Timedelta(days=7 * h) for h in range(1, 5)]
        if any(d not in cases.index or pd.isna(cases.loc[d]) for d in future_dates):
            continue

        prediction, variant = forecast_autoets(history, seasonality)
        variants[variant] = variants.get(variant, 0) + 1

        # For each test YEAR, define the high-case cutoff using data observed
        # before that year, never including test outcomes.
        year = future_dates[0].year
        year_start = pd.Timestamp(f"{year}-01-01")
        past_year = continuous_history(data, year_start - pd.Timedelta(days=7), context_weeks)
        if len(past_year) < 80:
            continue
        threshold = float(past_year.quantile(0.9))
        last_observed = float(history.iloc[-1])
        year_ago = cases.shift(52)
        for h, target_date in enumerate(future_dates, start=1):
            observed = float(cases.loc[target_date])
            old = year_ago.loc[target_date]
            rows.append({
                "issue_week": origin.date().isoformat(),
                "target_week": target_date.date().isoformat(),
                "year": year,
                "horizon": h,
                "actual_cases": observed,
                "autoets": round(float(prediction[h - 1]), 3),
                "persistence": last_observed,
                "seasonal_naive": float(old) if pd.notna(old) else None,
                "high_case_cutoff": round(threshold, 2),
                "high_case_week": bool(observed >= threshold),
                "model_variant": variant,
            })
    if not rows:
        raise ValueError(f"{area}: no eligible evaluation origins")
    report = []
    for year in (2024, 2025):
        for h in range(1, 5):
            sample = [r for r in rows if r["year"] == year and r["horizon"] == h]
            if not sample:
                continue
            report.append({
                "year": year,
                "horizon_week": h,
                "evaluated_origins": len(sample),
                "high_case_weeks": sum(r["high_case_week"] for r in sample),
                "autoets": metrics(sample, "autoets"),
                "persistence": metrics(sample, "persistence"),
                "seasonal_naive": metrics(
                    [r for r in sample if r["seasonal_naive"] is not None],
                    "seasonal_naive",
                ),
                "high_case_autoets": metrics(sample, "autoets", outbreak_only=True),
                "high_case_persistence": metrics(sample, "persistence", outbreak_only=True),
            })
    return {
        "area": area,
        "model": "StatsForecast AutoETS, zero covariates, refit at each forecast origin",
        "evaluation": "2024-2025 four-week historical forecasts; same origins as persistence",
        "case_history_context_weeks_max": context_weeks,
        "no_future_cases_or_weather_used": True,
        "origin_stride_weeks": stride,
        "seasonality_policy": seasonality,
        "model_variants_by_origin": variants,
        "metrics": report,
        "forecast_rows": rows,
        "cautions": [
            "Retrospective evaluation only; not a live 2026 forecast.",
            "2024-2025 were previously used for model development, not an untouched final test set.",
            "High-case threshold is a research-defined training-history 90th percentile, not a DOH outbreak declaration.",
            "Only case-history inputs are used; weather is not used in this experiment.",
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--stride", type=int, default=4, choices=(1, 2, 4, 8))
    parser.add_argument("--seasonality", choices=("auto", "off"), default="auto")
    parser.add_argument("--context-weeks", type=int, default=208)
    args = parser.parse_args()
    if args.context_weeks < 156:
        raise SystemExit("--context-weeks must be at least 156")
    inspect_workbook(args.workbook)
    result = []
    for area in AREAS:
        print(f"Benchmarking {area}...", flush=True)
        report = evaluate_area(
            args.workbook, area, args.stride, args.seasonality, args.context_weeks
        )
        result.append(report)
        for m in report["metrics"]:
            a, p = m["autoets"], m["persistence"]
            print(f'  {m["year"]} +{m["horizon_week"]}w: '
                  f'AutoETS MAE={a["mae"]}, persistence MAE={p["mae"]}; '
                  f'high-case weeks={m["high_case_weeks"]}')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Saved: {OUTPUT}")


if __name__ == "__main__":
    main()
