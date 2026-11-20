# SurgeWise Home workspace

## Isometric line-art field (user revision 2026-11-16 18:53 +08:00)

This supersedes the flat tiled field below; the hover is kept. Following the user's
reference, the field is drawn in the hospital drawing's isometric projection (tile
slope 25 : 14.5) as a 22 × 22 grid of 210 px-wide diamond tiles that covers the whole
canvas (`buildField`, `project`/`unproject` in `lib/home-city-map.ts`).

- Tiles are pale greys. Revision 2026-11-16 19:08 +08:00: each tile carries its own
  invented mini-map inspired by a blocky world-map reference (pattern only, not its
  colours): one or two landmasses grown on a 9 × 9 cell grid, traced along cell edges
  (`traceCells`, after `fillPinches` removes corner-only contacts) with some corners cut
  into short diagonals, plus small box and slanted-bar islands. Not geography.
- The hospital moved one tile to the right on screen (`cityStep`); the grid itself stays
  anchored where it was (`anchorAt`).
- Revision 2026-11-16 19:18 +08:00: the hospital platform floats, bobbing 5 px on a
  3.2 s sine cycle (`BOB` in `components/home-area-map.tsx`) above a soft shadow on the
  teal tile that fades as it rises. No bob under reduced motion. While no tile is raised
  the static field is painted once into an offscreen cache and each frame only copies it
  and redraws the hospital; during hover the full field is repainted.
- Hover (revision 2026-11-16 19:28 +08:00, after a user-supplied Pinterest pin whose
  preview frame shows single tiles lit from inside): hovering a tile lights four tiles,
  the hovered one and three nearby ones within 2 tiles (`glowTiles`, seeded so a tile
  always lights the same set; never the hospital tile). They start 90 ms apart, rise
  14 px and turn warm white with a bloom and light spilling onto neighbouring tiles;
  moving on settles them. A small red dot marks the cursor; tiles are painted back to
  front along diagonals. Reduced motion skips easing.
- The hospital building also floats about 6 px above its platform on its own 2.4 s
  rhythm, with a soft shadow on the platform (`HOVERING`); the platform and building
  are separate images (`HOSPITAL_PLATFORM_SVG`, `HOSPITAL_BUILDING_SVG`).
- The hospital (`lib/home-hospital.ts`) now includes its layered site platform and
  floats 26 px above the dark teal Quezon City tile, rising with it. Clicking the tile
  or the hospital zooms in and opens `/outbreak-response`.
- Tests: `lib/home-city-map.test.mjs` covers determinism, full-canvas coverage,
  projection round trips and slope, the Quezon City placement, line-art bounds, falloff,
  colour mixing and zoom.

## Tiled field with cube hover, hospital and simulation palette (user revision 2026-11-16 14:35 +08:00, superseded)

This supersedes the cube map below. The user brought back the earlier tiled-field
format and kept the cursor-bump hover.

- `lib/home-city-map.ts` (`buildField`) builds a 16 × 10 field of 90 px tiles from a
  fixed seed: a stepped edge splits a pale sage zone from a teal-sage zone, with lighter
  accent tiles, dot-pattern tiles and one Quezon City tile near the centre.
- `components/home-area-map.tsx` draws it flat on a canvas. Every tile within 280 px of
  the cursor rises into a cube (up to 64 px) and blends towards terracotta, easing each
  frame; taller neighbours shade a tile's top; a white dot marks the cursor; everything
  settles when the pointer leaves. Reduced motion applies it without easing.
- Colours come from the simulation page (`qc-simulation.css`): sage ground `#f1f6f4`,
  borders `#d3e1db`, dark teal primary `#225d61` for the Quezon City tile, raised
  barangay terracotta for the glow. The Home header uses the same text and border tones.
- The isometric hospital from the earlier design (`lib/home-hospital.ts`, recoloured in
  the same palette) stands on the Quezon City tile at about the tile's width and rises
  with it. Clicking that tile zooms the canvas ~9x into it, then opens
  `/outbreak-response`.
- The status bar is removed for now (user request). The page keeps the note
  "Illustrative: the tiles are invented; heights and colours are decorative."
- The southern Luzon generator and grid data were removed.

