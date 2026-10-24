'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { loadFacilities } from '@/lib/facilities';
import { parseAnnualRecords } from '@/lib/annual-burden';
import type { Facility } from '@/lib/types';
import type { AnnualRecord, ResearchRun, ResearchScenario, SpatialResult } from '@/lib/research-types';

const BarangayMap = dynamic(() => import('@/components/barangay-map'), { ssr: false });
async function read(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || data.detail?.message || data.detail?.code || `Request failed (${response.status})`);
  return data;
}
export default function Research() {
  const [annual, setAnnual] = useState<AnnualRecord[]>([]);
  const [reconciliation, setReconciliation] = useState<{ year: number; annualKnownSubtotal: number; weeklyCityTotal: number; missingBarangays: number }[]>([]);
  const [year, setYear] = useState(2024);
  const [area, setArea] = useState('QUEZON_CITY');
  const [runs, setRuns] = useState<ResearchRun[]>([]);
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
  const [scores, setScores] = useState<{ area: string; horizon: number; method: string; n: number; mae: number; rmse: number }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    read('/data/qc-annual-burden.json', { signal: controller.signal }).then(d => {
      const records = parseAnnualRecords(d.records);
      if (!Array.isArray(d.reconciliation)) throw Error('Annual reconciliation unavailable.');
      setAnnual(records); setReconciliation(d.reconciliation);
    })
      .catch(e => { if (!controller.signal.aborted) setSourceError(e.message); });
    loadFacilities(controller.signal).then(f => { setFacilities(f); }).catch(e => { if (!controller.signal.aborted) setSourceError(e.message); });
    read('/api/research/research-evidence', { signal: controller.signal }).then(d => setScores(d.backtest.scores))
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setRuns([]); setId(''); setAllocation(null);
    read(`/api/research/forecast-runs?area=${area}`, { signal: controller.signal }).then(d => {
      setRuns(d.runs); setId(d.runs.at(-1)?.id || ''); setError('');
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [area]);
  useEffect(() => {
    const controller = new AbortController();
    setAllocation(null);
    if (id && area === 'QUEZON_CITY') read(`/api/research/spatial-allocations/${id}`, { signal: controller.signal })
      .then(setAllocation).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, area]);
  useEffect(() => {
    generation.current += 1; setResult(null); setLoading(false);
  }, [id, area, normal, surge, holding, rate, los, occupancy, ack, selected]);
  const run = runs.find(r => r.id === id);
  const rec = reconciliation.find(r => r.year === year);
  const modeled = layer === 'modeled';
  const values = Object.fromEntries(annual.map(r => [r.ADM4_PCODE, modeled
    ? allocation?.records.find(a => a.ADM4_PCODE === r.ADM4_PCODE)?.expectedCases[0] ?? null
    : typeof r[`DC_${year}`] === 'number' ? r[`DC_${year}`] as number : null]));
  async function simulate() {
    const token = ++generation.current;
    setLoading(true); setResult(null); setError('');
    try {
      const data = await read('/api/research/scenarios', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ forecastRunId: id, scenarioKind: 'historical_replay', acknowledgeHypotheticalHospitalNetwork: ack,
          hospitalizationRate: rate, lengthOfStayDays: los, baselineOccupancy: occupancy, admissionDelayDays: 0,
          surgeActivationDay: 0, facilities: [{ facilityId: selected, assumedDengueEligible: true,
            normalCapacity: normal, surgeCapacity: surge, holdingCapacity: holding }] }) });
      if (token === generation.current) setResult(data);
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : 'Simulation failed'); }
    finally { if (token === generation.current) setLoading(false); }
  }
  const snapshot = result?.days[day];
  const cell = { padding: 8, textAlign: 'left' as const, borderBottom: '1px solid #284155' };
  return <main style={{ maxWidth: 1200, margin: 'auto', padding: 24 }}>
    <p><a href="/dashboard">← Hospital dashboard</a>{' · '}<a href="/outbreak-response">Open animated hotspot & hospital simulation →</a></p>
    <h1>UPRI-NOAH historical research workspace</h1>
    <p>Observed source blocks, annual barangay burden, modeled allocations and hypothetical hospital flows. Calendar alignment is unresolved; no live surveillance or vacancy reporting.</p>
    <p>Source: Matavia et al. (2026), <a href="https://github.com/pelitro-rcw/dengue-environmental-dataset/tree/02926278d570db8950da368d44db544ae0097615">pinned official dataset</a>, ODC-ODbL 1.0. Original nulls and quality flags are retained in the processed observations.</p>
    {(error || sourceError) && <p role="alert" className="notice">{sourceError} {error}</p>}
    <h2>Historical city and regional forecasts</h2>
    <label>Scope <select value={area} onChange={e => setArea(e.target.value)}><option value="QUEZON_CITY">Quezon City</option><option value="NCR">NCR</option></select></label>{' '}
    <label>Observed-through origin <select value={id} onChange={e => setId(e.target.value)}><option value="">Choose a source block</option>{runs.map(r => <option key={r.id} value={r.id}>{r.issueBlock.YR} / WN {r.issueBlock.WN}</option>)}</select></label>
    {run ? <><p>{run.availabilityAssumption} Exact issue date unavailable. Model: predeclared cases-only direct horizons; intervals not estimated.</p>
      <table><thead><tr>{['Target source block', 'Forecast cases', 'Observed cases (evaluation only)'].map(x => <th style={cell} key={x}>{x}</th>)}</tr></thead><tbody>
        {run.weeklyPredictions.map(p => <tr key={`${p.YR}-${p.WN}`}><td style={cell}>{p.YR} / {p.WN}</td><td style={cell}>{p.meanCases.toFixed(2)}</td><td style={cell}>{p.observedCases}</td></tr>)}
      </tbody></table><p className="subtle">Workbook SHA-256: {run.sourceSha256}</p></> : <p>No approved run loaded. Configure the research engine to enable forecasts.</p>}
    <details><summary>Backtest evidence and limitations</summary><p>Eight expanding quarterly origins per area, 2024–2025 retrospective comparison. Matched targets for all methods. Publication delay unknown; no prospective skill or interval coverage claim. NCR missing 2020–2021 are never zeros.</p>
      <table><thead><tr>{['Horizon', 'Method', 'n', 'MAE cases', 'RMSE cases'].map(x => <th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>{scores.filter(s => s.area === area).map(s => <tr key={`${s.horizon}-${s.method}`}><td style={cell}>{s.horizon}</td><td style={cell}>{s.method}</td><td style={cell}>{s.n}</td><td style={cell}>{s.mae.toFixed(2)}</td><td style={cell}>{s.rmse.toFixed(2)}</td></tr>)}</tbody></table>
    </details>
    <h2>QC barangay burden</h2>
    <label>Map layer <select value={layer} onChange={e => setLayer(e.target.value)}><option value="observed">Observed annual cases</option><option value="modeled" disabled={!allocation || area !== 'QUEZON_CITY'}>Modeled first-week allocation</option></select></label>{' '}
    <label>Observed year <select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 16 }, (_, i) => i + 2010).map(y => <option key={y}>{y}</option>)}</select></label>
    <p>{modeled ? `Modeled first-week expected cases; weight year ${allocation?.weightYear ?? 'unavailable'}. ${allocation?.caveat ?? 'QC run required.'}` : `Observed ${year} annual cases, without population normalization. These are not weekly observations.`}</p>
    {rec && <p>Annual known subtotal: {rec.annualKnownSubtotal}; missing barangays: {rec.missingBarangays}; city weekly sum: {rec.weeklyCityTotal}. Sources disagree; neither is overwritten.</p>}
    <BarangayMap values={values} modeled={modeled} />
    <details><summary>All 142 barangays / map fallback table</summary><div style={{ maxHeight: 360, overflow: 'auto' }}><table><thead><tr><th style={cell}>Source barangay / ID</th><th style={cell}>{modeled ? 'Allocated first-week cases' : `Observed annual cases (${year})`}</th></tr></thead><tbody>{annual.map(r => <tr key={r.ADM4_PCODE}><td style={cell}>{r.Barangay} / {r.ADM4_PCODE}</td><td style={cell}>{values[r.ADM4_PCODE]?.toFixed(2) ?? 'Missing'}</td></tr>)}</tbody></table></div></details>
    <h2>28-day admissions and overflow</h2>
    <p>QC-only expected-value simulation. Individual hospital selection and every capacity below are hypothetical assumptions. The 2026 PhilHealth inventory supplies identity only; accredited beds are not dengue-usable capacity. No historical hospital occupancy is observed.</p>
    <label>Hypothetical facility <select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose a hospital</option>{facilities.map(f => <option key={f.id} value={f.id}>{f.id} — {f.name}</option>)}</select></label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '16px 0' }}>
      {([{ label: 'Assumed normal staffed beds', value: normal, set: setNormal, min: 1, max: 10000, step: 1 },
        { label: 'Assumed supported surge beds', value: surge, set: setSurge, min: 0, max: 10000, step: 1 },
        { label: 'Assumed unstaffed holding spaces', value: holding, set: setHolding, min: 0, max: 10000, step: 1 },
        { label: 'Assumed admission fraction', value: rate, set: setRate, min: 0, max: 1, step: .01 },
        { label: 'Assumed LOS (days)', value: los, set: setLos, min: 1, max: 30, step: 1 },
        { label: 'Assumed non-dengue occupancy fraction', value: occupancy, set: setOccupancy, min: 0, max: 1, step: .05 }]).map(f => <label key={f.label}>{f.label}<br /><input type="number" value={f.value} min={f.min} max={f.max} step={f.step} onChange={e => f.set(Number(e.target.value))} style={{ width: 100 }} /></label>)}
    </div>
    <label><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> I assume this selected hospital can admit dengue patients with the configured resources; this is unverified, including at the historical origin.</label>
    <p>Fixed assumptions: zero initial dengue census, no admission delay, surge available from day 0, uniform daily distribution of weekly cases. LOS starts on supported placement; holding waits. Unresolved patients exit the modeled system.</p>
    <p><button className="btn" disabled={!run || area !== 'QUEZON_CITY' || !selected || !ack || loading || !!sourceError} onClick={simulate}>{loading ? 'Computing…' : 'Run hypothetical capacity replay'}</button></p>
    {result && snapshot && <><p>{result.disclaimer}</p><label>Day {day} <input aria-label="Simulation day" type="range" min={0} max={28} value={day} onChange={e => setDay(Number(e.target.value))} /></label>{[0, 7, 14, 28].map(d => <button key={d} onClick={() => setDay(d)}>Day {d}</button>)}
      <p>Expected cumulative admissions demand: {snapshot.cumulativeArrivals.toFixed(2)} · Discharged: {snapshot.cumulativeDischarges.toFixed(2)} · Supported census: {snapshot.supportedCensus.toFixed(2)} · Unstaffed holding: {snapshot.holdingCensus.toFixed(2)} · Cumulative unresolved: {snapshot.cumulativeUnresolved.toFixed(2)}</p>
      {snapshot.facilities.map(f => <p key={f.facilityId}>{f.facilityId}: occupancy relative to normal {f.normalOccupancyPct.toFixed(1)}%; relative to supported {f.supportedOccupancyPct.toFixed(1)}%; supported surge placements {f.surgeDengueCensus.toFixed(2)}; holding {f.holdingCensus.toFixed(2)}.</p>)}
      <p>{result.assumptions}</p><a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`} download={`${result.scenarioId}.json`}>Export reproducible scenario</a></>}
  </main>;
}
