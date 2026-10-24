'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Facility, ScenarioResult } from '@/lib/types';
import { loadFacilities, FACILITY_DATASET_ID } from '@/lib/facilities';
import { ArrowUpRight, Play } from 'lucide-react';
import FloatingMapPanel from '@/components/floating-map-panel';
import './dashboard.css';
const NCRMap = dynamic(() => import('@/components/ncr-map'), {
  ssr: false,
  loading: () => <div style={{ padding: 28 }}>Loading geographic map...</div>,
});
export default function Dashboard() {
  const [area, setArea] = useState('QUEZON_CITY');
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surge, setSurge] = useState(0);
  const [hospitalization, setHospitalization] = useState(15);
  const [occupancy, setOccupancy] = useState(75);
  const [stay, setStay] = useState(4);
  const [week, setWeek] = useState(1);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const [facilityError, setFacilityError] = useState('');
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [query, setQuery] = useState('');
  const [ownership, setOwnership] = useState('ALL');
  const [validation, setValidation] = useState<
    Array<{
      area: string;
      model_mae: number;
      seasonal_naive_mae: number;
      better_than_seasonal_naive: boolean;
    }>
  >([]);
  useEffect(() => {
    const controller = new AbortController();
    loadFacilities(controller.signal)
      .then(setFacilities)
      .catch((e) => {
        if (!controller.signal.aborted) setFacilityError(e instanceof Error ? e.message : 'QC facility registry unavailable.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingFacilities(false); });
    return () => controller.abort();
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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Simulation failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation error');
    }
  }
  const filteredFacilities = facilities.filter(f =>
    (ownership === 'ALL' || f.ownership === ownership) &&
    `${f.name} ${f.id} ${f.address}`.toLowerCase().includes(query.toLowerCase())
  );
  const active = result?.facilityResults.find(
    (x) => x.facilityId === facility?.id && x.week === week
  );
  function selectArea(next: string) {
    setArea(next);
    setFacility(null);
    setResult(null);
    setWeek(1);
  }
  return (
    <>
      <header className="header dashboard-header">
        <div>
          <div className="brand">
            SurgeWise
          </div>
          <div className="subtle">NCR Preparedness Research Prototype</div>
        </div>
        <a className="pill" href="/outbreak-response">Open animated simulation</a>
      </header>
      <main className="layout dashboard-map-layout">
        <section className="map-section">
          <NCRMap
            selectedArea={area}
            onAreaSelect={selectArea}
            facilities={showHospitals && area === 'QUEZON_CITY' ? filteredFacilities : []}
            onFacilitySelect={setFacility}
            activeWeek={week}
            result={result}
          />
          <div className="map-toolbar">
            <strong>NCR Healthcare Geography</strong>
            <div className="subtle">
              Select a city boundary or hospital marker
            </div>
            <div className="legend">
              <span>
                <i className="dot" style={{ background: '#51d0bb' }} />
                QC city boundary
              </span>
              <span>
                <i className="dot" style={{ background: '#8ea4b3' }} />
                Other NCR cities
              </span>
              <span>
                <i className="dot" style={{ background: '#ffb45d' }} />
                Provisional QC hospital point
              </span>
            </div>
          </div>
          <section className="dashboard-simulation-launch" aria-label="QC simulation workspace">
            <span>Explore a preparedness scenario</span>
            <h2>What happens when cases rise?</h2>
            <p>Explore QC forecasts, hospital strain and capacity scenarios.</p>
            <a href="/outbreak-response"><span><Play size={17} /> Open QC simulation</span><ArrowUpRight size={19} /></a>
            <small>Historical forecasts · Assumed hospital capacity · Research use</small>
          </section>
          {result && (
            <div className="timeline">
              <strong>Simulation week</strong>
              {[1, 2, 3, 4].map((w) => (
                <button
                  key={w}
                  className={week === w ? 'active' : ''}
                  onClick={() => setWeek(w)}
                >
                  Week {w}
                </button>
              ))}
            </div>
          )}
        </section>
        <FloatingMapPanel revealKey={facility?.id}>
        <aside className="panel">
          <h1>Geography & hospitals</h1>
          <div className="subtle">
            Inspect the network, filter map markers and review source records
          </div>
          <div className="field">
            <label htmlFor="selected-area">Selected geography</label>
            <select id="selected-area" value={area} onChange={(e) => selectArea(e.target.value)}>
              <option value="NCR">National Capital Region</option>
              <option value="QUEZON_CITY">Quezon City</option>
              {!['NCR', 'QUEZON_CITY'].includes(area) && (
                <option value={area}>{area}</option>
              )}
            </select>
          </div>
          <div className="notice">
            {supportsForecast
              ? area === 'NCR'
                ? 'NCR source-block forecast replays are available in the UPRI research workspace. No NCR hospital network; QC beds cannot absorb NCR demand.'
                : 'QC source-block forecasts, annual barangay maps and hypothetical capacity replay are available in the UPRI research workspace. Exact calendar alignment remains unresolved.'
              : 'Dedicated city-level case forecasting is unavailable. Hospital inventory covers QC only.'}
          </div>
          {validation
            .filter((v) => v.area === area)
            .map((v) => (
              <section className="notice" key={v.area}>
                <strong>Legacy stored evaluation (2024-2025; source version unverified)</strong>
                <p>
                  One-week-ahead error: {v.model_mae.toFixed(1)} cases/week
                  (seasonal baseline: {v.seasonal_naive_mae.toFixed(1)}).{' '}
                  {v.better_than_seasonal_naive
                    ? 'Outperformed baseline.'
                    : 'Did not beat baseline.'}{' '}
                  Stored evaluation: forecast-validation.json. Its ISO-week assumption conflicts with source metadata, and source hashes are absent. See the UPRI workspace for newly audited source-block comparisons. Not a live forecast.
                </p>
              </section>
            ))}
          <h2>QC hospital inventory</h2>
          <div className="notice" aria-live="polite">
            {loadingFacilities ? 'Validating QC hospital registry...' : facilityError ? 'QC hospital inventory unavailable.' : `${facilities.length} source-reported hospitals/infirmaries | ${facilities.reduce((sum, f) => sum + f.accreditedBeds, 0).toLocaleString()} accredited beds`}
            <p>PhilHealth register as of 2026-09-30. Units: records / accredited beds; geography: QC. All points provisional; zero independently verified entrances. No vacancy or dengue service claim.</p>
            <details><summary>Dataset version</summary>{FACILITY_DATASET_ID}</details>
          </div>
          {facilityError && <p className="error" role="alert">{facilityError}</p>}
          <div className="field">
            <label><input type="checkbox" checked={showHospitals} onChange={e => setShowHospitals(e.target.checked)} /> Show provisional QC hospital points</label>
            {area !== 'QUEZON_CITY' && <p className="subtle">Select QC to show its hospital markers. NCR polygons remain available.</p>}
            <label htmlFor="hospital-search">Search hospital name, local ID or address</label>
            <input id="hospital-search" type="search" value={query} onChange={e => setQuery(e.target.value)} />
            <label htmlFor="ownership">Ownership (source-reported)</label>
            <select id="ownership" value={ownership} onChange={e => setOwnership(e.target.value)}>
              <option value="ALL">All ownership</option>
              {Array.from(new Set(facilities.map(f => f.ownership))).sort().map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <details className="notice" open>
            <summary>Hospital table / map fallback ({filteredFacilities.length} records)</summary>
            <div className="hospital-table"><table>
              <caption>QC only | source-reported accredited beds, 2026-09-30</caption>
              <thead><tr><th scope="col">Hospital / local ID</th><th scope="col">Beds</th></tr></thead>
              <tbody>{filteredFacilities.map(f => <tr key={f.id}><td><button className="text-button" onClick={() => setFacility(f)}>{f.name}</button><div className="subtle">{f.id} | {f.ownership} | {f.philHealthCategory}</div></td><td>{f.accreditedBeds}</td></tr>)}</tbody>
            </table></div>
            {!loadingFacilities && !facilityError && filteredFacilities.length === 0 && <p>No matching hospitals.</p>}
          </details>
          <div className="notice">Annual QC barangay observations and archive-derived polygons are available in the <a href="/research">UPRI workspace</a>. Weekly spatial splits there are modeled allocations, not observed hotspots. The 70 supplementary maternity/lying-in records remain excluded from this hospital network.</div>
          <h2>Baseline configuration</h2>
          <div className="field">
            <label>Case surge (stress test only)</label>
            <div className="range-row">
              <span>Additional cases</span>
              <strong>+{surge}%</strong>
            </div>
            <input
              aria-label="Case surge"
              type="range"
              min="0"
              max="100"
              step="10"
              value={surge}
              onChange={(e) => {
                setSurge(Number(e.target.value));
                setResult(null);
              }}
            />
          </div>
          <div className="field">
            <label>Hospitalization assumption</label>
            <div className="range-row">
              <span>Reported cases admitted</span>
              <strong>{hospitalization}%</strong>
            </div>
            <input
              aria-label="Hospitalization rate"
              type="range"
              min="5"
              max="40"
              step="5"
              value={hospitalization}
              onChange={(e) => {
                setHospitalization(Number(e.target.value));
                setResult(null);
              }}
            />
          </div>
          <div className="field">
            <label>Other occupied beds assumption</label>
            <div className="range-row">
              <span>Non-dengue baseline</span>
              <strong>{occupancy}%</strong>
            </div>
            <input
              aria-label="Occupancy"
              type="range"
              min="40"
              max="95"
              step="5"
              value={occupancy}
              onChange={(e) => {
                setOccupancy(Number(e.target.value));
                setResult(null);
              }}
            />
          </div>
          <div className="field">
            <label>Mean length of stay</label>
            <div className="range-row">
              <span>Illustrative fixed duration</span>
              <strong>{stay} days</strong>
            </div>
            <input
              aria-label="Length of stay"
              type="range"
              min="1"
              max="10"
              value={stay}
              onChange={(e) => {
                setStay(Number(e.target.value));
                setResult(null);
              }}
            />
          </div>
          <button
            className="btn"
            disabled={true}
            onClick={run}
          >
            Run baseline scenario
          </button>
          <div className="notice">
            Use the UPRI workspace for source-block replay with explicit hypothetical dengue eligibility/staffed-capacity assumptions. This legacy panel stays guarded. Accredited beds are not operational capacity; these sliders are illustrative assumptions.
          </div>
          {error && <p className="error">{error}</p>}
          {facility && (
            <section className="facility">
              <h3>{facility.name}</h3>
              <div className="subtle">
                {facility.city}  | {' '}
                {facility.latitude === null || facility.longitude === null
                  ? 'Coordinates not verified'
                  : `${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`}
              </div>
              <p>
                Source-reported accredited beds (2026-09-30):{' '}
                <strong>{facility.accreditedBeds.toLocaleString()}</strong>
              </p>
              <div className="subtle">
                Coordinate status:{' '}
                {facility.coordinateStatus === 'PROVISIONAL_HISTORICAL_MATCH'
                  ? 'Provisional point; entrance not independently verified'
                  : facility.coordinateStatus === 'VERIFIED'
                    ? 'Verified location'
                    : 'Location unavailable'}{' '}
                 |  Evidence: {facility.coordinateEvidenceStatus}
              </div>
              <p className="subtle">{facility.id} is a local source-row ID. {facility.address}</p>
              <p className="subtle">Staffed beds, dengue capacity and dengue eligibility: unknown.</p>
              <p><a href={facility.primarySourceUrl} target="_blank" rel="noreferrer">PhilHealth register</a>{' | '}<a href={facility.coordinateSourceUrl} target="_blank" rel="noreferrer">Coordinate evidence</a></p>
              {active && (
                <p>
                  Projected available:{' '}
                  {active.availablePct === null
                    ? 'Unavailable'
                    : active.availablePct.toFixed(1) + '%'}
                </p>
              )}
            </section>
          )}
          <h2>LGU Action Center</h2>
          <div className="notice">
            Recommendations will become available with a validated forecast and
            completed simulation. All public advisories require LGU review.
          </div>
        </aside>
        </FloatingMapPanel>
      </main>
    </>
  );
}
