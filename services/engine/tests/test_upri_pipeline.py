"""Synthetic mutation tests plus checks against the hash-pinned source artifacts."""
import copy
import hashlib
import json
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from scripts.train_dengue import features, require_resolved_iso_calendar
from services.engine.main import app
from services.engine.upri_data import ROOT, load_annual, load_weekly, validate_weekly, verify_sources, sha256
from services.engine.repositories.forecast_runs import FOLDER, artifact, load_runs
from services.engine.domain.spatial import allocate, annual_weights
from services.engine.domain.patient_flow import simulate_flow


def test_raw_hashes_completeness_and_null_preservation():
    assert len(verify_sources()["sources"]) == 7
    qc, case, _ = load_weekly("QUEZON_CITY")
    ncr, ncase, _ = load_weekly("NCR")
    assert len(qc) == 832 and qc[case].notna().sum() == 832
    assert len(ncr) == 520 and ncr[ncase].isna().sum() == 104
    assert qc["Pressure_ERA5-Land"].isna().sum() == 13
    assert qc.FLAG_COVID.sum() == 104
    assert load_annual().DC_2014.isna().sum() == 12


def test_manifest_outputs_preserve_exact_file_bytes():
    manifest = json.loads((FOLDER / "manifest.json").read_text())
    expected = dict(manifest["outputs"])
    for name, output in [
        ("qc-environmental-manifest.json", "data/processed/upri_noah/qc-environmental-forecasts.json"),
        ("philippines-context-manifest.json", "apps/web/public/data/philippines-context.geojson"),
    ]:
        expected[output] = json.loads((FOLDER / name).read_text())["outputSha256"]
    for path, checksum in expected.items():
        assert sha256(ROOT / path) == checksum, f"Exact artifact bytes changed: {path}"


@pytest.mark.parametrize("mutation", [b"count\n12\n", b"count\r\n13\r\n"])
def test_source_verification_rejects_newline_and_value_mutations(tmp_path, mutation):
    # Synthetic fixture: both newline conversion and changed values must fail.
    source = tmp_path / "fixture.csv"
    original = b"count\r\n12\r\n"
    source.write_bytes(original)
    manifest = {"sources": [{"path": "fixture.csv", "sourceCommitId": "fixture-commit",
        "sha256": hashlib.sha256(original).hexdigest()}]}
    reference = tmp_path / "data/reference/upri_noah"
    reference.mkdir(parents=True)
    (reference / "sources.json").write_text(json.dumps(manifest), encoding="utf-8")
    assert verify_sources(tmp_path) == manifest
    source.write_bytes(mutation)
    with pytest.raises(ValueError, match="UPRI source version/hash mismatch"):
        verify_sources(tmp_path)


def test_legacy_iso_experiments_refuse_ambiguous_calendar():
    from services.engine.upri_data import WORKBOOK
    with pytest.raises(ValueError, match="ISO conversion is unsafe"):
        require_resolved_iso_calendar(WORKBOOK)


@pytest.mark.parametrize("change", ["duplicate", "negative", "missing", "infinite", "week", "fraction", "flag"])
def test_invalid_source_fixtures_fail(change):
    frame = pd.DataFrame({"YR": [2024, 2024], "WN": [1, 2], "DC_QC": [2., 3.], "FLAG_COVID": [0, 0]})
    if change == "duplicate": frame.loc[1, "WN"] = 1
    if change == "negative": frame.loc[1, "DC_QC"] = -1
    if change == "missing": frame.loc[1, "DC_QC"] = np.nan
    if change == "infinite": frame.loc[1, "DC_QC"] = np.inf
    if change == "week": frame.loc[1, "WN"] = 53
    if change == "fraction": frame.loc[1, "DC_QC"] = .5
    if change == "flag": frame.loc[1, "FLAG_COVID"] = 2
    with pytest.raises(ValueError): validate_weekly(frame, "DC_QC")


def test_feature_and_training_target_leakage():
    qc, case, weather = load_weekly("QUEZON_CITY")
    qc["cases"] = qc[case]
    origin = 2024 * 52 + 3
    before = features(qc, weather).loc[origin + 1]
    qc.loc[qc.index > origin, ["cases", *weather]] = 999999
    pd.testing.assert_series_equal(before, features(qc, weather).loc[origin + 1])
    for row in artifact("backtest.json")["predictions"]:
        assert row["lastTrainingTargetBlock"] <= row["origin"]
        assert row["trainingSamples"] >= 100


