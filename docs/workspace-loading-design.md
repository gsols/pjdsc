# Shared workspace opening and loading

User-requested refinement, 2026-11-16 (Asia/Manila). The loading surface occupies
the main content region; the shared application rail stays available.

## Appearance and entry

`WorkspaceLoader` uses the existing SurgeWise SVG on Home's #eaf1f3 background,
centered in the visible workspace. Only the logo is visible. Its restrained
opacity/scale pulse indicates preparation; an accessible status label describes
the task. Reduced motion disables the pulse and transition. After readiness the
surface fades over 200ms, stops receiving pointer events and is hidden from
assistive technology. No fake percentage is displayed.

Home shows the logo briefly (320ms minimum) and waits for fonts with a 1200ms
ceiling. Its content stays inert and its model, label, connector and floating
animations remain paused. After the logo's 200ms exit the content is enabled and
those existing animation timelines begin. Timers are cancelled on navigation.
The mobile surface leaves the bottom application navigation uncovered.

The same component appears in the App Router loading fallback and in Dashboard
and Simulation while their maps prepare. Maps use actual readiness rather than
an artificial minimum duration. The dashboard waits for its initial camera and
map idle; the simulation waits for its official QC boundary extent, source
updates and initial marker layout before revealing on idle. Both have bounded
8-second presentation fallbacks so failed tile requests cannot leave an opaque
surface indefinitely. Existing map/engine/data error states remain available.

## Stable map behavior

Simulation's opening/reset extent comes from the imported official QC polygons,
independent of asynchronous scenario response timing. The initial fit resizes
the map synchronously, uses zero duration and precedes collision layout. Markers
are hidden while their initial screen offsets are assigned. Only the first
marker cohort fades in. Later explicit selections retain their smooth 850ms
network camera framing; playback does not refocus the camera.

Hover and keyboard focus show labels and pause cosmetic pulses; neither creates
lines. Overlap-guide lines are removed, including during selection. Only explicit
inspection connections or the user-enabled all-connections view appear. Both
use one SVG renderer with endpoints following the displayed icons. Source
coordinates are never rewritten. Dashed proximity/context links remain separate
from solid saved-day placements, with holding shown in ochre. Shared style
constants drive the renderer and legend; zero placements are never invented.

## Verification

Tests cover Home's phased entry/font ceiling/cancellation, loading accessibility,
initial camera ordering/context independence, hover/click guide suppression,
readiness cleanup, shared legend styles, placement gating and existing controls.
The local software-graphics browser verified the centered logo, paused/resumed
Home assembly, both map openings, stable marker frames, hover-only labels,
relevant clicked networks, matching legend, mobile geometry and reduced motion.
See the session handoff for final command results and limits.
