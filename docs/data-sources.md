# Data sources and ingestion contract

## Active QC hospitals

The canonical file is `apps/web/public/data/qc-philhealth-hospitals.json`, version `PHIC_QC_HOSP_2026_09_30_GEO_REVIEW_2026_10_24`. Its pinned SHA-256 is `929cbeb97a0edffdfeb8257ad5857347b9b56661004dbdaa364f4873fbd620c5`; the processed manifest records this identity and companion artifact hashes. Both frontend and backend reject a mismatched canonical file. No legacy fallback is allowed.

The shipped September 30, 2026 register extract contains 46 QC hospital/infirmary rows and 9,389 **accredited** beds. Operational/staffed capacity and dengue admission eligibility remain null. Each coordinate has source evidence; all 46 are provisional, with zero independently verified entrances. The adapter maps OSM and third-party evidence into the stable provisional coordinate status while retaining the original evidence status. HOSP-626 and HOSP-627 are distinct Montano branches. Source-row project IDs are not official accreditation numbers. One raw row contains an hours string; it is not used to assert verified operations.

Philippine Health Insurance Corporation. (2026, September 30). *Accredited hospitals and infirmaries* [Register]. https://www.philhealth.gov.ph/partners/providers/facilities/accredited/HOSP_093026.pdf

This citation follows the supplied artifact metadata; no fresh upstream retrieval is claimed. Individual point-evidence URLs remain attached to each source row. See `hospital-dataset-source-of-truth.md` and `data/processed/qc_hospital_geocode_audit_2026_10_24.csv` for coordinate corrections and caveats. Do not use these points as verified ambulance-routing entrances.

## Separate supplemental directory and legacy registry

The 116-row admissions/lying-in directory includes the 46 active hospitals plus 70 supplementary maternity/public lying-in records. Only 3 of those 70 supplementary sites have provisional coordinates. These records are excluded from the active dengue inpatient network, and their unknown beds must not be represented as zero or added to hospital totals.

`apps/web/public/data/facilities.json` retains the legacy DOH/NHFR 165-NCR / 41-QC extract solely for audit and reviewed crosswalks. Its raw `Bed Capacity` meaning has not been independently established as authorized capacity. Preserve original IDs and source fields; do not use its old `authorizedBeds` naming as proof of a regulatory definition. Existing NHFR import/matching scripts remain archival workflows.

## NCR city/municipality boundaries

`apps/web/public/data/ncr-cities.geojson` is already imported: 17 normalized city/municipality polygons including Pateros, exposed by `/api/boundaries` using `properties.area_id`. These are city polygons, not QC barangay geometry. Preserve existing attribution. The earlier ingestion pointer was https://github.com/faeldon/philippines-json-maps; confirm the exact original geometry version/license before redistribution claims.

## Cases, weather and model evaluation

**2026-10-24 20:14:55 +08:00 workspace revision:** the automatic QC UI now uses
the separate `qc-environmental-forecasts.json` / `qc-environmental-manifest.json`
artifacts. Case history and lagged city rainfall/temperature/humidity feed the
city forecast; fixed prior annual weights allocate it spatially. Experimental
80%-target ranges use only completed pre-origin joint residual paths and achieve
50–62.5% observed weekly coverage on eight retrospective origins/horizon. This
shortfall and omitted spatial uncertainty are displayed. The Philippines context
derivative contains 17 name/ID/polygon features with **no regional case values**;
it is not an NCR-wide simulation source. See `qc-simulation-workspace.md`.

The official workbook is now present under `data/raw/upri_noah/`, with 832 QC
blocks and 416 NCR records from the Regional Data sheet. All six local raw files
match Git blobs at commit `02926278d570db8950da368d44db544ae0097615` of
https://github.com/pelitro-rcw/dengue-environmental-dataset. Original URLs,
SHA-256s and commit verification are in `data/reference/upri_noah/sources.json`.
The original README declares ODC-ODbL 1.0; retain attribution/share-alike and
upstream surveillance/weather terms for derivatives. No 2026 live source exists.

The original README, Data Dictionary, Dataset Summary, R validation workflow,
and all 36 upstream validation report sheets were read before processing. The
report is stale against current dictionary/weather names; the R script was not
rerun because R is unavailable. See [pre-training audit](upri-integration-audit.md).
New Python source checks do not claim to reproduce all environmental validation.

The annual barangay CSV covers 142 rows, 2010–2025 with original nulls. Every
annual total differs from summed city weekly cases. Never overwrite either or
treat annual data as weekly observations. The split archive contains a GeoPackage,
not shapefiles. Its hash exactly matches `data/reference/DC_Regional-Brgy.gpkg`.
All 142 QC polygons are valid EPSG:32651 geometry, transformed to EPSG:4326.
140 IDs join directly and match every annual attribute; two source polygons lack
IDs/all annual attributes. Their IDs are explicit project name crosswalks with
raw null IDs preserved. Source CSV mojibake names are retained.

`data/processed/upri_noah/manifest.json` records transforms and output hashes.
New expanding-origin 1–4-source-block backtests and approved replay predictions
are separate from legacy reports. Original `(YR,WN)` is retained: conflicting
week definitions prevent verified calendar dates. Historical publication delays
are unknown and assumed; replay is not an originally published forecast.
Annual weights use only complete prior years with one extra full year of assumed
availability lag and add-one smoothing. An annual distribution holdout comparison
is available via research evidence; it is not weekly hotspot validation.

## Simulation

The versioned `/v1/scenarios` endpoint now consumes server-approved QC source-block
replay runs. It requires explicit hypothetical eligibility, normal/surge/holding
capacities and admission/occupancy/LOS/delay assumptions. It simulates expected
fractional patients over relative days 0–28, conserves arrivals/discharges/census/
holding/unresolved demand, and persists reproducible results. It does not use
accredited beds as capacity. The 2026 PhilHealth network is a hypothetical planning
network, not proof of past hospital operations. NCR demand is rejected. Legacy
simulation routes remain guarded. No optimizer, clinical calibration, admission
uncertainty intervals or live vacancies are implemented.