## Cube map of southern Luzon (user revision 2026-11-16 13:44 +08:00, superseded)

This supersedes the tiled field below. The user asked for their regional map of
southern Luzon broken into cubes like a voxel reference image, with cubes about three
times the reference's size, and a hover animation from a Pinterest pin ("Minimalistic
Cube Satisfying Animation"). Pinterest returned only the pin title to automated
fetching, so the hover follows the user's reference image: cubes rise around the cursor
with a warm glow.

- Revision 2026-11-16 14:25 +08:00: every cube is interactive (water and Quezon City
  too), and cubes are 90 px, the size of the first tiled-field blocks, giving a coarse
  16 × 10 grid. Metro Manila no longer gets its own cubes at this size, and Quezon City
  is the single cube holding its centre.
- `scripts/generate-home-map.py` turns `philippines-context.geojson` (land/water) and
  `ncr-cities.geojson` (Metro Manila, Quezon City) into a 16 × 10 grid, one character
  per 90 px cube (`.` water, `l` land, `m` Metro Manila, `q` Quezon City), written to
  `lib/home-city-map-data.ts`. A cell is land when at least 42% of it is land.
- `components/home-area-map.tsx` draws it on a canvas (cover fit, device-pixel aware):
  flat blue water cubes, white land cubes with decorative smoothed-random heights, a
  navy Quezon City cube; taller neighbours above or to the left shade a cube's top.
- Hover: every cube within 280 map px of the cursor rises up to 64 px with a smooth
  falloff and blends to a warm coral (the Quezon City cube only partly, so it stays
  recognisable), easing each frame; a white dot marks the cursor; everything settles
  when the pointer leaves. Reduced motion applies it without easing.
- Clicking a Quezon City cube zooms the canvas ~9x into the Quezon City cubes over
  900 ms, then opens `/outbreak-response` (prefetched). The pointer cursor appears there.
- The canvas is `aria-hidden`; the rail is the accessible route. The page notes
  "Illustrative: southern Luzon simplified into cubes; heights and colours are decorative."
- Hospital pop-ups were dropped in this revision; they can return on top of the cubes.
- Tests: `lib/home-city-map.test.mjs` (grid validity, sensible geography, deterministic
  heights, falloff, colour mix, cover fit, zoom origin) and
  `lib/landing-navigation.test.mjs` (canvas hidden from assistive tech, nothing zooming
  at rest, claim boundaries).

## Tiled field of soft blocks (user revision 2026-11-16 13:29 +08:00, superseded)

This supersedes the city plan below. Home is a field of 90 px square tiles built in
code from a fixed seed by `lib/home-city-map.ts` (`buildField`), drawn by
`components/home-area-map.tsx`. Inspired by a user-supplied 3D-block poster; no text,
chevrons or colours were copied.

- A stepped edge climbing from lower left to upper right splits the field into a
  honeydew zone and a powder-blue zone; hairline grid lines; a few dot patterns.
- About 12% of tiles rest raised as soft blocks (top shifted up-left, right and front
  faces, long blurred shadow to the lower right). They are decoration: they catch the
  pointer, never rise further and never show hospitals.
- Hovering or tapping a flat tile raises it smoothly to 42 px (instant under reduced
  motion), then pops up its illustrative hospital buildings (white cubes with a red
  cross) only there. Some tiles have none; nothing appears at rest.
- The navy Quezon City tile near the centre pulses softly; clicking it zooms the field
  ~9x into it over 900 ms, then opens `/outbreak-response` (prefetched).
- The page notes "Illustrative: the sections and hospital buildings are invented."
- Tests: `lib/home-city-map.test.mjs` (determinism, zones, decorative blocks without
  hospitals, Quezon City tile, block faces, zoom origin) and
  `lib/landing-navigation.test.mjs` (nothing raised or zooming at rest, claim boundaries).

## Invented city plan and zoom into the simulation (user revision 2026-11-16 13:11 +08:00, superseded)

This supersedes the section below. The map is entirely invented, generated by
`apps/web/scripts/generate-home-map.py` (no source data needed): an angled city plan
with mixed street spacing, diagonal avenues, a curved road and blocks subdivided into
lots of varied size, in calm SurgeWise tones.

