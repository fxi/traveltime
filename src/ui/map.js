import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getRasterBounds, getRasterCorners } from '../gis/projection.js';

/**
 * Creates and returns a MapLibre map with canvas overlay sources pre-configured.
 * Callbacks:
 *   onHover(lngLat, map, popup) — fires on mousemove
 *   onClick(map)                — fires on click
 */
export function createMap(containerId, landcoverCanvas, traveltimeCanvas, { onHover, onClick }) {
  const corners = getRasterCorners();

  const map = new maplibregl.Map({
    container: containerId,
    style: { version: 8, sources: {}, layers: [] },
    center: [0, 0],
    zoom: 3,
    preserveDrawingBuffer: true,
  });

  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

  map.on('load', () => {
    map.fitBounds(getRasterBounds());
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.addSource('canvas-landcover', {
      type: 'canvas',
      canvas: landcoverCanvas,
      animate: true,
      coordinates: corners,
    });

    map.addSource('canvas-traveltime', {
      type: 'canvas',
      canvas: traveltimeCanvas,
      animate: true,
      coordinates: corners,
    });

    map.addLayer({
      id: 'landcover',
      source: 'canvas-landcover',
      type: 'raster',
      paint: { 'raster-opacity': 1 },
    });

    map.addLayer({
      id: 'traveltime',
      source: 'canvas-traveltime',
      type: 'raster',
      paint: { 'raster-opacity': 0.7 },
    });

    // Catchment boundary — visible red outline with faint fill
    map.addLayer({
      id: 'isoline',
      type: 'fill',
      source: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
      paint: {
        'fill-color': 'rgba(220, 30, 30, 0.08)',
        'fill-outline-color': 'rgba(220, 30, 30, 0.9)',
      },
    });

    map.on('mousemove', e => onHover(e.lngLat, map, popup));
    map.on('click',     () => onClick(map));
    map.on('mouseleave', () => popup.remove());
  });

  return map;
}

/** Updates the isoline GeoJSON source with new catchment data. */
export function updateIsolineLayer(map, geojson) {
  map.getSource('isoline').setData(geojson);
}

/** Stops MapLibre from re-reading the travel-time canvas every frame (saves GPU). */
export function pauseTravelTimeCanvas(map) {
  map.getSource('canvas-traveltime')?.pause?.();
}

/** Resumes canvas re-reading for animated updates during Dijkstra computation. */
export function playTravelTimeCanvas(map) {
  map.getSource('canvas-traveltime')?.play?.();
}
