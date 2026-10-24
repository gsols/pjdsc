"""Hypothetical spatial expansion, distances and dates, separate from observations."""
from datetime import datetime, timedelta, timezone
import math

from pyproj import Transformer
from shapely import transform
from shapely.geometry import shape

from .patient_flow import simulate_flow
from .spatial import annual_weights

VERSION = "spatial-expansion-nearest-capacity-v1"


def expansion_ring(center, radius_km):
    lon, lat = map(math.radians, center)
    angular = radius_km / 6371.0088
    points = []
    for i in range(73):
        bearing = 2 * math.pi * i / 72
        y = math.asin(math.sin(lat) * math.cos(angular) + math.cos(lat) * math.sin(angular) * math.cos(bearing))
        x = lon + math.atan2(math.sin(bearing) * math.sin(angular) * math.cos(lat), math.cos(angular) - math.sin(lat) * math.sin(y))
        points.append([math.degrees(x), math.degrees(y)])
    return points


def distance_km(a, b):
    """Haversine between [longitude, latitude] representative/provisional points."""
    lon1, lat1, lon2, lat2 = map(math.radians, [*a, *b])
    term = math.sin((lat2 - lat1) / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, max(0, term))))


def make_context(run, annual, geojson, hospitals, cutoff_year=None):
    records = {r["ADM4_PCODE"]: r for r in annual}
    year, weights = annual_weights(annual, min(run["issueBlock"]["YR"], cutoff_year or 9999))
    weight_map = dict(weights)
    to_utm = Transformer.from_crs(4326, 32651, always_xy=True).transform
    to_wgs = Transformer.from_crs(32651, 4326, always_xy=True).transform
    features = geojson["features"]
    if len(features) != 142 or {f["properties"]["ADM4_PCODE"] for f in features} != set(records):
        raise ValueError("Incomplete QC geometry join")
    barangays = []
    for feature in features:
        geometry = shape(feature["geometry"])
        if not geometry.is_valid or geometry.is_empty or geometry.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError("Invalid source polygon")
        # A point-on-surface in local projected CRS, never an invented facility point.
        point = transform(transform(geometry, to_utm, interleaved=False).representative_point(), to_wgs, interleaved=False)
        coordinates = [point.x, point.y]
        ident = feature["properties"]["ADM4_PCODE"]
        nearest = sorted([{"facilityId": h["id"], "distanceKm": distance_km(coordinates, [h["longitude"], h["latitude"]])}
                          for h in hospitals], key=lambda r: (r["distanceKm"], r["facilityId"]))
        barangays.append({"id": ident, "name": records[ident]["Barangay"], "coordinates": coordinates,
            "sourceADM4_PCODE": feature["properties"].get("sourceADM4_PCODE"), "weight": weight_map[ident],
            "observedAnnualCases": records[ident][f"DC_{year}"],
            "nearestHospitals": nearest[:3]})
    return {"schemaVersion": "1.0", "referenceForecastRunId": run["id"], "weightYear": year,
        "barangays": sorted(barangays, key=lambda b: b["id"]),
        "hospitals": [{"id": h["id"], "name": h["name"], "coordinates": [h["longitude"], h["latitude"]],
            "coordinateStatus": h["coordinateStatus"], "sourceAsOf": h["sourceAsOf"], "coordinateSourceUrl": h["coordinateSourceUrl"],
            "primarySourceUrl": h["primarySourceUrl"],
            "accreditedBeds": h["accreditedBeds"], "normalStaffedCapacity": None, "dengueUsableBeds": None,
            "dengueInpatientEligible": None} for h in hospitals],
        "distanceMethod": "Haversine km from projected polygon point-on-surface to provisional hospital point; not road distance, travel time or verified entrance."}


