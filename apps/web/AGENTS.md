# Codex instructions — `apps/web` (existing Next.js frontend)

**ACTIVE QC HOSPITAL DATASET OVERRIDE (2026-10-24):** Follow `docs/hospital-dataset-source-of-truth.md`. The primary QC hospital/infirmary inventory is now `apps/web/public/data/qc-philhealth-hospitals.json` (**46 PhilHealth QC records, 9,389 accredited beds, 46 provisional point coordinates**) and its processed CSV/manifest. `apps/web/public/data/facilities.json` (legacy DOH/NHFR, 165 NCR / 41 QC) is **NOT** the active QC hospital map, admission, simulator, or optimizer data source; retain it only for crosswalk/audit. Do not sum sources or silently fall back. All 46 active hospital points are present, but **zero hospital entrance positions are independently verified**. The 70 supplementary maternity/public lying-in sites are separate and only 3 are geocoded. Switch the existing frontend fetch and backend approved-record source accordingly. Read `prompts/MIGRATE_QC_HOSPITALS_TO_PHILHEALTH.md` and implement that migration **before** simulation.

Read the root `AGENTS.md` and docs under `docs/` first. These instructions govern everything inside `apps/web/`.

## Existing implementation: preserve and evolve
- Next.js App Router 15, React 19, TypeScript, MapLibre GL 5, and Lucide icons are installed as declared in `apps/web/package.json`. **Recharts/Tailwind are not currently installed**; do not write code assuming either exists. Add only with a documented UI need and lockfile update; existing UI is in `app/globals.css`.
- Preserve `/dashboard` page, `components/ncr-map.tsx`, `app/api/boundaries/route.ts`, `app/api/simulate/route.ts`, `lib/types.ts`, and the imported 17-boundary GeoJSON. Add new routes/components rather than replacing the whole application.
- `app/api/boundaries/route.ts` currently reads a local `public/data/ncr-cities.geojson` relative to Next's runtime current directory. Keep or improve deployment-safe path handling and invalid-geometry reporting.
- `public/data/qc-philhealth-hospitals.json` is the **new active QC hospital feed** (46 rows, all with provisional coordinates). The current dashboard *still* fetches `/data/facilities.json` until Codex changes that fetch; **migrate this fetch**, never use legacy NHFR as fallback. The old 165-entry public file may remain solely for comparative audit.
- Existing historical validation widget covers **one-week-ahead backtest summaries**; it must not be mislabeled as 4-week prospective forecast accuracy.

## Information architecture
Keep `/dashboard` as overview and add routes as needed, preferably:
- `/forecast`: issue-date-specific historical cases, 1–4-week forecast run, observed comparison, interval/skill evidence.
- `/hotspots`: separate layers for *annual observed barangay burden* and *modeled weekly allocated demand*; disable layer with explanation when barangay data or geometry are absent.
- `/hospitals`: searchable paginated/filterable source-traceable inventory, ownership and capability filters, missing-coordinate and capacity flags; do not exclude non-geocoded records from the table.
- `/simulate`: 28-day hospital scenario workspace with admitted, surge, holding, unresolved demand, and methods/provenance.
- `/outbreak-response`: dedicated unexpected/off-season outbreak lab with day 0–28 slider and days 7/14/28 shortcuts, interventions and side-by-side scenarios.
- `/validation` and `/sources`: backtest details, caveats, bibliography, and dataset provenance.
Existing `/dashboard` stays the landing entry; add navigational affordances without a disruptive rewrite.

## Functional UI contract

User extension 2026-10-24 21:19:03 +08:00: preserve the left-sidebar Historical
replay/Future surge forecast tabs, independent controls, arbitrary 1–28-day
windows, future month/weather/surge controls and daily/peak hospital bed-demand
projections. No mandatory location selection. Future outputs are conditional
seasonal planning; actual census/vacancies remain unknown. See
`docs/future-seasonal-simulation.md` and the repository session handoff.

**User revision — 2026-10-24 20:14:55 +08:00:** default to automatic QC-only
case/environment-based forecasts; remove mandatory place selection. Show both
case-count ranges and numeric input limits, retain Philippines geographic
context, put observed-first case/patient metrics in the bottom bar, and nearest
hospital capacity on the right. Explicitly distinguish accredited beds from
assumed operational capacity and disclose experimental range coverage. See
`docs/qc-simulation-workspace.md` and `docs/change-request-log.md`.

