# User-requested extensions

## 2026-10-26 15:27:18 +08:00 — automatically connect to a sleeping Render engine

User reports that `ENGINE_BASE_URL` is configured but simulations fetch data only
after manually opening the separately deployed engine URL. Add bounded on-demand
liveness checks and visible startup status before simulation/research requests;
cancel obsolete requests, stop after two minutes, and preserve model/data errors.
Scope and deployment steps: [Render deployment](render-deployment.md). No periodic
keep-alive traffic, repeated simulation POSTs or changes to scientific inputs.

## 2026-10-25 08:01:49 +08:00 — audit forecasting and overall parameters

User requested verification of XGBoost, months/seasons, number of days, surge,
accuracy and parameters overall; authorized continued development without routine
confirmation. Scope/results: [forecast parameter audit](forecast-parameter-audit.md).
Correct calendar mass, residual dating and historical target alignment; compare
four XGBoost variants on pre-2024 data only; expose monthly/season/window evidence
and explicit parameter effects. Preserve raw sources and accuracy limitations.

## 2026-10-25 07:11:55 +08:00 — restore color animation and clarify bed percentages

Runtime follow-up 07:26 +08:00: restarted the stale local engine and versioned new
bed-percentage results separately. Import-time code hashes plus a restart-required
guard prevent old workers from saving calculations as if new code produced them.

Request: restore moving/changing forecast colors during surge playback and make
predicted bed use/capacity percentages clear. Scope: [QC workspace](qc-simulation-workspace.md).

Added explicit frame-based interpolation of each candidate's forecast values into
a continuous palette and halo size. New runs default to accumulated-case animation;
daily forecast remains selectable. A full-window scale stays fixed during playback
so high counts do not all saturate at the old 50-case cap. Reduced-motion mode
remains static. Only the ten annual XGBoost candidates receive color/markers; there
is no neighbor-triggered spread or animation of fabricated case observations.

Backend bed forecasts now return demandUtilizationPct = expected dengue bed demand /
scenario-assumed dengue slots × 100, with null for zero capacity and no 100% cap.
Nearby hospital cards and the right sidebar show expected beds, denominator and
percentage, separate from three-way arrival shares and post-placement total
staffed-bed occupancy. Configured-surge status is explicit and not presented as an
observed outbreak. Actual staffed/available capacity remains unknown.

## 2026-10-25 01:10:07 +08:00 — correct hotspot definition and train local ranking

Request: explain why all barangays were marked and whether hotspots/high-case
places were calculated with XGBoost. The earlier map incorrectly equated positive
allocated demand with hotspot eligibility; its XGBoost model was QC-wide only.

Corrected markers and case-band coloring to only ten ranked high-burden candidates.
Selecting a non-candidate no longer gives it an orange hotspot marker. Trained a
separate annual barangay XGBoost burden model, evaluated matched past-only annual
origins, and used its forecast shares for the automatic workspace. Source cutoffs,
annual-vs-weekly limitations, ranking definition and baseline comparisons are
exposed in the UI and [ranking specification](barangay-xgboost-ranking.md).
Observed annual nulls and immutable raw sources are preserved. Invalid model
artifacts block the workspace, with no historical-share fallback.

## 2026-10-25 00:02:51 +08:00 — complete marker coverage and dated place progression

Request: resolve remaining missing hotspot markers and base progression on each
place's forecast rather than a chain of events. Scope: [QC workspace](qc-simulation-workspace.md).

All positive-demand barangays now have marker IDs, rather than only the top ten.
Top-ten ranks retain numbered icons; other modeled locations use orange dots.
Screen-space separation, viewport/control exclusion and adaptive icon sizes keep
crowded markers accessible, with gray stems to original points. Source coordinates
are untouched. Date controls, legend, thumbnail and inspection cards occupy normal
layout outside the map viewport. Marker objects persist across playback frames.

Daily forecast allocation is now the default map measure, with an accumulated-cases
option and a selected-place daily chart. Forecast scenarios use a dedicated dated
allocation function; no neighbor events, seed distance or radial expansion affects
case progression. All places update concurrently. The legacy explicitly hypothetical
radial outbreak API remains separate. Current place curves remain prior-annual-share
allocations of QC forecasts; independent barangay weekly forecasts are unavailable.

## 2026-10-25 00:35:33 +08:00 — XGBoost and shared hospital surge-bed demand

Request: show projected surge-related beds near a selected place, account for people
dividing among three nearby hospitals and use XGBoost. Scope:
[future seasonal simulation](future-seasonal-simulation.md).

