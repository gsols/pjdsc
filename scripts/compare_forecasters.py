"""Compare dengue forecasters on exactly matched historical forecast origins.

Reuses verified AutoETS forecast rows from scripts/benchmark_autoets.py.
At each issue week refits two direct-horizon HistGradientBoosting models
using ONLY targets already observed by that week. All methods share
the SAME actual counts, origin dates and high-case thresholds.

From repo root:
    python scripts/compare_forecasters.py "/path/to/Dengue_Environmental Vars_Dataset.xlsx"

Prerequisite: run scripts/benchmark_autoets.py and save its JSON output.
Output: services/engine/models/model_comparison.json

This is retrospective model comparison, NOT real-time dengue surveillance.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

from backtest_four_week import new_model
from train_dengue import AREAS, ROOT, features, inspect_workbook, load_series

DEFAULT_AUTOETS = ROOT / "services/engine/models/autoets_backtest.json"
DEFAULT_OUT = ROOT / "services/engine/models/model_comparison.json"
METHODS = ("persistence", "autoets", "gb_cases_only", "gb_with_weather")


def score(rows, key):
    """Return matched-row regression and high-case alert metrics."""
    if not rows:
        return None
    actual = np.asarray([r["actual_cases"] for r in rows], dtype=float)
    predicted = np.asarray([r[key] for r in rows], dtype=float)
    cutoffs = np.asarray([r["high_case_cutoff"] for r in rows], dtype=float)
    signed_error = actual - predicted
    high_actual = actual >= cutoffs
    high_predicted = predicted >= cutoffs
    true_positive = int((high_actual & high_predicted).sum())
    false_positive = int((~high_actual & high_predicted).sum())
    return {
        "samples": len(rows),
        "mae": round(float(np.abs(signed_error).mean()), 2),
        "rmse": round(float(np.sqrt(np.square(signed_error).mean())), 2),
        "mean_underprediction_cases": round(
            float(np.maximum(signed_error, 0).mean()), 2
        ),
        "underprediction_fraction": round(float((signed_error > 0).mean()), 3),
        "high_case_samples": int(high_actual.sum()),
        "high_case_mae": (
            round(float(np.abs(signed_error[high_actual]).mean()), 2)
            if high_actual.any() else None
        ),
        "high_case_mean_underprediction": (
            round(float(np.maximum(signed_error[high_actual], 0).mean()), 2)
            if high_actual.any() else None
        ),
        "high_case_recall": (
            round(true_positive / int(high_actual.sum()), 3)
            if high_actual.any() else None
        ),
        "alert_precision": (
            round(true_positive / (true_positive + false_positive), 3)
            if true_positive + false_positive else None
        ),
        "false_alerts": false_positive,
    }


def evaluate_area(workbook, area, original):
    df, spec = load_series(workbook, area)
    x_weather = features(df, spec["weather"])
    x_cases = x_weather.loc[:, [
        c for c in x_weather
        if not any(c.startswith(w + "_lag_") for w in spec["weather"])
    ]]
    # Require identical complete feature history for both ML variants.
    feature_complete = x_weather.notna().all(axis=1)
    rows_by_origin = defaultdict(list)

    for source_row in original["forecast_rows"]:
        row = dict(source_row)
        origin = pd.Timestamp(row["issue_week"])
        target_date = pd.Timestamp(row["target_week"])
        horizon = int(row["horizon"])
        if horizon not in (1, 2, 3, 4):
            raise ValueError(f"{area}: invalid forecast horizon {horizon}")
        if target_date != origin + pd.Timedelta(weeks=horizon):
            raise ValueError(f"{area}: inconsistent issue/target date: {row}")
        if target_date not in df.index or origin not in df.index:
            raise ValueError(f"{area}: forecast refers to a missing calendar date")
        actual = df.at[target_date, "cases"]
        latest = df.at[origin, "cases"]
        if pd.isna(actual) or pd.isna(latest):
            raise ValueError(f"{area}: missing observed cases for {row}")
        if abs(float(actual) - float(row["actual_cases"])) > 1e-5:
            raise ValueError(f"{area}: AutoETS report actuals do not match workbook")
        if abs(float(latest) - float(row["persistence"])) > 1e-5:
            raise ValueError(f"{area}: AutoETS persistence differs from workbook")
        if int(target_date.isocalendar().year) != int(row["year"]):
            raise ValueError(f"{area}: AutoETS report ISO years do not match")
        if bool(actual >= float(row["high_case_cutoff"])) != bool(row["high_case_week"]):
            raise ValueError(f"{area}: high-case classification disagrees")
        rows_by_origin[origin].append(row)

    if not rows_by_origin:
        raise ValueError(f"{area}: AutoETS report contains no evaluation origins")

    evaluated = []
    for count, (origin, origin_rows) in enumerate(sorted(rows_by_origin.items()), 1):
        if len(origin_rows) != 4 or {int(r["horizon"]) for r in origin_rows} != {1, 2, 3, 4}:
            raise ValueError(f"{area}: missing/duplicate horizons for {origin.date()}")
        feature_date = origin + pd.Timedelta(weeks=1)
        if feature_date not in df.index or not feature_complete.loc[feature_date]:
            raise ValueError(f"{area}: feature data missing at {feature_date.date()}")
        if count == 1 or count % 4 == 0:
            print(f"  {area}: refitting at origin {count}/{len(rows_by_origin)} "
                  f"({origin.date()})", flush=True)
        for row in sorted(origin_rows, key=lambda r: r["horizon"]):
            horizon = int(row["horizon"])
            # Feature row d contains observed data ONLY through d-1.
            # Its training label belongs to week d + (horizon-1).
            target = df["cases"].shift(-(horizon - 1))
            target_dates = df.index + pd.Timedelta(weeks=horizon - 1)
            allowed = (
                feature_complete.to_numpy()
                & target.notna().to_numpy()
                & (target_dates <= origin)
            )
            train = df.index[allowed]
            if len(train) < 100:
                raise ValueError(
                    f"{area}: insufficient training data at {origin.date()}, "
                    f"horizon={horizon}: {len(train)}"
                )
            y_train = target.loc[train].to_numpy(dtype=float)
            for name, matrix in (
                ("gb_cases_only", x_cases),
                ("gb_with_weather", x_weather),
            ):
                model = new_model()
                model.fit(matrix.loc[train], y_train)
                pred = float(model.predict(matrix.loc[[feature_date]])[0])
                if not np.isfinite(pred):
                    raise ValueError(f"{area}: nonfinite prediction: {name}")
                row[name] = round(max(0.0, pred), 3)
            row["gb_train_samples"] = len(train)
            evaluated.append(row)

    breakdown = []
    for year in (2024, 2025):
        for horizon in (1, 2, 3, 4):
            matching = [
                r for r in evaluated
                if int(r["year"]) == year and int(r["horizon"]) == horizon
            ]
            if not matching:
                raise ValueError(f"{area}: empty comparison for {year} +{horizon}w")
            breakdown.append({
                "year": year, "horizon_week": horizon,
                "origins": len(matching),
                "metrics": {method: score(matching, method) for method in METHODS},
            })

    return {
        "area": area,
        "source_autoets_origin_stride_weeks": original["origin_stride_weeks"],
        "evaluated_origin_count": len(rows_by_origin),
        "evaluation_rows": len(evaluated),
        "model_variants": list(METHODS),
        "annual_horizon_metrics": breakdown,
        "overall_horizon_metrics": [
            {
                "horizon_week": h,
                "metrics": {
                    method: score(
                        [r for r in evaluated if int(r["horizon"]) == h],
                        method
                    )
                    for method in METHODS
                },
            }
            for h in (1, 2, 3, 4)
        ],
        "forecast_rows": sorted(
            evaluated, key=lambda r: (r["issue_week"], int(r["horizon"]))
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--autoets", type=Path, default=DEFAULT_AUTOETS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    inspect_workbook(args.workbook)
    if not args.autoets.is_file():
        parser.error(
            f"AutoETS report missing: {args.autoets}. Run benchmark_autoets.py first."
        )

    incoming = json.loads(args.autoets.read_text(encoding="utf-8"))
    if not isinstance(incoming, list) or {x.get("area") for x in incoming} != set(AREAS):
        raise ValueError("AutoETS report must contain precisely QC and NCR records")
    originals = {item["area"]: item for item in incoming}
    outputs = []
    for area in AREAS:
        print(f"Comparing forecasters for {area}...", flush=True)
        outputs.append(evaluate_area(args.workbook, area, originals[area]))

    report = {
        "experiment": "Aligned rolling-origin dengue model comparison",
        "evaluation_years": [2024, 2025],
        "methods": list(METHODS),
        "no_future_target_leakage": True,
        "model_training_policy": (
            "Direct-horizon gradient boosting refit at each AutoETS issue week. "
            "Only labels dated on or before issue week included."
        ),
        "fairness": (
            "AutoETS, persistence and gradient boosting scored on exactly the "
            "same actual counts, target dates, horizon weeks and high-case cutoffs. "
            "Gradient boosting uses historical weather lags in one variant."
        ),
        "caveats": [
            "2024-2025 were used in model development, not an untouched final test set.",
            "The every-4-week evaluation has only 13 origins per year and limited high-case weeks.",
            "High-case cutoff is a 90th percentile research indicator, not a DOH outbreak declaration.",
            "No 2026 live case feed or prospective forecast is connected.",
            "AutoETS and gradient boosting use different architectures and input histories; "
            "identical evaluation dates do not remove all modeling differences.",
        ],
        "areas": outputs,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    for result in outputs:
        print("\n" + result["area"] + " - overall MAE by horizon")
        for cell in result["overall_horizon_metrics"]:
            print("  +{}w: {}".format(cell["horizon_week"], {
                k: v["mae"] for k, v in cell["metrics"].items()
            }))
    print(f"\nSaved full report: {args.output}")


if __name__ == "__main__":
    main()
