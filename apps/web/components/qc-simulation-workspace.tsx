'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Download, Pause, Play, RotateCcw } from 'lucide-react';
import type { MovieContext, QCControls, QCWorkspaceResult } from '@/lib/outbreak-types';
import { formatScenarioDate, nextPlaybackDay, validateDateWindow } from '@/lib/playback';
import { addDateDays, CASE_BANDS } from '@/lib/case-bands';

const OutbreakMap = dynamic(() => import('@/components/outbreak-map'), { ssr: false });
const PhilippinesOverview = dynamic(() => import('@/components/philippines-overview'), { ssr: false });
const format = (n: number | undefined | null) => n == null ? '—' : n.toLocaleString('en-PH', { maximumFractionDigits: 1 });
const range = (r: { lowerCases: number; upperCases: number } | undefined) => r ? `${format(r.lowerCases)}–${format(r.upperCases)}` : 'Unavailable';
const factorName: Record<string, string> = { RF_NASA: 'Rainfall', 'Temp_ERA5-Land': 'Temperature', 'RH_ERA5-Land': 'Relative humidity' };

type WorkspaceTab = 'historical' | 'future';
async function fetchWorkspace(controls?: QCControls, tab: WorkspaceTab = 'historical'): Promise<QCWorkspaceResult> {
  const response = await fetch(`/api/research/${tab === 'future' ? 'future-simulation' : 'qc-simulation'}`, controls ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(controls),
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || data.detail?.message || data.detail?.code ||
    (Array.isArray(data.detail) ? data.detail.map((d: { msg: string }) => d.msg).join(' ') : `Request failed (${response.status})`));
  return data;
}

