# User-requested extensions

## 2026-11-16 21:48:57 +08:00 — arrival slowed, then rebuilt as a bottom-up stack; document lines removed

Arrival slowed by 50%, then changed after a user-supplied Pinterest video (0:01-0:03,
frames captured in a local browser): the stack builds from the bottom up, each layer
rising out of the dark teal tile with a small settle, bottom band first, then middle,
top, platform and hospital; a soft glow gathers on the tile. A "twisting books" variant
was tried and reverted at the user's request. The decorative document lines and tab on
the top band were removed.

## 2026-11-16 21:23:25 +08:00 — layer hovers, sprouting arrival, Quezon City tile, header and hint removed

User requests in sequence:
- Hovering Dashboard, Simulation or Research animates the band its leader points to
  (top, middle, bottom): it slides out up-left, takes its label's text colour (teal,
  blue, sand) and casts a shadow. The model's earlier whole-part lifts are off here.
- Arrival: the parts sprout up out of the dark teal tile instead of sliding in from the
  sides: the hospital with its platform, then the top, middle and bottom bands; labels
  appear as their band arrives; the float starts afterwards.
- Quezon City's outline moved from the platform onto the dark teal tile, with diagonal
  stripes inside it and a "QUEZON CITY" label lying on the tile.
- Hovered map tiles rise half as much (15 px) and no longer brighten; light-grey stripes
  in the outline colour fill the inside of their city outline instead.
- The Home header bar and the "Hover or focus to explore" hint were removed; the intro
  words moved down by half their height and are 10% larger; Research label moved further
  (42% right, 60% down of its size).

## 2026-11-16 20:52:45 +08:00 — label positions and leader lines

User repositioned the model's labels: Dashboard onto the tile up-left of the hospital,
clear of the dark teal tile; Simulation and Research nudged by shares of their own size
(Simulation 15% right and 70% up, Research 35% right and 30% down, CSS `translate`
inside `.home-map-overlay`). Leader lines now start on the three thin layers under the
platform: the top layer for Dashboard, the middle for Simulation, the bottom for Research
(`components/landing-hero-art.tsx`).

## 2026-11-16 20:34:53 +08:00 — close-up field, real city outlines, single-tile hover, restored hospital model

User requests in sequence: a close-up of the field (tiles about 2.4x larger); tile
patterns based on real cities (only Metro Manila city boundaries ship with the project,
so the 16 other than Quezon City are used, simplified onto a 12 x 12 grid and traced in
the blocky style); only the hovered tile rises; tile patterns in the tile-border grey;
the earlier hospital navigation model brought back with its animation, its Dashboard,
Simulation and Research parts and labels, and the intro words; Quezon City's outline on
the platform under the hospital; the illustrative note removed. The user then asked to
keep the hospital where it was at tile scale: the model is placed by the map over the
dark teal Quezon City tile at the same size and float height as the canvas hospital it
replaces. Other Luzon cities (Angeles, San Fernando, Antipolo, Calamba) would need
boundary data the project does not have.

## 2026-11-16 19:28:23 +08:00 — four tiles light up on hover; the building floats too

User asked for the hover to look like a Pinterest pin (only its preview frame was
retrievable: pale tiles with single tiles raised and lit warm white from inside), with
four tiles for now, and for the hospital to float. Hovering now lights the hovered tile
and three nearby tiles in quick succession, raised slightly and glowing warm white with
light spilling around them. The building additionally floats above its platform with a
soft shadow. Details: [Home workspace](home-workspace-design.md).

## 2026-11-16 19:18:58 +08:00 — the hospital platform floats

User asked for the hospital tile to animate as if floating. The platform and hospital
bob 5 px up and down on a 3.2 s sine cycle above the dark teal tile, whose soft shadow
fades as the platform rises. Still under reduced motion. While no tile is raised, the
static field is cached so each frame only redraws the hospital. Details:
[Home workspace](home-workspace-design.md).

