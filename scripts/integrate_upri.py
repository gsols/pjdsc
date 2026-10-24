"""Build audited UPRI derivatives and source-block historical forecast replays."""
import argparse
from datetime import datetime, timezone
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.upri_data import load_weekly, load_annual, verify_sources, sha256, WORKBOOK
from scripts.train_dengue import features

OUT = ROOT / "data/processed/upri_noah"
WEB = ROOT / "apps/web/public/data"
VERSION = "upri-source-block-v1"


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def source_rows(frame):
    return json.loads(frame.to_json(orient="records"))


def forecast_area(area):
    frame, case, weather = load_weekly(area)
    # Reuse audited lag construction; features at block d use history through d-1.
    frame["cases"] = frame[case]
    x = features(frame, weather)
    cases_only = [c for c in x if not any(c.startswith(w + "_lag_") for w in weather)]
    metrics, runs = [], []
    # Predeclared quarterly origins. Refit each origin; exclude future target labels.
    origins = [year * 52 + week - 1 for year in [2024, 2025] for week in [4, 17, 30, 43]]
    for origin in origins:
        if origin + 4 not in frame.index:
            continue
        predictions = []
        for h in range(1, 5):
            target = frame["cases"].shift(-(h - 1))
            complete = x.notna().all(axis=1) & target.notna()
            train = x.index[complete & (x.index + h - 1 <= origin)]
            issue_row = origin + 1
            if len(train) < 100 or x.loc[issue_row].isna().any():
                raise ValueError(f"Insufficient history at {area} {origin} h{h}")
            actual = frame.at[origin + h, "cases"]
            if pd.isna(actual):
                raise ValueError("Missing evaluation target")
            values = {"persistence": float(frame.at[origin, "cases"]),
                      "seasonal_naive": float(frame.at[origin + h - 52, "cases"])}
            for name, columns in [("cases_only", cases_only), ("cases_weather", list(x.columns))]:
                model = HistGradientBoostingRegressor(loss="poisson", max_iter=80, max_leaf_nodes=12,
                    min_samples_leaf=15, learning_rate=.04, l2_regularization=5, random_state=42)
                model.fit(x.loc[train, columns], target.loc[train])
                values[name] = max(0.0, float(model.predict(x.loc[[issue_row], columns])[0]))
            threshold = float(target.loc[train].quantile(.9))
            for method, value in values.items():
                if not np.isfinite(value) or value < 0:
                    raise ValueError("Nonfinite/negative forecast")
                metrics.append({"area": area, "origin": origin, "horizon": h, "method": method,
                    "observed": float(actual), "forecast": value, "trainingSamples": len(train),
                    "lastTrainingTargetBlock": int(max(train) + h - 1), "alertThreshold": threshold})
            yr, wn = divmod(origin + h, 52)
            predictions.append({"YR": yr, "WN": wn + 1, "meanCases": values["cases_only"],
                "measurementKind": "forecast", "observedCases": float(actual), "observedMeasurementKind": "observed",
                "lowerCases": None, "upperCases": None, "intervalKind": "not_estimated"})
        yr, wn = divmod(origin, 52)
        runs.append({"schemaVersion": "1.0", "id": f"{VERSION}-{area}-{yr}-{wn + 1}", "area": area,
            "mode": "historical_replay", "issueBlock": {"YR": yr, "WN": wn + 1},
            "trainingCutoffBlock": {"YR": yr, "WN": wn + 1}, "issueDate": None,
            "calendarStatus": "UNRESOLVED_SOURCE_WEEK_DEFINITION", "units": "reported cases / source block",
            "methodVersion": VERSION, "model": "cases_only", "seed": 42,
            "modelParameters": {"estimator": "HistGradientBoostingRegressor", "loss": "poisson", "max_iter": 80,
                "max_leaf_nodes": 12, "min_samples_leaf": 15, "learning_rate": .04, "l2_regularization": 5,
                "random_state": 42, "sklearnVersion": sklearn.__version__},
            "sourceSha256": sha256(WORKBOOK), "weeklyPredictions": predictions,
            "availabilityAssumption": "All history through issue block is available; original publication delays/vintages unknown.",
            "modelSelection": "Cases-only predeclared for replay; no selection on evaluation scores.",
            "simulationCaveat": "Relative-day hypothetical planning with 2026 PhilHealth inventory; not historical hospital occupancy."})
    scores = []
    table = pd.DataFrame(metrics)
    for (horizon, method), rows in table.groupby(["horizon", "method"]):
        error = rows.forecast - rows.observed
        truth, alert = rows.observed >= rows.alertThreshold, rows.forecast >= rows.alertThreshold
        tp = int((truth & alert).sum())
        scores.append({"area": area, "horizon": int(horizon), "method": method, "n": len(rows),
            "mae": float(error.abs().mean()), "rmse": float(np.sqrt((error**2).mean())),
            "highCountN": int(truth.sum()), "highCountMae": float(error[truth].abs().mean()) if truth.any() else None,
            "alertPrecision": tp / int(alert.sum()) if alert.any() else None,
            "alertRecall": tp / int(truth.sum()) if truth.any() else None,
            "intervalCoverage": None, "intervalMethod": "not_estimated"})
    return runs, scores, metrics


