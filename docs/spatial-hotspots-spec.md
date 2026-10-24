# QC barangay hotspot mapping: what can and cannot be inferred

## Observable versus modeled

**2026-10-24 19:15:49 +08:00 — user extension:** display nearest hospitals and
map connection lines during movie playback; see [request log](change-request-log.md).
Use projected polygon point-on-surface anchors and Haversine distances to the
approved provisional hospital points. Show nearest registered sites separately
from hypothetical eligible sites receiving modeled placements. Lines are straight
research proxies, never verified road routes. Geographic prerequisites below are
now supplied by the audited UPRI integration; two IDs remain explicit project
crosswalks documented in `upri-integration-audit.md`.
The cited UPRI-NOAH release describes QC **weekly city-total cases** and **annual barangay case totals** (142 barangay entities). It does **not** supply observed weekly barangay disease trajectories in the described files. The uploaded repository contains **neither** the original annual barangay table nor QC barangay polygons. Therefore:

- **Observed layer:** historical annual cases by barangay for a selected **completed past calendar year** (only after import and validation).
- **Projected layer:** model-allocated share of a QC-wide weekly dengue forecast into barangays using historical annual patterns; label `Modeled spatial allocation` or `Projected case burden scenario`, never `Observed weekly hotspot`.
- **Risk rate layer:** only if matched PSA population estimates and denominators exist, then `cases per 100,000` over an explicit interval. Raw case counts are *burden*, not individual risk or incidence rate.
- **No separate barangay 1–4-week trained forecast accuracy** can be claimed without weekly observed barangay labels. Don't pretend annual records validate weekly hotspot location or precise onset.

## Spatial data prerequisites and quality
- Obtain a government-/license-attributed QC barangay FeatureCollection and annual case table; validate 142 stable IDs or explicitly document mismatches due to boundary changes. Use PSGC where available, not free-text join only.
- Check EPSG:4326 coordinates, valid geometries, city extent, spatial overlap, unmapped and duplicate barangays; record area and version changes.
- Verify annual case counts are finite nonnegative integers and that source years match the forecast cutoff. A blank barangay count is missing, **not automatically zero**.
- If annual historical burden exists only for a subset, show exclusion/mapping coverage and widen uncertainty; do not silently funnel missing mass to known barangays.

## Baseline allocation method
For prediction `C_{t+h}` at origin `t`, construct time-safe nonnegative weights using only annual years completed **before** issue year (or source-published by issue) and enough evidence:

\[
\tilde{n}_b=\sum_{y\in Y(t)}\lambda_y n_{b,y}, \quad
w_b=\frac{\tilde{n}_b+\alpha q_b}{\sum_j(\tilde{n}_j+\alpha q_j)},\quad
\widehat{C}_{b,t+h}=w_b\widehat{C}_{QC,t+h}
\]

- `n_{b,y}` = recorded annual dengue cases in barangay `b` year `y`; `Y(t)` excludes data not known by issue date. `λ` = predeclared decay weights (e.g. most recent completed year emphasized); **not** a measured real-time outbreak risk parameter.
- `q_b` = fallback prior weight, preferably verified population share; if unavailable, a disclosed uniform prior over verified mapped barangays is permissible for hypothetical analysis. Set `α` explicitly and sensitivity-test it.
- `∑_b w_b = 1`, `w_b≥0`; `∑_b C_hat_b = C_hat_QC`. If integer output required use deterministic largest-remainder rounding preserving exact city totals; otherwise retain expected fractional cases labeled appropriately.
- For a **localized shock** in barangay `k`, distribute only the specified additional/shock component using an explicit localized kernel or chosen neighboring area weights; allocate the baseline via historic weights. This is a **scenario**, not a calibrated infectious-spread prediction.
- For each issue date, persist weight version and available years; do not use 2025 annual counts to forecast February 2025.

## Display layers
- Toggle `QC weekly city forecast`, `Observed annual barangay burden (selected year)`, `Modeled weekly barangay expected cases`, `Projected 28-day admissions demand`, `Facility normal-capacity pressure`, `Facility activated surge pressure`, `Unmapped/unknown`.
- Map choropleth legend must show `cases / selected interval`, underlying data time and model allocation warning. If population is sourced, show a *different* normalized-rate choropleth with denominator.
- Hover/side drawer: barangay ID, observed annual evidence years, allocated weekly estimate, weight, estimated admissions interval, confidence caveat, data completeness. Show missing geometries in side table.
- Show top areas as **ranked expected burden under the chosen scenario**; do not claim confirmed transmission clusters or current infections.

## Validation and falsification
- For years with annual totals, test weights estimated from **prior years only** against actual held-out **annual** spatial distribution (e.g. MAE, rank correlation, top-k overlap, coverage). This is annual allocation validation, *not* weekly hotspot forecast validation.
- Compare uniform, population-share and historical-burden allocations where inputs exist. Sensitivity-test historic-year window, smoothing, geographic coverage, and localized-shock radius.
- Propagate citywide predictive uncertainty plus uncertainty in spatial allocation; a credible interval on QC total alone cannot prove accurate barangay weekly prediction.
- Test identity joins, missing counts, conservation, future leakage, spatial geometry validity, no verified coordinates fabrication, and integer allocation rounding.