## 2026-11-16 19:08:02 +08:00 — hospital moved one tile right; a mini-map on every tile

User asked to move the hospital onto the tile they pointed at (one tile to the right on
screen) and for every tile to carry its own invented map inspired by a blocky world-map
reference, without its colours. The hospital tile moved via `cityStep` with the grid
anchored in place; each tile now has stepped landmasses with cut corners and small
islands. Details: [Home workspace](home-workspace-design.md).

## 2026-11-16 18:53:03 +08:00 — isometric line-art field, hospital on a floating platform

User asked for the tiles at an isometric angle, then for a look like a supplied
reference (pale diamond tiles with map-like line-art, the hospital on a layered platform
above a dark tile), keeping the interactive hover. Home now draws an isometric field of
invented line-art tiles; tiles near the cursor rise and glow terracotta; the hospital
floats on its layered platform above the dark teal Quezon City tile and still zooms into
the simulation when clicked. Details: [Home workspace](home-workspace-design.md).

## 2026-11-16 14:35:45 +08:00 — tiled field returns, with the hospital and the simulation palette

User asked to bring back the tiled-field format while keeping the cursor-bump hover,
to place the earlier isometric hospital on the darkest (Quezon City) tile, to match the
landing page's colours to the simulation page, to remove the Home status bar for now,
and then made the hospital smaller. The field is drawn on a canvas in the simulation
palette; every tile rises and glows terracotta around the cursor; the hospital stands
on the dark teal Quezon City tile at about the tile's width, and clicking it zooms into
the simulation. The southern Luzon cube grid and its generator were removed. Details:
[Home workspace](home-workspace-design.md).

## 2026-11-16 14:25:24 +08:00 — every cube interactive; cubes the size of the first blocks

User asked for all cubes to respond to hover, not only the white land cubes, and for
cubes the size of the first cube design (the 90 px tiled-field blocks). Water and the
Quezon City cube now rise and glow too (Quezon City only partly, to stay recognisable);
the grid is 16 × 10 cubes of 90 px, with the hover radius and lift scaled to match.
Shadows are now drawn as shading on cube tops beside taller neighbours. Details:
[Home workspace](home-workspace-design.md).

## 2026-11-16 13:44:18 +08:00 — southern Luzon as a cube map with a cursor glow

User changed direction: render their regional map of southern Luzon as cubes like a
voxel reference image (cubes about three times larger), with the hover animation of a
Pinterest pin. Only the pin's title was retrievable, so the hover follows the reference
image: land cubes rise in a smooth bump around the cursor and glow warm. The grid comes
from the shipped boundaries via `scripts/generate-home-map.py`; Quezon City's navy cubes
zoom into the simulation when clicked. Drawn on a canvas for performance. Hospital
pop-ups were dropped. Details: [Home workspace](home-workspace-design.md).

## 2026-11-16 13:29:56 +08:00 — sections become a tiled field of soft blocks

User changed direction and supplied a tiled 3D-block poster as inspiration for the
sections (not copied: no text, chevrons or orange). Home is now a grid of square
tiles split by a stepped edge into a honeydew zone and a powder-blue zone, with some
tiles resting raised as soft blocks with long shadows and a few dot patterns. Hovering
a flat tile raises it into a block and pops up illustrative hospital buildings; the
resting raised blocks are decoration and do not respond (user request). The navy
Quezon City tile near the centre zooms into the simulation when clicked. The field is
built in code from a fixed seed (`lib/home-city-map.ts`); the Python generator and
generated data file were removed. Details: [Home workspace](home-workspace-design.md).

## 2026-11-16 13:11:59 +08:00 — invented city plan; Quezon City district zooms into the simulation

User feedback in sequence: zoom out further; sections were too small, then too
uniform and "game like" (asked for cleaner, more varied blocks after a city-plan
reference); hospitals should pop up in the surrounding sections, not in Quezon City;
remove the hover hint chips and the Quezon City label; Quezon City need not be its
real shape, because its purpose is the transition: opening the simulation from Home
zooms into the small Quezon City district first.

