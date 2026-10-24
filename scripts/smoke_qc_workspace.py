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
            assert "Quezon City forecast" in html and "Observed cases already" in html and "Nearest hospital capacity" in html
            assert "Expansion origin" not in html
    status, country = request("/data/philippines-context.geojson")
    assert status == 200 and len(country["features"]) == 17
    status, data = request("/api/research/qc-simulation")
    assert status == 200, data
    assert data["scope"] == "QUEZON_CITY" and data["forecastEvidence"]["model"] == "cases_weather"
    assert len(data["periodSummary"]["barangays"]) == 142 and len(data["days"][-1]["facilities"]) == 46
    assert data["forecastEvidence"]["observedSourceYearToDateCases"] > 0
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
    print("PASS: root/dashboard/simulation, Philippines context, weather-derived QC forecasts, all 142 conditional ranges, all 46 capacities, observed source counts, 7/14/28-day windows, optimizer comparison, QC-only scope.")


if __name__ == "__main__":
    main()
