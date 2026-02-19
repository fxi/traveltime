import { DEFAULT_MODEL, DEFAULT_MAX_TIME_HOURS, TIFF_URL, TIME_SLICE_MS, RENDER_BUDGET_MS } from './config.js';
import { loadRaster, buildNodes, renderLandcoverCanvas } from './gis/raster.js';
import { latLngToPix, pixToLngLat } from './gis/projection.js';
import { ImageGraph } from './analysis/graph.js';
import { Dijkstra } from './analysis/dijkstra.js';
import { createMap, updateIsolineLayer, pauseTravelTimeCanvas, playTravelTimeCanvas } from './ui/map.js';
import { initPanel, setStatus } from './ui/panel.js';
import { initModelTable } from './ui/table.js';
import { contours } from 'd3-contour';

// ─── State ────────────────────────────────────────────────────────────────────

let model = DEFAULT_MODEL.map(r => ({ ...r }));
let rasterData = null;   // { width, height, raster }
let nodes = null;

// Off-screen canvases passed to MapLibre as raster sources
const landcoverCanvas  = document.createElement('canvas');
const traveltimeCanvas = document.createElement('canvas');

// Travel-time canvas state
let ttCtx = null;
let ttImageData = null;

// GeoJSON of the last computed catchment (for download)
let currentCatchment = null;

// Computation context (Dijkstra loop state)
const computeCtx = {
  dijkstra: null,
  graph:    null,
  currentY: 0,
  yDone:    -1,
  timerId:  null,
};

// ─── UI references ────────────────────────────────────────────────────────────

initPanel();

const maxTimeInput = document.getElementById('maxTimeHour');
const btnDownload  = document.getElementById('btnDownload');

