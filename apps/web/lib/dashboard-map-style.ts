import type { LayerSpecification } from 'maplibre-gl';

/** Cartographic context only. These colors never encode disease or capacity. */
export function dashboardLayerPaint(layer: LayerSpecification): Record<string, string | number> {
  const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : '';
  if (layer.type === 'background') return { 'background-color': '#eef2ef' };
  if (layer.type === 'raster') return { 'raster-opacity': 0 };
  if (layer.type === 'fill-extrusion') return { 'fill-extrusion-color': '#a9bdbb', 'fill-extrusion-opacity': 0.86 };
  if (layer.type === 'fill') {
    if (sourceLayer === 'water') return { 'fill-color': '#9bc8cc' };
    if (sourceLayer === 'park' || sourceLayer === 'landcover') return { 'fill-color': '#d5e3d3', 'fill-opacity': 0.65 };
    if (layer.id === 'landuse_hospital') return { 'fill-color': '#d2e5df' };
    if (sourceLayer === 'landuse') return { 'fill-color': '#e4e9e1' };
    if (sourceLayer === 'building') return { 'fill-color': '#c0cecc', 'fill-outline-color': '#adbfbc' };
    return {};
  }
  if (layer.type === 'line') {
    if (sourceLayer === 'waterway') return { 'line-color': '#9bc8cc' };
    if (sourceLayer === 'park') return { 'line-color': '#c9dbc7' };
    if (sourceLayer === 'boundary') return { 'line-color': '#9cadaa' };
    if (sourceLayer === 'transportation' || sourceLayer === 'aeroway') {
      const color = /rail/.test(layer.id) ? '#aab8b5' : /casing/.test(layer.id) ? '#cbd5ce'
        : /motorway|trunk|primary|secondary/.test(layer.id) ? '#f8f4e5' : '#fcfdf9';
      return { 'line-color': color };
    }
  }
  if (layer.type === 'symbol' && layer.layout?.['text-field']) return {
    'text-color': sourceLayer === 'water_name' || sourceLayer === 'waterway' ? '#4c7c80' : '#536d6b',
    'text-halo-color': '#f8fbf7', 'text-halo-width': 1.2,
  };
  return {};
}
