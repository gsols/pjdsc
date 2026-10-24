"""QC automatic forecasts, conditional ranges, bounds and allocation policy contracts."""
import copy
import hashlib
import json

from fastapi.testclient import TestClient
import pytest
from shapely.geometry import shape

from scripts.build_qc_environmental_forecasts import residual_radius
from services.engine.main import app
from services.engine.api.qc_simulation import default_workspace, select_reference
from services.engine.domain.optimizer import transport_plan
from services.engine.domain.outbreak import period_case_range
from services.engine.domain.outbreak import allocated_forecast_trajectory
from services.engine.repositories.forecast_runs import load_environmental_runs, FOLDER
from services.engine.upri_data import ROOT, sha256


@pytest.fixture(scope="module")
def result():
    return default_workspace()


def test_environmental_artifacts_no_future_labels_or_calibration():
    runs = load_environmental_runs()
    assert len(runs) == 8
    for run in runs:
        origin = run["issueBlock"]["YR"] * 52 + run["issueBlock"]["WN"] - 1
        assert run["model"] == "cases_weather"
        assert {r["sourceColumn"] for r in run["environmentalInputs"]} == {"RF_NASA", "Temp_ERA5-Land", "RH_ERA5-Land"}
        assert all(r["lagsSourceBlocks"] == [1, 2, 4] for r in run["environmentalInputs"])
        assert len(run["calibrationResidualPaths"]) >= 20
        assert all(p["lastTargetBlock"] <= origin and p["lastTargetBlock"] == p["originBlock"] + 4 for p in run["calibrationResidualPaths"])
        assert all(p["lastTrainingTargetBlock"] <= origin and 0 <= p["lowerCases"] <= p["meanCases"] <= p["upperCases"] for p in run["weeklyPredictions"])


