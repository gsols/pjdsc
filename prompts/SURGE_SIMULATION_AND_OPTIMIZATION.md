# Codex task — implement QC 28-day admissions, surge, overflow and allocation optimization

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

Read `AGENTS.md`, `services/engine/AGENTS.md`, `apps/web/AGENTS.md`, `docs/surge-capacity-simulation-spec.md`, `docs/architecture-and-contracts.md`, and `docs/data-provenance-and-limitations.md` first. Inspect the **existing** `services/engine/main.py`, Next.js `/api/simulate`, `dashboard/page.tsx`, `lib/types.ts`, `public/data/qc-philhealth-hospitals.json` and geographic data before editing; `public/data/facilities.json` is legacy only.

## Deliverable
A tested FastAPI research simulation engine that transforms an **immutable, genuine historical QC forecast run** into 28 days of modeled cases, expected/admitted demand, patient-flow occupancy (including >100% relative to normal staffed capacity), surge activation, bounded temporary holding, unresolved demand and a fair baseline-vs-optimized geographic assignment comparison. Integrate it into the current frontend without bypassing missing-forecast safety.

### Phase A — facility eligibility and capacity evidence
- Use **only** the 46-row new PhilHealth QC hospitals/infirmaries as the active QC hospital network, with 9,389 accredited-bed total as inventory metadata and 46 provisional points. Keep old NHFR NCR 165/41 as non-active crosswalk source; never sum or silently fall back. Confirm service eligibility and assumed staffed capacity before simulation.
- Use PhilHealth accredited beds as source inventory, not as authorized/implemented/staffed beds; keep the legacy NHFR `Bed Capacity` field only for separate audit. All dengue inpatient eligibility statuses default `unknown` unless proven by facility sources. Exclude unknown from verified network; permit explicit user-disclosed hypothetical eligibility for research scenarios.
- Build scenario-defined effective normal staffed and dengue-capable capacity from approved source values and named assumptions; `activatedSurgeBeds` require staffing/space assumptions plus activation date/lag. Never equate overall hospital `authorizedBeds` with actual vacant dengue beds.

### Phase B — 28-day patient flow
- Implement week-to-day allocation with sum conservation; delay kernel and admission fraction; 14-day warm start if documented and possible; explicit 28-day dates and reproducible stochastic mode or fractional expectations.
- Daily patient states: normal inpatient placement, added staffed surge placement, on-site holding awaiting supported bed, awaiting transfer/external queue, unserved demands, discharged and transfers. Define every flow and test conservation.
- Allow normal capacity utilization above 100% only when actual supported surge placements exist; **on-site headcount** can exceed supported places through separately labeled holding, never invisible beds. Model finite holding constraints and activate temporary capacity after delay.
- Implement numeric outputs by hospital and day with normal/supported denominators, waiting counts and evidence flags; do not infer facility-specific operational overcrowding from regional news articles.

### Phase C — test first
Create deterministic fixtures, then tests for:
- No cases; 0/null capacity; unavailable clinical service; no future run; wrong geography; input bounds.
- `N=100`, `S=30`, `B=0`, on-site 135: 100 normal +30 surge +5 holding; 130% normal inpatient occupancy, 100% supported inpatient occupancy, 135% on-site census vs normal. Verify the example only when the scenario supports 5 holding places.
- Waiting list, overflow, transfer accounting, 1+ day surge activation lag, length of stay, future discharge, daily/cumulative/weekly sums, sample determinism.
- Hospital collapse with missing coordinates must **not** be hidden as a nearby alternative; exclude geospatial allocation until grounded.

### Phase D — optimizer and reporting
- Implement simple baseline (documented feasible capacity + distance preference) and constrained alternative (documented LP/min-cost flow solver added to dependencies when chosen).
- Use identical demand realization, hospital eligibility, dated operational assumptions, cutoff and random seed in both branches; optimize with finite staffed capacities, holding/transfer constraints and access penalties.
- Compare admitted demand, residual unresolved demand, holding patient-days, surge activation, overloaded facility-days, travel/access proxy and equitable reach. Report if optimization is infeasible; do not silently substitute a fictional result.
- Add `/v1/scenarios`, `/v1/scenarios/compare`, result retrieval, and Next.js BFF compatibility; make the existing `/api/simulate` functional only for validated approved run IDs and eligible scenario inputs.
- Update `/dashboard` timeline or `/simulate` view to day 0..28, clear stale results on input edits, show three capacity concepts and source caveats. Avoid pretending verified live vacancies.

### Phase E — verify and document
- Run backend numerical tests, API tests, TypeScript types/lint/build as feasible; update provenance and README with real executed commands.
- If forecast artifact, clinically eligible facilities or staffed-bed data are absent, still implement pure simulation with deterministic **test fixtures** but keep real-data UI blocked or explicitly hypothetical with named assumptions.
- Provide source-to-census math, failure/error semantics, tested export schema and caveats. No operational/clinical release claims.
