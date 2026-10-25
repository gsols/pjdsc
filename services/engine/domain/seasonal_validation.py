"""Matched time-ordered diagnostics; calendar daily/monthly targets are proxies."""
from datetime import date, timedelta
import math

import numpy as np

from .seasonal_forecast import daily_residual_paths
from .source_calendar import day_schedule


def error_metrics(predicted, observed):
    error = np.asarray(predicted, dtype=float) - np.asarray(observed, dtype=float)
    if not len(error) or not np.isfinite(error).all() or not np.isfinite(observed).all():
        raise ValueError("Finite matched predictions and observations required")
    total = float(np.sum(observed))
    return {"n": len(error), "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error ** 2))), "meanBias": float(np.mean(error)),
        "wapePct": float(np.sum(np.abs(error)) / total * 100) if total > 0 else None}


def calendar_diagnostics(records, names):
    monthly, seasonal, horizons = [], [], []
    for year in [2024, 2025]:
        rows = [r for r in records if r["year"] == year]
        calibration = [r for r in records if r["year"] < year]
        lookup = {r["block"]: r for r in rows}
        beginning = date(year, 1, 1)
        schedule = day_schedule(beginning, (date(year + 1, 1, 1) - beginning).days)
        for name in names:
            daily = [lookup[block][name] / divisor for _, block, divisor in schedule]
            actual = [lookup[block]["observed"] / divisor for _, block, divisor in schedule]
            for month in range(1, 13):
                indices = [i for i, (day, _, _) in enumerate(schedule) if day.month == month]
                predicted, observed = sum(daily[i] for i in indices), sum(actual[i] for i in indices)
                monthly.append({"year": year, "month": month, "model": name,
                    "expectedCases": predicted, "sourceDerivedCases": observed,
                    "absoluteError": abs(predicted - observed), "calendarDays": len(indices)})
            for quarter in range(1, 5):
                group = [r for r in rows if (r["week"] - 1) // 13 + 1 == quarter]
                seasonal.append({"year": year, "sourceQuarter": quarter, "model": name,
                    **error_metrics([r[name] for r in group], [r["observed"] for r in group])})
            path_cache = {offset: daily_residual_paths(calibration, beginning + timedelta(days=offset), name,
                                                       year * 52 - 1)[1]
                          for offset in range(0, len(schedule), 7)}
            for length in [1, 2, 7, 12, 14, 28]:
                predictions, observations, covered = [], [], []
                # Seven-day-spaced starts from one frozen year-origin model;
                # windows overlap and are not independent trials.
                for offset in range(0, len(schedule) - length + 1, 7):
                    prediction = sum(daily[offset:offset + length])
                    observation = sum(actual[offset:offset + length])
                    errors = sorted(abs(sum(p["errors"][:length])) for p in path_cache[offset])
                    radius = errors[min(len(errors), math.ceil((len(errors) + 1) * .8)) - 1]
                    predictions.append(prediction); observations.append(observation)
                    covered.append(max(0, prediction - radius) <= observation <= prediction + radius)
                horizons.append({"year": year, "days": length, "model": name,
                    **error_metrics(predictions, observations), "empiricalRangeCoverage": float(np.mean(covered))})
    return {"monthly": monthly, "sourceQuarters": seasonal, "windowLengths": horizons,
        "targetDefinition": "Daily/monthly targets are uniform disaggregations of source weekly observations under the assumed Jan-1 52-block calendar. They are not independently observed daily/monthly counts.",
        "evaluationDesign": "Each evaluation year's predictions use a model fitted only to earlier years. Ranges use completed errors only through the prior year. Window starts are seven days apart within that frozen year; overlapping windows are dependent. No surge or measured future weather enters evaluation."}
