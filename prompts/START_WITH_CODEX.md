# START WITH CODEX — implementation orchestrator for the existing PJDSC repo

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

Paste the following into Codex while the **existing `pjdsc-main` repository root** is open (not a new repo). Read root `AGENTS.md`, scoped `AGENTS.md`s, and `docs/architecture-and-contracts.md`, `docs/data-provenance-and-limitations.md`, `docs/test-and-release-checklist.md` first.

## Assignment

Inspect the existing Next.js/MapLibre dashboard and FastAPI stub. **First migrate the active QC hospital dataset** to the supplied 46-record PhilHealth JSON using `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md`. The old 165-record NCR NHFR file remains legacy/crosswalk only. Preserve original scripts, 17-feature NCR geometry, and functioning UI.

1. **Audit, baseline, and mandatory PhilHealth migration:** List confirmed working modules, blocked modules, exact available data, versions and blockers. Run syntax/build checks possible in this environment, capture results; do not claim unavailable datasets or tools were tested.
2. **Typed contracts:** Implement versioned source/run/scenario Pydantic schemas and shared TypeScript response types. Bridge snake_case backend and camelCase frontend at the Next.js BFF boundary, preserving or clearly migrating existing `/api/simulate` error contract.
3. **One complete historical QC slice:** Take a **real dated** QC 1–4-week forecast run from the actual UPRI-NOAH workbook (or provide correct ingest command and blocked state if missing). Connect `services/engine` forecast-run store -> 28-day deterministic admissions/census simulation -> Next.js API -> current `/dashboard` with source, assumption, validation info. Build numerical tests before scaling. Never invent source data.
4. **Hotspots:** Execute `prompts/FORECASTING_AND_HOTSPOTS.md`. Add observed annual QC barangay layer and modeled disaggregation only when actual annual table + polygon identifiers are imported. Otherwise implement clearly disabled section and schema/tests, not fictional hotspot maps.
5. **Overflow + resource optimization:** Execute `prompts/SURGE_SIMULATION_AND_OPTIMIZATION.md`. Model supported staffed surge capacity, holding, unresolved demand, activation lag and fair optimization comparison; ensure >100% normal occupancy is possible without unlimited imaginary beds.
6. **Unexpected outbreak:** Execute `prompts/UNEXPECTED_OUTBREAK_RESPONSE.md` and the linked specification. Build a separate `/outbreak-response` route with 0–28 day timeline and 7/14/28 quick-select, historical reference vs declared hypothetical shock, resource-response comparisons and provenance.
7. **Deliver and verify:** Update stale `README.md`/`docs/data-sources.md` facts, add reproducible commands and tests, run backend + frontend checks that are available, report specific failed/skipped checks and source gaps. Preserve existing code and data unless justified by reproducible, reviewed changes.

## Execution rules
- Work phase-by-phase **implementing and running tests**, not just writing a plan. Identify blocking inputs once, write explicit import contracts and proceed with testable deterministic *synthetic fixtures* **only inside automated tests**; never label fixture results as real dashboard forecasts.
- You may refactor existing scripts to reusable backend modules but retain CLI entry points and deterministic historic experiments.
- Local project time zone for scenario display: `Asia/Manila`. Preserve source's epidemiological week semantics and exact forecast issue date.
- Use `apps/web/public/data/qc-philhealth-hospitals.json` as the active QC hospital dataset. Its 9,389 accredited-bed total and 46 provisional coordinates are source-reported and geocoded references, **not** operational/dengue beds, verified entrances, or vacancies. Never fall back to old NHFR `facilities.json`.
- Keep QC and NCR scopes distinct; never allocate an NCR forecast only to QC hospitals.
- Use minimal dependencies and update lockfiles. No code is deemed finished until real static/type/API/numerical/UI checks succeed or unresolved blockers are explicitly documented.

## Completion response Codex should return
A concise change log with exact changed files, execution commands/test results, generated model/data provenance, reproducible demo steps, known unresolved data/calibration issues, and which requested dashboard elements are fully functional, disabled, or still hypothetical. Do not state “production ready” without evidence, security evaluation and verified operational hospital data.
