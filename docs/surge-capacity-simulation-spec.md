# QC 28-day dengue admissions, overcapacity and hospital network simulation

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

## Purpose and boundaries
Simulate **reported-case-derived, hypothetical expected dengue admission demand** for QC hospital preparedness. This is not current admission census or a claim of case severity distribution. Distinguish source-reported bed capacity from staffed operational supply and dengue-specific clinical suitability. Use only QC demand for QC hospital network; include outside-QC referrals only if an explicit verified cross-boundary provider model and region-wide demand accounting are implemented.

## Source and capability audit
- **Active QC facility resource**: 46 PhilHealth hospital/infirmary rows, 9,389 accredited beds, 46 provisional coordinates, zero verified emergency entrances. The old DOH/NHFR 165-NCR/41-QC extract is archived for crosswalk only and MUST NOT appear as an active QC resource.
- PhilHealth is the **chosen QC primary inventory**. Use `qc-philhealth-hospitals.json` and approved processed CSV with immutable version; **do not combine NHFR beds**. No independently verified staffed/dengue-specific capacity exists. Modeling requires explicit scenario assumptions.
- Validate whether NHFR `Bed Capacity` corresponds to authorized beds; `scripts/import_nhfr.py` and `scripts/build_facility_map.py` currently assume it by field naming alone. If not verified, use the neutral source label `NHFR reported beds`.
- Eligibility is three-valued `verified_yes`, `verified_no`, `unknown`. Specialty, military, maternity and non-general facilities are not automatically permitted for dengue inpatient admissions. Where no verified yes exists, simulation must explicitly be a **hypothetical capability scenario**, never observed operational preparedness.
- Distinguish pediatric vs general inpatient capability only with sourced evidence; otherwise unknown. Routine ED opening hours do not imply available dengue inpatient beds.

## Stocks, flows and capacity
For hospital `i`, day `d`, define:

- `N_i(d)` normal **staffed and relevant** inpatient capacity (possibly assumed; may be 0 or unknown).
- `S_i(d)` additional **staffed/physically supported** surge placements activated after a trigger and `activationLagDays`; `K_i(d)=N_i(d)+S_i(d)`.
- `B_i(d)` nondengue census occupying a portion of relevant staffed beds (measured only if real data supplied, else explicitly assumed).
- `D^N_i(d), D^S_i(d)` dengue inpatient census in normal and surge placements.
- `H_i(d)` **on-site temporary holding census** not placed in a supported inpatient bed; may correspond to hallways/ED waiting, not automatically safe/acceptable care.
- `Q_i(d)` awaiting transfer/placement queue distinct from `H` if physically not present; `U_i(d)` new externally unserved demand; `T_{i→j}(d)` transfers (must enter destination) and `R_i(d)` discharges/deaths/other specified exits. Define exit categories clearly; do not infer mortality from model.

Normal/surge staffed beds must satisfy `B_i + D^N_i + D^S_i ≤ K_i` at each simulated step. If nondengue baseline occupancy cannot be accommodated under these constraints, flag an invalid scenario rather than silently subtracting it. Any extra on-site patients appear as `H` **outside** supported inpatient capacity, not as magical surge beds. `H` requires an explicitly bounded holding policy; if holding is disabled, queue/unserved states increase.

Occupancy measures:

\[
\text{normal-bed utilization}_i(d) = 100\frac{B_i + D^N_i + D^S_i}{N_i} \quad (N_i>0)
\]
\[
\text{supported-bed utilization}_i(d) = 100\frac{B_i + D^N_i + D^S_i}{N_i+S_i} \quad (K_i>0)
\]

Also report `onSiteCensus = B + D^N + D^S + H`, `onSiteCensus / normalCapacity` **separately** and labeled, so a story about 200% observed total patient crowding is not confused with 200% supported inpatient placements. When denominator zero, utilization = `null` and warning. `surgeFraction` is facility/date-specific scenario input, not universal.

### Required example invariants
Hypothetical day: `N=100`, `S=30`, `B=0`, `D^N=100`, `D^S=30`, `H=5`, no external unresolved demand -> `supported inpatient census=130`, `onSiteCensus=135`, `normal-bed supported occupancy=130%`, `supported-bed occupancy=100%`, **on-site census relative to normal=135%**, temporary holding=5. Patients must not disappear or be simultaneously counted in holding and inpatient census.

