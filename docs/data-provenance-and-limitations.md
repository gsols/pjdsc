# Data provenance, source reconciliation, ethical use, limitations and citations

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

## Audited files (uploaded `pjdsc-main.zip`)

| Repository file | Actual status / interpretation | Must not be called |
|---|---|---|
| `apps/web/public/data/ncr-cities.geojson` | 17 normalized NCR city/municipality polygons; inspect original attribution and positional precision | Barangay polygons |
| `apps/web/public/data/facilities.json` | 165 NHFR NCR hospital records; 41 QC; 29 historical provisional QC point candidates; QC sum of stored `authorizedBeds`: 7,068; 2 QC missing beds | Live staffed/empty dengue beds; verified all QC facilities |
| `data/processed/hospital_coordinate_review.csv` | 165 potential matches to historic coordinate dataset, human review fields not filled | Independently verified coordinates |
| `data/processed/qc_coordinate_candidates.json` | QC coordinate review candidates with name/area comparisons | Verified hospital GPS entry points |
| `data/reference/historical_hospital_coordinate_candidates.json` | Historical secondary coordinate dataset | Official current facility locations or bed capacity |
| `apps/web/public/data/forecast-validation.json` | Historical one-step holdout report, QC/NCR | 2026 live predictions, 4-week production skill |
| `services/engine/models/{validation_report,four_week_backtest,rolling_backtest,autoets_backtest,data_quality_report}.json` | Historical QA/benchmark outputs; source workbook not included | Implemented deployable inference service |
| `services/engine/models/*.joblib` | Files referenced in training script but **absent** from upload | Available ready-to-run model artifacts |
| QC annual barangay table + polygons | **Absent** from upload | Observable weekly barangay dengue surveillance |

The updated delivery **includes and selects** the PhilHealth 46-row QC hospital/infirmary register (9,389 **accredited** beds, 46 provisional point coordinates) as the active QC admission hospital dataset. The older 41-QC/165-NCR DOH NHFR extract is retained for entity crosswalk and archival evidence, not used for active QC simulation or mapped hospital pool. Different coverage and bed definitions remain expected; never sum the two inventories. See `docs/hospital-dataset-source-of-truth.md`.

## Recommended source-of-truth policy
1. Maintain each source independently with `datasetId`, `publisher`, `sourceURL`, `publicationDate`, `retrievedAt`, `referencePeriod`, `version`, `fileSHA256`, `license`, `schemaVersion`, `geographicScope`, `units`, `knownLimitations`.
2. For NHFR facility metadata use DOH facility code, service classification and declared as-of dates. For PhilHealth accreditation use its distinct accreditation/register ID and date. Only reconcile with verified facility-level crosswalk and documented matching confidence/reviewer. Account for renamed, relocated and differently licensed branches.
3. A raw DOH column called `Bed Capacity` is not automatically evidence of *authorized* or *implemented* bed status unless official metadata/definitions say so. Where unresolved, show `NHFR reported beds (definition under review)`; keep original raw value and field name.
4. Facility `licenseValidUntil` may be old (some stored examples show `01/01/2025`). This by itself neither proves currently licensed nor proves closed. Display the field's vintage and avoid implying current status.
5. A candidate exact name/PSGC/barangay coordinate match is still provisional. Verify facility location/entrance with authoritative current source before routing. Keep `verifiedAt = null` until evidence documented.
6. Annual QC barangay historical totals are observed once imported and verified, but allocations of weekly projected QC cases are **not observed** barangay forecasts.
7. No public patient-level identifying data should be collected. All simulation metrics must be aggregate and cannot instruct real individual care/referrals.

## Data dictionary target
Prepare reviewed facility-level fields:

`nhfrCode`, `philhealthId?`, `nameOfficial`, `aliases[]`, `regionPSGC`, `cityPSGC`, `barangayPSGC`, `facilityType`, `ownership`, `serviceCapability`, `address`, `latitude?`, `longitude?`, `coordinateStatus`, `coordinateSource`, `coordinateReviewedAt?`, `nhfrReportedBedCapacity?`, `accreditedBeds?`, `authorizedBeds?`, `implementedBeds?`, `normalStaffedCapacity?`, `activatedSurgeBeds?`, `verifiedDengueServiceEligible?`, `licenseValidUntil?`, `sourceRecordDate`, `sourceURLs[]`, `fieldEvidence`, `reviewNotes`.

Do not store calculated `normalStaffedCapacity` or `activatedSurgeBeds` as immutable facts when their values came from scenario assumptions; store them under an identified `scenarioAssumptions` object with auditable formulas.

## Upstream links for provenance manifest
- DOH NHFR active facilities: https://nhfr.doh.gov.ph/VActivefacilitiesList
- PhilHealth accredited providers: https://www.philhealth.gov.ph/partners/providers/facilities/accredited/
- Historical hospital candidates: https://github.com/ljyflores/facility-location-philippines/blob/master/data/Hospitals.csv
- UPRI-NOAH publisher dataset: check the **actual downloaded Zenodo record/version/DOI** and cite it precisely; source workbook is not present for hash validation in this upload.
- QC government health information: https://quezoncity.gov.ph/departments/city-healthdepartment/

All URLs are **source pointers, not proof of current values**. For APA 7 cite each source with author organization, published year/date if verified, title, version/format, publisher and stable URL/DOI; for undated pages use `n.d.` and access/retrieval information only as appropriate. Do not copy a prior assistant's DOI or numeric claims into a publication without checking the actual version metadata.

## Honest evaluation and impact statements
- Forecast historical holdout results can support retrospective prediction skill **only** under documented leakage-safe test conditions.
- 2025 outbreak replay can test advance-warning timing; it cannot validate facility-level admissions without measured facility admissions.
- Scenario optimization may decrease **modeled** unmet admission demand vs modeled baseline; absent operational data, cannot prove reduced deaths, admissions delays or actual LGU savings.
- Over-100% normal capacity pressure is plausible and supported by documented hospital practices elsewhere, but any particular 107%/200%/700% figure requires hospital/date/bed-denominator verification before use as a QC calibration parameter.
- If source inputs or licensure/eligibility are unverifiable, show missingness and sensitivity rather than imputing a certain truth.
