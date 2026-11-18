'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, Ban, Check, CircleSlash, Database, Download, Info, SlidersHorizontal, Split, TrendingUp, TriangleAlert } from 'lucide-react';
import { loadFacilities, FACILITY_DATASET_ID } from '@/lib/facilities';
import { parseAnnualRecords } from '@/lib/annual-burden';
import { ENGINE_STARTING_MESSAGE, fetchResearch, type EngineConnectionStatus } from '@/lib/engine-connection';
import type { Facility } from '@/lib/types';
import type { AnnualRecord, ResearchRun, ResearchScenario, SpatialResult } from '@/lib/research-types';
import WorkspaceSelect from '@/components/workspace-select';
import ForecastChart from './forecast-chart';
import './research.css';

const BarangayMap = dynamic(() => import('@/components/barangay-map'), { ssr: false, loading: () => <div className="rs-map-card rs-map-placeholder">Loading map…</div> });
async function read(url: string, init?: RequestInit, onStatus?: (status: EngineConnectionStatus) => void) {
  const response = await (url.startsWith('/api/research/') ? fetchResearch(url, init, onStatus) : fetch(url, init));
  const data = await response.json();
  if (!response.ok) throw Error(data.error || data.detail?.message || data.detail?.code || `Request failed (${response.status})`);
  return data;
}

type Kind = 'observed' | 'forecast' | 'modeled' | 'assumption' | 'unavailable';
const KINDS: Record<Kind, { label: string; meaning: string; Icon: typeof Database }> = {
  observed: { label: 'Observed', meaning: 'Reported in the source dataset', Icon: Database },
  forecast: { label: 'Forecast', meaning: 'Predicted by a historical model', Icon: TrendingUp },
  modeled: { label: 'Modeled estimate', meaning: 'City totals shared out across barangays', Icon: Split },
  assumption: { label: 'Assumption', meaning: 'A value you set; not verified', Icon: SlidersHorizontal },
  unavailable: { label: 'Unavailable', meaning: 'Not in any source; never shown as zero', Icon: CircleSlash },
};
function KindTag({ kind }: { kind: Kind }) {
  const { label, Icon } = KINDS[kind];
  return <span className={`rs-kind rs-kind-${kind}`}><Icon size={12} aria-hidden="true" />{label}</span>;
}

const METHODS: Record<string, { label: string; description: string }> = {
  cases_only: { label: 'Cases-only model', description: 'Learns from past weekly case counts' },
  cases_weather: { label: 'Cases + weather model', description: 'Adds rainfall, temperature and humidity' },
  persistence: { label: 'Persistence baseline', description: 'Repeats the latest observed week' },
  seasonal_naive: { label: 'Seasonal baseline', description: 'Uses the same week one year earlier' },
};
const AREAS = [{ value: 'QUEZON_CITY', label: 'Quezon City' }, { value: 'NCR', label: 'National Capital Region' }];
const areaName = (value: string) => AREAS.find(a => a.value === value)?.label ?? value;
const SECTIONS = [
  { id: 'rs-sources', title: 'Data & labels', hint: 'Where the numbers come from' },
  { id: 'rs-forecasts', title: 'Historical forecasts', hint: 'Forecast vs what happened' },
  { id: 'rs-accuracy', title: 'Forecast accuracy', hint: 'How far off past tests were' },
  { id: 'rs-barangays', title: 'Barangay burden', hint: 'Cases across Quezon City' },
  { id: 'rs-replay', title: 'Hospital capacity replay', hint: 'One-hospital stress test' },
];
const fmt = (value: number, digits = 1) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function SectionHeader({ index, title, children, kinds }: { index: number; title: string; children: ReactNode; kinds: Kind[] }) {
  return <header className="rs-section-header">
    <span className="rs-step" aria-hidden="true">{index}</span>
    <div>
      <h2 id={`${SECTIONS[index - 1].id}-title`}>{title}</h2>
      <p className="rs-section-lede">{children}</p>
      <div className="rs-kind-row"><span>Numbers here:</span>{kinds.map(kind => <KindTag key={kind} kind={kind} />)}</div>
    </div>
  </header>;
}

