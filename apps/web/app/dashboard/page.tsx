'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import type {Facility,ScenarioResult} from '@/lib/types';
const NCRMap=dynamic(()=>import('@/components/ncr-map'),{ssr:false,loading:()=> <div style={{padding:28}}>Loading geographic map…</div>});
export default function Dashboard(){
 const [area,setArea]=useState('NCR');const [facility,setFacility]=useState<Facility|null>(null);
 const [facilities,setFacilities]=useState<Facility[]>([]);const [surge,setSurge]=useState(0);const [hospitalization,setHospitalization]=useState(15);
 const [occupancy,setOccupancy]=useState(75);const [stay,setStay]=useState(4);const [week,setWeek]=useState(1);
 const [result,setResult]=useState<ScenarioResult|null>(null);const [error,setError]=useState('');
 useEffect(()=>{fetch('/data/facilities.json').then(r=>r.json()).then(x=>setFacilities(Array.isArray(x)?x:[])).catch(()=>setError('Facility registry could not be loaded.'));},[]);
 const supportsForecast=area==='NCR'||area==='QUEZON_CITY';
 async function run(){setError('');setResult(null);
  if(!supportsForecast)return;
  try{const response=await fetch('/api/simulate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({area,forecastRunId:null,surgeMultiplier:1+surge/100,hospitalizationRate:hospitalization/100,baselineOccupancy:occupancy/100,lengthOfStayDays:stay,facilities})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Simulation failed');setResult(data);}
  catch(e){setError(e instanceof Error?e.message:'Simulation error');}
 }
 const active=result?.facilityResults.find(x=>x.facilityId===facility?.id&&x.week===week);
 function selectArea(next:string){setArea(next);setFacility(null);setResult(null);setWeek(1);}
 return <><header className="header"><div><div className="brand">PJDSC <span>/ DENGUE INTELLIGENCE</span></div><div className="subtle">NCR Preparedness Research Prototype</div></div><span className="pill">Historical-data MVP</span></header>
 <main className="layout"><section className="map-section"><NCRMap selectedArea={area} onAreaSelect={selectArea} facilities={facilities} onFacilitySelect={setFacility} activeWeek={week} result={result}/>
 <div className="map-toolbar"><strong>NCR Healthcare Geography</strong><div className="subtle">Select a city boundary or hospital marker</div><div className="legend"><span><i className="dot" style={{background:'#51d0bb'}}/>QC supported</span><span><i className="dot" style={{background:'#8ea4b3'}}/>Other NCR cities</span><span><i className="dot" style={{background:'#ffb45d'}}/>Facility</span></div></div>
 {result&&<div className="timeline"><strong>Simulation week</strong>{[1,2,3,4].map(w=><button key={w} className={week===w?'active':''} onClick={()=>setWeek(w)}>Week {w}</button>)}</div>}
 </section><aside className="panel"><h1>Scenario Workspace</h1><div className="subtle">Choose location, review availability, configure assumptions</div>
 <div className="field"><label>Selected geography</label><select value={area} onChange={e=>selectArea(e.target.value)}><option value="NCR">National Capital Region</option><option value="QUEZON_CITY">Quezon City</option>{!['NCR','QUEZON_CITY'].includes(area)&&<option value={area}>{area}</option>}</select></div>
 <div className="notice">{supportsForecast?area==='NCR'?'NCR historical weekly series available; model integration pending.':'Quezon City historical weekly series available; model integration pending.':'Dedicated city-level case forecasting is unavailable. NCR facilities remain explorable.'}</div>
 <h2>Baseline configuration</h2>
 <div className="field"><label>Case surge (stress test only)</label><div className="range-row"><span>Additional cases</span><strong>+{surge}%</strong></div><input aria-label="Case surge" type="range" min="0" max="100" step="10" value={surge} onChange={e=>{setSurge(Number(e.target.value));setResult(null)}}/></div>
 <div className="field"><label>Hospitalization assumption</label><div className="range-row"><span>Reported cases admitted</span><strong>{hospitalization}%</strong></div><input aria-label="Hospitalization rate" type="range" min="5" max="40" step="5" value={hospitalization} onChange={e=>{setHospitalization(Number(e.target.value));setResult(null)}}/></div>
 <div className="field"><label>Other occupied beds assumption</label><div className="range-row"><span>Non-dengue baseline</span><strong>{occupancy}%</strong></div><input aria-label="Occupancy" type="range" min="40" max="95" step="5" value={occupancy} onChange={e=>{setOccupancy(Number(e.target.value));setResult(null)}}/></div>
 <div className="field"><label>Mean length of stay</label><div className="range-row"><span>Illustrative fixed duration</span><strong>{stay} days</strong></div><input aria-label="Length of stay" type="range" min="1" max="10" value={stay} onChange={e=>{setStay(Number(e.target.value));setResult(null)}}/></div>
 <button className="btn" disabled={!supportsForecast||facilities.length===0} onClick={run}>Run baseline scenario</button>
 <div className="notice">The simulator is intentionally gated until verified facilities and saved weekly case forecasts are imported. No invented bed counts or case projections are displayed.</div>
 {error&&<p className="error">{error}</p>}
 {facility&&<section className="facility"><h3>{facility.name}</h3><div className="subtle">{facility.city} · {facility.latitude === null || facility.longitude === null ? 'Coordinates not verified' : `${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}` }</div><p>Authorized beds: <strong>{facility.authorizedBeds??'Not verified'}</strong></p><div className="subtle">Source: {facility.source}</div>{active&&<p>Projected available: {active.availablePct===null?'Unavailable':active.availablePct.toFixed(1)+'%'}</p>}</section>}
 <h2>LGU Action Center</h2><div className="notice">Recommendations will become available with a validated forecast and completed simulation. All public advisories require LGU review.</div></aside></main></>;
}
