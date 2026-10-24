# User-requested extensions

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
