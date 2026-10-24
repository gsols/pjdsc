# Codex task — implement the Unexpected Outbreak Response Lab (day 0–28)

**Hospital network interface:** Use the same **active PhilHealth QC 46-row** hospital source in both standard and unexpected-outbreak simulations. Never switch to the legacy NHFR 41-QC/165-NCR file or silently mix bed definitions. See `docs/hospital-dataset-source-of-truth.md`.

Read `AGENTS.md`, `apps/web/AGENTS.md`, `services/engine/AGENTS.md`, `docs/unexpected-outbreak-spec.md`, `docs/surge-capacity-simulation-spec.md`, `docs/spatial-hotspots-spec.md` and existing actual UI/backend modules before editing.

## Deliverable
Add a dedicated Next.js route `/outbreak-response` integrated with FastAPI `POST /v1/outbreak-scenarios`, preserving the existing `/dashboard`. It is a **hypothetical shock preparedness laboratory** for off-season or otherwise unexpected spikes, not a verified prediction that an outbreak will occur.

### User experience — required
1. A simple scenario header clearly labeled **Historical replay** or **Hypothetical outbreak stress test**, date of outbreak onset, chosen case-reference run, source cutoff, geographic scope.
2. Adjustable shock magnitude (`1×` baseline, `1.5×`, `2×`, `3×`, and bounded custom), duration and pulse profile. Citywide shock first; barangay-localized mode only if 142-barangay annual records, polygons and joins are present; otherwise disabled with clear explanation.
3. Explicit clinical/operational **assumption controls**: admission fraction, LOS, baseline occupied beds, operational capacity fraction, surge activation day/lag/size, holding capacity, selected eligible facilities, geographic allocation method. Unknown clinical values must be labeled hypothetical.
4. A responsive **Day 0..28 slider** with keyboard access and Day 7 / Day 14 / Day 28 shortcut buttons. Changing day moves map/charts/KPI cursor without re-running simulation; modifying an assumption invalidates the previous scenario and requires a new backend run.
5. KPI cards that separate: projected cases **that day** vs cumulative cases through selected day; newly modeled admissions vs current dengue inpatient census; normal-bed occupancy % vs supported-bed occupancy %; staffed surge placements vs on-site holding and unresolved demand; all with units and appropriate source labels.
6. Main figures show weekly/day outbreak trajectory, case-to-admission demand, beds & staffed surge activations, patient holding/overflow, comparative baseline-vs-response outcome, and QC barangay mapped projected burden when data exist. No hardcoded fictional graphs; charts consume API outputs.
7. Two comparable branches: no intervention vs chosen resources activated (staffed surge, revised allocation, reassessment capability), using identical shock/case realization and other controls; show **modeled outcomes only**.
8. Time-specific action cards for LGU/hospital network with triggers, uncertainty, resource checks, verification notes, and explicit requirement for human/clinical review. No automatic real referrals or claims of reduced infection from bed actions.
9. Loading, unavailable-source, invalid-forecast-run, missing-geography and backend-503 states; credible export with mode, issue date, source hashes, scenario inputs, solver and results.

### Backend logic — required
- Use historical QC reference forecast or a transparently synthetic **test-only** scenario; baseline missing -> reject quantitative app run, not silent zero.
- Build a dated exogenous shock profile as documented in `docs/unexpected-outbreak-spec.md`; do not infer off-season infection growth rate or reproduction number from city-level annual data.
- Convert cases to daily expected admissions using the **same** patient-flow implementation used by `/simulate`, with finite surge capacity, lag and bounded holding. Keep stochastic seed/config fixed for fair intervention comparison.
- Return immutable `scenarioId`, `dayIndex=0..28` daily snapshots and separate daily/cumulative fields, QC spatial allocation when data permit, facility pressure and unknown/verified indicators.
- Add tests: day boundaries, month/year crossing, shock amplitude 0 = control, conservation, activation lag, >100%-normal occupancy without infinite staffed capacity, missing barangay inputs, future-data leakage, scenario run reproducibility.

### Implementation order
Build FastAPI typed schemas + pure shock transform + patient-flow wiring + tests -> Next.js BFF -> `/outbreak-response` UI -> synchronized map/charts/slider -> source/assumptions drawer -> export -> integration tests. Reuse existing MapLibre and styling. Add dependencies only as needed, update lockfiles. Do not rebuild whole frontend or claim live clinical readiness.

### Definition of done
The user can select a **real dated historical QC reference** (once the workbook/model is available), impose an explicit hypothetical spike, run a 28-day scenario, move the slider through Day 7/14/28, see consistent forecast-derived cases/admissions and staff/surge/holding capacity states, compare a response to a control with no made-up numbers, and reproduce the run from metadata. If inputs are absent, interface indicates unavailable and tests work with labeled fixtures without fabricating historical observations.
