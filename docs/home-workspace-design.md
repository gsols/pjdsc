# SurgeWise Home workspace

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
blue, and sand accents. A Home-only light/dark toggle changes the current visit's
appearance. Per the 20:24:49 revision, Home always starts light on a fresh mount
or reload and ignores older saved dark preferences. Its descriptions appear on pointer hover or
keyboard-visible focus, rather than persisting after a mouse click. The existing
analytical workspaces retain their existing light palette and controls.

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
  route identity, source/claim boundaries, and light default/theme affordance.
- Existing engine-startup tests isolate the new navigation import while retaining
  their original health-check, retry, cancellation, and failure assertions.

No new dependencies, API changes, source/model changes, commits, or deployments.
Use existing frontend checks; do not run npm ci against the running dev server.
The four modified processed forecasting artifacts predate this UI task and must
be preserved.

## Background texture

Approved 2026-11-15 20:14:59 +08:00. A sparse static dot field sits behind the
model, fading near copy and screen edges. Separate light/dark contrast tokens and
a narrower-screen mask keep it understated. The decorative layer ignores pointer
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