Installed/pinned XGBoost 3.1.3 and retrained the seasonal case model on audited inputs.
The requested XGBoost model is explicitly selected; original boosting and seasonal
baselines remain in past-only calibration and 2024/2025 evaluation. No superiority
claim is made. The model is used for future cases, with admissions/LOS converting
cases to required beds; observed admissions/occupancy targets remain absent.

New workspace runs default to equal expected shares across the nearest three
assumed-eligible sites, with a nearest-only comparator. Identical shares drive
placement preferences and unconstrained hospital bed demand; capacity diversions
remain finite. Per-place tables/sidebar summarize shares, expected admissions,
no-added-surge peak beds, with-surge peak beds and extra demand due to surge.
Hospital cards cover all origins; actual staffed/vacant beds remain unknown.
Raw source inputs and accredited-bed definitions are unchanged.

## 2026-10-24 23:52:00 +08:00 — show hotspot markers before playback

Request: urgently restore missing hotspot markers. Location-preview IDs now come
from the loaded approved window independently of day-zero value gating. Orange
numbered hotspot markers and their proximity connections appear as soon as data
loads; the legend explicitly calls them a location preview before playback.
Projected counts and other modeled outputs remain hidden at day zero. The render
regression now asserts both visible marker IDs and hidden projection counts.

## 2026-10-24 23:45:45 +08:00 — SurgeWise, within-barangay links and not-started state

Request: connect hotspots to multiple hospitals inside their area, suppress
simulated values before playback unless they are a verified base for that date,
remove remaining persistent hotspot names and rename the product SurgeWise.
Scope: [QC workspace](qc-simulation-workspace.md).

The engine context adds hospitalsWithinBarangay using polygon covers on canonical
provisional points (including boundary points); it does not infer eligibility or
entrances. Each of ten ranked hotspots and any inspected barangay links to the
nearest hospital plus all hospitals inside its polygon, deduplicated by ID. Click
cards list those sites. Source data and demand/placement calculations are unchanged.

Day zero now withholds projections, modeled charts/ranks, occupancy, bed demand and
exports, including after restart/scrubbing to zero. No authoritative daily base
count is available for the selected dates; unavailable remains unavailable rather
than showing zero or an old source-year total as a current base. Dated inventory,
configuration and model/source evidence remain accessible. Persistent hotspot name
labels were removed; numbered markers reveal names in click cards. Product headers,
dashboard, browser metadata and API title now say SurgeWise.

## 2026-10-24 23:31:50 +08:00 — map stacking, visible hotspots and restrained labels

Request: stop icons overlaying legend/details, make hotspot markers more prominent
and emphasize only the selected region rather than bolding its text.
Scope: [QC workspace](qc-simulation-workspace.md).

The map now has an isolated stacking context below opaque legends/inspection cards.
Hotspots use larger orange numbered circles with light outlines and a static halo;
numbers match the ranked guide. Selected map labels retain regular weight, size
and padding; selected table text is also regular. Polygon extrusion/outline and
connection emphasis remain. No case data, source artifacts or calculations changed.

## 2026-10-24 23:27:45 +08:00 — collapsible results footer and marker key

Request: collapse reproducibility, export and all bottom case/patient metrics;
identify hotspots versus hospitals with a marker legend; show medical icons
instead of hospital name labels; provide cases and nearest hospital when a
hotspot is clicked, preserving hospital capacity/nearest-hotspot inspection.
Scope: [QC workspace](qc-simulation-workspace.md).

Implemented a native Show/Hide results-footer disclosure, initially expanded.
Medical-cross buttons represent all 46 registered hospital points; names appear
in the inspection card after selection. Orange hotspot and medical-cross symbols
are explained in the map key. Hotspot/guide clicks show full-window projected
cases/range, playback-day accumulation and nearest hospital/distance, with links
to hospital inspection. Hospital hit priority and provisional-point/source-capacity
caveats remain. This changes presentation only, not demand or source data.

## 2026-10-24 23:16:44 +08:00 — collapsible case summary

Request: allow collapsing the full-window expected cases, experimental range,
date/calendar assumption and range-validation warning together. Implemented a
native keyboard-accessible disclosure, expanded initially, with explicit Show/Hide
labels. Both forecasting tabs share it. See [QC workspace](qc-simulation-workspace.md).

## 2026-10-24 23:07:02 +08:00 — hotspot guide and map selection

Request: show hotspot locations, projected cases and nearest hospitals; show bed
capacity and nearest hotspot when any hospital is clicked; clarify connections;
make a selected barangay bold and visually raised, with stronger local connections.
Scope: [QC workspace](qc-simulation-workspace.md).

