import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BedDouble, ChartLine, CircleX, FlaskConical,
  Hospital, Layers, Map as MapIcon, MapPin, Play,
} from 'lucide-react';
import SurgeWiseMark from '@/components/surgewise-mark';
import LandingHeroArt from '@/components/landing-hero-art';
import { LANDING_FACTS as F, formatCount } from '@/lib/landing-facts';
import './landing.css';

export const metadata: Metadata = {
  title: 'SurgeWise · Dengue surge preparedness for Quezon City',
  description:
    'Research prototype linking backtested dengue case forecasts to barangay demand and 28-day hospital surge scenarios for Quezon City.',
};

const STATS = [
  { value: formatCount(F.hospitals), label: 'PhilHealth-accredited hospitals and infirmaries in Quezon City', kind: 'source', kindLabel: 'Source-reported', note: `Register dated ${F.registerDate}` },
  { value: formatCount(F.accreditedBeds), label: 'accredited beds across that network', kind: 'source', kindLabel: 'Source-reported', note: 'Not staffed, free or dengue-ready beds' },
  { value: formatCount(F.barangays), label: 'barangays with annual reported dengue cases', kind: 'observed', kindLabel: 'Observed', note: `Historical, ${F.firstYear}–${F.lastYear}` },
  { value: String(F.simulationDays), unit: 'days', label: 'of simulated patient flow in every scenario', kind: 'hypothetical', kindLabel: 'Hypothetical', note: 'Assumed capacity, research use' },
] as const;

const STEPS = [
  {
    icon: ChartLine, title: 'Forecast cases',
    text: 'Quezon City dengue forecasts built from historical case counts and lagged rainfall, temperature and humidity, backtested on past seasons using only data available at the time.',
    output: 'Forecast from historical model',
  },
  {
    icon: MapPin, title: 'Find the hotspots',
    text: `City forecasts are spread across ${formatCount(F.barangays)} barangays using weights from earlier annual reported cases, and a ranking model flags likely high-burden areas.`,
    output: 'Allocated estimate',
  },
  {
    icon: BedDouble, title: 'Simulate the wards',
    text: `Projected admissions flow into ${formatCount(F.hospitals)} accredited hospitals over ${F.simulationDays} days, showing where demand would outrun assumed capacity and how many surge beds it would take.`,
    output: 'Hypothetical stress test',
  },
] as const;

const WORKSPACES = [
  {
    href: '/outbreak-response', icon: Play, tag: 'Start here', featured: true,
    title: 'QC forecast & hospital simulation',
    text: 'Play a 28-day outbreak like a film. Watch hotspots grow, see the nearest hospitals and compare bed demand against assumed capacity.',
    tags: ['Historical replay', 'Future surge forecast', 'Nearest hospitals'],
    cta: 'Open simulation',
  },
  {
    href: '/dashboard', icon: MapIcon, tag: 'Overview',
    title: 'NCR healthcare map',
    text: 'Seventeen NCR city boundaries with Quezon City’s hospital network, a searchable inventory and forecast validation summaries.',
    tags: ['17 city boundaries', 'Hospital inventory'],
    cta: 'Open map',
  },
  {
    href: '/research', icon: FlaskConical, tag: 'Deep dive',
    title: 'Research workspace',
    text: 'Historical forecast runs, observed barangay burden beside modeled allocations, and 28-day admissions and overflow experiments.',
    tags: ['Backtests', 'Barangay burden'],
    cta: 'Open research',
  },
] as const;

const LABELS = [
  { kind: 'observed', text: 'Observed' },
  { kind: 'forecast', text: 'Forecast from historical model' },
  { kind: 'allocated', text: 'Allocated estimate' },
  { kind: 'hypothetical', text: 'Hypothetical stress test' },
  { kind: 'unavailable', text: 'Unavailable' },
  { kind: 'unverified', text: 'Not operationally verified' },
] as const;

