import type { Metadata } from 'next';
import Link from 'next/link';
import { Bed, Bug, Hospital, Play } from 'lucide-react';
import LandingHeroArt from '@/components/landing-hero-art';
import SurgeWiseMark from '@/components/surgewise-mark';
import { LANDING_FACTS as F, formatCount } from '@/lib/landing-facts';
import './landing.css';

export const metadata: Metadata = {
  title: 'SurgeWise · Dengue surge preparedness for Quezon City',
  description:
    'Research prototype linking backtested dengue case forecasts to barangay demand and 28-day hospital surge scenarios for Quezon City.',
};

/** Decorative bed strip for the surge card: a sample fill, labeled illustrative on the page. */
const SAMPLE_BEDS = ['occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'occupied', 'extra', 'available'] as const;

export default function Landing() {
  return <div className="lp">
    <nav className="lp-nav" aria-label="Main">
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" className="lp-logo" aria-label="SurgeWise home">
          <SurgeWiseMark size={36} variant="badge" />
          <span className="lp-logo-text">SurgeWise</span>
        </Link>
        <div className="lp-nav-links">
          <Link href="/outbreak-response">QC simulation</Link>
          <Link href="/dashboard">NCR map</Link>
          <Link href="/research">Research</Link>
        </div>
      </div>
    </nav>
    <main>
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow"><i className="lp-eyebrow-dot" aria-hidden />Quezon City · Dengue preparedness research</span>
          <h1 id="lp-title" className="lp-title">See the dengue <span className="lp-underline">surge</span> before it reaches the ward.</h1>
          <p className="lp-lede">
            SurgeWise connects backtested dengue case forecasts to barangay-level demand and a {F.simulationDays}-day
            hospital surge simulation, so planners can see where Quezon City’s hospitals would come under strain and test
            what extra capacity could change.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/outbreak-response" className="lp-btn"><Play size={18} aria-hidden /> Open simulation</Link>
          </div>
          <ul className="lp-hero-notes">
            <li>Built on dated historical data</li>
            <li>Every number labeled</li>
            <li>Not live surveillance</li>
          </ul>
        </div>

        <div className="lp-stage-wrap">
          <div className="lp-scene">
            <LandingHeroArt className="lp-art" />

            {/* Floating cards. Their curve and bed fill are decorative samples (see caption), not model output. */}
            <div className="lp-chip lp-chip-a" aria-hidden="true">
              <div className="lp-chip-row">
                <span className="lp-chip-icon is-alert"><Bug size={13} /></span>
                <span><strong>Backtested dengue forecasts</strong><small>Historical QC cases + weather</small></span>
              </div>
              <svg className="lp-spark" viewBox="0 0 260 52" width="140" height="28" focusable="false">
                <line x1="0" y1="50" x2="260" y2="50" className="lp-spark-base" />
                <line x1="150" y1="4" x2="150" y2="50" className="lp-spark-divider" />
                <path d="M150 34 C 180 24, 210 14, 260 12 L 260 32 C 210 34, 180 40, 150 34 Z" className="lp-spark-band" />
                <path d="M0 44 C 20 42, 32 46, 50 41 S 82 36, 100 38 S 132 38, 150 34" className="lp-spark-observed" />
                <path d="M150 34 C 180 30, 210 22, 260 22" className="lp-spark-forecast" />
                <circle cx="150" cy="34" r="3.5" className="lp-spark-dot" />
              </svg>
              <div className="lp-legend">
                <span><i className="is-observed" />Observed cases</span>
                <span><i className="is-forecast" />Forecast</span>
              </div>
            </div>

            <div className="lp-chip lp-chip-b" aria-hidden="true">
              <div className="lp-chip-row">
                <span className="lp-chip-icon"><Hospital size={13} /></span>
                <span><strong>{formatCount(F.hospitals)} accredited hospitals</strong><small>PhilHealth · {F.registerDate}</small></span>
              </div>
            </div>

            <div className="lp-chip lp-chip-c" aria-hidden="true">
              <div className="lp-chip-row">
                <span className="lp-chip-icon is-navy"><Bed size={13} /></span>
                <span><strong>{F.simulationDays}-day bed surge scenarios</strong><small>Assumed capacity · research use</small></span>
                <span className="lp-pill-over">Over capacity</span>
              </div>
              <div className="lp-beds">
                {SAMPLE_BEDS.map((state, i) => <span key={i} className={`lp-bed is-${state}`}><Bed size={10} /></span>)}
              </div>
              <div className="lp-legend">
                <span><i className="is-occupied" />Occupied</span>
                <span><i className="is-available" />Available</span>
                <span><i className="is-extra" />Extra beds (scenario)</span>
                <b>Day {F.simulationDays} of {F.simulationDays}</b>
              </div>
            </div>
          </div>
          <p className="lp-illustrative">Illustrative preview: sample forecast curve and bed fill, not model output.</p>
        </div>
      </div>
    </section>
    </main>
  </div>;
}
