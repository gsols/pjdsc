"""Future-date seasonal and hypothetical surge planning with case-to-bed projections."""
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field, model_validator

from .qc_simulation import QCInput, LIMITS
from .research import FacilityAssumption, unavailable
from .outbreak import OutbreakInput, inputs, create_movie
from ..repositories.seasonal_runs import create_seasonal_run, approved_model, FOLDER, SeasonalArtifactError

router = APIRouter(prefix="/v1")


def today_qc():
    return datetime.now(timezone(timedelta(hours=8))).date()


class FutureInput(QCInput):
    startDate: date = Field(default_factory=today_qc)
    endDate: date = Field(default_factory=lambda: today_qc() + timedelta(days=28))
    mode: Literal["hypothetical_shock"] = "hypothetical_shock"
    horizonDays: int = Field(default=28, strict=True, ge=1, le=28)
    weatherProfile: Literal["typical", "wetter", "drier", "hotter"] = "typical"
    surgeEnabled: bool = True
    surgeOnsetDay: int = Field(default=0, strict=True, ge=0, le=27)
    surgeMultiplier: float = Field(default=2, ge=1, le=10)
    growthDays: int = Field(default=7, strict=True, ge=1, le=28)

    @model_validator(mode="before")
    @classmethod
    def set_window(cls, value):
        if not isinstance(value, dict):
            raise ValueError("Future scenario input must be a JSON object.")
        values = dict(value)
        start = values.get("startDate", today_qc())
        if isinstance(start, str):
            start = date.fromisoformat(start)
        horizon = values.get("horizonDays", 28)
        if isinstance(start, date) and type(horizon) is int:
            derived = start + timedelta(days=horizon)
            supplied = values.get("endDate", derived)
            if isinstance(supplied, str):
                supplied = date.fromisoformat(supplied)
            if supplied != derived:
                raise ValueError("End date must equal start plus the selected 1–28-day horizon.")
            values["endDate"] = derived
        return values

    @model_validator(mode="after")
    def validate_future(self):
        if self.startDate < today_qc():
            raise ValueError("Use the historical tab for past dates; future planning starts today or later.")
        if self.extraCasesPerWeek != 0:
            raise ValueError("Future planning uses the explicit surge multiplier, not an additive historical shock.")
        if self.surgeEnabled and self.surgeOnsetDay >= self.horizonDays:
            raise ValueError("Choose a surge onset between day 0 and horizon minus one.")
        return self


@router.get("/future-simulation")
def default_future():
    return future_workspace(FutureInput())