The guide lists the ten ranked hotspots for the full window, expected cases,
conditional ranges and nearest registered hospital/distance. Hospital inspection
shows source-reported accredited beds, unknown operational capacity and the nearest
of those ten ranked hotspot representative points. Gold dotted hospital-to-hotspot
connections are separate from purple dashed nearest-hospital links and solid
modeled placement lines. Selected polygons have a decorative extrusion, shadow,
bright outline and bold label; no physical elevation or observed outbreak claim.
Hospital clicks take priority over underlying polygon clicks and reveal the
capacity sidebar. Data sources, scenario calculations and provenance remain intact.

## 2026-10-24 22:54:08 +08:00 — forecasting validation and reload repair

Request: investigate the recurring forecasting-subtab validation failure across
the integration, rebuild audited artifacts and make data-based reload work
without fallback. Scope: [future seasonal simulation](future-seasonal-simulation.md)
and [QC workspace](qc-simulation-workspace.md).

Confirmed byte-level newline drift in the seasonal report and hash-pinned
training code. Rebuilt the seasonal model/report/manifest from verified immutable
sources; pinned code line endings and made generated JSON UTF-8/LF and publication
atomic per file, with the manifest last. Added typed seasonal failure diagnostics,
seasonal readiness, tampering/missing-artifact regression checks and retries that
preserve the active tab's controls. Historical sources and all eight base
integration artifact hashes verified unchanged. No source or model fallback.

## 2026-10-24 21:19:03 +08:00 — two simulation tabs, future seasons and beds

Request: separate historical replay from future surge forecasting in the left
sidebar; allow flexible horizons such as 2, 12, 14 and 28 days and future seasonal
dates such as January 2027; implement a trained forecasting engine and bed forecasts.
Implemented contracts, methods, provenance and limitations are documented in
`docs/future-seasonal-simulation.md`. Future cases use a new seasonal curve with
assumed weather and configurable surge; beds use admission/LOS cohorts. No
current surveillance, actual vacancies or weekly barangay observations are invented.

## 2026-10-24 21:52:42 +08:00 — continuity between models

Request: continue implementation and preserve progress when changing models.
`docs/SESSION_HANDOFF.md` records implementation state, source boundaries,
reproduction, verification and outstanding work. Root instructions require reading
and updating the handoff. It is a checkpoint to verify, not a substitute for files.
## 2026-10-24 22:01:36 +08:00 — map-first hackathon dashboard

User request: make `/dashboard` mainly map, float the existing right panel over
it with dragging/collapse controls, and emphasize the simulation entry point for
the PJDSC 2026 hackathon. The map now fills the workspace; the existing panel
starts open at the upper right, can be moved within map bounds and collapsed,
and reopens when a different hospital is selected. A prominent lower-left
launch card links to the existing QC simulation with historical/assumption
labels. Keyboard movement is supported. No calculation or API changes.
User explicitly deferred tests/builds for this iteration. See
`architecture-and-contracts.md`, Dashboard presentation.

## 2026-10-24 21:52:14 +08:00 — recover cross-platform audited data bytes

User requested help with the audited historical-input 503 after local engine
setup. Eleven files had LF line endings while existing manifests pinned CRLF.
Restore only the newline representation that exactly matches each recorded
SHA-256, preserving source content and strict runtime verification. Add Git
attributes to prevent future conversion. No model or simulation logic changes.
See `upri-verification.md`, Cross-platform newline recovery.

## 2026-10-24 21:40:17 +08:00 — mirrored sidebar toggle placement

User request: move the right sidebar collapse control to its left edge, mirroring
the left sidebar. Both controls now sit beside the map; the right heading leaves
space for its button. See `qc-simulation-workspace.md`, Geography and UI arrangement.

## 2026-10-24 21:32:43 +08:00 — resizable and collapsible sidebars

User request: make both workspace sidebars resizable by dragging their inner
edges and individually collapsible to free map space. Both remain open at their
existing widths on first display. Desktop resize handles support arrow keys and
double-click reset; expanding restores the chosen width for the current page.
Smaller-screen layouts and simulation behavior remain unchanged. See
`qc-simulation-workspace.md`, Geography and UI arrangement.

## 2026-10-24 21:28:17 +08:00 — independent workspace scrolling

User request: allow the left, center and right sections of `/outbreak-response`
to scroll independently, without changing simulation logic or functionality.
Desktop columns now scroll within a viewport-height workspace and contain scroll
chaining. Smaller screens retain their existing stacked/page scrolling layout.
See `qc-simulation-workspace.md`, Geography and UI arrangement.

## 2026-10-24 20:14:55 +08:00 — automatic QC forecast UI and hospital sidebar

