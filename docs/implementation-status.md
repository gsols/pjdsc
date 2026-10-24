# Implementation status - 2026-10-24

## Delivered phase: mandatory PhilHealth migration

The existing dashboard, MapLibre map, App Router, city boundaries, legacy audit data and forecasting experiments are retained. Active QC hospitals now come exclusively from `qc-philhealth-hospitals.json`. Both consumers validate the same pinned source hash; backend also verifies manifest identity/metadata. Coordinates are tested against the actual shipped QC polygon. Counts, unique IDs, unique finite points, beds, null operational fields, source URLs, corrected Montano branch points and San Lorenzo position are checked. Failure never activates NHFR as fallback.

- `apps/web/lib/facilities.ts`: source integrity, geography and schema validation; stable provisional-status adapter preserving original evidence category.
- `apps/web/app/dashboard/page.tsx`: QC hospital source, loading/error state, source-reported totals, source links, search/ownership filters, provisional-layer toggle and table independent of map availability. NCR polygons remain explorable without implying a regional hospital network. Browser no longer submits the registry to simulation.
- `apps/web/components/ncr-map.tsx`: dashed provisional markers with explicit accessible descriptions.
- `services/engine/repositories/facility.py`: server-owned, fail-closed canonical inventory loader.
- `services/engine/main.py`: `/v1/facilities` and `/readiness`; legacy `/simulate` remains guarded and now forbids extra fields/nonfinite input.
- Local web ESLint config uses the existing Next.js rules and a declared pinned FlatCompat adapter. Next.js output tracing root is restricted to the web application, avoiding unrelated parent lockfile inference on Windows.
- README/data-source notes now describe the imported data and actual blockers. No source files, coordinates or benchmark outputs were regenerated.

## Verification performed

- `python -m pip install -r services/engine/requirements-dev.txt`: passed after network escalation; first sandbox attempt could not access PyPI.
- `python -m pytest -q`: **6 passed** (source integrity, invalid values, coordinates, missing/corrupt files, API error handling and simulation guards). Installed Starlette emits a TestClient/httpx deprecation warning.
- `python -m compileall -q scripts services/engine`: passed.
- `npm.cmd ci`: passed after network escalation. PowerShell blocks `npm.ps1`, so Windows commands use `npm.cmd`/`npx.cmd`.
- `npm.cmd test`: **4 passed** (canonical adapter, invalid data, legacy-path exclusion and loader failure/success with mocked HTTP responses).
- `npm.cmd run lint`: passed with the web-local Next.js configuration.
- `npx.cmd tsc --noEmit`: passed.
- `npm.cmd run build`: passed after setting the web-local tracing root; initial build failed while resolving an unrelated parent directory.
- Rendered browser checks: **not run**. Browser runtime discovery returned no available browser connections. Contract tests are not a substitute for visual, keyboard or mobile QA.
- Dependency installation reported 3 audit findings (moderate/high/critical); this migration did not apply unrelated dependency upgrades. Investigate before deployment.

## Current demonstration

1. Start the web application with commands in root README and open `/dashboard`.
2. QC is selected. After validation the inventory shows 46 records / 9,389 accredited beds, source date and provisional caveat.
3. Search `HOSP-626` then `HOSP-627` to inspect separate Montano branches. Select table rows to inspect address, source register and coordinate evidence. Search `HOSP-649` for corrected San Lorenzo point.
4. Toggle provisional markers, filter ownership, and select NCR to verify its polygons remain available without a regional hospital-capacity claim. The table remains usable if tiles cannot load.
5. Review the disabled Run control, missing historical-run notice, and absent-barangay-data explanation. Start FastAPI separately and inspect `/readiness` and `/v1/facilities`.

Steps above are manual verification instructions, not a claim that an interactive browser session was executed.

## Remaining scope and blockers

The mandatory source migration is implemented, but the full release definition of done is **not met**. No real historical forecast-to-admissions run, patient-flow engine, resource optimizer, scenario comparison or unexpected-outbreak lab is claimed in this change. The ordered next phase is the historical QC vertical slice, not a fabricated dashboard demo.

The case/weather workbook, trained joblib models, immutable dated API forecast-run objects, QC annual barangay counts and barangay boundaries are absent. Root README documents the source schema and existing train/backtest commands. Those commands generate evaluations/models and still require a reviewed forecast-run export/integration before simulation. Hospital staffed capacities and dengue eligibility are also absent and must be explicitly sourced or configured as labeled hypothetical assumptions. Future scenario work must test finite staffed/surge capacity, holding/unresolved separation, daily mass balance, activation lag, identical comparison inputs and day 0-28 behavior. Never use the full 9,389 accredited-bed inventory as operational dengue capacity.

No historical backtests were rerun, no upstream registry was re-downloaded, and no new performance, clinical capability, entrance accuracy or optimization-benefit claims are made.
