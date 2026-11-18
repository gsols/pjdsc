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
    if (name === 'next/navigation') return { usePathname: () => activePath, useRouter: () => ({ push() {}, prefetch() {} }) };
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

test('home has its headline and the labeled model destinations before client code', () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Dengue preparedness, connected\./);
  assert.match(html, /What would a surge<br\/>ask of our hospitals\?/);
  assert.match(html, /Explore the model\./);
  for (const [route, name] of [['/dashboard', 'Dashboard'], ['/outbreak-response', 'Simulation'], ['/research', 'Research']]) {
    assert.ok(html.includes(`href="${route}"`));
    assert.ok(html.includes(name));
  }
  assert.match(html, /aria-label="Explore SurgeWise workspaces"/);
  assert.equal((html.match(/class="home-model-part /g) ?? []).length, 3);
  assert.match(html, /An architectural illustration/);
  assert.ok(!html.includes('<footer'), 'Home is an app view, without a marketing footer');
});

test('the tile map sits behind the model and stays out of the accessibility tree', () => {
  assert.match(html, /<canvas class="home-map" aria-hidden="true"/);
  assert.match(html, /data-zooming="false"/);
  assert.ok(!html.includes('Hover or focus to explore'), 'hint removed at the user’s request');
  assert.ok(!html.includes('Illustrative:'), 'illustrative note removed at the user\u2019s request');
  assert.ok(!html.includes('home-status-bar'), "status bar removed for now, at the user's request");
  assert.ok(!html.includes('Over capacity'));
});

test('Quezon City’s outline is on the dark teal tile, not on the platform', () => {
  assert.ok(!html.includes('hm-site-city'), 'drawn on the canvas tile instead');
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
