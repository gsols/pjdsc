# Animated QC scenario workspace

Request recorded: **2026-10-24 19:15:49 +08:00**. See
`change-request-log.md` for the user-requested additions and scoped guidance.

Open `/outbreak-response` (`/simulate` redirects there). The dashboard button and
research workspace both link to it. Start FastAPI on port 8000 and Next.js with
server-only `ENGINE_BASE_URL=http://127.0.0.1:8000`; see the main README.

## Use

1. The server loads an explicitly hypothetical preset immediately. Press Play.
   Play/pause, restart, 0.5/1/2/4 days per second, a day slider and day 0/7/14/28
   shortcuts control the same immutable saved result. Reduced motion disables
   moving dots and automatic playback after a new run.
2. Select a highlighted barangay or a ranked hotspot to inspect its name,
   modeled daily/cumulative burden and three nearest registered hospital points.
   Click a hospital point, map label or nearest-hospital row for census/pressure
   and coordinate evidence. All 46 canonical points stay visible.
3. Purple dashed lines are three-nearest proximity connections. Teal/orange
   lines show actual expected supported/holding placements from the selected
   barangay in the current daily interval. Their width encodes expected patients;
   moving dots only illustrate direction. Clear the selection to show placements
   from all ten ranked scenario hotspots. Lines are not road routes.
4. Edit onset/end dates (1–28 elapsed days), the origin, additive case amplitude,
   initial radius, km/day expansion, step/ramp shape and growth duration. Choose
   hospitals and resource assumptions, then Run. Previous results clear as soon
   as model inputs change; changing only playback, selection or link visibility
   does not recalculate disease or patient flow.
5. Export the full JSON, including all frames, timestamps, source and code hashes,
   software versions, annual cutoff, assumptions, hospital placements and checksum.

## What is modeled

The city reference is a server-approved QC historical 1–4-source-block forecast.
Each block is disaggregated uniformly into seven daily expected counts. User
calendar dates label the hypothetical planning scenario; they **do not** resolve
the disputed source-week calendar or make the historical reference a real forecast
for arbitrary future dates.

Annual weights use the latest completely populated source year available under
the existing one-additional-full-year lag, before both reference and scenario
years. Add-one smoothing is an assumption. The annual/city total discrepancies
and two project polygon-ID crosswalks remain documented in the source audit.

The shock is additive: at full intensity, assumed extra cases/week divided by
seven. A ramp increases to full intensity over configured days; a step begins at
full intensity. A truncated Gaussian kernel distributes only the added component
inside a configured expanding radius measured between projected polygon
points-on-surface. The reference component retains annual weights. Spatial sums
equal the city reference plus shock every day. This is **not** a calibrated
transmission model, a reproduction number, or observed weekly barangay spread.

All distances use Haversine km between these representative points and the
canonical provisional hospital coordinates. The nearest-three list includes
registered hospitals with unknown capability. Eligibility is assumed only for
sites explicitly configured in the scenario network; the display distinguishes
sites outside that network. The 2026 registry is a planning network, not proof of
historical hospital operations or current admission availability.

The existing patient-flow function now accepts server-generated daily barangay
groups with approved distance-ranked hospital IDs. Deterministic greedy assignment
uses nearest residual supported capacity, then nearest finite holding space.
Holding promotion, LOS discharges, baseline non-dengue occupancy, surge activation,
unresolved exits and day-by-day mass balance use the same engine as the previous
research replay. This is a transparent baseline, **not** an optimizer or referral
policy. Fractional outputs are expected patients, not observed people.

Day 0 is the zero-dengue warm-start snapshot at onset 00:00 +08:00. Day k is the
snapshot at onset plus k elapsed days. The kth daily interval is half-open:
`[onset+(k-1) days, onset+k days)`. Snapshot and interval timestamps are returned
explicitly. A final date seven days after onset produces eight snapshots (0–7).

## Contracts and checks

- `GET /v1/outbreak-demo`: named server-configured illustrative preset.
- `GET /v1/outbreak-context/{forecastRunId}`: 142 polygon anchors, cutoff-safe
  weights, 46 provisional hospital points and nearest-three distances.
- `POST /v1/outbreak-scenarios`: strict `hypothetical_shock` contract, explicit
  date/network acknowledgments, bounded finite parameters and approved IDs.
- `GET /v1/outbreak-scenarios/{scenarioId}`: saved input/output provenance, result
  checksum and canonical source validation. Identical parameters/sources/code
  reuse the first artifact; exclusive publication prevents timestamp replacement.

Both engine and BFF enforce a 32 KB request limit. The BFF uses a server-only
backend URL and timeout. Source checksums are checked before calculations;
there is no legacy NHFR fallback or browser-submitted authoritative capacity.
Geospatial runtime versions are declared in the engine requirements.

Executed checks: locked offline frontend install, clean production build
(including lint/type validation), 26 Python tests and 9 Node tests passed. They cover polygon
point containment, nearest ordering, spatial and patient conservation, zero shock,
date/year boundaries, finite overflow, admission delay, activation timing, short
date ranges, persisted identical results, invalid inputs, NCR/live rejection and
playback day bounds. Browser interaction/visual QA could not run: the Browser
skill reported no connected browser. The actual HTTP smoke command passed:
`python scripts/smoke_outbreak.py --web-url http://127.0.0.1:3000`.
It checked the movie page and redirect, BFF preset, all 142 anchors and 46
hospitals, day 0/7/14/28 frames, spatial/census conservation, placement records,
saved identical output, changed-date/zero-shock scenario, and live-mode rejection.
The preset origin is Commonwealth. Its nearest provisional point proxies are
Fairview General Hospital (1.30 km), Healthway Hospital Fairview (1.80 km), and
Rosario Maclang Bautista General Hospital (1.87 km), measured from the barangay
representative point. These are not confirmed entrances, road distances or
verified dengue service availability.

During validation, the existing Next.js dev server held the Windows SWC binary
open and blocked `npm ci`. The project frontend was stopped, the exact lockfile
dependencies restored from npm cache, and the dev server restarted on port 3000
with the existing reload-enabled engine on port 8000. No raw source changes.
