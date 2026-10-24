"""Offline source QA and API guards; mutated records are test fixtures only."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from services.engine.main import app
from services.engine.repositories.facility import ROOT, load_facilities, validate_records, FacilityDatasetError


class FacilityTests(unittest.TestCase):
    def setUp(self):
        self.records = load_facilities()
        boundaries = json.loads((ROOT / "apps/web/public/data/ncr-cities.geojson").read_text())
        self.geometry = next(f["geometry"] for f in boundaries["features"] if f["properties"]["area_id"] == "QUEZON_CITY")

    def test_canonical_inventory(self):
        self.assertEqual(len(self.records), 46)
        self.assertEqual(sum(r["accreditedBeds"] for r in self.records), 9389)
        self.assertEqual(len({(r["latitude"], r["longitude"]) for r in self.records}), 46)
        self.assertTrue(all(r["normalStaffedCapacity"] is None and r["dengueInpatientEligible"] is None for r in self.records))

    def test_invalid_records_fail_closed(self):
        for key, value in [("accreditedBeds", -1), ("accreditedBeds", float("nan")), ("latitude", float("inf")), ("longitude", 0), ("coordinateStatus", "VERIFIED"), ("coordinateIsVerifiedEntrance", True), ("normalStaffedCapacity", 100), ("dengueInpatientEligible", True), ("coordinateSourceUrl", ""), ("city", "NCR"), ("id", "HOSP-615")]:
            with self.subTest(key=key, value=value):
                rows = copy.deepcopy(self.records)
                rows[0][key] = value
                with self.assertRaises(FacilityDatasetError):
                    validate_records(rows, self.geometry)
        with self.assertRaises(FacilityDatasetError):
            validate_records(self.records[:-1], self.geometry)

    def test_reviewed_branches_and_san_lorenzo(self):
        expected = {"HOSP-626": (14.6705308, 121.0320837), "HOSP-627": (14.65939, 121.0236), "HOSP-649": (14.73573, 121.06916)}
        for ident, point in expected.items():
            record = next(r for r in self.records if r["id"] == ident)
            self.assertEqual((record["latitude"], record["longitude"]), point)
        rows = copy.deepcopy(self.records)
        rows[0]["latitude"], rows[0]["longitude"] = rows[1]["latitude"], rows[1]["longitude"]
        with self.assertRaises(FacilityDatasetError):
            validate_records(rows, self.geometry)

    def test_missing_and_corrupt_files_have_no_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(FacilityDatasetError):
                load_facilities(root)
            for relative in ["data/processed/qc_philhealth_manifest_2026_10_24.json", "apps/web/public/data/qc-philhealth-hospitals.json", "apps/web/public/data/ncr-cities.geojson"]:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
            self.assertEqual(len(load_facilities(root)), 46)
            manifest_path = root / "data/processed/qc_philhealth_manifest_2026_10_24.json"
            original_manifest = manifest_path.read_text()
            for bad_manifest in [[], {"datasetId": "wrong"}, {**json.loads(original_manifest), "accreditedHospitalBedsSum": 0}]:
                manifest_path.write_text(json.dumps(bad_manifest))
                with self.assertRaises(FacilityDatasetError):
                    load_facilities(root)
            manifest_path.write_text(original_manifest)
            (root / "apps/web/public/data/qc-philhealth-hospitals.json").write_text("[]")
            with self.assertRaises(FacilityDatasetError):
                load_facilities(root)

    def test_api_and_legacy_guards(self):
        client = TestClient(app)
        self.assertEqual(client.get("/health").status_code, 200)
        self.assertEqual(len(client.get("/v1/facilities").json()["facilities"]), 46)
        self.assertFalse(client.get("/readiness").json()["ready"])
        self.assertEqual(client.post("/simulate", json={"area": "QUEZON_CITY"}).status_code, 422)
        self.assertEqual(client.post("/simulate", json={"area": "QUEZON_CITY", "forecast_run_id": "not-approved"}).status_code, 503)
        self.assertEqual(client.post("/simulate", json={"area": "QUEZON_CITY", "forecast_run_id": "x", "facilities": self.records[:1]}).status_code, 422)
        self.assertEqual(client.post("/simulate", json={"area": "QUEZON_CITY", "forecast_run_id": "x", "facilities": self.records}).status_code, 413)

    def test_api_dataset_failure(self):
        from unittest.mock import patch
        with patch("services.engine.main.load_facilities", side_effect=FacilityDatasetError()):
            client = TestClient(app)
            self.assertEqual(client.get("/v1/facilities").status_code, 503)
            self.assertFalse(client.get("/readiness").json()["facilities"]["ready"])


if __name__ == "__main__":
    unittest.main()
