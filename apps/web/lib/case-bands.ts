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
/** Smooth display color, scaled to a fixed full-window maximum; never a risk threshold. */
export function caseColor(value: number, maximum = 50) {
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(maximum) || maximum <= 0) throw Error('Invalid case color scale.');
  const scaled = Math.min(50, value / maximum * 50);
  const lower = [...CASE_BANDS].reverse().find(band => scaled >= band.min)!;
  const upper = CASE_BANDS[CASE_BANDS.indexOf(lower) + 1];
  if (!upper) return lower.color;
  const fraction = (scaled - lower.min) / (upper.min - lower.min);
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const a = rgb(lower.color), b = rgb(upper.color);
  return `rgb(${a.map((channel, i) => Math.round(channel + (b[i] - channel) * fraction)).join(', ')})`;
}

export function interpolateCaseValues(previous: Map<string, number>, target: Map<string, number>, fraction: number) {
  const t = Math.max(0, Math.min(1, fraction));
  return new Map([...target].map(([id, value]) => [id, (previous.get(id) ?? 0) + (value - (previous.get(id) ?? 0)) * t]));
}
export function addDateDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
