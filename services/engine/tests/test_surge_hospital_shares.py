"""Explicit synthetic three-hospital scenario: no observed admissions are implied."""
from datetime import date

import pytest

from services.engine.domain.hospital_demand import hospital_shares
from services.engine.domain.outbreak import build_movie
from services.engine.domain.bed_forecast import surge_staffing


def test_three_hospital_split_preserves_admissions_and_forecasts_surge_beds():
    run = {"weeklyPredictions": [{"YR": 2027, "WN": i + 1, "meanCases": 315,
        "lowerCases": 210, "upperCases": 420} for i in range(4)],
        "calibrationResidualPaths": [{"lastTargetBlock": 2026 * 52 - 1,
            "residuals": [105] * 4} for _ in range(20)]}  # Explicit synthetic dated fixture.
    context = {"barangays": [{"id": "A", "coordinates": [121, 14], "weight": 1}],
               "hospitals": [{"id": ident, "coordinates": [121 + i * .01, 14]} for i, ident in enumerate(["H1", "H2", "H3"])]}
    config = {"startDate": date(2027, 1, 1), "endDate": date(2027, 1, 4), "autoHotspots": True,
              "seedBarangayId": "A", "extraCasesPerWeek": 315, "growthDays": 1, "shockProfile": "step",
              "hospitalizationRate": .2, "lengthOfStayDays": 2, "baselineOccupancy": 0,
              "admissionDelayDays": 0, "surgeActivationDay": 0, "arrivalSplitPolicy": "nearest_three_equal",
              "facilities": [{"facilityId": ident, "normalCapacity": 100, "surgeCapacity": 0, "holdingCapacity": 0}
                             for ident in ["H1", "H2", "H3"]]}
    movie = build_movie(run, context, config)
    assert [f["supportedCensus"] for f in movie["days"][1]["facilities"]] == pytest.approx([6, 6, 6])
    assert [f["supportedCensus"] for f in movie["days"][2]["facilities"]] == pytest.approx([12, 12, 12])
    for day in movie["days"]:
        assert sum(f["bedForecast"]["expectedBeds"] for f in day["facilities"]) == pytest.approx(day["bedForecast"]["expectedBeds"])
        assert abs(day["balanceError"]) < 1e-7
    assert [f["bedForecast"]["demandUtilizationPct"] for f in movie["days"][2]["facilities"]] == pytest.approx([12, 12, 12])
    rows = movie["bedProjection"]["placePeaks"][0]["hospitals"]
    assert sum(row["share"] for row in rows) == pytest.approx(1)
    assert sum(row["expectedAdmissions"] for row in rows) == pytest.approx(54)
    assert all(row["peakStaffedBedsRequired"] == 12 and row["baselinePeakStaffedBedsRequired"] == 6
               and row["additionalStaffedBedsDueToSurge"] == 6 for row in rows)
    no_surge = build_movie(run, context, {**config, "extraCasesPerWeek": 0})
    assert all(row["peakStaffedBedsRequired"] == 6 and row["additionalStaffedBedsDueToSurge"] == 0
               for row in no_surge["bedProjection"]["placePeaks"][0]["hospitals"])
    constrained = build_movie(run, context, {**config, "facilities": [dict(f, normalCapacity=5) for f in config["facilities"]]})
    for facility in constrained["days"][2]["facilities"]:
        assert facility["bedForecast"]["expectedBeds"] == pytest.approx(12)
        assert facility["bedForecast"]["assumedSupportedDengueCapacity"] == 5
        assert facility["bedForecast"]["demandUtilizationPct"] == pytest.approx(240)
        assert facility["supportedOccupancyPct"] == pytest.approx(100)
    zero_slots = build_movie(run, context, {**config, "baselineOccupancy": 1})
    assert all(f["bedForecast"]["demandUtilizationPct"] is None for d in zero_slots["days"] for f in d["facilities"])
    assert zero_slots["bedProjection"]["peakDemandUtilizationPct"] is None


def test_hospital_choice_assumption_handles_fewer_sites_and_rejects_invalid_inputs():
    assert hospital_shares(["A"], "nearest_three_equal") == [("A", 1)]
    assert hospital_shares(["A", "B"], "nearest_three_equal") == [("A", .5), ("B", .5)]
    assert hospital_shares(["A", "B", "C", "D"], "nearest") == [("A", 1)]
    for order, policy in [([], "nearest"), (["A", "A"], "nearest_three_equal"), (["A"], "measured")]:
        with pytest.raises(ValueError):
            hospital_shares(order, policy)


def test_surge_staffing_counts_only_extra_beds_beyond_rounded_baseline():
    assert surge_staffing(.3, .2) == 0  # One already staffed bed covers both paths.
    assert surge_staffing(1.2, .8) == 1
    assert surge_staffing(12, 6) == 6
    assert surge_staffing(1, 1) == 0
