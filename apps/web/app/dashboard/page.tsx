'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronDown, Compass, Expand, Hospital, Info, Layers, MapPin, Minus, Search, Shrink, X, Plus } from 'lucide-react';
import type { Facility } from '@/lib/types';
import { loadFacilities, FACILITY_DATASET_ID } from '@/lib/facilities';
import { areaLabel, type DashboardMapController, type DashboardMapStatus } from '@/lib/dashboard-map';
import WorkspaceSelect from '@/components/workspace-select';
import WorkspaceLoader from '@/components/workspace-loader';
import './dashboard.css';

const NCRMap = dynamic(() => import('@/components/ncr-map'), {
  ssr: false,
});
type View = 'hospitals' | 'details' | 'layers' | 'evidence';

function MapButton({ label, children, onClick, pressed, disabled, buttonRef }: {
  label: string; children: ReactNode; onClick: () => void; pressed?: boolean; disabled?: boolean; buttonRef?: Ref<HTMLButtonElement>;
}) {
  return <button ref={buttonRef} type="button" className="text-button db-map-button" aria-label={label}
    aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    {children}<span className="db-control-tooltip" aria-hidden="true">{label}</span>
  </button>;
}

export default function Dashboard() {
  const [area, setArea] = useState('QUEZON_CITY');
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityError, setFacilityError] = useState('');
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [query, setQuery] = useState('');
  const [ownership, setOwnership] = useState('ALL');
  const [view, setView] = useState<View | null>(null);
  const [mapStatus, setMapStatus] = useState<DashboardMapStatus>('loading');
  const [expanded, setExpanded] = useState(false);
  const [registryAttempt, setRegistryAttempt] = useState(0);
  const [buildings3d, setBuildings3d] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const controller = useRef<DashboardMapController | null>(null);
  const exploreButton = useRef<HTMLButtonElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const beforeExpanded = useRef<View | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const expandedRef = useRef(false);
  const setController = useCallback((next: DashboardMapController | null) => { controller.current = next; }, []);

  useEffect(() => {
    const abort = new AbortController();
    loadFacilities(abort.signal).then(setFacilities)
      .catch(error => { if (!abort.signal.aborted) setFacilityError(error instanceof Error ? error.message : 'QC hospital registry unavailable.'); })
      .finally(() => { if (!abort.signal.aborted) setLoadingFacilities(false); });
    return () => abort.abort();
  }, [registryAttempt]);

  useEffect(() => { if (view) panelHeading.current?.focus({ preventScroll: true }); }, [view]);
  useEffect(() => {
    function finishExpanded() {
      if (!expandedRef.current) return;
      expandedRef.current = false; setExpanded(false); setView(beforeExpanded.current);
      requestAnimationFrame(() => fullscreenButton.current?.focus());
    }
    function fullscreenChanged() {
      if (document.fullscreenElement !== workspace.current) finishExpanded();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (expandedRef.current && document.fullscreenElement !== workspace.current) finishExpanded();
      else if (!expandedRef.current) { setView(null); exploreButton.current?.focus(); }
    }
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  async function toggleFullscreen() {
    const element = workspace.current;
    if (!element) return;
    if (expandedRef.current) {
      if (document.fullscreenElement === element) { await document.exitFullscreen(); return; }
      expandedRef.current = false; setExpanded(false); setView(beforeExpanded.current);
      fullscreenButton.current?.focus(); return;
    }
    beforeExpanded.current = viewRef.current;
    // Native fullscreen excludes the global rail. The same expanded layout is
    // also available in browsers that don't expose the Fullscreen API.
    try { if (element.requestFullscreen) await element.requestFullscreen(); } catch { /* Use the in-app expanded view. */ }
    expandedRef.current = true; setExpanded(true); setView(null);
  }
  function selectArea(next: string) {
    setArea(next); setFacility(null);
    if (view === 'details') setView('hospitals');
  }
  function selectFacility(next: Facility) {
    setArea('QUEZON_CITY'); setShowHospitals(true); setFacility(next); setView('details');
  }
  function closeExplorer() { setView(null); exploreButton.current?.focus(); }
  const filteredFacilities = facilities.filter(f => (ownership === 'ALL' || f.ownership === ownership)
    && `${f.name} ${f.id} ${f.address}`.toLowerCase().includes(query.toLowerCase()));
  const beds = facilities.reduce((sum, f) => sum + f.accreditedBeds, 0);
  const mapUnavailable = mapStatus === 'unavailable' || mapStatus === 'partial';
  const mapControlsDisabled = mapStatus === 'loading' || mapStatus === 'unavailable';
  const titles = { hospitals: 'Hospital explorer', details: 'Hospital details', layers: 'Map layers', evidence: 'Data & evidence' };

  return (
    <main ref={workspace} className="db-workspace dashboard-map-layout" data-panel={view ?? 'none'} data-expanded={expanded}>
      <h1 className="db-sr-only">Dashboard: geography and hospitals</h1>
      <section className="db-map-viewport" aria-label="Healthcare geography map">
        <NCRMap selectedArea={area} onAreaSelect={selectArea}
          facilities={showHospitals && area === 'QUEZON_CITY' ? filteredFacilities : []}
          onFacilitySelect={selectFacility} selectedFacilityId={facility?.id} showBoundaries={showBoundaries}
          buildings3d={buildings3d}
          onReady={setController} onStatus={setMapStatus} />
        <div className="db-top-controls">
          <WorkspaceSelect className="db-scope" label="Map geography" value={area} onChange={selectArea}
            icon={<MapPin size={17} aria-hidden="true" />} options={[
              { value: 'QUEZON_CITY', label: 'Quezon City' }, { value: 'NCR', label: 'National Capital Region' },
              ...(!['NCR', 'QUEZON_CITY'].includes(area) ? [{ value: area, label: areaLabel(area) }] : []),
            ]} />
          <button ref={exploreButton} type="button" className="text-button db-explore-toggle" aria-expanded={view !== null}
            aria-label={view ? 'Close explorer' : 'Explore hospitals'}
            aria-controls="db-explorer" onClick={() => setView(view ? null : 'hospitals')}>
            <Search size={17} aria-hidden="true" /><span>Explore</span>
          </button>
        </div>
        {(mapUnavailable || facilityError) && <div className="db-map-message" role="status">
          <Info size={16} aria-hidden="true" /><span>{facilityError ? 'Hospital inventory unavailable. Open the explorer to retry.' : `${mapStatus === 'partial' ? 'Boundary layer unavailable.' : 'Map unavailable.'} Hospital records are still accessible.`}</span>
          <button type="button" className="text-button" onClick={() => setView('hospitals')}>Open explorer</button>
        </div>}
        <div className="db-map-controls" role="group" aria-label="Map controls">
          <MapButton label="Map layers" pressed={view === 'layers'} onClick={() => setView(view === 'layers' ? null : 'layers')}><Layers size={18} /></MapButton>
          <MapButton label={buildings3d ? 'Switch to 2D map' : 'Switch to 3D map'} pressed={buildings3d} disabled={mapControlsDisabled} onClick={() => setBuildings3d(current => !current)}><span className="db-3d-icon" aria-hidden="true">3D</span></MapButton>
          <MapButton label={`Reset view to ${areaLabel(area)}`} disabled={mapControlsDisabled} onClick={() => { setFacility(null); controller.current?.focusArea(area); }}><Compass size={19} /></MapButton>
          <MapButton label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'} buttonRef={fullscreenButton} onClick={toggleFullscreen}>{expanded ? <Shrink size={18} /> : <Expand size={18} />}</MapButton>
          <span className="db-control-divider" />
          <MapButton label="Zoom in" disabled={mapControlsDisabled} onClick={() => controller.current?.zoomIn()}><Plus size={19} /></MapButton>
          <MapButton label="Zoom out" disabled={mapControlsDisabled} onClick={() => controller.current?.zoomOut()}><Minus size={19} /></MapButton>
        </div>
        <details className="db-legend">
          <summary><Hospital className="db-legend-key" size={15} aria-hidden="true" />Map key <ChevronDown size={12} aria-hidden="true" /></summary>
          <div className="db-legend-body">
            {showBoundaries && <span><i className="db-area-swatch" />Selected geography / NCR boundaries</span>}
            {showHospitals && area === 'QUEZON_CITY' && <span><i className="db-hospital-swatch" aria-hidden="true" />{facilityError ? 'QC hospital layer unavailable' : loadingFacilities ? 'QC hospital points · validating' : 'Hospital pins + amber dot · provisional'}</span>}
            {!showBoundaries && (!showHospitals || area !== 'QUEZON_CITY') && <span>Basemap only</span>}
            <p>Inventory: PhilHealth · 30 Sep 2026</p>
            {buildings3d && <p>3D: generalized OSM buildings, where mapped</p>}
            <button className="text-button" type="button" onClick={() => setView('evidence')}>Source details <ArrowUpRight size={12} /></button>
          </div>
        </details>
        <WorkspaceLoader active={mapStatus === 'loading'} label="Preparing dashboard map" />
      </section>

      {view && <aside id="db-explorer" className="db-explorer" aria-labelledby="db-explorer-title">
        <div className="db-explorer-heading">
          <div><span className="db-eyebrow">SurgeWise / Dashboard</span><h2 ref={panelHeading} tabIndex={-1} id="db-explorer-title">{titles[view]}</h2></div>
          <button className="text-button db-close" type="button" aria-label="Close explorer" onClick={closeExplorer}><X size={18} /></button>
        </div>
        <div className="db-explorer-sections" role="group" aria-label="Explorer sections">
          {([['hospitals', Hospital, 'Hospitals'], ['layers', Layers, 'Layers'], ['evidence', BookOpen, 'Evidence']] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" className="text-button" aria-pressed={view === id || (view === 'details' && id === 'hospitals')} onClick={() => setView(id)}><Icon size={14} aria-hidden="true" />{label}</button>
          ))}
        </div>
        <div className={`db-explorer-body${view === 'hospitals' ? ' db-hospitals-body' : ''}`}>
          {view === 'hospitals' && <>
            <div className="db-inventory-summary" aria-live="polite">
              <span className="db-eyebrow">Quezon City / PhilHealth register</span>
              {loadingFacilities ? <p>Validating hospital records…</p> : facilityError ? <p>Inventory unavailable</p> :
                <div className="db-inventory-numbers"><span><strong>{facilities.length}</strong>hospital records</span><span><strong>{beds.toLocaleString()}</strong>accredited beds</span></div>}
              <p>30 Sep 2026 · Source-reported<br />Accredited ≠ staffed or vacant beds</p>
            </div>
            {facilityError && <div className="db-error" role="alert">{facilityError}<button className="text-button db-retry" type="button" onClick={() => { setLoadingFacilities(true); setFacilityError(''); setRegistryAttempt(attempt => attempt + 1); }}>Retry hospital records</button></div>}
            {area !== 'QUEZON_CITY' && <p className="db-inline-note">Hospital coverage is QC only. Selecting a hospital returns the map to QC.</p>}
            <div className="db-hospital-filters">
              <div className="db-search-field"><Search size={16} aria-hidden="true" /><label className="db-sr-only" htmlFor="hospital-search">Search hospital name, local ID or address</label><input id="hospital-search" type="search" placeholder="Search hospitals…" value={query} onChange={event => setQuery(event.target.value)} /></div>
              <WorkspaceSelect label="Hospital ownership" value={ownership} onChange={setOwnership} options={[
                { value: 'ALL', label: 'All ownership' },
                ...Array.from(new Set(facilities.map(f => f.ownership))).sort().map(value => ({ value, label: value })),
              ]} />
            </div>
            <div className="db-results-count" aria-live="polite">{loadingFacilities ? 'Loading records…' : facilityError ? 'Records unavailable' : `${filteredFacilities.length} of ${facilities.length} hospitals`}</div>
            <div className="db-hospital-list" role="region" aria-label="Hospital results" tabIndex={0}>
            <table className="db-hospital-table">
              <caption className="db-sr-only">Hospital table / map fallback. QC source-reported accredited beds, 30 Sep 2026.</caption>
              <thead><tr><th scope="col">Hospital / local ID</th><th scope="col">Accredited beds</th></tr></thead>
              <tbody>{filteredFacilities.map(f => <tr key={f.id} data-selected={facility?.id === f.id}>
                <td><button type="button" className="text-button db-hospital-name" onClick={() => selectFacility(f)}>{f.name}<ArrowUpRight size={12} aria-hidden="true" /></button><span>{f.id} · {f.ownership}</span></td><td>{f.accreditedBeds.toLocaleString()}</td>
              </tr>)}</tbody>
            </table>
            {!loadingFacilities && !facilityError && filteredFacilities.length === 0 && <div className="db-empty"><Search size={23} aria-hidden="true" /><h3>No matching hospitals</h3><p>Try a different name, address, or ownership.</p><button className="text-button" type="button" onClick={() => { setQuery(''); setOwnership('ALL'); }}>Clear filters</button></div>}
            </div>
          </>}

          {view === 'details' && facility && <>
            <button className="text-button db-back" type="button" onClick={() => setView('hospitals')}><ArrowLeft size={14} />Back to hospitals</button>
            <span className="db-provisional"><MapPin size={12} />Provisional location</span>
            <h3 className="db-facility-title">{facility.name}</h3>
            <p className="db-address">{facility.address}</p>
            <div className="db-bed-fact"><strong>{facility.accreditedBeds.toLocaleString()}</strong><span>accredited beds<small>Source-reported · 30 Sep 2026</small></span></div>
            <dl className="db-facts"><div><dt>Ownership</dt><dd>{facility.ownership}</dd></div><div><dt>Register category</dt><dd>{facility.philHealthCategory}</dd></div><div><dt>Staffed / vacant beds</dt><dd>Not reported</dd></div><div><dt>Dengue capacity / eligibility</dt><dd>Unknown</dd></div></dl>
            <details className="db-disclosure"><summary>Location & identifiers</summary><p>{facility.id} is a local source-row ID, not an official accreditation number.</p><p>{facility.latitude === null || facility.longitude === null ? 'Coordinates unavailable' : `${facility.latitude.toFixed(5)}, ${facility.longitude.toFixed(5)}`}</p><p>Entrance not independently verified. {facility.coordinateQualityNote}</p><p>Evidence status: {facility.coordinateEvidenceStatus}</p></details>
            <div className="db-source-links"><a href={facility.primarySourceUrl} target="_blank" rel="noreferrer">PhilHealth register <ArrowUpRight size={13} /></a><a href={facility.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate evidence <ArrowUpRight size={13} /></a></div>
          </>}

          {view === 'layers' && <>
            <p className="db-panel-intro">Choose the information on your map.</p>
            <label className="db-layer"><span><Layers size={18} /><span><strong>3D view</strong><small>Tilt + generalized buildings where mapped</small></span></span><input type="checkbox" checked={buildings3d} onChange={event => setBuildings3d(event.target.checked)} /><span className="db-switch" aria-hidden="true">{buildings3d && <Check size={11} />}</span></label>
            {buildings3d && <p className="db-basemap-note">Zoom in for building detail. Map shapes and heights are cartographic context, not verified hospital models.</p>}
            <span className="db-eyebrow db-overlay-heading">Overlays</span>
            <label className="db-layer"><span><Hospital size={18} /><span><strong>QC hospitals</strong><small>Provisional points · PhilHealth, Sep 2026</small></span></span><input type="checkbox" checked={showHospitals} onChange={event => setShowHospitals(event.target.checked)} /><span className="db-switch" aria-hidden="true">{showHospitals && <Check size={11} />}</span></label>
            {area !== 'QUEZON_CITY' && <p className="db-inline-note">Hospital points appear when QC is selected.</p>}
            <label className="db-layer"><span><MapPin size={18} /><span><strong>City boundaries</strong><small>NCR geography and selected area</small></span></span><input type="checkbox" checked={showBoundaries} onChange={event => setShowBoundaries(event.target.checked)} /><span className="db-switch" aria-hidden="true">{showBoundaries && <Check size={11} />}</span></label>
            <div className="db-layer-context"><span className="db-eyebrow">Historical dengue geography</span><p>Annual QC barangay observations are available in Research. Weekly spatial demand there is modeled, not observed surveillance.</p><Link href="/research">Explore the historical data <ArrowUpRight size={13} /></Link></div>
          </>}

          {view === 'evidence' && <>
            <p className="db-panel-intro">A dated hospital inventory for preparedness research.</p>
            <dl className="db-facts"><div><dt>Geography</dt><dd>Hospital coverage: QC only</dd></div><div><dt>Primary inventory</dt><dd>PhilHealth, 30 Sep 2026</dd></div><div><dt>Measurement</dt><dd>Source-reported accredited beds</dd></div><div><dt>Hospital points</dt><dd>All provisional; no verified entrances</dd></div></dl>
            <p className="db-inline-note">Accredited beds do not establish staffed capacity, occupancy, dengue eligibility, or vacancies. Those operational values remain unknown.</p>
            <details className="db-disclosure"><summary>Dataset version & coverage</summary><p className="db-dataset-id">{FACILITY_DATASET_ID}</p><p>The 70 supplementary maternity/lying-in records are excluded from this hospital network. Legacy NHFR records are retained only for audit and are not added to these totals.</p></details>
            <Link className="db-research-link" href="/research">Open Research & validation <ArrowUpRight size={15} /></Link>
            <details className="db-disclosure"><summary>Map credits</summary><p>Street and building context: <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>, OpenMapTiles and OpenStreetMap contributors. SurgeWise custom cartography. OSM coverage and generalized building heights vary.</p></details>
            <LegacyReference area={area} />
          </>}
        </div>
        <div className="db-explorer-footer"><span>Research use · No live bed availability</span><Link href="/outbreak-response">Open simulation <ArrowUpRight size={13} /></Link></div>
      </aside>}
    </main>
  );
}

/** Kept for audit and continuity; never enables the legacy guarded endpoint. */
function LegacyReference({ area }: { area: string }) {
  const [values, setValues] = useState([0, 15, 75, 4]);
  const [scores, setScores] = useState<Array<{ area: string; model_mae: number; seasonal_naive_mae: number }>>([]);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/data/forecast-validation.json', { signal: abort.signal }).then(response => response.ok ? response.json() : [])
      .then(data => setScores(Array.isArray(data) ? data.filter(v => v && typeof v.area === 'string' && Number.isFinite(v.model_mae) && Number.isFinite(v.seasonal_naive_mae)) : []))
      .catch(() => {});
    return () => abort.abort();
  }, []);
  return <>
    <details className="db-disclosure"><summary>Legacy stored evaluation · unverified</summary><p>2024–2025 stored evaluation; source version unverified. Its ISO-week assumption conflicts with source metadata and source hashes are absent. Use Research for audited source-block comparisons. Not a live forecast.</p>
      {scores.filter(v => v.area === area).map(v => <p key={v.area}>One-week-ahead MAE: {v.model_mae.toFixed(1)} cases/week; seasonal baseline: {v.seasonal_naive_mae.toFixed(1)}. {v.model_mae < v.seasonal_naive_mae ? 'Outperformed' : 'Did not beat'} the stored baseline.</p>)}
    </details>
    <details className="db-disclosure"><summary>Legacy scenario controls · inactive</summary><p>Illustrative assumptions from the earlier prototype. Active scenario editing is in Simulation; the legacy Run control stays guarded.</p>
      {([['Additional cases (%)', 0, 100, 10], ['Hospitalization assumption (%)', 5, 40, 5], ['Other occupied beds assumption (%)', 40, 95, 5], ['Mean length of stay (days)', 1, 10, 1]] as const).map(([label, min, max, step], i) => <label className="db-legacy-field" key={label}>{label}<strong>{values[i]}</strong><input type="range" min={min} max={max} step={step} value={values[i]} onChange={event => setValues(current => current.map((v, index) => index === i ? Number(event.target.value) : v))} /></label>)}
      <button className="btn" disabled={true}>Run baseline scenario</button>
      <p>LGU advisories remain unavailable here and require LGU review.</p>
    </details>
  </>;
}
