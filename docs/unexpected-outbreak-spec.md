# Unexpected Outbreak Response Lab — off-season shock and day 0–28 stress testing

## Core purpose

Implementation extension recorded **2026-10-24 19:15:49 +08:00**: see
[user request log](change-request-log.md). `/outbreak-response` adds movie
playback/speed, a hypothetical expansion front, nearest-three hospital context,
and animated placement connections. User-selected dates are hypothetical labels
because source-block calendar alignment remains unresolved. No contagion model
or verified travel/referral claim is introduced.
Build a dedicated `/outbreak-response` dashboard for the question: **"If reported dengue cases unexpectedly increase in QC at this date, what could hospital demand, holding, overload and LGU preparedness look like at day 7, day 14, and day 28?"** The module is an **exogenous hypothetical shock scenario**, not an ability to forecast unobserved sudden outbreaks or infer contagion spread from annual barangay totals.

Dengue may occur year-round; an unexpected outbreak can happen outside typical peak periods. The interface must let users choose an arbitrary **historical scenario onset date** with a credible real-data baseline or label the entire scenario hypothetical. Never claim an Oct 2026 scenario is a genuine prospective 2026 dengue forecast without surveillance observations beyond 2025.

## Inputs, controls, and semantics

1. **Mode**: `historical_replay` (real QC past cases and dated model forecast at frozen origin); `hypothetical_shock` (sourced historical reference baseline + declared shock). `live` disabled unless authoritative contemporaneous surveillance and validation exist.
2. **Shock onset**: calendar date `d0`, explicitly local QC calendar; day slider means integer days **since onset**, from `0` to `28`, inclusive. Define **Day 0** as the pre-shock census snapshot at `d0` 00:00 local time, and **Day k** (k=1..28) as the snapshot exactly k elapsed days after onset. Cases/admissions during the k-th 24-hour interval fall in `[d0+(k-1) days, d0+k days)`; Day 7 displays seven complete days of cumulative activity (not eight), plus point-in-time census at `d0+7 days`. Display `snapshotAt` and `intervalStart/intervalEnd` explicitly to prevent off-by-one errors.
3. **Shock geography**: citywide QC or selected verified QC barangay. If barangay dataset/polygons are missing, disable localized mode with explanation. Do not present unconstrained typed barangay labels as verified IDs.
4. **Shock type**: (a) multiplier vs historical baseline over selected period, (b) additive expected reported cases per week, optionally (c) manually supplied *hypothetical* observed start-day case counts, never mislabeled as DOH data. Store shock width, time profile, amplitude, and onset.
5. **Shock duration and evolution**: fixed step, finite pulse with decay, or user-configured weekly profile; **none of these is an empirical infection-transmission model**. A “growth rate” is a scenario knob, not an estimated reproduction number.
6. **Response levers**: facilities eligible, activation day/lag, extra supported beds and staffing if assumed, temporary holding maximum and duration, patient allocation method (baseline vs optimizer), admission fraction, LOS, non-dengue occupancy, geography and travel restrictions.
7. **Uncertainty**: baseline forecast intervals (if actually evaluated), plus shock/admission/LOS/capacity sensitivity. Distinguish predictive from scenario uncertainty; no unsupported 95% certainty banners.

## Shock mathematics
Let `B_d` be a dated, observable-origin-compliant baseline projection of QC reported cases, disaggregated to daily expected values with weekly mass preservation. Let `s_d` be a **declared hypothetical nonnegative** shock profile. Either:

- **Multiplicative shock**: `C_d^scenario = B_d × m_d`, where `m_d = 1 + a × g(d-d0)`, `g` predeclared shape in `[0,1]`, `a≥0` and bounded; or
- **Additive shock**: `C_d^scenario = B_d + X × g(d-d0) / Σ g`, where `X` is an explicitly assumed total extra case burden over a documented window.

If baseline missing, **do not silently set B=0**; report the scenario cannot be quantified unless an expressly labeled synthetic baseline experiment is selected. Model shock should not change historical observed case counts in the recorded observations dataset.

