'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Download, Pause, Play, RotateCcw } from 'lucide-react';
import type { BedForecast, MovieContext, QCControls, QCWorkspaceResult } from '@/lib/outbreak-types';
import { formatScenarioDate, nextPlaybackDay, validateDateWindow } from '@/lib/playback';
import { addDateDays, CASE_BANDS } from '@/lib/case-bands';
import QCWorkspaceSidebar from '@/components/qc-workspace-sidebar';

const OutbreakMap = dynamic(() => import('@/components/outbreak-map'), { ssr: false });
const PhilippinesOverview = dynamic(() => import('@/components/philippines-overview'), { ssr: false });
const format = (n: number | undefined | null) => n == null ? '—' : n.toLocaleString('en-PH', { maximumFractionDigits: 1 });
const range = (r: { lowerCases: number; upperCases: number } | undefined) => r ? `${format(r.lowerCases)}–${format(r.upperCases)}` : 'Unavailable';
const factorName: Record<string, string> = { RF_NASA: 'Rainfall', 'Temp_ERA5-Land': 'Temperature', 'RH_ERA5-Land': 'Relative humidity' };

type WorkspaceTab = 'historical' | 'future';
function BedUse({ forecast, day, occupancyPct }: { forecast?: BedForecast; day: number; occupancyPct?: number }) {
  if (!forecast) return null;
  const pct = forecast.demandUtilizationPct;
  return <section className={`qc-bed-use${pct != null && pct > 100 ? ' over-capacity' : ''}`} aria-label="Projected bed demand and capacity percentage">
    <strong>Day {day} · predicted dengue bed demand</strong>
    <div className="qc-bed-use-ratio"><b>{format(forecast.expectedBeds)}</b><span>expected beds needed / <b>{format(forecast.assumedSupportedDengueCapacity)}</b> assumed dengue slots</span></div>
    <div className="qc-bed-use-percent">{pct == null ? forecast.assumedSupportedDengueCapacity === 0 ? 'No dengue slots assumed' : 'Percentage unavailable' : `${format(pct)}% of modeled dengue slots`}</div>
    {pct != null && <div className="qc-bed-use-track" aria-hidden="true"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>}
    <small>Expected dengue bed demand ÷ assumed dengue-care slots × 100. Above 100% means demand exceeds that scenario capacity, before diversions.</small>
    {occupancyPct != null && <p>Simulated occupancy of all staffed beds: <b>{format(occupancyPct)}%</b>, including assumed non-dengue patients after placements. Holding is excluded.</p>}
    <small>These are scenario estimates; actual staffed beds and occupancy are unknown.</small>
  </section>;
}
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
  const [showHotspotDetails, setShowHotspotDetails] = useState(false);
  const [hospitalInspection, setHospitalInspection] = useState(0);
  const hospitalPanel = useRef<HTMLElement>(null);
  const [links, setLinks] = useState(true), [reduced, setReduced] = useState(false);
  const [view, setView] = useState<'qc' | 'philippines'>('qc');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [caseMetric, setCaseMetric] = useState<'daily' | 'cumulative'>('cumulative');
  const [historicalWindows, setHistoricalWindows] = useState<{ startDate: string; endDate: string }[]>([]);
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
      setData(result); setContext(result.context); setControls(result.controlValues); setCaseMetric('cumulative');
      savedForms.current[targetTab] = result.controlValues;
      if (result.historicalWindows) setHistoricalWindows(result.historicalWindows);
      if (result.futureForecast) setPlanningAsOf(result.futureForecast.asOfDate);
      setSelected(result.periodSummary.barangays[0].barangayId); setHospital(''); setShowHotspotDetails(false);
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
  const scenario = day > 0 ? data : null;
  const snapshot = scenario?.days[day];
  const area = context?.barangays.find(b => b.id === selected);
  const selectedPeriod = scenario?.periodSummary.barangays.find(b => b.barangayId === selected);
  const selectedBedProjection = scenario?.bedProjection?.placePeaks?.find(b => b.barangayId === selected);
  const selectedDaily = scenario?.days.slice(1).map(d => ({ dayIndex: d.dayIndex, date: d.date,
    expectedCases: d.barangays.find(b => b.barangayId === selected)?.expectedCases ?? 0 })) ?? [];
  const maxSelectedDaily = Math.max(1, ...selectedDaily.map(d => d.expectedCases));
  const nearest = area?.nearestHospitals ?? [];
  const nearestHospital = context?.hospitals.find(h => h.id === nearest[0]?.facilityId);
  const localHospitals = area?.hospitalsWithinBarangay ?? [];
  const source = data?.forecastEvidence;
  const fullPeriod = scenario?.periodSummary;
  const finalDay = scenario?.days.at(-1);
  const hotspotRanking = context?.hotspotRanking;
  const markerHotspotIds = hotspotRanking?.candidateIds ?? data?.days.at(-1)?.hotspotIds;
  const caseColorMaximum = Math.max(1, ...(scenario?.days.flatMap(d => d.barangays.filter(b => markerHotspotIds?.includes(b.barangayId)).map(b => caseMetric === 'daily' ? b.expectedCases : b.cumulativeCases)) ?? []));
  const surgeActive = !!snapshot && snapshot.shockCases > 0;
  const surgeStatus = !scenario ? 'Simulation not started' : surgeActive ? 'Configured surge active' : tab === 'future' && controls?.surgeEnabled && (controls.surgeMultiplier ?? 1) > 1 ? 'Configured surge scheduled' : 'Baseline forecast · no added surge';
  const rankedHotspotIds = markerHotspotIds;
  const hotspotRows = markerHotspotIds?.flatMap(id => { const row = fullPeriod?.barangays.find(b => b.barangayId === id); return row ? [row] : []; }) ?? [];
  const inspectedHospital = context?.hospitals.find(h => h.id === hospital);
  const hospitalHotspot = finalDay?.facilities.find(f => f.facilityId === hospital)?.nearestHotspot;
  const hospitalHotspotArea = context?.barangays.find(b => b.id === hospitalHotspot?.barangayId);
  const hospitalHotspotCases = fullPeriod?.barangays.find(b => b.barangayId === hospitalHotspot?.barangayId);
  const displayedHospitals = inspectedHospital
    ? [{ facilityId: inspectedHospital.id, distanceKm: hospitalHotspot?.distanceKm ?? null }]
    : nearest;
  function inspectHospital(id: string) {
    setHospital(id);
    setShowHotspotDetails(false);
    setHospitalInspection(value => value + 1);
    hospitalPanel.current?.scrollTo({ top: 0, behavior: 'instant' });
    const closest = finalDay?.facilities.find(f => f.facilityId === id)?.nearestHotspot;
    if (closest) setSelected(closest.barangayId);
  }
  function inspectHotspot(id: string) {
    setSelected(id); setHospital(''); setShowHotspotDetails(true);
  }
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
    <header className="qc-header"><div><a href="/dashboard"><ArrowLeft size={13} /> SurgeWise</a><h1>Quezon City forecast & hospital simulation</h1>
      <p>Historical cases + environmental factors → barangay allocation → hospital strain</p></div>
      <nav><a href="/research">Forecast validation & sources</a><span>QC ONLY · 142 barangays · 46 hospital records</span></nav></header>
    <div className="qc-scope-note"><Activity size={16} /><span>{tab === 'future' ? 'Future seasonal surge planning: new seasonal curves and historical weather analogs; current 2026/2027 surveillance and real hospital census are unavailable.' : 'Historical replay: source-based case/environment forecasts for retrospective periods.'} <strong>No place selection is required.</strong> QC calculations; Philippines geography is context only.</span></div>
    {error && <div className="qc-error" role="alert">{error}<button disabled={loading} onClick={() => calculate(controls ?? undefined)}>Reload data-based forecast</button></div>}
    <div className="qc-layout">
      <QCWorkspaceSidebar side="left" label="Forecast controls">
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
          {tab === 'future' && <label>Season / planning month<input aria-label="Planning month" type="month" min={planningAsOf?.slice(0, 7)} max="2035-12" value={controls.startDate.slice(0, 7)} onChange={event => {
            if (!event.target.value) return;
            const requested = `${event.target.value}-01`;
            updateStart(planningAsOf && requested < planningAsOf ? planningAsOf : requested);
          }} /><small>Sets the start date. The simulation still covers the selected 1–28 days, not an entire calendar month.</small></label>}
          <label>From · QC local date<input aria-label="Forecast start date" type="date" min={tab === 'future' ? planningAsOf : '2024-01-29'} max={tab === 'future' ? '2035-12-31' : '2025-12-31'} value={controls.startDate} onChange={e => updateStart(e.target.value)} /></label>
          <label>Number of forecast days<input aria-label="Forecast horizon in days" type="number" min={1} max={28} step={1} value={Number.isFinite(selectedDays) ? selectedDays : 1} onChange={e => updateDays(Number(e.target.value))} /><small>Any whole number from 1–28; e.g. 2, 12, 14 or 28.</small></label>
          <label>To · final snapshot<input aria-label="Forecast end date" type="date" min={controls.startDate ? addDateDays(controls.startDate, 1) : undefined} max={controls.startDate ? addDateDays(controls.startDate, 28) : undefined} value={controls.endDate} readOnly={tab === 'future'} onChange={e => update({ endDate: e.target.value })} /><small>{tab === 'future' ? 'Computed from start date + forecast days.' : '1–28 elapsed days; daily interval [start, end).'}</small></label>
          <div className="qc-horizons">{[2, 7, 12, 14, 28].map(h => <button key={h} aria-pressed={data?.durationDays === h} onClick={() => chooseHorizon(h)} disabled={loading}>{h} days</button>)}</div>
          {tab === 'historical' && <label>Historical scenario<select aria-label="Scenario mode" value={controls.mode} onChange={e => update({ mode: e.target.value as QCControls['mode'], extraCasesPerWeek: e.target.value === 'forecast' ? 0 : 700 })}>
            <option value="forecast">Data-based historical forecast replay</option><option value="hypothetical_shock">Stress overlay on historical period</option></select><small>Training data: 2010–2025. Replay reference origins: 2024–2025.</small></label>}
          {tab === 'historical' && historicalWindows.length > 0 && <label>Available historical forecast targets<select aria-label="Available historical forecast window" value="" onChange={event => {
            if (event.target.value) updateStart(event.target.value);
          }}><option value="">Choose a covered start date</option>{historicalWindows.map(window => <option key={window.startDate} value={window.startDate}>{window.startDate} to {window.endDate} (end exclusive)</option>)}</select><small>Selected dates must fit inside one saved forecast window. Another month’s forecast is never substituted.</small></label>}
          {tab === 'historical' && controls.mode === 'hypothetical_shock' && <div className="qc-hypothetical">Added cases are assumptions, separate from the environmental forecast.
            {numeric('extraCasesPerWeek', 'Additional cases at full intensity', 0, 100000, 'cases/week', 50)}
            {numeric('growthDays', 'Ramp to full intensity', 1, 28, 'days')}</div>}
          {tab === 'future' && <>
            <label>Weather / season assumption<select aria-label="Historical weather profile" disabled={data?.futureForecast?.usesWeather === false} value={controls.weatherProfile ?? 'typical'} onChange={e => update({ weatherProfile: e.target.value as QCControls['weatherProfile'] })}>
              <option value="typical">Typical historical seasonal weather</option><option value="wetter">Wetter historical analog</option><option value="drier">Drier historical analog</option><option value="hotter">Hotter historical analog</option></select><small>{data?.futureForecast?.usesWeather === false ? 'The selected XGBoost configuration uses seasonal features only. Changing weather profiles does not change its cases.' : 'Derived from past within-season weather; not a weather forecast.'}</small></label>
            <div className="qc-hypothetical"><label className="qc-surge-toggle"><input type="checkbox" checked={controls.surgeEnabled ?? true} onChange={e => update({ surgeEnabled: e.target.checked })} /> Simulate a surge</label>
              {controls.surgeEnabled && <>{numeric('surgeMultiplier', 'Peak case multiplier', 1, 10, '× seasonal baseline', .1)}
                {numeric('surgeOnsetDay', 'Surge starts on day', 0, Math.max(0, selectedDays - 1), 'day index')}
                {numeric('growthDays', 'Ramp to peak multiplier', 1, 28, 'days')}
                <p>Surge timing and intensity are assumptions, not a predicted probability of an outbreak.</p></>}
            </div>
            {data?.futureForecast?.parameterAudit && <p className="qc-hypothetical">Calculated window: {data.futureForecast.parameterAudit.horizonDays} days, [{data.futureForecast.parameterAudit.startDate}, {data.futureForecast.parameterAudit.endDateExclusive}).
              {data.futureForecast.parameterAudit.surgeOnsetDate ? ` Added surge begins in the interval starting ${data.futureForecast.parameterAudit.surgeOnsetDate}; maximum applied multiplier ${format(data.futureForecast.parameterAudit.maximumAppliedMultiplier)}×. ${data.futureForecast.parameterAudit.fullMultiplierReached ? 'The requested peak is reached.' : 'The window ends before the requested peak is reached.'}` : ' No added case surge.'}
              {` Staffed surge beds activate at snapshot ${data.futureForecast.parameterAudit.staffedSurgeActivationSnapshotDate}${data.futureForecast.parameterAudit.staffedSurgeActivationWithinWindow ? '.' : ', outside this window.'} Admission delay ${data.futureForecast.parameterAudit.admissionDelayDays} days; stay ${data.futureForecast.parameterAudit.lengthOfStayDays} days.`}
              <small>The seasonal curve repeats using evidence through 2025; future annual growth and outbreak probability are not modeled. Maximum source-year gap: {data.futureForecast.parameterAudit.sourceYearGap}. {data.futureForecast.parameterAudit.centralGapEvaluated ? 'Seasonal baseline case errors were checked at this year gap; added surge is an assumption.' : 'This weather profile/year gap has no matched evaluation.'} {!data.futureForecast.parameterAudit.rangeEvaluatedAtRequestedGap && 'Range coverage is not validated for this weather/surge/year-gap combination.'}</small>
            </p>}
          </>}
          <label>Hospital allocation<select aria-label="Hospital allocation policy" value={controls.allocationPolicy} onChange={e => update({ allocationPolicy: e.target.value as QCControls['allocationPolicy'], compareAllocation: false })}>
            <option value="nearest">Nearest supported capacity baseline</option><option value="optimized">Optimize capacity-constrained placements</option></select></label>
          <label>Assumed arrival split<select aria-label="Hospital arrival split" value={controls.arrivalSplitPolicy ?? 'nearest_three_equal'} onChange={e => update({ arrivalSplitPolicy: e.target.value as QCControls['arrivalSplitPolicy'], compareAllocation: false })}>
            <option value="nearest_three_equal">Divide equally across three nearest sites</option><option value="nearest">Nearest site first</option></select><small>Expected-value choice assumption, not measured patient preference. Full hospitals can divert demand.</small></label>
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
            {data?.futureForecast && <p><strong>{data.futureForecast.selectedModel === 'seasonal_xgboost' ? 'XGBoost seasonal case forecast' : data.futureForecast.selectedModel === 'seasonal_boosted_trees' ? 'Seasonal gradient-boosted trees' : 'Seasonal baseline'}</strong><br />Issued for planning: {data.futureForecast.asOfDate}</p>}
            {data?.futureForecast?.accuracyAssessment && <p className="qc-range-caution">Experimental accuracy: {data.futureForecast.accuracyAssessment.comparison.map(row => `${row.year}: ${format(row.maeSkillVsSeasonalBaseline * 100)}% MAE improvement versus seasonal baseline`).join('; ')}. Negative means worse. Current-year, barangay-weekly and bed-occupancy accuracy remain unverified.</p>}
            {source.environmentalInputs.map(f => <div key={f.sourceColumn}><span>{factorName[f.sourceColumn] || f.sourceColumn}</span><strong>{format(f.valueAtOrigin)} <small>{f.unit}</small></strong></div>)}
            <p>{tab === 'future' ? 'Values above are assumed historical weather analogs for the selected season. No current-case lags or measured future weather are fabricated.' : 'Observed inputs at origin; lagged 1, 2 and 4 source blocks in the city model.'} No measured barangay microclimate.</p></> : <p>Environmental evidence loads with the approved forecast.</p>}
        </section>
        </div>
      </aside>
      </QCWorkspaceSidebar>
      <section className="qc-main">
        {!scenario && <p className="qc-simulation-pending" role="status">Simulation not started. Play or advance the day to display modeled values. Base cases for {controls?.startDate ?? 'the selected date'}: unavailable; no verified daily observation is available for that date. Dated hospital inventory and source evidence remain available.</p>}
        <details className="qc-case-summary" open>
          <summary><span className="qc-summary-expanded">Hide case summary & range validation</span><span className="qc-summary-collapsed">Show case summary & range validation</span></summary>
        <div className="qc-period-summary"><div><span>QC expected cases · full selected range</span><strong>{format(fullPeriod?.expectedCases)}</strong></div>
          <div><span>Experimental empirical case range · 80% target</span><strong>{range(fullPeriod?.caseRange)}</strong><small>Conditional on historical spatial weights</small></div>
          <p>{controls?.startDate && controls.endDate ? `${formatScenarioDate(controls.startDate)} – ${formatScenarioDate(controls.endDate)}` : 'Choose a date window'} · source-week/calendar alignment is an explicit assumption.</p></div>
        {data && coverageValues.length > 0 && <p className="qc-range-caution">Range validation: observed weekly coverage {format(Math.min(...coverageValues) * 100)}–{format(Math.max(...coverageValues) * 100)}% {data.futureForecast ? 'on 2024–2025 seasonal holdouts (52 weeks/year)' : 'across eight retrospective origins/horizon'}. The 80% target was not achieved; these are exploratory ranges.</p>}
        </details>
        <div className="qc-map-shell"><div className="qc-map-toolbar">
          <div className="qc-map-date"><span>{playing ? '● Playing' : scenario ? 'Paused' : data ? 'Ready · not started' : 'Awaiting update'}</span><strong>{snapshot ? formatScenarioDate(snapshot.date) : controls?.startDate ? formatScenarioDate(controls.startDate) : 'Quezon City'}</strong><small>Day {day} / {data?.durationDays ?? '—'} · {scenario ? 'modeled cumulative cases' : 'no modeled values yet'}</small></div>
          <div className="qc-map-switch"><button aria-pressed={view === 'qc'} onClick={() => setView('qc')}>QC detail</button><button aria-pressed={view === 'philippines'} onClick={() => setView('philippines')}>Philippines</button></div>
          <div className="qc-map-switch" role="group" aria-label="Map case measure"><button aria-pressed={caseMetric === 'daily'} onClick={() => setCaseMetric('daily')}>Daily forecast</button><button aria-pressed={caseMetric === 'cumulative'} onClick={() => setCaseMetric('cumulative')}>Accumulated cases</button></div>
          </div>
          <p className="qc-progression-note">{hotspotRanking ? `XGBoost ranks predicted annual barangay burden for ${hotspotRanking.forecastYear}, trained only through ${hotspotRanking.trainingCutoffYear}. Only the ten highest-burden candidates are marked. Their modeled annual shares allocate the dated QC forecast; this is not validated weekly hotspot detection.` : 'Places follow dated modeled allocations; local weekly hotspot forecasts are unavailable.'} All places update together, without a neighbor-triggered outbreak sequence.</p>
          <div className="qc-map-stage"><OutbreakMap context={context} snapshot={snapshot ?? null} maximum={data?.mapScaleMaxDailyCases ?? 1} selected={selected}
            selectedHospital={hospital} hotspotIds={markerHotspotIds} rankedHotspotIds={rankedHotspotIds} hospitalHotspot={hospitalHotspot} caseMetric={caseMetric} caseColorMaximum={caseColorMaximum} animationDurationMs={Math.min(650, 800 / speed)}
            onSelect={inspectHotspot} onHospital={inspectHospital} playing={playing} reducedMotion={reduced} showLinks={links} view={view} /></div>
          <div className="qc-map-information">
          <PhilippinesOverview />
          {inspectedHospital && <section className="qc-map-inspection" aria-label="Selected hospital details" aria-live="polite">
            <button className="qc-inspection-close" aria-label="Close hospital details" onClick={() => setHospital('')}>×</button>
            <span>Selected hospital · provisional point</span><strong>{inspectedHospital.name}</strong>
            <div><b>{format(inspectedHospital.accreditedBeds)}</b> accredited beds · PhilHealth {inspectedHospital.sourceAsOf}</div>
            <small>Staffed / available dengue beds: unknown</small>
            {scenario ? <p>Nearest high-burden candidate: <b>{hospitalHotspotArea?.name ?? 'Unavailable'}</b>{hospitalHotspot ? ` · ${hospitalHotspot.distanceKm.toFixed(2)} km` : ''}<br />{format(hospitalHotspotCases?.cumulativeCases)} projected cases in the selected window</p> : <p>Start simulation to display modeled candidate demand. Current staffed capacity and base cases for this date are unavailable.</p>}
          </section>}
          {showHotspotDetails && area && !inspectedHospital && <section className="qc-map-inspection qc-hotspot-inspection" aria-label="Selected hotspot details" aria-live="polite">
            <button className="qc-inspection-close" aria-label="Close hotspot details" onClick={() => setShowHotspotDetails(false)}>×</button>
            <span>{markerHotspotIds?.includes(area.id) ? 'High-burden candidate' : 'Selected barangay · not a hotspot candidate'} · projected allocation</span><strong>{area.name}</strong>
            {scenario && area.predictedAnnualCases != null && <small>XGBoost annual burden estimate: {format(area.predictedAnnualCases)} cases ({hotspotRanking?.forecastYear}) · rank {area.burdenRank} of 142</small>}
            <div><b>{format(selectedPeriod?.cumulativeCases)}</b> projected cases · full date window</div>
            <small>Range {range(selectedPeriod?.caseRange)} · {format(snapshot?.barangays.find(b => b.barangayId === area.id)?.cumulativeCases)} cases to day {day}</small>
            <p>Nearest hospital: {nearestHospital ? <button onClick={() => inspectHospital(nearestHospital.id)}>{nearestHospital.name}</button> : 'Unavailable'}{nearest[0] ? ` · ${nearest[0].distanceKm.toFixed(2)} km` : ''}<br />Straight-line proxy · provisional hospital point</p>
            <div className="qc-local-hospitals"><span>Hospitals inside this barangay: {localHospitals.length}</span>{localHospitals.map(entry => {
              const h = context?.hospitals.find(h => h.id === entry.facilityId);
              return h && <button key={h.id} onClick={() => inspectHospital(h.id)}>{h.name} · {entry.distanceKm.toFixed(2)} km</button>;
            })}<small>Based on provisional point-in-polygon matches; not verified entrances or referrals.</small></div>
          </section>}
          <div className="qc-map-legend"><strong>{scenario ? caseMetric === 'daily' ? `Expected cases during day ${day} · each place’s dated allocation` : `Expected cases accumulated to day ${day}` : 'Forecast locations preview · case values hidden'}</strong>
            <div className="qc-case-color-ramp" aria-hidden="true" /><div>{CASE_BANDS.map(b => <span key={b.min}><i style={{ background: b.color }} />{scenario ? format(b.min / 50 * caseColorMaximum) : b.min === 0 ? 'Low' : b.min === 50 ? 'High' : '·'}</span>)}</div>
            <small>Smooth shades between these reference values; scale is fixed for the selected window. Accumulated cases show daily growth; daily forecasts may stay flat within a source week. {reduced ? 'Reduced motion is on: color animation is disabled.' : 'Colors animate from each place’s forecast values; no geographic infection chain is implied.'}</small>
            <div className="qc-marker-key"><span><b className="qc-marker-hotspot" aria-hidden="true">1</b>{scenario ? 'XGBoost high-burden candidate' : 'Hotspot location preview · values hidden'}</span><span><b className="qc-marker-hospital" aria-hidden="true">✚</b>Hospital · click for details</span><span><i className="qc-other-barangay" />Other barangay · may still have cases</span></div>
            <small>Only the {markerHotspotIds?.length ?? '—'} highest predicted annual-burden candidates have orange markers and case-band coloring; other barangays remain neutral. Positive demand alone does not make a hotspot. Gray stems link separated icons to mapped points. {hotspotRanking?.model}; no confirmed weekly-outbreak claim.</small>
            <div className="qc-line-key"><span><i className="nearest-line" />Nearest + hospitals inside barangay</span><span><i className="placement-line" />Modeled placement</span><span><i className="inspected-line" />Hospital’s nearest hotspot</span></div>
            <small>Bold lines and decorative raised outline = selection. Orange solid = holding placement. Straight-line proximity only; provisional hospital points. Colors show modeled intensity, not official outbreak thresholds.</small></div>
          </div>
        </div>
        <section className="qc-hotspot-key" aria-label="Hotspot locations, projected cases and nearest hospitals">
          <h2>Hotspot guide · XGBoost high-burden candidates</h2>
          <p>{hotspotRanking ? `Annual burden forecast for ${hotspotRanking.forecastYear}; source/training cutoff ${hotspotRanking.trainingCutoffYear}. Top ten is a research ranking, not a validated outbreak threshold.` : 'Hotspot ranking awaits approved model data.'} Window cases: {controls?.startDate} to {controls?.endDate} (end exclusive).</p>
          <div className="qc-table-scroll"><table><thead><tr><th>Candidate location</th><th>XGBoost annual burden</th><th>Projected window cases</th><th>Nearest hospital</th></tr></thead><tbody>
            {hotspotRows.map((row, index) => {
              const b = context!.barangays.find(b => b.id === row.barangayId)!;
              const closest = b.nearestHospitals[0]; const h = context!.hospitals.find(h => h.id === closest?.facilityId);
              return <tr key={b.id} className={selected === b.id ? 'selected' : ''}>
                <td><button aria-pressed={selected === b.id} onClick={() => inspectHotspot(b.id)}>{index + 1}. {b.name}</button></td>
                <td>{format(b.predictedAnnualCases)}<small>Annual forecast · {hotspotRanking?.forecastYear}</small></td>
                <td>{format(row.cumulativeCases)}<small>Range {range(row.caseRange)}</small></td>
                <td>{h ? <button onClick={() => inspectHospital(h.id)}>{h.name}</button> : 'Unavailable'}<small>{closest ? `${closest.distanceKm.toFixed(2)} km · straight-line` : 'Distance unavailable'}</small></td>
              </tr>;
            })}
          </tbody></table></div>
          {hotspotRanking && <details className="qc-hotspot-validation"><summary>Annual XGBoost ranking definition & validation</summary>
            <p>{hotspotRanking.criterion}. Forecast year {hotspotRanking.forecastYear}; source-label cutoff {hotspotRanking.trainingCutoffYear}. Shares are held fixed for the selected window.</p>
            <div className="qc-table-scroll"><table><thead><tr><th>Evaluation year</th><th>Model</th><th>Annual-case MAE</th><th>Matched observed top 10</th></tr></thead><tbody>
              {hotspotRanking.validation.map(row => <tr key={`${row.targetYear}-${row.model}`}><td>{row.targetYear}</td><td>{row.model}</td><td>{format(row.maeAnnualCases)}</td><td>{row.top10Overlap}/{row.topCount}</td></tr>)}
            </tbody></table></div><p>{hotspotRanking.limitations} Baselines can outperform XGBoost on the ranking metric; no superiority claim is made.</p>
          </details>}
          {scenario && !finalDay?.hotspotIds.length && <p>No positive projected hotspot burden in this date window.</p>}
          {!scenario && <p>Hotspot ranks and case projections appear after the simulation starts.</p>}
          {area && <div className="qc-selected-place"><strong>Selected barangay: {area.name}</strong><span>{format(selectedPeriod?.cumulativeCases)} projected cases in the window · {format(snapshot?.barangays.find(b => b.barangayId === area.id)?.cumulativeCases)} accumulated to day {day}</span>
            <span>Nearest hospital: {context?.hospitals.find(h => h.id === nearest[0]?.facilityId)?.name ?? 'Unavailable'}{nearest[0] ? ` · ${nearest[0].distanceKm.toFixed(2)} km` : ''}</span>
            <small>Progression uses this barangay’s dated allocated forecast. All places update together; no infection chain is modeled. XGBoost predicts annual barangay burden; its modeled shares allocate QC weekly forecasts. Independent weekly barangay forecasts remain unavailable.</small>
            {scenario && <svg viewBox="0 0 440 75" role="img" aria-label={`Daily projected case allocation for ${area.name}`}>
              {selectedDaily.map(d => {
                const cases = d.expectedCases;
                const height = cases / maxSelectedDaily * 60;
                return <rect key={d.dayIndex} x={8 + (d.dayIndex - 1) * 424 / scenario.durationDays} y={68 - height} width={Math.max(2, 424 / scenario.durationDays - 3)} height={height} fill={d.dayIndex === day ? '#ffd09a' : '#6caeaa'}><title>{`${d.date}: ${format(cases)} expected cases in ${area.name}`}</title></rect>;
              })}
            </svg>}
          </div>}
        </section>
        <section className="qc-local-bed-forecast" aria-label="Surge bed forecast near selected place">
          <h2>Surge bed forecast near {area?.name ?? 'the selected place'}</h2>
          <div className={`qc-surge-status${surgeActive ? ' active' : ''}`} role="status">{surgeStatus} · {snapshot ? formatScenarioDate(snapshot.date) : controls?.startDate ? formatScenarioDate(controls.startDate) : 'select dates'}<small>Configured scenario status, not an observed outbreak declaration.</small></div>
          <p>Case model: {data?.futureForecast ? 'XGBoost seasonal projection' : 'audited historical cases/weather replay'}. Bed need is a conditional admissions/LOS calculation; no observed hospital occupancy targets were available for model training.</p>
          <p>Demand from this barangay only, divided using the configured hospital-choice assumption. Required staffed beds are calculated from projected cases, admission fraction, delay and length of stay. Actual staffed capacity and vacancies are unknown.</p>
          {selectedBedProjection ? <div className="qc-table-scroll"><table><thead><tr><th>Hospital</th><th>Assumed arrival share</th><th>Expected admissions</th><th>No-added-surge peak beds</th><th>With-surge peak beds</th><th>Peak extra beds from surge</th></tr></thead><tbody>
            {selectedBedProjection.hospitals.map(row => { const h = context?.hospitals.find(h => h.id === row.facilityId); return <tr key={row.facilityId}>
              <td><button onClick={() => inspectHospital(row.facilityId)}>{h?.name ?? row.facilityId}</button></td><td>{format(row.share * 100)}%</td><td>{format(row.expectedAdmissions)}</td>
              <td>{format(row.baselinePeakStaffedBedsRequired)}</td><td>{format(row.peakStaffedBedsRequired)}</td><td>{format(row.additionalStaffedBedsDueToSurge)}</td></tr>; })}
          </tbody></table></div> : <p>Start or advance the simulation to show this place’s bed-demand projections.</p>}
          {selectedBedProjection && <div className="qc-nearby-bed-use" aria-label="Predicted bed demand percentage at nearby hospitals">
            {selectedBedProjection.hospitals.map(row => { const h = context?.hospitals.find(h => h.id === row.facilityId); const stat = snapshot?.facilities.find(f => f.facilityId === row.facilityId); return <article key={row.facilityId}>
              <button onClick={() => inspectHospital(row.facilityId)}>{h?.name ?? row.facilityId}</button>
              <p>Assumed arrival split: {format(row.share * 100)}% from this place. This is not bed utilization.</p>
              <BedUse forecast={stat?.bedForecast} day={day} occupancyPct={stat?.supportedOccupancyPct} />
              <small>Hospital-wide demand from all barangays; peak demand percentage {scenario?.bedProjection?.hospitalPeaks.find(f => f.facilityId === row.facilityId)?.peakDemandUtilizationPct == null ? 'unavailable' : `${format(scenario.bedProjection?.hospitalPeaks.find(f => f.facilityId === row.facilityId)?.peakDemandUtilizationPct)}%`} of assumed dengue slots.</small>
            </article>; })}
          </div>}
          <small>For three sites, equal shares mean one third each before capacity diversions. Hospital cards include all barangays’ demand; local rows above show only this place. Site-specific staffing rounds up to whole beds. These are demand estimates, not available beds.</small>
        </section>
        <div className="qc-playback-panel"><div className="qc-chart-heading"><strong>Daily expected cases</strong><span>Reference forecast + separately assumed shock</span></div>
          <svg viewBox="0 0 900 80" role="img" aria-label="QC daily case forecast trajectory, including a separately colored hypothetical shock">
            {scenario?.days.slice(1).map((d, i) => { const x = 10 + i * 880 / scenario.durationDays, width = 880 / scenario.durationDays - 4;
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
            <div><span>Peak staffed beds required</span><strong>{format(scenario?.bedProjection?.staffedBedsRequired)}</strong><small>Peak day {scenario?.bedProjection?.peakDayIndex ?? '—'} · {scenario?.bedProjection?.peakDate ?? '—'}</small></div>
            <div><span>Peak low–high case sensitivity</span><strong>{format(scenario?.bedProjection?.peakLowerStaffedBedsRequired)}–{format(scenario?.bedProjection?.peakUpperStaffedBedsRequired)}</strong><small>Fixed admission fraction and LOS</small></div>
            <div><span>Additional staffed beds needed</span><strong>{format(scenario?.bedProjection?.peakAdditionalStaffedBedsNeeded)}</strong><small>Peak network shortfall vs assumed capacity</small></div>
            <div><span>Peak extra beds due to surge</span><strong>{format(scenario?.bedProjection?.peakAdditionalStaffedBedsDueToSurge)}</strong><small>No-added-surge peak: {format(scenario?.bedProjection?.baselinePeakStaffedBedsRequired)} beds</small></div>
          </div>
          <div className="qc-chart-heading"><strong>Daily unconstrained bed demand</strong><span>Expected beds · shaded case-range sensitivity</span></div>
          <svg viewBox="0 0 900 100" role="img" aria-label="Forecast daily bed demand and case-range sensitivity, separate from real vacancies">
            {scenario && <>
              <polygon points={[
                ...scenario.days.map((d, i) => `${12 + i * 876 / scenario.durationDays},${90 - (d.bedForecast?.upperBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`),
                ...[...scenario.days].reverse().map(d => `${12 + d.dayIndex * 876 / scenario.durationDays},${90 - (d.bedForecast?.lowerBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`),
              ].join(' ')} fill="#6ea9d12b" />
              <polyline points={scenario.days.map((d, i) => `${12 + i * 876 / scenario.durationDays},${90 - (d.bedForecast?.expectedBeds ?? 0) / maxBeds * 78}`).join(' ')} fill="none" stroke="#8bc9eb" strokeWidth={2} />
              <line x1={12 + day * 876 / scenario.durationDays} x2={12 + day * 876 / scenario.durationDays} y1={8} y2={92} stroke="#b5cedb" strokeDasharray="3 4" />
            </>}
          </svg>
          <p>Day {day}: {format(snapshot?.bedForecast?.staffedBedsRequired)} staffed dengue beds required; {format(snapshot?.bedForecast?.additionalStaffedBedsNeeded)} additional beds vs assumed supported capacity. This is demand before capacity rejection, not actual vacant beds.</p>
          <p>Initial dengue census is assumed zero. Real staffed beds/current occupancy and observed hospital admissions are unavailable; bed ranges are case-demand sensitivity, not validated occupancy intervals.</p>
        </section>
        <section className="qc-hotspots"><div className="qc-section-heading">Automatically ranked QC barangays · full selected date range</div>
          <p>Annual XGBoost burden predictions supply modeled shares; observed annual source counts below are from {context?.weightYear ?? '—'}. Forecast ranges omit spatial-model uncertainty. Positive demand is not hotspot membership. <button onClick={() => setShowAll(v => !v)}>{showAll ? 'Show top 10' : 'Show all 142 barangays'}</button></p>
          <div className="qc-table-scroll"><table><thead><tr><th>Barangay</th><th>Observed annual cases</th><th>Expected window cases</th><th>Conditional case range</th></tr></thead><tbody>
            {fullPeriod?.barangays.slice(0, showAll ? 142 : 10).map(row => { const b = context!.barangays.find(b => b.id === row.barangayId)!; return <tr key={b.id} className={selected === b.id ? 'selected' : ''}>
              <td><button onClick={() => inspectHotspot(b.id)}>{b.name}</button></td><td>{format(b.observedAnnualCases)} ({context?.weightYear})</td><td>{format(row.cumulativeCases)}</td><td>{range(row.caseRange)}</td></tr>; })}
          </tbody></table></div>
        </section>
      </section>
      <QCWorkspaceSidebar side="right" label="Hospital capacity" revealKey={hospitalInspection}>
      <aside ref={hospitalPanel} className="qc-hospital-sidebar"><div className="qc-section-heading">02 / Nearest hospital capacity</div>
        <label className="qc-hospital-picker">Inspect any registered hospital<select aria-label="Inspect hospital" value={hospital} disabled={!context}
          onChange={event => event.target.value ? inspectHospital(event.target.value) : setHospital('')}>
          <option value="">Nearest hospitals to selected barangay</option>
          {context?.hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select></label>
        <h2>{inspectedHospital?.name ?? area?.name ?? 'Leading QC hotspot'}</h2><p>{inspectedHospital ? 'Selected hospital · source capacity and nearest ranked hotspot for the full window.' : 'Nearest registered hospitals to the selected barangay. Click any hospital on the map to inspect it.'}</p>
        {inspectedHospital && <div className="qc-hospital-hotspot"><strong>Nearest high-burden candidate</strong>
          {hospitalHotspotArea ? <><button onClick={() => inspectHotspot(hospitalHotspotArea.id)}>{hospitalHotspotArea.name}</button><span>{hospitalHotspot?.distanceKm.toFixed(2)} km · straight-line</span><span>{format(hospitalHotspotCases?.cumulativeCases)} projected window cases · range {range(hospitalHotspotCases?.caseRange)}</span></> : <span>{scenario ? 'No ranked hotspot in this window.' : 'Start simulation to display modeled hotspots.'}</span>}
          <small>Closest of the 10 ranked hotspots by representative point; not a referral or verified hospital entrance.</small>
          <button onClick={() => setHospital('')}>Back to nearest hospitals</button></div>}
        <div className="qc-area-estimate"><strong>{format(selectedPeriod?.cumulativeCases)} expected cases</strong><span>Window range: {range(selectedPeriod?.caseRange)}</span></div>
        {!inspectedHospital && selectedBedProjection && <section className="qc-local-bed-summary"><h3>Surge bed need from {area?.name}</h3>
          <div className={`qc-surge-status${surgeActive ? ' active' : ''}`}>{surgeStatus} · day {day}</div>
          {selectedBedProjection.hospitals.map(row => <div key={row.facilityId}><button onClick={() => inspectHospital(row.facilityId)}>{context?.hospitals.find(h => h.id === row.facilityId)?.name ?? row.facilityId}</button>
            <span>Arrival split {format(row.share * 100)}% (not occupancy) · {format(row.peakStaffedBedsRequired)} peak beds from this place · {format(row.additionalStaffedBedsDueToSurge)} extra due to surge</span>
            <span>Hospital-wide bed demand: {format(snapshot?.facilities.find(f => f.facilityId === row.facilityId)?.bedForecast?.expectedBeds)} / {format(snapshot?.facilities.find(f => f.facilityId === row.facilityId)?.bedForecast?.assumedSupportedDengueCapacity)} assumed dengue slots · {snapshot?.facilities.find(f => f.facilityId === row.facilityId)?.bedForecast?.demandUtilizationPct == null ? 'percentage unavailable' : `${format(snapshot.facilities.find(f => f.facilityId === row.facilityId)?.bedForecast?.demandUtilizationPct)}% demand`}</span></div>)}
          <small>Selected place only. Actual available/staffed beds are unknown.</small></section>}
        {displayedHospitals.map((n, index) => { const h = context!.hospitals.find(h => h.id === n.facilityId)!; const stat = snapshot?.facilities.find(s => s.facilityId === h.id);
          return <section key={h.id} className={`qc-hospital-card${hospital === h.id ? ' active' : ''}`}><div className="qc-hospital-card-title"><span>{inspectedHospital ? 'Selected hospital' : `${index + 1} / nearest registered site`}</span><strong>{n.distanceKm == null ? 'Unknown distance' : `${n.distanceKm.toFixed(2)} km`}</strong></div>
            <h3><button onClick={() => inspectHospital(h.id)}>{h.name}</button></h3><p>{h.id} · straight-line proxy · provisional point</p>
            <div className="qc-source-bed"><span>Source-reported accredited beds</span><strong>{h.accreditedBeds}</strong><small>PhilHealth · {h.sourceAsOf}; not free/staffed beds.</small></div>
            <p className="qc-unknown">Actual staffed / dengue-usable beds: <strong>Unknown</strong></p>
            <BedUse forecast={stat?.bedForecast} day={day} occupancyPct={stat?.supportedOccupancyPct} />
            <div className="qc-capacity-grid"><div><span>Assumed normal</span><strong>{format(stat?.normalCapacity)}</strong></div><div><span>Activated surge</span><strong>{format(stat?.activatedSurgeCapacity)}</strong></div>
              <div><span>Residual supported slots</span><strong>{format(stat?.remainingSupportedCapacity)}</strong></div><div><span>Expected dengue census</span><strong>{format(stat?.supportedCensus)}</strong></div></div>
            <div className="qc-hospital-bed-forecast"><strong>Bed-demand forecast · day {day}</strong>
              <span>Required staffed beds <b>{format(stat?.bedForecast?.staffedBedsRequired)}</b></span>
              <span>No-added-surge bed need <b>{format(stat?.bedForecast?.baselineStaffedBedsRequired)}</b></span>
              <span>Extra beds due to surge <b>{format(stat?.bedForecast?.additionalStaffedBedsDueToSurge)}</b></span>
              <span>Low–high case sensitivity <b>{format(stat?.bedForecast?.lowerStaffedBedsRequired)}–{format(stat?.bedForecast?.upperStaffedBedsRequired)}</b></span>
              <span>Local additional beds <b>{format(stat?.bedForecast?.additionalStaffedBedsNeeded)}</b></span>
              <span>Window peak staffing need <b>{format(scenario?.bedProjection?.hospitalPeaks.find(f => f.facilityId === h.id)?.peakStaffedBedsRequired)}</b></span>
              <span>Window peak extra from surge <b>{format(scenario?.bedProjection?.hospitalPeaks.find(f => f.facilityId === h.id)?.additionalStaffedBedsDueToSurge)}</b></span>
              <small>Assumed arrival split before diversions; all modeled origin barangays, not observed admissions or vacancies.</small>
            </div>
            <div className="qc-capacity-pressure"><span>Normal-relative occupancy <strong>{format(stat?.normalOccupancyPct)}%</strong></span><span>Supported-relative occupancy <strong>{format(stat?.supportedOccupancyPct)}%</strong></span>
              <span>Unstaffed holding <strong>{format(stat?.holdingCensus)}</strong></span></div>
            <small>Capacities and occupancy are scenario assumptions, not current vacancies.</small><div className="qc-hospital-links"><a href={h.primarySourceUrl} target="_blank" rel="noreferrer">Bed source</a><a href={h.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate evidence</a></div>
          </section>; })}
      </aside>
      </QCWorkspaceSidebar>
    </div>
    {scenario?.allocationComparison && <section className="qc-comparison"><h2>Resource allocation comparison</h2><p>{scenario.allocationComparison.caveat}</p><table><thead><tr><th>Same-input policy</th><th>Unresolved demand</th><th>Holding census</th><th>Peak normal occupancy</th><th>Expected patient-km</th></tr></thead><tbody>{(['nearest', 'optimized'] as const).map(policy => { const m = scenario.allocationComparison![policy]; return <tr key={policy}><td>{policy}</td><td>{format(m.cumulativeUnresolved)}</td><td>{format(m.holdingCensus)}</td><td>{format(m.maxNormalOccupancyPct)}%</td><td>{format(m.expectedPatientKm)}</td></tr>; })}</tbody></table></section>}
    <details className="qc-results-footer" open>
    <summary><span className="qc-footer-expanded">Hide reproducibility, export & simulation totals</span><span className="qc-footer-collapsed">Show reproducibility, export & simulation totals</span></summary>
    <section className="qc-provenance"><details><summary>Forecast ranges, date assumptions and reproducibility</summary>
      <p>{data?.referenceSelectionAssumption}</p><p>{data?.rangeInterpretation}</p><p>{source?.intervalCaveat}</p><p>{source?.spatialCaveat}</p><p>{data?.assumptions}</p>
      {data?.futureForecast ? <>
        <p>{data.futureForecast.stalenessCaveat}</p><p>{data.futureForecast.weatherCaveat}</p><p>Selection: {data.futureForecast.selection.criterion}. Calibration MAE: XGBoost {format(data.futureForecast.selection.scores.seasonal_xgboost)}, original boosted {format(data.futureForecast.selection.scores.seasonal_boosted_trees)}, seasonal baseline {format(data.futureForecast.selection.scores.seasonal_baseline)}. XGBoost is a requested planning model; comparisons below do not establish superiority. There are no observed admissions or occupancy targets to validate a direct bed model.</p>
        <table><thead><tr><th>Evaluation year</th><th>Model</th><th>n</th><th>MAE cases/week</th><th>RMSE</th><th>Weighted absolute error</th><th>Mean bias</th><th>Range coverage</th></tr></thead><tbody>{data.futureForecast.validation.map(m => <tr key={`${m.year}-${m.model}`}><td>{m.year}</td><td>{m.model}</td><td>{m.n}</td><td>{format(m.mae)}</td><td>{format(m.rmse)}</td><td>{format(m.wapePct)}%</td><td>{format(m.meanBias)}</td><td>{format(m.empiricalRangeCoverage * 100)}%</td></tr>)}</tbody></table>
        <p>{data.futureForecast.rangeEvidencePolicy}</p>
        {data.futureForecast.leadYearGapValidation && <details><summary>Forecast accuracy when source data are older</summary><p>Frozen XGBoost configuration, evaluated with one, two or three source-year gaps. No later-year labels enter training or weather analogs. Range coverage was evaluated only at gap 1; these stale-source comparisons assess central cases.</p><div className="qc-table-scroll"><table><thead><tr><th>Evaluation year</th><th>Last training year</th><th>Year gap</th><th>Model</th><th>MAE cases/week</th><th>Weighted error</th></tr></thead><tbody>{data.futureForecast.leadYearGapValidation.map(row => <tr key={`${row.year}-${row.sourceYearGap}-${row.model}`}><td>{row.year}</td><td>{row.lastTrainingYear}</td><td>{row.sourceYearGap}</td><td>{row.model}</td><td>{format(row.mae)}</td><td>{format(row.wapePct)}%</td></tr>)}</tbody></table></div></details>}
        {data.futureForecast.calendarDiagnostics && <details><summary>Accuracy by month, season and number of days</summary>
          <p>{data.futureForecast.calendarDiagnostics.targetDefinition} {data.futureForecast.calendarDiagnostics.evaluationDesign} These are retrospective diagnostics. Negative bias means underprediction; weighted absolute error is an error percentage, not an accuracy score.</p>
          <p>XGBoost configuration: {data.futureForecast.xgboostVariant}. Selection used only 2018–2023; 2024–2025 were excluded from selection. These evaluation years have already been examined during development.</p>
          <h3>Window length · XGBoost</h3><div className="qc-table-scroll"><table><thead><tr><th>Year</th><th>Days</th><th>Windows</th><th>MAE cases/window</th><th>Weighted error</th><th>Range coverage</th></tr></thead><tbody>{data.futureForecast.calendarDiagnostics.windowLengths.filter(row => row.model === data.futureForecast?.selectedModel).map(row => <tr key={`${row.year}-${row.days}`}><td>{row.year}</td><td>{row.days}</td><td>{row.n}</td><td>{format(row.mae)}</td><td>{format(row.wapePct)}%</td><td>{format(row.empiricalRangeCoverage * 100)}%</td></tr>)}</tbody></table></div>
          <h3>Seasonal source quarters · XGBoost</h3><p>Each quarter contains 13 native source weeks. These are calendar groupings, not official wet/dry-season labels.</p><div className="qc-table-scroll"><table><thead><tr><th>Year</th><th>Quarter</th><th>Weeks</th><th>MAE cases/week</th><th>Weighted error</th><th>Mean bias</th></tr></thead><tbody>{data.futureForecast.calendarDiagnostics.sourceQuarters.filter(row => row.model === data.futureForecast?.selectedModel).map(row => <tr key={`${row.year}-${row.sourceQuarter}`}><td>{row.year}</td><td>{row.sourceQuarter}</td><td>{row.n}</td><td>{format(row.mae)}</td><td>{format(row.wapePct)}%</td><td>{format(row.meanBias)}</td></tr>)}</tbody></table></div>
          <h3>Assumed calendar months · XGBoost</h3><div className="qc-table-scroll"><table><thead><tr><th>Year/month</th><th>Days</th><th>Predicted cases</th><th>Source-derived cases</th><th>Absolute error</th></tr></thead><tbody>{data.futureForecast.calendarDiagnostics.monthly.filter(row => row.model === data.futureForecast?.selectedModel).map(row => <tr key={`${row.year}-${row.month}`}><td>{row.year}/{String(row.month).padStart(2, '0')}</td><td>{row.calendarDays}</td><td>{format(row.expectedCases)}</td><td>{format(row.sourceDerivedCases)}</td><td>{format(row.absoluteError)}</td></tr>)}</tbody></table></div>
        </details>}
      </> : <table><thead><tr><th>Horizon</th><th>n</th><th>Weather MAE</th><th>Cases-only MAE</th><th>Persistence MAE</th><th>Empirical range coverage</th></tr></thead><tbody>{data?.forecastBacktest.map(m => <tr key={m.horizon}><td>{m.horizon} source blocks</td><td>{m.n}</td><td>{format(m.weatherMae)}</td><td>{format(m.casesOnlyMae)}</td><td>{format(m.persistenceMae)}</td><td>{format(m.empiricalRangeCoverage * 100)}%</td></tr>)}</tbody></table>}
      <p>Source: <a href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615">UPRI-NOAH dengue/environmental dataset</a>, ODC-ODbL 1.0. Philippines regions provide geographic context; all case and hospital-demand calculations are QC-only.</p>
      <p>Scenario {data?.scenarioId}<br />Computed {data?.runTimestamp}<br />Workspace result SHA-256 {data?.resultSha256}</p>
    </details><button disabled={!scenario} onClick={download}><Download size={14} /> Export cases, ranges & simulation</button></section>
    <section className="qc-statusbar" aria-label="Observed cases and simulation totals">
      <div className="qc-observed-total"><span>{scenario ? tab === 'future' ? 'Observed historical source cases' : 'Observed cases already' : 'Base cases for selected date'}</span><strong>{scenario ? format(source?.observedSourceYearToDateCases) : 'Unavailable'}</strong><small>{scenario ? `Source-year to ${source ? `${source.issueBlock.YR}/WN ${source.issueBlock.WN}` : 'origin'} · ${tab === 'future' ? 'not a current 2026/2027 count' : `latest block ${format(source?.observedCasesAtOrigin)}`}` : 'No authoritative daily base count for this date; historical source totals are separate evidence.'}</small></div>
      <div><span>New expected cases</span><strong>{format(snapshot?.expectedCases)}</strong><small>Daily range {range(snapshot?.dailyCaseRange)}</small></div>
      <div><span>Cumulative cases</span><strong>{format(snapshot?.cumulativeCases)}</strong><small>Range {range(snapshot?.caseRange)} · expected cases</small></div>
      <div><span>Supported census</span><strong>{format(snapshot?.supportedCensus)}</strong><small>Expected patients</small></div>
      <div><span>Unstaffed holding</span><strong>{format(snapshot?.holdingCensus)}</strong><small>Expected patients</small></div>
      <div><span>Unresolved demand</span><strong>{format(snapshot?.cumulativeUnresolved)}</strong><small>Cumulative expected patients</small></div>
    </section>
    </details>
  </main>;
}
