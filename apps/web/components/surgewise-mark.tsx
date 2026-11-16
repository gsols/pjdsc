/**
 * SurgeWise logo mark: a navy "S" and teal "W" ribbon joined by a red line that
 * runs from a hotspot dot up to a medical cross — a surge reaching care.
 * Artwork (transparent PNGs in /public/brand):
 * - surgewise-mark.png: the mark in its original colours (`on-light`, the default);
 * - surgewise-mark-on-dark.png: the navy "S" recoloured to a light ribbon so it stays
 *   visible on dark surfaces (`on-dark`, `badge`); teal "W" and red cross unchanged;
 * - surgewise-logo.png: mark plus "SurgeWise" wordmark, for slides and documents.
 * `size` is the rendered height in px; the width follows the artwork's ratio. The mark
 * is decorative: every place it is used shows the "SurgeWise" name or a label beside it.
 */
type Variant = 'on-dark' | 'on-light' | 'badge';

const SRC: Record<Variant, string> = {
  'on-light': '/brand/surgewise-mark.png',
  'on-dark': '/brand/surgewise-mark-on-dark.png',
  badge: '/brand/surgewise-mark-on-dark.png',
};
const RATIO = 433 / 256; // width / height of the mark artwork

export default function SurgeWiseMark({ size = 28, variant = 'on-light', className }: { size?: number; variant?: Variant; className?: string }) {
  // A plain <img>: the files are small static PNGs, and it renders identically on the
  // server, in the browser and in the Node-based component tests.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={SRC[variant]} alt="" aria-hidden="true" width={Math.round(size * RATIO)} height={size} className={className} decoding="async" draggable={false} />;
}