**User extension — 2026-10-24 19:15:49 +08:00:** `/outbreak-response` must support
play/pause/restart/speed and specified dates, changing hotspot burden, nearest
hospitals, separate proximity/placement lines and reduced motion. All frames
derive from one saved engine run. See `docs/change-request-log.md`.
- One shared, versioned TypeScript contract for `ForecastRun`, `SpatialAllocation`, `ScenarioParameters`, `ScenarioResult`, `Facility`, `Evidence`, and machine-readable API error. Match Pydantic structures exactly with contract tests or schema code generation.
- Fetch actual backend-computed scenario results, never calculate a competing patient-flow model in React and never manufacture KPI values. The backend should return days 0–28 with consistent `dayIndex`, `date`, and cumulative/daily values.
- Slider, quick day buttons, map coloring, facility drill-down, charts, hospital table and exports must all derive from the **same immutable scenario run**; changing inputs invalidates old output and requires a new request. Disable Run when no supported forecast/capacity scenario exists.
- Show explicit labels: `Observed`, `Forecast from historical model`, `Allocated estimate`, `Hypothetical stress test`, `Unavailable`, `Not operationally verified`.
- For occupancy display at least: occupancy **relative to normal staffed capacity** (may exceed 100%), occupancy **relative to activated supported capacity**, number of extra supported surge placements, patients in temporary holding, unresolved demand, and counted admissions. Do not color everything over 100% as rejected patients.
- Provide uncertainty ribbons for validated predictive intervals and scenario uncertainty bands where actually computed; never create symmetric percentage bands as if calibrated intervals.
- Return/loading/error/no-data/empty states must be legible. Differentiate `422` unsupported inputs vs `503` unavailable integration. Preserve meaningful error messages; retry safely without reusing stale results.

## Map integrity
- Reuse MapLibre, `ncr-cities.geojson` with `properties.area_id`, and existing viewport/feature selection behavior. Add *independently sourced* QC barangay polygons only after verifying coverage, geometry and stable PSGC/name mapping.
- Never use the same color for observed dengue burden and modeled facility pressure without legend separation. Units and denominator must appear in legends/tooltips.
- Display historical annual barangay **counts** rather than calling them incidence/risk rates without population denominators. Projected barangay counts come from constrained QC allocations, not observed weekly barangay surveillance.
- Provisional facility coordinates must have visibly distinct symbols/legend and caveat. Unknown coordinates are represented in the table only. Bounds-check lng/lat and avoid mapping outliers.
- Keep selectors keyboard-accessible, tooltips readable, non-color-only status encoding, aria labels, reduced-motion preference, contrast checks, mobile scroll layout, and map-unavailable fallback data table.
- Protect MapLibre component from SSR (`next/dynamic` as already used), clean up layers/markers/listeners, and avoid reinitializing the map on slider changes. For larger feature counts use GeoJSON sources/layers instead of thousands of DOM markers.

## Next.js integration and security
- Use server-side BFF route handlers in `app/api/` to call the FastAPI service through server-only `ENGINE_BASE_URL` (with a safe local default in example configuration). Add explicit timeout, status forwarding, limited JSON payload size, and strict input validation.
- Do not expose `ENGINE_BASE_URL` or secrets with `NEXT_PUBLIC_` prefixes. Never accept arbitrary backend URLs from user input.
- Browser should send validated `scenarioId` or approved `facilityId` and editable **assumptions**, not a freely edited authoritative facility register. Resolve immutable source records server-side.
- Keep raw surveillance workbook or protected source files out of `/public`; publish only validated, permission-compatible derivative aggregates.
- Minimize dependencies and maintain App Router Server/Client component separation.

## Tests and completion checks
Run from `apps/web`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; when tools are installed add tests for day slider endpoints (0, 7, 14, 28), stale-response handling, scenario errors, source labels, 100%+ occupancy visual semantics, missing geocodes, separate city vs QC forecast, and a map fallback. Report every check honestly. Never display fabricated numeric results in screenshots/video.
