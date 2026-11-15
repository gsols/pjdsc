import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

const filename = fileURLToPath(new URL('../components/outbreak-map.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const require = createRequire(import.meta.url);
const context = { barangays: [{ id: 'A', name: 'Constructed place', coordinates: [121.03,14.65], nearestHospitals: [{ facilityId: 'H2', distanceKm: 1 }] }],
  hospitals: ['H1','H2'].map(id => ({ id, name: `Constructed hospital ${id}`, coordinates: [121.03,14.65] })) };
const props = { context, snapshot: null, selected: 'A', selectedHospital: '', hotspotIds: ['A'], rankedHotspotIds: ['A'], reducedMotion: false,
  view: 'qc', connectionFocus: null, onSelect() {}, onHospital() {} };

function harness() {
  const fits = [], markers = [], sources = new Map(), refs = [], effects = [], states = [], listeners = new Map();
  const root = { clientWidth:1000,clientHeight:700,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700}), closest:()=>({querySelectorAll:()=>[]}) };
  const map = { fitBounds: (bounds, options) => fits.push(options), resize(){}, addControl(){},remove(){}, getContainer:()=>root, project:()=>({x:500,y:350}),
    unproject:()=>({toArray:()=>[121.03,14.65]}), on(name,callback){listeners.set(name,callback);},once(name,callback){listeners.set(name,callback);},off(name){listeners.delete(name);},loaded:()=>false,setFilter(){},
    getSource:id=>({setData(data){sources.set(id,data);}}) };
  class Marker {
    constructor({element}) { this.element=element;markers.push(this); }
    setLngLat(){return this;} addTo(){return this;} getElement(){return this.element;}
    setOffset(offset){this.offset=offset;return this;} remove(){}
  }
  let refIndex=0,stateIndex=0;
  const loaded = new Module(filename);loaded.filename=filename;loaded.paths=require.resolve.paths('react');
  const native=loaded.require.bind(loaded);
  loaded.require=name=>{
    if(name==='react')return{...React,useRef:value=>{const index=refIndex++;return refs[index]??={current:index===0?root:index===1?map:value};},
      useState:value=>{const index=stateIndex++;return[index===0?true:value,next=>states.push([index,next])];},useEffect:(callback,dependencies)=>effects.push({callback,dependencies})};
    if(name==='maplibre-gl')return{default:{Marker,Map:class{constructor(){return map;}},ScaleControl:class{}}};
    if(name==='@/components/workspace-loader')return{default:()=>null};
    if(name.endsWith('.css'))return{};
    if(name.startsWith('@/lib/'))return require(`./${name.slice('@/lib/'.length)}.ts`);
    return native(name);
  };
  loaded._compile(compiled,filename);
  const render=values=>{refIndex=stateIndex=0;effects.length=0;loaded.exports.default(values);return effects;};
  const camera=()=>effects.find(e=>e.dependencies?.includes('qc')&&e.callback.toString().includes('initialCameraReady'));
  const markerEffect=()=>effects.find(e=>e.dependencies?.filter(d=>d==='A').length>=2);
  return{fits,markers,sources,states,listeners,render,camera,markerEffect};
}

test('startup camera completes before marker layout, with no animated intermediate fit',()=>{
  const h=harness();
  let effects=h.render({...props,context:null});const first=h.camera();first.callback();
  assert.equal(h.fits.at(-1).duration,0,'fallback extent must not begin an animation');
  effects=h.render(props);
  assert.ok(effects.indexOf(h.camera())<effects.indexOf(h.markerEffect()),'first source-aware camera fit must precede marker layout');
  assert.deepEqual(h.camera().dependencies,first.dependencies,'asynchronous scenario context must not refit an already visible map');
});

test('initial map errors dismiss the loading surface so the existing fallback stays usable',()=>{
  const previous={window:globalThis.window,observer:globalThis.ResizeObserver};
  globalThis.window={setTimeout:()=>1,clearTimeout(){}};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  try{
    const statuses=[];const h=harness();const effects=h.render({...props,onStatus:value=>statuses.push(value)});
    const cleanup=effects.find(effect=>effect.dependencies?.length===0).callback();
    h.listeners.get('error')();
    assert.deepEqual(statuses,['unavailable']);
    assert.ok(h.states.some(([index,value])=>index===1&&typeof value==='string'&&value.length),'error state must make the shared loader inactive');
    cleanup();
  }finally{if(previous.window===undefined)delete globalThis.window;else globalThis.window=previous.window;
    if(previous.observer===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=previous.observer;}
});

test('opening reveals only after the settled-map idle event and does not restart on scenario updates',()=>{
  const previousWindow=globalThis.window,previousCancel=globalThis.cancelAnimationFrame;
  const timers=new Map();globalThis.window={setTimeout:callback=>{timers.set(1,callback);return 1;},clearTimeout:id=>timers.delete(id)};
  globalThis.cancelAnimationFrame=()=>{};
  try{
    const ready=[];const h=harness();let effects=h.render({...props,onStatus:value=>ready.push(value)});
    const effect=effects.find(e=>e.dependencies?.length===1&&e.dependencies[0]===true);
    const cleanup=effect.callback();
    assert.deepEqual(ready,[]);assert.deepEqual(h.states,[]);
    const idle=h.listeners.get('idle');assert.equal(typeof idle,'function');idle();
    assert.deepEqual(ready,['ready']);assert.ok(h.states.some(([index,value])=>index===2&&value===true));
    assert.equal(timers.size,0,'revealing must cancel the startup deadline');
    effects=h.render({...props,snapshot:{assignments:[]}});
    assert.deepEqual(effects.find(e=>e.dependencies?.length===1&&e.dependencies[0]===true).dependencies,effect.dependencies);
    cleanup();idle();assert.equal(ready.length,1,'late readiness must not update an unmounted map');
  }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=previousCancel;}
});

test('hover, focus and explicit inspection never draw extra marker guide lines',()=>{
  const previousDocument=globalThis.document,previousObserver=globalThis.ResizeObserver;
  globalThis.document={createElement:()=>({dataset:{},style:{},children:[],listeners:{},append(child){this.children.push(child);},
    setAttribute(){},addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);},dispatch(name){for(const callback of this.listeners[name]??[])callback();}})};
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  try{
    const h=harness();h.render(props);let cleanup=h.markerEffect().callback();
    const hospital=h.markers.find(m=>m.element.dataset.facilityId==='H2');
    assert.ok(hospital.offset.some(value=>Math.abs(value)>2),'fixture must exercise an offset hospital');
    assert.equal(h.sources.has('marker-leaders'),false);
    hospital.element.dispatch('pointerenter');hospital.element.dispatch('focus');
    assert.equal(h.sources.has('marker-leaders'),false,'hover/focus must never expose guide lines');
    cleanup();h.render({...props,connectionFocus:'hospital',selectedHospital:'H2'});cleanup=h.markerEffect().callback();
    assert.equal(h.sources.has('marker-leaders'),false,'inspection must not add unrelated point-guide lines');
    cleanup();
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(previousObserver===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=previousObserver;}
});