Home now shows an invented, angled city plan (mixed street spacing, diagonal avenues,
a curved road, blocks subdivided into lots). Hovering a lot raises it and pops up
illustrative hospital buildings there only. A small unlabeled Quezon City district
near the centre pulses softly; clicking it zooms the map into it (900 ms, centred via
`zoomOrigin`) and then opens `/outbreak-response`; reduced motion navigates at once.
The page notes that the map, sections and buildings are invented. The real-data
version below (barangay sections, PhilHealth buildings) is superseded.

## 2026-11-16 12:55:44 +08:00 — angled city map; hospitals pop up only on hover

User supplied an angled illustrated city map as a style reference (not to be
copied) and asked that only Quezon City be real, with larger sections, and that
hovering a section pop up hospital buildings only there; no arrows or lines for
now; then zoomed out 30%. Home now shows an angled map: Quezon City's real outline
in 14 sections of grouped real barangays, invented blocks, roads and trees around
it, and on hover the section rises and its PhilHealth-accredited hospitals (all 46,
provisional points, height by accredited beds) pop up as small buildings. This
replaces the Manila Bay mosaic below. Details: [Home workspace](home-workspace-design.md).
No data, models or engine behaviour changed.

## 2026-11-16 12:38:34 +08:00 — Home becomes an abstract, hoverable map

User asked for a map on Home where hovering highlights and raises the area under
the cursor and its nearest hospitals appear along connecting lines, as on the
simulation map. A first attempt followed the user's design reference too closely
(centered two-line headline with the logo inline, single centered button, route
line and street line-art); the user rejected the copying and the large headline,
and asked for an abstract version of a regional map around Manila Bay instead.

Home is now an abstract mosaic map of the Manila Bay area generated from the
shipped boundary files, with Quezon City's real boundary dashed as the study area.
Tiles raise on hover/tap and link their three nearest invented hospital pins; the
map is labeled illustrative and hidden from assistive technology. The hospital
navigation model, dot field and their tests were removed; there is no headline or
call to action yet. Details: [Home workspace](home-workspace-design.md). No data,
models or engine behaviour changed.

## 2026-11-16 11:45:48 +08:00 — new SurgeWise logo on the landing-page-improvements branch

User asked for a `feat/landing-page-improvements` branch based on
`feat/ui-changes`, carrying the new logo they supplied on 2026-11-15 (navy "S"
and teal "W" ribbon, red line from a hotspot dot to a medical cross). Brought
over the transparent PNGs from `feat/new-logo`: `public/brand/surgewise-mark.png`,
`surgewise-mark-on-dark.png`, `surgewise-logo.png` and `app/icon.png`; removed
the old wave-mark SVGs and `app/icon.svg` (`hospital-pin.svg` stays).
`components/surgewise-mark.tsx` keeps its props and now renders the PNG
(`on-light` default; `on-dark`/`badge` use the light-S variant). The application
rail shows it at 28 px high (47 px wide) to fit the 54 px brand slot; the shared
loader shows it at 88 px. CSS that recoloured the old SVG's paths in the rail
and loader was removed, and `workspace-opening.test.mjs` now checks for the PNG.
No data, models or engine behaviour changed.

## 2026-11-16 02:30:23 +08:00 — shared brand loading and stable, clean map opening

User reported marker repositioning during refresh, hover-triggered lines and
legend inconsistencies, then requested smooth opening comparable with Dashboard.
The first camera/layout ordering and synchronous resize are corrected. Official
QC geometry controls the initial extent independently of scenario response timing.

Additional request: reuse a Facebook-style centered SurgeWise-logo loading screen
in the main content area, with Home's background and a restrained pulse. Home
shows it briefly before its existing animations start; maps use it while preparing.
Keep the application rail available. Preserve reduced motion, readiness/error
states and all backend features/data. Relevant specifications:
`docs/workspace-loading-design.md`, `docs/home-workspace-design.md`,
`docs/dashboard-workspace-design.md`, `docs/simulation-workspace-design.md`.

