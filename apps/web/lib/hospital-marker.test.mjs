import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hospitalMarker } from './hospital-marker.ts';

test('shared hospital marker has a provisional accessible name and explicit selection/motion state', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => ({ tag, dataset:{}, children:[], attrs:{},
    append(child) { this.children.push(child); }, setAttribute(key,value) { this.attrs[key]=value; } }) };
  try {
    const marker = hospitalMarker('Constructed hospital fixture',true,true);
    assert.equal(marker.tag,'button'); assert.equal(marker.type,'button');
    assert.match(marker.attrs['aria-label'],/provisional point, unverified entrance/);
    assert.equal(marker.attrs['aria-pressed'],'true');
    assert.equal(marker.dataset.selected,'true'); assert.equal(marker.dataset.reducedMotion,'true');
    const image = marker.children[0].children[0];
    assert.equal(image.src,'/brand/hospital-pin.svg'); assert.equal(image.alt,'');
    assert.equal(marker.children[1].attrs['aria-hidden'],'true');
    const plain = hospitalMarker('Constructed hospital fixture',false);
    assert.equal(plain.attrs['aria-pressed'],'false'); assert.equal(plain.dataset.reducedMotion,'false');
  } finally { if(previous === undefined)delete globalThis.document;else globalThis.document=previous; }
});