- Hovering or tapping a lot raises it and pops up its illustrative hospital buildings,
  only there; nothing pops up at rest. No lines, arrows, labels or hint chips.
- A small Quezon City district near the centre (not its real shape, unlabeled) is
  the transition into the simulation: clicking it zooms the map ~9x into the district
  over 900 ms (origin from `zoomOrigin`, which accounts for the "slice" fit), then
  navigates to `/outbreak-response`, which is prefetched. Reduced motion navigates
  immediately. The rail stays the accessible route to every workspace.
- The page notes "Illustrative map: the city plan, sections and hospital buildings
  are invented." No headline or call to action yet.
- Tests: `lib/home-city-map.test.mjs` (section/building consistency, district
  position, zoom origin, building faces), `lib/landing-navigation.test.mjs`
  (no buildings, zoom or labels at rest; claim boundaries).

## Angled city map with hospital buildings (user revision 2026-11-16 12:55 +08:00, superseded)

This supersedes the hospital navigation model, dot field, "no city blocks or street
plan" rule and the interim Manila Bay mosaic. The user supplied an angled
illustrated city map as a style reference and asked not to copy it: no road names,
labels, layout or palette were taken from it.

Home is a full-canvas angled (rotated, vertically squashed) city map generated by
`apps/web/scripts/generate-home-map.py` (fixed seed, output
`apps/web/lib/home-city-map-data.ts`):

- **Real:** Quezon City's outline and its 14 sections, each a group of neighbouring
  real barangays from `qc-barangays.geojson`, so section edges follow real
  barangay boundaries. Buildings mark all 46 PhilHealth-accredited hospitals at
  their provisional register points, each in the section containing it; height
  follows accredited beds. Tests check every hospital appears exactly once and that
  section counts sum to the register total.
- **Invented:** every block, road, tree and open blue area outside Quezon City.
- **Interaction:** hovering or tapping a section raises it (deep teal-navy top,
  darker side, soft shadow) and pops up only that section's hospital buildings,
  one after another. Sections without hospitals rise but show none. Nothing pops up
  at rest; surroundings do not respond. No connecting lines or arrows (user request).
- A chip names the hovered section and its hospital count in text. The drawing is
  `aria-hidden`; an on-canvas note states what is real and what is illustrative.
- No large headline or call to action for now, at the user's request; the page
  keeps a screen-reader-only heading. The rail provides navigation.
- Reduced motion shows the raised section and buildings without animation.
- Tests: `lib/home-city-map.test.mjs` (hospital coverage, section counts, building
  faces) and `lib/landing-navigation.test.mjs` (claim boundaries, no headline,
  nothing raised at rest).

The sections below describe earlier revisions and are kept for history.

Latest user revision (2026-11-16): Home now uses the shared centered SurgeWise-logo opening. Its content is inert and all assembly/label/connector/floating timelines stay paused until the brief logo screen clears. Existing navigation and hover/reduced-motion behavior remain. See `workspace-loading-design.md`.

Scope agreed 2026-11-15 (Asia/Manila). This is a presentation and navigation
change; forecasting, simulation, source data, and existing workspace controls are
outside its scope.

## Accepted design

Home is a view inside the application, not a standalone promotional website.
A persistent navigation rail links Home, Dashboard, Simulation, and Research.
The rail contains icons only, with custom hover/focus descriptions, accessible
names, and a current-page indicator. Escape dismisses rail descriptions. On
narrow screens the rail becomes bottom navigation and reserves content space.

Home develops the teammate's isometric hospital construction into an architectural
navigation model, retaining the tower/annex silhouette. Its catchment platform
opens `/dashboard`, the hospital opens `/outbreak-response`, and its supporting
evidence sheets open `/research`. Both the drawing and ordinary labeled links
provide navigation. Pointer hover and keyboard focus emphasize matching parts.
Mobile labels appear in a stacked list below the drawing. The drawing encodes no
real facility, coordinates, clinical capabilities, measured cases, or occupancy.

The default Home appearance uses cool light surfaces, navy text, and muted teal,
blue, and sand accents. During the dashboard revision the user removed the
Home-only light/dark toggle because the other workspaces do not share that theme.
Home and the shared rail now use the light palette without browser theme storage
or an initializer. This supersedes the earlier explicit-choice persistence
request. See `docs/dashboard-workspace-design.md` for the dashboard styling.