def test_spatial_future_annual_data_never_changes_allocation():
    records = json.loads(load_annual().to_json(orient="records"))
    run = load_runs("QUEZON_CITY")[0]
    original = allocate(run, records)
    for r in records:
        for y in range(run["issueBlock"]["YR"] - 1, 2026): r[f"DC_{y}"] = 999999
    assert allocate(run, records) == original
    assert original["weightYear"] <= run["issueBlock"]["YR"] - 2
    for h, p in enumerate(run["weeklyPredictions"]):
        assert sum(r["expectedCases"][h] for r in original["records"]) == pytest.approx(p["meanCases"])
    with pytest.raises(ValueError): allocate(load_runs("NCR")[0], records)
    with pytest.raises(ValueError): annual_weights(records, 2010)


def fixture_facility(normal=100, surge=30, holding=5):
    return [{"facilityId": "HOSP-614", "normalCapacity": normal, "surgeCapacity": surge, "holdingCapacity": holding}]


def test_normal_surge_holding_and_mass_balance():
    days = simulate_flow([945, 0, 0, 0], fixture_facility(), 1, 4, 0)
    one = days[1]["facilities"][0]
    assert one["normalDengueCensus"] == 100
    assert one["surgeDengueCensus"] == 30
    assert one["holdingCensus"] == 5
    assert one["normalOccupancyPct"] == 130
    assert one["supportedOccupancyPct"] == 100
    assert one["onSiteRelativeToNormalPct"] == 135
    assert len(days) == 29 and days[0]["cumulativeArrivals"] == 0
    assert days[5]["discharges"] == 130
    for day in days:
        assert abs(day["balanceError"]) < 1e-7
        assert day["cumulativeArrivals"] == pytest.approx(day["supportedCensus"] + day["holdingCensus"] + day["cumulativeUnresolved"] + day["cumulativeDischarges"])


def test_delay_activation_zero_and_empty_capacity():
    args = ([1000]*4, fixture_facility(), .2, 4, .75)
    days = simulate_flow(*args, delay=2, activation_day=7)
    assert days[2]["arrivals"] == 0
    assert days[6]["facilities"][0]["activatedSurgeCapacity"] == 0
    assert days[7]["facilities"][0]["activatedSurgeCapacity"] == 30
    assert days == simulate_flow(*args, delay=2, activation_day=7)
    assert all(d["cumulativeArrivals"] == 0 for d in simulate_flow([0]*4, fixture_facility(), 1, 4, 0))
    with pytest.raises(ValueError): simulate_flow([1]*4, [], .1, 4, 0)
    with pytest.raises(ValueError): simulate_flow([1]*4, fixture_facility(normal=0), .1, 4, 0)


def request_fixture():
    return {"forecastRunId": load_runs("QUEZON_CITY")[0]["id"], "scenarioKind": "historical_replay",
        "acknowledgeHypotheticalHospitalNetwork": True, "hospitalizationRate": .15,
        "lengthOfStayDays": 4, "baselineOccupancy": .75, "admissionDelayDays": 0,
        "surgeActivationDay": 0, "facilities": [{**fixture_facility()[0], "assumedDengueEligible": True}]}


def test_api_contract_scope_and_saved_scenario():
    client = TestClient(app)
    assert len(client.get("/v1/forecast-runs?area=NCR").json()["runs"]) == 8
    assert client.get("/v1/forecast-runs/unknown").status_code == 404
    assert client.get("/v1/forecast-runs?area=OTHER").status_code == 422
    assert client.get("/v1/research-evidence").status_code == 200
    assert client.post("/v1/scenarios", content="x" * 32769).status_code == 413
    body = request_fixture()
    response = client.post("/v1/scenarios", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["days"]) == 29
    assert client.get("/v1/scenarios/" + data["scenarioId"]).json() == data
    for key, value in [("scenarioKind", "live"), ("hospitalizationRate", -1), ("hospitalizationRate", 2), ("acknowledgeHypotheticalHospitalNetwork", False), ("lengthOfStayDays", 0), ("lengthOfStayDays", 1.5), ("area", "NCR")]:
        invalid = copy.deepcopy(body); invalid[key] = value
        assert client.post("/v1/scenarios", json=invalid).status_code == 422
    invalid = copy.deepcopy(body); invalid["facilities"][0]["assumedDengueEligible"] = False
    assert client.post("/v1/scenarios", json=invalid).status_code == 422
    invalid = copy.deepcopy(body); invalid["facilities"] *= 2
    assert client.post("/v1/scenarios", json=invalid).status_code == 422
    body["forecastRunId"] = load_runs("NCR")[0]["id"]
    assert client.post("/v1/scenarios", json=body).status_code == 422
    with patch("services.engine.repositories.forecast_runs.verify_sources", side_effect=ValueError("hash mismatch")):
        assert client.get("/v1/forecast-runs").status_code == 503
