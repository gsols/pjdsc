"""Train/version the future-season engine; no live observations are manufactured."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from uuid import uuid4

import joblib
import numpy as np
import sklearn
import xgboost

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.upri_data import load_weekly, verify_sources, sha256
from services.engine.domain import seasonal_forecast as domain


def publish_json(path, data):
    """Publish UTF-8/LF bytes atomically, independent of the host platform."""
    temp = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    temp.write_bytes((json.dumps(data, indent=2, allow_nan=False) + "\n").encode("utf-8"))
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/processed/upri_noah")
    args = parser.parse_args()
    sources = verify_sources()
    if json.loads((args.output_dir / "audit.json").read_text())["sources"] != sources:
        raise ValueError("Audit the current source first")
    frame, _, _ = load_weekly("QUEZON_CITY")
    records = []
    for year in range(2018, 2026):
        train = frame.loc[frame.YR < year]
        target = frame.loc[frame.YR == year]
        fitted = domain.train_engine(train)
        predictions = domain.predict_weeks(fitted, target.WN.astype(int).tolist())
        for position, (block, row) in enumerate(target.iterrows()):
            records.append({"block": int(block), "year": year, "week": int(row.WN), "observed": float(row.DC_QC),
                "lastTrainingBlock": fitted["lastTrainingBlock"],
                **{name: float(values[position]) for name, values in predictions.items()}})
        print(f"Seasonal year holdout {year}: {len(train)} past rows -> {len(target)} targets", flush=True)
    calibration = [r for r in records if r["year"] < 2024]
    names = ["seasonal_xgboost", "seasonal_boosted_trees", "seasonal_baseline"]
    selection_scores = {name: float(np.mean([abs(r["observed"] - r[name]) for r in calibration])) for name in names}
    best_calibration = min(names, key=lambda name: (selection_scores[name], names.index(name)))
    selected = "seasonal_xgboost"  # Explicit user choice, not a claim of superior skill.
    final = domain.train_engine(frame)
    final["selectedModel"] = selected
    final["calibrationRecords"] = calibration
    final["methodVersion"] = domain.VERSION
    model_path = args.output_dir / "qc-seasonal-model.joblib"
    model_temp = model_path.with_name(model_path.name + "." + uuid4().hex + ".tmp")
    joblib.dump(final, model_temp)
    model_temp.replace(model_path)
    score_rows = []
    for year in [2024, 2025]:
        rows = [r for r in records if r["year"] == year]
        for name in names:
            errors = [r[name] - r["observed"] for r in rows]
            contained = []
            for row in rows:
                paths = domain.residual_paths(calibration, row["week"], name, 2024 * 52 - 1)
                values = sorted(abs(p["residuals"][0]) for p in paths)
                q = values[min(len(values), int(np.ceil((len(values) + 1) * .8))) - 1]
                contained.append(max(0, row[name] - q) <= row["observed"] <= row[name] + q)
            score_rows.append({"year": year, "model": name, "n": len(rows), "mae": float(np.mean(np.abs(errors))),
                "rmse": float(np.sqrt(np.mean(np.square(errors)))), "empiricalRangeCoverage": float(np.mean(contained))})
    report = {"schemaVersion": "1.0", "selectedModel": selected,
        "selection": {"criterion": "XGBoost explicitly requested for planning; compared with two baselines using pre-2024 calibration, with later years held out", "scores": selection_scores, "bestCalibrationModel": best_calibration, "userRequestedModel": selected},
        "backtest": score_rows, "records": records,
        "method": "Expanding calendar-year holdout; lagged weather climatology from training years only; no target-year measured weather or recent-case imputation.",
        "calendarCaveat": "Evaluation uses native YR/WN; future calendar-to-source-week mapping remains an explicit assumption.",
        "bedValidation": "No observed hospital admissions or occupancy labels: bed demand is conditional case-to-cohort modeling, not empirically validated occupancy prediction."}
    report_path = args.output_dir / "qc-seasonal-validation.json"
    publish_json(report_path, report)
    manifest = {"schemaVersion": "1.0", "methodVersion": domain.VERSION, "sources": sources,
        "sourceLastBlock": {"YR": 2025, "WN": 52}, "selectedModel": selected,
        "trainedAt": datetime.now(timezone.utc).isoformat(), "modelSha256": sha256(model_path), "validationSha256": sha256(report_path),
        "trainingRows": final["trainingRows"], "trainingCutoffBlock": final["lastTrainingBlock"],
        "codeHashes": {p.relative_to(ROOT).as_posix(): sha256(p) for p in [Path(__file__), Path(domain.__file__)]},
        "software": {"python": sys.version, "sklearn": sklearn.__version__, "xgboost": xgboost.__version__, "numpy": np.__version__, "joblib": joblib.__version__},
        "transformations": ["Preserve raw YR/WN, cases, weather and quality flags", "Train XGBoost count:poisson plus original boosted and seasonal baselines using training-only features", "Explicit user-selected XGBoost; baseline calibration uses only 2018–2023", "Evaluate 2024–2025 using training-only weather analogs", "Refit through 2025; future weather remains assumed; no direct hospital occupancy training targets exist"]}
    # Commit the manifest last; readers reject any incomplete rebuild.
    publish_json(args.output_dir / "qc-seasonal-manifest.json", manifest)
    print(json.dumps({"selectedModel": selected, "selectionScores": selection_scores, "holdout": score_rows}, indent=2))


if __name__ == "__main__":
    main()
