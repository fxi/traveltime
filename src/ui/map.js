import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getRasterBounds, getRasterCorners } from '../gis/projection.js';

/**
 * Creates and returns a MapLibre map with canvas overlay sources pre-configured.
 * Callbacks:
 *   onMapClick(lngLat) — fires on click (for placing markers)
 */
export function createMap(containerId, landcoverCanvas, traveltimeCanvas, { onMapClick }) {
  const corners = getRasterCorners();

  const map = new maplibregl.Map({
    container: containerId,
    style: 'https://api.maptiler.com/maps/outdoor-v4/style.json?key=sZ1OmwWx9EEcSEyGWBa8',
    center: [0, 0],
    zoom: 3,
    preserveDrawingBuffer: true,
  });

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
      paint: {
        'raster-opacity': 1,
        'raster-resampling': 'nearest',
      },
    }, 'Tunnel path');

    map.addLayer({
      id: 'traveltime',
      source: 'canvas-traveltime',
      type: 'raster',
      paint: {
        'raster-opacity': 0.85,
        'raster-resampling': 'nearest',
      },
    }, 'Tunnel path');

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

    map.on('click', e => onMapClick(e.lngLat));
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

/**
 * Creates a draggable marker at the given location.
 * @param {maplibregl.Map} map - MapLibre map instance
 * @param {LngLat} lngLat - Position for the marker
 * @param {string} color - Marker color (hex)
 * @param {object} callbacks - { onDrag, onDragEnd, onClick }
 * @returns {maplibregl.Marker}
 */
export function createMarker(map, lngLat, color, { onDrag, onDragEnd, onClick }) {
  const marker = new maplibregl.Marker({
    color,
    draggable: true,
  })
    .setLngLat(lngLat)
    .addTo(map);

  marker.on('drag', () => onDrag(marker.getLngLat()));
  marker.on('dragend', () => onDragEnd(marker.getLngLat()));

  // Click on marker element to remove it
  marker.getElement().addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent map click
    onClick();
  });

  return marker;
}