Citywide weekly/monthly case conservation is checked against integrated daily values. For a localized shock, write `B_{b,d}=w_b B_d` and `shock_{b,d}=k_b X_d` with `Σ_b w_b=Σ_b k_b=1` and the verified source/cutoff of `w,k` attached. Baseline plus shock still equals QC total, not QC+NCR combined.

Admissions `A_d` are expected from reported cases under a declared `q` and delay kernel, then passed **unchanged** into the hospital patient-flow engine described in `surge-capacity-simulation-spec.md`. Never implement a separate contradictory overflow model in the dashboard.

## Visual behavior

- New route: `apps/web/app/outbreak-response/page.tsx` plus reusable scenario control, metrics, map layer, comparison and timeline components as useful.
- **Day slider** 0–28, step 1; shortcut buttons 7,14,28. Changing day is an instant view of **already calculated** results, not an implicit new simulation request. Changes to onset, shock, capacity, LOS or policy must invalidate results and request a new immutable run.
- Main KPI row: daily new estimated reported cases, cumulative reported cases through day, new expected admissions, currently staffed inpatient census, on-site holding census, externally unmet demand, normal-bed occupancy % and supported-bed occupancy %, active surge beds.
- Main chart: expected weekly/daily case trajectory vs reference, admissions by day, admissions/discharges/census, normal/surge capacity lines, on-site holding, unresolved demand. Use clearly separate axes and units.
- Map: QC barangay modeled burden only after verified polygons and annual data; QC eligible hospital points show **normal-relative capacity pressure, holding and model evidence**. No fabricated markers. Layer definitions and legends correspond to selected day.
- Comparison: two synchronized panels (`baseline` and `intervention`), same stochastic seed/forecast/shock, displaying key differences; intervention can add supported surge placements or change modeled allocation, but **must not claim to reduce dengue infections** unless a separately sourced transmission intervention model exists.
- LGU action cards: trigger source, simulated scenario ID and date, affected resources, activation lag, caveat and human-verification requirement. Suggest coordinating staffing, triage/assessment preparedness, resource checks and verified hospital communications rather than direct medical instructions.
- Include downloadable JSON/CSV scenario summary with metadata, clinical assumptions, source IDs, software version, and `not_current_vacancy_tracking` disclaimer. No PHI.

## Historical demonstration paths
- Re-run an early-2025 QC origin (if source workbook obtained), compare **pre-February** model forecast against subsequently observed counts, and separately show a hypothetical surprise shock at a low-season issue date.
- The shock simulator may start with an exogenous April/November example only as an **assumed season test**; it must not claim the month is universally low-risk or fit a sudden outbreak probability without incidence evidence.
- Use recorded 2025 observed cases **only after** they would have been available in retrospective plots; future actuals cannot enter early-2025 forecast inputs.

## Acceptance tests
1. `dayIndex` runs `0..28` and `day 7/14/28` shortcuts map to correct dates and consistent point/cumulative metrics.
2. `amplitude = 0` matches same-baseline control run exactly.
3. Finite multiplier and additive shock support arbitrary in-year onset, month/year crossover, and 28-day horizon.
4. `∑ barangay expected cases` = QC daily expected cases and daily sums = weekly shocks to numeric tolerance.
5. Missing QC barangay geometry disables localized mode gracefully; missing baseline rejects case-projection mode without fabrication.
6. Extra staffed beds activate **no earlier** than configured delay and cannot exceed modeled staffing/space constraints.
7. More arrivals may yield >100% normal utilization and finite holding; no patient is created or discarded in conservation accounting.
8. Comparisons use the exact same baseline, shock, RNG seed, facility pool and capacity definitions; only declared interventions vary.
9. Every output distinguishes observed, model-estimated, scenario-imposed and unavailable data.
10. No false “lives saved,” “actual hospital vacant beds,” or public-health effectiveness claims.
