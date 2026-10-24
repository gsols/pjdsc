"""Approved annual XGBoost rankings only; never fall back to raw positive demand."""
from functools import lru_cache
import json

import xgboost

from ..upri_data import ROOT, sha256, verify_sources
from ..domain.barangay_forecast import VERSION

FOLDER = ROOT / "data/processed/upri_noah"


@lru_cache(maxsize=2)
def _read(digest):
    path = FOLDER / "qc-barangay-xgboost.json"
    if sha256(path) != digest:
        raise ValueError("Annual ranking changed during load")
    return json.loads(path.read_text(encoding="utf-8"))


class BarangayRankingUnavailable(ValueError):
    pass


def approved_ranking(issue_year):
    try:
        return _approved_ranking(issue_year)
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise BarangayRankingUnavailable("Annual XGBoost burden ranking failed validation. Rebuild with python scripts/train_qc_barangay.py; no fallback.") from error


def _approved_ranking(issue_year):
    manifest = json.loads((FOLDER / "qc-barangay-xgboost-manifest.json").read_text(encoding="utf-8"))
    if manifest["sources"] != verify_sources() or manifest["methodVersion"] != VERSION or manifest["software"]["xgboost"] != xgboost.__version__:
        raise ValueError("Annual XGBoost source/software mismatch; run scripts/train_qc_barangay.py")
    if sha256(FOLDER / "qc-barangay-xgboost.json") != manifest["outputSha256"] or sha256(FOLDER / "qc-barangay-xgboost-model.joblib") != manifest["modelSha256"]:
        raise ValueError("Annual XGBoost artifact mismatch; run scripts/train_qc_barangay.py")
    if any(sha256(ROOT / name) != digest for name, digest in manifest["codeHashes"].items()):
        raise ValueError("Annual XGBoost code changed; run scripts/train_qc_barangay.py")
    data = _read(manifest["outputSha256"])
    matches = [r for r in data["forecasts"] if r["issueYear"] == issue_year]
    if len(matches) != 1:
        raise ValueError("No approved annual XGBoost ranking for this origin; rebuild, no fallback")
    run = matches[0]
    if run["lastTrainingLabelYear"] > issue_year - 2 or run["featureCutoffYear"] > issue_year - 2 or len(run["records"]) != 142:
        raise ValueError("Invalid annual ranking coverage or temporal cutoff")
    return run, {"model": "XGBoost annual barangay burden", "methodVersion": VERSION,
        "forecastYear": run["targetYear"], "trainingCutoffYear": run["lastTrainingLabelYear"],
        "criterion": "Ten highest predicted annual case burdens; research candidates, not confirmed weekly hotspots",
        "artifactSha256": manifest["outputSha256"], "modelSha256": manifest["modelSha256"],
        "validation": [r for r in data["backtest"] if r["targetYear"] in [2024, 2025]], "limitations": data["limitations"]}