Latest revision removes overlap-guide lines entirely, including on click, while
preserving the intended proximity/context/saved-placement links. The optional
all-connections view now uses the same marker-centered renderer as inspection.
The legend shares line styles with the renderer and covers rank, provisional
hospital dot, unranked linked barangays, neutral/selected polygons, holding and
conditional expansion boundaries. Older hover/selection-guide requirements below
are superseded. No coordinates, forecasts, admissions or capacity definitions change.

## 2026-11-16 01:49:53 +08:00 — selection links, circular markers and smooth camera focus

User reported stretched barangay markers and detached guide lines. Fix the marker
layout rather than changing its data: MapLibre owns absolute geographic
positioning, and the circular inner symbol must fill its square container.
Only hovered/inspected icons reveal their overlap guide and coordinate anchor.

Clicking a barangay reveals links to the engine-ranked three nearest hospitals
and mapped hospitals inside it. Clicking a hospital shows incoming connections
and saved modeled placements involving that hospital. Direction stays barangay
to hospital, including hospital inspection; cosmetic chevrons do not imply live
patient movement, verified travel routes or referral advice. Proximity, modeled
placements and nearest-ranked context retain separate styles. Day zero has no
invented placements. Repeated selection retriggers the reveal; reduced motion
shows static links. The optional all-connections layer remains available.

Additional request: clicking a place from a wide map view should smoothly focus
the selected network, then move directly to another selected network. Frame all
linked endpoints and the selected barangay's official boundary, account for the
inspector and map overlays, cap close zoom, and avoid camera jumps during playback.

Scoped specification: `docs/simulation-workspace-design.md`. No backend or
scientific-model changes; all source coordinates remain unchanged.

## 2026-11-16 01:16:42 +08:00 — simulation redesign and inspector/marker refinement

User authorized the map-first simulation redesign while preserving important
features and information. Use Dashboard cartography and styling, one optional
contextual panel and a compact timeline. Consolidate redundant inspection and
export controls; preserve the complete modes/forms, 1–28-day windows, comparison,
charts/tables, assumptions, validation, sources and reproducible export.

Subsequent feedback: organize place/hospital inspection with aligned facts and
separate actions; remove thick marker outlines, unify hospital pins between pages,
add subtle pulses and reduce selected polygon outline thickness. The empty
red/green circles were duplicate underlying point/halo layers, not a new category.
Visible duplicate halos are removed, with tiny neutral coordinate anchors retained
for displaced icons. Pulses do not encode live status; reduced motion disables
them. Both pages use the same provisional hospital symbol without its outer white
border. Case colors use a darker ordered green/ochre/orange scale; rank numbers
remain annual burden ranks, not case counts or confirmed outbreaks.

Scoped specification: `docs/simulation-workspace-design.md`. No engine, API,
source dataset, capacity definition or simulation calculation changes.

## 2026-11-16 00:06:56 +08:00 — dashboard refinement and imagery deferral

Latest user revision: use a pin silhouette with a thick rounded medical cross
for hospitals; remove satellite and regional imagery while retaining 3D. Explain
the item behind the map key: it was the metric distance scale. Reserve separate
space below the key so both remain legible. These revisions supersede the
experimental imagery options added during the dashboard iteration.

The accepted dashboard direction removes the redundant header, prioritizes the
map and uses one optional explorer for Hospitals/Layers/Evidence and inspection.
Fullscreen hides the global rail. Custom dropdowns replace native geography and
ownership selectors; focus styling belongs to the complete search field; hospital
results scroll independently of source totals and filters. Palette and markers
follow Home's light surfaces and teal accents, with custom street cartography.
The Home-only dark mode was removed at the user's request because it was not
shared across workspaces. Home model/dot/label animations remain intact.