btnDownload.addEventListener('click', () => {
  if (!currentCatchment) return;
  const blob = new Blob([JSON.stringify(currentCatchment)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.download = 'travel_time_catchment.geojson';
  a.href     = url;
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ─── Map ──────────────────────────────────────────────────────────────────────

const map = createMap('map', landcoverCanvas, traveltimeCanvas, {
  onHover: handleHover,
  onClick: handleClick,
});

// ─── Data loading ─────────────────────────────────────────────────────────────

setStatus('Loading data…');

loadRaster(TIFF_URL).then(data => {
  rasterData = data;
  nodes = buildNodes(data.raster, model);
  renderLandcoverCanvas(landcoverCanvas, data.width, data.height, data.raster, model);
  resetTravelTimeCanvas();
  setStatus(null);

  initModelTable('tblModel', model, updatedModel => {
    model = updatedModel;
    nodes = buildNodes(rasterData.raster, model);
    renderLandcoverCanvas(landcoverCanvas, rasterData.width, rasterData.height, rasterData.raster, model);
  });
}).catch(err => {
  console.error('Failed to load raster:', err);
  setStatus('Error loading data');
});

// ─── Core computation ─────────────────────────────────────────────────────────

function resetTravelTimeCanvas() {
  const { width, height } = rasterData;
  traveltimeCanvas.width  = width;
  traveltimeCanvas.height = height;
  ttCtx = traveltimeCanvas.getContext('2d');
  ttImageData = ttCtx.createImageData(width, height);
  ttCtx.clearRect(0, 0, width, height);
}

function compute(x, y) {
  if (!rasterData || !nodes) return;
  clearTimeout(computeCtx.timerId);

  // Clear the travel-time canvas for the new computation
  ttCtx.clearRect(0, 0, rasterData.width, rasterData.height);
  ttImageData = ttCtx.createImageData(rasterData.width, rasterData.height);

  const maxSec = parseFloat(maxTimeInput.value || DEFAULT_MAX_TIME_HOURS) * 3600;
  computeCtx.graph    = new ImageGraph(rasterData.width, rasterData.height, nodes);
  computeCtx.dijkstra = new Dijkstra(computeCtx.graph, { x, y }, maxSec);
  computeCtx.currentY = 0;
  computeCtx.yDone    = -1;

  playTravelTimeCanvas(map);
  setStatus('Computing…');
  step();
}

/**
 * Incremental computation + rendering loop (time-sliced to keep the UI responsive).
 *
 * Phase 1 — Dijkstra: runs for up to TIME_SLICE_MS per call.
 * Phase 2 — Render:   paints computed rows into the travel-time canvas.
 *
 * The canvas is rendered in a scan-line pass that wraps around:
 * when Dijkstra finishes at row Y, yDone is set to Y.
 * The render loop then continues until currentY wraps back to Y,
 * guaranteeing every row is painted exactly once.
 */
function step() {
  if (!computeCtx.dijkstra) return;

  const t0 = Date.now();
  const { width, height } = rasterData;

  // Dijkstra phase
  while (computeCtx.yDone === -1 && Date.now() - t0 < TIME_SLICE_MS) {
    if (computeCtx.dijkstra.step()) {
      computeCtx.yDone = computeCtx.currentY;
    }
  }

  // Render phase
  const div = computeCtx.dijkstra.maxDistance / 255.0 || 1;

  do {
    const row = computeCtx.graph.distances[computeCtx.currentY];
    if (row != null) {
      for (let x = 0; x < width; x++) {
        if (row[x] != null) {
          const pos = (x + computeCtx.currentY * width) * 4;
          ttImageData.data[pos]     = 255 - row[x] / div;
          ttImageData.data[pos + 1] = 0;
          ttImageData.data[pos + 2] = 0;
          ttImageData.data[pos + 3] = 255;
        }
      }
      ttCtx.putImageData(ttImageData, 0, 0, 0, computeCtx.currentY, width, 1);
    }
    computeCtx.currentY++;
    if (computeCtx.currentY >= height) computeCtx.currentY = 0;
  } while (computeCtx.currentY !== computeCtx.yDone && Date.now() - t0 < RENDER_BUDGET_MS);

  if (computeCtx.currentY !== computeCtx.yDone) {
    computeCtx.timerId = window.setTimeout(step, 10);
  } else {
    pauseTravelTimeCanvas(map);
    setStatus(null);
  }
}

// ─── Map event handlers ───────────────────────────────────────────────────────

function handleHover(lngLat, map, popup) {
  if (!rasterData) return;

  const { width, height } = rasterData;
  const pos = latLngToPix(lngLat, width, height);

  // Tooltip: show land-cover class name
  const value = rasterData.raster[pos.x + pos.y * width];
  const type  = model.find(m => m.class === value);
  if (type) {
    popup.setLngLat(lngLat).setHTML(type.name).addTo(map);
  } else {
    popup.remove();
  }

  compute(pos.x, pos.y);
}

function handleClick(map) {
  if (!rasterData || !ttImageData) return;

  const { width, height } = rasterData;

  // Build binary grid: 1 where the travel-time overlay has colour (reachable), 0 elsewhere
  const values = new Array(width * height);
  const data   = ttImageData.data;
  for (let i = 0; i < width * height; i++) {
    values[i] = data[i * 4] > 0 ? 1 : 0;
  }

  // Extract the single isoline at threshold 1 (catchment boundary)
  const catchmentContours = contours()
    .size([width, height])
    .thresholds([1])
    (values);

  // Convert pixel coordinates → WGS84.
  // Offset by -0.5 to correct the half-pixel shift in d3-contour's Marching Squares output.
  catchmentContours.forEach(contour => {
    contour.coordinates.forEach(group => {
      group.forEach(ring => {
        ring.forEach((c, i) => {
          ring[i] = pixToLngLat(c[0] - 0.5, c[1] - 0.5);
        });
      });
    });
  });

  currentCatchment = {
    type: 'FeatureCollection',
    features: catchmentContours.map(geom => ({
      type: 'Feature',
      properties: {},
      geometry: geom,
    })),
  };

  updateIsolineLayer(map, currentCatchment);
  btnDownload.disabled = false;
}
