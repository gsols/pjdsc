"""Load only hash-checked reproducible run artifacts, never browser case arrays."""
import json
import math
import re

from ..upri_data import ROOT, sha256, verify_sources

FOLDER = ROOT / "data/processed/upri_noah"


class ForecastRunNotFound(LookupError):
    """An unknown requested ID, distinguished from corrupt repository metadata."""


def artifact(name):
    manifest = json.loads((FOLDER / "manifest.json").read_text())
    path = FOLDER / name
    expected = manifest["outputs"][path.relative_to(ROOT).as_posix()]
    if sha256(path) != expected:
        raise ValueError("Processed artifact checksum mismatch")
    sources = verify_sources()
    if sources != manifest["sources"]:
        raise ValueError("Processed source mismatch")
    return json.loads(path.read_text())


def load_runs(area=None):
    data = artifact("forecast-runs.json")["runs"]
    source = next(s["sha256"] for s in verify_sources()["sources"] if s["path"].endswith("Dataset.xlsx"))
    for run in data:
        if run["area"] not in {"QUEZON_CITY", "NCR"} or run["mode"] != "historical_replay" or run["sourceSha256"] != source:
            raise ValueError("Invalid historical run provenance")
        predictions = run["weeklyPredictions"]
        if len(predictions) != 4:
            raise ValueError("Run must contain four horizons")
        origin = run["issueBlock"]["YR"] * 52 + run["issueBlock"]["WN"] - 1
        for h, prediction in enumerate(predictions, 1):
            value = prediction["meanCases"]
            if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError("Invalid forecast count")
            if prediction["YR"] * 52 + prediction["WN"] - 1 != origin + h:
                raise ValueError("Nonconsecutive forecast blocks")
    return [r for r in data if area is None or r["area"] == area]


def load_run(ident):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,120}", ident):
        raise ForecastRunNotFound("Invalid forecast ID")
    if ident.startswith("qc-seasonal-run-"):
        from .seasonal_runs import load_seasonal_run
        return load_seasonal_run(ident)
    candidates = load_environmental_runs() if ident.startswith("qc-weather-residual-") else load_runs()
    runs = [r for r in candidates if r["id"] == ident]
    if len(runs) != 1:
        raise ForecastRunNotFound("Unknown approved forecast run")
    return runs[0]


def load_environmental_runs():
    manifest = json.loads((FOLDER / "qc-environmental-manifest.json").read_text())
    path = FOLDER / "qc-environmental-forecasts.json"
    if sha256(path) != manifest["outputSha256"] or verify_sources() != manifest["sources"]:
        raise ValueError("Environmental forecast source/artifact mismatch")
    data = json.loads(path.read_text())
    for run in data["runs"]:
        origin = run["issueBlock"]["YR"] * 52 + run["issueBlock"]["WN"] - 1
        if run["area"] != "QUEZON_CITY" or run["model"] != "cases_weather" or len(run["weeklyPredictions"]) != 4:
            raise ValueError("Invalid QC environmental forecast")
        for h, p in enumerate(run["weeklyPredictions"], 1):
            values = [p["lowerCases"], p["meanCases"], p["upperCases"]]
            if any(not math.isfinite(v) or v < 0 for v in values) or values != sorted(values):
                raise ValueError("Invalid forecast range")
            if p["lastTrainingTargetBlock"] > origin or p["YR"] * 52 + p["WN"] - 1 != origin + h:
                raise ValueError("Forecast label/target leakage")
        if len(run["calibrationResidualPaths"]) < 20 or any(p["lastTargetBlock"] > origin for p in run["calibrationResidualPaths"]):
            raise ValueError("Calibration leakage or inadequate samples")
    return data["runs"]