def test_place_progression_uses_its_own_dated_allocation_without_neighbor_events():
    # Explicit synthetic forecast/share fixture, not observed barangay counts.
    run = {"weeklyPredictions": [{"meanCases": value} for value in [70, 140, 35, 210]]}
    context = {"barangays": [{"id": "A", "weight": .6, "coordinates": [121, 14]},
                              {"id": "B", "weight": .4, "coordinates": [122, 15]}]}
    config = {"extraCasesPerWeek": 0, "growthDays": 7, "shockProfile": "ramp", "seedBarangayId": "A"}
    days = allocated_forecast_trajectory(run, context, config, 28)
    for index, day in enumerate(days):
        by_place = {b["barangayId"]: b for b in day["barangays"]}
        baseline = [10, 20, 5, 30][index // 7]
        assert by_place["A"]["expectedCases"] == pytest.approx(baseline * .6)
        assert by_place["B"]["expectedCases"] == pytest.approx(baseline * .4)
        assert sum(b["expectedCases"] for b in day["barangays"]) == pytest.approx(day["expectedCases"])
        assert day["assumedRadiusKm"] == 0
    # Moving the neighbor/seed and reversing iteration cannot change a place's path.
    moved = copy.deepcopy(context)
    moved["barangays"][1]["coordinates"] = [0, 0]
    moved["barangays"].reverse()
    reordered = allocated_forecast_trajectory(run, moved, {**config, "seedBarangayId": "B", "initialRadiusKm": 20, "expansionKmPerDay": 5}, 28)
    for before, after in zip(days, reordered):
        assert {b["barangayId"]: b["expectedCases"] for b in before["barangays"]} == {b["barangayId"]: b["expectedCases"] for b in after["barangays"]}
    run["dailyPredictions"] = [{"meanCases": 30 if i == 0 else 7} for i in range(28)]
    daily = allocated_forecast_trajectory(run, context, config, 2)
    assert daily[0]["barangays"][1]["expectedCases"] == 12
    assert daily[1]["barangays"][1]["expectedCases"] == pytest.approx(2.8)
    assert all(d["expectedCases"] == 0 for d in daily[2:])


def test_automatic_workspace_never_invokes_the_radial_outbreak_path(monkeypatch):
    from services.engine.domain import outbreak
    def forbidden(*args, **kwargs):
        raise AssertionError("Forecast workspace invoked radial outbreak sequence")
    monkeypatch.setattr(outbreak, "spatial_trajectory", forbidden)
    workspace = default_workspace()
    assert workspace["progressionMethod"] == "dated_QC_forecast_allocated_by_xgboost_annual_burden_shares"


def test_changed_simulation_code_blocks_stale_worker_before_loading_or_saving(monkeypatch):
    from fastapi import HTTPException
    from services.engine.api import outbreak
    monkeypatch.setitem(outbreak._LOADED_CODE_HASHES, "bed_forecast", "outdated-worker")
    # Guard must run before reading parameters, cache or source inputs.
    with pytest.raises(HTTPException) as error:
        outbreak.create_movie(None)
    assert error.value.status_code == 503
    assert error.value.detail["code"] == "ENGINE_RESTART_REQUIRED"


def test_residual_range_is_data_derived_and_preserves_path_covariance():
    with pytest.raises(ValueError): residual_radius([1] * 19)
    assert residual_radius(list(range(20))) == 16
    fixture = {"weeklyPredictions": [{"meanCases": 100}] * 4,
        "calibrationResidualPaths": [{"residuals": [10, -10, 10, -10]}] * 20}
    first = period_case_range(fixture, 7)
    second = period_case_range(fixture, 14)
    assert first["lowerCases"] == 90 and first["upperCases"] == 110
    assert second["lowerCases"] == second["upperCases"] == 200


def test_automatic_qc_scope_ranges_and_capacity_definition(result):
    assert result["scope"] == "QUEZON_CITY" and result["parameters"]["autoHotspots"] is True
    assert result["parameters"]["extraCasesPerWeek"] == 0
    assert result["forecastEvidence"]["model"] == "cases_weather"
    assert len(result["context"]["barangays"]) == len(result["periodSummary"]["barangays"]) == 142
    assert len(result["context"]["hospitals"]) == len(result["days"][-1]["facilities"]) == 46
    assert sum(h["accreditedBeds"] for h in result["context"]["hospitals"]) == 9389
    assert all(h["dengueUsableBeds"] is None and h["normalStaffedCapacity"] is None for h in result["context"]["hospitals"])
    for d in result["days"]:
        assert not d["expansionRing"]
        assert sum(b["cumulativeCases"] for b in d["barangays"]) == pytest.approx(d["cumulativeCases"])
        for bound in ["lowerCases", "upperCases"]:
            assert sum(b["caseRange"][bound] for b in d["barangays"]) == pytest.approx(d["caseRange"][bound])
        assert all(b["caseRange"]["lowerCases"] <= b["cumulativeCases"] <= b["caseRange"]["upperCases"] for b in d["barangays"])
        assert all(f["remainingSupportedCapacity"] >= 0 for f in d["facilities"])
        assert abs(d["balanceError"]) < 1e-7
    summary = result["periodSummary"]
    assert summary["expectedCases"] == pytest.approx(sum(b["cumulativeCases"] for b in summary["barangays"]))
    assert summary["barangays"][0]["cumulativeCases"] >= summary["barangays"][-1]["cumulativeCases"]
    hashed = copy.deepcopy(result); expected = hashed.pop("resultSha256")
    assert hashlib.sha256(json.dumps(hashed, sort_keys=True, allow_nan=False).encode()).hexdigest() == expected


def test_every_hospital_has_nearest_ranked_hotspot_and_empty_day_is_unknown(result):
    from services.engine.domain.outbreak import distance_km
    hospitals = {h["id"]: h for h in result["context"]["hospitals"]}
    barangays = {b["id"]: b for b in result["context"]["barangays"]}
    assert all(f["nearestHotspot"] is None for f in result["days"][0]["facilities"])
    for day in result["days"][1:]:
        assert len(day["hotspotIds"]) == 10
        for facility in day["facilities"]:
            nearest = facility["nearestHotspot"]
            candidates = [(distance_km(hospitals[facility["facilityId"]]["coordinates"], barangays[b]["coordinates"]), b)
                          for b in day["hotspotIds"]]
            distance, ident = min(candidates)
            assert nearest["barangayId"] == ident
            assert nearest["distanceKm"] == pytest.approx(distance)
            assert nearest["distanceKm"] >= 0


def test_philippines_context_keeps_all_regions_without_regional_case_claims():
    path = ROOT / "apps/web/public/data/philippines-context.geojson"
    manifest = json.loads((FOLDER / "philippines-context-manifest.json").read_text())
    assert sha256(path) == manifest["outputSha256"]
    data = json.loads(path.read_text())
    assert len(data["features"]) == 17
    assert all(shape(f["geometry"]).is_valid for f in data["features"])
    assert all(set(f["properties"]) == {"ADM1_EN", "ADM1_PCODE"} for f in data["features"])


def test_transport_lp_improves_distance_on_a_constructed_fixture():
    # Nearest-first in origin order uses A->near (0) then B->far (100).
    plan = transport_plan([1, 1], [1, 1], [[0, 2], [1, 100]])
    assert plan == [[0.0, 1.0], [1.0, 0.0]]
    assert sum(plan[i][j] * [[0, 2], [1, 100]][i][j] for i in range(2) for j in range(2)) == 3
    assert sum(map(sum, plan)) == 2
    with pytest.raises(ValueError): transport_plan([1], [1], [[float('nan')]])


def test_qc_api_bounds_automatic_location_and_fair_comparison(result):
    client = TestClient(app)
    controls = result["controlValues"]
    for patch in [{"seedBarangayId": "PH1307404022"}, {"area": "NCR"}, {"facilities": []},
        {"hospitalizationRate": 1.1}, {"normalCapacity": 0}, {"mode": "live"},
        {"mode": "forecast", "extraCasesPerWeek": 1}, {"startDate": "2026-01-01", "endDate": "2026-01-08"},
        {"endDate": controls["startDate"]}, {"growthDays": 0}, {"holdingCapacity": -1}]:
        response = client.post("/v1/qc-simulation", json={**controls, **patch})
        assert response.status_code == 422, response.text
    response = client.post("/v1/qc-simulation", json={**controls, "endDate": "2025-02-05", "compareAllocation": True})
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["days"]) == 8
    a, b = data["allocationComparison"]["nearest"], data["allocationComparison"]["optimized"]
    assert b["cumulativeUnresolved"] <= a["cumulativeUnresolved"] + 1e-7
    assert b["expectedPatientKm"] <= a["expectedPatientKm"] + 1e-7
    assert data["controlValues"]["startDate"] == controls["startDate"]


def test_automatic_reference_selection_is_explicitly_prior():
    from datetime import date, timedelta
    runs = load_environmental_runs()
    run = select_reference(runs, date(2025, 1, 29))
    assert run["issueBlock"] == {"YR": 2025, "WN": 4}
    assert date(run["issueBlock"]["YR"], 1, 1) + timedelta(days=7 * run["issueBlock"]["WN"]) <= date(2025, 1, 29)
