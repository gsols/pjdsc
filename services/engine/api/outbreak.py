"""Validated, immutable map movies from approved historical QC reference runs."""
from datetime import date, datetime, timezone, timedelta
import hashlib
import json
import platform
import shapely
import pyproj
import scipy
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import Field, model_validator

from .research import StrictModel, FacilityAssumption, forecast, annual_data, unavailable
from ..domain import outbreak, patient_flow, spatial, optimizer
from ..domain.outbreak import make_context, build_movie, VERSION
from ..repositories.facility import load_facilities, DATASET_ID, HOSPITAL_SHA256
from ..repositories.forecast_runs import FOLDER, load_runs, load_environmental_runs
from ..upri_data import ROOT, sha256

router = APIRouter(prefix="/v1")


@router.get("/outbreak-demo")
def illustrative_movie():
    """Named server-configured hypothetical preset, never a real vacancy network."""
    try:
        runs = load_runs("QUEZON_CITY")
        run = next((r for r in runs if r["issueBlock"] == {"YR": 2025, "WN": 4}), runs[0])
        geo = inputs(run["id"], 2025)[1]
        seed = max(geo["barangays"], key=lambda b: b["weight"])
        return create_movie(OutbreakInput(
            forecastRunId=run["id"], scenarioKind="hypothetical_shock",
            acknowledgeHypotheticalHospitalNetwork=True, acknowledgeHypotheticalDates=True,
            startDate="2025-01-27", endDate="2025-02-24", seedBarangayId=seed["id"],
            extraCasesPerWeek=700, initialRadiusKm=.5, expansionKmPerDay=.35, growthDays=14,
            shockProfile="ramp", hospitalizationRate=.15, lengthOfStayDays=4, baselineOccupancy=.75,
            admissionDelayDays=0, surgeActivationDay=7,
            facilities=[FacilityAssumption(facilityId=h["facilityId"], assumedDengueEligible=True,
                normalCapacity=20, surgeCapacity=10, holdingCapacity=5) for h in seed["nearestHospitals"]]))
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        raise unavailable() from None


class OutbreakInput(StrictModel):
    forecastRunId: str = Field(min_length=1, max_length=120)
    scenarioKind: Literal["hypothetical_shock", "historical_replay"]
    autoHotspots: bool = False
    allocationPolicy: Literal["nearest", "optimized"] = "nearest"
    acknowledgeHypotheticalHospitalNetwork: Literal[True]
    acknowledgeHypotheticalDates: Literal[True]
    startDate: date
    endDate: date
    seedBarangayId: str = Field(pattern=r"^PH1307404\d{3}$")
    extraCasesPerWeek: float = Field(ge=0, le=100000)
    initialRadiusKm: float = Field(ge=.1, le=20)
    expansionKmPerDay: float = Field(ge=0, le=5)
    growthDays: int = Field(strict=True, ge=1, le=28)
    shockProfile: Literal["step", "ramp"]
    hospitalizationRate: float = Field(ge=0, le=1)
    lengthOfStayDays: int = Field(strict=True, ge=1, le=30)
    baselineOccupancy: float = Field(ge=0, le=1)
    admissionDelayDays: int = Field(strict=True, ge=0, le=28)
    surgeActivationDay: int = Field(strict=True, ge=0, le=28)
    facilities: list[FacilityAssumption] = Field(min_length=1, max_length=46)

    @model_validator(mode="after")
    def validate_dates(self):
        if not 1 <= (self.endDate - self.startDate).days <= 28:
            raise ValueError("Choose an end date 1–28 elapsed days after onset.")
        if not 2012 <= self.startDate.year <= 2035:
            raise ValueError("Scenario onset must be between 2012 and 2035; future dates remain hypothetical.")
        if self.scenarioKind == "historical_replay" and self.extraCasesPerWeek != 0:
            raise ValueError("Historical reference mode cannot contain a hypothetical added shock.")
        return self


def inputs(ident, cutoff_year=None):
    run = forecast(ident)
    if run["area"] != "QUEZON_CITY":
        raise HTTPException(422, detail={"code": "QC_DEMAND_REQUIRED", "message": "Spatial movies require QC demand, not NCR totals."})
    manifest = json.loads((FOLDER / "manifest.json").read_text())
    path = ROOT / "apps/web/public/data/qc-barangays.geojson"
    if sha256(path) != manifest["outputs"][path.relative_to(ROOT).as_posix()]:
        raise ValueError("Geometry checksum mismatch")
    hospitals = load_facilities()
    try:
        context = make_context(run, annual_data()["records"], json.loads(path.read_text()), hospitals, cutoff_year)
    except ValueError as error:
        if "No complete annual year" in str(error):
            raise HTTPException(422, detail={"code": "ANNUAL_WEIGHTS_UNAVAILABLE", "message": "No complete annual burden year is available before this scenario cutoff. Choose a later hypothetical onset; missing counts cannot be treated as zero."}) from None
        raise
    return run, context, manifest


