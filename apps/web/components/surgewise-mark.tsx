/**
 * SurgeWise logo mark: one continuous wave stroke that reads "SW".
 * - Red dot (start): the first hotspot, where an outbreak begins.
 * - S: the surge of dengue cases rising from it.
 * - W: the wave rolling on through the city.
 * - Shrinking dots (end): the forecast, looking ahead with growing uncertainty.
 * The same artwork is published as standalone files in /public/brand.
 */
type Variant = 'on-dark' | 'on-light' | 'badge';

const WAVE = 'M 21 82 C 25 90.5 31.5 95 38.5 95 C 47.5 95 53.5 89 53.5 80.5 C 53.5 70 43.5 67 37.5 64 C 30.5 61 23.5 57 23.5 46.5 C 23.5 37 30.5 31 38.5 31 C 46 31 51.5 34.5 54.5 41 C 57 46.5 57 69.5 57.5 79.5 C 58 89.5 61 95 66.5 95 C 72 95 74.5 89.5 75.5 79.5 C 76.5 67.5 77 50 81 50 C 85 50 85.5 67.5 86.5 79.5 C 87.5 89.5 90 95 95.5 95 C 101 95 103.5 89.5 104 79.5 C 104.5 67 104.5 52 105 41';

const COLORS: Record<Variant, { wave: string; trail: string; ring: string; badge?: string }> = {
  'on-dark': { wave: '#a8dadc', trail: '#f1faee', ring: '#1d3557' },
  'on-light': { wave: '#1d3557', trail: '#457b9d', ring: '#f1faee' },
  badge: { wave: '#a8dadc', trail: '#f1faee', ring: '#1d3557', badge: '#1d3557' },
};

export default function SurgeWiseMark({ size = 28, variant = 'on-dark', className }: { size?: number; variant?: Variant; className?: string }) {
  const c = COLORS[variant];
  return <svg className={className} width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
    {c.badge && <rect width="128" height="128" rx="28" fill={c.badge} />}
    <g transform="translate(64 64) scale(.88) translate(-64 -64) translate(9 6) skewX(-8)">
      <path d={WAVE} fill="none" stroke={c.wave} strokeWidth={size < 40 ? 12 : 10.5} strokeLinecap="round" strokeLinejoin="round" />
      <g fill={c.trail}>
        <circle cx="105.8" cy="29.5" r="4.6" />
        <circle cx="108.6" cy="20" r="3.4" />
        <circle cx="112.4" cy="12.2" r="2.3" />
      </g>
      <circle cx="20.5" cy="82" r={size < 40 ? 10.5 : 9.5} fill="#e63946" stroke={c.ring} strokeWidth="3" />
    </g>
  </svg>;
}
