# Codex task — migrate active QC hospital layer to the new PhilHealth dataset (REQUIRED BEFORE SIMULATION)

Read the root `AGENTS.md`, `apps/web/AGENTS.md`, `services/engine/AGENTS.md`, `data/AGENTS.md`, and `docs/hospital-dataset-source-of-truth.md`. First inspect code and the new packaged data files; these instructions target the already existing PJDSC repo. **Do not overwrite the existing UI or restart the codebase.**

## Objective
Replace the **active QC hospital network** derived from old `apps/web/public/data/facilities.json` (DOH/NHFR 165 NCR, 41 QC) with `apps/web/public/data/qc-philhealth-hospitals.json` (46 PhilHealth QC hospitals and infirmaries, Sept 30 2026; 9,389 accredited beds). The old registry remains archived for crosswalk research, not a second active QC hospital feed.

## Implement

1. Load and type the canonical 46-row JSON and validate its version and provenance using `data/processed/qc_philhealth_manifest_2026_10_24.json`. The backend must load approved immutable data independently, never trust a browser-submitted facility array.
2. Change existing `apps/web/app/dashboard/page.tsx` facility fetch to `/data/qc-philhealth-hospitals.json`. Adapt `lib/types.ts` for `accreditedBeds`, nullable operational fields and `coordinateStatus` without passing values into `authorizedBeds`. Preserve map and panel behaviors; make QC-only facility markers clearly labeled. For selected NCR, keep polygons and regional cases visible, but do not show an unsupported NCR-wide hospital capacity network.
3. Preserve `apps/web/public/data/facilities.json` and scripts importing NHFR as legacy research inputs **without running them in the active QC map/simulation path**. Never concatenate or sum NHFR and PhilHealth arrays. If a source crosswalk is needed, create reviewed mapping in `data/reference/` with correct IDs; do not auto-merge similar names.
4. Document all 46 coordinates as provisional with sources and explicit independent entrance verification absent. No code may claim `VERIFIED` merely because latitude/longitude exist. Render supplementary maternity/lying-in sites separately if implemented; 67 of 70 still lack coordinates, and they must not contaminate dengue hospital capacity.
5. Configure the simulation to use only admitted, eligible facility IDs resolved from the active PhilHealth source. Unknown dengue eligibility and staffed beds remain unknown; require visibly configured hypothetical capability/capacity scenario for a simulation. **Never treat all 9,389 accredited beds as currently usable dengue beds**.
6. Update `README.md` and `docs/data-sources.md` in the **actual codebase** after successful integration. Maintain existing forecast scripts and outbreak dashboard.

## Required automated checks

- Exactly 46 active QC hospital IDs (`HOSP-614`..`HOSP-659`), all unique, 46 finite point coordinates within actual QC municipal polygon, no duplicate exact hospital point pairs, and source/evidence URLs present.
- Source bed sum exactly 9,389 accredited beds, never NHFR 7,068, and all operational/dengue-specific capacities initially nullable.
- `HOSP-626` 143 Mindanao is (14.67053080,121.03208370); `HOSP-627` 46 Bukidnon is (14.65939000,121.02360000). They must not be accidentally merged or assigned the same point.
- `HOSP-649` San Lorenzo uses (14.73573000,121.06916000) within QC boundary, not old historic out-of-QC point.
- An absent/corrupt canonical file gives explicit failed/blocked state; **no silent fallback to `/data/facilities.json`**.
- QC map markers are provisional and filterable; the 70 maternity/lying-in supplemental facilities are never automatically included in the dengue hospital network.
- Run applicable Python tests, frontend lint, typecheck and production build. Report actual results, skips and unresolved clinical/entrance verification openly.
