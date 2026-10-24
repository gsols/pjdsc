"""Spatial movie invariants. Constructed arrays below are synthetic test fixtures."""
import copy
import json
from fastapi.testclient import TestClient
import pytest
from shapely.geometry import Point, shape
from services.engine.main import app
from services.engine.api.outbreak import illustrative_movie, OutbreakInput
from services.engine.domain.outbreak import distance_km, spatial_trajectory, build_movie
from services.engine.upri_data import ROOT


@pytest.fixture(scope="module")
def demo():
    return illustrative_movie()


def test_distance_geometry_nearest_and_provisional_inventory(demo):
    assert distance_km([121, 14], [121, 14]) == 0
    assert distance_km([0, 0], [1, 0]) == pytest.approx(111.195, rel=.00001)
    assert distance_km([121, 14], [122, 15]) == pytest.approx(distance_km([122, 15], [121, 14]))
    context = demo["context"]
    assert len(context["barangays"]) == 142 and len(context["hospitals"]) == 46
    geometry = json.loads((ROOT / "apps/web/public/data/qc-barangays.geojson").read_text())
    polygons = {f["properties"]["ADM4_PCODE"]: shape(f["geometry"]) for f in geometry["features"]}
    hospitals = {h["id"]: h for h in context["hospitals"]}
    for b in context["barangays"]:
        assert polygons[b["id"]].covers(Point(b["coordinates"]))
        expected = sorted(hospitals, key=lambda h: (distance_km(b["coordinates"], hospitals[h]["coordinates"]), h))[:3]
        assert [h["facilityId"] for h in b["nearestHospitals"]] == expected
        contained = {ident for ident, h in hospitals.items() if polygons[b["id"]].covers(Point(h["coordinates"]))}
        assert {h["facilityId"] for h in b["hospitalsWithinBarangay"]} == contained
        assert all(h["distanceKm"] >= 0 for h in b["hospitalsWithinBarangay"])
    assert any(len(b["hospitalsWithinBarangay"]) > 1 for b in context["barangays"])
    assert all(h["coordinateStatus"].startswith("PROVISIONAL") and h["dengueInpatientEligible"] is None for h in hospitals.values())
    assert context["weightYear"] <= 2023


def synthetic_reference():
    return {"weeklyPredictions": [{"meanCases": 70.0}] * 4}


def synthetic_context():
    return {"barangays": [{"id": "A", "coordinates": [121, 14], "weight": .6},
                          {"id": "B", "coordinates": [121.05, 14], "weight": .4}],
            "hospitals": [{"id": "H1", "coordinates": [121, 14]}]}


def test_declared_front_expands_and_preserves_daily_cases():
    series = spatial_trajectory(synthetic_reference(), synthetic_context(), "A", 70, .1, 1, 1, 28, "step")
    assert series[0]["barangays"][1]["shockCases"] == 0
    assert series[7]["barangays"][1]["shockCases"] > 0
    for day in series:
        assert sum(b["expectedCases"] for b in day["barangays"]) == pytest.approx(day["expectedCases"])
        assert sum(b["baselineCases"] for b in day["barangays"]) == pytest.approx(10)
        assert sum(b["shockCases"] for b in day["barangays"]) == pytest.approx(10)
    zero = spatial_trajectory(synthetic_reference(), synthetic_context(), "A", 0, .1, 1, 10, 28)
    assert all(d["expectedCases"] == 10 and sum(b["shockCases"] for b in d["barangays"]) == 0 for d in zero)
    short = spatial_trajectory(synthetic_reference(), synthetic_context(), "A", 0, .1, 1, 10, 7)
    assert all(d["expectedCases"] == 0 for d in short[7:])