const NOT = [
  { title: 'Not live surveillance', text: 'Forecasts run on dated historical data. No live case feed is used.' },
  { title: 'Not a bed-vacancy tracker', text: 'Accredited beds are not staffed or free beds. Real hospital census is unknown.' },
  { title: 'Not triage or referral', text: 'Hospital points are provisional locations, not verified entrances or routing targets.' },
] as const;

export default function Landing() {
  return <div className="lp">
    <nav className="lp-nav" aria-label="Main">
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" className="lp-logo" aria-label="SurgeWise home">
          <SurgeWiseMark size={36} variant="badge" />
          SurgeWise
        </Link>
        <div className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#workspaces">Workspaces</a>
          <a href="#honest">Honest data</a>
        </div>
        <Link href="/outbreak-response" className="lp-btn lp-btn-sm">Open simulation <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </nav>

    <header className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow"><i className="lp-eyebrow-dot" aria-hidden />Quezon City · Dengue preparedness research</span>
          <h1 className="lp-title">See the dengue <span className="lp-underline">surge</span> before it reaches the ward.</h1>
          <p className="lp-lede">
            SurgeWise connects backtested dengue case forecasts to barangay-level demand and a {F.simulationDays}-day
            hospital surge simulation, so planners can see where Quezon City’s hospitals would come under strain and test
            what extra capacity could change.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/outbreak-response" className="lp-btn"><Play size={18} aria-hidden /> Open QC simulation</Link>
            <Link href="/dashboard" className="lp-link">Explore the NCR map <ArrowRight size={18} aria-hidden /></Link>
          </div>
          <ul className="lp-hero-notes">
            <li>Built on dated historical data</li>
            <li>Every number labeled</li>
            <li>Not live surveillance</li>
          </ul>
        </div>

        <div className="lp-stage-wrap">
          <div className="lp-stage">
            <LandingHeroArt className="lp-art" />
          </div>
          <div className="lp-chip lp-chip-a" aria-hidden="true">
            <span className="lp-chip-icon"><ChartLine size={20} /></span>
            <span><strong>Backtested forecasts</strong><small>Historical QC cases + weather</small></span>
          </div>
          <div className="lp-chip lp-chip-b" aria-hidden="true">
            <span className="lp-chip-icon"><Hospital size={20} /></span>
            <span><strong>{formatCount(F.hospitals)} accredited hospitals</strong><small>PhilHealth · {F.registerDate}</small></span>
          </div>
          <div className="lp-chip lp-chip-c" aria-hidden="true">
            <span className="lp-chip-icon is-alert"><BedDouble size={20} /></span>
            <span><strong>{F.simulationDays}-day surge scenarios</strong><small>Assumed capacity · research use</small></span>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section className="lp-wrap" aria-label="SurgeWise at a glance">
        <ul className="lp-stats">
          {STATS.map(stat => <li key={stat.label} className="lp-stat">
            <span className={`lp-kind is-${stat.kind}`}>{stat.kindLabel}</span>
            <strong className="lp-stat-value">{stat.value}{'unit' in stat && <span className="lp-stat-unit">{stat.unit}</span>}</strong>
            <p>{stat.label}</p>
            <small>{stat.note}</small>
          </li>)}
        </ul>
      </section>

      <section id="how" className="lp-section lp-wrap" aria-labelledby="how-title">
        <span className="lp-kicker">How it works</span>
        <h2 id="how-title" className="lp-h2">From forecast to ward in three steps</h2>
        <p className="lp-section-lede">
          Every step keeps its own label, so a forecast never passes for an observation and an assumption never passes for a
          hospital’s real capacity.
        </p>
        <ol className="lp-steps">
          {STEPS.map(({ icon: Icon, title, text, output }, index) => <li key={title} className="lp-step">
            <div className="lp-step-top">
              <span className="lp-step-icon"><Icon size={24} aria-hidden /></span>
              <span className="lp-step-num">0{index + 1}</span>
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
            <span className="lp-step-out"><Layers size={14} aria-hidden /> Output: {output}</span>
            {index < STEPS.length - 1 && <span className="lp-step-arrow" aria-hidden="true"><ArrowRight size={18} /></span>}
          </li>)}
        </ol>
      </section>

      <section id="workspaces" className="lp-section lp-section-tight lp-wrap" aria-labelledby="workspaces-title">
        <span className="lp-kicker">Workspaces</span>
        <h2 id="workspaces-title" className="lp-h2">Pick where to start</h2>
        <div className="lp-cards">
          {WORKSPACES.map(({ href, icon: Icon, tag, title, text, tags, cta, ...rest }) =>
            <Link key={href} href={href} className={`lp-card${'featured' in rest ? ' is-featured' : ''}`}>
              <div className="lp-card-head">
                <span className="lp-card-icon"><Icon size={22} aria-hidden /></span>
                <span className="lp-card-tag">{tag}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul className="lp-card-tags">{tags.map(t => <li key={t}>{t}</li>)}</ul>
              <span className="lp-card-go">{cta}<span className="lp-card-go-icon"><ArrowUpRight size={18} aria-hidden /></span></span>
            </Link>)}
        </div>
      </section>

      <section id="honest" className="lp-section lp-wrap" aria-labelledby="honest-title">
        <div className="lp-honest">
          <div>
            <span className="lp-kicker">Honest by design</span>
            <h2 id="honest-title" className="lp-h2">Every number says what it is</h2>
            <p>
              Each figure carries its kind, source and date: observed, forecast, modeled or assumed. When data are missing,
              SurgeWise shows them as unavailable instead of filling the gap with invented values.
            </p>
            <ul className="lp-labels" aria-label="Labels used across SurgeWise">
              {LABELS.map(label => <li key={label.kind} className={`lp-label is-${label.kind}`}><i aria-hidden />{label.text}</li>)}
            </ul>
          </div>
          <div className="lp-not">
            <h3>What SurgeWise is not</h3>
            <ul>
              {NOT.map(item => <li key={item.title}>
                <CircleX size={20} aria-hidden />
                <span><strong>{item.title}</strong>{item.text}</span>
              </li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-wrap" aria-labelledby="cta-title">
        <div className="lp-cta">
          <SurgeWiseMark className="lp-cta-mark" size={320} variant="on-light" />
          <div>
            <h2 id="cta-title" className="lp-h2">Ready to stress&#8209;test the network?</h2>
            <p>Start from a historical replay, then push a hypothetical surge and watch where beds run short.</p>
          </div>
          <div className="lp-cta-actions">
            <Link href="/outbreak-response" className="lp-btn"><Play size={18} aria-hidden /> Open QC simulation</Link>
            <Link href="/research" className="lp-link">Browse the research workspace <ArrowRight size={18} aria-hidden /></Link>
          </div>
        </div>
      </section>
    </main>

    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-grid">
        <div>
          <Link href="/" className="lp-logo" aria-label="SurgeWise home"><SurgeWiseMark size={30} variant="badge" />SurgeWise</Link>
          <p>A research and preparedness prototype. Not for clinical decisions, triage, referral or real-time bed availability.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <ul>
            <li><Link href="/outbreak-response">QC simulation</Link></li>
            <li><Link href="/dashboard">NCR healthcare map</Link></li>
            <li><Link href="/research">Research workspace</Link></li>
          </ul>
        </div>
        <div>
          <h3>Data sources</h3>
          <ul>
            <li><a href="https://www.philhealth.gov.ph/partners/providers/facilities/accredited/HOSP_093026.pdf" rel="noreferrer" target="_blank">PhilHealth accredited hospitals and infirmaries, {F.registerDate}</a></li>
            <li><a href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615" rel="noreferrer" target="_blank">UPRI-NOAH dengue/environmental dataset</a> (ODC-ODbL 1.0)</li>
            <li>Hospital points are provisional; none is a verified entrance.</li>
          </ul>
        </div>
      </div>
    </footer>
  </div>;
}
