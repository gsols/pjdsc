# PJDSC / Codex instructions + replacement PhilHealth hospital dataset

This update is designed for the existing `pjdsc-main/` repository with `apps/web/`, `services/engine/`, `scripts/`, `data/processed/` and `data/reference/`. It contains **updated Markdown instructions and the chosen active hospital dataset**, not implemented application source-code changes. Read `docs/hospital-dataset-source-of-truth.md` before using it.

## Installation

1. Back up existing `AGENTS.md` files if you have edited them.
2. Extract this entire bundle **directly into `pjdsc-main/`** (no extra wrapper directory). Merge any pre-existing instructions deliberately. All files here use actual project-relative paths.
3. The ZIP **does not overwrite** the old `apps/web/public/data/facilities.json`. The old NHFR file remains in your repo only for auditing. **The current code will continue to use the old NHFR data until Codex edits the frontend fetch and backend loader.** The Markdown instructions explicitly require that migration; a ZIP alone cannot rewire code.
4. In Codex opened at root, execute `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` **first**, then `prompts/START_WITH_CODEX.md`, followed by forecasting, hotspot and surge tasks.

## Expected directory files

```text
pjdsc-main/
  AGENTS.md
  apps/web/AGENTS.md
  apps/web/public/data/qc-philhealth-hospitals.json       # ACTIVE: 46 QC hospital/infirmary records
  apps/web/public/data/qc-philhealth-hospitals.geojson    # all 46 provisional coordinates
  apps/web/public/data/qc-philhealth-admissions.json      # 116-record directory; includes separate maternity group
  apps/web/public/data/facilities.json                    # LEGACY: old NHFR, DO NOT use in QC simulation
  services/engine/AGENTS.md
  scripts/AGENTS.md
  data/AGENTS.md
  data/processed/qc_philhealth_admissions_2026_09_30.csv
  data/processed/qc_philhealth_admissions_2026_09_30_REVISED.xlsx # optional human-friendly workbook
  data/processed/qc_hospital_geocode_audit_2026_10_24.csv
  data/processed/qc_philhealth_manifest_2026_10_24.json
  docs/hospital-dataset-source-of-truth.md
  docs/... (other updated technical docs)
  prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md
  prompts/START_WITH_CODEX.md
  prompts/... (other task prompts)
```

## Audited inventory

- Official PhilHealth hospital/infirmary source: **2026-09-30**; **46 QC hospital/infirmary source entries; 9,389 accredited beds**.
- **46/46** hospitals have candidate coordinates and each plotted point is inside the repository's QC municipal polygon. **0/46 are independently verified emergency entrances.** Locations are provisional, largely old geocodes or OSM feature points, each with source evidence.
- The 116-row directory also includes **70 non-hospital maternity/public lying-in records**, but **only 3/70** have provisional coordinates; the other 67 cannot be plotted as exact facility points. None belong to dengue inpatient allocation automatically.
- The main five reviewed hospital coordinate fixes are HOSP-621, HOSP-626, HOSP-627, HOSP-649, and HOSP-654. The two Dr. Montano source branches remain distinct; San Lorenzo was corrected from a point outside QC.
- The old **165 NCR / 41 QC NHFR** extract stays archival only, and its stored bed figures **must not** enter the active QC sum or any default hospital simulation.

## What this does not establish

No live hospital vacancies, currently staffed beds, verified dengue-admitting services, verified operating hours, ambulance routing entrances, or 2026 real-time hospital census. Source bed capacity must not be mistaken for dengue capacity; the simulator must use explicitly declared and tested planning assumptions.

## Verification and release

Run the proposed tests from `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md`. New data pass offline structural/geographic checks; this bundle **has not** implemented the frontend/backend migration or run your full web application build. The existing UPRI-NOAH workbook and historical model artifacts remain separate inputs not included here.
