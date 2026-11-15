/**
 * Figures quoted on the public landing page (`app/page.tsx`).
 *
 * Every value is traceable to a shipped, hash-pinned data file and is checked
 * against that file by `lib/landing-facts.test.mjs`, so the marketing copy can
 * never drift from the data. Do not add figures that no shipped file supports.
 */
export const LANDING_FACTS = {
  /** Rows in public/data/qc-philhealth-hospitals.json (source-reported). */
  hospitals: 46,
  /** Sum of `accreditedBeds` in that file. Accredited, not staffed, free or dengue-usable beds. */
  accreditedBeds: 9389,
  /** Date of the PhilHealth register extract (HOSP_093026). */
  registerDate: '30 Sep 2026',
  /** Barangay rows in public/data/qc-annual-burden.json (observed annual counts). */
  barangays: 142,
  /** First and last `DC_<year>` columns in that file. */
  firstYear: 2010,
  lastYear: 2025,
  /** Patient-flow horizon of every hypothetical scenario (docs/surge-capacity-simulation-spec.md). */
  simulationDays: 28,
} as const;

export const formatCount = (value: number) => value.toLocaleString('en-US');
