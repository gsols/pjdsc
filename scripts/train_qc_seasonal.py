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
from services.engine.domain import source_calendar, seasonal_validation


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
    candidate_scores = {name: float(np.mean([abs(r["observed"] - r["xgboost_" + name]) for r in calibration]))
                        for name in domain.XGBOOST_CANDIDATES}
    selected_variant = min(candidate_scores, key=candidate_scores.get)
    for row in records:
        row["seasonal_xgboost"] = row["xgboost_" + selected_variant]
    names = ["seasonal_xgboost", "seasonal_boosted_trees", "seasonal_baseline"]
    selection_scores = {name: float(np.mean([abs(r["observed"] - r[name]) for r in calibration])) for name in names}
    best_calibration = min(names, key=lambda name: (selection_scores[name], names.index(name)))
    selected = "seasonal_xgboost"  # Explicit user choice, not a claim of superior skill.
    final = domain.train_engine(frame)
    final["xgboostVariant"] = selected_variant
    final["xgboostModel"] = final["xgboostCandidates"][selected_variant]
    final["selectedModel"] = selected
    final["calibrationRecords"] = calibration
    final["rangeCalibrationRecords"] = records
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
                paths = domain.residual_paths([r for r in records if r["year"] < year], row["week"], name, year * 52 - 1)
                values = sorted(abs(p["residuals"][0]) for p in paths)
                q = values[min(len(values), int(np.ceil((len(values) + 1) * .8))) - 1]
                contained.append(max(0, row[name] - q) <= row["observed"] <= row[name] + q)
            score_rows.append({"year": year, "model": name,
                **seasonal_validation.error_metrics([r[name] for r in rows], [r["observed"] for r in rows]),
                "empiricalRangeCoverage": float(np.mean(contained))})
    comparison = []
    for year in [2024, 2025]:
        chosen = next(r for r in score_rows if r["year"] == year and r["model"] == selected)
        baseline = next(r for r in score_rows if r["year"] == year and r["model"] == "seasonal_baseline")
        comparison.append({"year": year, "maeSkillVsSeasonalBaseline": 1 - chosen["mae"] / baseline["mae"],
                           "rangeTargetAchieved": chosen["empiricalRangeCoverage"] >= .8})
    lead_scores = [{"sourceYearGap": 1, "lastTrainingYear": row["year"] - 1, **row} for row in score_rows]
    for gap in [2, 3]:
        for year in [2024, 2025]:
            past = frame.loc[frame.YR <= year - gap]
            target = frame.loc[frame.YR == year]
            fitted = domain.train_engine(past)
            fitted["xgboostVariant"] = selected_variant
            predictions = domain.predict_weeks(fitted, target.WN.astype(int).tolist())
            for name in names:
                lead_scores.append({"year": year, "sourceYearGap": gap, "lastTrainingYear": year - gap,
                    "lastTrainingBlock": fitted["lastTrainingBlock"], "model": name,
                    **seasonal_validation.error_metrics(predictions[name], target.DC_QC.to_numpy())})
            print(f"Stale-source evaluation {year}: last training year {year - gap}, gap {gap}", flush=True)
    report = {"schemaVersion": "1.1", "selectedModel": selected,
        "selection": {"criterion": "XGBoost requested for planning; its feature/recency variant selected by 2018–2023 expanding-year MAE only. 2024–2025 were excluded from selection and are retrospective evaluation years already examined during development.",
            "scores": selection_scores, "bestCalibrationModel": best_calibration, "userRequestedModel": selected,
            "xgboostVariant": selected_variant, "xgboostCandidateScores": candidate_scores,
            "xgboostCandidates": domain.XGBOOST_CANDIDATES, "selectionLastYear": 2023},
        "accuracyAssessment": {"status": "EXPERIMENTAL_NOT_OPERATIONALLY_VALIDATED", "comparison": comparison,
            "message": "Historical errors do not establish current-year accuracy. Compare XGBoost with the seasonal baseline and inspect undercoverage; neither weekly barangay outbreaks nor hospital occupancy has observed validation labels."},
        "calendarDiagnostics": seasonal_validation.calendar_diagnostics(records, names),
        "leadYearGapValidation": lead_scores,
        "rangeEvidencePolicy": "At evaluation year Y use only completed out-of-sample errors through Y−1. Production uses completed 2018–2025 errors; XGBoost candidate selection remains frozen through 2023. No current/future observations are supplied.",
        "backtest": score_rows, "records": records,
        "method": "Expanding calendar-year evaluation; four fixed XGBoost feature/recency candidates selected using 2018–2023 only; lagged weather analogs from training years only. No target-year cases or weather in predictors. Residual paths never combine different fitted-model cutoffs.",
        "calendarCaveat": "Evaluation uses native YR/WN; future calendar-to-source-week mapping remains an explicit assumption.",
        "bedValidation": "No observed hospital admissions or occupancy labels: bed demand is conditional case-to-cohort modeling, not empirically validated occupancy prediction."}
    report_path = args.output_dir / "qc-seasonal-validation.json"
    publish_json(report_path, report)
    manifest = {"schemaVersion": "1.0", "methodVersion": domain.VERSION, "sources": sources,
        "sourceLastBlock": {"YR": 2025, "WN": 52}, "selectedModel": selected,
        "trainedAt": datetime.now(timezone.utc).isoformat(), "modelSha256": sha256(model_path), "validationSha256": sha256(report_path),
        "trainingRows": final["trainingRows"], "trainingCutoffBlock": final["lastTrainingBlock"],
        "codeHashes": {p.relative_to(ROOT).as_posix(): sha256(p) for p in [Path(__file__), Path(domain.__file__), Path(source_calendar.__file__), Path(seasonal_validation.__file__)]},
        "software": {"python": sys.version, "sklearn": sklearn.__version__, "xgboost": xgboost.__version__, "numpy": np.__version__, "joblib": joblib.__version__},
        "transformations": ["Preserve raw YR/WN, cases, weather and quality flags", "Train XGBoost count:poisson plus original boosted and seasonal baselines using training-only features", "Explicit user-selected XGBoost; baseline calibration uses only 2018–2023", "Evaluate 2024–2025 using training-only weather analogs", "Refit through 2025; future weather remains assumed; no direct hospital occupancy training targets exist"]}
    # Commit the manifest last; readers reject any incomplete rebuild.
    publish_json(args.output_dir / "qc-seasonal-manifest.json", manifest)
    print(json.dumps({"selectedModel": selected, "xgboostVariant": selected_variant, "candidateScores": candidate_scores,
                      "selectionScores": selection_scores, "holdout": score_rows}, indent=2))


if __name__ == "__main__":
    main()
