import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function harness() {
  let stateCursor = 0, refCursor = 0, value = 'QC';
  const states = [], refs = [];
  const filename = fileURLToPath(new URL('../components/workspace-select.tsx', import.meta.url));
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.resolve.paths('react');
  loaded.require = name => name === 'react' ? { ...React,
    useId: () => 'select-fixture', useEffect() {},
    useRef(initial) { return refs[refCursor++] ??= { current: initial }; },
    useState(initial) { const i = stateCursor++; if (!(i in states)) states[i] = initial;
      return [states[i], update => { states[i] = typeof update === 'function' ? update(states[i]) : update; }]; },
  } : name.endsWith('.css') ? {} : require(name);
  loaded._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, filename);
  return {
    get value() { return value; },
    tree() { stateCursor = 0; refCursor = 0; return loaded.exports.default({ label: 'Map geography', value,
      options: [{ value: 'QC', label: 'Quezon City' }, { value: 'NCR', label: 'National Capital Region' }], onChange: next => { value = next; } }); },
    key(key) { const trigger = this.tree().props.children[0]; const event = { key, preventDefault() {}, stopPropagation() { this.stopped = true; } };
      trigger.props.onKeyDown(event); return event; },
    trigger() { return this.tree().props.children[0]; },
  };
}

test('custom geography dropdown previews via arrows and only commits on Enter', () => {
  const h = harness();
  assert.equal(h.trigger().props['aria-expanded'], false);
  h.key('ArrowDown'); h.key('ArrowDown');
  assert.equal(h.value, 'QC');
  assert.match(h.trigger().props['aria-activedescendant'], /option-1$/);
  h.key('Enter');
  assert.equal(h.value, 'NCR'); assert.equal(h.trigger().props['aria-expanded'], false);
});

test('Escape cancels without reaching the explorer Escape handler; Home/End, Tab and typeahead work', () => {
  const h = harness(); h.key('End');
  assert.equal(h.key('Escape').stopped, true); assert.equal(h.value, 'QC');
  h.key('End'); h.key('Home'); h.key('Enter'); assert.equal(h.value, 'QC');
  h.key('n'); assert.match(h.trigger().props['aria-activedescendant'], /option-1$/);
  h.key('Tab'); assert.equal(h.trigger().props['aria-expanded'], false); assert.equal(h.value, 'QC');
});
