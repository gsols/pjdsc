/** Display bins only: these are not public-health outbreak thresholds. */
export const CASE_BANDS = [
  { min: 0, max: 5, label: '0–<5', color: '#284f61' },
  { min: 5, max: 10, label: '5–<10', color: '#488c8a' },
  { min: 10, max: 25, label: '10–<25', color: '#b7b06b' },
  { min: 25, max: 50, label: '25–<50', color: '#e89a5c' },
  { min: 50, max: Infinity, label: '50+', color: '#ed645b' },
];
export function caseBand(value: number) {
  if (!Number.isFinite(value) || value < 0) throw Error('Case burden must be finite and nonnegative.');
  return CASE_BANDS.find(b => value >= b.min && value < b.max)!;
}
export function addDateDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
