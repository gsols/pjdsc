"""Rebuild audited XGBoost annual barangay forecasts and high-burden rankings."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from uuid import uuid4

import joblib
import numpy as np
import xgboost

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.domain import barangay_forecast as domain
from services.engine.upri_data import load_annual, sha256, verify_sources


def publish(path, value):
    temp = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    temp.write_bytes((json.dumps(value, indent=2, allow_nan=False) + "\n").encode("utf-8"))
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data/processed/upri_noah")
    args = parser.parse_args()
    sources = verify_sources()
    if json.loads((args.output_dir / "audit.json").read_text(encoding="utf-8"))["sources"] != sources:
        raise ValueError("Audit the current immutable inputs before training barangay forecasts")
    records = json.loads(load_annual().to_json(orient="records"))
    forecasts, scores, models = [], [], {}
    for issue_year in range(2018, 2027):
        cutoff = issue_year - 2
        model, training = domain.train_annual_model(records, cutoff)
        rows = domain.predict_annual_burden(model, records, cutoff)
        models[str(issue_year)] = model
        forecasts.append({"issueYear": issue_year, "targetYear": issue_year, "featureCutoffYear": cutoff,
            **training, "records": rows, "topCandidateIds": [r["barangayId"] for r in rows if r["isHighBurdenCandidate"]]})
        scores.extend(domain.evaluate_annual(rows, records, issue_year, cutoff))
        print(f"Annual issue {issue_year}: labels <= {cutoff}, {training['trainingRows']} training rows, 10 ranked candidates", flush=True)
    model_path = args.output_dir / "qc-barangay-xgboost-model.joblib"
    temp = model_path.with_name(model_path.name + "." + uuid4().hex + ".tmp")
    joblib.dump(models, temp); temp.replace(model_path)
    output = args.output_dir / "qc-barangay-xgboost.json"
    publish(output, {"schemaVersion": "1.0", "methodVersion": domain.VERSION, "model": "XGBoost annual burden regressor",
        "selection": "Explicit user-requested XGBoost; no superiority claim; top ten is a predeclared research ranking",
        "forecasts": forecasts, "backtest": scores,
        "limitations": "Annual burden ranking, not observed/validated weekly outbreaks, risk rates or spatial-cluster significance. Shares are held fixed for the scenario window. Missing labels are excluded; missing past features stay NaN. No future annual labels enter origin-specific training."})
    publish(args.output_dir / "qc-barangay-xgboost-manifest.json", {"schemaVersion": "1.0", "methodVersion": domain.VERSION,
        "builtAt": datetime.now(timezone.utc).isoformat(), "sources": sources, "outputSha256": sha256(output),
        "modelSha256": sha256(model_path), "software": {"xgboost": xgboost.__version__, "numpy": np.__version__},
        "codeHashes": {p.relative_to(ROOT).as_posix(): sha256(p) for p in [Path(__file__), Path(domain.__file__)]},
        "availabilityAssumption": "One additional full year publication lag: issue year Y only uses annual records through Y-2"})
    print(json.dumps([r for r in scores if r["targetYear"] >= 2024], indent=2))


if __name__ == "__main__":
    main()
