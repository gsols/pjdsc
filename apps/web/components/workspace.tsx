'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Facility, ScenarioResult } from '@/lib/types';
import Link from 'next/link';
import { ArrowRight, Building2, ChartNoAxesCombined, Info, Layers, MapPin, ShieldCheck } from 'lucide-react';
import ScenarioControls from './scenario-controls';
import FacilityDetail from './facility-detail';
import { ValidationChart } from './evidence-charts';
import type { Validation } from './evidence-charts';
import { useUIStore } from '@/lib/ui-store';
const NCRMap = dynamic(() => import('@/components/ncr-map'), {
  ssr: false,
  loading: () => <div style={{ padding: 28 }}>Loading geographic map…</div>,
});
export default function Workspace({ view }: { view: 'map' | 'simulation' | 'insights' }) {
  const { facilitiesVisible, toggleFacilities } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState('NCR');
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surge, setSurge] = useState(0);
  const [hospitalization, setHospitalization] = useState(15);
  const [occupancy, setOccupancy] = useState(75);
  const [stay, setStay] = useState(4);
  const [week, setWeek] = useState(1);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState<Validation[]>([]);
  useEffect(() => {
    fetch('/data/facilities.json')
      .then((r) => r.json())
      .then((x) => setFacilities(Array.isArray(x) ? x : []))
      .catch(() => setError('Facility registry could not be loaded.'));
  }, []);
  useEffect(() => {
    fetch('/data/forecast-validation.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((x) => setValidation(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, []);
  const supportsForecast = area === 'NCR' || area === 'QUEZON_CITY';
  async function run() {
    setError('');
    setResult(null);
    if (!supportsForecast) return;
    setLoading(true);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          area,
          forecastRunId: null,
          surgeMultiplier: 1 + surge / 100,
          hospitalizationRate: hospitalization / 100,
          baselineOccupancy: occupancy / 100,
          lengthOfStayDays: stay,
          facilities,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Simulation failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation error');
    } finally {
      setLoading(false);
    }
  }
  function selectArea(next: string) {
    setArea(next);
    setFacility(null);
    setResult(null);
    setWeek(1);
  }
  const areaLabel = area === 'NCR' ? 'National Capital Region' : area === 'QUEZON_CITY' ? 'Quezon City' : area.replaceAll('_', ' ');
  const evidence = validation.find((v) => v.area === area);
  const located = facilities.filter((f) => f.latitude !== null && f.longitude !== null);
  function changeInput(field: 'surge' | 'hospitalization' | 'occupancy' | 'stay', value: number) {
    ({ surge:setSurge, hospitalization:setHospitalization, occupancy:setOccupancy, stay:setStay })[field](value);
    setResult(null);
  }
  function reset() { setSurge(0); setHospitalization(15); setOccupancy(75); setStay(4); setResult(null); }
  const notice = supportsForecast ? `${areaLabel === 'National Capital Region' ? 'NCR' : areaLabel} historical weekly series available; model integration pending.` : 'Dedicated city-level case forecasting is unavailable. NCR facilities remain explorable.';
  return <div className={`workspace view-${view}`}>
    <div className="workspace-heading"><div><p className="eyebrow">{view==='map' ? '01 / EXPLORE THE GEOGRAPHY' : view==='simulation' ? '02 / TEST YOUR ASSUMPTIONS' : '03 / UNDERSTAND THE EVIDENCE'}</p><h1>{view==='map' ? 'Every place. A clearer picture.' : view==='simulation' ? 'Make preparedness a plan.' : 'Evidence, with perspective.'}</h1><p>{view==='map' ? 'Explore Metro Manila’s healthcare geography and available evidence.' : view==='simulation' ? 'Configure a transparent scenario for your selected geography.' : 'Historical validation and scenario context, with limitations in view.'}</p></div><span className="scope-tag"><MapPin size={15}/>{areaLabel}</span></div>
    <div className="workspace-grid">
      <section className="map-section" aria-label="Geographic workspace" hidden={view==='insights'}>
        <NCRMap selectedArea={area} onAreaSelect={selectArea} facilities={facilities} onFacilitySelect={setFacility} activeWeek={week} result={result} facilitiesVisible={facilitiesVisible}/>
        <div className="map-toolbar"><div><span className="eyebrow">METRO MANILA</span><strong>NCR Healthcare Geography</strong><p>Select a city boundary or hospital marker.</p></div><button className={`layer-button ${facilitiesVisible?'active':''}`} onClick={toggleFacilities} aria-pressed={facilitiesVisible}><Layers size={15}/> Facilities</button></div>
        <details className="map-legend"><summary>Map legend & sources</summary><div className="legend"><span><i className="dot qc"/>QC historical series</span><span><i className="dot other"/>Other NCR cities</span><span><i className="dot provisional"/>Provisional facility location</span><span><i className="dot verified"/>Verified location / spare capacity</span>{result && <><span><i className="dot warning"/>Limited simulated spare capacity</span><span><i className="dot critical"/>Simulated capacity gap</span></>}</div><p>Boundaries: faeldon/philippines-json-maps 2023. Facility markers with provisional coordinates are historical candidates, not verified locations. See facility profiles for sources.</p></details>
        {result && <div className="timeline" aria-label="Simulation timeline"><div><strong>28-day outlook</strong><span>Weekly simulation · calendar dates unavailable</span></div><div className="week-buttons">{[1,2,3,4].map(w=><button key={w} className={week===w?'active':''} aria-pressed={week===w} onClick={()=>setWeek(w)}><span>Week {w}</span><small>Days {(w-1)*7+1}–{w*7}</small></button>)}</div></div>}
      </section>
      <aside className="context-panel" hidden={view==='insights'} aria-label="Geography and scenario workspace"><section className="geography-panel"><p className="eyebrow">01 / SELECT GEOGRAPHY</p><h2>Your planning area</h2><div className="field"><label htmlFor="selected-geography">Selected geography</label><select id="selected-geography" value={area} onChange={(e)=>selectArea(e.target.value)}><option value="NCR">National Capital Region</option><option value="QUEZON_CITY">Quezon City</option>{!['NCR','QUEZON_CITY'].includes(area) && <option value={area}>{areaLabel}</option>}</select></div><div className="notice availability"><Info size={16}/><span>{notice}</span></div></section>
        {facility && view==='map' && <FacilityDetail facility={facility} result={result} week={week} onClose={()=>setFacility(null)}/>}
        <div hidden={view!=='map'}><section className="registry-summary"><div className="section-heading"><h2>Healthcare network</h2><Building2 size={18}/></div><div className="registry-count"><strong>{facilities.length}</strong><span>NCR facility records</span></div><p className="subtle">{located.length} with recorded coordinates. Locations may be provisional.</p><label htmlFor="facility-picker" className="field-label">Inspect a facility</label><select id="facility-picker" value={facility?.id??''} onChange={(e)=>setFacility(facilities.find(f=>f.id===e.target.value)??null)}><option value="">Select from the registry</option>{facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></section>{!facility && <div className="map-prompt"><MapPin size={24}/><h3>Start with a place</h3><p>Select a hospital marker or registry record to inspect its capacity and provenance.</p></div>}<div className="panel-cta"><Link href="/dashboard/simulation" className="button primary">Configure a scenario <ArrowRight size={16}/></Link><Link href="/dashboard/insights" className="text-link">View historical evidence <ArrowRight size={15}/></Link></div>{error && <p className="error" role="alert">{error}</p>}</div>
        <div hidden={view!=='simulation'}><ScenarioControls surge={surge} hospitalization={hospitalization} occupancy={occupancy} stay={stay} onChange={changeInput} onReset={reset} onRun={run} disabled={!supportsForecast || facilities.length===0} loading={loading} error={error}/></div>
        {facility && view==='simulation' && <FacilityDetail facility={facility} result={result} week={week} onClose={()=>setFacility(null)}/>}
      </aside>
    </div>
    {view==='insights' && <div className="insights-content"><div className="insight-context"><div><span className="eyebrow">CURRENT CONTEXT</span><h2>{areaLabel}</h2></div><Link href="/dashboard" className="button secondary">Change geography <ArrowRight size={16}/></Link></div><div className="insight-grid"><section className="surface evidence-panel"><div className="section-heading"><span className="icon-tile"><ChartNoAxesCombined size={21}/></span><span className="pill">Historical · 2024–2025</span></div><h2>Forecast validation</h2><p className="subtle">One-week-ahead predictions using observed preceding weeks. Not a live forecast.</p>{evidence ? <><ValidationChart validation={evidence}/><div className="notice"><strong>{evidence.better_than_seasonal_naive ? 'Outperformed the seasonal baseline.' : 'Did not beat the seasonal baseline.'}</strong><p>{evidence.caution??'Source data ends in 2025. Not a validated four-week prospective forecast.'}</p></div><p className="source-line">Source: <a href="/data/forecast-validation.json">Imported forecast validation</a></p></> : <div className="empty-state"><Info size={27}/><h3>Validation unavailable for this scope</h3><p>{notice}</p></div>}</section><section className="surface"><div className="section-heading"><span className="icon-tile"><ShieldCheck size={21}/></span><span className="pill">Human review required</span></div><h2>LGU Action Center</h2><div className="empty-state"><ShieldCheck size={32}/><h3>Evidence before recommendations.</h3><p>Recommendations will become available with a validated forecast and completed simulation. All public advisories require LGU review.</p></div><div className="notice">No automated recommendations or live hospital availability are provided by this research prototype.</div><Link href="/about" className="text-link">Read the methodology <ArrowRight size={15}/></Link></section></div><section className="surface results-panel"><div className="section-heading"><div><p className="eyebrow">SCENARIO RESULTS</p><h2>{result ? 'Simulated facility capacity' : 'Your scenario, when evidence is ready.'}</h2></div><Link href="/dashboard/simulation" className="button secondary">Scenario workspace <ArrowRight size={16}/></Link></div>{result ? <><p className="notice">{result.disclaimer}</p><div className="week-buttons" aria-label="Results week">{[1,2,3,4].map(w=><button key={w} aria-pressed={week===w} className={week===w?'active':''} onClick={()=>setWeek(w)}>Week {w}</button>)}</div><div className="table-scroll"><table><caption>Week {week} · simulated spare capacity, not live vacancy</caption><thead><tr><th>Facility</th><th>Spare capacity</th><th>Capacity gap</th><th>Note</th></tr></thead><tbody>{result.facilityResults.filter(r=>r.week===week).map(r=><tr key={r.facilityId}><td><button className="table-link" onClick={()=>setFacility(facilities.find(f=>f.id===r.facilityId)??null)}>{facilities.find(f=>f.id===r.facilityId)?.name??r.facilityId}</button></td><td>{r.availablePct===null?'Unavailable':`${r.availablePct.toFixed(1)}%`}</td><td>{r.capacityGap??'Unavailable'}</td><td>{r.note}</td></tr>)}</tbody></table></div></> : <p>Simulation results are unavailable until a dated, verified forecast and the simulation service are connected. Your configured assumptions remain available in the workspace.</p>}{facility && <FacilityDetail facility={facility} result={result} week={week} onClose={()=>setFacility(null)}/>}</section></div>}
    <div className="workspace-footer"><span><Info size={14}/> Historical-data research prototype. Not live surveillance or hospital vacancy tracking.</span><Link href="/about">Sources & limitations</Link></div>
  </div>;
}
