import SurgeWiseMark from '@/components/surgewise-mark';

/** Shared content-area loading surface. The application rail stays available. */
export default function WorkspaceLoader({ active = true, label = 'Loading SurgeWise' }: { active?: boolean; label?: string }) {
  return <div className="sw-workspace-loader" data-active={active} role="status" aria-hidden={!active || undefined} aria-live="polite">
    <SurgeWiseMark size={88} variant="on-light" className="sw-loading-mark" />
    <span className="sw-loading-label">{label}</span>
  </div>;
}
