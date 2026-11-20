import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function harness(fontsReady = Promise.resolve()) {
  let phase='loading', now=0, sequence=0;
  const timers=new Map(), effects=[], updates=[];
  const original={window:globalThis.window,document:globalThis.document};
  globalThis.window={setTimeout(callback,delay){timers.set(++sequence,{at:now+delay,callback});return sequence;},clearTimeout:id=>timers.delete(id)};
  globalThis.document={fonts:{ready:fontsReady}};
  function load(relative) {
    const filename=fileURLToPath(new URL(relative,import.meta.url));const loaded=new Module(filename);
    loaded.filename=filename;loaded.paths=require.resolve.paths('react');const native=loaded.require.bind(loaded);
    loaded.require=name=>{
      if(name==='react')return{...React,useState:()=>[phase,next=>{phase=next;updates.push(next);}],useEffect:callback=>effects.push(callback)};
      if(name==='@/components/workspace-loader')return{default:Loader};
      if(name==='@/components/surgewise-mark')return{default:Mark};
      return native(name);
    };
    loaded._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
    return loaded.exports.default;
  }
  const Mark=load('../components/surgewise-mark.tsx');
  const Loader=load('../components/workspace-loader.tsx');
  const Home=load('../components/home-workspace.tsx');
  const render=()=>renderToStaticMarkup(Home({children:React.createElement('section',null,'Constructed home content')}));
  const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
  async function advance(milliseconds) {
    const target=now+milliseconds;
    for(;;){const entry=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;
      timers.delete(entry[0]);now=entry[1].at;entry[1].callback();await flush();}
    now=target;await flush();
  }
  return{render,effects,advance,updates,timers,Loader,restore(){if(original.window===undefined)delete globalThis.window;else globalThis.window=original.window;
    if(original.document===undefined)delete globalThis.document;else globalThis.document=original.document;}};
}

test('Home starts with the real brand mark and waits until the logo has faded before enabling its animations',async()=>{
  const h=harness();
  try{
    const initial=h.render();assert.match(initial,/sw-loading-mark/);assert.ok(initial.includes('src="/brand/surgewise-mark.png"'),'loader shows the PNG brand mark');
    assert.match(initial,/data-ready="false" inert=""/);assert.match(initial,/aria-busy="true"/);
    const cleanup=h.effects[0]();await h.advance(319);assert.deepEqual(h.updates,[]);
    await h.advance(1);assert.deepEqual(h.updates,['revealing']);
    assert.match(h.render(),/data-active="false"/);assert.match(h.render(),/data-ready="false"/);
    await h.advance(200);const entered=h.render();assert.match(entered,/data-ready="true"/);assert.match(entered,/aria-busy="false"/);
    assert.ok(!entered.includes('inert=""'));cleanup();assert.equal(h.timers.size,0);
  }finally{h.restore();}
});
test('font waiting is bounded and leaving Home cancels pending entry work',async()=>{
  const h=harness(new Promise(()=>{}));
  try{
    h.render();const cleanup=h.effects[0]();await h.advance(1200);assert.deepEqual(h.updates,['revealing']);
    cleanup();await h.advance(5000);assert.deepEqual(h.updates,['revealing']);assert.equal(h.timers.size,0);
  }finally{h.restore();}
});
test('shared loading surface becomes non-interactive and hidden from assistive technology after readiness',()=>{
  const h=harness();
  try{
    const waiting=renderToStaticMarkup(React.createElement(h.Loader,{label:'Preparing map'}));
    assert.match(waiting,/role="status"/);assert.match(waiting,/data-active="true"/);assert.match(waiting,/Preparing map/);
    const done=renderToStaticMarkup(React.createElement(h.Loader,{active:false}));assert.match(done,/aria-hidden="true"/);assert.match(done,/data-active="false"/);
  }finally{h.restore();}
});