export default function Research() {
  const [annual, setAnnual] = useState<AnnualRecord[]>([]);
  const [reconciliation, setReconciliation] = useState<{ year: number; annualKnownSubtotal: number; weeklyCityTotal: number; missingBarangays: number }[]>([]);
  const [year, setYear] = useState(2024);
  const [area, setArea] = useState('QUEZON_CITY');
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [id, setId] = useState('');
  const [allocation, setAllocation] = useState<SpatialResult | null>(null);
  const [layer, setLayer] = useState('observed');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState('');
  const [normal, setNormal] = useState(100);
  const [surge, setSurge] = useState(30);
  const [holding, setHolding] = useState(5);
  const [rate, setRate] = useState(.15);
  const [los, setLos] = useState(4);
  const [occupancy, setOccupancy] = useState(.75);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<ResearchScenario | null>(null);
  const [day, setDay] = useState(28);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const simulationRequest = useRef<AbortController | null>(null);
  const [scores, setScores] = useState<{ area: string; horizon: number; method: string; n: number; mae: number; rmse: number }[]>([]);
  const [horizon, setHorizon] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<EngineConnectionStatus>('loading');
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  useEffect(() => {
    const controller = new AbortController();
    read('/data/qc-annual-burden.json', { signal: controller.signal }).then(d => {
      const records = parseAnnualRecords(d.records);
      if (!Array.isArray(d.reconciliation)) throw Error('Annual reconciliation unavailable.');
      setAnnual(records); setReconciliation(d.reconciliation);
    })
      .catch(e => { if (!controller.signal.aborted) setSourceError(e.message); });
    loadFacilities(controller.signal).then(f => { setFacilities(f); }).catch(e => { if (!controller.signal.aborted) setSourceError(e.message); });
    read('/api/research/research-evidence', { signal: controller.signal }, setConnectionStatus).then(d => setScores(d.backtest.scores))
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setRuns([]); setId(''); setAllocation(null); setRunsLoading(true);
    read(`/api/research/forecast-runs?area=${area}`, { signal: controller.signal }, setConnectionStatus).then(d => {
      setRuns(d.runs); setId(d.runs.at(-1)?.id || ''); setError('');
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setRunsLoading(false); });
    return () => controller.abort();
  }, [area]);
  useEffect(() => {
    const controller = new AbortController();
    setAllocation(null);
    if (id && area === 'QUEZON_CITY') read(`/api/research/spatial-allocations/${id}`, { signal: controller.signal }, setConnectionStatus)
      .then(setAllocation).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, area]);
  useEffect(() => {
    simulationRequest.current?.abort();
    generation.current += 1; setResult(null); setLoading(false);
    const requestGeneration = generation, requestController = simulationRequest;
    return () => { requestGeneration.current++; requestController.current?.abort(); };
  }, [id, area, normal, surge, holding, rate, los, occupancy, ack, selected]);
  useEffect(() => {
    if (!allocation && layer === 'modeled') setLayer('observed');
  }, [allocation, layer]);
  // Highlight the table-of-contents entry for the section nearest the top of the viewport.
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity);
      const current = SECTIONS.map(s => s.id).find(sid => (visible.get(sid) ?? Infinity) < Infinity);
      if (current) setActiveSection(current);
    }, { rootMargin: '-15% 0px -70% 0px' });
    SECTIONS.forEach(s => { const element = document.getElementById(s.id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);
  const run = runs.find(r => r.id === id);
  const rec = reconciliation.find(r => r.year === year);
  const modeled = layer === 'modeled';
  const values = Object.fromEntries(annual.map(r => [r.ADM4_PCODE, modeled
    ? allocation?.records.find(a => a.ADM4_PCODE === r.ADM4_PCODE)?.expectedCases[0] ?? null
    : typeof r[`DC_${year}`] === 'number' ? r[`DC_${year}`] as number : null]));
  const names = Object.fromEntries(annual.map(r => [r.ADM4_PCODE, r.Barangay]));
  async function simulate() {
    const token = ++generation.current;
    simulationRequest.current?.abort();
    const controller = new AbortController();
    simulationRequest.current = controller;
    setLoading(true); setResult(null); setError('');
    try {
      const data = await read('/api/research/scenarios', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ forecastRunId: id, scenarioKind: 'historical_replay', acknowledgeHypotheticalHospitalNetwork: ack,
          hospitalizationRate: rate, lengthOfStayDays: los, baselineOccupancy: occupancy, admissionDelayDays: 0,
          surgeActivationDay: 0, facilities: [{ facilityId: selected, assumedDengueEligible: true,
            normalCapacity: normal, surgeCapacity: surge, holdingCapacity: holding }] }) }, setConnectionStatus);
      if (token === generation.current) setResult(data);
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : 'Simulation failed'); }
    finally { if (token === generation.current) setLoading(false); }
  }
  const snapshot = result?.days[day];
  const areaScores = scores.filter(s => s.area === area);
  const horizonScores = areaScores.filter(s => s.horizon === horizon).sort((a, b) => a.mae - b.mae);
  const maxMae = Math.max(1, ...horizonScores.map(s => s.mae));
  const horizons = Array.from(new Set(areaScores.map(s => s.horizon))).sort((a, b) => a - b);
  const facility = facilities.find(f => f.id === selected);
  const blockers = [
    !run && 'choose a forecast starting week in section 2',
    area !== 'QUEZON_CITY' && 'set the scope in section 2 to Quezon City',
    !selected && 'choose a hospital',
    !ack && 'confirm the assumption statement',
    sourceError && 'reload the page (source data failed to load)',
  ].filter(Boolean) as string[];
  const canRun = blockers.length === 0 && !loading;
  const engineMessage = connectionStatus === 'starting' ? ENGINE_STARTING_MESSAGE : 'Connecting to the research engine…';

  return <main className="rs-page">
    <header className="rs-hero">
      <div className="rs-hero-text">
        <span className="rs-eyebrow">SurgeWise / Research</span>
        <h1>Research &amp; evidence</h1>
        <p>Check the historical data behind SurgeWise, see how past forecasts compared with what actually happened, and test one hospital against assumed capacity. Everything on this page is historical or hypothetical.</p>
        <div className="rs-hero-facts">
          <span><Database size={14} aria-hidden="true" />Historical data, 2010–2025</span>
          <span><Ban size={14} aria-hidden="true" />No live surveillance or bed availability</span>
        </div>
      </div>
    </header>

    <div className="rs-layout">
      <nav className="rs-toc" aria-label="On this page">
        <span className="rs-eyebrow">On this page</span>
        <ol>{SECTIONS.map((s, i) => <li key={s.id}>
          <a href={`#${s.id}`} aria-current={activeSection === s.id ? 'location' : undefined}>
            <span className="rs-toc-number">{i + 1}</span><span><strong>{s.title}</strong><small>{s.hint}</small></span>
          </a>
        </li>)}</ol>
      </nav>

      <div className="rs-content">
        {(error || sourceError) && <div role="alert" className="rs-banner rs-banner-error"><TriangleAlert size={16} aria-hidden="true" /><span>{[sourceError, error].filter(Boolean).join(' ')}</span></div>}
        {!error && connectionStatus !== 'loading' && <div role="status" className="rs-banner"><Info size={16} aria-hidden="true" /><span>{engineMessage}</span></div>}

        <section id="rs-sources" className="rs-section" aria-labelledby="rs-sources-title">
          <SectionHeader index={1} title="Data & labels" kinds={['observed', 'unavailable']}>
            Start here. These are the sources every number on this page comes from, and the labels that tell you what kind of number you are looking at.
          </SectionHeader>
          <div className="rs-card-grid">
            <article className="rs-card">
              <span className="rs-card-label">Dengue cases &amp; environment</span>
              <h3>UPRI-NOAH dengue dataset</h3>
              <p>Weekly city and regional case counts with weather variables, plus annual counts for 142 Quezon City barangays.</p>
              <dl className="rs-facts">
                <div><dt>Citation</dt><dd>Matavia et al. (2026)</dd></div>
                <div><dt>License</dt><dd>ODC-ODbL 1.0</dd></div>
                <div><dt>Handling</dt><dd>Original nulls and quality flags kept</dd></div>
              </dl>
              <a className="rs-link" href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615" target="_blank" rel="noreferrer">Pinned dataset version <ArrowUpRight size={13} aria-hidden="true" /></a>
            </article>
            <article className="rs-card">
              <span className="rs-card-label">Hospitals</span>
              <h3>PhilHealth Quezon City register</h3>
              <p>Hospital identities used by the capacity replay in section 5. Accredited beds are not staffed, vacant or dengue-ready beds.</p>
              <dl className="rs-facts">
                <div><dt>As of</dt><dd>30 Sep 2026</dd></div>
                <div><dt>Records</dt><dd>{facilities.length ? `${facilities.length} hospitals` : sourceError ? 'Unavailable' : 'Loading…'}</dd></div>
                <div><dt>Locations</dt><dd>Provisional; entrances unverified</dd></div>
              </dl>
              <span className="rs-mono" title="Dataset version">{FACILITY_DATASET_ID}</span>
            </article>
          </div>
          <div className="rs-card rs-gaps">
            <span className="rs-card-label">Known gaps</span>
            <ul>
              <li><strong>Calendar dates are unresolved.</strong> Weeks are the dataset&apos;s numbered 7-day blocks (for example, 2024 · week 5), not confirmed calendar weeks.</li>
              <li><strong>No live data.</strong> Nothing here is current surveillance, hospital occupancy or vacancy reporting.</li>
              <li><strong>Missing is not zero.</strong> Missing NCR weeks in 2020–2021 and missing barangay years stay missing.</li>
            </ul>
          </div>
          <div className="rs-legend-card">
            <span className="rs-card-label">How to read the labels</span>
            <ul>{(Object.keys(KINDS) as Kind[]).map(kind => <li key={kind}><KindTag kind={kind} /><span>{KINDS[kind].meaning}</span></li>)}</ul>
          </div>
        </section>

        <section id="rs-forecasts" className="rs-section" aria-labelledby="rs-forecasts-title">
          <SectionHeader index={2} title="Historical forecasts" kinds={['forecast', 'observed']}>
            Pick a past week as the starting point. The model only sees data up to that week, then forecasts the following weeks. Compare its forecast with the cases that were actually reported.
          </SectionHeader>
          <div className="rs-controls">
            <div className="rs-control"><span>Scope</span>
              <WorkspaceSelect label="Forecast scope" value={area} onChange={setArea} options={AREAS} /></div>
            <div className="rs-control"><span>Data observed through</span>
              <WorkspaceSelect label="Forecast starting week" value={id} onChange={setId} disabled={!runs.length}
                options={runs.length ? runs.map(r => ({ value: r.id, label: `${r.issueBlock.YR} · week ${r.issueBlock.WN}` })) : [{ value: '', label: runsLoading ? 'Loading starting weeks…' : 'No starting weeks available' }]} /></div>
          </div>
          {run ? <div className="rs-card rs-forecast-card">
            <div className="rs-stat-row">
              <div><span>Starting week</span><strong>{run.issueBlock.YR} · wk {run.issueBlock.WN}</strong></div>
              <div><span>Weeks forecast</span><strong>{run.weeklyPredictions.length}</strong></div>
              <div><span>Model</span><strong className="rs-stat-text">Cases-only</strong></div>
              <div><span>Uncertainty range</span><strong className="rs-stat-text">Not estimated</strong></div>
            </div>
            <ForecastChart points={run.weeklyPredictions.map(p => ({ label: `${p.YR} · wk ${p.WN}`, forecast: p.meanCases, observed: p.observedCases }))} />
            <div className="rs-table-wrap">
              <table className="rs-table">
                <caption className="rs-sr-only">Forecast and observed reported cases per source week, {areaName(area)}</caption>
                <thead><tr><th scope="col">Target week</th><th scope="col">Forecast cases</th><th scope="col">Observed cases</th><th scope="col">Forecast − observed</th></tr></thead>
                <tbody>{run.weeklyPredictions.map(p => <tr key={`${p.YR}-${p.WN}`}>
                  <td>{p.YR} · week {p.WN}</td><td>{fmt(p.meanCases)}</td><td>{fmt(p.observedCases, 0)}</td>
                  <td>{p.meanCases - p.observedCases > 0 ? '+' : ''}{fmt(p.meanCases - p.observedCases)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="rs-note">{run.availabilityAssumption} Exact issue date unavailable. The model forecasts each week ahead directly from past cases; observed counts are shown for evaluation only.</p>
            <details className="rs-disclosure"><summary>Reproducibility</summary><p>Source workbook SHA-256</p><span className="rs-mono">{run.sourceSha256}</span></details>
          </div> : <div className="rs-empty">{runsLoading ? 'Loading historical forecasts…' : <><strong>No forecast loaded</strong><span>Connect the research engine to view historical forecasts.</span></>}</div>}
        </section>

        <section id="rs-accuracy" className="rs-section" aria-labelledby="rs-accuracy-title">
          <SectionHeader index={3} title="Forecast accuracy" kinds={['forecast', 'observed']}>
            How far off were forecasts in past tests? Each method was tested from eight quarterly starting points in 2024–2025, against the same weeks. A shorter bar means a smaller average miss.
          </SectionHeader>
          <div className="rs-controls">
            <div className="rs-control"><span>Scope</span>
              <WorkspaceSelect label="Accuracy scope" value={area} onChange={setArea} options={AREAS} /></div>
            <div className="rs-control"><span id="rs-horizon-label">Forecasting ahead by</span>
              <div className="rs-segmented" role="group" aria-labelledby="rs-horizon-label">
                {(horizons.length ? horizons : [1, 2, 3, 4]).map(h => <button key={h} type="button" className="text-button" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>{h} {h === 1 ? 'week' : 'weeks'}</button>)}
              </div>
            </div>
          </div>
          {horizonScores.length ? <div className="rs-card">
            <div className="rs-bars" role="list" aria-label={`Average miss by method, ${horizon} week${horizon === 1 ? '' : 's'} ahead, ${areaName(area)}`}>
              {horizonScores.map((s, i) => <div role="listitem" className="rs-bar-row" key={s.method} data-best={i === 0}>
                <div className="rs-bar-label"><strong>{METHODS[s.method]?.label ?? s.method}{i === 0 && <span className="rs-best"><Check size={11} aria-hidden="true" />Smallest miss</span>}</strong><small>{METHODS[s.method]?.description ?? ''}</small></div>
                <div className="rs-bar-track"><i style={{ width: `${(s.mae / maxMae) * 100}%` }} /></div>
                <div className="rs-bar-value"><strong>{fmt(s.mae)}</strong><small>RMSE {fmt(s.rmse)}</small></div>
              </div>)}
            </div>
            <p className="rs-note"><strong>Average miss (MAE)</strong> is the typical gap between forecast and reported cases, in cases per week. <strong>RMSE</strong> weighs large misses more heavily. Each value uses n = {horizonScores[0].n} matched test weeks.</p>
            <details className="rs-disclosure"><summary>All horizons as a table</summary>
              <div className="rs-table-wrap"><table className="rs-table">
                <thead><tr><th scope="col">Weeks ahead</th><th scope="col">Method</th><th scope="col">n</th><th scope="col">MAE (cases)</th><th scope="col">RMSE (cases)</th></tr></thead>
                <tbody>{areaScores.map(s => <tr key={`${s.horizon}-${s.method}`}><td>{s.horizon}</td><td>{METHODS[s.method]?.label ?? s.method}</td><td>{s.n}</td><td>{fmt(s.mae, 2)}</td><td>{fmt(s.rmse, 2)}</td></tr>)}</tbody>
              </table></div>
            </details>
          </div> : <div className="rs-empty">{error ? <><strong>Accuracy results unavailable</strong><span>Connect the research engine to load backtest evidence.</span></> : 'Loading backtest evidence…'}</div>}
          <div className="rs-card rs-gaps">
            <span className="rs-card-label">Limits of this test</span>
            <ul>
              <li>This is a look back at 2024–2025 only. It does not prove how well future forecasts will perform.</li>
              <li>Publication delay is unknown, and no uncertainty ranges were estimated or checked.</li>
              <li>Missing NCR weeks in 2020–2021 were never filled in as zeros.</li>
            </ul>
          </div>
        </section>

        <section id="rs-barangays" className="rs-section" aria-labelledby="rs-barangays-title">
          <SectionHeader index={4} title="Barangay burden" kinds={['observed', 'modeled', 'unavailable']}>
            See where cases were reported across Quezon City&apos;s 142 barangays in a given year, or how the selected forecast&apos;s first week is shared out across barangays.
          </SectionHeader>
          <div className="rs-controls">
            <div className="rs-control"><span id="rs-layer-label">Show</span>
              <div className="rs-segmented" role="group" aria-labelledby="rs-layer-label">
                <button type="button" className="text-button" aria-pressed={!modeled} onClick={() => setLayer('observed')}>Observed annual cases</button>
                <button type="button" className="text-button" aria-pressed={modeled} disabled={!allocation || area !== 'QUEZON_CITY'} onClick={() => setLayer('modeled')}>Modeled first week</button>
              </div>
            </div>
            <div className="rs-control"><span>Observed year</span>
              <WorkspaceSelect label="Observed year" value={String(year)} onChange={value => setYear(Number(value))} disabled={modeled}
                options={Array.from({ length: 16 }, (_, i) => String(i + 2010)).map(y => ({ value: y, label: y }))} /></div>
          </div>
          {!allocation && <p className="rs-hint"><Info size={14} aria-hidden="true" />The modeled view needs a Quezon City forecast selected in section 2.</p>}
          <p className="rs-explain">{modeled
            ? `Modeled expected cases for the first forecast week, shared out using ${allocation?.weightYear ?? 'unavailable'} barangay weights. ${allocation?.caveat ?? ''}`
            : `Reported cases for the whole of ${year}, as counts (not adjusted for population). These are annual totals, not weekly observations.`}</p>
          {!modeled && rec && <div className="rs-stat-row rs-stat-row-compact">
            <div><span>Sum of barangay counts</span><strong>{rec.annualKnownSubtotal.toLocaleString('en-US')}</strong></div>
            <div><span>City weekly total</span><strong>{rec.weeklyCityTotal.toLocaleString('en-US')}</strong></div>
            <div><span>Barangays missing</span><strong>{rec.missingBarangays}</strong></div>
            <p>The two sources disagree; neither is overwritten.</p>
          </div>}
          <BarangayMap values={values} modeled={modeled} names={names} unit={modeled ? 'modeled cases' : 'reported cases'} />
          <p className="rs-note">Two barangay polygons are matched to source records through documented project name crosswalks.</p>
          <details className="rs-disclosure rs-disclosure-card"><summary>All 142 barangays as a table</summary>
            <div className="rs-table-wrap rs-table-scroll"><table className="rs-table">
              <thead><tr><th scope="col">Barangay</th><th scope="col">PSGC ID</th><th scope="col">{modeled ? 'Modeled first-week cases' : `Observed cases, ${year}`}</th></tr></thead>
              <tbody>{annual.map(r => <tr key={r.ADM4_PCODE}><td>{r.Barangay}</td><td className="rs-mono-cell">{r.ADM4_PCODE}</td><td>{values[r.ADM4_PCODE] === null || values[r.ADM4_PCODE] === undefined ? <span className="rs-missing">Missing</span> : fmt(values[r.ADM4_PCODE] as number, modeled ? 2 : 0)}</td></tr>)}</tbody>
            </table></div>
          </details>
        </section>

        <section id="rs-replay" className="rs-section" aria-labelledby="rs-replay-title">
          <SectionHeader index={5} title="Hospital capacity replay" kinds={['forecast', 'assumption']}>
            Send all of Quezon City&apos;s forecast dengue admissions to one hospital for 28 days, using capacity values you set. It is a stress test of your assumptions, not a picture of any real hospital.
          </SectionHeader>
          <div className="rs-callout">
            <Activity size={16} aria-hidden="true" />
            <span>To spread patients across all 46 hospitals and compare routing policies, use the <Link href="/outbreak-response" prefetch={false}>Simulation workspace</Link>.</span>
          </div>
          <div className="rs-card rs-form">
            <div className="rs-form-step">
              <span className="rs-card-label">1 · Choose a hospital</span>
              <WorkspaceSelect label="Hypothetical facility" value={selected} onChange={setSelected}
                options={[{ value: '', label: facilities.length ? 'Choose a hospital' : 'Loading hospitals…' }, ...facilities.map(f => ({ value: f.id, label: f.name }))]} />
              {facility && <p className="rs-note">{facility.id} · {facility.ownership} · {facility.accreditedBeds.toLocaleString('en-US')} accredited beds (identity only; not used as capacity)</p>}
            </div>
            <div className="rs-form-step">
              <span className="rs-card-label rs-step-label">2 · Set your assumptions <KindTag kind="assumption" /></span>
              <div className="rs-fields">
                {([
                  { label: 'Normal staffed beds', hint: 'Beds for dengue patients on a normal day', value: normal, set: setNormal, min: 1, max: 10000, step: 1, unit: 'beds' },
                  { label: 'Surge beds', hint: 'Extra staffed beds that can be opened', value: surge, set: setSurge, min: 0, max: 10000, step: 1, unit: 'beds' },
                  { label: 'Holding spaces', hint: 'Unstaffed spaces where patients wait', value: holding, set: setHolding, min: 0, max: 10000, step: 1, unit: 'spaces' },
                  { label: 'Admission fraction', hint: 'Share of cases admitted', value: rate, set: setRate, min: 0, max: 1, step: .01, unit: 'of cases' },
                  { label: 'Length of stay', hint: 'Days each admitted patient stays', value: los, set: setLos, min: 1, max: 30, step: 1, unit: 'days' },
                  { label: 'Non-dengue occupancy', hint: 'Share of beds already in use', value: occupancy, set: setOccupancy, min: 0, max: 1, step: .05, unit: 'of beds' },
                ]).map(f => <label key={f.label} className="rs-field">
                  <span className="rs-field-label">{f.label}</span>
                  <span className="rs-field-input"><input type="number" value={f.value} min={f.min} max={f.max} step={f.step} onChange={e => f.set(Number(e.target.value))} /><small>{f.unit}</small></span>
                  <small className="rs-field-hint">{f.hint} · {f.min}–{f.max.toLocaleString('en-US')}</small>
                </label>)}
              </div>
              <details className="rs-disclosure"><summary>Fixed assumptions</summary>
                <p>Zero dengue patients at the start, no admission delay, surge beds available from day 0, and weekly cases spread evenly across each day. Length of stay starts once a patient is placed in a supported bed; patients in holding wait. Patients who cannot be placed leave the modeled system.</p>
              </details>
            </div>
            <div className="rs-form-step">
              <span className="rs-card-label">3 · Confirm and run</span>
              <label className="rs-ack"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
                <span>I assume this selected hospital can admit dengue patients with the configured resources. This is unverified, including at the historical starting week.</span></label>
              <div className="rs-run-row">
                <button type="button" className="text-button rs-primary" disabled={!canRun} onClick={simulate}>{loading ? 'Computing…' : 'Run hypothetical capacity replay'}</button>
                {!canRun && !loading && <small className="rs-run-hint">To run: {blockers.join('; ')}.</small>}
              </div>
            </div>
          </div>

          {result && snapshot && <div className="rs-card rs-results" aria-live="polite">
            <div className="rs-results-head">
              <div><span className="rs-card-label">Result · hypothetical stress test</span><h3>Day {day} of 28</h3></div>
              <a className="rs-link" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`} download={`${result.scenarioId}.json`}><Download size={14} aria-hidden="true" />Export scenario</a>
            </div>
            <p className="rs-note">{result.disclaimer}</p>
            <div className="rs-day">
              <label htmlFor="rs-day-slider" className="rs-sr-only">Simulation day</label>
              <input id="rs-day-slider" aria-label="Simulation day" type="range" min={0} max={28} value={day} onChange={e => setDay(Number(e.target.value))} />
              <div className="rs-segmented" role="group" aria-label="Jump to day">{[0, 7, 14, 28].map(d => <button key={d} type="button" className="text-button" aria-pressed={day === d} onClick={() => setDay(d)}>Day {d}</button>)}</div>
            </div>
            <div className="rs-kpis">
              <div><span>Admissions demand so far</span><strong>{fmt(snapshot.cumulativeArrivals)}</strong><small>expected patients</small></div>
              <div><span>Discharged so far</span><strong>{fmt(snapshot.cumulativeDischarges)}</strong><small>expected patients</small></div>
              <div><span>In staffed beds</span><strong>{fmt(snapshot.supportedCensus)}</strong><small>today</small></div>
              <div><span>In holding spaces</span><strong>{fmt(snapshot.holdingCensus)}</strong><small>unstaffed, today</small></div>
              <div><span>Could not be placed</span><strong>{fmt(snapshot.cumulativeUnresolved)}</strong><small>cumulative</small></div>
            </div>
            {snapshot.facilities.map(f => <div className="rs-facility-result" key={f.facilityId}>
              <strong>{facilities.find(x => x.id === f.facilityId)?.name ?? f.facilityId}</strong>
              <dl className="rs-facts rs-facts-inline">
                <div><dt>Occupancy vs normal beds</dt><dd>{fmt(f.normalOccupancyPct)}%</dd></div>
                <div><dt>Occupancy vs normal + surge beds</dt><dd>{fmt(f.supportedOccupancyPct)}%</dd></div>
                <div><dt>Patients in surge beds</dt><dd>{fmt(f.surgeDengueCensus)}</dd></div>
                <div><dt>Patients in holding</dt><dd>{fmt(f.holdingCensus)}</dd></div>
              </dl>
              <small>Occupancy above 100% of normal beds means surge or holding is in use; it does not mean patients were turned away.</small>
            </div>)}
            <details className="rs-disclosure"><summary>Assumptions used in this run</summary><p>{result.assumptions}</p></details>
          </div>}
        </section>

        <footer className="rs-footer">
          <span>Research and preparedness use only. Not clinical triage, referral or live bed availability.</span>
          <a href="#rs-sources">Back to top</a>
        </footer>
      </div>
    </div>
  </main>;
}
