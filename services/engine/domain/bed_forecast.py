"""Case-to-admission/LOS bed demand, separate from staffed placements and vacancies."""
import math
from .hospital_demand import hospital_shares


def needed(value):
    return max(0, math.ceil(value - 1e-9))


def surge_staffing(mean, baseline):
    """Extra whole beds beyond the baseline staffing already rounded up."""
    return max(0, needed(mean) - needed(baseline))


def rolling_bed_demand(arrivals, los):
    if type(los) is not int or not 1 <= los <= 30 or any(not math.isfinite(v) or v < 0 for v in arrivals):
        raise ValueError("Invalid LOS or admission trajectory")
    return [sum(arrivals[max(0, d - los + 1):d + 1]) for d in range(len(arrivals))]


def add_bed_forecasts(flow, case_days, run, context, config, orders):
    """Unconstrained need before capacity rejection; ranges condition on q/LOS/catchment."""
    q, delay, los = config["hospitalizationRate"], config["admissionDelayDays"], config["lengthOfStayDays"]
    n = len(flow)
    cases = [0.0] + [d["expectedCases"] for d in case_days[:n - 1]]
    bounds_available = all("lowerCases" in p and p["lowerCases"] is not None for p in run["weeklyPredictions"])
    lower, upper = [0.0], [0.0]
    by_id = {b["id"]: b for b in context["barangays"]}
    central_by_hospital = {f["facilityId"]: [0.0] for f in config["facilities"]}
    low_by_hospital = {f["facilityId"]: [0.0] for f in config["facilities"]}
    high_by_hospital = {f["facilityId"]: [0.0] for f in config["facilities"]}
    baseline_by_hospital = {f["facilityId"]: [0.0] for f in config["facilities"]}
    shares = {b["id"]: hospital_shares(orders[b["id"]], config.get("arrivalSplitPolicy", "nearest")) for b in context["barangays"]}
    for i, d in enumerate(case_days[:n - 1]):
        if run.get("dailyPredictions"):
            baseline = run["dailyPredictions"][i]
            lo, hi = baseline["lowerCases"], baseline["upperCases"]
        elif bounds_available:
            baseline = run["weeklyPredictions"][i // 7]
            lo, hi = baseline["lowerCases"] / 7, baseline["upperCases"] / 7
        else:
            lo = hi = d["baselineCases"]
        factor = d.get("surgeFactor", 1.0)
        additive = max(0, d["shockCases"] - d["baselineCases"] * (factor - 1))
        lower.append(lo * factor + additive)
        upper.append(hi * factor + additive)
        for values in [central_by_hospital, low_by_hospital, high_by_hospital, baseline_by_hospital]:
            for ident in values:
                values[ident].append(0.0)
        for barangay in d["barangays"]:
            weight = by_id[barangay["barangayId"]]["weight"]
            local_extra = max(0, barangay["shockCases"] - barangay["baselineCases"] * (factor - 1))
            for ident, share in shares[barangay["barangayId"]]:
                central_by_hospital[ident][-1] += barangay["expectedCases"] * share
                baseline_by_hospital[ident][-1] += barangay["baselineCases"] * share
                low_by_hospital[ident][-1] += (lo * factor * weight + local_extra) * share
                high_by_hospital[ident][-1] += (hi * factor * weight + local_extra) * share
    def demand(values, share=1.0):
        arrivals = [values[d - delay] * q * share if d > delay else 0.0 for d in range(n)]
        return rolling_bed_demand(arrivals, los)
    central, lo_curve, hi_curve = demand(cases), demand(lower), demand(upper)
    baseline_network = demand([0.0] + [d["baselineCases"] for d in case_days[:n - 1]])
    # Explicit hospital-choice assumption before capacity-based diversions.
    hospital_curves = {ident: (demand(values), demand(low_by_hospital[ident]), demand(high_by_hospital[ident]))
                       for ident, values in central_by_hospital.items()}
    baseline_curves = {ident: demand(values) for ident, values in baseline_by_hospital.items()}

    def prediction(mean, low, high, capacity):
        return {"expectedBeds": mean, "lowerBeds": low if bounds_available else None,
            "upperBeds": high if bounds_available else None, "staffedBedsRequired": needed(mean),
            "lowerStaffedBedsRequired": needed(low) if bounds_available else None,
            "upperStaffedBedsRequired": needed(high) if bounds_available else None,
            "assumedSupportedDengueCapacity": capacity,
            "demandUtilizationPct": mean / capacity * 100 if capacity > 0 else None,
            "utilizationDefinition": "Expected dengue bed demand divided by scenario-assumed dengue slots before diversions; can exceed 100%. Not observed occupancy.",
            "additionalStaffedBedsNeeded": needed(max(0, mean - capacity)),
            "additionalBedsUpperScenario": needed(max(0, high - capacity)) if bounds_available else None,
            "measurementKind": "modeled_allocation",
            "rangeKind": "Case-range sensitivity with fixed admission fraction, delay, LOS and capacity; not validated bed-occupancy intervals."}
    for day in flow:
        i = day["dayIndex"]
        capacity = sum(f["normalCapacity"] * (1 - config["baselineOccupancy"]) + f["activatedSurgeCapacity"] for f in day["facilities"])
        day["bedForecast"] = prediction(central[i], lo_curve[i], hi_curve[i], capacity)
        day["bedForecast"].update({"baselineExpectedBeds": baseline_network[i],
            "baselineStaffedBedsRequired": needed(baseline_network[i]),
            "additionalStaffedBedsDueToSurge": surge_staffing(central[i], baseline_network[i])})
        for facility in day["facilities"]:
            central_hospital, low_hospital, high_hospital = hospital_curves[facility["facilityId"]]
            supported = facility["normalCapacity"] * (1 - config["baselineOccupancy"]) + facility["activatedSurgeCapacity"]
            facility["bedForecast"] = prediction(central_hospital[i], low_hospital[i], high_hospital[i], supported)
            facility["bedForecast"].update({"baselineExpectedBeds": baseline_curves[facility["facilityId"]][i],
                "baselineStaffedBedsRequired": needed(baseline_curves[facility["facilityId"]][i]),
                "additionalStaffedBedsDueToSurge": surge_staffing(central_hospital[i], baseline_curves[facility["facilityId"]][i]),
                "catchmentMethod": config.get("arrivalSplitPolicy", "nearest") + "; assumed choice shares before diversions, not observed admissions."})
    peak = max(flow, key=lambda d: (d["bedForecast"]["staffedBedsRequired"], -d["dayIndex"]))
    place_peaks = []
    for b in context["barangays"]:
        values = [0.0] + [next(row["expectedCases"] for row in d["barangays"] if row["barangayId"] == b["id"]) for d in case_days[:n - 1]]
        base_values = [0.0] + [next(row["baselineCases"] for row in d["barangays"] if row["barangayId"] == b["id"]) for d in case_days[:n - 1]]
        curve, base_curve = demand(values), demand(base_values)
        place_peaks.append({"barangayId": b["id"], "choiceMeasurementKind": "assumption", "hospitals": [
            {"facilityId": ident, "share": share,
             "expectedAdmissions": sum(values[max(0, d - delay)] * q * share if d > delay else 0 for d in range(n)),
             "peakStaffedBedsRequired": needed(max(curve) * share),
             "baselinePeakStaffedBedsRequired": needed(max(base_curve) * share),
             "additionalStaffedBedsDueToSurge": max(surge_staffing(value * share, baseline * share) for value, baseline in zip(curve, base_curve))}
            for ident, share in shares[b["id"]]]})
    return {"peakDate": peak["date"], "peakDayIndex": peak["dayIndex"], **peak["bedForecast"],
        "baselinePeakStaffedBedsRequired": needed(max(baseline_network)),
        "peakAdditionalStaffedBedsDueToSurge": max(d["bedForecast"]["additionalStaffedBedsDueToSurge"] for d in flow),
        "peakDemandUtilizationPct": max((d["bedForecast"]["demandUtilizationPct"] for d in flow if d["bedForecast"]["demandUtilizationPct"] is not None), default=None),
        "arrivalSplitPolicy": config.get("arrivalSplitPolicy", "nearest"), "placePeaks": place_peaks,
        "peakLowerStaffedBedsRequired": max(d["bedForecast"]["lowerStaffedBedsRequired"] for d in flow) if bounds_available else None,
        "peakUpperStaffedBedsRequired": max(d["bedForecast"]["upperStaffedBedsRequired"] for d in flow) if bounds_available else None,
        "peakAdditionalStaffedBedsNeeded": max(d["bedForecast"]["additionalStaffedBedsNeeded"] for d in flow),
        "hospitalPeaks": [{"facilityId": f["facilityId"],
            "peakDemandUtilizationPct": max((next(h for h in d["facilities"] if h["facilityId"] == f["facilityId"])["bedForecast"]["demandUtilizationPct"] for d in flow if next(h for h in d["facilities"] if h["facilityId"] == f["facilityId"])["bedForecast"]["demandUtilizationPct"] is not None), default=None),
            "baselinePeakStaffedBedsRequired": needed(max(baseline_curves[f["facilityId"]])),
            "additionalStaffedBedsDueToSurge": max(surge_staffing(value, base) for value, base in zip(hospital_curves[f["facilityId"]][0], baseline_curves[f["facilityId"]])),
            "peakStaffedBedsRequired": max(next(h for h in d["facilities"] if h["facilityId"] == f["facilityId"])["bedForecast"]["staffedBedsRequired"] for d in flow)} for f in config["facilities"]],
        "initialCensusAssumption": "Zero pre-window dengue inpatient census. Actual current occupied/staffed beds are unknown."}
