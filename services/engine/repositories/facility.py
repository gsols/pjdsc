"""Approved QC inventory. Never substitute the archived NHFR registry."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATASET_ID = "PHIC_QC_HOSP_2026_09_30_GEO_REVIEW_2026_10_24"
HOSPITAL_PATH = "apps/web/public/data/qc-philhealth-hospitals.json"
HOSPITAL_SHA256 = "929cbeb97a0edffdfeb8257ad5857347b9b56661004dbdaa364f4873fbd620c5"
PROVISIONAL = {"PROVISIONAL_OSM", "PROVISIONAL_HISTORICAL_MATCH", "PROVISIONAL_THIRD_PARTY"}


class FacilityDatasetError(ValueError):
    """The approved inventory is unavailable or differs from its reviewed version."""


def in_ring(x, y, ring):
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y):
            if x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
                inside = not inside
    return inside


def in_geometry(x, y, geometry):
    if geometry["type"] not in {"Polygon", "MultiPolygon"}:
        raise FacilityDatasetError("QC boundary must be Polygon or MultiPolygon")
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return any(in_ring(x, y, p[0]) and not any(in_ring(x, y, h) for h in p[1:]) for p in polygons)


def validate_records(records, geometry):
    if not isinstance(records, list) or len(records) != 46:
        raise FacilityDatasetError("Expected 46 active QC hospital records")
    if {r["id"] for r in records} != {f"HOSP-{n}" for n in range(614, 660)}:
        raise FacilityDatasetError("Active hospital IDs differ from approved version")
    points = set()
    beds = 0
    for r in records:
        if r["city"] != "QUEZON_CITY" or r["datasetRole"] != "QC_HOSPITAL_PRIMARY" or r["facilityType"] != "HOSPITAL_INFIRMARY":
            raise FacilityDatasetError("Unsupported facility scope")
        bed = r["accreditedBeds"]
        if type(bed) is not int or bed < 0:
            raise FacilityDatasetError("Invalid accredited beds")
        beds += bed
        x, y = r["longitude"], r["latitude"]
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (x, y)):
            raise FacilityDatasetError("Missing or nonfinite coordinates")
        if not (-180 <= x <= 180 and -90 <= y <= 90) or not in_geometry(x, y, geometry):
            raise FacilityDatasetError("Hospital point outside QC boundary")
        if (x, y) in points:
            raise FacilityDatasetError("Duplicate hospital point")
        points.add((x, y))
        if r["coordinateStatus"] not in PROVISIONAL or r["coordinateIsVerifiedEntrance"] is not False or r["coordinateVerifiedAt"] is not None:
            raise FacilityDatasetError("Unapproved coordinate verification claim")
        for key in ("authorizedBeds", "implementedBeds", "normalStaffedCapacity", "dengueUsableBeds", "dengueInpatientEligible"):
            if r[key] is not None:
                raise FacilityDatasetError("Operational capability must remain unknown")
        for key in ("primarySourceUrl", "coordinateSourceUrl", "accreditedBedsSource"):
            if not isinstance(r[key], str) or not r[key].startswith("https://"):
                raise FacilityDatasetError("Missing source evidence URL")
        if r["sourceAsOf"] != "2026-09-30":
            raise FacilityDatasetError("Unexpected source date")
    if beds != 9389:
        raise FacilityDatasetError("Expected 9,389 accredited beds")
    by_id = {r["id"]: r for r in records}
    for ident, point in {"HOSP-626": (14.67053080, 121.03208370), "HOSP-627": (14.65939000, 121.02360000), "HOSP-649": (14.73573000, 121.06916000)}.items():
        if (by_id[ident]["latitude"], by_id[ident]["longitude"]) != point:
            raise FacilityDatasetError("Reviewed branch coordinate mismatch")
    return records


def load_facilities(root=ROOT):
    try:
        manifest = json.loads((root / "data/processed/qc_philhealth_manifest_2026_10_24.json").read_text(encoding="utf-8"))
        if not isinstance(manifest, dict):
            raise FacilityDatasetError("Invalid QC manifest")
        expected = {"datasetId": DATASET_ID, "publishedAsOf": "2026-09-30", "region": "QUEZON_CITY", "activeHospitals": 46, "activeHospitalCoordinatesPresent": 46, "activeHospitalVerifiedEntrances": 0, "accreditedHospitalBedsSum": 9389}
        if any(manifest.get(key) != value for key, value in expected.items()):
            raise FacilityDatasetError("QC manifest metadata mismatch")
        raw = (root / HOSPITAL_PATH).read_bytes()
        if manifest["datasetId"] != DATASET_ID or manifest["fileSHA256"][HOSPITAL_PATH] != HOSPITAL_SHA256 or hashlib.sha256(raw).hexdigest() != HOSPITAL_SHA256:
            raise FacilityDatasetError("QC facility dataset version/checksum mismatch")
        boundaries = json.loads((root / "apps/web/public/data/ncr-cities.geojson").read_text(encoding="utf-8"))
        qc = [f for f in boundaries["features"] if f["properties"]["area_id"] == "QUEZON_CITY"]
        if len(qc) != 1:
            raise FacilityDatasetError("QC boundary unavailable or ambiguous")
        return validate_records(json.loads(raw), qc[0]["geometry"])
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise FacilityDatasetError("Approved QC facility dataset failed validation; no fallback is permitted") from exc
