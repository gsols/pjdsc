"""Approved seasonal model loading and saved future-date run registration."""
from datetime import timedelta
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
from uuid import uuid4

import joblib
import sklearn

from ..domain.seasonal_forecast import project_days, residual_paths, source_week, weather_analog, WEATHER, VERSION
from ..upri_data import ROOT, sha256, verify_sources

FOLDER = ROOT / "data/processed/upri_noah"


@lru_cache(maxsize=2)
def _read_model(digest):
    path = FOLDER / "qc-seasonal-model.joblib"
    if sha256(path) != digest:
        raise ValueError("Seasonal model digest changed during load")
    return joblib.load(path)


def approved_model():
    manifest = json.loads((FOLDER / "qc-seasonal-manifest.json").read_text())
    if manifest["sources"] != verify_sources() or manifest["software"]["sklearn"] != sklearn.__version__:
        raise ValueError("Seasonal model source/software mismatch; retrain the approved model")
    if sha256(FOLDER / "qc-seasonal-model.joblib") != manifest["modelSha256"] or sha256(FOLDER / "qc-seasonal-validation.json") != manifest["validationSha256"]:
        raise ValueError("Seasonal model/validation checksum mismatch")
    if any(sha256(ROOT / name) != digest for name, digest in manifest["codeHashes"].items()):
        raise ValueError("Seasonal training code changed; retrain the approved model")
    return _read_model(manifest["modelSha256"]), manifest


def _radius(values):
    values = sorted(abs(float(v)) for v in values)
    if len(values) < 20 or any(not math.isfinite(v) for v in values):
        raise ValueError("Insufficient seasonal range evidence")
    return values[min(len(values), math.ceil((len(values) + 1) * .8)) - 1]


def create_seasonal_run(start, profile, as_of):
    engine, manifest = approved_model()
    identity = {"startDate": start.isoformat(), "weatherProfile": profile, "asOfDate": as_of.isoformat(),
        "modelSha256": manifest["modelSha256"], "methodVersion": VERSION,
        "inferenceCodeSha256": sha256(Path(__file__))}
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    ident = "qc-seasonal-run-" + digest
    folder = FOLDER / "scenarios/forecast-runs"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / (digest + ".json")
    if path.exists():
        return load_seasonal_run(ident)
    days = project_days(engine, start, profile, engine["selectedModel"])
    paths = residual_paths(engine["calibrationRecords"], source_week(start), engine["selectedModel"], 2024 * 52 - 1, length=5)
    offset = (start.timetuple().tm_yday - 1) % 7
    daily_errors = [{"lastTargetBlock": p["lastTargetBlock"],
        "errors": [p["residuals"][(offset + i) // 7] / 7 for i in range(28)]} for p in paths]
    for i, row in enumerate(days):
        radius = _radius([p["errors"][i] for p in daily_errors])
        row.update({"lowerCases": max(0, row["meanCases"] - radius), "upperCases": row["meanCases"] + radius})
    predictions = []
    for h in range(4):
        sample = days[7 * h:7 * (h + 1)]
        central = sum(d["meanCases"] for d in sample)
        radius = _radius([sum(p["errors"][7 * h:7 * (h + 1)]) for p in daily_errors])
        target = start + timedelta(days=7 * h)
        predictions.append({"YR": target.year, "WN": source_week(target), "targetStartDate": target.isoformat(),
            "meanCases": central, "lowerCases": max(0, central - radius), "upperCases": central + radius,
            "observedCases": None, "measurementKind": "forecast", "intervalKind": "experimental_seasonal_analog_residual_range"})
    history = engine["history"]
    last_year, last_week = int(history.YR.iloc[-1]), int(history.WN.iloc[-1])
    analog = weather_analog(history, source_week(start), profile)
    feature_inputs = []
    for week in sorted({d["sourceWeekAssumption"] for d in days}):
        for lag in [1, 2, 4]:
            row = weather_analog(history, (week - lag - 1) % 52 + 1, profile)
            feature_inputs.append({"targetSourceWeekAssumption": week, "lagSourceBlocks": lag,
                "sourceAnalogYear": int(row.YR), "sourceAnalogWeek": int(row.WN),
                "measurementKind": "assumption", "sourceValues": {c: float(row[c]) for c in WEATHER}})
    source = next(s for s in manifest["sources"]["sources"] if s["path"].endswith("Dataset.xlsx"))
    run = {"schemaVersion": "1.2", "id": ident, "area": "QUEZON_CITY", "mode": "hypothetical_shock",
        "issueDate": as_of.isoformat(), "issueBlock": {"YR": last_year, "WN": last_week},
        "trainingCutoffBlock": manifest["sourceLastBlock"], "sourceSha256": source["sha256"],
        "seasonalModelSha256": manifest["modelSha256"], "model": engine["selectedModel"], "methodVersion": VERSION,
        "spatialWeightsIssueYear": as_of.year, "weeklyPredictions": predictions, "dailyPredictions": days,
        "calibrationResidualPaths": paths, "dailyResidualPaths": daily_errors,
        "environmentalFeatureInputs": feature_inputs,
        "environmentalInputs": [{"sourceColumn": column, "valueAtOrigin": float(analog[column]),
            "unit": "mm/source block" if column == "RF_NASA" else "degrees Celsius" if column.startswith("Temp") else "%",
            "measurementKind": "assumption", "lagsSourceBlocks": [1, 2, 4], "weatherProfile": profile,
            "sourceAnalogYear": int(analog.YR), "sourceAnalogWeek": int(analog.WN)} for column in WEATHER],
        "observedCasesAtOrigin": float(history.DC_QC.iloc[-1]),
        "observedSourceYearToDateCases": float(history.loc[history.YR == last_year, "DC_QC"].sum()),
        "intervalCoverageTarget": .8, "intervalCaveat": "Experimental season-matched historical error range, not validated current surveillance or hospital uncertainty. Weather-profile stress ranges have not been separately calibrated.",
        "spatialCaveat": "Fixed prior annual barangay shares; citywide weather analogs are not barangay climate observations.",
        "availabilityAssumption": "Training observations end in 2025. No 2026/2027 cases or measured future weather are imputed. Future curves are conditional seasonal planning projections.",
        "calendarStatus": "ASSUMED_JAN1_52_BLOCK_MAPPING_NOT_RECONCILED_SOURCE_CALENDAR", "registration": identity}
    run["runSha256"] = hashlib.sha256(json.dumps(run, sort_keys=True, allow_nan=False).encode()).hexdigest()
    temp = folder / (uuid4().hex + ".tmp")
    temp.write_text(json.dumps(run, allow_nan=False), encoding="utf-8")
    try:
        path.hardlink_to(temp)
    except FileExistsError:
        return load_seasonal_run(ident)
    finally:
        temp.unlink(missing_ok=True)
    return run


def load_seasonal_run(ident):
    if not ident.startswith("qc-seasonal-run-"):
        raise ValueError("Invalid seasonal run prefix")
    digest = ident.removeprefix("qc-seasonal-run-")
    if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("Invalid seasonal run ID")
    run = json.loads((FOLDER / "scenarios/forecast-runs" / (digest + ".json")).read_text())
    checksum = run.pop("runSha256")
    if hashlib.sha256(json.dumps(run, sort_keys=True, allow_nan=False).encode()).hexdigest() != checksum:
        raise ValueError("Seasonal run checksum mismatch")
    _, manifest = approved_model()
    if run["seasonalModelSha256"] != manifest["modelSha256"] or run["id"] != ident or run["area"] != "QUEZON_CITY":
        raise ValueError("Seasonal run model/scope mismatch")
    run["runSha256"] = checksum
    return run
