"""Explicit display assumption, not a reconciled epidemiological calendar.

Blocks 1..51 contain seven days from Jan 1. Block 52 contains the remaining
eight/nine days. Dividing that block by its actual length preserves source mass.
"""
from datetime import date, timedelta


def source_week(day):
    return min(52, (day.timetuple().tm_yday - 1) // 7 + 1)


def source_block(day):
    return day.year * 52 + source_week(day) - 1


def block_start(year, week):
    if not 1 <= week <= 52:
        raise ValueError("Source week must be in 1..52")
    return date(year, 1, 1) + timedelta(days=7 * (week - 1))


def block_days(year, week):
    end = block_start(year, week + 1) if week < 52 else date(year + 1, 1, 1)
    return (end - block_start(year, week)).days


def day_schedule(start, length):
    if type(length) is not int or length < 1:
        raise ValueError("Positive whole-day window required")
    return [(day, source_block(day), block_days(day.year, source_week(day)))
            for day in (start + timedelta(days=i) for i in range(length))]


def historical_window(run):
    predictions = run["weeklyPredictions"]
    first, last = predictions[0], predictions[-1]
    return (block_start(first["YR"], first["WN"]),
            block_start(last["YR"], last["WN"]) + timedelta(days=block_days(last["YR"], last["WN"])))


def align_historical_run(run, start, duration):
    """Slice actual target blocks, without relabeling an old forecast as a new date."""
    import copy
    beginning, end = historical_window(run)
    if start < beginning or start + timedelta(days=duration) > end:
        raise ValueError("Selected dates exceed the saved historical forecast's target coverage")
    result = copy.deepcopy(run)
    lookup = {p["YR"] * 52 + p["WN"] - 1: (i, p) for i, p in enumerate(run["weeklyPredictions"])}
    schedule = day_schedule(start, duration)
    rows, indices = [], []
    for day, block, divisor in schedule:
        i, prediction = lookup[block]
        indices.append((i, divisor))
        rows.append({"date": day.isoformat(), "sourceWeekAssumption": source_week(day),
            "sourceBlockDays": divisor, **{key: prediction[key] / divisor for key in ["meanCases", "lowerCases", "upperCases"]}})
    # The patient-flow engine simulates 28 intervals; unused intervals are zero
    # and are never displayed as extra forecast days.
    result["dailyPredictions"] = rows + [{"meanCases": 0, "lowerCases": 0, "upperCases": 0}] * (28 - duration)
    result["dailyResidualPaths"] = [{"lastTargetBlock": p["lastTargetBlock"],
        "errors": [p["residuals"][i] / divisor for i, divisor in indices] + [0.0] * (28 - duration)}
        for p in run["calibrationResidualPaths"]]
    return result
