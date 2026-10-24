"""Audit before preprocessing/training. Outputs are evidence, not rewritten observations."""
import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from services.engine.upri_data import WORKBOOK, load_annual, load_weekly, verify_sources


def audit():
    provenance = verify_sources()
    annual = load_annual()
    book = pd.ExcelFile(WORKBOOK)
    dictionary = pd.read_excel(book, "Data Dictionary", header=1)
    summary = pd.read_excel(book, "Dataset Summary", header=None)
    report = pd.read_excel(ROOT / "data/reference/upri_noah/environmental_validation_report.xlsx", sheet_name=None)
    old = json.loads((ROOT / "services/engine/models/data_quality_report.json").read_text())
    result = {"schemaVersion": "1.0", "sources": provenance, "weekly": {}, "annual": {},
              "upstreamReportSheetsRead": list(report), "discrepancies": [
        "WN dictionary says ISO; Dataset Summary and R validation use 52 source blocks. Existing ISO reindexing inserts artificial week-53 gaps. Use source YR/WN ordinal only; calendar dates remain unresolved.",
        "Upstream validation report is stale: it lists COUNTRY vs SETTING and *_ERA5 names, while the current dictionary has SETTING and current columns use *_ERA5-Land. Do not treat its checks as certification of this workbook.",
        "Existing saved forecast evaluations lack source hashes and cannot be certified against this workbook or used as runnable forecast runs.",
        "Source publication/vintage delays are unknown; retrospective observed-through availability is an assumption, not a historically issued forecast.",
    ]}
    missing_dict = sorted(set().union(*(set(pd.read_excel(book, s).columns) for s in ["QC Data", "Regional Data", "Multi-Setting Data"])) - set(dictionary.CODE))
    result["dictionaryMissingColumns"] = missing_dict
    result["summaryWeeklyNotes"] = [str(row[1]) for row in summary.values if str(row[0]) == "Weekly alignment"]
    for area in ["QUEZON_CITY", "NCR"]:
        frame, case, weather = load_weekly(area)
        observed = frame.dropna(subset=[case])
        quality = {"sourceRows": len(observed), "missingSourceBlocks": int(frame[case].isna().sum()),
            "missingYears": sorted(set(range(int(observed.YR.min()), int(observed.YR.max()) + 1)) - set(observed.YR.astype(int))),
            "columns": list(observed.columns), "missingValues": observed.isna().sum().astype(int).to_dict(),
            "flagCounts": {c: {str(k): int(v) for k, v in observed[c].value_counts(dropna=False).items()} for c in observed if c.startswith("FLAG_")},
            "yearBlockCounts": observed.groupby("YR").size().to_dict()}
        result["weekly"][area] = quality
        if len(observed) != old[area]["source_rows"]:
            result["discrepancies"].append(f"{area}: source row count differs from existing QA")
        for c in weather:
            if int(observed[c].isna().sum()) != old[area]["weather_missing_values"][c]:
                result["discrepancies"].append(f"{area}: {c} missingness differs from existing QA")
    qc, case, _ = load_weekly("QUEZON_CITY")
    result["annual"] = {"rows": len(annual), "missingValues": annual.isna().sum().astype(int).to_dict(), "reconciliation": []}
    for year in range(2010, 2026):
        a = annual[f"DC_{year}"]
        weekly = int(qc.loc[qc.YR == year, case].sum())
        total = int(a.sum(min_count=1))
        result["annual"]["reconciliation"].append({"year": year, "annualKnownSubtotal": total,
            "missingBarangays": int(a.isna().sum()), "weeklyCityTotal": weekly, "differenceKnownSubtotalMinusCity": total - weekly})
    result["annual"]["dcMeanMismatchRows"] = int((annual.filter(regex=r"^DC_\d{4}$").mean(axis=1) - annual.DC_Mean).abs().gt(1e-6).sum())
    result["discrepancies"].append("Annual barangay known subtotals require separate reconciliation with city weekly totals; missing annual cells remain null and no city totals are overwritten.")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/processed/upri_noah/audit.json")
    args = parser.parse_args()
    result = audit()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"discrepancies": result["discrepancies"], "annual": result["annual"], "dictionaryMissingColumns": result["dictionaryMissingColumns"]}, indent=2))


if __name__ == "__main__":
    main()