The model floats 18 CSS pixels over a five-second repeating cycle. Hovering or
focusing the model stops it at its current position; leaving resumes it. There
is no pause button or spinning. System reduced-motion preference disables both
the float and positional emphasis transitions. No animation affects calculations.

The user removed the visible conceptual-facility caption, model-index heading,
and sidebar geographic caption. Scientific status remains in a compact in-app
status strip: historical evidence, hypothetical scenarios, and no live
surveillance/bed availability. The scenario horizon comes from checked
`lib/landing-facts.ts`, never a separately maintained numeric copy.

## Files and integration

- `app/layout.tsx`, `components/app-navigation.tsx`, `app/app-shell.css`: shared
  application navigation and a keyboard skip link. Existing page components stay
  in place. Initial root engine startup remains unchanged.
- `app/page.tsx`, `components/home-workspace.tsx`, `components/landing-hero-art.tsx`,
  `app/landing.css`: Home presentation, appearance, navigation illustration, motion.
- `lib/landing-navigation.test.mjs`: server-rendered destinations, accessible
  route identity, source/claim boundaries, and shared light appearance without an isolated theme toggle.
- Existing engine-startup tests isolate the new navigation import while retaining
  their original health-check, retry, cancellation, and failure assertions.

No new dependencies, API changes, source/model changes, or deployments.
Use existing frontend checks; do not run npm ci against the running dev server.
The four modified processed forecasting artifacts predate this UI task and must
be preserved.

## Background texture

Approved 2026-11-15 20:14:59 +08:00. A sparse static dot field sits behind the
model, fading near copy and screen edges. Light-palette contrast tokens and a narrower-screen mask keep it understated. The decorative layer ignores pointer
input and adds no semantic content. No city blocks or street plan; the soft radial atmosphere remains underneath.

Revision 2026-11-15 20:21:14 +08:00: the user requested more visible dots and a
hover response. The base dots now have a 1.15px radius, stronger theme contrast,
and wider mask coverage. `components/home-dot-field.tsx` supplies a second,
aligned dot texture with a 150px pointer mask: local dots brighten and grow to
1.65px. Passive pointer events use one queued animation frame, not React renders,
and are removed on unmount. Pointer exit/cancel fades the effect and cancels any
queued work. The overlay is decorative, hidden from assistive technology, and
never captures pointer input. Touch/coarse pointers and reduced-motion settings
retain the static background. `lib/home-dot-field.test.mjs` covers coalescing,
relative coordinates, pointer exit, cleanup, and input/motion exclusions.

## Assembly entrance

User extension and clarification, 2026-11-15 22:23:34 +08:00: on Home load,
layers enter from opposite sides and assemble at the model's center. Per the 22:27:55 revision, the three research sheets travel together as one
stack. That stack, the catchment, and the hospital enter in that order, alternating
left/right with a small vertical settling offset. Each entrance lasts 1000ms;
the final hospital settles at 1.9 seconds and floating starts at 2 seconds.
Entrance transforms live on inner SVG groups; the existing linked regions own
hover/focus transforms independently. Shared navigation remains available throughout. Per the 22:31:14 revision,
model labels fade in with a 7px upward settle as each part arrives: Research at
720ms, Dashboard at 1280ms, Simulation at 1580ms, each over 620ms. Keyboard focus
reveals a destination immediately without restarting the entrance timeline;
reduced motion shows labels immediately. No animation state is stored, so it plays once per Home
mount, not on theme changes or hover. System reduced-motion preference shows the
fully assembled static model immediately. No backend or source-data changes.

Connector lines and label arrows now share the Research/Dashboard/Simulation
reveal timing variables (22:34:01 revision). Each connector's origin fades in and
its normalized path draws toward the label over 620ms, starting 100ms before the
label reveal. Arrow icons glide 5px diagonally into their resting positions over
650ms, starting 80ms after label reveal begins. The existing hover/focus arrow
nudge remains independent. Reduced motion shows complete lines and static arrows
immediately; no new repeating motion is introduced.