## Case-to-admission transformation and time base
- Weekly QC reported-case forecasts for 4 weeks are spread across 28 daily values with a normalized day-of-week profile (uniform 1/7 is a disclosed fallback), preserving each weekly total to numerical tolerance.
- Daily admission expectations derive from an explicit hospitalization probability/rate assumption `q` and reporting-to-admission delay probability kernel `p(δ)`. `E[A_d]=q∑_s C_s p(d-s)`. An observed admissions rate for QC is unavailable; the old UI's 15% is **an illustrative default**, not validated.
- At stochastic replicate level, sample integer cases/admissions/discharges using reproducible RNG; don't round every day independently then lose mass balance. At expected-value level fractional `expectedAdmissions` are acceptable with units.
- Length of stay may begin as explicit fixed 4-day illustrative assumption, later use a bounded LOS distribution if measured/sourced. A patient cannot be discharged before admission. Track warm-start dengue census based only on pre-origin information, mark assumed.
- Baseline nondengue occupancy (current UI 75%) is illustrative; may vary with date/facility/bed type. No bed assignment without eligible/capable facility and configured capacity.

## Flow update rules
Use a documented daily order, e.g.: discharge due today → update staff/surge availability → process existing on-site holding/queue → allocate new arrivals and transfers → record residual holding/unserved → snapshot. Record and test ordering, since alternate sequences yield different peak census.

For each day (including same-day transfers if supported), enforce **mass balance**:

`previousHospitalCensus + previousHolding + externalNewPresentations + incomingTransfers = endingHospitalCensus + endingHolding + dischargedOrOtherExits + outgoingTransfers + externallyUnservedDepartures`

Here `externalNewPresentations` means newly presenting patients/demand entering this modeled hospital system, **not** inpatient placements. If a queue is included, add previous/ending queued stocks to opposite sides consistently; admissions to staffed inpatient beds are internal state transitions and must not be counted as external arrivals twice. Avoid mixing expected fractional admissions and realized integer counts in the same identity.

Define explicit policy for whether external unserved demand is a recorded daily flow vs cumulative metric; don't add cumulative unserved as a daily stock. Do not assume unserved = deaths, disease burden or actual patient rejection.

## Hospital allocation / optimization
- Baseline: clinical eligibility then distance-weighted feasible capacity with transparent tie-breakers and travel mode; if verified travel times unavailable use straight-line distance labeled proxy, not travel minutes.
- Optimize daily or time-expanded over admissions and LOS. Hard constraints: eligibility, staffed capacity, finite activated surge capacity, optional maximum distance/access constraint, case conservation, nonnegative flows, activation lead time, patient placement restrictions. Penalize non-placement and holding with explicit, inspectable weights; optimize only **modeled system decisions**, not individual clinical referrals.
- Compare baseline and optimized outcomes on identical random realization, hospital pool, parameter version and time period; show unmet demand, holding patient-days, normal >100% pressure days, surge beds activated, distance/access burden and distribution across barangays.
- Do not count a specialty hospital as available merely because its official accredited level is high. Recommend verification and preparedness planning, not unsupported transfer orders.

## Sensitivity and acceptance tests
Test `q`, LOS, baseline occupancy, staffed fraction, surge activation lead time, holding limit, shock magnitude, facility eligibility, geography and source-bed uncertainty. At minimum test:
1. All-zero case forecast -> no new modeled dengue admissions (warm-start may persist).
2. Bed capacity null -> no verified capacity; scenario explicitly hypothetical/blocked.
3. Capacity = 0 -> no divide-by-zero, no staffed placement.
4. Normal occupancy 99%, added surge 20% -> finite calculated buffer; >100% normal utilization supported only when surge beds active.
5. 100/130/135 example with 5 holding.
6. No surge + 135 arrivals with normal 100 -> finite holding/unserved, no infinite beds.
7. Waiting patients transition to staffed bed only when freed/activated; no ghost patients.
8. Activation lag > 0 delays capacity correctly.
9. 28-day dates, 4 weekly totals, daily cumulative counts reconcile; no double counted transfers.
10. Source/assumption/capability caveat appears in export and API.
