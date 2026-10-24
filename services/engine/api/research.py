"""Versioned historical research endpoints. Legacy simulation stays guarded."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..domain.patient_flow import simulate_flow
from ..domain import patient_flow
from ..domain.spatial import allocate, annual_backtest
from ..repositories.facility import DATASET_ID, load_facilities
from ..repositories.forecast_runs import artifact, load_run, load_runs, FOLDER, ForecastRunNotFound
from ..upri_data import ROOT, sha256

router = APIRouter(prefix="/v1")


def unavailable():
    return HTTPException(503, detail={"code": "RESEARCH_DATA_UNAVAILABLE", "message": "Audited historical inputs failed validation. Rebuild integration artifacts; no fallback."})


@router.get("/forecast-runs")
def forecasts(area: Literal["QUEZON_CITY", "NCR"] = "QUEZON_CITY"):
    try:
        return {"schemaVersion": "1.0", "runs": load_runs(area)}
    except (OSError, ValueError, KeyError, TypeError, ForecastRunNotFound):
        raise unavailable() from None


@router.get("/forecast-runs/{ident}")
def forecast(ident: str):
    try:
        return load_run(ident)
    except ForecastRunNotFound:
        raise HTTPException(404, detail={"code": "FORECAST_NOT_FOUND"}) from None
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None


def annual_data():
    manifest = json.loads((FOLDER / "manifest.json").read_text())
    path = ROOT / "apps/web/public/data/qc-annual-burden.json"
    if sha256(path) != manifest["outputs"][path.relative_to(ROOT).as_posix()]:
        raise ValueError("Annual data mismatch")
    return json.loads(path.read_text())


@router.get("/research-evidence")
def evidence():
    try:
        return {"schemaVersion": "1.0", "audit": artifact("audit.json"),
            "backtest": artifact("backtest.json"), "annualBacktest": annual_backtest(annual_data()["records"])}
    except (OSError, ValueError, KeyError, TypeError, ForecastRunNotFound):
        raise unavailable() from None


@router.get("/spatial-allocations/{ident}")
def spatial(ident: str):
    run = forecast(ident)
    if run["area"] != "QUEZON_CITY":
        raise HTTPException(422, detail={"code": "QC_ONLY_ALLOCATION"})
    try:
        return allocate(run, annual_data()["records"])
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class FacilityAssumption(StrictModel):
    facilityId: str = Field(pattern=r"^HOSP-\d{3}$")
    assumedDengueEligible: Literal[True]
    normalCapacity: int = Field(strict=True, ge=1, le=10000)
    surgeCapacity: int = Field(strict=True, ge=0, le=10000)
    holdingCapacity: int = Field(strict=True, ge=0, le=10000)


class ScenarioInput(StrictModel):
    forecastRunId: str = Field(min_length=1, max_length=120)
    scenarioKind: Literal["historical_replay"]
    acknowledgeHypotheticalHospitalNetwork: Literal[True]
    hospitalizationRate: float = Field(ge=0, le=1)
    lengthOfStayDays: int = Field(strict=True, ge=1, le=30)
    baselineOccupancy: float = Field(ge=0, le=1)
    admissionDelayDays: int = Field(strict=True, ge=0, le=28)
    surgeActivationDay: int = Field(strict=True, ge=0, le=28)
    facilities: list[FacilityAssumption] = Field(min_length=1, max_length=46)


@router.post("/scenarios")
def scenario(params: ScenarioInput):
    run = forecast(params.forecastRunId)
    if run["area"] != "QUEZON_CITY":
        raise HTTPException(422, detail={"code": "QC_DEMAND_REQUIRED", "message": "NCR demand cannot be assigned to QC hospitals."})
    try:
        approved = {f["id"] for f in load_facilities()}
        ids = [f.facilityId for f in params.facilities]
        if len(set(ids)) != len(ids) or not set(ids).issubset(approved):
            raise HTTPException(422, detail={"code": "INVALID_FACILITY_SELECTION"})
        config = params.model_dump()
        identity = {"parameters": config, "forecastArtifactSha256": sha256(FOLDER / "forecast-runs.json"),
            "facilityDatasetId": DATASET_ID, "methodVersion": "expected-cohort-28d-v1",
            "simulationCodeSha256": sha256(patient_flow.__file__), "assumptionVersion": "explicit-hospital-capacity-v1"}
        ident = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        days = simulate_flow([p["meanCases"] for p in run["weeklyPredictions"]],
            sorted(config["facilities"], key=lambda f: f["facilityId"]), params.hospitalizationRate,
            params.lengthOfStayDays, params.baselineOccupancy, params.admissionDelayDays, params.surgeActivationDay)
        target = FOLDER / "scenarios" / (ident + ".json")
        if target.exists():
            return saved_scenario(ident)
        result = {"schemaVersion": "1.0", "scenarioId": ident, **identity, "measurementKind": "modeled_allocation",
            "runTimestamp": datetime.now(timezone.utc).isoformat(), "seed": None, "randomness": "deterministic expected-value cohorts; no stochastic draws",
            "calendarStatus": run["calendarStatus"], "forecastSourceSha256": run["sourceSha256"],
            "units": "expected patients", "capacityMeasurementKind": "assumption", "days": days,
            "assumptions": "Uniform cases across each 7-day source block; fixed delay and LOS; zero initial dengue census; constant assumed non-dengue occupancy; fixed-ID assignment; no transfers; unplaced demand exits as unresolved. No optimizer implemented.",
            "disclaimer": "Historical source-block research replay with hypothetical eligibility/capacity and a 2026 hospital inventory. Relative days are not verified calendar dates. No observed admissions, vacancy or referral claims."}
        folder = FOLDER / "scenarios"
        folder.mkdir(exist_ok=True)
        temp = folder / (ident + "-" + uuid4().hex + ".tmp")
        temp.write_text(json.dumps(result, allow_nan=False), encoding="utf-8")
        temp.replace(folder / (ident + ".json"))
        return result
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None


@router.get("/scenarios/{ident}")
def saved_scenario(ident: str):
    if len(ident) != 64 or any(c not in "0123456789abcdef" for c in ident):
        raise HTTPException(404, detail={"code": "SCENARIO_NOT_FOUND"})
    try:
        result = json.loads((FOLDER / "scenarios" / (ident + ".json")).read_text())
        # Revalidate approved source context before returning saved results.
        params = ScenarioInput.model_validate(result["parameters"])
        load_run(params.forecastRunId)
        load_facilities()
        identity = {key: result[key] for key in ["parameters", "forecastArtifactSha256", "facilityDatasetId", "methodVersion", "simulationCodeSha256", "assumptionVersion"]}
        if result["simulationCodeSha256"] != sha256(patient_flow.__file__):
            raise ValueError("Saved scenario engine version mismatch")
        if result["forecastArtifactSha256"] != sha256(FOLDER / "forecast-runs.json") or hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest() != ident:
            raise ValueError("Saved scenario source identity mismatch")
        return result
    except FileNotFoundError:
        raise HTTPException(404, detail={"code": "SCENARIO_NOT_FOUND"}) from None
    except (OSError, ValueError, KeyError, TypeError, ForecastRunNotFound):
        raise unavailable() from None
