"""Read immutable source observations; source blocks are deliberately not ISO dates."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/upri_noah"
WORKBOOK = RAW / "Dengue_Environmental Vars_Dataset.xlsx"
AREAS = {
    "QUEZON_CITY": ("QC Data", "DC_QC", ["RF_NASA", "Temp_ERA5-Land", "RH_ERA5-Land"]),
    "NCR": ("Regional Data", "DC_DOH", ["RF_HDX", "Temp_ERA5-Land", "SH_ERA5-Land"]),
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_sources(root=ROOT):
    manifest = json.loads((root / "data/reference/upri_noah/sources.json").read_text())
    for source in manifest["sources"]:
        if not source["sourceCommitId"] or sha256(root / source["path"]) != source["sha256"]:
            raise ValueError("UPRI source version/hash mismatch: " + source["path"])
    return manifest


def validate_weekly(frame, case, geography=None):
    required = ["YR", "WN", case] + ([geography] if geography else [])
    if not set(required).issubset(frame):
        raise ValueError("Missing source columns")
    if frame.empty or frame.duplicated(([geography] if geography else []) + ["YR", "WN"]).any():
        raise ValueError("Empty series or duplicate source block")
    for column in ["YR", "WN", case] + [c for c in frame if c.startswith("FLAG_")]:
        values = pd.to_numeric(frame[column], errors="raise")
        if values.isna().any() or not np.isfinite(values).all() or (values % 1 != 0).any():
            raise ValueError("Invalid integer field: " + column)
        if column == case and (values < 0).any():
            raise ValueError("Negative case counts")
        if column == "WN" and not values.between(1, 52).all():
            raise ValueError("Source convention requires WN 1..52")
        if column == "YR" and not values.between(2010, 2025).all():
            raise ValueError("Unexpected source year")
        if column.startswith("FLAG_") and not values.isin([0, 1]).all():
            raise ValueError("Invalid quality flag")
    for column in frame.select_dtypes(include="number"):
        if np.isinf(frame[column]).any():
            raise ValueError("Infinite source numeric value")


def load_weekly(area, workbook=WORKBOOK):
    sheet, case, weather = AREAS[area]
    frame = pd.read_excel(workbook, sheet_name=sheet)
    validate_weekly(frame, case, "REGION" if area == "NCR" else None)
    if area == "NCR":
        frame = frame.loc[frame.REGION == "NCR"].copy()
    if not set(weather).issubset(frame) or frame.empty:
        raise ValueError("Missing approved weather columns or area")
    frame = frame.sort_values(["YR", "WN"]).reset_index(drop=True)
    # Source-native ordinal prevents 2019 -> 2022 adjacency and invents no ISO week 53.
    frame.index = (frame.YR.astype(int) * 52 + frame.WN.astype(int) - 1).to_numpy()
    return frame.reindex(range(frame.index.min(), frame.index.max() + 1)), case, weather


def load_annual(path=RAW / "QC_YearlyData-Barangay(CSV).csv"):
    frame = pd.read_csv(path, dtype={"ADM4_PCODE": str})
    columns = [f"DC_{year}" for year in range(2010, 2026)]
    if not {"ADM4_PCODE", "Barangay", "DC_Mean", *columns}.issubset(frame):
        raise ValueError("Annual schema mismatch")
    if len(frame) != 142 or frame.ADM4_PCODE.isna().any() or frame.ADM4_PCODE.duplicated().any():
        raise ValueError("Annual barangay identifiers incomplete/duplicate")
    if not frame.ADM4_PCODE.str.fullmatch(r"PH1307404\d{3}").all():
        raise ValueError("Unexpected QC identifier")
    for column in columns:
        values = pd.to_numeric(frame[column], errors="raise").dropna()
        if not np.isfinite(values).all() or (values < 0).any() or (values % 1 != 0).any():
            raise ValueError("Invalid annual count")
    return frame
