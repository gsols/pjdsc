"""Future planning contracts and bed-demand invariants; constructed arrays are fixtures."""
from datetime import date, timedelta
import json

from fastapi.testclient import TestClient
import pytest

from services.engine.main import app
from services.engine.api.future_simulation import FutureInput, future_workspace, today_qc
from services.engine.api.outbreak import saved_movie
from services.engine.domain.bed_forecast import rolling_bed_demand
from services.engine.domain.seasonal_forecast import source_week, weather_analog
from services.engine.repositories.seasonal_runs import approved_model, create_seasonal_run, load_seasonal_run, FOLDER


@pytest.fixture(scope="module")
def future():
    return future_workspace(FutureInput(startDate="2027-01-01", horizonDays=12,
        surgeOnsetDay=3, growthDays=2, normalCapacity=1, surgeCapacity=0,
        holdingCapacity=0, baselineOccupancy=1))


def test_bed_convolution_is_unconstrained_demand_and_discharges_after_los():
    assert rolling_bed_demand([0, 4, 3, 0, 0], 2) == [0, 4, 7, 3, 0]
    assert rolling_bed_demand([0, 0], 30) == [0, 0]
    for values, los in [([float("nan")], 2), ([-1], 2), ([1], 0), ([1], True)]:
        with pytest.raises(ValueError):
            rolling_bed_demand(values, los)


def test_seasonal_evidence_uses_only_past_training_and_frozen_selection():
    engine, manifest = approved_model()
    evidence = json.loads((FOLDER / "qc-seasonal-validation.json").read_text())
    assert manifest["sourceLastBlock"] == {"YR": 2025, "WN": 52}
    assert engine["history"].YR.max() == 2025
    assert all(r["lastTrainingBlock"] < r["year"] * 52 <= r["block"] for r in evidence["records"])
    assert all(r["year"] < 2024 for r in engine["calibrationRecords"])
    scores = {name: sum(abs(r["observed"] - r[name]) for r in engine["calibrationRecords"]) / len(engine["calibrationRecords"])
              for name in evidence["selection"]["scores"]}
    assert scores == pytest.approx(evidence["selection"]["scores"])
    from xgboost import XGBRegressor
    assert isinstance(engine["xgboostModel"], XGBRegressor)
    assert engine["selectedModel"] == evidence["selection"]["userRequestedModel"] == "seasonal_xgboost"
    assert evidence["selection"]["bestCalibrationModel"] == min(scores, key=scores.get)
    assert all(r["n"] == 52 for r in evidence["backtest"])
    for profile in ["typical", "wetter", "drier", "hotter"]:
        assert weather_analog(engine["history"], 1, profile).YR <= 2025
    assert source_week(date(2028, 12, 31)) == 52
    assert source_week(date(2027, 1, 1)) == 1


def test_future_runs_are_date_specific_reproducible_and_not_new_observations():
    jan = create_seasonal_run(date(2027, 1, 1), "typical", today_qc())
    oct_run = create_seasonal_run(date(2026, 10, 24), "typical", today_qc())
    assert jan == load_seasonal_run(jan["id"])
    assert jan["runSha256"] != oct_run["runSha256"]
    assert sum(d["meanCases"] for d in jan["dailyPredictions"]) != pytest.approx(sum(d["meanCases"] for d in oct_run["dailyPredictions"]))
    assert len(jan["dailyPredictions"]) == 28
    assert jan["dailyPredictions"][-1]["date"] == "2027-01-28"
    assert all(p["observedCases"] is None for p in jan["weeklyPredictions"])
    assert all(p["measurementKind"] == "assumption" for p in jan["environmentalInputs"])
    assert all(len(p["errors"]) == 28 and p["lastTargetBlock"] < 2024 * 52 for p in jan["dailyResidualPaths"])
    assert all(0 <= d["lowerCases"] <= d["meanCases"] <= d["upperCases"] for d in jan["dailyPredictions"])


def test_surge_onset_bed_bounds_mass_balance_and_saved_result(future):
    assert len(future["days"]) == 13
    assert future["days"][-1]["date"] == "2027-01-13"
    assert future["context"]["weightYear"] < 2026
    assert len(future["context"]["hospitals"]) == 46
    assert all(d["shockCases"] == 0 for d in future["days"][:4])
    assert future["days"][4]["expectedCases"] == pytest.approx(future["days"][4]["baselineCases"] * 1.5)
    assert future["days"][5]["expectedCases"] == pytest.approx(future["days"][5]["baselineCases"] * 2)
    cases = [d["expectedCases"] for d in future["days"]]
    expected_beds = rolling_bed_demand([v * .15 for v in cases], 4)
    for day, beds in zip(future["days"], expected_beds):
        forecast = day["bedForecast"]
        assert forecast["expectedBeds"] == pytest.approx(beds)
        assert forecast["lowerBeds"] <= beds <= forecast["upperBeds"]
        assert sum(f["bedForecast"]["expectedBeds"] for f in day["facilities"]) == pytest.approx(beds)
        assert day["supportedCensus"] == 0  # No assumed residual staffed capacity.
        assert abs(day["balanceError"]) < 1e-7
        assert sum(b["cumulativeCases"] for b in day["barangays"]) == pytest.approx(day["cumulativeCases"])
        for key in ["lowerCases", "upperCases"]:
            assert sum(b["caseRange"][key] for b in day["barangays"]) == pytest.approx(day["caseRange"][key])
    assert future["bedProjection"]["peakAdditionalStaffedBedsNeeded"] > 0
    assert saved_movie(future["scenarioId"])["resultSha256"] == future["simulationResultSha256"]


def test_delay_and_no_surge_scenarios():
    params = FutureInput(startDate="2027-01-01", horizonDays=2, surgeEnabled=False, admissionDelayDays=1)
    result = future_workspace(params)
    assert result["days"][1]["bedForecast"]["expectedBeds"] == 0
    assert result["days"][2]["bedForecast"]["expectedBeds"] == pytest.approx(result["days"][1]["expectedCases"] * params.hospitalizationRate)
    assert all(d["shockCases"] == 0 for d in result["days"])


@pytest.mark.parametrize("horizon", [1, 2, 12, 14, 28])
def test_flexible_horizon_contract(horizon):
    parsed = FutureInput(startDate="2027-01-01", horizonDays=horizon)
    assert parsed.endDate == date(2027, 1, 1) + timedelta(days=horizon)


def test_future_api_rejects_invalid_dates_inputs_and_untrusted_arrays():
    client = TestClient(app)
    for patch in [{"horizonDays": 0}, {"horizonDays": 29}, {"horizonDays": True},
                  {"startDate": "2025-01-01"}, {"weatherProfile": "actual_future_weather"},
                  {"surgeMultiplier": 11}, {"surgeOnsetDay": 12},
                  {"endDate": "2027-01-02"}, {"area": "NCR"}, {"weeklyCases": [100]},
                  {"facilities": []}, {"extraCasesPerWeek": 7}, {"mode": "live"}]:
        response = client.post("/v1/future-simulation", json={"startDate": "2027-01-01", "horizonDays": 12, **patch})
        assert response.status_code == 422, response.text
    assert client.post("/v1/future-simulation", json=[]).status_code == 422
    response = client.post("/v1/future-simulation", json={"startDate": "2027-01-01", "horizonDays": 2})
    assert response.status_code == 200, response.text
    assert len(response.json()["days"]) == 3