Scoped specification: `docs/dashboard-workspace-design.md`. Backend behavior,
datasets and simulation features remain unchanged. All hospital positions remain
provisional and accredited beds remain distinct from unknown operational beds.

## 2026-11-15 22:38:20 +08:00 — retain explicitly selected appearance

User clarified that selecting dark mode should survive refresh. Restore the
explicit light/dark choice from browser storage and save only user toggles.
Light remains the default with no valid saved preference or unavailable storage.
This supersedes the earlier always-light-on-refresh revision; Home-only scope
and all animation/navigation behavior are unchanged.

## 2026-11-15 22:34:01 +08:00 — coordinated label-arrow movement

User requested movement in label arrows to coordinate the entrance. Connector
lines now draw from each model part toward its label, starting 100ms before the
label fade. The label's arrow glides diagonally into place 80ms after that fade
begins, then retains its hover/focus nudge. Shared timing variables keep all three
parts aligned. All connector and arrow entrances run once per mount and respect
reduced motion. No additional background loops or changes to navigation/data.

## 2026-11-15 22:31:14 +08:00 — labels fade in as the model settles

User requested fading labels during the assembly. Research, Dashboard, then
Simulation labels fade and gently rise into place, timed to their corresponding
model groups. Each reveal lasts 620ms, starting at 720/1280/1580ms. Keyboard focus
reveals a label immediately without resetting the animation; reduced-motion
users see all labels immediately. Shared navigation is always available.

## 2026-11-15 22:27:55 +08:00 — grouped research entrance and slower assembly

User requested that the research sheets enter together, not individually, and
that the assembly be slightly slower. Use one entrance group for all research
sheets; increase each entrance from 850ms to 1000ms. Catchment starts at 600ms,
hospital at 900ms, and floating begins at the 2s mark, after the last arrival.
All existing navigation, hover/focus, and reduced-motion behavior remains.

## 2026-11-15 22:23:34 +08:00 — opposing-side hospital assembly

