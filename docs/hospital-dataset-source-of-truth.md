# Hospital dataset source-of-truth — mandatory QC policy (2026-10-24)

## Binding decision: NEW PhilHealth QC inventory REPLACES NHFR as the active QC hospital input

**Do not use `apps/web/public/data/facilities.json` for Quezon City hospital maps, admission capacity, allocation, facility counts, or hospital simulation.** That file is a prior DOH/NHFR **NCR-wide** extract (165 records, 41 QC) and is **legacy crosswalk/audit input only**, never an active QC feed. Do not add its beds to the PhilHealth values. This is an explicit project source-selection decision, not an assertion that PhilHealth is a more authoritative source of current operational beds. If/when an NCR-wide hospital network is developed, acquire/verify a separate NCR source with clear definitions. For now, the NCR city geometry layer stays functional, but no unsupported NCR-wide hospital-pressure claim is allowed.

### Canonical shipped artifacts and consumers

| Project-relative file | Role | Required use |
|---|---|---|
| `apps/web/public/data/qc-philhealth-hospitals.json` | **ACTIVE 46-row QC hospital and infirmary registry** | QC hospital table and markers (after UI adapters); QC simulation reference IDs resolved by backend |
| `apps/web/public/data/qc-philhealth-hospitals.geojson` | Coordinates for all **46** active records; point coordinates are **provisional** | QC-only MapLibre markers; no claim of verified entrances |
| `data/processed/qc_philhealth_admissions_2026_09_30.csv` | Source-traceable **116-row** full directory: 46 hospitals/infirmaries + 68 PhilHealth maternity providers + 2 additional QC government lying-in sites | Provenance and separately labeled maternity directory; never blindly add 70 to dengue hospital pool |
| `apps/web/public/data/qc-philhealth-admissions.json` | Same 116-row directory in typed JSON | Optional facility directory; not the default hospital simulator list |
| `data/processed/qc_hospital_geocode_audit_2026_10_24.csv` | Coordinate review trail for 46 hospitals | Document location evidence and future entrance verification |
| `data/processed/qc_philhealth_manifest_2026_10_24.json` | Dataset identity, SHA-256 hashes, source versions, caveats | Strict preflight / data version checking |
| `apps/web/public/data/facilities.json` | **LEGACY DOH/NHFR NCR** registry | Entity matching/comparative audit **only**; never as fallback if PhilHealth missing |

The IDs `HOSP-614`..`HOSP-659` are **local source-row identifiers**, not confirmed official PhilHealth accreditation numbers. The numeric PhilHealth column is `BEDS`, captured as `accreditedBeds` only; do not call these `authorizedBeds`, implemented, staffed, dengue-usable, free beds or simultaneous inpatient vacancies.

### Audit results and coordinate honesty

- The September 30, 2026 PhilHealth hospital/infirmary register lists **46 QC source rows** totaling **9,389 accredited beds**. All **46 hospital/infirmary records have a numeric latitude and longitude** in the updated package, and all 46 points fall inside the current project's QC municipal polygon in EPSG:4326. There are no duplicate *exact point pairs* among the 46. This establishes geocode **field completeness**, not physical entrance accuracy.
- Hospital coordinates: **13 provisional OSM point references, 32 provisional historical name/geocode matches, one other provisional third-party point**. **Zero independently verified hospital emergency entrances**. Render provisional marker treatment and disclose source in each facility detail. Use `[longitude, latitude]` in GeoJSON and MapLibre, `[latitude, longitude]` in clearly labeled tabular fields. Reject or quarantine out-of-bound and obviously ambiguous points.
- Corrections made (compared with earlier separate QC directory): `HOSP-621` Cruz-Dalida at 14.72329320, 121.04402290 (OSM via ProjectLIGTAS); `HOSP-626` Dr. Montano 143 Mindanao Ave at 14.67053080, 121.03208370 (OSM); `HOSP-627` **different Dr. Montano branch** 46 Bukidnon St at 14.65939000, 121.02360000 (OSM, corrected an apparent prior branch misassignment); `HOSP-649` San Lorenzo Hospital at 14.73573000, 121.06916000 (OSM; old historic point outside QC); `HOSP-654` Urology Center 62 Maginoo St at 14.64200100, 121.05361200 (third-party directory point, official hospital address independently confirmed). Source URLs are in each record. **Do not conflate the two Montano source rows**.
- Supplemental maternity and public lying-in facilities have **70 records; only 3 have provisional coordinates and 67 do not**. Do not claim all 116 are geocoded. Keep non-geocoded sites accessible by address and map lookup, without inventing point positions.
- Coordinates are representative facility point candidates, **not verified emergency entrances, travel-time origin/destinations, ambulance routes, or current service-operation guarantees**. For travel/routing, require stronger site/entrance review; if unavailable, show straight-line-distance research proxies with caveats. Coordinates must not decide real referrals.
- Classification of a facility as hospital, Level 3, public/private or OSM `amenity=hospital` **does not verify that the facility can admit dengue patients**. All `dengueInpatientEligible` are `null` until separately evidenced; require explicit simulated eligibility assumptions or a clinically reviewed eligible network.

