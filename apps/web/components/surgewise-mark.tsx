/**
 * SurgeWise logo mark: a teal ribbon wave that rises from a deep-teal fold and turns
 * into a light-blue medical cross, layered over a second teal cross — a surge
 * reaching care. Artwork (transparent PNGs in /public/brand, cut from the user's
 * 2026-11-18 glow artwork; see docs/change-request-log.md):
 * - surgewise-mark.png: the flat mark without its glow (`on-light`, the default);
 * - surgewise-mark-on-dark.png: the same mark with the original soft teal-blue glow,
 *   so its deep-teal fold stays visible on dark surfaces (`on-dark`, `badge`);
 * - surgewise-logo.png: mark plus "SurgeWise" wordmark, for slides and documents.
 * Both mark files share one canvas, so `size` is the rendered height in px and the
 * width follows the artwork's ratio. The mark is decorative: every place it is used
 * shows the "SurgeWise" name or a label beside it.
 */
type Variant = 'on-dark' | 'on-light' | 'badge';

const SRC: Record<Variant, string> = {
  'on-light': '/brand/surgewise-mark.png',
  'on-dark': '/brand/surgewise-mark-on-dark.png',
  badge: '/brand/surgewise-mark-on-dark.png',
};
const RATIO = 668 / 384; // width / height of the mark artwork

export default function SurgeWiseMark({ size = 28, variant = 'on-light', className }: { size?: number; variant?: Variant; className?: string }) {
  // A plain <img>: the files are small static PNGs, and it renders identically on the
  // server, in the browser and in the Node-based component tests.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={SRC[variant]} alt="" aria-hidden="true" width={Math.round(size * RATIO)} height={size} className={className} decoding="async" draggable={false} />;
}
