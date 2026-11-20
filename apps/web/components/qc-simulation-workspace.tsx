'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  History,
  Hourglass,
  Info,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  TrendingUp,
  TriangleAlert,
  X,
  Layers,
  Compass,
  Plus,
  Minus,
  ChevronDown,
  Expand,
  Shrink,
  Flag,
  ChartNoAxesCombined,
} from 'lucide-react';
import type {
  BedForecast,
  MovieContext,
  QCControls,
  QCWorkspaceResult,
} from '@/lib/outbreak-types';
import {
  formatScenarioDate,
  nextPlaybackDay,
  validateDateWindow,
} from '@/lib/playback';
import { addDateDays, CASE_BANDS } from '@/lib/case-bands';
import { SIMULATION_LINES } from '@/lib/simulation-connections';
import WorkspaceLoader from '@/components/workspace-loader';
import {
  ENGINE_STARTING_MESSAGE,
  fetchResearch,
  type EngineConnectionStatus,
} from '@/lib/engine-connection';
import WorkspaceSelect from '@/components/workspace-select';
import type { SimulationMapController, SimulationMapStatus } from '@/lib/simulation-map';

const OutbreakMap = dynamic(() => import('@/components/outbreak-map'), {
  ssr: false, loading: () => <WorkspaceLoader label="Preparing simulation map" />,
});
const PhilippinesOverview = dynamic(
  () => import('@/components/philippines-overview'),
  { ssr: false }
);
const format = (n: number | undefined | null) =>
  n == null ? '—' : n.toLocaleString('en-PH', { maximumFractionDigits: 1 });
const range = (r: { lowerCases: number; upperCases: number } | undefined) =>
  r ? `${format(r.lowerCases)}–${format(r.upperCases)}` : 'Unavailable';
const factorName: Record<string, string> = {
  RF_NASA: 'Rainfall',
  'Temp_ERA5-Land': 'Temperature',
  'RH_ERA5-Land': 'Relative humidity',
};
const dateLabel = (date: string | undefined) =>
  date ? formatScenarioDate(date) : '—';

type WorkspaceTab = 'historical' | 'future';
type DetailTab =
  | 'overview'
  | 'hotspots'
  | 'place-beds'
  | 'city-beds'
  | 'barangays'
  | 'compare'
  | 'methods';
type PanelView = 'scenario' | 'results' | 'hospitals' | 'layers' | null;
const GUIDE_STORAGE_KEY = 'surgewise.qc-guide-dismissed';
const GLOSSARY = {
  expected: [
    'Expected cases',
    'Modeled dengue cases for Quezon City from the forecast model. Not observed counts.',
  ],
  range: [
    'Case range',
    'Experimental range targeting 80% coverage. Retrospective checks covered fewer weeks, so treat it as exploratory.',
  ],
  hotspot: [
    'High-burden candidate (hotspot)',
    'One of the ten barangays with the highest predicted annual dengue burden. Not a confirmed outbreak.',
  ],
  accredited: [
    'Accredited beds',
    'Beds in the PhilHealth register. Not the same as staffed, free or dengue-usable beds.',
  ],
  staffed: [
    'Staffed beds required',
    'Beds needed for projected dengue admissions, from the admission fraction, delay and length of stay you set.',
  ],
  census: [
    'Supported census',
    'Expected dengue patients in assumed normal plus activated surge beds.',
  ],
  holding: [
    'Unstaffed holding',
    'Expected patients in temporary holding spaces, which are not staffed beds.',
  ],
  unresolved: [
    'Unresolved demand',
    'Cumulative expected patients the modeled hospital capacity could not place.',
  ],
} as const;
function InspectorFacts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return <dl className="qs-inspector-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
const percent = (value: number | undefined | null) => value == null ? 'Unavailable' : `${format(value)}%`;
function BedUse({ forecast, day, occupancyPct }: { forecast?: BedForecast; day: number; occupancyPct?: number }) {
  if (!forecast) return null;
  const pct = forecast.demandUtilizationPct;
  return <section className={`qc-bed-use${pct != null && pct > 100 ? ' over-capacity' : ''}`} aria-label="Projected bed demand and capacity percentage">
    <h4>Projected bed demand · day {day}</h4>
    <InspectorFacts rows={[
      ['Expected beds needed', format(forecast.expectedBeds)],
      ['Assumed dengue slots', format(forecast.assumedSupportedDengueCapacity)],
      ['Demand against assumed slots', pct == null ? forecast.assumedSupportedDengueCapacity === 0 ? 'No dengue slots assumed' : 'Unavailable' : `${format(pct)}% of modeled dengue slots`],
    ]} />
    {pct != null && <div className="qc-bed-use-track" aria-hidden="true"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>}
    <p>Expected dengue bed demand ÷ assumed dengue-care slots × 100. Above 100% means demand exceeds that scenario capacity, before diversions.</p>
    {occupancyPct != null && <p>Simulated occupancy of all staffed beds: {format(occupancyPct)}%, including assumed non-dengue patients after placements. Holding is excluded.</p>}
    <p>Scenario estimates; actual staffed beds and occupancy are unknown.</p>
  </section>;
}
async function fetchWorkspace(
  controls: QCControls | undefined,
  tab: WorkspaceTab,
  signal: AbortSignal,
  onStatus: (status: EngineConnectionStatus) => void
): Promise<QCWorkspaceResult> {
  const response = await fetchResearch(
    `/api/research/${tab === 'future' ? 'future-simulation' : 'qc-simulation'}`,
    controls
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(controls),
          signal,
        }
      : { signal },
    onStatus
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(
      data.error ||
        data.detail?.message ||
        data.detail?.code ||
        (Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join(' ')
          : `Request failed (${response.status})`)
    );
  return data;
}