User requested an entrance that stacks the model's layers on first load, then
clarified that pieces should arrive from two sides and stack at the center.
Animate three evidence sheets, catchment and hospital in alternating left/right
entries, then begin the existing float after assembly. Preserve immediate
navigation, independent hover/focus emphasis, light default and reduced motion.
Scope: [Home workspace design](home-workspace-design.md#assembly-entrance).

## 2026-11-15 20:33:39 +08:00 — sync and publish the UI branch

User requested fetching/integrating main before committing and pushing the
current branch, `feat/ui-changes`. Fresh authenticated fetch confirms no new
main commits. Personal GitHub account `aquaryasss` is verified through the API;
use personal noreply author/committer identity and authenticated HTTPS because
SSH is unavailable. Keep the four pre-existing processed forecasting-artifact
edits local and outside this UI commit. No backend/source-data changes or deployment.

## 2026-11-15 20:24:49 +08:00 — always open Home in light mode

User requested light mode as the default. Remove restoration/persistence of the
Home theme so an older dark preference cannot override the light initial state.
Keep the current-visit light/dark toggle. Fresh mounts/reloads start light.
No other page, backend, source data, or simulation behavior changes.

## 2026-11-15 20:21:14 +08:00 — stronger dots and pointer response

User found the background dots nearly invisible and requested a subtle hover
effect. Increase dot size, contrast and faded coverage in both Home themes.
A separate, aligned dot layer softly enlarges/brightens the dots within 150px
of a fine pointer. Passive canvas listeners update presentation-only CSS
coordinates once per animation frame; pointer exit/cancel removes the highlight.
The layer never handles clicks. Coarse/touch pointers and reduced-motion users
retain the static field. No calculations, source data, or workspace features
change. See [Home workspace design](home-workspace-design.md).

## 2026-11-15 20:14:59 +08:00 — localized Home background dots

User accepted the sparse static dot-field recommendation. Add theme-aware dots
around the hospital with a soft mask fading near text/edges; adjust the mask for
narrow screens. Keep the decorative layer non-interactive and preserve the
hospital as the moving element. See [Home workspace design](home-workspace-design.md).

## 2026-11-15 20:12:16 +08:00 — Home inside the application

User replaced the standalone landing direction with a Home view in the shared
application frame. Retain the teammate's hospital motif, redesigned as clickable
architectural regions for Dashboard, Simulation, and Research. Use icons-only
navigation with custom hover/focus descriptions and visible current-page state.
Default to a refined light palette, with a Home light/dark toggle. Remove the
model heading, visible conceptual-facility caption, and sidebar QC/PH caption.
The hospital floats more visibly and stops on hover/focus; remove the pause
button. Tooltips must clear when the pointer leaves, including after theme clicks.
Respect reduced motion and preserve all backend behavior and existing features.
Git actions must use personal `aquaryasss`, never the work identity; no commit or
push has been performed. Scope: [Home workspace design](home-workspace-design.md).
Sparse background dots were approved in the subsequent entry above.

## 2026-11-15 00:38:57 +08:00 — public landing page

User requested a landing page inspired by a supplied isometric hospital-on-map
illustration and aligned with the SurgeWise light brand palette. `/` now renders
the landing page instead of redirecting to `/dashboard`; `/dashboard`,
`/outbreak-response`, `/research` and `/simulate` are unchanged and linked from it.
The hero art (`components/landing-hero-art.tsx`) is a decorative SVG that encodes
no data. Quoted figures (46 PhilHealth-accredited QC hospitals/infirmaries,
9,389 accredited beds, 142 barangays with observed annual counts 2010–2025,
28-day horizon) come from `lib/landing-facts.ts`; `lib/landing-facts.test.mjs`
checks them against the shipped hash-pinned files. Each figure carries its
measurement kind, and the page states the claim boundary: no live surveillance,
no vacancy reporting, no triage/referral, provisional hospital points. No data,
models or engine behaviour changed.

Revision (same day, user request): keep only the hero for now. The page is a
single full-screen navy stage with the headline, the two calls to action (QC
simulation, NCR map), three notes and the hospital scene with its three chips.
The stats row, walkthrough, workspace cards, honesty panel and footer were
removed. The navigation bar stays, linking to the QC simulation, NCR map and
Research pages. The hero shows the 46-hospital and 28-day figures, still
sourced from `lib/landing-facts.ts` and covered by its test.

Revision (same day, user mockup): the floating cards now preview the product —
a forecast card with a sample observed/forecast curve and legend, the hospital
count card, and a 28-day bed surge card with a sample 10-bed strip (occupied,
extra scenario bed, available) and an "Over capacity" tag. The curve and bed
fill are decorative samples, so the page captions them "Illustrative preview:
sample forecast curve and bed fill, not model output." Phones show two compact
cards and hide the detailed surge card and its caption.

Revision (same day, user request): one call to action only. The header button
and the hero "Explore the NCR map" link were removed; the hero button reads
"Open simulation". The header keeps text links to the QC simulation, NCR map
and Research pages (badge-only logo on narrow phones). Floating cards are
scaled to 84%, and "surge" in the headline is highlighted in powder blue
instead of a wavy underline.

## 2026-10-27 06:50 +08:00 — verify engine activation when the frontend opens

User reports the Render engine at `surgewise.onrender.com` still fails to start
despite configured `ENGINE_BASE_URL`. Traced `/` to `/dashboard`: it only reads
static inventory/validation and never runs the existing simulation/research wake
checks. Add a shared-layout mount check with connection status, retry and unmount
cancellation. Document frontend environment placement and the separate deployment
requirement to generate both ignored `.joblib` models with matching manifests.
See [Render deployment](render-deployment.md). Live hosting state remains unverified.
Tests also exposed Windows CRLF conversion in the hash-pinned hospital JSON;
restored exact approved Git bytes and protected the file with `.gitattributes`.
No hospital records or expected checksums were changed.

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
