"""Build DOH-backed hospital map data with explicitly provisional QC coordinates.

Usage: python scripts/build_facility_map.py "/path/to/v_activefacilities.csv"
Reads data/processed/hospital_coordinate_review.csv. Never labels historical
candidate coordinates as independently verified.
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "data/processed/hospital_coordinate_review.csv"
OUT = ROOT / "apps/web/public/data/facilities.json"
CITY_BY_PSGC = {
    "1380100000":"CALOOCAN","1380200000":"LAS_PINAS","1380300000":"MAKATI",
    "1380400000":"MALABON","1380500000":"MANDALUYONG","1380600000":"MANILA",
    "1380700000":"MARIKINA","1380800000":"MUNTINLUPA","1380900000":"NAVOTAS",
    "1381000000":"PARANAQUE","1381100000":"PASAY","1381200000":"PASIG",
    "1381300000":"QUEZON_CITY","1381400000":"SAN_JUAN","1381500000":"TAGUIG",
    "1381600000":"VALENZUELA","1381700000":"PATEROS",
}
def norm(s):
    s = unicodedata.normalize("NFKD", s or "").upper()
    return "".join(c for c in s if not unicodedata.combining(c) and c.isalnum())
def main(source):
    with Path(source).open(encoding="utf-8-sig", newline="") as f:
        official = list(csv.DictReader(f))
    with REVIEW.open(encoding="utf-8-sig", newline="") as f:
        matches = {r["facility_id"]:r for r in csv.DictReader(f)}
    out = []
    provisional = 0
    for r in official:
        if r.get("Region PSGC", "").strip() != "1300000000" or r.get("Health Facility Type", "").strip().lower() != "hospital":
            continue
        code = r["Health Facility Code"].strip()
        city = CITY_BY_PSGC.get(r["City/Municipality PSGC"].strip())
        if not city:
            raise ValueError("Unknown NCR city PSGC " + r["City/Municipality PSGC"])
        beds = r.get("Bed Capacity","").strip()
        capacity = int(float(beds)) if re.fullmatch(r"\\d+(?:\\.0+)?", beds) else None
        item = {
            "id":code, "name":r["Facility Name"].strip(), "city":city,
            "latitude":None, "longitude":None, "authorizedBeds":capacity,
            "source":"DOH NHFR active-facilities CSV; provisional location: historical ljyflores hospital dataset",
            "verifiedAt":None, "coordinateStatus":"UNAVAILABLE",
            "facilityType":r["Health Facility Type"].strip(),
            "ownership":r.get("Ownership Major Classification","").strip(),
            "serviceCapability":r.get("Service Capability","").strip(),
            "licenseValidUntil":r.get("License Validity Date","").strip() or None,
            "address":", ".join(filter(None, [r.get("Street Name and #","").strip(),r.get("Barangay Name","").strip(),r.get("City/Municipality Name","").strip()])),
        }
        candidate = matches.get(code)
        if city == "QUEZON_CITY" and candidate:
            agree = (
                norm(candidate["nhfr_name"]) == norm(candidate["candidate_name"])
                and norm(candidate["nhfr_city"]) == norm(candidate["candidate_city"])
                and norm(candidate["nhfr_barangay"]) == norm(candidate["candidate_barangay"])
            )
            try:
                lat,lon = float(candidate["latitude"]),float(candidate["longitude"])
                in_bounds = 14.45 < lat < 14.80 and 120.95 < lon < 121.20
            except (TypeError,ValueError):
                in_bounds = False
            if agree and in_bounds:
                item["latitude"],item["longitude"] = lat,lon
                item["coordinateStatus"] = "PROVISIONAL_HISTORICAL_MATCH"
                provisional += 1
        out.append(item)
    if len(out) != 165:
        raise ValueError(f"Expected 165 DOH NCR hospital records, got {len(out)}")
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
    print(f"Wrote {len(out)} DOH hospital records to {OUT}; {provisional} QC provisional coordinates.")
    print("Provisional coordinates are NOT independently verified. Remaining locations stay null.")
if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/build_facility_map.py "/path/to/v_activefacilities.csv"')
    main(sys.argv[1])
