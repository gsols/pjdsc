"""HTTP smoke test of the built web BFF and actual research engine.

Capacity values below are explicitly hypothetical test assumptions, never observations.
"""
import argparse
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-url", default="http://127.0.0.1:3001")
    args = parser.parse_args()

    def request(path, body=None):
        req = Request(args.web_url + path, data=json.dumps(body).encode() if body is not None else None,
                      headers={"Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw) if "json" in response.headers.get("content-type", "") else raw.decode()
        except HTTPError as error:
            return error.code, json.load(error)

    status, page = request("/research")
    assert status == 200 and "UPRI-NOAH historical research workspace" in page
    status, annual = request("/data/qc-annual-burden.json")
    assert status == 200 and len(annual["records"]) == 142
    status, geo = request("/data/qc-barangays.geojson")
    assert status == 200 and len(geo["features"]) == 142
    status, runs = request("/api/research/forecast-runs?area=QUEZON_CITY")
    assert status == 200 and len(runs["runs"]) == 8, runs
    run = runs["runs"][-1]
    status, spatial = request("/api/research/spatial-allocations/" + run["id"])
    assert status == 200, spatial
    assert abs(sum(r["expectedCases"][0] for r in spatial["records"]) - run["weeklyPredictions"][0]["meanCases"]) < 1e-7
    body = {"forecastRunId": run["id"], "scenarioKind": "historical_replay",
        "acknowledgeHypotheticalHospitalNetwork": True, "hospitalizationRate": .15,
        "lengthOfStayDays": 4, "baselineOccupancy": .75, "admissionDelayDays": 0,
        "surgeActivationDay": 0, "facilities": [{"facilityId": "HOSP-614", "assumedDengueEligible": True,
            "normalCapacity": 100, "surgeCapacity": 30, "holdingCapacity": 5}]}
    status, scenario = request("/api/research/scenarios", body)
    assert status == 200, scenario
    assert [scenario["days"][d]["dayIndex"] for d in [0, 7, 14, 28]] == [0, 7, 14, 28]
    assert all(abs(d["balanceError"]) < 1e-7 for d in scenario["days"])
    status, saved = request("/api/research/scenarios/" + scenario["scenarioId"])
    assert status == 200 and saved == scenario
    status, ncr = request("/api/research/forecast-runs?area=NCR")
    assert status == 200
    body["forecastRunId"] = ncr["runs"][0]["id"]
    status, rejected = request("/api/research/scenarios", body)
    assert status == 422 and rejected["detail"]["code"] == "QC_DEMAND_REQUIRED"
    status, _ = request("/api/simulate", {"area": "QUEZON_CITY"})
    assert status == 422
    print("PASS: built /research, 142 annual rows/polygons, QC/NCR BFF forecasts, spatial conservation, 29-day scenario, saved replay, NCR rejection, legacy guard.")


if __name__ == "__main__":
    main()