def test_movie_dates_mass_balance_and_route_accounting(demo):
    days = demo["days"]
    assert len(days) == 29 and days[0]["cumulativeCases"] == days[0]["cumulativeArrivals"] == 0
    assert days[0]["intervalStart"] == days[0]["intervalEnd"]
    assert days[7]["date"] == "2025-02-03" and days[28]["date"] == "2025-02-24"
    assert days[1]["intervalStart"] == days[0]["snapshotAt"]
    for day in days:
        assert sum(b["expectedCases"] for b in day["barangays"]) == pytest.approx(day["expectedCases"])
        assert sum(b["cumulativeCases"] for b in day["barangays"]) == pytest.approx(day["cumulativeCases"])
        assert day["cumulativeArrivals"] == pytest.approx(day["supportedCensus"] + day["holdingCensus"] + day["cumulativeDischarges"] + day["cumulativeUnresolved"])
        assert sum(r["supportedPlacements"] + r["holdingPlacements"] for r in day["assignments"]) == pytest.approx(day["arrivals"] - day["unresolvedToday"])
        assert abs(day["balanceError"]) < 1e-7
        assert all(r["distanceKm"] >= 0 for r in day["assignments"])
    assert days[-1]["cumulativeUnresolved"] > 0
    assert all(f["activatedSurgeCapacity"] == 0 for f in days[6]["facilities"])
    assert all(f["activatedSurgeCapacity"] == 10 for f in days[7]["facilities"])
    assert len(days[-1]["expansionRing"]) == 73


def test_dates_cross_year_and_zero_shock_reproducibility(demo):
    config = OutbreakInput.model_validate({**demo["parameters"], "startDate": "2024-12-25", "endDate": "2025-01-22", "extraCasesPerWeek": 0}).model_dump()
    first = build_movie(synthetic_reference(), copy.deepcopy(demo["context"]), config)
    assert first == build_movie(synthetic_reference(), copy.deepcopy(demo["context"]), config)
    assert first["days"][-1]["date"] == "2025-01-22"
    assert first["days"][-1]["cumulativeCases"] == pytest.approx(280)
    assert first["days"][-1]["cumulativeShockCases"] == 0
    assert all(not d["expansionRing"] for d in first["days"])


def test_nearest_capacity_routing_and_delay_fixture():
    from services.engine.domain.patient_flow import simulate_flow
    facilities = [{"facilityId": "near", "normalCapacity": 1, "surgeCapacity": 0, "holdingCapacity": 0},
                  {"facilityId": "far", "normalCapacity": 2, "surgeCapacity": 0, "holdingCapacity": 0}]
    groups = [[{"originId": "A", "cases": 4, "facilityOrder": ["near", "far"]}]] + [[] for _ in range(27)]
    days = simulate_flow([0]*4, facilities, 1, 4, 0, delay=1, daily_groups=groups)
    assert days[1]["arrivals"] == 0 and days[2]["arrivals"] == 4
    assert [(r["facilityId"], r["supportedPlacements"]) for r in days[2]["assignments"]] == [("near", 1), ("far", 2)]
    assert days[2]["unresolvedToday"] == 1 and days[6]["discharges"] == 3


def test_outbreak_api_validation_and_persistence(demo):
    client = TestClient(app)
    body = copy.deepcopy(demo["parameters"])
    assert client.get("/v1/outbreak-scenarios/" + demo["scenarioId"]).json() == demo
    assert client.post("/v1/outbreak-scenarios", json=body).json() == demo
    assert client.get("/v1/outbreak-context/" + body["forecastRunId"]).status_code == 200
    assert client.get("/v1/outbreak-scenarios/not-a-hash").status_code == 404
    for key, value in [("scenarioKind", "live"), ("acknowledgeHypotheticalDates", False), ("endDate", "2025-01-27"),
        ("endDate", "2025-03-01"), ("extraCasesPerWeek", -1), ("expansionKmPerDay", -1), ("growthDays", 0),
        ("seedBarangayId", "PH1307404999"), ("forecastRunId", "upri-source-block-v1-NCR-2025-4")]:
        response = client.post("/v1/outbreak-scenarios", json={**body, key: value})
        assert response.status_code == 422, response.text
    duplicate = copy.deepcopy(body); duplicate["facilities"] *= 2
    assert client.post("/v1/outbreak-scenarios", json=duplicate).status_code == 422
    response = client.post("/v1/outbreak-scenarios", json={**body, "endDate": "2025-02-03", "extraCasesPerWeek": 0})
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["days"]) == 8 and data["days"][-1]["dayIndex"] == 7
    assert client.get("/v1/outbreak-scenarios/" + data["scenarioId"]).json() == data