export default function QCSimulationWorkspace() {
  const [tab, setTab] = useState<WorkspaceTab>('historical');
  const [planningAsOf, setPlanningAsOf] = useState<string>();
  const [data, setData] = useState<QCWorkspaceResult | null>(null);
  const [controls, setControls] = useState<QCControls | null>(null);
  const [context, setContext] = useState<MovieContext | null>(null);
  const [day, setDay] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(2);
  const [selected, setSelected] = useState(''),
    [hospital, setHospital] = useState('');
  const [showHotspotDetails, setShowHotspotDetails] = useState(false);
  const [hospitalInspection, setHospitalInspection] = useState(0);
  const hospitalPanel = useRef<HTMLElement>(null);
  const [links, setLinks] = useState(false),
    [reduced, setReduced] = useState(false);
  const [view, setView] = useState<'qc' | 'philippines'>('qc');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [caseMetric, setCaseMetric] = useState<'daily' | 'cumulative'>(
    'cumulative'
  );
  const [historicalWindows, setHistoricalWindows] = useState<
    { startDate: string; endDate: string }[]
  >([]);
  const [connectionStatus, setConnectionStatus] =
    useState<EngineConnectionStatus>('connecting');
  // New UI state is declared after the original hooks so existing hook order is unchanged.
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [showGuide, setShowGuide] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>(null);
  const [openInfo, setOpenInfo] = useState('');
  const [introToast, setIntroToast] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [wideResults, setWideResults] = useState(false);
  const [mapStatus, setMapStatus] = useState<SimulationMapStatus>('loading');
  const [buildings3d, setBuildings3d] = useState(false);
  const [showHospitals, setShowHospitals] = useState(true);
  const [locatorOpen, setLocatorOpen] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const scenarioTrigger = useRef<HTMLButtonElement>(null);
  const playbackMenu = useRef<HTMLDetailsElement>(null);
  const expandedRef = useRef(false);
  const previousPanel = useRef<PanelView>(null);
  const panelRef = useRef(panelView); panelRef.current = panelView;
  const mapController = useRef<SimulationMapController | null>(null);
  const setMapController = useCallback((value: SimulationMapController | null) => { mapController.current = value; }, []);
  const guideClose = useRef<HTMLButtonElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const reducedRef = useRef(false);
  const tabRef = useRef<WorkspaceTab>('historical');
  const savedForms = useRef<Partial<Record<WorkspaceTab, QCControls>>>({});
  const controlsScroll = useRef<HTMLDivElement>(null);
  const calculate = useCallback(
    async (
      values?: QCControls,
      autoplay = false,
      targetTab: WorkspaceTab = tabRef.current
    ) => {
      if (values) {
        const invalid = validateDateWindow(values.startDate, values.endDate);
        if (invalid) {
          setError(invalid);
          return;
        }
      }
      const token = ++generation.current;
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      setLoading(true);
      setData(null);
      setContext(null);
      setControls(values ?? null);
      setPlaying(false);
      setDay(0);
      setError('');
      try {
        const result = await fetchWorkspace(
          values,
          targetTab,
          controller.signal,
          (status) => {
            if (token === generation.current) setConnectionStatus(status);
          }
        );
        if (token !== generation.current) return;
        setData(result);
        setContext(result.context);
        setControls(result.controlValues);
        setCaseMetric('cumulative');
        savedForms.current[targetTab] = result.controlValues;
        if (result.historicalWindows)
          setHistoricalWindows(result.historicalWindows);
        if (result.futureForecast)
          setPlanningAsOf(result.futureForecast.asOfDate);
        setSelected(result.periodSummary.barangays[0].barangayId);
        setHospital('');
        setShowHotspotDetails(false);
        setPlaying(autoplay && !reducedRef.current);
        return result;
      } catch (e) {
        if (token === generation.current)
          setError(
            e instanceof Error ? e.message : 'QC simulation unavailable.'
          );
      } finally {
        if (token === generation.current) setLoading(false);
      }
    },
    []
  );
  useEffect(() => {
    const requestGeneration = generation,
      requestController = activeRequest;
    void calculate();
    return () => {
      requestGeneration.current++;
      requestController.current?.abort();
    };
  }, [calculate]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    reducedRef.current = reduced;
    if (reduced) setPlaying(false);
  }, [reduced]);
  useEffect(() => {
    if (!playing || !data) return;
    const timer = window.setInterval(
      () => setDay((d) => nextPlaybackDay(d, data.durationDays)),
      1000 / speed
    );
    return () => window.clearInterval(timer);
  }, [playing, data, speed]);
  useEffect(() => {
    if (data && day >= data.durationDays) setPlaying(false);
  }, [day, data]);
  useEffect(() => {
    // A short first-use hint replaces the blocking, automatically opened guide.
    try { if (window.localStorage.getItem(GUIDE_STORAGE_KEY)) setIntroToast(false); } catch { /* Help remains available. */ }
  }, []);
  useEffect(() => {
    if (showGuide) guideClose.current?.focus();
  }, [showGuide]);
  useEffect(() => {
    hospitalPanel.current?.scrollTo({ top: 0 });
  }, [panelView]);
  // The arrival message is shown once: it hides after a few seconds, or as soon as the timeline moves.
  useEffect(() => {
    if (day > 0) setIntroToast(false);
  }, [day]);
  useEffect(() => {
    if (!introToast || !data) return;
    const timer = window.setTimeout(() => setIntroToast(false), 10000);
    return () => window.clearTimeout(timer);
  }, [introToast, data]);
  function openGuide() {
    setShowGuide(true);
  }
  function closeGuide() {
    setShowGuide(false); setIntroToast(false);
    requestAnimationFrame(() => guideTrigger.current?.focus());
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, '1');
    } catch {
      /* The non-blocking hint may appear again next visit. */
    }
  }
  function update(patch: Partial<QCControls>) {
    activeRequest.current?.abort();
    setLoading(false);
    generation.current++;
    setControls((c) => (c ? { ...c, ...patch } : c));
    setData(null);
    setPlaying(false);
    setDay(0);
    setError('');
  }
  function switchTab(next: WorkspaceTab) {
    if (next === tabRef.current) return;
    controlsScroll.current?.scrollTo({ top: 0 });
    if (controls) savedForms.current[tabRef.current] = controls;
    tabRef.current = next;
    setTab(next);
    void calculate(savedForms.current[next], false, next);
  }
  function windowControls(
    days: number,
    start = controls?.startDate
  ): QCControls | null {
    if (!controls || !start) return null;
    const base = {
      ...controls,
      startDate: start,
      endDate: addDateDays(start, days),
      compareAllocation: false,
    };
    return tab === 'future'
      ? {
          ...base,
          horizonDays: days,
          surgeOnsetDay: Math.min(base.surgeOnsetDay ?? 0, days - 1),
        }
      : base;
  }
  const selectedDays = controls
    ? (controls.horizonDays ??
      Math.round(
        (Date.parse(controls.endDate) - Date.parse(controls.startDate)) /
          86400000
      ))
    : 28;
  function updateDays(days: number) {
    const next = windowControls(
      Math.min(28, Math.max(1, Math.round(days || 1)))
    );
    if (next) update(next);
  }
  function updateStart(start: string) {
    if (!start) {
      update({ startDate: '' });
      return;
    }
    const next = windowControls(
      Number.isFinite(selectedDays) && selectedDays > 0 ? selectedDays : 28,
      start
    );
    if (next) update(next);
  }
  function chooseHorizon(days: number) {
    if (!controls?.startDate) return;
    const next = windowControls(days);
    if (!next) return;
    setControls(next);
    void calculate(next, !reduced);
  }
  function runSimulation() {
    if (!controls) return;
    if (validateDateWindow(controls.startDate, controls.endDate)) {
      setError(validateDateWindow(controls.startDate, controls.endDate)!); return;
    }
    setPanelView(null);
    void calculate({ ...controls, compareAllocation: false }, !reduced);
  }
  function compareAllocations() {
    if (!controls) return;
    void calculate({ ...controls, compareAllocation: true }, false).then(result => {
      if (!result) return;
      setDay(result.durationDays); setDetailTab('compare'); setPanelView('results');
    });
  }
  const scenario = day > 0 ? data : null;
  const snapshot = scenario?.days[day];
  const area = context?.barangays.find((b) => b.id === selected);
  const selectedPeriod = scenario?.periodSummary.barangays.find(
    (b) => b.barangayId === selected
  );
  const selectedBedProjection = scenario?.bedProjection?.placePeaks?.find(
    (b) => b.barangayId === selected
  );
  const selectedDaily =
    scenario?.days.slice(1).map((d) => ({
      dayIndex: d.dayIndex,
      date: d.date,
      expectedCases:
        d.barangays.find((b) => b.barangayId === selected)?.expectedCases ?? 0,
    })) ?? [];
  const maxSelectedDaily = Math.max(
    1,
    ...selectedDaily.map((d) => d.expectedCases)
  );
  const nearest = area?.nearestHospitals ?? [];
  const nearestHospital = context?.hospitals.find(
    (h) => h.id === nearest[0]?.facilityId
  );
  const localHospitals = area?.hospitalsWithinBarangay ?? [];
  const source = data?.forecastEvidence;
  const fullPeriod = scenario?.periodSummary;
  const finalDay = scenario?.days.at(-1);
  const hotspotRanking = context?.hotspotRanking;
  const markerHotspotIds = data ? (hotspotRanking?.candidateIds ?? data.days.at(-1)?.hotspotIds) : undefined;
  const caseColorMaximum = Math.max(
    1,
    ...(scenario?.days.flatMap((d) =>
      d.barangays
        .filter((b) => markerHotspotIds?.includes(b.barangayId))
        .map((b) =>
          caseMetric === 'daily' ? b.expectedCases : b.cumulativeCases
        )
    ) ?? [])
  );
  const surgeActive = !!snapshot && snapshot.shockCases > 0;
  const surgeStatus = !scenario
    ? 'Simulation not started'
    : surgeActive
      ? 'Configured surge active'
      : tab === 'future' &&
          controls?.surgeEnabled &&
          (controls.surgeMultiplier ?? 1) > 1
        ? 'Configured surge scheduled'
        : 'Baseline forecast · no added surge';
  const rankedHotspotIds = markerHotspotIds;
  const hotspotRows =
    markerHotspotIds?.flatMap((id) => {
      const row = fullPeriod?.barangays.find((b) => b.barangayId === id);
      return row ? [row] : [];
    }) ?? [];
  const inspectedHospital = context?.hospitals.find((h) => h.id === hospital);
  const hospitalHotspot = finalDay?.facilities.find(
    (f) => f.facilityId === hospital
  )?.nearestHotspot;
  const hospitalHotspotArea = context?.barangays.find(
    (b) => b.id === hospitalHotspot?.barangayId
  );
  const hospitalHotspotCases = fullPeriod?.barangays.find(
    (b) => b.barangayId === hospitalHotspot?.barangayId
  );
  const displayedHospitals = inspectedHospital
    ? [
        {
          facilityId: inspectedHospital.id,
          distanceKm: hospitalHotspot?.distanceKm ?? null,
        },
      ]
    : nearest;
  function inspectHospital(id: string) {
    setHospital(id);
    setShowHotspotDetails(false);
    setPanelView('hospitals');
    setHospitalInspection((value) => value + 1);
    hospitalPanel.current?.scrollTo({ top: 0, behavior: 'instant' });
    const closest = finalDay?.facilities.find(
      (f) => f.facilityId === id
    )?.nearestHotspot;
    if (closest) setSelected(closest.barangayId);
  }
  function inspectHotspot(id: string) {
    setSelected(id);
    setHospital('');
    setShowHotspotDetails(true);
    setPanelView('hospitals');
    setHospitalInspection((value) => value + 1);
  }
  const maxCases = Math.max(
    1,
    ...(data?.days.map((d) => d.expectedCases) ?? [])
  );
  const maxBeds = Math.max(
    1,
    ...(data?.days.map(
      (d) => d.bedForecast?.upperBeds ?? d.bedForecast?.expectedBeds ?? 0
    ) ?? [])
  );
  const futureValidation =
    data?.futureForecast?.validation.filter(
      (r) => r.model === data.futureForecast?.selectedModel
    ) ?? [];
  const coverageValues = data?.futureForecast
    ? futureValidation.map((r) => r.empiricalRangeCoverage)
    : (data?.forecastBacktest.map((r) => r.empiricalRangeCoverage) ?? []);
  // Results were cleared by a settings change and have not been recalculated yet.
  const stale = !!controls && !data && !loading && !error;
  const scenarioDetail = !controls
    ? 'Loading settings…'
    : tab === 'future'
      ? `${controls.surgeEnabled ? `Surge up to ${format(controls.surgeMultiplier)}× seasonal baseline` : 'No added surge'} · ${controls.weatherProfile ?? 'typical'} weather`
      : controls.mode === 'hypothetical_shock'
        ? `Stress overlay · +${format(controls.extraCasesPerWeek)} cases/week`
        : 'Data-based historical forecast replay';
  const comparison = scenario?.allocationComparison;
  const detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'hotspots', label: 'Ranked barangays' },
    { id: 'place-beds', label: 'Beds near selected place' },
    { id: 'city-beds', label: 'City-wide bed demand' },
    { id: 'barangays', label: 'All barangays' },
    ...(comparison
      ? [{ id: 'compare' as const, label: 'Policy comparison' }]
      : []),
    { id: 'methods', label: 'Methods & sources' },
  ];
  const activeDetail: DetailTab =
    detailTab === 'compare' && !comparison ? 'overview' : detailTab;
  const panelProps = (id: DetailTab) => ({
    role: 'region', id: `qc-detail-panel-${id}`,
    'aria-label': detailTabs.find(item => item.id === id)?.label,
    hidden: activeDetail !== id,
  });
  function openPanel(next: PanelView) {
    if (typeof document !== 'undefined') panelTrigger.current = document.activeElement as HTMLElement;
    setPanelView(next);
  }
  function closePanel() {
    setPanelView(null); setWideResults(false);
    const target = panelTrigger.current;
    if (target?.isConnected && !target.closest('#qs-context-panel')) target.focus();
    else scenarioTrigger.current?.focus();
  }
  function openDetail(next: DetailTab) { setDetailTab(next); openPanel('results'); }
  function download() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `qc-${data.scenarioId}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const numeric = (
    key: keyof QCControls,
    label: string,
    minimum: number,
    maximum: number,
    units: string,
    step = 1,
    scale = 1
  ) =>
    controls && (
      <label className="qc-number-field" key={key}>
        <span>{label}</span>
        <input
          aria-label={label}
          type="number"
          min={minimum}
          max={maximum}
          step={step}
          value={Number(controls[key]) * scale}
          onChange={(e) => update({ [key]: Number(e.target.value) / scale })}
        />
        <small>
          {minimum.toLocaleString()}–{maximum.toLocaleString()} {units}
        </small>
      </label>
    );
  // Summary card for the right panel: icon, label, one big value, a short note and an optional explanation toggle.
  function summaryCard(
    id: string,
    icon: ReactNode,
    label: string,
    value: string,
    note: string,
    info: string,
    tone = ''
  ) {
    const open = openInfo === id;
    return (
      <div key={id} className={`qc-total-card${tone ? ` ${tone}` : ''}`}>
        <span className="qc-total-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="qc-total-text">
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </div>
        <button
          className="qc-info-button"
          aria-label={`About: ${label}`}
          aria-expanded={open}
          onClick={() => setOpenInfo(open ? '' : id)}
        >
          <Info size={16} />
        </button>
        {open && <p className="qc-total-info">{info}</p>}
      </div>
    );
  }

  useEffect(() => { if (panelView) panelHeading.current?.focus({ preventScroll: true }); }, [panelView]);
  useEffect(() => {
    function exitExpanded() {
      if (!expandedRef.current) return;
      expandedRef.current = false; setExpanded(false); setPanelView(previousPanel.current);
      requestAnimationFrame(() => fullscreenButton.current?.focus());
    }
    function changed() { if (document.fullscreenElement !== workspace.current) exitExpanded(); }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (playbackMenu.current?.open) { playbackMenu.current.open = false; return; }
      if (expandedRef.current && !document.fullscreenElement) exitExpanded();
      else if (!document.fullscreenElement) { setPanelView(null); panelTrigger.current?.focus(); }
    }
    function outsidePlayback(event: PointerEvent) {
      if (playbackMenu.current && !playbackMenu.current.contains(event.target as Node)) playbackMenu.current.open = false;
    }
    document.addEventListener('fullscreenchange', changed); document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outsidePlayback);
    return () => { document.removeEventListener('fullscreenchange', changed); document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outsidePlayback); };
  }, []);
  async function toggleFullscreen() {
    if (!workspace.current) return;
    if (expandedRef.current) {
      if (document.fullscreenElement === workspace.current) { await document.exitFullscreen(); return; }
      expandedRef.current = false; setExpanded(false); setPanelView(previousPanel.current); return;
    }
    previousPanel.current = panelRef.current;
    try { if (workspace.current.requestFullscreen) await workspace.current.requestFullscreen(); } catch { /* In-app fullscreen remains available. */ }
    expandedRef.current = true; setExpanded(true); setPanelView(null);
  }
  const peakDay = data?.bedProjection?.peakDayIndex;
  const canJumpToPeak = !!scenario && Number.isInteger(peakDay) && peakDay! >= 1 && peakDay! <= (data?.durationDays ?? 0);
  const mapControlsDisabled = mapStatus === 'loading' || mapStatus === 'unavailable';
  const panelTitles = { scenario: 'Scenario', results: 'Results', hospitals: inspectedHospital ? 'Hospital details' : 'Barangay details', layers: 'Map layers' };
  const settings = (<><div
              className="qc-workspace-tabs"
              role="tablist"
              aria-label="Simulation workspace"
            >
              {(['historical', 'future'] as const).map((value) => (
                <button
                  key={value}
                  id={`qc-tab-${value}`}
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls="qc-tab-panel"
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => switchTab(value)}
                  onKeyDown={(event) => {
                    if (
                      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                        event.key
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 'historical'
                        : event.key === 'End'
                          ? 'future'
                          : value === 'historical'
                            ? 'future'
                            : 'historical';
                    switchTab(next);
                    document.getElementById(`qc-tab-${next}`)?.focus();
                  }}
                >
                  {value === 'historical'
                    ? 'Historical replay'
                    : 'Future surge forecast'}
                </button>
              ))}
            </div><div ref={controlsScroll} className="qs-settings-scroll qc-controls"><div
                key={`${tab}-${controls ? 'ready' : 'pending'}`}
                id="qc-tab-panel"
                className="qc-mode-form"
                role="tabpanel"
                aria-labelledby={`qc-tab-${tab}`}
                aria-busy={loading}
              >
                {controls ? (
                  <>
                    <fieldset className="qc-fieldset">
                      <legend>Dates</legend>
                      {tab === 'future' && (
                        <label>
                          Season / planning month
                          <input
                            aria-label="Planning month"
                            type="month"
                            min={planningAsOf?.slice(0, 7)}
                            max="2035-12"
                            value={controls.startDate.slice(0, 7)}
                            onChange={(event) => {
                              if (!event.target.value) return;
                              const requested = `${event.target.value}-01`;
                              updateStart(
                                planningAsOf && requested < planningAsOf
                                  ? planningAsOf
                                  : requested
                              );
                            }}
                          />
                          <small>
                            Sets the start date. The simulation still covers the
                            selected 1–28 days, not an entire calendar month.
                          </small>
                        </label>
                      )}
                      <label>
                        From · QC local date
                        <input
                          aria-label="Forecast start date"
                          type="date"
                          min={tab === 'future' ? planningAsOf : '2024-01-29'}
                          max={tab === 'future' ? '2035-12-31' : '2025-12-31'}
                          value={controls.startDate}
                          onChange={(e) => updateStart(e.target.value)}
                        />
                      </label>
                      <label>
                        Number of forecast days
                        <input
                          aria-label="Forecast horizon in days"
                          type="number"
                          min={1}
                          max={28}
                          step={1}
                          value={
                            Number.isFinite(selectedDays) ? selectedDays : 1
                          }
                          onChange={(e) => updateDays(Number(e.target.value))}
                        />
                        <small>
                          Any whole number from 1–28; e.g. 2, 12, 14 or 28.
                        </small>
                      </label>
                      <div className="qc-horizons-label">
                        Quick picks · run immediately
                      </div>
                      <div className="qc-horizons">
                        {[2, 7, 12, 14, 28].map((h) => (
                          <button
                            key={h}
                            aria-pressed={data?.durationDays === h}
                            onClick={() => chooseHorizon(h)}
                            disabled={loading}
                          >
                            {h} days
                          </button>
                        ))}
                      </div>
                      <label>
                        To · final snapshot
                        <input
                          aria-label="Forecast end date"
                          type="date"
                          min={
                            controls.startDate
                              ? addDateDays(controls.startDate, 1)
                              : undefined
                          }
                          max={
                            controls.startDate
                              ? addDateDays(controls.startDate, 28)
                              : undefined
                          }
                          value={controls.endDate}
                          readOnly={tab === 'future'}
                          onChange={(e) => update({ endDate: e.target.value })}
                        />
                        <small>
                          {tab === 'future'
                            ? 'Computed from start date + forecast days.'
                            : '1–28 elapsed days; daily interval [start, end).'}
                        </small>
                      </label>
                      {tab === 'historical' && historicalWindows.length > 0 && (
                        <label>
                          Available historical forecast targets
                          <WorkspaceSelect label={"Available historical forecast window"} value={String("")} onChange={value => {
                              if (value)
                                updateStart(value);
                            }} options={[{ value: String(""), label: ["Choose a covered start date"].join(' ') },...((historicalWindows.map((window) => (
                              { value: String(window.startDate), label: [String(window.startDate),"to",String(window.endDate),"(end exclusive)"].join(' ') }
                            ))) ?? [])]} />
                          <small>
                            Selected dates must fit inside one saved forecast
                            window. Another month’s forecast is never
                            substituted.
                          </small>
                        </label>
                      )}
                    </fieldset>
                    <fieldset className="qc-fieldset">
                      <legend>Scenario</legend>
                      {tab === 'historical' && (
                        <label>
                          Historical scenario
                          <WorkspaceSelect label={"Scenario mode"} value={String(controls.mode)} onChange={value =>
                              update({
                                mode: value as QCControls['mode'],
                                extraCasesPerWeek:
                                  value === 'forecast' ? 0 : 700,
                              })} options={[{ value: String("forecast"), label: ["Data-based historical forecast replay"].join(' ') },{ value: String("hypothetical_shock"), label: ["Stress overlay on historical period"].join(' ') }]} />
                          <small>
                            Training data: 2010–2025. Replay reference origins:
                            2024–2025.
                          </small>
                        </label>
                      )}
                      {tab === 'historical' &&
                        controls.mode === 'hypothetical_shock' && (
                          <div className="qc-hypothetical">
                            Added cases are assumptions, separate from the
                            environmental forecast.
                            {numeric(
                              'extraCasesPerWeek',
                              'Additional cases at full intensity',
                              0,
                              100000,
                              'cases/week',
                              50
                            )}
                            {numeric(
                              'growthDays',
                              'Ramp to full intensity',
                              1,
                              28,
                              'days'
                            )}
                          </div>
                        )}
                      {tab === 'future' && (
                        <>
                          <label>
                            Weather / season assumption
                            <WorkspaceSelect label={"Historical weather profile"} disabled={data?.futureForecast?.usesWeather === false} value={String(controls.weatherProfile ?? 'typical')} onChange={value =>
                                update({
                                  weatherProfile: value as QCControls['weatherProfile'],
                                })} options={[{ value: String("typical"), label: ["Typical historical seasonal weather"].join(' ') },{ value: String("wetter"), label: ["Wetter historical analog"].join(' ') },{ value: String("drier"), label: ["Drier historical analog"].join(' ') },{ value: String("hotter"), label: ["Hotter historical analog"].join(' ') }]} />
                            <small>
                              {data?.futureForecast?.usesWeather === false
                                ? 'The selected XGBoost configuration uses seasonal features only. Changing weather profiles does not change its cases.'
                                : 'Derived from past within-season weather; not a weather forecast.'}
                            </small>
                          </label>
                          <div className="qc-hypothetical">
                            <label className="qc-surge-toggle">
                              <input
                                type="checkbox"
                                checked={controls.surgeEnabled ?? true}
                                onChange={(e) =>
                                  update({ surgeEnabled: e.target.checked })
                                }
                              />{' '}
                              Simulate a surge
                            </label>
                            {controls.surgeEnabled && (
                              <>
                                {numeric(
                                  'surgeMultiplier',
                                  'Peak case multiplier',
                                  1,
                                  10,
                                  '× seasonal baseline',
                                  0.1
                                )}
                                {numeric(
                                  'surgeOnsetDay',
                                  'Surge starts on day',
                                  0,
                                  Math.max(0, selectedDays - 1),
                                  'day index'
                                )}
                                {numeric(
                                  'growthDays',
                                  'Ramp to peak multiplier',
                                  1,
                                  28,
                                  'days'
                                )}
                                <p>
                                  Surge timing and intensity are assumptions,
                                  not a predicted probability of an outbreak.
                                </p>
                              </>
                            )}
                          </div>
                          {data?.futureForecast?.parameterAudit && (
                            <details className="qc-hypothetical qc-audit">
                              <summary>
                                Calculated window & surge timing
                              </summary>
                              <p>
                                Calculated window:{' '}
                                {data.futureForecast.parameterAudit.horizonDays}{' '}
                                days, [
                                {data.futureForecast.parameterAudit.startDate},{' '}
                                {
                                  data.futureForecast.parameterAudit
                                    .endDateExclusive
                                }
                                ).
                                {data.futureForecast.parameterAudit
                                  .surgeOnsetDate
                                  ? ` Added surge begins in the interval starting ${data.futureForecast.parameterAudit.surgeOnsetDate}; maximum applied multiplier ${format(data.futureForecast.parameterAudit.maximumAppliedMultiplier)}×. ${data.futureForecast.parameterAudit.fullMultiplierReached ? 'The requested peak is reached.' : 'The window ends before the requested peak is reached.'}`
                                  : ' No added case surge.'}
                                {` Staffed surge beds activate at snapshot ${data.futureForecast.parameterAudit.staffedSurgeActivationSnapshotDate}${data.futureForecast.parameterAudit.staffedSurgeActivationWithinWindow ? '.' : ', outside this window.'} Admission delay ${data.futureForecast.parameterAudit.admissionDelayDays} days; stay ${data.futureForecast.parameterAudit.lengthOfStayDays} days.`}
                                <small>
                                  The seasonal curve repeats using evidence
                                  through 2025; future annual growth and
                                  outbreak probability are not modeled. Maximum
                                  source-year gap:{' '}
                                  {
                                    data.futureForecast.parameterAudit
                                      .sourceYearGap
                                  }
                                  .{' '}
                                  {data.futureForecast.parameterAudit
                                    .centralGapEvaluated
                                    ? 'Seasonal baseline case errors were checked at this year gap; added surge is an assumption.'
                                    : 'This weather profile/year gap has no matched evaluation.'}{' '}
                                  {!data.futureForecast.parameterAudit
                                    .rangeEvaluatedAtRequestedGap &&
                                    'Range coverage is not validated for this weather/surge/year-gap combination.'}
                                </small>
                              </p>
                            </details>
                          )}
                        </>
                      )}
                    </fieldset>
                    <fieldset className="qc-fieldset">
                      <legend>Hospital assumptions</legend>
                      <label>
                        Hospital allocation
                        <WorkspaceSelect label={"Hospital allocation policy"} value={String(controls.allocationPolicy)} onChange={value =>
                            update({
                              allocationPolicy: value as QCControls['allocationPolicy'],
                              compareAllocation: false,
                            })} options={[{ value: String("nearest"), label: ["Nearest supported capacity baseline"].join(' ') },{ value: String("optimized"), label: ["Optimize capacity-constrained placements"].join(' ') }]} />
                      </label>
                      <label>
                        Assumed arrival split
                        <WorkspaceSelect label={"Hospital arrival split"} value={String(controls.arrivalSplitPolicy ?? 'nearest_three_equal')} onChange={value =>
                            update({
                              arrivalSplitPolicy: value as QCControls['arrivalSplitPolicy'],
                              compareAllocation: false,
                            })} options={[{ value: String("nearest_three_equal"), label: ["Divide equally across three nearest sites"].join(' ') },{ value: String("nearest"), label: ["Nearest site first"].join(' ') }]} />
                        <small>
                          Expected-value choice assumption, not measured patient
                          preference. Full hospitals can divert demand.
                        </small>
                      </label>
                      <details className="qc-assumptions">
                        <summary>Capacity and patient assumptions</summary>
                        <p>
                          All 46 sites are assumed eligible in this planning
                          network. Actual staffed/dengue beds remain unknown.
                        </p>
                        {numeric(
                          'normalCapacity',
                          'Normal staffed beds / site',
                          1,
                          10000,
                          'assumed beds'
                        )}
                        {numeric(
                          'surgeCapacity',
                          'Supported surge beds / site',
                          0,
                          10000,
                          'assumed beds'
                        )}
                        {numeric(
                          'holdingCapacity',
                          'Unstaffed holding spaces / site',
                          0,
                          10000,
                          'spaces'
                        )}
                        {numeric(
                          'hospitalizationRate',
                          'Admission fraction',
                          0,
                          100,
                          '%',
                          1,
                          100
                        )}
                        {numeric(
                          'baselineOccupancy',
                          'Non-dengue occupancy',
                          0,
                          100,
                          '%',
                          1,
                          100
                        )}
                        {numeric(
                          'lengthOfStayDays',
                          'Length of stay',
                          1,
                          30,
                          'days'
                        )}
                        {numeric(
                          'admissionDelayDays',
                          'Admission delay',
                          0,
                          28,
                          'days'
                        )}
                        {numeric(
                          'surgeActivationDay',
                          'Surge activation',
                          0,
                          28,
                          'day index'
                        )}
                      </details>
                    </fieldset>
                  </>
                ) : (
                  <p role="status">
                    {loading
                      ? 'Loading the selected engine and case ranges…'
                      : 'Model data unavailable.'}
                  </p>
                )}
              </div></div><footer className="qc-controls-footer">
            {controls && (
              <div className={`qc-run-bar${stale ? ' stale' : ''}`}>
                {stale && (
                  <p className="qc-run-hint">
                    Settings changed · run again to update results
                  </p>
                )}
                <button
                  className="qc-primary"
                  disabled={loading}
                  onClick={runSimulation}
                >
                  <Play size={14} />{' '}
                  {loading ? 'Calculating…' : 'Run simulation'}
                </button>

              </div>
            )}{' '}
          </footer></>);
  const overview = (<div
              className="qc-panel-view qc-overview"
              hidden={activeDetail !== 'overview'}
            >
              <section
                className={`qc-scenario-card${stale ? ' stale' : ''}`}
                aria-label="Current scenario"
              >
                <span className="qc-total-icon" aria-hidden="true">
                  <SlidersHorizontal size={20} />
                </span>
                <div className="qc-total-text">
                  <span>
                    {tab === 'future'
                      ? 'Future surge forecast'
                      : 'Historical replay'}
                  </span>
                  <strong>
                    {controls
                      ? `${dateLabel(controls.startDate)} – ${dateLabel(controls.endDate)}`
                      : 'Loading…'}
                  </strong>
                  <small>
                    {Number.isFinite(selectedDays)
                      ? `${selectedDays} days · `
                      : ''}
                    {scenarioDetail} ·{' '}
                    {controls?.allocationPolicy === 'optimized'
                      ? 'optimized placement'
                      : 'nearest-capacity placement'}
                  </small>
                </div>
                {stale && (
                  <p className="qc-run-hint">
                    Settings changed. Open Scenario and run again.
                  </p>
                )}
              </section>
              <h3 className="qc-panel-subheading">
                {scenario && snapshot
                  ? `Day ${day} of ${scenario.durationDays} · ${formatScenarioDate(snapshot.date)}`
                  : 'Day totals · press Play to start'}
              </h3>
              {!scenario && (
                <p className="qc-panel-tip">
                  Simulation not started. Play or advance the day to display
                  modeled values. Base cases for{' '}
                  {controls?.startDate ?? 'the selected date'}: unavailable; no
                  verified daily observation is available for that date. Dated
                  hospital inventory and source evidence remain available.
                </p>
              )}
              <section
                className="qc-totals"
                aria-label="Observed cases and simulation totals"
              >
                {summaryCard(
                  'observed',
                  <History size={20} />,
                  scenario
                    ? tab === 'future'
                      ? 'Observed historical source cases'
                      : 'Observed cases already'
                    : 'Base cases for selected date',
                  scenario
                    ? format(source?.observedSourceYearToDateCases)
                    : 'Unavailable',
                  scenario
                    ? `Source-year to ${source ? `${source.issueBlock.YR}/WN ${source.issueBlock.WN}` : 'origin'} · ${tab === 'future' ? 'not a current surveillance count' : `latest block ${format(source?.observedCasesAtOrigin)}`}`
                    : 'No authoritative daily base count for this date; historical source totals are separate evidence.',
                  'Observed counts come from the historical UPRI-NOAH source data. A simulated date has no authoritative daily base count, so modeled values start from the forecast.',
                  'observed'
                )}
                {summaryCard(
                  'new',
                  <Activity size={20} />,
                  `New expected cases · day ${day}`,
                  format(snapshot?.expectedCases),
                  `Daily range ${range(snapshot?.dailyCaseRange)}`,
                  'Modeled new dengue cases in QC on the selected day (not observed).'
                )}
                {summaryCard(
                  'cumulative',
                  <TrendingUp size={20} />,
                  'Cumulative cases',
                  format(snapshot?.cumulativeCases),
                  `Range ${range(snapshot?.caseRange)} · expected cases`,
                  'Modeled cases accumulated from day 1 to the selected day.'
                )}
                {summaryCard(
                  'census',
                  <BedDouble size={20} />,
                  'Supported census',
                  format(snapshot?.supportedCensus),
                  'Expected patients',
                  GLOSSARY.census[1]
                )}
                {summaryCard(
                  'holding',
                  <Hourglass size={20} />,
                  'Unstaffed holding',
                  format(snapshot?.holdingCensus),
                  'Expected patients',
                  GLOSSARY.holding[1]
                )}
                {summaryCard(
                  'unresolved',
                  <TriangleAlert size={20} />,
                  'Unresolved demand',
                  format(snapshot?.cumulativeUnresolved),
                  'Cumulative expected patients',
                  GLOSSARY.unresolved[1],
                  'alert'
                )}
              </section>
              <h3 className="qc-panel-subheading">Whole selected window</h3>
              <section
                className="qc-totals"
                aria-label="Case summary and range validation"
              >
                {summaryCard(
                  'window',
                  <CalendarDays size={20} />,
                  'QC expected cases · full selected range',
                  format(fullPeriod?.expectedCases),
                  `${controls?.startDate && controls.endDate ? `${formatScenarioDate(controls.startDate)} – ${formatScenarioDate(controls.endDate)}` : 'Choose a date window'} · source-week/calendar alignment is an explicit assumption.`,
                  GLOSSARY.expected[1]
                )}
                {summaryCard(
                  'window-range',
                  <TrendingUp size={20} />,
                  'Experimental empirical case range · 80% target',
                  range(fullPeriod?.caseRange),
                  'Conditional on historical spatial weights',
                  GLOSSARY.range[1]
                )}
                {data && coverageValues.length > 0 && (
                  <p className="qc-range-caution">
                    Range validation: observed weekly coverage{' '}
                    {format(Math.min(...coverageValues) * 100)}–
                    {format(Math.max(...coverageValues) * 100)}%{' '}
                    {data.futureForecast
                      ? 'on 2024–2025 seasonal holdouts (52 weeks/year)'
                      : 'across eight retrospective origins/horizon'}
                    . The 80% target was not achieved; these are exploratory
                    ranges.
                  </p>
                )}
              </section>
              <div className="qc-panel-notes">
                <strong>Notes</strong>
                <ul>
                  <li>
                    {tab === 'future'
                      ? 'Future seasonal surge planning: new seasonal curves and historical weather analogs; current surveillance and real hospital census are unavailable.'
                      : 'Historical replay: source-based case/environment forecasts for retrospective periods.'}{' '}
                    No place selection is required. QC calculations; Philippines
                    geography is context only.
                  </li>
                  <li>
                    Every number here is a research estimate from historical
                    data and stated assumptions. It is not live surveillance,
                    real bed availability or clinical advice.
                  </li>
                  <li>
                    Methods, validation tables and sources are in the{' '}
                    <b>Methods & sources</b> result view.
                  </li>
                </ul>
              </div>
            </div>);
  const analysis = (<section className="qc-details" aria-label="Simulation details">
            <div {...panelProps('hotspots')}>
              <section
                className="qc-hotspot-key"
                aria-label="Hotspot locations, projected cases and nearest hospitals"
              >
                <h2>Top projected-burden barangays</h2>
                <p>
                  {hotspotRanking
                    ? `Annual burden forecast for ${hotspotRanking.forecastYear}; source/training cutoff ${hotspotRanking.trainingCutoffYear}. Top ten is a research ranking, not a validated outbreak threshold.`
                    : 'Hotspot ranking awaits approved model data.'}{' '}
                  Window cases: {controls?.startDate} to {controls?.endDate}{' '}
                  (end exclusive).
                </p>
                <div className="qc-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Candidate location</th>
                        <th>XGBoost annual burden</th>
                        <th>Projected window cases</th>
                        <th>Nearest hospital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspotRows.map((row, index) => {
                        const b = context!.barangays.find(
                          (b) => b.id === row.barangayId
                        )!;
                        const closest = b.nearestHospitals[0];
                        const h = context!.hospitals.find(
                          (h) => h.id === closest?.facilityId
                        );
                        return (
                          <tr
                            key={b.id}
                            className={selected === b.id ? 'selected' : ''}
                          >
                            <td>
                              <button
                                aria-pressed={selected === b.id}
                                onClick={() => inspectHotspot(b.id)}
                              >
                                {index + 1}. {b.name}
                              </button>
                            </td>
                            <td>
                              {format(b.predictedAnnualCases)}
                              <small>
                                Annual forecast · {hotspotRanking?.forecastYear}
                              </small>
                            </td>
                            <td>
                              {format(row.cumulativeCases)}
                              <small>Range {range(row.caseRange)}</small>
                            </td>
                            <td>
                              {h ? (
                                <button onClick={() => inspectHospital(h.id)}>
                                  {h.name}
                                </button>
                              ) : (
                                'Unavailable'
                              )}
                              <small>
                                {closest
                                  ? `${closest.distanceKm.toFixed(2)} km · straight-line`
                                  : 'Distance unavailable'}
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {hotspotRanking && (
                  <details className="qc-hotspot-validation">
                    <summary>
                      Annual XGBoost ranking definition & validation
                    </summary>
                    <p>
                      {hotspotRanking.criterion}. Forecast year{' '}
                      {hotspotRanking.forecastYear}; source-label cutoff{' '}
                      {hotspotRanking.trainingCutoffYear}. Shares are held fixed
                      for the selected window.
                    </p>
                    <div className="qc-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Evaluation year</th>
                            <th>Model</th>
                            <th>Annual-case MAE</th>
                            <th>Matched observed top 10</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotspotRanking.validation.map((row) => (
                            <tr key={`${row.targetYear}-${row.model}`}>
                              <td>{row.targetYear}</td>
                              <td>{row.model}</td>
                              <td>{format(row.maeAnnualCases)}</td>
                              <td>
                                {row.top10Overlap}/{row.topCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      {hotspotRanking.limitations} Baselines can outperform
                      XGBoost on the ranking metric; no superiority claim is
                      made.
                    </p>
                  </details>
                )}
                {scenario && !finalDay?.hotspotIds.length && (
                  <p>
                    No positive projected hotspot burden in this date window.
                  </p>
                )}
                {!scenario && (
                  <p>
                    Hotspot ranks and case projections appear after the
                    simulation starts.
                  </p>
                )}
                {area && (
                  <div className="qc-selected-place">
                    <strong>Selected barangay: {area.name}</strong>
                    <span>
                      {format(selectedPeriod?.cumulativeCases)} projected cases
                      in the window ·{' '}
                      {format(
                        snapshot?.barangays.find(
                          (b) => b.barangayId === area.id
                        )?.cumulativeCases
                      )}{' '}
                      accumulated to day {day}
                    </span>
                    <span>
                      Nearest hospital:{' '}
                      {context?.hospitals.find(
                        (h) => h.id === nearest[0]?.facilityId
                      )?.name ?? 'Unavailable'}
                      {nearest[0]
                        ? ` · ${nearest[0].distanceKm.toFixed(2)} km`
                        : ''}
                    </span>
                    <small>
                      Progression uses this barangay’s dated allocated forecast.
                      All places update together; no infection chain is modeled.
                      XGBoost predicts annual barangay burden; its modeled
                      shares allocate QC weekly forecasts. Independent weekly
                      barangay forecasts remain unavailable.
                    </small>
                    {scenario && (
                      <svg
                        viewBox="0 0 440 75"
                        role="img"
                        aria-label={`Daily projected case allocation for ${area.name}`}
                      >
                        {selectedDaily.map((d) => {
                          const cases = d.expectedCases;
                          const height = (cases / maxSelectedDaily) * 60;
                          return (
                            <rect
                              key={d.dayIndex}
                              x={
                                8 +
                                ((d.dayIndex - 1) * 424) / scenario.durationDays
                              }
                              y={68 - height}
                              width={Math.max(
                                2,
                                424 / scenario.durationDays - 3
                              )}
                              height={height}
                              fill={d.dayIndex === day ? '#1d3557' : '#457b9d'}
                            >
                              <title>{`${d.date}: ${format(cases)} expected cases in ${area.name}`}</title>
                            </rect>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                )}
              </section>
            </div>
            <div {...panelProps('place-beds')}>
              <section
                className="qc-local-bed-forecast"
                aria-label="Surge bed forecast near selected place"
              >
                <h2>
                  Surge bed forecast near {area?.name ?? 'the selected place'}
                </h2>
                <div
                  className={`qc-surge-status${surgeActive ? ' active' : ''}`}
                  role="status"
                >
                  {surgeStatus} ·{' '}
                  {snapshot
                    ? formatScenarioDate(snapshot.date)
                    : controls?.startDate
                      ? formatScenarioDate(controls.startDate)
                      : 'select dates'}
                  <small>
                    Configured scenario status, not an observed outbreak
                    declaration.
                  </small>
                </div>
                <p>
                  Case model:{' '}
                  {data?.futureForecast
                    ? 'XGBoost seasonal projection'
                    : 'audited historical cases/weather replay'}
                  . Bed need is a conditional admissions/LOS calculation; no
                  observed hospital occupancy targets were available for model
                  training.
                </p>
                <p>
                  Demand from this barangay only, divided using the configured
                  hospital-choice assumption. Required staffed beds are
                  calculated from projected cases, admission fraction, delay and
                  length of stay. Actual staffed capacity and vacancies are
                  unknown.
                </p>
                {selectedBedProjection ? (
                  <div className="qc-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Hospital</th>
                          <th>Assumed arrival share</th>
                          <th>Expected admissions</th>
                          <th>No-added-surge peak beds</th>
                          <th>With-surge peak beds</th>
                          <th>Peak extra beds from surge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBedProjection.hospitals.map((row) => {
                          const h = context?.hospitals.find(
                            (h) => h.id === row.facilityId
                          );
                          return (
                            <tr key={row.facilityId}>
                              <td>
                                <button
                                  onClick={() =>
                                    inspectHospital(row.facilityId)
                                  }
                                >
                                  {h?.name ?? row.facilityId}
                                </button>
                              </td>
                              <td>{format(row.share * 100)}%</td>
                              <td>{format(row.expectedAdmissions)}</td>
                              <td>
                                {format(row.baselinePeakStaffedBedsRequired)}
                              </td>
                              <td>{format(row.peakStaffedBedsRequired)}</td>
                              <td>
                                {format(row.additionalStaffedBedsDueToSurge)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>
                    Start or advance the simulation to show this place’s
                    bed-demand projections.
                  </p>
                )}
                {selectedBedProjection && (
                  <div
                    className="qc-nearby-bed-use"
                    aria-label="Predicted bed demand percentage at nearby hospitals"
                  >
                    {selectedBedProjection.hospitals.map((row) => {
                      const h = context?.hospitals.find(
                        (h) => h.id === row.facilityId
                      );
                      const stat = snapshot?.facilities.find(
                        (f) => f.facilityId === row.facilityId
                      );
                      return (
                        <article key={row.facilityId}>
                          <button
                            onClick={() => inspectHospital(row.facilityId)}
                          >
                            {h?.name ?? row.facilityId}
                          </button>
                          <p>
                            Assumed arrival split: {format(row.share * 100)}%
                            from this place. This is not bed utilization.
                          </p>
                          <BedUse
                            forecast={stat?.bedForecast}
                            day={day}
                            occupancyPct={stat?.supportedOccupancyPct}
                          />
                          <small>
                            Hospital-wide demand from all barangays; peak demand
                            percentage{' '}
                            {scenario?.bedProjection?.hospitalPeaks.find(
                              (f) => f.facilityId === row.facilityId
                            )?.peakDemandUtilizationPct == null
                              ? 'unavailable'
                              : `${format(scenario.bedProjection?.hospitalPeaks.find((f) => f.facilityId === row.facilityId)?.peakDemandUtilizationPct)}%`}{' '}
                            of assumed dengue slots.
                          </small>
                        </article>
                      );
                    })}
                  </div>
                )}
                <small>
                  For three sites, equal shares mean one third each before
                  capacity diversions. Hospital cards include all barangays’
                  demand; local rows above show only this place. Site-specific
                  staffing rounds up to whole beds. These are demand estimates,
                  not available beds.
                </small>
              </section>
            </div>
            <div {...panelProps('city-beds')}>
              <section
                className="qc-bed-forecast"
                aria-label="Bed demand forecast"
              >
                <div className="qc-section-heading">
                  Bed forecast · required dengue staffing, occupancy & shortfall
                </div>
                <div className="qc-bed-summary">
                  <div>
                    <span>Peak staffed beds required</span>
                    <strong>
                      {format(scenario?.bedProjection?.staffedBedsRequired)}
                    </strong>
                    <small>
                      Peak day {scenario?.bedProjection?.peakDayIndex ?? '—'} ·{' '}
                      {scenario?.bedProjection?.peakDate ?? '—'}
                    </small>
                  </div>
                  <div>
                    <span>Peak low–high case sensitivity</span>
                    <strong>
                      {format(
                        scenario?.bedProjection?.peakLowerStaffedBedsRequired
                      )}
                      –
                      {format(
                        scenario?.bedProjection?.peakUpperStaffedBedsRequired
                      )}
                    </strong>
                    <small>Fixed admission fraction and LOS</small>
                  </div>
                  <div>
                    <span>Additional staffed beds needed</span>
                    <strong>
                      {format(
                        scenario?.bedProjection?.peakAdditionalStaffedBedsNeeded
                      )}
                    </strong>
                    <small>Peak network shortfall vs assumed capacity</small>
                  </div>
                  <div>
                    <span>Peak extra beds due to surge</span>
                    <strong>
                      {format(
                        scenario?.bedProjection
                          ?.peakAdditionalStaffedBedsDueToSurge
                      )}
                    </strong>
                    <small>
                      No-added-surge peak:{' '}
                      {format(
                        scenario?.bedProjection?.baselinePeakStaffedBedsRequired
                      )}{' '}
                      beds
                    </small>
                  </div>
                </div>
                <div className="qc-chart-heading">
                  <strong>Daily unconstrained bed demand</strong>
                  <span>Expected beds · shaded case-range sensitivity</span>
                </div>
                <svg
                  viewBox="0 0 900 100"
                  role="img"
                  aria-label="Forecast daily bed demand and case-range sensitivity, separate from real vacancies"
                >
                  {scenario && (
                    <>
                      <polygon
                        points={[
                          ...scenario.days.map(
                            (d, i) =>
                              `${12 + (i * 876) / scenario.durationDays},${90 - ((d.bedForecast?.upperBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds) * 78}`
                          ),
                          ...[...scenario.days]
                            .reverse()
                            .map(
                              (d) =>
                                `${12 + (d.dayIndex * 876) / scenario.durationDays},${90 - ((d.bedForecast?.lowerBeds ?? d.bedForecast?.expectedBeds ?? 0) / maxBeds) * 78}`
                            ),
                        ].join(' ')}
                        fill="#457b9d33"
                      />
                      <polyline
                        points={scenario.days
                          .map(
                            (d, i) =>
                              `${12 + (i * 876) / scenario.durationDays},${90 - ((d.bedForecast?.expectedBeds ?? 0) / maxBeds) * 78}`
                          )
                          .join(' ')}
                        fill="none"
                        stroke="#457b9d"
                        strokeWidth={2}
                      />
                      <line
                        x1={12 + (day * 876) / scenario.durationDays}
                        x2={12 + (day * 876) / scenario.durationDays}
                        y1={8}
                        y2={92}
                        stroke="#2f5577"
                        strokeDasharray="3 4"
                      />
                    </>
                  )}
                </svg>
                <p>
                  Day {day}:{' '}
                  {format(snapshot?.bedForecast?.staffedBedsRequired)} staffed
                  dengue beds required;{' '}
                  {format(snapshot?.bedForecast?.additionalStaffedBedsNeeded)}{' '}
                  additional beds vs assumed supported capacity. This is demand
                  before capacity rejection, not actual vacant beds.
                </p>
                <p>
                  Initial dengue census is assumed zero. Real staffed
                  beds/current occupancy and observed hospital admissions are
                  unavailable; bed ranges are case-demand sensitivity, not
                  validated occupancy intervals.
                </p>
              </section>
            </div>
            <div {...panelProps('barangays')}>
              <section className="qc-hotspots">
                <div className="qc-section-heading">
                  Automatically ranked QC barangays · full selected date range
                </div>
                <p>
                  Annual XGBoost burden predictions supply modeled shares;
                  observed annual source counts below are from{' '}
                  {context?.weightYear ?? '—'}. Forecast ranges omit
                  spatial-model uncertainty. Positive demand is not hotspot
                  membership.{' '}
                  <button onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show top 10' : 'Show all 142 barangays'}
                  </button>
                </p>
                <div className="qc-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Barangay</th>
                        <th>Observed annual cases</th>
                        <th>Expected window cases</th>
                        <th>Conditional case range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullPeriod?.barangays
                        .slice(0, showAll ? 142 : 10)
                        .map((row) => {
                          const b = context!.barangays.find(
                            (b) => b.id === row.barangayId
                          )!;
                          return (
                            <tr
                              key={b.id}
                              className={selected === b.id ? 'selected' : ''}
                            >
                              <td>
                                <button onClick={() => inspectHotspot(b.id)}>
                                  {b.name}
                                </button>
                              </td>
                              <td>
                                {format(b.observedAnnualCases)} (
                                {context?.weightYear})
                              </td>
                              <td>{format(row.cumulativeCases)}</td>
                              <td>{range(row.caseRange)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {!scenario && (
                  <p>The ranked table appears after the simulation starts.</p>
                )}
              </section>
            </div>
            {comparison && (
              <div {...panelProps('compare')}>
                <section className="qc-comparison">
                  <h2>Resource allocation comparison</h2>
                  <p>{comparison.caveat}</p>
                  <div className="qc-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Same-input policy</th>
                          <th>Unresolved demand</th>
                          <th>Holding census</th>
                          <th>Peak normal occupancy</th>
                          <th>Expected patient-km</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['nearest', 'optimized'] as const).map((policy) => {
                          const m = comparison[policy];
                          return (
                            <tr key={policy}>
                              <td>{policy}</td>
                              <td>{format(m.cumulativeUnresolved)}</td>
                              <td>{format(m.holdingCensus)}</td>
                              <td>{format(m.maxNormalOccupancyPct)}%</td>
                              <td>{format(m.expectedPatientKm)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
            <div {...panelProps('methods')}>
              <section
                className="qc-methods"
                aria-label="Forecast ranges, date assumptions and reproducibility"
              >
                <h2>Forecast ranges, date assumptions and reproducibility</h2>
                <p>{data?.referenceSelectionAssumption}</p>
                <p>{data?.rangeInterpretation}</p>
                <p>{source?.intervalCaveat}</p>
                <p>{source?.spatialCaveat}</p>
                <p>{data?.assumptions}</p>
                {data?.futureForecast ? (
                  <>
                    <p>{data.futureForecast.stalenessCaveat}</p>
                    <p>{data.futureForecast.weatherCaveat}</p>
                    <p>
                      Selection: {data.futureForecast.selection.criterion}.
                      Calibration MAE: XGBoost{' '}
                      {format(
                        data.futureForecast.selection.scores.seasonal_xgboost
                      )}
                      , original boosted{' '}
                      {format(
                        data.futureForecast.selection.scores
                          .seasonal_boosted_trees
                      )}
                      , seasonal baseline{' '}
                      {format(
                        data.futureForecast.selection.scores.seasonal_baseline
                      )}
                      . XGBoost is a requested planning model; comparisons below
                      do not establish superiority. There are no observed
                      admissions or occupancy targets to validate a direct bed
                      model.
                    </p>
                    <div className="qc-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Evaluation year</th>
                            <th>Model</th>
                            <th>n</th>
                            <th>MAE cases/week</th>
                            <th>RMSE</th>
                            <th>Weighted absolute error</th>
                            <th>Mean bias</th>
                            <th>Range coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.futureForecast.validation.map((m) => (
                            <tr key={`${m.year}-${m.model}`}>
                              <td>{m.year}</td>
                              <td>{m.model}</td>
                              <td>{m.n}</td>
                              <td>{format(m.mae)}</td>
                              <td>{format(m.rmse)}</td>
                              <td>{format(m.wapePct)}%</td>
                              <td>{format(m.meanBias)}</td>
                              <td>{format(m.empiricalRangeCoverage * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>{data.futureForecast.rangeEvidencePolicy}</p>
                    {data.futureForecast.leadYearGapValidation && (
                      <details>
                        <summary>
                          Forecast accuracy when source data are older
                        </summary>
                        <p>
                          Frozen XGBoost configuration, evaluated with one, two
                          or three source-year gaps. No later-year labels enter
                          training or weather analogs. Range coverage was
                          evaluated only at gap 1; these stale-source
                          comparisons assess central cases.
                        </p>
                        <div className="qc-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Evaluation year</th>
                                <th>Last training year</th>
                                <th>Year gap</th>
                                <th>Model</th>
                                <th>MAE cases/week</th>
                                <th>Weighted error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.futureForecast.leadYearGapValidation.map(
                                (row) => (
                                  <tr
                                    key={`${row.year}-${row.sourceYearGap}-${row.model}`}
                                  >
                                    <td>{row.year}</td>
                                    <td>{row.lastTrainingYear}</td>
                                    <td>{row.sourceYearGap}</td>
                                    <td>{row.model}</td>
                                    <td>{format(row.mae)}</td>
                                    <td>{format(row.wapePct)}%</td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                    {data.futureForecast.calendarDiagnostics && (
                      <details>
                        <summary>
                          Accuracy by month, season and number of days
                        </summary>
                        <p>
                          {
                            data.futureForecast.calendarDiagnostics
                              .targetDefinition
                          }{' '}
                          {
                            data.futureForecast.calendarDiagnostics
                              .evaluationDesign
                          }{' '}
                          These are retrospective diagnostics. Negative bias
                          means underprediction; weighted absolute error is an
                          error percentage, not an accuracy score.
                        </p>
                        <p>
                          XGBoost configuration:{' '}
                          {data.futureForecast.xgboostVariant}. Selection used
                          only 2018–2023; 2024–2025 were excluded from
                          selection. These evaluation years have already been
                          examined during development.
                        </p>
                        <h3>Window length · XGBoost</h3>
                        <div className="qc-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Year</th>
                                <th>Days</th>
                                <th>Windows</th>
                                <th>MAE cases/window</th>
                                <th>Weighted error</th>
                                <th>Range coverage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.futureForecast.calendarDiagnostics.windowLengths
                                .filter(
                                  (row) =>
                                    row.model ===
                                    data.futureForecast?.selectedModel
                                )
                                .map((row) => (
                                  <tr key={`${row.year}-${row.days}`}>
                                    <td>{row.year}</td>
                                    <td>{row.days}</td>
                                    <td>{row.n}</td>
                                    <td>{format(row.mae)}</td>
                                    <td>{format(row.wapePct)}%</td>
                                    <td>
                                      {format(row.empiricalRangeCoverage * 100)}
                                      %
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <h3>Seasonal source quarters · XGBoost</h3>
                        <p>
                          Each quarter contains 13 native source weeks. These
                          are calendar groupings, not official wet/dry-season
                          labels.
                        </p>
                        <div className="qc-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Year</th>
                                <th>Quarter</th>
                                <th>Weeks</th>
                                <th>MAE cases/week</th>
                                <th>Weighted error</th>
                                <th>Mean bias</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.futureForecast.calendarDiagnostics.sourceQuarters
                                .filter(
                                  (row) =>
                                    row.model ===
                                    data.futureForecast?.selectedModel
                                )
                                .map((row) => (
                                  <tr key={`${row.year}-${row.sourceQuarter}`}>
                                    <td>{row.year}</td>
                                    <td>{row.sourceQuarter}</td>
                                    <td>{row.n}</td>
                                    <td>{format(row.mae)}</td>
                                    <td>{format(row.wapePct)}%</td>
                                    <td>{format(row.meanBias)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <h3>Assumed calendar months · XGBoost</h3>
                        <div className="qc-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Year/month</th>
                                <th>Days</th>
                                <th>Predicted cases</th>
                                <th>Source-derived cases</th>
                                <th>Absolute error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.futureForecast.calendarDiagnostics.monthly
                                .filter(
                                  (row) =>
                                    row.model ===
                                    data.futureForecast?.selectedModel
                                )
                                .map((row) => (
                                  <tr key={`${row.year}-${row.month}`}>
                                    <td>
                                      {row.year}/
                                      {String(row.month).padStart(2, '0')}
                                    </td>
                                    <td>{row.calendarDays}</td>
                                    <td>{format(row.expectedCases)}</td>
                                    <td>{format(row.sourceDerivedCases)}</td>
                                    <td>{format(row.absoluteError)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="qc-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Horizon</th>
                          <th>n</th>
                          <th>Weather MAE</th>
                          <th>Cases-only MAE</th>
                          <th>Persistence MAE</th>
                          <th>Empirical range coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.forecastBacktest.map((m) => (
                          <tr key={m.horizon}>
                            <td>{m.horizon} source blocks</td>
                            <td>{m.n}</td>
                            <td>{format(m.weatherMae)}</td>
                            <td>{format(m.casesOnlyMae)}</td>
                            <td>{format(m.persistenceMae)}</td>
                            <td>{format(m.empiricalRangeCoverage * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p>
                  Source:{' '}
                  <a href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615">
                    UPRI-NOAH dengue/environmental dataset
                  </a>
                  , ODC-ODbL 1.0. Philippines regions provide geographic
                  context; all case and hospital-demand calculations are
                  QC-only.
                </p>
                <p>
                  Scenario {data?.scenarioId}
                  <br />
                  Computed {data?.runTimestamp}
                  <br />
                  Workspace result SHA-256 {data?.resultSha256}
                </p>

              </section>
            </div>
          </section>);
  const selectedPlace = area && !inspectedHospital && (showHotspotDetails || panelView === 'hospitals') ? (
    <section className="qs-inspector-block" aria-label="Selected hotspot details" aria-live="polite">
      <div className="qs-place-heading"><span>{markerHotspotIds?.includes(area.id) ? 'Annual high-burden candidate' : 'Selected barangay · outside the top candidates'}</span><h3>{area.name}</h3></div>
      <h4>Projected cases</h4>
      <InspectorFacts rows={[
        ['Full selected window', format(selectedPeriod?.cumulativeCases)],
        [`Accumulated to day ${day}`, format(snapshot?.barangays.find(b => b.barangayId === area.id)?.cumulativeCases)],
        ['Experimental window range', range(selectedPeriod?.caseRange)],
      ]} />
      <p className="qs-inspector-note">Modeled allocation, not observed weekly barangay surveillance. The case range is conditional on the spatial weights.</p>
      <details className="qs-inspector-disclosure"><summary>Annual ranking & model context</summary>
        <InspectorFacts rows={[
          ['Annual model', hotspotRanking?.model ?? 'Unavailable'],
          ['Forecast year', hotspotRanking?.forecastYear ?? 'Unavailable'],
          ['Predicted annual cases', scenario ? format(area.predictedAnnualCases) : 'Start playback to view'],
          ['Annual burden rank', area.burdenRank == null ? 'Unavailable' : `${area.burdenRank} of 142`],
        ]} />
        <p>Rank identifies the model’s annual burden order. It is not a case count or a confirmed outbreak.</p>
      </details>
      <section className="qs-inspector-section"><h4>Nearest registered hospital</h4>
        <p className="qs-inspector-name">{nearestHospital?.name ?? 'Unavailable'}</p>
        <InspectorFacts rows={[
          ['Straight-line distance', nearest[0] ? `${nearest[0].distanceKm.toFixed(2)} km` : 'Unavailable'],
          ['Location evidence', 'Provisional point'],
        ]} />
        <div className="qs-inspector-actions"><button type="button" className="text-button" disabled={!nearestHospital} onClick={() => nearestHospital && inspectHospital(nearestHospital.id)}>Inspect hospital <ChevronRight size={14} /></button></div>
      </section>
      <details className="qs-inspector-disclosure"><summary>Hospitals mapped inside this barangay ({localHospitals.length})</summary>
        <div className="qs-location-list">{localHospitals.map(entry => {
          const h = context?.hospitals.find(h => h.id === entry.facilityId);
          return h && <div key={h.id}><div><span>{h.name}</span><small>{entry.distanceKm.toFixed(2)} km · straight-line</small></div><button type="button" className="text-button" onClick={() => inspectHospital(h.id)}>Inspect <ChevronRight size={13} /></button></div>;
        })}</div>
        <p>Provisional point-in-polygon matches; not verified entrances or referral guidance.</p>
      </details>
    </section>
  ) : null;
  const hospitalDetails = (
    <section className="qs-hospital-inspector" aria-label="Hospital scenario details">
      <details className="qs-inspector-disclosure qs-hospital-lookup"><summary>Inspect another registered hospital</summary>
        <WorkspaceSelect label="Inspect hospital" value={hospital} disabled={!context} onChange={value => {
          if (value) inspectHospital(value); else { setHospital(''); setShowHotspotDetails(true); }
        }} options={[{ value: '', label: 'Nearest hospitals to selected barangay' }, ...(context?.hospitals.map(h => ({ value: h.id, label: h.name })) ?? [])]} />
      </details>
      {inspectedHospital && <section className="qs-inspector-block qs-hospital-context"><h4>Nearest ranked barangay</h4>
        <p className="qs-inspector-name">{hospitalHotspotArea?.name ?? (scenario ? 'No ranked candidate in this window' : 'Start playback to view')}</p>
        <InspectorFacts rows={[
          ['Straight-line distance', hospitalHotspot ? `${hospitalHotspot.distanceKm.toFixed(2)} km` : 'Unavailable'],
          ['Projected window cases', format(hospitalHotspotCases?.cumulativeCases)],
          ['Experimental range', range(hospitalHotspotCases?.caseRange)],
        ]} />
        <p className="qs-inspector-note">Closest annual candidate by representative point; not a verified hospital entrance or referral.</p>
        <div className="qs-inspector-actions"><button type="button" className="text-button" disabled={!hospitalHotspotArea} onClick={() => hospitalHotspotArea && inspectHotspot(hospitalHotspotArea.id)}>Inspect barangay <ChevronRight size={13} /></button><button type="button" className="text-button" onClick={() => { setHospital(''); setShowHotspotDetails(true); }}>Nearby hospitals</button></div>
      </section>}
      <h3 className="qs-inspector-section-title">{inspectedHospital ? 'Hospital capacity & demand' : 'Nearby hospital details'}</h3>
      {!inspectedHospital && <p className="qs-inspector-note">Registered sites nearest to {area?.name ?? 'the selected barangay'}. Distances are straight-line proxies, not travel routes.</p>}
      {displayedHospitals.map((n, index) => {
        const h = context!.hospitals.find(h => h.id === n.facilityId)!;
        const stat = snapshot?.facilities.find(item => item.facilityId === h.id);
        const peak = scenario?.bedProjection?.hospitalPeaks.find(item => item.facilityId === h.id);
        return <details key={h.id} className="qs-hospital-entry" open={!!inspectedHospital}>
          <summary><span className="qs-hospital-entry-name">{h.name}</span><span className="qs-hospital-entry-meta">{inspectedHospital ? 'Selected hospital' : `Nearby site ${index + 1}`} · {n.distanceKm == null ? 'Distance unavailable' : `${n.distanceKm.toFixed(2)} km`}</span></summary>
          <div className="qs-hospital-entry-body">
            <section className="qs-inspector-section"><h4>Registered inventory</h4>
              <InspectorFacts rows={[
                ['Accredited beds', format(h.accreditedBeds)],
                ['Register date', h.sourceAsOf],
                ['Actual staffed / dengue beds', 'Unknown'],
                ['Location evidence', 'Provisional point'],
              ]} />
              <p className="qs-inspector-note">PhilHealth accredited beds are not staffed, free or dengue-usable beds. {h.id} is a local record ID.</p>
            </section>
            <BedUse forecast={stat?.bedForecast} day={day} occupancyPct={stat?.supportedOccupancyPct} />
            <section className="qs-inspector-section"><h4>Scenario capacity · day {day}</h4>
              <InspectorFacts rows={[
                ['Assumed normal capacity', format(stat?.normalCapacity)],
                ['Activated surge capacity', format(stat?.activatedSurgeCapacity)],
                ['Residual supported slots', format(stat?.remainingSupportedCapacity)],
                ['Expected dengue census', format(stat?.supportedCensus)],
                ['Normal-relative occupancy', percent(stat?.normalOccupancyPct)],
                ['Supported-relative occupancy', percent(stat?.supportedOccupancyPct)],
                ['Unstaffed holding', format(stat?.holdingCensus)],
              ]} />
              <p className="qs-inspector-note">Capacities and occupancy are scenario assumptions, not current vacancies.</p>
            </section>
            <details className="qs-inspector-disclosure"><summary>Daily & peak bed-demand breakdown</summary>
              <InspectorFacts rows={[
                ['Required staffed beds', format(stat?.bedForecast?.staffedBedsRequired)],
                ['No-added-surge bed need', format(stat?.bedForecast?.baselineStaffedBedsRequired)],
                ['Extra beds due to surge', format(stat?.bedForecast?.additionalStaffedBedsDueToSurge)],
                ['Low–high case sensitivity', `${format(stat?.bedForecast?.lowerStaffedBedsRequired)}–${format(stat?.bedForecast?.upperStaffedBedsRequired)}`],
                ['Local additional beds', format(stat?.bedForecast?.additionalStaffedBedsNeeded)],
                ['Window peak staffing need', format(peak?.peakStaffedBedsRequired)],
                ['Window peak extra from surge', format(peak?.additionalStaffedBedsDueToSurge)],
              ]} />
              <p>All modeled origin barangays contribute to hospital-wide demand. The arrival split is an assumption, not observed admissions.</p>
            </details>
            <div className="qs-inspector-actions">{!inspectedHospital && <button type="button" className="text-button" onClick={() => inspectHospital(h.id)}>Inspect this hospital <ChevronRight size={13} /></button>}<a href={h.primarySourceUrl} target="_blank" rel="noreferrer">Bed source</a><a href={h.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate evidence</a></div>
          </div>
        </details>;
      })}
      {!inspectedHospital && selectedBedProjection && <details className="qs-inspector-disclosure"><summary>Bed demand attributed to this barangay</summary>
        <p className="qs-inspector-note">{surgeStatus} · day {day}. Arrival shares are assumptions and do not represent bed occupancy.</p>
        {selectedBedProjection.hospitals.map(row => {
          const stat = snapshot?.facilities.find(item => item.facilityId === row.facilityId);
          return <section key={row.facilityId} className="qs-inspector-section"><h4>{context?.hospitals.find(h => h.id === row.facilityId)?.name ?? row.facilityId}</h4>
            <InspectorFacts rows={[
              ['Assumed arrival share', `${format(row.share * 100)}%`],
              ['Expected admissions from this place', format(row.expectedAdmissions)],
              ['Peak staffed beds from this place', format(row.peakStaffedBedsRequired)],
              ['Extra beds from surge', format(row.additionalStaffedBedsDueToSurge)],
              ['Hospital-wide beds needed', format(stat?.bedForecast?.expectedBeds)],
              ['Assumed dengue slots', format(stat?.bedForecast?.assumedSupportedDengueCapacity)],
              ['Hospital-wide demand percentage', percent(stat?.bedForecast?.demandUtilizationPct)],
            ]} />
            <div className="qs-inspector-actions"><button type="button" className="text-button" onClick={() => inspectHospital(row.facilityId)}>Inspect hospital <ChevronRight size={13} /></button></div>
          </section>;
        })}
        <p>Local rows attribute demand to this barangay; hospital-wide totals include all modeled origins. Actual available beds remain unknown.</p>
      </details>}
    </section>
  );
  return (
    <main ref={workspace} className="qc-workspace qs-workspace" data-map-fullscreen data-reduced-motion={reduced} data-expanded={expanded} data-panel={panelView ?? 'none'} data-wide={wideResults}>
      <h1 className="qs-sr-only">Quezon City simulation</h1>
      <div className="qs-layout" inert={showGuide || undefined}>
        <section className="qs-map-column" aria-label="Simulation map and timeline">
          <div className="qs-map-stage">
            <OutbreakMap context={context} snapshot={snapshot ?? null} maximum={data?.mapScaleMaxDailyCases ?? 1}
              selected={selected} selectedHospital={hospital} hotspotIds={markerHotspotIds} rankedHotspotIds={rankedHotspotIds}
              hospitalHotspot={hospitalHotspot} caseMetric={caseMetric} caseColorMaximum={caseColorMaximum}
              connectionFocus={hospital ? 'hospital' : showHotspotDetails ? 'barangay' : null} inspectionVersion={hospitalInspection}
              animationDurationMs={Math.min(650, 800 / speed)} onSelect={inspectHotspot} onHospital={inspectHospital}
              playing={playing} reducedMotion={reduced} showLinks={links} view={view} buildings3d={buildings3d}
              showHospitals={showHospitals} onReady={setMapController} onStatus={setMapStatus} />
            <div className="qs-topbar">
              <button ref={scenarioTrigger} type="button" className="text-button qs-scenario-trigger" data-map-overlay aria-label="Edit simulation scenario" aria-controls="qs-context-panel" aria-expanded={panelView === 'scenario'} onClick={() => panelView === 'scenario' ? closePanel() : openPanel('scenario')}>
                <SlidersHorizontal size={17} aria-hidden="true" /><span><strong>{tab === 'historical' ? 'Historical replay' : 'Future surge forecast'}</strong><small>Quezon City · {Number.isFinite(selectedDays) ? `${selectedDays} days` : 'Choose dates'}</small></span><ChevronDown size={13} aria-hidden="true" />
              </button>
              <button type="button" className="text-button qs-results-trigger" data-map-overlay aria-label="Open simulation results" aria-controls="qs-context-panel" aria-expanded={panelView === 'results'} onClick={() => panelView === 'results' ? closePanel() : openPanel('results')}><ChartNoAxesCombined size={16} aria-hidden="true" /><span>Results</span></button>
            </div>
            {(loading || error || stale) && <div className={`qs-engine-status${error ? ' qs-error' : ''}`} data-map-overlay role={error ? 'alert' : 'status'}>
              <Info size={15} aria-hidden="true" /><span>{error || (stale ? 'Settings changed. Run again to update results.' : connectionStatus === 'starting' ? ENGINE_STARTING_MESSAGE : connectionStatus === 'connecting' ? 'Connecting to the simulation engine…' : 'Loading forecast and simulation…')}</span>
              {!loading && <button type="button" className="text-button" onClick={() => stale ? runSimulation() : calculate(controls ?? undefined)}>{stale ? 'Run simulation' : 'Reload data-based forecast'}</button>}
              {stale && <button type="button" className="text-button" onClick={() => openPanel('scenario')}>Edit settings</button>}
            </div>}
            {(mapStatus === 'unavailable' || mapStatus === 'partial') && <div className="qs-map-fallback" role="status">{mapStatus === 'partial' ? 'Geography layer unavailable.' : 'Map unavailable.'} <button type="button" className="text-button" onClick={() => openDetail('barangays')}>Open result tables</button></div>}
            <div className="qs-map-tools" data-map-overlay role="group" aria-label="Map controls">
              <button type="button" className="text-button qs-map-button" aria-label="Map layers" aria-pressed={panelView === 'layers'} onClick={() => panelView === 'layers' ? closePanel() : openPanel('layers')}><Layers size={18} /><span className="qs-control-tooltip">Map layers</span></button>
              <button type="button" className="text-button qs-map-button" aria-label={buildings3d ? 'Switch to 2D map' : 'Switch to 3D map'} aria-pressed={buildings3d} disabled={mapControlsDisabled} onClick={() => setBuildings3d(v => !v)}><span className="qs-3d">3D</span><span className="qs-control-tooltip">{buildings3d ? '2D view' : '3D view'}</span></button>
              <button type="button" className="text-button qs-map-button" aria-label="Reset map view" disabled={mapControlsDisabled} onClick={() => mapController.current?.resetView()}><Compass size={18} /><span className="qs-control-tooltip">Reset map view</span></button>
              <button ref={fullscreenButton} type="button" className="text-button qs-map-button" aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>{expanded ? <Shrink size={18} /> : <Expand size={18} />}<span className="qs-control-tooltip">{expanded ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
              <span className="qs-control-divider" />
              <button type="button" className="text-button qs-map-button qs-zoom" aria-label="Zoom in" disabled={mapControlsDisabled} onClick={() => mapController.current?.zoomIn()}><Plus size={18} /><span className="qs-control-tooltip">Zoom in</span></button>
              <button type="button" className="text-button qs-map-button qs-zoom" aria-label="Zoom out" disabled={mapControlsDisabled} onClick={() => mapController.current?.zoomOut()}><Minus size={18} /><span className="qs-control-tooltip">Zoom out</span></button>
            </div>
            <details className="qs-map-key" data-map-overlay><summary><span className="qs-rank-swatch">1</span> Map key <ChevronDown size={12} aria-hidden="true" /></summary><div className="qc-map-legend qs-map-key-content">
                <strong>
                  {scenario
                    ? caseMetric === 'daily'
                      ? `Expected cases during day ${day} · each place’s dated allocation`
                      : `Expected cases accumulated to day ${day}`
                    : 'Forecast locations preview · case values hidden'}
                </strong>
                <div className="qc-case-color-ramp" aria-hidden="true" />
                <div>
                  {CASE_BANDS.map((b) => (
                    <span key={b.min}>
                      <i style={{ background: b.color }} />
                      {scenario
                        ? format((b.min / 50) * caseColorMaximum)
                        : b.min === 0
                          ? 'Low'
                          : b.min === 50
                            ? 'High'
                            : '·'}
                    </span>
                  ))}
                </div>
                <div className="qc-marker-key">
                  <span>
                    <b className="qc-marker-hotspot" aria-hidden="true">
                      1
                    </b>
                    Annual predicted burden · number = rank
                  </span>
                  <span>
                    <b className="qc-marker-hospital" aria-hidden="true">
                      ✚
                    </b>
                    Hospital · amber dot = provisional point
                  </span>
                  <span><b className="qc-marker-linked" aria-hidden="true">•</b>Other linked or selected barangay · unranked</span>
                  <span>
                    <i className="qc-other-barangay" />
                    Other barangay · may still have cases
                  </span>
                  <span><i className="qc-selected-barangay" aria-hidden="true" />Selected barangay boundary</span>
                </div>
                <div className="qc-line-key">
                  {[SIMULATION_LINES.proximity,
                    ...(scenario ? [SIMULATION_LINES.placement, SIMULATION_LINES.holding] : []),
                    SIMULATION_LINES['hospital-context'],
                    ...(snapshot?.expansionRing?.length ? [SIMULATION_LINES.front] : []),
                  ].map(line => <span key={line.kind} data-line-kind={line.kind}><i aria-hidden="true" style={{ borderTop: `${line.width}px ${line.dash.length ? 'dashed' : 'solid'} ${line.color}` }} />{line.label}</span>)}
                  <small>Click a marker to reveal its links. All hospital connections in Layers adds overview lines. Chevrons point from barangays toward hospitals.</small>
                  {!scenario && <small>Modeled placement lines appear only after advancing to a day with saved placements.</small>}
                </div>
                <details className="qc-legend-more">
                  <summary>
                    More about the map colors, markers and lines
                  </summary>
                  <p className="qc-progression-note">
                    {hotspotRanking
                    ? `XGBoost ranks predicted annual barangay burden for ${hotspotRanking.forecastYear}, trained only through ${hotspotRanking.trainingCutoffYear}. Only the ten highest-burden candidates receive numbered markers. Their modeled annual shares allocate the dated QC forecast; this is not validated weekly hotspot detection.`
                      : 'Places follow dated modeled allocations; local weekly hotspot forecasts are unavailable.'}{' '}
                    All places update together, without a neighbor-triggered
                    outbreak sequence.
                  </p>
                  <small>
                    Smooth shades between these reference values; scale is fixed
                    for the selected window. Accumulated cases show daily
                    growth; daily forecasts may stay flat within a source week.{' '}
                    {reduced
                      ? 'Reduced motion is on: color animation is disabled.'
                      : 'Colors animate from each place’s forecast values; no geographic infection chain is implied.'}
                  </small>
                  <small>
                    Only the {markerHotspotIds?.length ?? '—'} highest predicted
                    annual-burden candidates have numbered markers and case-band
                    coloring; other barangays remain neutral. Small unnumbered dots identify other barangays linked to an inspected hospital. Positive demand
                    alone does not make a hotspot. Click a marker to inspect its
                    hospital connections. {hotspotRanking?.model}; no
                    confirmed weekly-outbreak claim.
                  </small>
                  <small>
                    Selected links reveal from barangay to hospital, including hospital inspection. Dashed teal links show proximity; dashed ochre links identify a hospital’s nearest ranked barangay. Solid links show saved modeled placements; ochre indicates that some placements use temporary holding. A placement replaces the proximity decoration on the same pair. Icons may separate slightly to avoid overlap; connections follow their displayed centers. Straight-line links are not travel routes or observed patient movement. The raised boundary is decorative. Hospital pins do not report vacancies; all entrance locations remain unverified. Polygon colors show modeled case counts, not hospital pressure or official outbreak thresholds.
                  </small>
                </details>
              </div></details>
          </div>
          <section className="qs-timeline" role="group" aria-label="Simulation timeline and playback">
            <div className="qs-timeline-heading"><span className="qs-research-status">Research scenario · Assumed capacity</span><button ref={guideTrigger} type="button" className="text-button qs-help" aria-label="How to use this page" aria-expanded={showGuide} onClick={openGuide}><CircleHelp size={15} />Help</button></div>
            <div className="qs-transport">
              <button type="button" className="text-button qs-play" aria-label={playing ? 'Pause simulation' : 'Play simulation'} disabled={!data} onClick={() => { if (data && day === data.durationDays) setDay(0); setPlaying(v => !v); }}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'Pause' : 'Play'}</button>
              <div className="qs-timeline-date"><strong>{snapshot ? formatScenarioDate(snapshot.date) : controls?.startDate ? formatScenarioDate(controls.startDate) : 'Choose a scenario'}</strong><span>Day {day} / {data?.durationDays ?? '—'} · {playing ? 'Playing' : scenario ? 'Paused' : data ? 'Ready' : 'Awaiting update'}</span></div>
              <div className="qs-day-track"><label className="qs-sr-only" htmlFor="qs-simulation-day">Simulation day</label><input id="qs-simulation-day" aria-label="Simulation day" type="range" min={0} max={data?.durationDays ?? 28} step={1} value={day} disabled={!data} onChange={event => { setDay(Number(event.target.value)); setPlaying(false); }} />
                {canJumpToPeak && <button type="button" className="text-button qs-peak" aria-label={`Jump to peak bed demand on day ${peakDay}`} style={{ left: `clamp(0px, calc(${(peakDay! / data!.durationDays) * 100}% - 37px), calc(100% - 74px))` }} onClick={() => { setPlaying(false); setDay(peakDay!); }}><Flag size={11} aria-hidden="true" />Peak · {peakDay}</button>}
              </div>
              <div className="qs-playback-actions">
                <button type="button" className="text-button qs-icon-action" aria-label="Restart simulation" disabled={!data} onClick={() => { setDay(0); setPlaying(false); }}><RotateCcw size={16} /><span className="qs-control-tooltip">Restart</span></button>
                <button type="button" className="text-button qs-final-day" aria-label="Jump to final day" disabled={!data || day >= (data?.durationDays ?? 0)} onClick={() => { setPlaying(false); if (data) setDay(data.durationDays); }}><SkipForward size={16} /><span>Final day</span></button>
                <details ref={playbackMenu} className="qs-playback-more"><summary aria-label="More playback options"><SlidersHorizontal size={15} /><span className="qs-control-tooltip">Playback options</span></summary><div className="qs-playback-menu">
                  <div className="qs-step-controls"><button type="button" className="text-button" aria-label="Previous day" disabled={!data || day === 0} onClick={() => { setPlaying(false); setDay(d => Math.max(0, d - 1)); }}><ChevronLeft size={15} />Previous</button><button type="button" className="text-button" aria-label="Next day" disabled={!data || day >= (data?.durationDays ?? 0)} onClick={() => { setPlaying(false); setDay(d => data ? Math.min(data.durationDays, d + 1) : d); }}>Next<ChevronRight size={15} /></button></div>
                  <label className="qs-field-label">Playback speed<WorkspaceSelect label="Playback speed" value={String(speed)} options={[0.5,1,2,4].map(value => ({ value: String(value), label: `${value} days/s` }))} onChange={value => setSpeed(Number(value))} /></label>
                </div></details>
              </div>
            </div>
            <div className="qs-live-totals" aria-label="Selected-day summary">
              <div><span>Projected cases so far</span><strong>{format(snapshot?.cumulativeCases)}</strong><small>{snapshot?.caseRange ? `Experimental range ${range(snapshot.caseRange)}` : `Cases · accumulated to day ${day}`}</small></div>
              <div><span>Beds needed now</span><strong>{format(snapshot?.bedForecast?.staffedBedsRequired)}</strong><small>Staffed beds required · assumed admissions</small></div>
              <div><span>Unplaced demand to date</span><strong>{format(snapshot?.cumulativeUnresolved)}</strong><small>Expected patients · cumulative</small></div>
              <button type="button" className="text-button qs-more-results" onClick={() => openDetail('overview')}>View results <ChevronRight size={14} /></button>
            </div>
            {introToast && data && !scenario && <p className="qs-first-hint">Press Play or choose a day. Numbered markers show annual burden rank; cross pins are hospitals.</p>}
          </section>
        </section>
        <aside id="qs-context-panel" className="qs-context-panel" hidden={!panelView} aria-labelledby="qs-panel-title" data-reduced-motion={reduced}>
          <div className="qs-panel-header"><div><span>SurgeWise / Simulation</span><h2 ref={panelHeading} tabIndex={-1} id="qs-panel-title">{panelView ? panelTitles[panelView] : 'Simulation'}</h2></div><div>
            {panelView === 'results' && <button type="button" className="text-button qs-panel-icon" aria-label={wideResults ? 'Narrow results panel' : 'Expand results panel'} aria-pressed={wideResults} onClick={() => setWideResults(v => !v)}>{wideResults ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
            <button type="button" className="text-button qs-panel-icon" aria-label="Close simulation panel" onClick={closePanel}><X size={18} /></button></div></div>
          <div className="qs-panel-body" hidden={panelView !== 'scenario'} aria-label="Simulation controls">{settings}</div>
          <div className="qs-panel-body qs-results-body" hidden={panelView !== 'results'} aria-label="Simulation results">
            <div className="qs-result-tools"><WorkspaceSelect label="Result view" value={activeDetail} options={detailTabs.map(item => ({ value: item.id, label: item.label }))} onChange={value => setDetailTab(value as DetailTab)} /><button type="button" className="text-button qs-export" disabled={!scenario} onClick={download} aria-label="Export simulation results"><Download size={15} />Export</button></div>
            <div className="qs-analysis-scroll">{overview}{activeDetail === 'overview' && <div className="qs-result-actions"><button type="button" className="text-button" disabled={!controls || loading} onClick={compareAllocations}>Compare allocation policies <ArrowLeft size={13} /></button><button type="button" className="text-button" onClick={() => openDetail('city-beds')}>Explore daily bed demand <ChevronRight size={13} /></button></div>}
              {activeDetail === 'overview' && <div className="qc-playback-panel">
              <div className="qc-chart-heading">
                <strong>
                  Daily expected cases
                  {scenario ? ' · click a bar to jump to that day' : ''}
                </strong>
                <span>
                  <i className="qc-swatch-baseline" aria-hidden="true" />
                  Reference forecast{' '}
                  <i className="qc-swatch-shock" aria-hidden="true" />
                  Separately assumed shock
                </span>
              </div>
              <svg
                viewBox="0 0 900 80"
                role="img"
                aria-label="QC daily case forecast trajectory, including a separately colored hypothetical shock"
              >
                {scenario?.days.slice(1).map((d, i) => {
                  const x = 10 + (i * 880) / scenario.durationDays,
                    width = 880 / scenario.durationDays - 4;
                  return (
                    <g
                      key={d.dayIndex}
                      className="qc-chart-day"
                      onClick={() => {
                        setPlaying(false);
                        setDay(d.dayIndex);
                      }}
                    >
                      <title>{`Day ${d.dayIndex} · ${d.date}: ${format(d.expectedCases)} expected cases`}</title>
                      <rect
                        x={x - 2}
                        y={0}
                        width={width + 4}
                        height={80}
                        fill={d.dayIndex === day ? '#1d355714' : 'transparent'}
                      />
                      <rect
                        x={x}
                        y={75 - (d.expectedCases / maxCases) * 65}
                        width={width}
                        height={(d.expectedCases / maxCases) * 65}
                        rx={2}
                        fill="#cc873e"
                      />
                      <rect
                        x={x}
                        y={75 - (d.baselineCases / maxCases) * 65}
                        width={width}
                        height={(d.baselineCases / maxCases) * 65}
                        rx={2}
                        fill="#347d77"
                      />
                    </g>
                  );
                })}
              </svg>
              <p className="qc-interval-note">
                Day {day} · cases during [
                {snapshot?.intervalStart.slice(0, 10) ?? '—'},{' '}
                {snapshot?.intervalEnd.slice(0, 10) ?? '—'})
              </p>
            </div>}{analysis}
              {activeDetail === 'methods' && <details className="qc-environment">
                <summary>
                  {tab === 'future'
                    ? 'Seasonal forecasting engine'
                    : 'Environmental basis'}
                </summary>
                {source ? (
                  <>
                    <p>
                      {tab === 'future'
                        ? 'Training observations through'
                        : 'Source origin'}{' '}
                      <strong>
                        {source.issueBlock.YR} / WN {source.issueBlock.WN}
                      </strong>
                    </p>
                    {data?.futureForecast && (
                      <p>
                        <strong>
                          {data.futureForecast.selectedModel ===
                          'seasonal_xgboost'
                            ? 'XGBoost seasonal case forecast'
                            : data.futureForecast.selectedModel ===
                                'seasonal_boosted_trees'
                              ? 'Seasonal gradient-boosted trees'
                              : 'Seasonal baseline'}
                        </strong>
                        <br />
                        Issued for planning: {data.futureForecast.asOfDate}
                      </p>
                    )}
                    {data?.futureForecast?.accuracyAssessment && (
                      <p className="qc-range-caution">
                        Experimental accuracy:{' '}
                        {data.futureForecast.accuracyAssessment.comparison
                          .map(
                            (row) =>
                              `${row.year}: ${format(row.maeSkillVsSeasonalBaseline * 100)}% MAE improvement versus seasonal baseline`
                          )
                          .join('; ')}
                        . Negative means worse. Current-year, barangay-weekly
                        and bed-occupancy accuracy remain unverified.
                      </p>
                    )}
                    {source.environmentalInputs.map((f) => (
                      <div key={f.sourceColumn}>
                        <span>
                          {factorName[f.sourceColumn] || f.sourceColumn}
                        </span>
                        <strong>
                          {format(f.valueAtOrigin)} <small>{f.unit}</small>
                        </strong>
                      </div>
                    ))}
                    <p>
                      {tab === 'future'
                        ? 'Values above are assumed historical weather analogs for the selected season. No current-case lags or measured future weather are fabricated.'
                        : 'Observed inputs at origin; lagged 1, 2 and 4 source blocks in the city model.'}{' '}
                      No measured barangay microclimate.
                    </p>
                  </>
                ) : (
                  <p>
                    Environmental evidence loads with the approved forecast.
                  </p>
                )}
              </details>}
            </div>
          </div>
          <div className="qs-panel-body qs-inspector-body" hidden={panelView !== 'hospitals'}>{selectedPlace}{hospitalDetails}<button type="button" className="text-button qs-inspector-results" onClick={() => openDetail(inspectedHospital ? 'city-beds' : 'place-beds')}>{inspectedHospital ? 'View city-wide bed demand' : 'View barangay bed-demand results'} <ChevronRight size={14} /></button></div>
          <div className="qs-panel-body qs-layers-body" hidden={panelView !== 'layers'}>
            <p className="qs-panel-intro">Choose the context and information on your map.</p>
            <label className="qs-field-label">Map area<WorkspaceSelect label="Map extent" value={view} onChange={value => setView(value as 'qc' | 'philippines')} options={[{value:'qc',label:'Quezon City'},{value:'philippines',label:'Philippines context'}]} /></label>
            <label className="qs-field-label">Color barangays by<WorkspaceSelect label="Map case measure" value={caseMetric} onChange={value => setCaseMetric(value as 'daily' | 'cumulative')} options={[{value:'cumulative',label:'Accumulated projected cases'},{value:'daily',label:'Daily projected cases'}]} /></label>
            <label className="qs-layer"><span><MapPin size={17} /><span>Hospital pins<small>PhilHealth inventory · provisional points</small></span></span><input type="checkbox" checked={showHospitals} onChange={event => setShowHospitals(event.target.checked)} /></label>
            <label className="qs-layer"><span><Layers size={17} /><span>3D view<small>Generalized buildings where mapped</small></span></span><input type="checkbox" checked={buildings3d} onChange={event => setBuildings3d(event.target.checked)} /></label>
            <label className="qs-layer"><span><Activity size={17} /><span>All hospital connections<small>Show beyond the selected place or hospital</small></span></span><input type="checkbox" checked={links} onChange={event => setLinks(event.target.checked)} /></label>
            <label className="qs-layer"><span><Pause size={17} /><span>Reduced motion<small>Static colors and manual playback</small></span></span><input type="checkbox" checked={reduced} onChange={event => { setReduced(event.target.checked); if(event.target.checked) setPlaying(false); }} /></label>
            <p className="qs-layer-note">Colors show projected case counts, not official outbreak thresholds. Uncolored barangays may still have cases. Building geometry and hospital entrances are unverified context.</p>
            <details className="qs-national-context" onToggle={event => setLocatorOpen(event.currentTarget.open)}><summary>Philippines locator</summary>{locatorOpen && <PhilippinesOverview />}</details>
            <button type="button" className="text-button qs-source-link" onClick={() => openDetail('methods')}>Run assumptions & sources <ChevronRight size={14} /></button>
          </div>
          <footer className="qs-panel-footer"><span>Research estimates · No live vacancies</span><a href="/research">Research <ChevronRight size={12} /></a></footer>
        </aside>
      </div>
      {showGuide && <div className="qs-guide-backdrop" onClick={event => { if(event.target === event.currentTarget) closeGuide(); }} onKeyDown={event => {
        if(event.key === 'Escape') { event.stopPropagation(); closeGuide(); }
        if(event.key === 'Tab') {
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, summary');
          const first = focusable[0], last = focusable[focusable.length - 1];
          if(event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}><section className="qs-guide" role="dialog" aria-modal="true" aria-labelledby="qs-guide-title"><div className="qs-guide-heading"><h2 id="qs-guide-title">Explore a preparedness scenario</h2><button type="button" ref={guideClose} className="text-button qs-panel-icon" aria-label="Close guide" onClick={closeGuide}><X size={18} /></button></div>
        <ol><li><strong>Play the scenario.</strong> Use the timeline, jump to the final day, or explore the marked peak in bed demand.</li><li><strong>Inspect the map.</strong> Numbered markers are annual projected-burden ranks, not case counts or confirmed outbreaks. Cross pins are hospitals.</li><li><strong>Try an assumption.</strong> Open Scenario to edit dates, surge and hospital assumptions. Run again to update every result together.</li><li><strong>Explore Results.</strong> Read the case ranges, bed-demand charts and policy comparisons, then export the saved scenario.</li></ol>
        <details><summary>Terms used in this simulation</summary><dl>{Object.values(GLOSSARY).map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></details>
        <p>Historical source evidence and configured assumptions support this research scenario. Current hospital vacancies, dengue capacity and entrances are not verified. This is not live surveillance or clinical referral guidance.</p><button type="button" className="text-button qs-primary" onClick={closeGuide}>Explore the map</button>
      </section></div>}
    </main>
  );
}
