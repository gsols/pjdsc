# UPRI-NOAH source audit — 24 October 2026

Audit completed before preprocessing or fitting new models. `scripts/audit_upri.py`
records the full reproducible findings in `data/processed/upri_noah/audit.json`.
Raw files are unchanged. All six match Git blobs at upstream commit
`02926278d570db8950da368d44db544ae0097615`; SHA-256 and original URLs are in
`data/reference/upri_noah/sources.json`.

Read: original README, embedded Data Dictionary and Dataset Summary, original
15-stage R validation workflow, and all 36 sheets of the upstream validation
report (downloaded separately to `data/reference/upri_noah/`). R is unavailable
locally: the upstream R workflow has **not** been rerun. Independent Python
schema/completeness checks are separately identified.

Discrepancies and decisions:

- QC: 832 source blocks (2010–2025); NCR: 416 (2016–2019, 2022–2025).
  NCR 2020–2021 remain missing, never zero. Existing QA row counts and selected
  weather missingness agree, but it omits several quality flags.
- `WN` dictionary says ISO, while summary/R say 52 blocks with rare 53rd blocks
  folded into 52. Legacy scripts convert to ISO Mondays and introduce artificial
  week-53 gaps. New integration uses source `(YR, WN)` ordinal blocks and does
  not assert exact dates. Simulation days are relative to the replay origin.
- `RF_PAGASA` is absent from the current dictionary. Preserve its name and nulls.
  The upstream report also reports missing `SETTING` / extra `COUNTRY`, which
  does **not** hold for the current dictionary. Its `*_ERA5` field names differ
  from current `*_ERA5-Land`. Report is version-stale, not a clean bill of health.
- Annual barangay known subtotals differ from city weekly sums in all 16 years.
  Examples: 2024 annual 9,437 vs weekly 8,576; 2025 annual 11,548 vs weekly
  11,107. These are separate source observations; no reconciliation correction
  is justified. Annual missing-cell counts and each difference are in the audit.
  `DC_Mean` agrees with the mean of nonmissing years; it must not be used for
  historical replay weights because it includes future years.
- The split archive contains `DC_Regional-Brgy.gpkg`, despite README describing
  shapefiles. The existing reference GeoPackage requires byte/hash comparison
  against a fresh extraction. They match SHA-256 exactly. All 142 polygons are
  valid in EPSG:32651. Two source polygons (Doña Imelda, Doña Josefa) have null
  IDs; 140 join directly. Their CSV names also contain UTF-8 mojibake, preserved
  in source records and explicitly recorded in the crosswalk. An explicit project
  crosswalk identifies the remaining two through unique names after reversible
  CSV encoding repair. Both source geometry rows also lack **all** annual case
  attributes; they cannot validate the CSV counts. The other 140 joins match all
  16 annual columns exactly, including nulls. Derived GeoJSON retains
  `sourceADM4_PCODE: null` for the two project name crosswalks.
  The official raw attributes are unchanged; these two IDs are project-derived.
- Stored benchmark/model summaries have no source checksum; their numerical
  performance is unverified for this source version. Preserve those experiments
  and publish new evidence separately. No model-selection claim uses those
  reports as untouched prospective validation.
- Publication delays and historical source vintages are unavailable. Retrospective
  observed-through-block availability is an explicit assumption. Calendar dating,
  live forecasting and claims of historically available warnings remain blocked.

The official annual table supports **observed annual counts**, without population
denominators. Weekly barangay observations do not exist here. Any within-QC
weekly split is a **modeled allocation**, using only complete prior annual years
and an explicit assumed availability lag. Cross-source total discrepancies
remain visible; annual weights do not establish valid weekly hotspot forecasts.

Hospital source remains the separately pinned 46-row PhilHealth inventory:
9,389 accredited beds, unknown dengue eligibility and staffed capacity, zero
verified entrances. A replay may use individually selected hospitals only under
explicit hypothetical eligibility/capacity assumptions; the 2026 register is
not evidence that those hospitals/capacities existed at a historical origin.

Source: Matavia et al. (2026), *Weekly dengue incidence linked to meteorological
variables at city, regional, and multi-setting scales*, [upstream repository](https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615).
ODC-ODbL 1.0 attribution/share-alike applies to derived database releases.
The README cites DOI 10.5281/zenodo.19448854; that record currently describes an
older satellite-rainfall version, so the exact Git commit/hashes identify these
local inputs instead of claiming the DOI certifies their bytes.
