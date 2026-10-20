"""Match official NHFR facilities to historical coordinate candidates.

Run at repository root:
python scripts/match_hospital_coordinates.py /path/to/v_activefacilities.csv

Outputs a CSV for human review. Does not overwrite facilities.json.
Only enter coordinates in the production map after verifying each candidate.
"""
import csv
import json
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data/reference/historical_hospital_coordinate_candidates.json"
OUTPUT = ROOT / "data/processed/hospital_coordinate_review.csv"

def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.upper().replace("Ñ", "N")
    value = re.sub(r"[^A-Z0-9]+", " ", value)
    return " ".join(value.split())

def name_score(a, b):
    return SequenceMatcher(None, norm(a), norm(b)).ratio()

def main(path):
    official = list(csv.DictReader(Path(path).open(encoding="utf-8-sig", newline="")))
    candidates = json.loads(CANDIDATES.read_text())["records"]
    reviews = []
    for hospital in official:
        if hospital.get("Region PSGC", "").strip() != "1300000000":
            continue
        if hospital.get("Health Facility Type", "").strip().lower() != "hospital":
            continue
        name = hospital["Facility Name"].strip()
        rated = sorted(((name_score(name, c["name"]), c) for c in candidates),
                       key=lambda item: item[0], reverse=True)
        best_score, best = rated[0]
        runner_up = rated[1][0]
        # A similarity match is NEVER equivalent to coordinate verification.
        reviews.append({
            "facility_id": hospital["Health Facility Code"],
            "nhfr_name": name,
            "nhfr_city": hospital["City/Municipality Name"],
            "nhfr_barangay": hospital.get("Barangay Name", ""),
            "candidate_name": best["name"],
            "candidate_city": best["city"],
            "candidate_barangay": best["barangay"],
            "latitude": best["latitude"] if best_score >= .85 else "",
            "longitude": best["longitude"] if best_score >= .85 else "",
            "name_similarity": round(best_score, 4),
            "runner_up_similarity": round(runner_up, 4),
            "review_status": "NEEDS_MANUAL_VERIFICATION" if best_score >= .85 else "NO_RELIABLE_MATCH",
            "verified_coordinate_source": "",
            "review_notes": "",
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=reviews[0].keys())
        writer.writeheader()
        writer.writerows(reviews)
    high = sum(row["name_similarity"] >= .85 for row in reviews)
    print(f"{len(reviews)} DOH NCR hospitals; {high} candidate name matches needing review.")
    print(f"Created {OUTPUT}. No coordinates were automatically approved.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/match_hospital_coordinates.py /path/to/v_activefacilities.csv")
    main(sys.argv[1])
