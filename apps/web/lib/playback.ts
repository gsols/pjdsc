/** Pure view helpers; disease and patient calculations stay in the engine. */
export function nextPlaybackDay(day: number, duration: number) { return Math.min(duration, day + 1); }
export function validateDateWindow(start: string, end: string): string | null {
  const days = (Date.parse(`${end}T00:00:00+08:00`) - Date.parse(`${start}T00:00:00+08:00`)) / 86400000;
  return Number.isInteger(days) && days >= 1 && days <= 28 ? null : 'Choose an end date 1–28 days after onset.';
}
export function formatScenarioDate(date: string) {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}
