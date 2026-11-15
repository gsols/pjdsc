# Dashboard workspace

Updated 2026-11-16 00:06:56 +08:00 (Asia/Manila). Presentation scope only;
simulation, forecasting, source observations and APIs are unchanged.

## Accepted layout

The map is the primary dashboard surface, inside the shared application rail.
There is no redundant page header or floating simulation launch card. Explore
opens one docked panel with Hospitals, Layers and Evidence sections. Hospital
inspection replaces the panel content rather than adding another floating card.
On narrow screens the explorer sits below the map. Fullscreen excludes the rail,
initially closes the explorer, and restores its previous section when exiting.
The in-app expanded fallback and Escape handling cover browsers without native
fullscreen support. Custom hover/focus labels describe map and rail controls.

Geography and ownership use a shared select-only combobox with Arrow/Home/End,
Enter/Space, Escape, typeahead and outside-click dismissal. Hospital search shows
one focus ring on its surrounding field. Search, ownership, source totals and
panel navigation remain visible while the hospital results region scrolls.
The inventory table remains available when the geographic map fails.

## Cartography and markers

OpenFreeMap provides the OpenStreetMap/OpenMapTiles street and building context.
`lib/dashboard-map-style.ts` applies the SurgeWise palette to water, land use,
parks, roads, buildings and labels before map tiles finish loading. Context
colors do not encode dengue burden, occupancy or capacity. Hospital pins use
deep teal, a thick rounded white medical cross and an amber provisional-location
dot. Custom labels appear on hover or keyboard-visible focus.

3D view tilts the camera and enables sourced, generalized building extrusions
where mapped. These are cartographic context, not verified hospital models.
Switching 2D/3D preserves source records, boundaries and hospital selection.
No patient-flow or other backend calculations run in the map component.

Latest user revision removes satellite and regional imagery. The experimental
EOX raster and optional MapTiler integration, controls and configuration example
were removed. There is no imagery credential dependency. The distance scale has
an explicit 18px height at 10px from the bottom; the map key starts 44px above the
bottom, leaving a 16px gap whether the key is collapsed or expanded.

## Data boundaries and verification

The existing validated PhilHealth QC loader remains authoritative: 46 records,
9,389 source-reported accredited beds, dated 30 September 2026. No verified
entrances, current occupancy, vacancies or dengue capacity are inferred.
NCR geography does not extend the QC hospital dataset. Empty filters, missing
registry, retry and map failure remain separate states; unavailable is not zero.
Legacy controls and stored validation remain in closed audit disclosures under
Evidence; the legacy Run button stays disabled. Simulation opens via its existing
route. The four pre-existing processed forecast artifact edits are unrelated.

Automated coverage includes canonical camera geometry, MapLibre paint validity,
preserved height expressions, single-panel rendering, QC-only coverage, missing
registry and filtered empty states, result-region accessibility and combobox
keyboard behavior. Browser checks were interrupted during feedback; do not claim
completed final visual/mobile/fullscreen QA without rerunning them.

Primary map references:

- [OpenFreeMap quick start and custom styles](https://openfreemap.org/quick_start/)
- [MapLibre building extrusion example](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)