def spatial_trajectory(run, context, seed_id, extra_weekly, radius_start, radius_speed, growth_days, duration, profile="ramp"):
    if any(not math.isfinite(v) for v in [extra_weekly, radius_start, radius_speed, growth_days, duration]) or not 1 <= duration <= 28 or extra_weekly < 0 or radius_start <= 0 or radius_speed < 0 or growth_days < 1:
        raise ValueError("Invalid expansion assumptions")
    weights = [b["weight"] for b in context["barangays"]]
    reference = [p["meanCases"] for p in run["weeklyPredictions"]]
    if len(reference) != 4 or any(not math.isfinite(v) or v < 0 for v in [*weights, *reference]) or not math.isclose(sum(weights), 1, abs_tol=1e-9):
        raise ValueError("Invalid historical reference or spatial weights")
    seed = next((b for b in context["barangays"] if b["id"] == seed_id), None)
    if seed is None:
        raise ValueError("Unknown QC seed barangay")
    distances = {b["id"]: distance_km(seed["coordinates"], b["coordinates"]) for b in context["barangays"]}
    days = []
    for day in range(1, 29):
        baseline = run["weeklyPredictions"][(day - 1) // 7]["meanCases"] / 7 if day <= duration else 0.0
        factor = 1.0 if profile == "step" else min(1.0, day / growth_days)
        shock = extra_weekly / 7 * factor if day <= duration else 0.0
        radius = radius_start + radius_speed * (day - 1)
        kernel = {b["id"]: math.exp(-.5 * (distances[b["id"]] / radius)**2)
                  if distances[b["id"]] <= radius else 0.0 for b in context["barangays"]}
        normalizer = sum(kernel.values())
        rows = [{"barangayId": b["id"], "baselineCases": baseline * b["weight"],
                 "shockCases": shock * kernel[b["id"]] / normalizer} for b in context["barangays"]]
        for row in rows:
            row["expectedCases"] = row["baselineCases"] + row["shockCases"]
        days.append({"dayIndex": day, "baselineCases": baseline, "shockCases": shock, "expectedCases": baseline + shock,
            "assumedRadiusKm": radius, "barangays": rows})
    return days


def build_movie(run, context, config):
    duration = (config["endDate"] - config["startDate"]).days
    days = spatial_trajectory(run, context, config["seedBarangayId"], config["extraCasesPerWeek"],
        config["initialRadiusKm"], config["expansionKmPerDay"], config["growthDays"], duration, config["shockProfile"])
    if config.get("autoHotspots"):
        for d in days:
            d["assumedRadiusKm"] = 0.0
            for b in d["barangays"]:
                weight = next(c["weight"] for c in context["barangays"] if c["id"] == b["barangayId"])
                b["shockCases"] = d["shockCases"] * weight
                b["expectedCases"] = b["baselineCases"] + b["shockCases"]
    hospital_map = {h["id"]: h for h in context["hospitals"]}
    eligible = {f["facilityId"] for f in config["facilities"]}
    barangay_map = {b["id"]: b for b in context["barangays"]}
    orders = {b["id"]: sorted(eligible, key=lambda h: (distance_km(b["coordinates"], hospital_map[h]["coordinates"]), h))
              for b in context["barangays"]}
    groups = [[{"originId": b["barangayId"], "cases": b["expectedCases"], "facilityOrder": orders[b["barangayId"]]}
               for b in d["barangays"]] for d in days]
    if config.get("allocationPolicy") == "optimized":
        for groups_for_day in groups:
            for group in groups_for_day:
                group["facilityCostsKm"] = {ident: distance_km(barangay_map[group["originId"]]["coordinates"], hospital_map[ident]["coordinates"]) for ident in eligible}
    flow = simulate_flow([p["meanCases"] for p in run["weeklyPredictions"]], config["facilities"],
        config["hospitalizationRate"], config["lengthOfStayDays"], config["baselineOccupancy"],
        config["admissionDelayDays"], config["surgeActivationDay"], daily_groups=groups, assignment_method=config.get("allocationPolicy", "nearest"))
    cumulative = {b["id"]: 0.0 for b in context["barangays"]}
    cumulative_shock = {b["id"]: 0.0 for b in context["barangays"]}
    baseline_total = shock_total = 0.0
    zone = timezone(timedelta(hours=8))
    onset = datetime.combine(config["startDate"], datetime.min.time(), zone)
    for d in flow[:duration + 1]:
        index = d["dayIndex"]
        start, end = onset + timedelta(days=max(0, index - 1)), onset + timedelta(days=index)
        if index:
            source = days[index - 1]
            rows = source["barangays"]
            baseline_total += source["baselineCases"]
            shock_total += source["shockCases"]
            for b in rows:
                cumulative[b["barangayId"]] += b["expectedCases"]
                cumulative_shock[b["barangayId"]] += b["shockCases"]
                b["cumulativeCases"] = cumulative[b["barangayId"]]
            d.update({k: v for k, v in source.items() if k != "dayIndex"})
        else:
            d.update({"expectedCases": 0.0, "baselineCases": 0.0, "shockCases": 0.0, "assumedRadiusKm": 0.0,
                "barangays": [{"barangayId": b["id"], "expectedCases": 0.0, "baselineCases": 0.0, "shockCases": 0.0, "cumulativeCases": 0.0} for b in context["barangays"]]})
        d.update({"date": end.date().isoformat(), "snapshotAt": end.isoformat(),
            "intervalStart": start.isoformat(), "intervalEnd": end.isoformat(),
            "cumulativeCases": baseline_total + shock_total, "cumulativeBaselineCases": baseline_total, "cumulativeShockCases": shock_total})
        seed = barangay_map[config["seedBarangayId"]]
        d["expansionRing"] = expansion_ring(seed["coordinates"], d["assumedRadiusKm"]) if index and config["extraCasesPerWeek"] > 0 and not config.get("autoHotspots") else []
        ranking_field = "cumulativeCases" if config.get("autoHotspots") else "expectedCases"
        d["hotspotIds"] = [b["barangayId"] for b in sorted(d["barangays"], key=lambda b: (-b[ranking_field], b["barangayId"]))[:10] if b[ranking_field] > 0]
        if run.get("calibrationResidualPaths"):
            d["caseRange"] = period_case_range(run, index, d["cumulativeShockCases"])
            h = max(0, (index - 1) // 7)
            p = run["weeklyPredictions"][h]
            d["dailyCaseRange"] = {"lowerCases": (p["lowerCases"] / 7 + d["shockCases"]) if index else 0.0,
                "upperCases": (p["upperCases"] / 7 + d["shockCases"]) if index else 0.0}
            for b in d["barangays"]:
                weight = barangay_map[b["barangayId"]]["weight"]
                b["caseRange"] = {k: (v - d["cumulativeShockCases"]) * weight + cumulative_shock[b["barangayId"]]
                    for k, v in d["caseRange"].items() if k in {"lowerCases", "upperCases"}}
        for route in d["assignments"]:
            route["distanceKm"] = distance_km(barangay_map[route["barangayId"]]["coordinates"], hospital_map[route["facilityId"]]["coordinates"])
    return {"days": flow[:duration + 1], "context": context, "durationDays": duration,
        "mapScaleMaxDailyCases": max(b["expectedCases"] for d in days[:duration] for b in d["barangays"]),
        "measurementKind": "modeled_allocation", "capacityMeasurementKind": "assumption",
        "calendarStatus": "USER_SELECTED_HYPOTHETICAL_DATES_NOT_SOURCE_WEEK_ALIGNMENT",
        "assumptions": "Historical reference blocks mapped onto hypothetical dates; annual weights use only complete years before the reference/scenario cutoff with one extra full-year lag. Additive shock uses a radial truncated Gaussian over polygon representative points; radius speed and case ramp are user assumptions, not transmission estimates. Uniform daily reference cases, zero initial dengue census, fixed LOS and occupancy; deterministic nearest-supported-capacity assignment, then nearest holding; no transfers or routing optimizer.",
        "disclaimer": "Hypothetical spread and hospital-demand planning movie. No observed daily/weekly barangay spread, clinical eligibility, hospital vacancy or road-route claim. All hospital points are provisional; 2026 inventory is a hypothetical planning network."}


def period_case_range(run, elapsed_days, assumed_extra_cases=0):
    """Joint-horizon errors from complete past paths, preserving temporal covariance."""
    fractions = [min(7, max(0, elapsed_days - 7 * h)) / 7 for h in range(4)]
    errors = sorted(abs(sum(v * f for v, f in zip(p["residuals"], fractions))) for p in run["calibrationResidualPaths"])
    if len(errors) < 20:
        raise ValueError("Insufficient pre-origin range evidence")
    rank = min(len(errors), math.ceil((len(errors) + 1) * .8))
    radius = errors[rank - 1]
    reference = sum(p["meanCases"] * f for p, f in zip(run["weeklyPredictions"], fractions))
    return {"lowerCases": max(0, reference - radius) + assumed_extra_cases,
        "upperCases": reference + radius + assumed_extra_cases, "coverageTarget": .8,
        "calibrationSamples": len(errors), "method": "Pre-origin joint residual trajectories; conditional on fixed annual spatial weights. Allocation and hospital uncertainty not calibrated."}