def geometry(annual):
    import geopandas as gpd
    import py7zr
    combined = OUT / "source-archive.7z"
    combined.write_bytes(b"".join((ROOT / f"data/raw/upri_noah/DC_Regional-Brgy.7z.{part}").read_bytes() for part in ["001", "002"]))
    extracted = OUT / "extracted"
    with py7zr.SevenZipFile(combined) as archive:
        if archive.getnames() != ["DC_Regional-Brgy.gpkg"]:
            raise ValueError("Unexpected archive members")
        archive.extractall(extracted)
    path = extracted / "DC_Regional-Brgy.gpkg"
    frame = gpd.read_file(path, layer="QC-Brgy")
    if frame.crs.to_epsg() != 32651:
        raise ValueError("Unexpected source CRS")
    if len(frame) != 142 or frame.geometry.is_empty.any() or not frame.is_valid.all():
        raise ValueError("Invalid/incomplete source geometry; no automatic repairs")
    frame["sourceADM4_PCODE"] = frame.ADM4_PCODE
    crosswalk = json.loads((ROOT / "data/reference/upri_noah/barangay-crosswalk.json").read_text(encoding="utf-8"))
    for entry in crosswalk["records"]:
        selected = frame.index[frame.ADM4_PCODE.isna() & (frame.ADM4_EN == entry["sourceADM4_EN"])]
        csv = annual.loc[annual.ADM4_PCODE == entry["ADM4_PCODE"]]
        if len(selected) != 1 or len(csv) != 1 or csv.iloc[0].Barangay != entry["Barangay"]:
            raise ValueError("Explicit crosswalk source mismatch")
        if csv.iloc[0].Barangay.encode("latin-1").decode("utf-8") != entry["sourceADM4_EN"]:
            raise ValueError("Crosswalk encoding evidence mismatch")
        if any(pd.notna(frame.at[selected[0], f"DC_{year}"]) for year in range(2010, 2026)):
            raise ValueError("Crosswalk expects missing source joined case attributes")
        frame.at[selected[0], "ADM4_PCODE"] = entry["ADM4_PCODE"]
    # All 142 rows must match all source annual counts, including nulls.
    if frame.ADM4_PCODE.duplicated().any() or set(frame.ADM4_PCODE) != set(annual.ADM4_PCODE):
        raise ValueError("Barangay identifier join mismatch")
    joined = frame.set_index("ADM4_PCODE")
    for _, row in annual.iterrows():
        if pd.isna(joined.at[row.ADM4_PCODE, "sourceADM4_PCODE"]):
            continue
        for year in range(2010, 2026):
            a, b = joined.at[row.ADM4_PCODE, f"DC_{year}"], row[f"DC_{year}"]
            if not ((pd.isna(a) and pd.isna(b)) or a == b):
                raise ValueError("Geometry/CSV annual count mismatch")
    frame = frame.to_crs(4326)
    if not (120 < frame.total_bounds[0] < frame.total_bounds[2] < 123 and 13 < frame.total_bounds[1] < frame.total_bounds[3] < 16):
        raise ValueError("Unexpected QC bounds")
    geo = json.loads(frame[["ADM4_PCODE", "sourceADM4_PCODE", "geometry"]].to_json())
    write(WEB / "qc-barangays.geojson", geo)
    reference = ROOT / "data/reference/DC_Regional-Brgy.gpkg"
    return {"layer": "QC-Brgy", "sourceCrs": "EPSG:32651", "outputCrs": "EPSG:4326", "features": len(frame),
        "extractedSha256": sha256(path), "existingReferenceSha256": sha256(reference) if reference.exists() else None,
        "existingReferenceMatchesArchive": reference.exists() and sha256(reference) == sha256(path),
        "exactSourceIdJoins": 140, "explicitProjectCrosswalks": crosswalk}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-forecasts", action="store_true", help="Build geographic/observed derivatives only")
    args = parser.parse_args()
    sources = verify_sources()
    audit = json.loads((OUT / "audit.json").read_text())
    if audit["sources"] != sources:
        raise ValueError("Run audit_upri.py against current inputs before integration")
    annual = load_annual()
    geo = geometry(annual)
    write(OUT / "geometry-audit.json", geo)
    write(WEB / "qc-annual-burden.json", {"schemaVersion": "1.0", "measurementKind": "observed",
        "units": "reported cases / year", "geography": "QUEZON_CITY barangays", "source": sources,
        "records": source_rows(annual), "reconciliation": audit["annual"]["reconciliation"],
        "caveat": "Annual burden only; differs from city weekly totals. Null is missing, not zero."})
    for area in ["QUEZON_CITY", "NCR"]:
        frame, case, _ = load_weekly(area)
        write(OUT / f"{area}-observations.json", {"measurementKind": "observed", "sourceColumnsPreserved": True,
            "missingSourceBlocks": int(frame[case].isna().sum()), "records": source_rows(frame.dropna(subset=[case]))})
    if not args.skip_forecasts:
        runs, scores, detail = [], [], []
        for area in ["QUEZON_CITY", "NCR"]:
            a, b, c = forecast_area(area)
            runs.extend(a); scores.extend(b); detail.extend(c)
        write(OUT / "forecast-runs.json", {"schemaVersion": "1.0", "runs": runs})
        write(OUT / "backtest.json", {"schemaVersion": "1.0", "evaluation": "Expanding-origin quarterly retrospective 2024-2025, source blocks; eight matched origins per area/horizon. Not untouched prospective validation.",
            "scores": scores, "predictions": detail, "sourceSha256": sha256(WORKBOOK)})
    artifacts = [p for p in OUT.glob("*.json") if p.name != "manifest.json"] + [WEB / "qc-barangays.geojson", WEB / "qc-annual-burden.json"]
    write(OUT / "manifest.json", {"schemaVersion": "1.0", "transformVersion": VERSION, "sources": sources,
        "transformedAt": datetime.now(timezone.utc).isoformat(),
        "transformations": ["Audit original metadata/report and compare legacy QA", "Extract concatenated split archive without editing raw parts", "140 exact IDs and annual attribute matches plus two explicit project name crosswalks with absent source attributes; valid EPSG:32651 geometry -> EPSG:4326", "Copy source columns and nulls without imputation", "Reindex 52-block source ordinal, preserve missing years", "Direct horizons, training labels <= issue block; matched baselines and weather ablation"],
        "codeHashes": {str(p.relative_to(ROOT).as_posix()): sha256(p) for p in [Path(__file__), ROOT / "services/engine/upri_data.py", ROOT / "scripts/train_dengue.py", ROOT / "scripts/audit_upri.py", ROOT / "data/reference/upri_noah/barangay-crosswalk.json"]},
        "outputs": {p.relative_to(ROOT).as_posix(): sha256(p) for p in artifacts}, "geometry": geo,
        "software": {"python": sys.version, "pandas": pd.__version__, "numpy": np.__version__, "scikit-learn": sklearn.__version__}})
    print("Integration outputs written; raw sources unchanged.")


if __name__ == "__main__":
    main()
