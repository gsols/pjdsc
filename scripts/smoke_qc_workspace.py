"""HTTP contracts for the automatic QC weather/period-range UI and capacity sidebar."""
import argparse
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-url", default="http://127.0.0.1:3000")
    args = parser.parse_args()

    def request(path, body=None):
        req = Request(args.web_url + path, data=json.dumps(body).encode() if body is not None else None,
            headers={"content-type": "application/json"})
        try:
            with urlopen(req, timeout=60) as response:
                raw = response.read()
                return response.status, json.loads(raw) if "json" in response.headers.get("content-type", "") else raw.decode()
        except HTTPError as error:
            return error.code, json.load(error)

    for page in ["/", "/dashboard", "/outbreak-response", "/simulate"]:
        status, html = request(page)
        assert status == 200, (page, status)
        if page in {"/outbreak-response", "/simulate"}:
            assert "SurgeWise" in html and "Base cases for selected date" in html and "Nearest hospital capacity" in html
            assert "Simulation not started" in html
            assert "Historical replay" in html and "Future surge forecast" in html
            assert "Hotspot guide" in html and "Nearest hospital" in html
            assert "Expansion origin" not in html
    status, country = request("/data/philippines-context.geojson")
    assert status == 200 and len(country["features"]) == 17
    status, data = request("/api/research/qc-simulation")
    assert status == 200, data
    assert data["scope"] == "QUEZON_CITY" and data["forecastEvidence"]["model"] == "cases_weather"
    assert data["progressionMethod"] == "dated_QC_forecast_allocated_by_xgboost_annual_burden_shares"
    assert len(data["context"]["hotspotRanking"]["candidateIds"]) == 10
    assert {b["id"] for b in data["context"]["barangays"] if b["isHighBurdenCandidate"]} == set(data["days"][-1]["hotspotIds"])
    assert len(data["periodSummary"]["barangays"]) == 142 and len(data["days"][-1]["facilities"]) == 46
    assert any(len(b["hospitalsWithinBarangay"]) > 1 for b in data["context"]["barangays"])
    assert all(f["nearestHotspot"] is None for f in data["days"][0]["facilities"])
    assert all(f["nearestHotspot"]["barangayId"] in data["days"][-1]["hotspotIds"] for f in data["days"][-1]["facilities"])
    assert data["forecastEvidence"]["observedSourceYearToDateCases"] > 0
    assert len(data["historicalWindows"]) == 8
    status, partial = request("/api/research/qc-simulation", {**data["controlValues"],
        "startDate": "2025-02-03", "endDate": "2025-02-12"})
    assert status == 200, partial
    assert abs(partial["periodSummary"]["expectedCases"] - sum(d["expectedCases"] for d in data["days"][6:15])) < 1e-7
    status, missing = request("/api/research/qc-simulation", {**data["controlValues"],
        "startDate": "2025-03-01", "endDate": "2025-03-08"})
    assert status == 422 and missing["detail"]["code"] == "HISTORICAL_WINDOW_UNAVAILABLE", missing
    for frame in data["days"]:
        assert frame["caseRange"]["lowerCases"] <= frame["cumulativeCases"] <= frame["caseRange"]["upperCases"]
        assert abs(frame["balanceError"]) < 1e-7
    for days, end in [(7, "2025-02-05"), (14, "2025-02-12"), (28, "2025-02-26")]:
        controls = {**data["controlValues"], "endDate": end}
        status, window = request("/api/research/qc-simulation", controls)
        assert status == 200 and len(window["days"]) == days + 1, window
        assert window["periodSummary"]["expectedCases"] == window["days"][-1]["cumulativeCases"]
    controls = {**data["controlValues"], "endDate": "2025-02-05", "compareAllocation": True}
    status, comparison = request("/api/research/qc-simulation", controls)
    assert status == 200 and {"nearest", "optimized"}.issubset(comparison["allocationComparison"]), comparison
    status, _ = request("/api/research/qc-simulation", {**controls, "area": "NCR"})
    assert status == 422
    status, future = request("/api/research/future-simulation")
    assert status == 200, future
    assert future["workspaceTab"] == "future" and future["futureForecast"]["trainingCutoffBlock"]["YR"] == 2025
    assert future["futureForecast"]["selectedModel"] == "seasonal_xgboost"
    assert future["futureForecast"]["parameterAudit"]["horizonDays"] == 28
    assert future["futureForecast"]["accuracyAssessment"]["status"] == "EXPERIMENTAL_NOT_OPERATIONALLY_VALIDATED"
    assert len(future["futureForecast"]["calendarDiagnostics"]["monthly"]) == 72
    assert {r["days"] for r in future["futureForecast"]["calendarDiagnostics"]["windowLengths"]} == {1, 2, 7, 12, 14, 28}
    assert future["bedProjection"]["arrivalSplitPolicy"] == "nearest_three_equal"
    assert len(future["bedProjection"]["placePeaks"]) == 142
    assert all(len(p["hospitals"]) == 3 and abs(sum(h["share"] for h in p["hospitals"]) - 1) < 1e-9 for p in future["bedProjection"]["placePeaks"])
    assert future["progressionMethod"] == "dated_QC_forecast_allocated_by_xgboost_annual_burden_shares"
    assert all(f["nearestHotspot"]["barangayId"] in future["days"][-1]["hotspotIds"] for f in future["days"][-1]["facilities"])
    assert future["bedProjection"]["staffedBedsRequired"] >= 0
    for day in future["days"]:
        for facility in day["facilities"]:
            beds = facility["bedForecast"]
            capacity = beds["assumedSupportedDengueCapacity"]
            if capacity > 0:
                assert abs(beds["demandUtilizationPct"] - beds["expectedBeds"] / capacity * 100) < 1e-7
            else:
                assert beds["demandUtilizationPct"] is None
    baseline_january = None
    for days in [2, 12, 14, 28]:
        status, window = request("/api/research/future-simulation", {"startDate": "2027-01-01", "horizonDays": days, "surgeEnabled": False})
        assert status == 200 and len(window["days"]) == days + 1, window
        audit = window["futureForecast"]["parameterAudit"]
        assert audit["sourceYearGap"] == 2 and audit["centralGapEvaluated"] is True
        assert audit["rangeEvaluatedAtRequestedGap"] is False
        assert window["days"][-1]["bedForecast"]["staffedBedsRequired"] >= 0
        assert all(abs(d["balanceError"]) < 1e-7 for d in window["days"])
        if days == 28:
            baseline_january = window["periodSummary"]["expectedCases"]
    status, today = request("/api/research/future-simulation", {"surgeEnabled": False})
    assert status == 200, today
    assert baseline_january != today["periodSummary"]["expectedCases"]
    assert future["periodSummary"]["expectedCases"] > today["periodSummary"]["expectedCases"]
    assert future["bedProjection"]["peakAdditionalStaffedBedsDueToSurge"] > 0
    assert today["bedProjection"]["peakAdditionalStaffedBedsDueToSurge"] == 0
    for patch in [{"horizonDays": 29}, {"area": "NCR"}, {"facilities": []}]:
        status, _ = request("/api/research/future-simulation", patch)
        assert status == 422
    print("PASS: pages/two tabs, Philippines context, historical QC/ranges/46 hospitals, 7/14/28-day replay, allocation comparison, future 2/12/14/28-day windows, January 2027 seasonal difference, surge, bed demand, conservation and invalid-input/QC-scope rejection.")


if __name__ == "__main__":
    main()
