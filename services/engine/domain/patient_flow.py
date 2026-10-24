"""Deterministic 28-day expected-value cohorts with finite supported/holding space.

Fractional expected patients are modeled quantities. No observed occupancy or
clinical eligibility is inferred from accreditation or specialty.
"""
import math


def simulate_flow(weekly, facilities, admission_rate, los, occupancy, delay=0, activation_day=0, daily_groups=None, assignment_method="nearest"):
    if len(weekly) != 4 or any(not math.isfinite(v) or v < 0 for v in weekly):
        raise ValueError("Four finite nonnegative QC forecast blocks required")
    if not facilities or not 0 <= admission_rate <= 1 or not 0 <= occupancy <= 1 or not 1 <= los <= 30 or not 0 <= delay <= 28 or not 0 <= activation_day <= 28:
        raise ValueError("Invalid patient-flow assumptions")
    for f in facilities:
        if any(type(f[k]) is not int or f[k] < 0 for k in ["normalCapacity", "surgeCapacity", "holdingCapacity"]) or f["normalCapacity"] == 0:
            raise ValueError("Explicit finite positive normal capacity required")
    ids = {f["facilityId"] for f in facilities}
    if len(ids) != len(facilities):
        raise ValueError("Duplicate facility IDs")
    if daily_groups is not None:
        if len(daily_groups) != 28:
            raise ValueError("Exactly 28 daily group arrays required")
        for groups in daily_groups:
            for group in groups:
                if not math.isfinite(group["cases"]) or group["cases"] < 0 or set(group["facilityOrder"]) != ids or len(group["facilityOrder"]) != len(ids):
                    raise ValueError("Invalid spatial demand or hospital ordering")
    if assignment_method not in {"nearest", "optimized"} or (assignment_method == "optimized" and daily_groups is None):
        raise ValueError("Invalid assignment method or missing spatial costs")
    states = [{"config": f, "cohorts": [], "holding": 0.0} for f in facilities]
    arrivals_total = discharged_total = unmet_total = 0.0
    days = []
    for day in range(29):
        groups = []
        if day > delay:
            groups = daily_groups[day - delay - 1] if daily_groups is not None else [{
                "originId": None, "cases": weekly[(day - delay - 1) // 7] / 7,
                "facilityOrder": [f["facilityId"] for f in facilities]}]
        arrivals = sum(g["cases"] for g in groups) * admission_rate
        discharged = 0.0
        for s in states:
            discharged += sum(count for exit_day, count in s["cohorts"] if exit_day <= day)
            s["cohorts"] = [(exit_day, count) for exit_day, count in s["cohorts"] if exit_day > day]
            f = s["config"]
            extra = f["surgeCapacity"] if day >= activation_day else 0
            residual = f["normalCapacity"] * (1 - occupancy) + extra - sum(c for _, c in s["cohorts"])
            promote = min(s["holding"], max(0, residual))
            s["holding"] -= promote
            if promote:
                s["cohorts"].append((day + los, promote))
        remaining, assignments = 0.0, []
        by_id = {s["config"]["facilityId"]: s for s in states}
        plans = None
        if assignment_method == "optimized" and groups:
            from .optimizer import daily_plan
            plans = daily_plan(groups, states, admission_rate, occupancy, day, activation_day)
        # Explicit group order, then caller-supplied approved distance order.
        # This is a nearest-capacity greedy baseline, not an optimizer or referral.
        for group_index, group in enumerate(groups):
            pending = group["cases"] * admission_rate
            routes = {}
            for ident in group["facilityOrder"]:
                if pending <= 0:
                    break
                s = by_id[ident]
                f = s["config"]
                extra = f["surgeCapacity"] if day >= activation_day else 0
                residual = f["normalCapacity"] * (1 - occupancy) + extra - sum(c for _, c in s["cohorts"])
                proposed = plans[group_index]["supported"][ident] if plans is not None else pending
                placed = min(pending, max(0, residual), proposed)
                if placed:
                    s["cohorts"].append((day + los, placed))
                    routes[ident] = {"supportedPlacements": placed, "holdingPlacements": 0.0}
                pending -= placed
            for ident in group["facilityOrder"]:
                if pending <= 0:
                    break
                s = by_id[ident]
                proposed = plans[group_index]["holding"][ident] if plans is not None else pending
                held = min(pending, max(0, s["config"]["holdingCapacity"] - s["holding"]), proposed)
                s["holding"] += held
                pending -= held
                if held:
                    routes.setdefault(ident, {"supportedPlacements": 0.0, "holdingPlacements": 0.0})["holdingPlacements"] += held
            remaining += pending
            assignments.extend({"barangayId": group["originId"], "facilityId": ident, **counts} for ident, counts in routes.items())
        snapshots = []
        for s in states:
            f = s["config"]
            n, surge = f["normalCapacity"], f["surgeCapacity"] if day >= activation_day else 0
            census = sum(c for _, c in s["cohorts"])
            total = n * occupancy + census
            snapshots.append({"facilityId": f["facilityId"], "normalCapacity": n, "activatedSurgeCapacity": surge,
                "supportedCapacity": n + surge, "remainingSupportedCapacity": max(0, n + surge - total),
                "assumedNonDengueCensus": n * occupancy,
                "normalDengueCensus": min(census, n * (1 - occupancy)),
                "surgeDengueCensus": max(0, census - n * (1 - occupancy)), "supportedCensus": census,
                "holdingCensus": s["holding"], "normalOccupancyPct": 100 * total / n,
                "supportedOccupancyPct": 100 * total / (n + surge),
                "onSiteRelativeToNormalPct": 100 * (total + s["holding"]) / n})
        arrivals_total += arrivals
        discharged_total += discharged
        unmet_total += remaining
        inpatient = sum(f["supportedCensus"] for f in snapshots)
        holding = sum(f["holdingCensus"] for f in snapshots)
        error = arrivals_total - discharged_total - unmet_total - inpatient - holding
        if abs(error) > 1e-7:
            raise ValueError("Patient-flow conservation failure")
        days.append({"dayIndex": day, "arrivals": arrivals, "discharges": discharged,
            "cumulativeArrivals": arrivals_total, "cumulativeDischarges": discharged_total,
            "unresolvedToday": remaining, "cumulativeUnresolved": unmet_total,
            "supportedCensus": inpatient, "holdingCensus": holding, "balanceError": error, "facilities": snapshots,
            "assignments": assignments})
    return days