@router.post("/future-simulation")
def future_workspace(params: FutureInput):
    try:
        as_of = today_qc()
        run = create_seasonal_run(params.startDate, params.weatherProfile, as_of)
        _, geo, _ = inputs(run["id"], params.startDate.year, True)
        model = OutbreakInput(forecastRunId=run["id"], scenarioKind="hypothetical_shock", autoHotspots=True,
            acknowledgeHypotheticalHospitalNetwork=True, acknowledgeHypotheticalDates=True,
            allocationPolicy=params.allocationPolicy, arrivalSplitPolicy=params.arrivalSplitPolicy, surgeEnabled=params.surgeEnabled,
            surgeOnsetDay=params.surgeOnsetDay, surgeMultiplier=params.surgeMultiplier,
            startDate=params.startDate, endDate=params.endDate,
            seedBarangayId=max(geo["barangays"], key=lambda b: b["weight"])["id"],
            extraCasesPerWeek=0, initialRadiusKm=.5, expansionKmPerDay=0,
            growthDays=params.growthDays, shockProfile="ramp", hospitalizationRate=params.hospitalizationRate,
            lengthOfStayDays=params.lengthOfStayDays, baselineOccupancy=params.baselineOccupancy,
            admissionDelayDays=params.admissionDelayDays, surgeActivationDay=params.surgeActivationDay,
            facilities=[FacilityAssumption(facilityId=h["id"], assumedDengueEligible=True,
                normalCapacity=params.normalCapacity, surgeCapacity=params.surgeCapacity, holdingCapacity=params.holdingCapacity)
                for h in geo["hospitals"]])
        movie = create_movie(model)
        validation = json.loads((FOLDER / "qc-seasonal-validation.json").read_text())
        _, manifest = approved_model()
        final = movie["days"][-1]
        result = {**movie, "workspaceTab": "future", "controlValues": params.model_dump(mode="json"),
            "inputLimits": {**LIMITS, "surgeMultiplier": {"min": 1, "max": 10, "units": "times the seasonal baseline"},
                "surgeOnsetDay": {"min": 0, "max": params.horizonDays - 1, "units": "day index"}},
            "scope": "QUEZON_CITY", "mapContext": "PHILIPPINES_GEOMETRY_ONLY",
            "forecastEvidence": {key: run[key] for key in ["id", "issueBlock", "model", "environmentalInputs", "observedCasesAtOrigin", "observedSourceYearToDateCases", "intervalCoverageTarget", "intervalCaveat", "spatialCaveat", "availabilityAssumption"]},
            "futureForecast": {"asOfDate": as_of.isoformat(), "trainingCutoffBlock": manifest["sourceLastBlock"],
                "weatherProfile": params.weatherProfile, "selectedModel": manifest["selectedModel"],
                "selection": validation["selection"], "validation": validation["backtest"],
                "modelSha256": manifest["modelSha256"], "methodVersion": manifest["methodVersion"],
                "stalenessCaveat": "Source observations end in 2025. No current 2026/2027 cases, measured future weather, hospital census or verified staffed capacity are available. This is conditional seasonal surge planning.",
                "weatherCaveat": "Historical within-season weather analogs are assumptions, not operational weather forecasts. The model has no unavailable current-case lags."},
            "forecastBacktest": [],
            "referenceSelectionAssumption": "A new date-specific seasonal curve is generated for the requested month/week using trained seasonal features and past-only weather analogs. Jan-1 52-block calendar mapping remains assumed, not reconciled source metadata.",
            "rangeInterpretation": "Experimental season-matched historical case error ranges. Bed ranges are low/high case-demand sensitivity conditional on fixed admission fraction, LOS, delay, catchments and capacity; observed bed forecast accuracy is unknown.",
            "periodSummary": {"expectedCases": final["cumulativeCases"], "caseRange": final["caseRange"],
                "barangays": sorted(final["barangays"], key=lambda b: (-b["cumulativeCases"], b["barangayId"]))},
            "assumptions": "New seasonal baseline for the requested future dates; historical weather analogs and a configured surge onset/ramp/multiplier. Fixed prior annual spatial weights, zero initial dengue census, fixed assumed q/LOS/delay and non-dengue occupancy. All 46 hospitals are hypothetical eligible sites. Required beds are unconstrained case-to-cohort demand; modeled placement/overflow uses finite assumed normal/surge/holding resources. No current vacancies are inferred.",
            "simulationResultSha256": movie["resultSha256"]}
        result["assumptions"] = result["assumptions"].replace("Fixed prior annual spatial weights", "Fixed XGBoost annual barangay burden forecast shares")
        result["forecastEvidence"]["spatialCaveat"] = "XGBoost annual barangay burden supplies modeled shares and ten high-burden candidates. Annual ranking is not validated weekly hotspot detection; spatial uncertainty is not included in city case ranges."
        if params.compareAllocation:
            other = create_movie(model.model_copy(update={"allocationPolicy": "optimized" if params.allocationPolicy == "nearest" else "nearest"}))
            def metrics(value):
                last = value["days"][-1]
                return {"cumulativeUnresolved": last["cumulativeUnresolved"], "holdingCensus": last["holdingCensus"],
                    "maxNormalOccupancyPct": max(f["normalOccupancyPct"] for d in value["days"] for f in d["facilities"]),
                    "expectedPatientKm": sum((r["supportedPlacements"] + r["holdingPlacements"]) * r["distanceKm"] for d in value["days"] for r in d["assignments"])}
            result["allocationComparison"] = {params.allocationPolicy: metrics(movie), other["parameters"]["allocationPolicy"]: metrics(other),
                "caveat": "Identical seasonal forecasts, surge, capacities and clinical assumptions. Placement policy changes; no real-world benefit or reduction in infections is claimed."}
        result.pop("resultSha256", None)
        result["resultSha256"] = hashlib.sha256(json.dumps(result, sort_keys=True, allow_nan=False).encode()).hexdigest()
        return result
    except HTTPException:
        raise
    except SeasonalArtifactError as error:
        raise HTTPException(503, detail={"code": "SEASONAL_ARTIFACTS_UNAVAILABLE", "message": str(error)}) from None
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None