export default function QCSimulationWorkspace() {
  const [tab, setTab] = useState<WorkspaceTab>('historical');
  const [planningAsOf, setPlanningAsOf] = useState<string>();
  const [data, setData] = useState<QCWorkspaceResult | null>(null);
  const [controls, setControls] = useState<QCControls | null>(null);
  const [context, setContext] = useState<MovieContext | null>(null);
  const [day, setDay] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(2);
  const [selected, setSelected] = useState(''), [hospital, setHospital] = useState('');
  const [links, setLinks] = useState(true), [reduced, setReduced] = useState(false);
  const [view, setView] = useState<'qc' | 'philippines'>('qc');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0);
  const reducedRef = useRef(false);
  const tabRef = useRef<WorkspaceTab>('historical');
  const savedForms = useRef<Partial<Record<WorkspaceTab, QCControls>>>({});
  const calculate = useCallback(async (values?: QCControls, autoplay = false, targetTab: WorkspaceTab = tabRef.current) => {
    if (values) { const invalid = validateDateWindow(values.startDate, values.endDate); if (invalid) { setError(invalid); return; } }
    const token = ++generation.current;
    setLoading(true); setData(null); setContext(null); setControls(values ?? null); setPlaying(false); setDay(0); setError('');
    try {
      const result = await fetchWorkspace(values, targetTab);
      if (token !== generation.current) return;
      setData(result); setContext(result.context); setControls(result.controlValues);
      savedForms.current[targetTab] = result.controlValues;
      if (result.futureForecast) setPlanningAsOf(result.futureForecast.asOfDate);
      setSelected(result.periodSummary.barangays[0].barangayId); setHospital('');
      setPlaying(autoplay && !reducedRef.current);
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : 'QC simulation unavailable.'); }
    finally { if (token === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { const requestGeneration = generation; void calculate(); return () => { requestGeneration.current++; }; }, [calculate]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { reducedRef.current = reduced; if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    if (!playing || !data) return;
    const timer = window.setInterval(() => setDay(d => nextPlaybackDay(d, data.durationDays)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, data, speed]);
  useEffect(() => { if (data && day >= data.durationDays) setPlaying(false); }, [day, data]);
  function update(patch: Partial<QCControls>) {
    generation.current++; setControls(c => c ? { ...c, ...patch } : c); setData(null); setPlaying(false); setDay(0); setError('');
  }
  function switchTab(next: WorkspaceTab) {
    if (next === tabRef.current) return;
    if (controls) savedForms.current[tabRef.current] = controls;
    tabRef.current = next; setTab(next);
    void calculate(savedForms.current[next], false, next);
  }
  function windowControls(days: number, start = controls?.startDate): QCControls | null {
    if (!controls || !start) return null;
    const base = { ...controls, startDate: start, endDate: addDateDays(start, days), compareAllocation: false };
    return tab === 'future' ? { ...base, horizonDays: days, surgeOnsetDay: Math.min(base.surgeOnsetDay ?? 0, days - 1) } : base;
  }
  const selectedDays = controls ? controls.horizonDays ?? Math.round((Date.parse(controls.endDate) - Date.parse(controls.startDate)) / 86400000) : 28;
  function updateDays(days: number) {
    const next = windowControls(Math.min(28, Math.max(1, Math.round(days || 1))));
    if (next) update(next);
  }
  function updateStart(start: string) {
    if (!start) { update({ startDate: '' }); return; }
    const next = windowControls(Number.isFinite(selectedDays) && selectedDays > 0 ? selectedDays : 28, start);
    if (next) update(next);
  }
  function chooseHorizon(days: number) {
    if (!controls?.startDate) return;
    const next = windowControls(days);
    if (!next) return;
    setControls(next); void calculate(next, !reduced);
  }
  const snapshot = data?.days[day];
  const area = context?.barangays.find(b => b.id === selected);
  const selectedPeriod = data?.periodSummary.barangays.find(b => b.barangayId === selected);
  const nearest = area?.nearestHospitals ?? [];
  const source = data?.forecastEvidence;
  const fullPeriod = data?.periodSummary;
  const maxCases = Math.max(1, ...(data?.days.map(d => d.expectedCases) ?? []));
  const maxBeds = Math.max(1, ...(data?.days.map(d => d.bedForecast?.upperBeds ?? d.bedForecast?.expectedBeds ?? 0) ?? []));
  const futureValidation = data?.futureForecast?.validation.filter(r => r.model === data.futureForecast?.selectedModel) ?? [];
  const coverageValues = data?.futureForecast ? futureValidation.map(r => r.empiricalRangeCoverage) : data?.forecastBacktest.map(r => r.empiricalRangeCoverage) ?? [];
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `qc-${data.scenarioId}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const numeric = (key: keyof QCControls, label: string, minimum: number, maximum: number, units: string, step = 1, scale = 1) => controls &&
    <label className="qc-number-field" key={key}><span>{label}</span><input aria-label={label} type="number" min={minimum} max={maximum} step={step}
      value={Number(controls[key]) * scale} onChange={e => update({ [key]: Number(e.target.value) / scale })} /><small>{minimum.toLocaleString()}–{maximum.toLocaleString()} {units}</small></label>;
  return <main className="qc-workspace">
    <header className="qc-header"><div><a href="/dashboard"><ArrowLeft size={13} /> NCR Dengue Intelligence</a><h1>Quezon City forecast & hospital simulation</h1>
      <p>Historical cases + environmental factors → barangay allocation → hospital strain</p></div>
      <nav><a href="/research">Forecast validation & sources</a><span>QC ONLY · 142 barangays · 46 hospital records</span></nav></header>
    <div className="qc-scope-note"><Activity size={16} /><span>{tab === 'future' ? 'Future seasonal surge planning: new seasonal curves and historical weather analogs; current 2026/2027 surveillance and real hospital census are unavailable.' : 'Historical replay: source-based case/environment forecasts for retrospective periods.'} <strong>No place selection is required.</strong> QC calculations; Philippines geography is context only.</span></div>
    {error && <div className="qc-error" role="alert">{error}<button onClick={() => calculate()}>Reload data-based forecast</button></div>}
    <div className="qc-layout">
      <aside className="qc-controls">
        <div className="qc-workspace-tabs" role="tablist" aria-label="Simulation workspace">
          {(['historical', 'future'] as const).map(value => <button key={value} id={`qc-tab-${value}`} role="tab"
            aria-selected={tab === value} aria-controls="qc-tab-panel" tabIndex={tab === value ? 0 : -1}
            onClick={() => switchTab(value)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 'historical' : event.key === 'End' ? 'future' : value === 'historical' ? 'future' : 'historical';
              switchTab(next); document.getElementById(`qc-tab-${next}`)?.focus();
            }}>{value === 'historical' ? 'Historical replay' : 'Future surge forecast'}</button>)}
        </div>
        <div id="qc-tab-panel" role="tabpanel" aria-labelledby={`qc-tab-${tab}`}>
        <div className="qc-section-heading">01 / Dates & forecast</div>
        {controls ? <>
          {tab === 'future' && <label>Season / planning month<input aria-label="Planning month" type="month" min={data?.futureForecast?.asOfDate.slice(0, 7)} max="2035-12" value={controls.startDate.slice(0, 7)} onChange={event => {
            if (!event.target.value) return;
            const requested = `${event.target.value}-01`;
            updateStart(data?.futureForecast?.asOfDate && requested < data.futureForecast.asOfDate ? data.futureForecast.asOfDate : requested);
          }} /><small>Choose a future month, including January 2027.</small></label>}
          <label>From · QC local date<input aria-label="Forecast start date" type="date" min={tab === 'future' ? planningAsOf : '2024-01-29'} max={tab === 'future' ? '2035-12-31' : '2025-12-31'} value={controls.startDate} onChange={e => updateStart(e.target.value)} /></label>
          <label>Number of forecast days<input aria-label="Forecast horizon in days" type="number" min={1} max={28} step={1} value={Number.isFinite(selectedDays) ? selectedDays : 1} onChange={e => updateDays(Number(e.target.value))} /><small>Any whole number from 1–28; e.g. 2, 12, 14 or 28.</small></label>
          <label>To · final snapshot<input aria-label="Forecast end date" type="date" min={controls.startDate ? addDateDays(controls.startDate, 1) : undefined} max={controls.startDate ? addDateDays(controls.startDate, 28) : undefined} value={controls.endDate} readOnly={tab === 'future'} onChange={e => update({ endDate: e.target.value })} /><small>{tab === 'future' ? 'Computed from start date + forecast days.' : '1–28 elapsed days; daily interval [start, end).'}</small></label>
          <div className="qc-horizons">{[2, 7, 12, 14, 28].map(h => <button key={h} aria-pressed={data?.durationDays === h} onClick={() => chooseHorizon(h)} disabled={loading}>{h} days</button>)}</div>
          {tab === 'historical' && <label>Historical scenario<select aria-label="Scenario mode" value={controls.mode} onChange={e => update({ mode: e.target.value as QCControls['mode'], extraCasesPerWeek: e.target.value === 'forecast' ? 0 : 700 })}>
            <option value="forecast">Data-based historical forecast replay</option><option value="hypothetical_shock">Stress overlay on historical period</option></select><small>Training data: 2010–2025. Replay reference origins: 2024–2025.</small></label>}
          {tab === 'historical' && controls.mode === 'hypothetical_shock' && <div className="qc-hypothetical">Added cases are assumptions, separate from the environmental forecast.
            {numeric('extraCasesPerWeek', 'Additional cases at full intensity', 0, 100000, 'cases/week', 50)}
            {numeric('growthDays', 'Ramp to full intensity', 1, 28, 'days')}</div>}
          {tab === 'future' && <>
            <label>Weather / season assumption<select aria-label="Historical weather profile" value={controls.weatherProfile ?? 'typical'} onChange={e => update({ weatherProfile: e.target.value as QCControls['weatherProfile'] })}>
              <option value="typical">Typical historical seasonal weather</option><option value="wetter">Wetter historical analog</option><option value="drier">Drier historical analog</option><option value="hotter">Hotter historical analog</option></select><small>Derived from past within-season weather; not a weather forecast.</small></label>
            <div className="qc-hypothetical"><label className="qc-surge-toggle"><input type="checkbox" checked={controls.surgeEnabled ?? true} onChange={e => update({ surgeEnabled: e.target.checked })} /> Simulate a surge</label>
              {controls.surgeEnabled && <>{numeric('surgeMultiplier', 'Peak case multiplier', 1, 10, '× seasonal baseline', .1)}
                {numeric('surgeOnsetDay', 'Surge starts on day', 0, Math.max(0, selectedDays - 1), 'day index')}
                {numeric('growthDays', 'Ramp to peak multiplier', 1, 28, 'days')}
                <p>Surge timing and intensity are assumptions, not a predicted probability of an outbreak.</p></>}
            </div>
          </>}
          <label>Hospital allocation<select aria-label="Hospital allocation policy" value={controls.allocationPolicy} onChange={e => update({ allocationPolicy: e.target.value as QCControls['allocationPolicy'], compareAllocation: false })}>
            <option value="nearest">Nearest supported capacity baseline</option><option value="optimized">Optimize capacity-constrained placements</option></select></label>
          <details className="qc-assumptions"><summary>Bounded hospital assumptions</summary><p>All 46 sites are assumed eligible in this planning network. Actual staffed/dengue beds remain unknown.</p>
            {numeric('normalCapacity', 'Normal staffed beds / site', 1, 10000, 'assumed beds')}
            {numeric('surgeCapacity', 'Supported surge beds / site', 0, 10000, 'assumed beds')}
            {numeric('holdingCapacity', 'Unstaffed holding spaces / site', 0, 10000, 'spaces')}
            {numeric('hospitalizationRate', 'Admission fraction', 0, 100, '%', 1, 100)}
            {numeric('baselineOccupancy', 'Non-dengue occupancy', 0, 100, '%', 1, 100)}
            {numeric('lengthOfStayDays', 'Length of stay', 1, 30, 'days')}
            {numeric('admissionDelayDays', 'Admission delay', 0, 28, 'days')}
            {numeric('surgeActivationDay', 'Surge activation', 0, 28, 'day index')}
          </details>
          <button className="qc-primary" disabled={loading} onClick={() => calculate({ ...controls, compareAllocation: false }, !reduced)}>{loading ? 'Calculating…' : 'Update QC forecast & simulation'}</button>
          <button className="qc-compare-button" disabled={loading} onClick={() => calculate({ ...controls, compareAllocation: true }, false)}>Compare baseline vs optimized</button>
        </> : <p role="status">{loading ? 'Loading the selected engine and case ranges…' : 'Model data unavailable.'}</p>}
        <section className="qc-environment"><div className="qc-section-heading">{tab === 'future' ? 'Seasonal forecasting engine' : 'Environmental basis'}</div>
          {source ? <><p>{tab === 'future' ? 'Training observations through' : 'Source origin'} <strong>{source.issueBlock.YR} / WN {source.issueBlock.WN}</strong></p>
            {data?.futureForecast && <p><strong>{data.futureForecast.selectedModel === 'seasonal_boosted_trees' ? 'Seasonal gradient-boosted trees' : 'Seasonal baseline (calibration-selected)'}</strong><br />Issued for planning: {data.futureForecast.asOfDate}</p>}
            {source.environmentalInputs.map(f => <div key={f.sourceColumn}><span>{factorName[f.sourceColumn] || f.sourceColumn}</span><strong>{format(f.valueAtOrigin)} <small>{f.unit}</small></strong></div>)}
            <p>{tab === 'future' ? 'Values above are assumed historical weather analogs for the selected season. No current-case lags or measured future weather are fabricated.' : 'Observed inputs at origin; lagged 1, 2 and 4 source blocks in the city model.'} No measured barangay microclimate.</p></> : <p>Environmental evidence loads with the approved forecast.</p>}
        </section>
        </div>
      </aside>
      <section className="qc-main">
        <div className="qc-period-summary"><div><span>QC expected cases · full selected range</span><strong>{format(fullPeriod?.expectedCases)}</strong></div>
          <div><span>Experimental empirical case range · 80% target</span><strong>{range(fullPeriod?.caseRange)}</strong><small>Conditional on historical spatial weights</small></div>
          <p>{controls?.startDate && controls.endDate ? `${formatScenarioDate(controls.startDate)} – ${formatScenarioDate(controls.endDate)}` : 'Choose a date window'} · source-week/calendar alignment is an explicit assumption.</p></div>
        {data && coverageValues.length > 0 && <p className="qc-range-caution">Range validation: observed weekly coverage {format(Math.min(...coverageValues) * 100)}–{format(Math.max(...coverageValues) * 100)}% {data.futureForecast ? 'on 2024–2025 seasonal holdouts (52 weeks/year)' : 'across eight retrospective origins/horizon'}. The 80% target was not achieved; these are exploratory ranges.</p>}
        <div className="qc-map-shell"><OutbreakMap context={context} snapshot={snapshot ?? null} maximum={data?.mapScaleMaxDailyCases ?? 1} selected={selected}
          onSelect={id => { setSelected(id); setHospital(''); }} onHospital={setHospital} playing={playing} reducedMotion={reduced} showLinks={links} view={view} />
          <div className="qc-map-date"><span>{playing ? '● Playing' : data ? 'Paused' : 'Awaiting update'}</span><strong>{snapshot ? formatScenarioDate(snapshot.date) : 'Quezon City'}</strong><small>Day {day} / {data?.durationDays ?? '—'} · modeled cumulative cases</small></div>
          <div className="qc-map-switch"><button aria-pressed={view === 'qc'} onClick={() => setView('qc')}>QC detail</button><button aria-pressed={view === 'philippines'} onClick={() => setView('philippines')}>Philippines</button></div>
          <PhilippinesOverview />
          <div className="qc-map-legend"><strong>Expected cases accumulated to this frame</strong><div>{CASE_BANDS.map(b => <span key={b.min}><i style={{ background: b.color }} />{b.label}</span>)}</div><small>Display ranges only; not official outbreak thresholds. Purple dashed = nearest hospital; solid = modeled placement.</small></div>
        </div>
        <div className="qc-playback-panel"><div className="qc-chart-heading"><strong>Daily expected cases</strong><span>Reference forecast + separately assumed shock</span></div>
          <svg viewBox="0 0 900 80" role="img" aria-label="QC daily case forecast trajectory, including a separately colored hypothetical shock">
            {data?.days.slice(1).map((d, i) => { const x = 10 + i * 880 / data.durationDays, width = 880 / data.durationDays - 4;
              return <g key={d.dayIndex}><rect x={x - 2} y={0} width={width + 4} height={80} fill={d.dayIndex === day ? '#ffffff15' : 'transparent'} />
                <rect x={x} y={75 - d.expectedCases / maxCases * 65} width={width} height={d.expectedCases / maxCases * 65} rx={2} fill="#dd9b65" />
                <rect x={x} y={75 - d.baselineCases / maxCases * 65} width={width} height={d.baselineCases / maxCases * 65} rx={2} fill="#629f9b" /></g>; })}
          </svg>
          <div className="qc-play-controls"><button aria-label={playing ? 'Pause simulation' : 'Play simulation'} disabled={!data} onClick={() => { if (data && day === data.durationDays) setDay(0); setPlaying(p => !p); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
            <button aria-label="Restart simulation" disabled={!data} onClick={() => { setDay(0); setPlaying(false); }}><RotateCcw size={16} /></button>
            <input aria-label="Simulation day" type="range" min={0} max={data?.durationDays ?? 28} step={1} value={day} disabled={!data} onChange={e => { setDay(Number(e.target.value)); setPlaying(false); }} />
            <label>Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5, 1, 2, 4].map(s => <option key={s} value={s}>{s} days/s</option>)}</select><small>0.5–4 days/s</small></label></div>
          <div className="qc-view-controls"><label><input type="checkbox" checked={links} onChange={e => setLinks(e.target.checked)} /> Hospital connections</label><label><input type="checkbox" checked={reduced} onChange={e => { setReduced(e.target.checked); if (e.target.checked) setPlaying(false); }} /> Reduced motion</label>
            <span>Day {day} · cases during [{snapshot?.intervalStart.slice(0, 10) ?? '—'}, {snapshot?.intervalEnd.slice(0, 10) ?? '—'})</span></div>
        </div>
        <section className="qc-bed-forecast" aria-label="Bed demand forecast">
          <div className="qc-section-heading">Bed forecast · required dengue staffing, occupancy & shortfall</div>
          <div className="qc-bed-summary">
            <div><span>Peak staffed beds required</span><strong>{format(data?.bedProjection?.staffedBedsRequired)}</strong><small>Peak day {data?.bedProjection?.peakDayIndex ?? '—'} · {data?.bedProjection?.peakDate ?? '—'}</small></div>
            <div><span>Peak low–high case sensitivity</span><strong>{format(data?.bedProjection?.peakLowerStaffedBedsRequired)}–{format(data?.bedProjection?.peakUpperStaffedBedsRequired)}</strong><small>Fixed admission fraction and LOS</small></div>
            <div><span>Additional staffed beds needed</span><strong>{format(data?.bedProjection?.peakAdditionalStaffedBedsNeeded)}</strong><small>Peak network shortfall vs assumed capacity</small></div>
          </div>
          <div className="qc-chart-heading"><strong>Daily unconstrained bed demand</strong><span>Expected beds · shaded case-range sensitivity</span></div>
          <svg viewBox="0 0 900 100" role="img" aria-label="Forecast daily bed demand and case-range sensitivity, separate from real vacancies">
            {data && <>
              <polygon points={[
                ...data.days.map((d, i) => `${12 + i * 876 / data.durationDays},${90 - (d.bedForecast?.upperBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`),
                ...[...data.days].reverse().map(d => `${12 + d.dayIndex * 876 / data.durationDays},${90 - (d.bedForecast?.lowerBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`),
              ].join(' ')} fill="#6ea9d12b" />
              <polyline points={data.days.map((d, i) => `${12 + i * 876 / data.durationDays},${90 - (d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`).join(' ')} fill="none" stroke="#8bc9eb" strokeWidth={2} />
              <line x1={12 + day * 876 / data.durationDays} x2={12 + day * 876 / data.durationDays} y1={8} y2={92} stroke="#b5cedb" strokeDasharray="3 4" />
            </>}
          </svg>
          <p>Day {day}: {format(snapshot?.bedForecast?.staffedBedsRequired)} staffed dengue beds required; {format(snapshot?.bedForecast?.additionalStaffedBedsNeeded)} additional beds vs assumed supported capacity. This is demand before capacity rejection, not actual vacant beds.</p>
          <p>Initial dengue census is assumed zero. Real staffed beds/current occupancy and observed hospital admissions are unavailable; bed ranges are case-demand sensitivity, not validated occupancy intervals.</p>
        </section>
        <section className="qc-hotspots"><div className="qc-section-heading">Automatically ranked QC barangays · full selected date range</div>
          <p>Historical annual burden ({context?.weightYear ?? '—'}) supplies spatial weights. Forecast ranges omit unmeasured spatial-allocation uncertainty. <button onClick={() => setShowAll(v => !v)}>{showAll ? 'Show top 10' : 'Show all 142 barangays'}</button></p>
          <div className="qc-table-scroll"><table><thead><tr><th>Barangay</th><th>Observed annual cases</th><th>Expected window cases</th><th>Conditional case range</th></tr></thead><tbody>
            {fullPeriod?.barangays.slice(0, showAll ? 142 : 10).map(row => { const b = context!.barangays.find(b => b.id === row.barangayId)!; return <tr key={b.id} className={selected === b.id ? 'selected' : ''}>
              <td><button onClick={() => { setSelected(b.id); setHospital(''); }}>{b.name}</button></td><td>{format(b.observedAnnualCases)} ({context?.weightYear})</td><td>{format(row.cumulativeCases)}</td><td>{range(row.caseRange)}</td></tr>; })}
          </tbody></table></div>
        </section>
      </section>
      <aside className="qc-hospital-sidebar"><div className="qc-section-heading">02 / Nearest hospital capacity</div>
        <h2>{area?.name ?? 'Leading QC hotspot'}</h2><p>Automatically focused on the highest modeled window burden. Map/table clicks are optional inspection.</p>
        <div className="qc-area-estimate"><strong>{format(selectedPeriod?.cumulativeCases)} expected cases</strong><span>Window range: {range(selectedPeriod?.caseRange)}</span></div>
        {nearest.map((n, index) => { const h = context!.hospitals.find(h => h.id === n.facilityId)!; const stat = snapshot?.facilities.find(s => s.facilityId === h.id);
          return <section key={h.id} className={`qc-hospital-card${hospital === h.id ? ' active' : ''}`}><div className="qc-hospital-card-title"><span>{index + 1} / nearest registered site</span><strong>{n.distanceKm.toFixed(2)} km</strong></div>
            <h3>{h.name}</h3><p>{h.id} · straight-line proxy · provisional point</p>
            <div className="qc-source-bed"><span>Source-reported accredited beds</span><strong>{h.accreditedBeds}</strong><small>PhilHealth · {h.sourceAsOf}; not free/staffed beds.</small></div>
            <p className="qc-unknown">Actual staffed / dengue-usable beds: <strong>Unknown</strong></p>
            <div className="qc-capacity-grid"><div><span>Assumed normal</span><strong>{format(stat?.normalCapacity)}</strong></div><div><span>Activated surge</span><strong>{format(stat?.activatedSurgeCapacity)}</strong></div>
              <div><span>Residual supported slots</span><strong>{format(stat?.remainingSupportedCapacity)}</strong></div><div><span>Expected dengue census</span><strong>{format(stat?.supportedCensus)}</strong></div></div>
            <div className="qc-hospital-bed-forecast"><strong>Bed-demand forecast · day {day}</strong>
              <span>Required staffed beds <b>{format(stat?.bedForecast?.staffedBedsRequired)}</b></span>
              <span>Low–high case sensitivity <b>{format(stat?.bedForecast?.lowerStaffedBedsRequired)}–{format(stat?.bedForecast?.upperStaffedBedsRequired)}</b></span>
              <span>Local additional beds <b>{format(stat?.bedForecast?.additionalStaffedBedsNeeded)}</b></span>
              <span>Window peak staffing need <b>{format(data?.bedProjection?.hospitalPeaks.find(f => f.facilityId === h.id)?.peakStaffedBedsRequired)}</b></span>
              <small>Nearest catchment before diversions; not observed admissions or vacancies.</small>
            </div>
            <div className="qc-capacity-pressure"><span>Normal-relative occupancy <strong>{format(stat?.normalOccupancyPct)}%</strong></span><span>Supported-relative occupancy <strong>{format(stat?.supportedOccupancyPct)}%</strong></span>
              <span>Unstaffed holding <strong>{format(stat?.holdingCensus)}</strong></span></div>
            <small>Capacities and occupancy are scenario assumptions, not current vacancies.</small><div className="qc-hospital-links"><a href={h.primarySourceUrl} target="_blank" rel="noreferrer">Bed source</a><a href={h.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate evidence</a></div>
          </section>; })}
      </aside>
    </div>
    {data?.allocationComparison && <section className="qc-comparison"><h2>Resource allocation comparison</h2><p>{data.allocationComparison.caveat}</p><table><thead><tr><th>Same-input policy</th><th>Unresolved demand</th><th>Holding census</th><th>Peak normal occupancy</th><th>Expected patient-km</th></tr></thead><tbody>{(['nearest', 'optimized'] as const).map(policy => { const m = data.allocationComparison![policy]; return <tr key={policy}><td>{policy}</td><td>{format(m.cumulativeUnresolved)}</td><td>{format(m.holdingCensus)}</td><td>{format(m.maxNormalOccupancyPct)}%</td><td>{format(m.expectedPatientKm)}</td></tr>; })}</tbody></table></section>}
    <section className="qc-provenance"><details><summary>Forecast ranges, date assumptions and reproducibility</summary>
      <p>{data?.referenceSelectionAssumption}</p><p>{data?.rangeInterpretation}</p><p>{source?.intervalCaveat}</p><p>{source?.spatialCaveat}</p><p>{data?.assumptions}</p>
      {data?.futureForecast ? <>
        <p>{data.futureForecast.stalenessCaveat}</p><p>{data.futureForecast.weatherCaveat}</p><p>Selection: {data.futureForecast.selection.criterion}. Calibration MAE: boosted {format(data.futureForecast.selection.scores.seasonal_boosted_trees)}, seasonal baseline {format(data.futureForecast.selection.scores.seasonal_baseline)}. Later holdout comparisons are shown below; model selection was frozen before evaluating those years.</p>
        <table><thead><tr><th>Held-out year</th><th>Model</th><th>n</th><th>MAE cases/week</th><th>RMSE</th><th>Range coverage</th></tr></thead><tbody>{data.futureForecast.validation.map(m => <tr key={`${m.year}-${m.model}`}><td>{m.year}</td><td>{m.model}</td><td>{m.n}</td><td>{format(m.mae)}</td><td>{format(m.rmse)}</td><td>{format(m.empiricalRangeCoverage * 100)}%</td></tr>)}</tbody></table>
      </> : <table><thead><tr><th>Horizon</th><th>n</th><th>Weather MAE</th><th>Cases-only MAE</th><th>Persistence MAE</th><th>Empirical range coverage</th></tr></thead><tbody>{data?.forecastBacktest.map(m => <tr key={m.horizon}><td>{m.horizon} source blocks</td><td>{m.n}</td><td>{format(m.weatherMae)}</td><td>{format(m.casesOnlyMae)}</td><td>{format(m.persistenceMae)}</td><td>{format(m.empiricalRangeCoverage * 100)}%</td></tr>)}</tbody></table>}
      <p>Source: <a href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615">UPRI-NOAH dengue/environmental dataset</a>, ODC-ODbL 1.0. Philippines regions provide geographic context; all case and hospital-demand calculations are QC-only.</p>
      <p>Scenario {data?.scenarioId}<br />Computed {data?.runTimestamp}<br />Workspace result SHA-256 {data?.resultSha256}</p>
    </details><button disabled={!data} onClick={download}><Download size={14} /> Export cases, ranges & simulation</button></section>
    <section className="qc-statusbar" aria-label="Observed cases and simulation totals">
      <div className="qc-observed-total"><span>{tab === 'future' ? 'Observed historical source cases' : 'Observed cases already'}</span><strong>{format(source?.observedSourceYearToDateCases)}</strong><small>Source-year to {source ? `${source.issueBlock.YR}/WN ${source.issueBlock.WN}` : 'origin'} · {tab === 'future' ? 'not a current 2026/2027 count' : `latest block ${format(source?.observedCasesAtOrigin)}`}</small></div>
      <div><span>New expected cases</span><strong>{format(snapshot?.expectedCases)}</strong><small>Daily range {range(snapshot?.dailyCaseRange)}</small></div>
      <div><span>Cumulative cases</span><strong>{format(snapshot?.cumulativeCases)}</strong><small>Range {range(snapshot?.caseRange)} · expected cases</small></div>
      <div><span>Supported census</span><strong>{format(snapshot?.supportedCensus)}</strong><small>Expected patients</small></div>
      <div><span>Unstaffed holding</span><strong>{format(snapshot?.holdingCensus)}</strong><small>Expected patients</small></div>
      <div><span>Unresolved demand</span><strong>{format(snapshot?.cumulativeUnresolved)}</strong><small>Cumulative expected patients</small></div>
    </section>
  </main>;
}
