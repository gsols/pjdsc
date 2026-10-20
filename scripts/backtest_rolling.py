"""Expanding-window dengue backtest, with outbreak-week stratification.

Train only on targets before each evaluation year: 2024 and 2025.
Evaluate direct 1-4 week horizons using lagged observations available at
each forecast origin. Compare against persistence and cases-only modeling.

Run: python scripts/backtest_rolling.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

from backtest_four_week import HORIZONS, new_model
from train_dengue import AREAS, ROOT, features, inspect_workbook, load_series

OUT = ROOT / "services/engine/models/rolling_backtest.json"
YEARS = (2024, 2025)


def evaluate_area(workbook: Path, area: str):
    data, spec = load_series(workbook, area)
    full = features(data, spec["weather"])
    without_weather = full.drop(
        columns=[c for c in full if any(c.startswith(w + "_lag_") for w in spec["weather"])]
    )
    outcomes = []
    for year in YEARS:
        start = pd.Timestamp(f"{year}-01-01")
        end = pd.Timestamp(f"{year + 1}-01-01")
        for horizon in HORIZONS:
            # At row d, feature lags only use observations through d-1;
            # target is d+(horizon-1) weeks.
            step = horizon - 1
            target = data["cases"].shift(-step)
            target_date = data.index + pd.Timedelta(days=7 * step)
            persistence = data["cases"].shift(1)
            seasonal = data["cases"].shift(52 - step)
            valid = (
                full.notna().all(axis=1).to_numpy()
                & target.notna().to_numpy()
                & persistence.notna().to_numpy()
                & seasonal.notna().to_numpy()
            )
            # Training labels must be known before the evaluation year starts.
            train = data.index[valid & (target_date < start)]
            # All evaluation features available before their own target dates.
            test = data.index[valid & (target_date >= start) & (target_date < end)]
            if len(train) < 100 or len(test) < 30:
                raise ValueError(f"{area}, year={year}, horizon={horizon}: "
                                 f"insufficient samples ({len(train)} train, {len(test)} test)")
            actual = target.loc[test].to_numpy()
            threshold = float(target.loc[train].quantile(0.9))
            outbreaks = actual >= threshold
            item = {
                "year": year, "horizon_week": horizon,
                "train_samples": len(train), "test_samples": len(test),
                "outbreak_threshold_cases": round(threshold, 2),
                "outbreak_test_weeks": int(outbreaks.sum()),
                "persistence_mae": round(float(mean_absolute_error(actual, persistence.loc[test])), 2),
                "seasonal_naive_mae": round(float(mean_absolute_error(actual, seasonal.loc[test])), 2),
            }
            preds = {"persistence": persistence.loc[test].to_numpy()}
            for label, f in (("with_weather", full), ("cases_only", without_weather)):
                m = new_model()
                m.fit(f.loc[train], target.loc[train])
                preds[label] = np.maximum(0, m.predict(f.loc[test]))
                item[label + "_mae"] = round(float(mean_absolute_error(actual, preds[label])), 2)
            if outbreaks.any():
                for label, pred in preds.items():
                    item[label + "_outbreak_mae"] = round(
                        float(mean_absolute_error(actual[outbreaks], pred[outbreaks])), 2
                    )
            else:
                item["outbreak_note"] = "No evaluation weeks exceeded the training-only threshold"
            outcomes.append(item)
    return {
        "area": area,
        "evaluation": "Annual expanding-window refit; each year's training targets strictly precede that year",
        "future_weather_used": False,
        "outbreak_definition": "Actual test cases at or above 90th percentile of training target counts",
        "caveat": "Historical backtest, not prospective 2026 validation",
        "metrics": outcomes,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    args = parser.parse_args()
    inspect_workbook(args.workbook)
    reports = [evaluate_area(args.workbook, area) for area in AREAS]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(reports, indent=2))
    print(f"Report saved to {OUT}")


if __name__ == "__main__":
    main()
