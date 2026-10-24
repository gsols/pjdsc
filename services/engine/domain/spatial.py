"""Annual observed burden is separate from assumed weekly spatial allocations."""
import math


def annual_weights(records, issue_year, lag_years=1):
    # Assume each annual total becomes available after one additional full year.
    candidates = [year for year in range(2010, issue_year - lag_years)
                  if all(r.get(f"DC_{year}") is not None for r in records)]
    if not candidates:
        raise ValueError("No complete annual year before assumed availability cutoff")
    year = max(candidates)
    counts = [r[f"DC_{year}"] for r in records]
    if not counts or any(not math.isfinite(v) or v < 0 for v in counts):
        raise ValueError("Invalid annual count")
    # Add-one smoothing is an assumption; zero remains an observed zero in source data.
    total = sum(counts) + len(counts)
    return year, [(r["ADM4_PCODE"], (v + 1) / total) for r, v in zip(records, counts)]


def allocate(run, records):
    if run["area"] != "QUEZON_CITY":
        raise ValueError("NCR cannot be allocated to QC")
    year, weights = annual_weights(records, run["issueBlock"]["YR"])
    return {"schemaVersion": "1.0", "forecastRunId": run["id"], "measurementKind": "modeled_allocation",
        "units": "expected cases / source block", "weightYear": year,
        "assumptions": "Latest complete annual year, one additional full year availability lag; add-one smoothing. Source publication delay unknown.",
        "caveat": "Annual totals differ from city weekly totals; these are not observed weekly barangay cases or validated weekly hotspots.",
        "records": [{"ADM4_PCODE": ident, "weight": weight,
            "expectedCases": [p["meanCases"] * weight for p in run["weeklyPredictions"]]} for ident, weight in weights]}


def annual_backtest(records):
    output = []
    for year in range(2012, 2026):
        actual = [r.get(f"DC_{year}") for r in records]
        if any(v is None for v in actual) or not sum(actual):
            continue
        try:
            weight_year, weights = annual_weights(records, year)
        except ValueError:
            continue
        predicted = [w for _, w in weights]
        shares = [v / sum(actual) for v in actual]
        output.append({"targetYear": year, "weightYear": weight_year,
            "shareMae": sum(abs(a - b) for a, b in zip(shares, predicted)) / len(actual),
            "uniformShareMae": sum(abs(a - 1 / len(actual)) for a in shares) / len(actual),
            "evaluation": "Annual distribution only; no weekly validation"})
    return output
