"""Convert a DOH NHFR active-facilities CSV into the application facility JSON.

Usage:
    python scripts/import_nhfr.py /path/to/v_activefacilities.csv
No coordinates are inferred; all marker locations remain null until verified.
"""
import csv
import json
import re
import sys
from pathlib import Path

CITIES = [
    "CALOOCAN", "LAS_PINAS", "MAKATI", "MALABON", "MANDALUYONG",
    "MANILA", "MARIKINA", "MUNTINLUPA", "NAVOTAS", "PARANAQUE",
    "PASAY", "PASIG", "QUEZON_CITY", "SAN_JUAN", "TAGUIG",
    "VALENZUELA", "PATEROS"
]
CODE_PREFIX = {f"138{i:02d}": name for i, name in enumerate(CITIES, 1)}

def run(csv_path: Path) -> None:
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        records = list(csv.DictReader(handle))
    facilities = []
    for record in records:
        if record["Region PSGC"].strip() != "1300000000":
            continue
        if record["Health Facility Type"].strip().casefold() != "hospital":
            continue
        city_code = record["City/Municipality PSGC"].strip()
        city = CODE_PREFIX.get(city_code[:5])
        if not city:
            raise ValueError(f"Unexpected city PSGC: {city_code}")
        value = record["Bed Capacity"].strip()
        capacity = int(float(value)) if re.fullmatch(r"\d+(?:\.0+)?", value) else None
        if capacity is not None and capacity < 0:
            raise ValueError("Negative bed capacity")
        facilities.append({
            "id": record["Health Facility Code"].strip(),
            "name": record["Facility Name"].strip(),
            "city": city,
            "latitude": None,
            "longitude": None,
            "authorizedBeds": capacity,
            "source": "DOH NHFR active facilities export",
            "verifiedAt": None,
            "facilityType": record["Health Facility Type"].strip(),
            "ownership": record["Ownership Major Classification"].strip(),
            "serviceCapability": record["Service Capability"].strip(),
            "licenseValidUntil": record["License Validity Date"].strip() or None,
            "address": ", ".join(filter(None, [
                record["Street Name and #"].strip(),
                record["Barangay Name"].strip(),
                record["City/Municipality Name"].strip(),
            ])),
        })
    output = Path(__file__).resolve().parents[1] / "apps/web/public/data/facilities.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(facilities, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(facilities)} hospital records; "
          f"{sum(f['authorizedBeds'] is not None for f in facilities)} with bed capacity; "
          f"{sum(f['city'] == 'QUEZON_CITY' for f in facilities)} in QC. "
          "Coordinates remain null pending verification.")
if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/import_nhfr.py /path/to/v_activefacilities.csv")
    run(Path(sys.argv[1]))
