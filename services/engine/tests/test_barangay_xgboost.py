"""Annual XGBoost ranking provenance/leakage; not weekly outbreak classification."""
import copy
import json

from fastapi.testclient import TestClient
import numpy as np
import pytest

from services.engine.main import app
from services.engine.api.qc_simulation import default_workspace
from services.engine.domain.barangay_forecast import annual_features, train_annual_model, predict_annual_burden
from services.engine.repositories import barangay_runs
from services.engine.upri_data import load_annual


def records():
    return json.loads(load_annual().to_json(orient="records"))


def test_annual_predictions_are_xgboost_ranked_candidates_not_all_positive_places():
    run, metadata = barangay_runs.approved_ranking(2025)
    assert len(run["records"]) == 142
    assert len(run["topCandidateIds"]) == 10
    assert run["topCandidateIds"] == [r["barangayId"] for r in run["records"][:10]]
    assert sum(r["isHighBurdenCandidate"] for r in run["records"]) == 10
    assert sum(r["predictedAnnualCases"] > 0 for r in run["records"]) > 10
    assert sum(r["weight"] for r in run["records"]) == pytest.approx(1)
    assert run["lastTrainingLabelYear"] == run["featureCutoffYear"] == 2023
    assert metadata["model"] == "XGBoost annual barangay burden"
    assert all(r["n"] == 142 and 0 <= r["top10Overlap"] <= 10 for r in metadata["validation"])


def test_future_annual_labels_and_all_year_mean_never_change_prior_origin_predictions():
    original = records()
    mutated = copy.deepcopy(original)
    for record in mutated:
        record["DC_2024"] = 999999
        record["DC_2025"] = 888888
        record["DC_Mean"] = 777777
    before, training = train_annual_model(original, 2023)
    after, _ = train_annual_model(mutated, 2023)
    assert training["lastTrainingLabelYear"] == 2023
    a = predict_annual_burden(before, original, 2023)
    b = predict_annual_burden(after, mutated, 2023)
    assert a == b


def test_missing_past_count_is_not_observed_zero_and_invalid_counts_fail():
    record = records()[0]
    record["DC_2023"] = None
    assert np.isnan(annual_features(record, 2023)[0])
    record["DC_2023"] = -1
    with pytest.raises(ValueError):
        annual_features(record, 2023)


def test_workspace_uses_model_shares_preserves_nulls_and_ten_candidates():
    data = default_workspace()
    context = data["context"]
    assert context["hotspotRanking"]["forecastYear"] == 2025
    assert context["weightYear"] == 2023
    assert any(b["observedAnnualCases"] is None for b in context["barangays"])
    assert {b["id"] for b in context["barangays"] if b["isHighBurdenCandidate"]} == set(context["hotspotRanking"]["candidateIds"])
    assert data["days"][-1]["hotspotIds"] == context["hotspotRanking"]["candidateIds"]
    assert sum(b["weight"] for b in context["barangays"]) == pytest.approx(1)


def test_failed_ranking_is_blocked_without_reverting_to_historical_shares(monkeypatch):
    def unavailable(*args):
        raise barangay_runs.BarangayRankingUnavailable("Rebuild annual XGBoost ranking; no fallback")
    monkeypatch.setattr(barangay_runs, "approved_ranking", unavailable)
    response = TestClient(app).get("/v1/qc-simulation")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "BARANGAY_RANKING_UNAVAILABLE"
    readiness = TestClient(app).get("/readiness").json()
    assert readiness["barangayRanking"]["ready"] is False
    assert readiness["qcWorkspaceReady"] is False
