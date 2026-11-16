import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulationMapPadding, selectionMapBounds } from './simulation-map.ts';

test('wide status overlays reserve the top of the map, without consuming its left side', () => {
  const padding = simulationMapPadding(1000,700,[{ left:18,top:80,width:620,height:70 }]);
  assert.ok(padding.top>=160);
  assert.ok(padding.left<100);
  assert.ok(padding.left+padding.right<1000-100);
});

test('selection framing includes every linked endpoint and the complete selected polygon bounds', () => {
  const endpoints = [[121.02,14.64],[121.07,14.67],[121.09,14.65]];
  assert.deepEqual(selectionMapBounds(endpoints, [[121.01,14.63],[121.08,14.69]]), [[121.01,14.63],[121.09,14.69]]);
  assert.deepEqual(selectionMapBounds([[121.05,14.65]]), [[121.05,14.65],[121.05,14.65]]);
  assert.equal(selectionMapBounds([]), null);
  assert.equal(selectionMapBounds([[NaN,14.65]]), null);
  assert.equal(selectionMapBounds([[181,14.65]]), null);
});

test('camera padding leaves visible map space on narrow and short viewports', () => {
  for(const [width,height] of [[320,200],[390,350],[1100,450]]) {
    const padding = simulationMapPadding(width,height,[{left:width-50,top:68,width:45,height:170},{left:12,top:height-100,width:width-90,height:100}]);
    assert.ok(padding.left+padding.right<width*.65);
    assert.ok(padding.top+padding.bottom<height*.65);
    assert.ok(Object.values(padding).every(value=>Number.isFinite(value)&&value>=0));
  }
});