@router.get("/outbreak-context/{ident}")
def context(ident: str):
    try:
        return inputs(ident)[1]
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None


@router.post("/outbreak-scenarios")
def create_movie(params: OutbreakInput):
    try:
        run, geo, manifest = inputs(params.forecastRunId, params.startDate.year)
        approved = {h["id"] for h in geo["hospitals"]}
        ids = [f.facilityId for f in params.facilities]
        if len(set(ids)) != len(ids) or not set(ids).issubset(approved):
            raise HTTPException(422, detail={"code": "INVALID_FACILITY_SELECTION"})
        if params.seedBarangayId not in {b["id"] for b in geo["barangays"]}:
            raise HTTPException(422, detail={"code": "UNKNOWN_QC_BARANGAY"})
        parameters = params.model_dump(mode="json")
        parameters["facilities"] = sorted(parameters["facilities"], key=lambda f: f["facilityId"])
        identity = {"parameters": parameters, "methodVersion": VERSION, "facilityDatasetId": DATASET_ID,
            "softwareVersions": {"python": platform.python_version(), "shapely": shapely.__version__, "pyproj": pyproj.__version__, "scipy": scipy.__version__},
            "facilitySourceSha256": HOSPITAL_SHA256, "forecastArtifactSha256": sha256(FOLDER / "forecast-runs.json"),
            "environmentalForecastSha256": sha256(FOLDER / "qc-environmental-forecasts.json") if run["model"] == "cases_weather" else None,
            "referenceSourceSha256": run["sourceSha256"], "sourceHashes": manifest["outputs"],
            "codeHashes": {name: sha256(module.__file__) for name, module in [("outbreak", outbreak), ("patient_flow", patient_flow), ("spatial", spatial), ("optimizer", optimizer)]}}
        ident = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        folder = FOLDER / "scenarios/movies"
        target = folder / (ident + ".json")
        if target.exists():
            return saved_movie(ident)
        config = params.model_dump()
        config["facilities"] = sorted(config["facilities"], key=lambda f: f["facilityId"])
        result = {"schemaVersion": "1.0", "scenarioId": ident, **identity, **build_movie(run, geo, config),
            "runTimestamp": datetime.now(timezone.utc).isoformat(), "seed": None,
            "randomness": "Deterministic expected values; no stochastic draws", "geography": "QUEZON_CITY",
            "units": {"cases": "expected reported cases per daily interval", "patients": "expected patients", "distance": "km straight line"}}
        result["resultSha256"] = hashlib.sha256(json.dumps(result, sort_keys=True, allow_nan=False).encode()).hexdigest()
        folder.mkdir(parents=True, exist_ok=True)
        temp = folder / (uuid4().hex + ".tmp")
        temp.write_text(json.dumps(result, allow_nan=False), encoding="utf-8")
        try:
            # Exclusive publication of a fully written artifact: concurrent identical
            # requests cannot replace the first run's timestamp or result checksum.
            target.hardlink_to(temp)
        except FileExistsError:
            return saved_movie(ident)
        finally:
            temp.unlink(missing_ok=True)
        return result
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None


@router.get("/outbreak-scenarios/{ident}")
def saved_movie(ident: str):
    if len(ident) != 64 or any(c not in "0123456789abcdef" for c in ident):
        raise HTTPException(404, detail={"code": "SCENARIO_NOT_FOUND"})
    path = FOLDER / "scenarios/movies" / (ident + ".json")
    if not path.exists():
        raise HTTPException(404, detail={"code": "SCENARIO_NOT_FOUND"})
    try:
        result = json.loads(path.read_text())
        expected = result.pop("resultSha256")
        if hashlib.sha256(json.dumps(result, sort_keys=True, allow_nan=False).encode()).hexdigest() != expected:
            raise ValueError("Saved movie checksum mismatch")
        if result["forecastArtifactSha256"] != sha256(FOLDER / "forecast-runs.json"):
            raise ValueError("Forecast version changed")
        if result.get("environmentalForecastSha256") and result["environmentalForecastSha256"] != sha256(FOLDER / "qc-environmental-forecasts.json"):
            raise ValueError("Environmental forecast version changed")
        # Revalidate all canonical inputs, including polygon and annual table hashes.
        _, _, manifest = inputs(result["parameters"]["forecastRunId"], date.fromisoformat(result["parameters"]["startDate"]).year)
        if result["sourceHashes"] != manifest["outputs"] or result["scenarioId"] != ident:
            raise ValueError("Saved movie source version mismatch")
        result["resultSha256"] = expected
        return result
    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise unavailable() from None
