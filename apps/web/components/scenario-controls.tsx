'use client';
import { RotateCcw, Play, LoaderCircle } from 'lucide-react';
type Props = {
  surge: number; hospitalization: number; occupancy: number; stay: number;
  onChange: (field: 'surge' | 'hospitalization' | 'occupancy' | 'stay', value: number) => void;
  onReset: () => void; onRun: () => void; disabled: boolean; loading: boolean; error: string;
};
export default function ScenarioControls(props: Props) {
  const controls = [
    { key:'surge' as const, label:'Case surge', description:'Additional cases · stress test only', min:0, max:100, step:10, unit:'%', prefix:'+' },
    { key:'hospitalization' as const, label:'Hospitalization rate', description:'Assumed share of reported cases admitted', min:5, max:40, step:5, unit:'%', prefix:'' },
    { key:'occupancy' as const, label:'Occupancy', description:'Other occupied beds · non-dengue baseline', min:40, max:95, step:5, unit:'%', prefix:'' },
    { key:'stay' as const, label:'Length of stay', description:'Illustrative fixed mean duration', min:1, max:10, step:1, unit:' days', prefix:'' },
  ];
  function field(control: typeof controls[number]) {
    return <div className="field" key={control.key}><div className="range-row"><label htmlFor={`scenario-${control.key}`}>{control.label}</label><output htmlFor={`scenario-${control.key}`}>{control.prefix}{props[control.key]}{control.unit}</output></div><p className="field-description">{control.description}</p><input id={`scenario-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={props[control.key]} onChange={(e)=>props.onChange(control.key,Number(e.target.value))}/><div className="range-limits"><span>{control.min}{control.unit}</span><span>{control.max}{control.unit}</span></div></div>;
  }
  return <section className="scenario-controls" aria-labelledby="scenario-heading"><div className="section-heading"><div><p className="eyebrow">02 / CONFIGURE</p><h2 id="scenario-heading">Scenario assumptions</h2></div><button className="icon-button" aria-label="Reset scenario assumptions" title="Reset to original defaults" onClick={props.onReset}><RotateCcw size={16}/></button></div>{controls.slice(0,2).map(field)}<details className="advanced-settings" open><summary>Capacity & length of stay<span>2 assumptions</span></summary>{controls.slice(2).map(field)}</details><button className="button primary run-button" disabled={props.disabled || props.loading} onClick={props.onRun}>{props.loading ? <LoaderCircle className="spin" size={17}/> : <Play size={16}/>} {props.loading ? 'Checking scenario…' : 'Run baseline scenario'}</button><div className="notice">The simulator is intentionally gated until verified facilities and saved weekly case forecasts are imported. No invented bed counts or case projections are displayed.</div>{props.error && <p className="error" role="alert">{props.error}</p>}</section>;
}
