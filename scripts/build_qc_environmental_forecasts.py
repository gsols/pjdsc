"""Build source-traceable QC weather forecasts and leakage-safe residual ranges.

Calendar labels remain unresolved. Ranges are empirical temporal residual ranges,
not a guarantee of nominal coverage or validated weekly barangay intervals.
"""
import argparse
from functools import lru_cache
import json
import math
from pathlib import Path
import sys
from datetime import datetime, timezone

import numpy as np
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.upri_data import load_weekly, verify_sources, sha256, WORKBOOK
from scripts.train_dengue import features

VERSION = "qc-weather-residual-v2"


def residual_radius(errors, coverage=.8):
    values = sorted(abs(float(v)) for v in errors)
    if len(values) < 20 or any(not math.isfinite(v) for v in values):
        raise ValueError("At least 20 finite pre-origin calibration residuals required")
    rank = min(len(values), math.ceil((len(values) + 1) * coverage))
    return values[rank - 1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/processed/upri_noah")
    args = parser.parse_args()
    sources = verify_sources()
    folder = args.output_dir
    audit = json.loads((folder / "audit.json").read_text())
    if audit["sources"] != sources:
        raise ValueError("Audit the current source before training")
    old = json.loads((folder / "forecast-runs.json").read_text())["runs"]
    origins = [r["issueBlock"]["YR"] * 52 + r["issueBlock"]["WN"] - 1 for r in old if r["area"] == "QUEZON_CITY"]
    frame, case, weather = load_weekly("QUEZON_CITY")
    frame["cases"] = frame[case]
    x = features(frame, weather)
    cases_only = [c for c in x if not any(c.startswith(w + "_lag_") for w in weather)]

    @lru_cache(maxsize=None)
    def predict(origin, h, use_weather=True):
        target = frame["cases"].shift(-(h - 1))
        complete = x.notna().all(axis=1) & target.notna()
        train = x.index[complete & (x.index + h - 1 <= origin)]
        if len(train) < 100 or x.loc[origin + 1].isna().any():
            raise ValueError("Insufficient complete past observations")
        columns = list(x.columns) if use_weather else cases_only
        model = HistGradientBoostingRegressor(loss="poisson", max_iter=80, max_leaf_nodes=12,
            min_samples_leaf=15, learning_rate=.04, l2_regularization=5, random_state=42)
        model.fit(x.loc[train, columns], target.loc[train])
        value = max(0.0, float(model.predict(x.loc[[origin + 1], columns])[0]))
        return value, int(max(train) + h - 1), len(train)

    runs, detail = [], []
    calibration_origins = range(2021 * 52, max(origins), 4)
    for origin in origins:
        # Complete four-horizon trajectories are known before the current issue.
        eligible = [c for c in calibration_origins if origin - 156 <= c and c + 4 <= origin]
        paths = []
        for c in eligible:
            residuals = [float(frame.at[c + h, "cases"]) - predict(c, h)[0] for h in range(1, 5)]
            paths.append({"originBlock": c, "lastTargetBlock": c + 4, "residuals": residuals})
        predictions = []
        for h in range(1, 5):
            mean, last_label, n = predict(origin, h)
            radius = residual_radius([p["residuals"][h - 1] for p in paths])
            actual = float(frame.at[origin + h, "cases"])
            y, w = divmod(origin + h, 52)
            predictions.append({"YR": y, "WN": w + 1, "meanCases": mean,
                "lowerCases": max(0, mean - radius), "upperCases": mean + radius,
                "measurementKind": "forecast", "observedCases": actual, "observedMeasurementKind": "observed",
                "intervalKind": "empirical_pre_origin_absolute_residual_80", "calibrationSamples": len(paths),
                "lastTrainingTargetBlock": last_label, "trainingSamples": n})
            detail.append({"originBlock": origin, "horizon": h, "observedCases": actual, "weatherForecast": mean,
                "casesOnlyForecast": predict(origin, h, False)[0], "persistenceForecast": float(frame.at[origin, "cases"]),
                "lowerCases": max(0, mean - radius), "upperCases": mean + radius,
                "lastCalibrationTargetBlock": max(p["lastTargetBlock"] for p in paths), "lastTrainingTargetBlock": last_label})
        y, w = divmod(origin, 52)
        runs.append({"schemaVersion": "1.1", "id": f"{VERSION}-QUEZON_CITY-{y}-{w + 1}", "area": "QUEZON_CITY",
            "mode": "historical_replay", "issueBlock": {"YR": y, "WN": w + 1}, "issueDate": None,
            "trainingCutoffBlock": {"YR": y, "WN": w + 1}, "sourceSha256": sha256(WORKBOOK),
            "calendarStatus": "UNRESOLVED_SOURCE_WEEK_DEFINITION", "model": "cases_weather",
            "methodVersion": VERSION, "seed": 42, "weeklyPredictions": predictions, "calibrationResidualPaths": paths,
            "intervalCoverageTarget": .8, "intervalCaveat": "Pre-origin empirical residual range; time-series exchangeability is not guaranteed. Barangay allocation uncertainty is not measured.",
            "environmentalInputs": [{"sourceColumn": col, "valueAtOrigin": float(frame.at[origin, col]),
                "unit": "mm/source block" if col == "RF_NASA" else "degrees Celsius" if col.startswith("Temp") else "%",
                "measurementKind": "observed", "geography": "QUEZON_CITY", "lagsSourceBlocks": [1, 2, 4]} for col in weather],
            "observedCasesAtOrigin": float(frame.at[origin, case]),
            "observedSourceYearToDateCases": float(frame.loc[(frame.YR == y) & (frame.index <= origin), case].sum()),
            "availabilityAssumption": "Case/weather history through origin is assumed available; original publication delays and revision vintages unknown.",
            "spatialCaveat": "Environmental inputs are citywide; annual barangay weights provide within-QC spatial shares, not measured barangay microclimate.",
            "software": {"sklearn": sklearn.__version__, "numpy": np.__version__}})
        print(f"Built QC origin {y}/{w+1}, {len(paths)} strictly pre-origin residual trajectories", flush=True)
    scores = []
    for h in range(1, 5):
        rows = [r for r in detail if r["horizon"] == h]
        scores.append({"horizon": h, "n": len(rows), "weatherMae": float(np.mean([abs(r["observedCases"] - r["weatherForecast"]) for r in rows])),
            "casesOnlyMae": float(np.mean([abs(r["observedCases"] - r["casesOnlyForecast"]) for r in rows])),
            "persistenceMae": float(np.mean([abs(r["observedCases"] - r["persistenceForecast"]) for r in rows])),
            "empiricalRangeCoverage": float(np.mean([r["lowerCases"] <= r["observedCases"] <= r["upperCases"] for r in rows]))})
    result = {"schemaVersion": "1.1", "runs": runs, "backtest": {"scores": scores, "predictions": detail,
        "caveat": "Eight retrospective matched origins; weather use is a requested model variant, not a claim of superiority. Coverage sample sizes are small."}}
    target = folder / "qc-environmental-forecasts.json"
    temp = target.with_suffix(".tmp")
    temp.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(target)
    manifest = {"schemaVersion": "1.0", "transformVersion": VERSION, "sources": sources,
        "transformedAt": datetime.now(timezone.utc).isoformat(), "outputSha256": sha256(target),
        "codeHashes": {str(p.relative_to(ROOT).as_posix()): sha256(p) for p in [Path(__file__), ROOT / "scripts/train_dengue.py", ROOT / "services/engine/upri_data.py"]},
        "transformations": ["Reuse lagged cases/weather features", "Fit direct 1–4 source-block models with labels <= each issue", "Use 4-block-spaced pre-origin held-out trajectories over prior 156 blocks for empirical residual ranges", "No future weather, annual counts or evaluation labels in calibration"]}
    (folder / "qc-environmental-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