### Sources and auditable geocodes

- PhilHealth hospital register (2026-09-30): https://www.philhealth.gov.ph/partners/providers/facilities/accredited/HOSP_093026.pdf
- PhilHealth maternity register (2026-09-30): https://www.philhealth.gov.ph/partners/providers/facilities/accredited/MCC_093026.pdf
- City Health Department additional lying-in sites: https://quezoncity.gov.ph/departments/city-healthdepartment/
- OSM evidence for Dr. Montano Mindanao: https://mapcarta.com/W923686671 ; Bukidnon: https://mapcarta.com/W525405920 ; San Lorenzo: https://mapcarta.com/W591766108
- Cruz-Dalida OSM coordinate relay: https://projectligtas.com/places/detail/10bf8b29-9938-4abf-80ac-dc8d6b9af6eb
- Urology Center current hospital address (primary): https://urologycenterphil.com/contact-us/ ; geocode candidate: https://www.yellowpages.net/phone-63-29903031-urologist-Quezon-City-PHEN323809.html
- Remaining records contain individually sourced coordinate URLs within JSON/CSV. Historical geocodes are *provisional* and sourced from https://raw.githubusercontent.com/ljyflores/facility-location-philippines/master/data/Hospitals.csv

### Implementation and migration contract

1. **Fail closed on missing canonical files**: never silently import old NHFR `facilities.json` when the PhilHealth file fails. Show explicit QC facility-data error and record the source mismatch.
2. Switch `apps/web/app/dashboard/page.tsx` from `fetch('/data/facilities.json')` to loading the **new QC PhilHealth hospital JSON** (`/data/qc-philhealth-hospitals.json`) for the QC hospital layer; update `apps/web/lib/types.ts` to carry `accreditedBeds` and coordinate evidence without renaming them as `authorizedBeds`. Adapt the map to distinguish provisional markers. If retaining NCR non-QC contextual places, use a separate named/context-only layer with explicit scope, never the old NHFR registry by default.
3. Backend must load the **same immutable dataset version** server-side from approved `data/processed/` path or the packaged JSON mirrored with SHA-256, *not* accept browser-submitted bed counts/coordinates. Validate unique `HOSP-` IDs, 46 rows, 9,389 accredited-bed sum, 46/46 finite coordinates, QC polygon containment, zero `VERIFIED` entrance claims. A mismatch is a version error, not a cue to fall back to old registry.
4. The simulator may display the sum of accredited beds as an inventory statistic. For capacity equations it must use separate, explicitly **scenario-assumed** `normalStaffedCapacity`, `eligibleDengueCapacity` and optional activated surge; do **not** default to full `accreditedBeds` as usable dengue capacity without assumption disclosure.
5. Keep maternity sites in a separate directory and outside the dengue inpatient optimizer unless **individual** verified dengue capability is added. No aggregation of beds from maternity records (they have no reliable published numeric bed column in this source).
6. Keep existing NHFR parsing/matching scripts for data comparison, but never have them overwrite the new active `qc-philhealth-hospitals.json` output or compute active QC bed totals.
7. Add regression checks for HOSP-626 versus HOSP-627 branch positions, San Lorenzo QC polygon correction, no absent hospitals, no duplicate exact active coordinates, non-verified statuses, and no active code path pointing to `/data/facilities.json` for the QC hospital pool.

**Scope note:** The replacement applies to the **QC hospital/infirmary admission dataset**, not to dengue surveillance (UPRI-NOAH), city polygons (NCR boundary GeoJSON), or a future separately justified NCR-wide hospital model.
