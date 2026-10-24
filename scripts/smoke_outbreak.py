"""Exercise the real movie BFF against a running engine, without a browser."""
import argparse
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen


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

    status, homepage = request("/")
    assert status == 200 and "DENGUE INTELLIGENCE" in homepage, "Root page/dashboard redirect failed"
    for page in ["/outbreak-response", "/simulate"]:
        status, html = request(page)
        assert status == 200 and "Quezon City forecast" in html, page
    status, movie = request("/api/research/outbreak-demo")
    assert status == 200, movie
    assert len(movie["days"]) == 29
    assert movie["parameters"]["scenarioKind"] == "hypothetical_shock"
    assert len(movie["context"]["barangays"]) == 142 and len(movie["context"]["hospitals"]) == 46
    for d in [0, 7, 14, 28]:
        frame = movie["days"][d]
        assert frame["dayIndex"] == d and abs(frame["balanceError"]) < 1e-7
        assert abs(sum(b["expectedCases"] for b in frame["barangays"]) - frame["expectedCases"]) < 1e-7
    assert movie["days"][28]["assumedRadiusKm"] > movie["days"][7]["assumedRadiusKm"]
    assert movie["days"][28]["cumulativeUnresolved"] > 0
    assert movie["days"][7]["assignments"]
    status, saved = request("/api/research/outbreak-scenarios/" + movie["scenarioId"])
    assert status == 200 and saved == movie
    params = {**movie["parameters"], "endDate": "2025-02-03", "extraCasesPerWeek": 0}
    status, short = request("/api/research/outbreak-scenarios", params)
    assert status == 200 and len(short["days"]) == 8, short
    assert short["days"][-1]["cumulativeShockCases"] == 0
    status, _ = request("/api/research/outbreak-scenarios", {**params, "scenarioKind": "live"})
    assert status == 422
    seed = next(b for b in movie["context"]["barangays"] if b["id"] == movie["parameters"]["seedBarangayId"])
    hospitals = {h["id"]: h for h in movie["context"]["hospitals"]}
    print("PASS: movie page/redirect, BFF demo, 142 polygon anchors, 46 hospitals, days 0/7/14/28, spatial/census conservation, placements, saved run, changed-date scenario and live rejection.")
    print("Illustrative origin:", seed["name"])
    print("Nearest provisional hospital points:", [(hospitals[h["facilityId"]]["name"], round(h["distanceKm"], 2)) for h in seed["nearestHospitals"]])


if __name__ == "__main__":
    main()
