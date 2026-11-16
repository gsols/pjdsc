import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
let activePath = '/';
function load(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = require.resolve.paths('react');
  loaded.require = name => {
    if (name === 'next/link') return { default: ({ children, prefetch, ...props }) => {
      void prefetch;
      return React.createElement('a', props, children);
    } };
    if (name === 'next/navigation') return { usePathname: () => activePath };
    if (name.endsWith('.css')) return {};
    if (name.startsWith('@/')) return load(`../${name.slice(2)}${name.startsWith('@/lib/') ? '.ts' : '.tsx'}`);
    return require(name);
  };
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}

const Home = load('../app/page.tsx').default;
const Navigation = load('../components/app-navigation.tsx').default;
const html = renderToStaticMarkup(React.createElement(Home));

test('home has labeled model destinations before client code or engine readiness', () => {
  for (const [route, name] of [['/dashboard', 'Dashboard'], ['/outbreak-response', 'Simulation'], ['/research', 'Research']]) {
    assert.ok(html.includes(`href="${route}"`));
    assert.ok(html.includes(name));
  }
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /aria-label="Explore SurgeWise workspaces"/);
  assert.equal((html.match(/class="home-model-part /g) ?? []).length, 3);
  assert.ok(!html.includes('<footer'), 'Home is an app view, without a marketing footer');
});

test('conceptual navigation model cannot be mistaken for observed facility or occupancy data', () => {
  assert.match(html, /An architectural illustration/);
  assert.match(html, /Hypothetical scenarios/);
  assert.match(html, /No live surveillance or hospital bed availability/);
  assert.ok(!html.includes('Over capacity'));
  assert.ok(!html.includes('<canvas'), 'Home does not require a geographic map');
  assert.ok(!html.includes('lp-city-'));
});

test('persistent navigation identifies each current route including the simulation alias', () => {
  for (const [path, label] of [['/', 'Home'], ['/dashboard', 'Dashboard'], ['/outbreak-response', 'Simulation'], ['/simulate', 'Simulation'], ['/research', 'Research']]) {
    activePath = path;
    const nav = renderToStaticMarkup(React.createElement(Navigation));
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(nav, new RegExp(`aria-label="${label}" aria-current="page"`));
    assert.equal((nav.match(/role="tooltip"/g) ?? []).length, 4);
    assert.ok(!nav.includes('title='), 'navigation uses custom descriptions, not browser title tooltips');
    assert.ok(!nav.includes('sw-nav-label'), 'rail is icons-only');
    assert.ok(!nav.includes('QC / PH'));
  }
});

test('Home uses the shared light appearance without an isolated theme control', () => {
  assert.ok(!html.includes('Home theme'));
  assert.ok(!html.includes('data-theme="dark"'));
  assert.ok(!html.includes('Pause model animation'));
  assert.ok(!html.includes('home-model-index'));
  assert.ok(!html.includes('Conceptual model · Not a real facility'));
});
