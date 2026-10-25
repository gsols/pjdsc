"""Calendar, source-mass and parameter regression tests; all counts are fixtures."""
from datetime import date, timedelta
import math

from fastapi import HTTPException
import pytest

from services.engine.domain.source_calendar import day_schedule, block_days, align_historical_run
from services.engine.domain import seasonal_forecast as seasonal
from services.engine.domain.outbreak import period_case_range, allocated_forecast_trajectory
from services.engine.api.qc_simulation import select_reference


@pytest.mark.parametrize("year", [2024, 2025, 2027, 2028, 2035])
def test_every_calendar_day_preserves_exactly_52_source_totals(year):
    schedule = day_schedule(date(year, 1, 1), (date(year + 1, 1, 1) - date(year, 1, 1)).days)
    totals = {}
    for _, block, divisor in schedule:
        totals[block] = totals.get(block, 0) + 70 / divisor
    assert len(totals) == 52
    assert list(totals.values()) == pytest.approx([70] * 52)
    assert sum(totals.values()) == pytest.approx(3640)
    assert block_days(year, 52) in {8, 9}


@pytest.mark.parametrize("start", [date(2027, 12, 30), date(2028, 12, 30), date(2028, 2, 27)])
def test_projected_dates_and_residuals_share_the_same_day_divisors(monkeypatch, start):
    monkeypatch.setattr(seasonal, "predict_weeks", lambda engine, weeks, profile: {"seasonal_xgboost": [70] * len(weeks)})
    projection = seasonal.project_days({}, start, "typical", "seasonal_xgboost")
    assert [p["date"] for p in projection] == [(start + timedelta(days=i)).isoformat() for i in range(28)]
    records = [{"block": year * 52 + week - 1, "week": week, "observed": 70 + week,
        "seasonal_xgboost": 70, "lastTrainingBlock": year * 52 - 1}
        for year in range(2018, 2024) for week in range(1, 53)]
    paths, daily = seasonal.daily_residual_paths(records, start, "seasonal_xgboost", 2024 * 52 - 1)
    schedule = day_schedule(start, 28)
    for i, (_, block, divisor) in enumerate(schedule):
        assert projection[i]["meanCases"] == pytest.approx(70 / divisor)
        for path, errors in zip(paths, daily):
            assert errors["errors"][i] == pytest.approx(path["residuals"][block - schedule[0][1]] / divisor)
    assert all(len({records[(p["originBlock"] + 1 + h) - 2018 * 52]["lastTrainingBlock"]
                    for h in range(len(p["residuals"]))}) == 1 for p in paths)


def historical_fixture():
    return {"issueBlock": {"YR": 2025, "WN": 4},
        "weeklyPredictions": [{"YR": 2025, "WN": 5 + i, "meanCases": 70 * (i + 1),
            "lowerCases": 63 * (i + 1), "upperCases": 77 * (i + 1)} for i in range(4)],
        "calibrationResidualPaths": [{"lastTargetBlock": 2024 * 52, "residuals": [7, -14, 21, -28]} for _ in range(20)]}


def test_partial_historical_window_uses_actual_offset_and_covariant_errors():
    run = historical_fixture()
    aligned = align_historical_run(run, date(2025, 2, 3), 9)
    assert [p["meanCases"] for p in aligned["dailyPredictions"][:9]] == [10] * 2 + [20] * 7
    assert period_case_range(aligned, 9)["lowerCases"] == pytest.approx(160 - 12)
    assert period_case_range(aligned, 9)["upperCases"] == pytest.approx(160 + 12)
    assert "dailyPredictions" not in run
    assert select_reference([run], date(2025, 2, 3), date(2025, 2, 12)) is run
    with pytest.raises(HTTPException) as error:
        select_reference([run], date(2025, 3, 1), date(2025, 3, 8))
    assert error.value.status_code == 422
    with pytest.raises(ValueError):
        align_historical_run(run, date(2025, 2, 3), 28)


@pytest.mark.parametrize("duration,onset,growth,multiplier", [(1, 0, 1, 1), (2, 0, 7, 10), (12, 3, 2, 2), (28, 27, 28, 10)])
def test_all_window_lengths_and_surge_onsets_follow_the_declared_equation(duration, onset, growth, multiplier):
    run = {"dailyPredictions": [{"meanCases": 10 + i} for i in range(28)]}
    context = {"barangays": [{"id": "A", "weight": .4}, {"id": "B", "weight": .6}]}
    config = {"surgeEnabled": True, "surgeOnsetDay": onset, "growthDays": growth,
        "surgeMultiplier": multiplier, "extraCasesPerWeek": 0, "shockProfile": "ramp"}
    days = allocated_forecast_trajectory(run, context, config, duration)
    for i, row in enumerate(days[:duration]):
        factor = 1 if i < onset else 1 + (multiplier - 1) * min(1, (i - onset + 1) / growth)
        assert row["expectedCases"] == pytest.approx((10 + i) * factor)
        assert row["shockCases"] == pytest.approx((10 + i) * (factor - 1))
        assert math.fsum(b["expectedCases"] for b in row["barangays"]) == pytest.approx(row["expectedCases"])
    assert all(row["expectedCases"] == 0 for row in days[duration:])