User request: remove mandatory place selection; use historical cases and
environmental factors to identify hotspots and estimate cases for specified date
ranges; keep QC as the calculation scope while retaining the entire Philippines
as map context. Keep case/patient totals in a bottom bar, beginning with observed
cases already recorded. Put nearest-hospital capacity in the right sidebar.
The user confirmed that “specific ranges” means **both forecast case-count
ranges and explicit numeric input limits**.

This supersedes the manually seeded/radial illustrative scenario as the default
UI. `/outbreak-response` and `/simulate` now use the automatic QC workspace:

- Cases + lagged rainfall/temperature/humidity forecast variant; no place/run
  selection is required. QC annual burden supplies fixed prior spatial shares.
- Per-window central estimates and experimental residual ranges for all 142
  barangays, visible input limits, and fixed numerical map display bands.
- Full Philippines regional geometry context plus a permanent national overview;
  no non-QC case, facility-demand or capacity calculations.
- Source-year-to-origin observed cases first in the bottom bar, followed by new
  expected/cumulative cases, supported census, holding and unresolved demand.
- Automatic nearest-three hospital cards, separately showing source-reported
  accredited beds, unknown actual staffed/dengue capacity, and assumed scenario
  normal/surge/residual capacity and occupancy. All 46 source records remain.
- Same-input baseline vs capacity-constrained minimum-distance LP comparison,
  with finite staffed capacity, holding, LOS and day-specific residual capacity.
  No guarantee of reduced strain or real-world benefit is asserted.

The original calendar metadata conflict remains unresolved. The automatic latest
prior reference uses an explicitly assumed `Jan 1 + 7×WN` display cutoff; it is
not promoted to verified date alignment. Forecast-reference mode uses historical
starts through 2025; future/off-season dates require hypothetical mode. Weather
measurements are citywide, not observed barangay microclimate. Empirical city
range coverage is only 50–62.5% on eight retrospective origins/horizon against an
80% target; the shortfall is visible. Barangay ranges remain conditional on fixed
annual weights and exclude unmeasured spatial uncertainty.

## 2026-10-24 20:00:04 +08:00 — missing Next.js root-page output recovery

User reported `ENOENT` for `.next/server/app/page.js`. Inspection found two
development instances sharing the app output directory (one bound to loopback,
one on the default host) and a route manifest referencing an absent root bundle.
Both conflicting instances were stopped and one clean server restarted.

Development now uses `.next-dev`; production build/start retain `.next`.
`npm run dev` uses an exclusive project launcher lock, preventing duplicate
cache writers across ports/hosts, with recovery for a confirmed stopped owner.
Git/ESLint ignores and generated TypeScript paths cover the separate dev output.
Use the npm launcher rather than a second direct `npx next dev` invocation.

Verified: 11 frontend tests, a successful production build while development
remained running, successful root/dashboard redirect and full movie HTTP smoke,
and rejection of a second launcher. Data/model sources were not changed.

## 2026-10-24 19:15:49 +08:00 (Asia/Manila) / 11:15:49 UTC

Request: implement the simulation as a playing movie over user-specified dates,
show hotspot locations and nearest hospitals, connect hotspots to hospitals with
lines, and timestamp additional requirements absent from the concerned Markdown.

Extensions to the existing day-slider/outbreak specification:

- Play, pause, restart, adjustable playback speed, date stamp and day scrubber;
  honor reduced motion and support day 0/7/14/28 shortcuts.
- A visible assumed spatial-expansion front with configurable initial radius and
  speed in km/day; this is an exogenous hypothetical kernel, not inferred dengue
  contagion or observed weekly barangay spread.
- Three-nearest hospital rankings per polygon representative point, with km
  distances, facility identity/evidence and provisional-point caveats.
- Separate dashed proximity connections from modeled capacity placements;
  animate directional demand dots while playing and derive placement line widths
  from the same saved daily patient-flow results. Dots do not represent people.
- Load a labeled, server-configured illustrative simulation immediately so the
  page has a playable movie without reconstructing forecasts in the browser.
- Record subsequent user additions here with actual timestamp/time zone and
  update the concerned specification or scoped guidance. Never edit raw source
  README/data to record product requests.

Implemented entry points: `/outbreak-response`, `/simulate` redirect, dashboard
and research navigation. Engine: `/v1/outbreak-demo`, `/v1/outbreak-context/{id}`,
`POST /v1/outbreak-scenarios`, `GET /v1/outbreak-scenarios/{id}`.

Source/calendar boundaries remain binding: user dates label a hypothetical
scenario borrowing a historical QC reference trajectory. They do not resolve
the workbook's disputed `WN` calendar definition. Annual weights use complete
years available under the declared lag before both reference and scenario years.
The 2026 PhilHealth network is assumed for planning, not evidence of historical
hospital operations. Unknown eligibility is included only in an explicitly
assumed network, never silently upgraded to verified capability.
