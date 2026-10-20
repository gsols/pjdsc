"""Leakage-aware direct 1-4-week historical dengue forecasting backtest.

Run from repository root:
    python scripts/backtest_four_week.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"

For each forecast origin, uses only case/weather history available through
that origin. Trains direct horizon-specific models using samples whose target
dates precede 2024. Scores forecast target weeks in 2024-2025.
No model is used for 2026 nowcasts.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from train_dengue import AREAS, ROOT, features, inspect_workbook, load_series

OUT = ROOT / "services/engine/models/four_week_backtest.json"
HORIZONS = (1, 2, 3, 4)
SPLIT = pd.Timestamp("2024-01-01")


def new_model():
    return HistGradientBoostingRegressor(
        loss="poisson", max_iter=160, max_leaf_nodes=12,
        min_samples_leaf=15, learning_rate=0.04,
        l2_regularization=5.0, random_state=42
    )


def score_area(workbook, area):
    df, spec = load_series(workbook, area)
    all_features = features(df, spec["weather"])
    # features indexed at target one week after the forecast origin; all
    # feature lags begin at 1, so no information from the target week enters.
    weather_features = all_features
    no_weather_features = all_features.loc[:, [
        col for col in all_features if not any(
            col.startswith(w + "_lag_") for w in spec["weather"]
        )
    ]]
    output = []
    for horizon in HORIZONS:
        # A row dated d has its latest observations through d-1 week.
        # Predict cases at d + (horizon-1) weeks.
        target = df["cases"].shift(-(horizon - 1))
        target_dates = df.index + pd.Timedelta(weeks=horizon - 1)
        # One full year's weekly seasonal reference at forecast target.
        seasonal = df["cases"].shift(52 - (horizon - 1))
        persistence = df["cases"].shift(1)
        rows = []
        for index in weather_features.index:
            j = weather_features.index.get_loc(index)
            if target_dates[j] < SPLIT:
                split = "train"
            elif target_dates[j] <= df.index.max():
                split = "test"
            else:
                continue
            if pd.isna(target.iloc[j]):
                continue
            if weather_features.loc[index].isna().any():
                continue
            if pd.isna(seasonal.iloc[j]) or pd.isna(persistence.iloc[j]):
                continue
            rows.append((index, split))
        train = [i for i, split in rows if split == "train"]
        test = [i for i, split in rows if split == "test"]
        if len(train) < 100 or len(test) < 30:
            raise ValueError(f"{area} horizon {horizon}: too few valid rows ({len(train)} train, {len(test)} test)")
        y_train = target.loc[train]
        y_true = target.loc[test].to_numpy()
        scores = {
            "horizon_week": horizon,
            "training_samples": len(train),
            "testing_samples": len(test),
            "forecast_target_start": min(i + pd.Timedelta(weeks=horizon - 1) for i in test).date().isoformat(),
            "forecast_target_end": max(i + pd.Timedelta(weeks=horizon - 1) for i in test).date().isoformat(),
            "persistence_mae": round(float(mean_absolute_error(y_true, persistence.loc[test])), 2),
            "seasonal_naive_mae": round(float(mean_absolute_error(y_true, seasonal.loc[test])), 2),
        }
        for label, feat in (("with_weather", weather_features), ("cases_only", no_weather_features)):
            model = new_model()
            model.fit(feat.loc[train], y_train)
            prediction = np.maximum(0, model.predict(feat.loc[test]))
            scores[label + "_mae"] = round(float(mean_absolute_error(y_true, prediction)), 2)
        scores["weather_improved_mae"] = scores["with_weather_mae"] < scores["cases_only_mae"]
        output.append(scores)
    return {
        "area": area,
        "evaluation": "direct horizon-specific historical holdout; training target < 2024; test target 2024-2025",
        "future_weather_used": False,
        "four_week_forecast_live": False,
        "metrics": output,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    args = parser.parse_args()
    quality = inspect_workbook(args.workbook)
    print("Validated sheets:", {k: v["sheet"] for k, v in quality.items()})
    report = [score_area(args.workbook, area) for area in AREAS]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved backtest report to {OUT}")


if __name__ == "__main__":
    main()
