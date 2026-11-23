import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TIME_HOURS,
  TIFF_URL,
  TIME_SLICE_MS,
  RENDER_BUDGET_MS,
  MARKER_COLORS,
} from "./config.js";
import { loadRaster, buildNodes, renderLandcoverCanvas } from "./gis/raster.js";
import { latLngToPix, pixToLngLat, setGeoref } from "./gis/projection.js";
import { ImageGraph } from "./analysis/graph.js";
import { Dijkstra } from "./analysis/dijkstra.js";
import {
  createMap,
  createMarker,
  updateIsolineLayer,
  pauseTravelTimeCanvas,
  playTravelTimeCanvas,
} from "./ui/map.js";
import { initPanel, setStatus } from "./ui/panel.js";
import { initModelTable } from "./ui/table.js";
import { contours } from "d3-contour";
import chroma from "chroma-js";

const palette = [
  "#440154", 
  "#482878",
  "#3E4A89",
  "#31688E",
  "#26828E",
  "#1F9E89",
  "#35B779",
  "#6CCE59",
  "#B4DE2C",
  "#FDE725"  
];

const palette_1 =  [
  "#2C3E73",
  "#2A6F97",
  "#1CA7C1",
  "#2DC653",
  "#80ED99",
  "#F9C74F",
  "#F9844A",
  "#F94144"  
];


// ─── Color ramp for travel time overlay (near → far: red → orange → blue) ────
const TT_COLOR_LUT = chroma
  .scale(palette).colors(256, "rgb");

// ─── State ────────────────────────────────────────────────────────────────────

let model = DEFAULT_MODEL.map((r) => ({ ...r }));
let rasterData = null; // { width, height, raster }
let nodes = null;

// Off-screen canvases passed to MapLibre as raster sources
const landcoverCanvas = document.createElement("canvas");
const traveltimeCanvas = document.createElement("canvas");

// Travel-time canvas state
let ttCtx = null;
let ttImageData = null;

// GeoJSON of the last computed catchment (for download)
let currentCatchment = null;

// Multi-origin state: array of { id, marker, color, colorRGB, dijkstra, graph, distances }
const origins = [];
let nextOriginId = 0;

// Render loop state
const renderCtx = {
  currentY: 0,
  yDone: -1,
  timerId: null,
  computing: false, // true while any origin is still computing
};

// ─── UI references ────────────────────────────────────────────────────────────

initPanel();

const maxTimeInput = document.getElementById("maxTimeHour");
const btnDownload = document.getElementById("btnDownload");

btnDownload.addEventListener("click", () => {
  if (!currentCatchment) return;
  const blob = new Blob([JSON.stringify(currentCatchment)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = "travel_time_catchment.geojson";
  a.href = url;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ─── Map ──────────────────────────────────────────────────────────────────────

const map = createMap("map", landcoverCanvas, traveltimeCanvas, {
  onMapClick: handleMapClick,
});

// ─── Data loading ─────────────────────────────────────────────────────────────

setStatus("Loading data…");

loadRaster(TIFF_URL)
  .then((data) => {
    rasterData = data;
    setGeoref(data); // update projection math from the TIFF's own geotransform
    nodes = buildNodes(data.raster, model);
    renderLandcoverCanvas(
      landcoverCanvas,
      data.width,
      data.height,
      data.raster,
      model,
    );
    resetTravelTimeCanvas();
    setStatus(null);

    initModelTable("tblModel", model, (updatedModel) => {
      model = updatedModel;
      nodes = buildNodes(rasterData.raster, model);
      renderLandcoverCanvas(
        landcoverCanvas,
        rasterData.width,
        rasterData.height,
        rasterData.raster,
        model,
      );
    });
  })
  .catch((err) => {
    console.error("Failed to load raster:", err);
    setStatus("Error loading data");
  });

// ─── Core computation ─────────────────────────────────────────────────────────

function resetTravelTimeCanvas() {
  const { width, height } = rasterData;
  traveltimeCanvas.width = width;
  traveltimeCanvas.height = height;
  ttCtx = traveltimeCanvas.getContext("2d");
  ttImageData = ttCtx.createImageData(width, height);
  ttCtx.clearRect(0, 0, width, height);
}

/**
 * Build a 256-entry color ramp for a given origin color.
 * Near origin (index 255) = lighter, far (index 0) = darker/saturated.
 */
function buildColorRamp(baseColor) {
  return chroma
    .scale([
      chroma(baseColor).darken(1.2).saturate(0.5),
      chroma(baseColor).saturate(0.5),
      chroma(baseColor).brighten(0.6).saturate(1),
    ])
    .colors(256, "rgb");
}

/**
 * Compute travel time distances for a single origin.
 * @param {object} origin - Origin object from origins array
 * @param {number} x - Pixel x coordinate
 * @param {number} y - Pixel y coordinate
 */
function computeOrigin(origin, x, y) {
  if (!rasterData || !nodes) return;

  const maxSec = parseFloat(maxTimeInput.value || DEFAULT_MAX_TIME_HOURS) * 3600;
  origin.graph = new ImageGraph(rasterData.width, rasterData.height, nodes, Math.abs(rasterData.resolution[0]));
  origin.dijkstra = new Dijkstra(origin.graph, { x, y }, maxSec);
  origin.done = false;
}

/**
 * Start or restart the render loop for all origins.
 */
function startRenderLoop() {
  clearTimeout(renderCtx.timerId);

  // Clear the travel-time canvas
  ttCtx.clearRect(0, 0, rasterData.width, rasterData.height);
  ttImageData = ttCtx.createImageData(rasterData.width, rasterData.height);

  renderCtx.currentY = 0;
  renderCtx.yDone = -1;
  renderCtx.computing = true;

  playTravelTimeCanvas(map);
  setStatus("Computing…");
  step();
}

/**
 * Incremental computation + rendering loop for multiple origins.
 *
 * Phase 1 — Dijkstra: runs each origin's Dijkstra for up to TIME_SLICE_MS total.
 * Phase 2 — Render: paints computed rows, choosing closest origin for each pixel.
 */
function step() {
  const t0 = Date.now();
  const { width, height } = rasterData;

  // Dijkstra phase: advance all origins that aren't done
  let allDone = true;
  for (const origin of origins) {
    if (origin.done || !origin.dijkstra) continue;
    allDone = false;

    while (Date.now() - t0 < TIME_SLICE_MS) {
      if (origin.dijkstra.step()) {
        origin.done = true;
        // Store final distances array reference
        origin.distances = origin.graph.distances;
        origin.maxDistance = origin.dijkstra.maxDistance;
        break;
      }
    }
  }

  // Check if all origins are now complete
  if (allDone && renderCtx.computing) {
    renderCtx.yDone = renderCtx.currentY;
    renderCtx.computing = false;
  }

  // Find global max distance for normalization
  let globalMaxDist = 0;
  for (const origin of origins) {
    if (origin.maxDistance > globalMaxDist) {
      globalMaxDist = origin.maxDistance;
    }
  }
  const div = globalMaxDist / 255.0 || 1;

  // Render phase: for each pixel, find closest origin and use its color
  do {
    for (let x = 0; x < width; x++) {
      let minDist = Infinity;
      let closestOrigin = null;

      for (const origin of origins) {
        if (!origin.distances) continue;
        const row = origin.distances[renderCtx.currentY];
        if (row && row[x] != null && row[x] < minDist) {
          minDist = row[x];
          closestOrigin = origin;
        }
      }

      if (closestOrigin) {
        const pos = (x + renderCtx.currentY * width) * 4;
        const t = Math.round(255 - minDist / div); // 255 = near origin, 0 = far
        const [r, g, b] = closestOrigin.colorRamp[Math.max(0, Math.min(255, t))];
        ttImageData.data[pos] = r;
        ttImageData.data[pos + 1] = g;
        ttImageData.data[pos + 2] = b;
        ttImageData.data[pos + 3] = 255;
      }
    }
    ttCtx.putImageData(ttImageData, 0, 0, 0, renderCtx.currentY, width, 1);

    renderCtx.currentY++;
    if (renderCtx.currentY >= height) renderCtx.currentY = 0;
  } while (
    renderCtx.currentY !== renderCtx.yDone &&
    Date.now() - t0 < RENDER_BUDGET_MS
  );

  if (renderCtx.currentY !== renderCtx.yDone || renderCtx.computing) {
    renderCtx.timerId = window.setTimeout(step, 10);
  } else {
    renderCtx.timerId = null;
    pauseTravelTimeCanvas(map);
    updateCatchments();
    setStatus(null);
  }
}

// ─── Map event handlers ───────────────────────────────────────────────────────

/**
 * Handle map click: add a new marker origin.
 */
function handleMapClick(lngLat) {
  if (!rasterData) return;

  // Max 8 markers (limited by color palette)
  if (origins.length >= MARKER_COLORS.length) return;

  const { width, height } = rasterData;
  const pos = latLngToPix(lngLat, width, height);

  // Check if click is within raster bounds
  if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) return;

  const id = nextOriginId++;
  const colorIdx = origins.length;
  const color = MARKER_COLORS[colorIdx];

  const origin = {
    id,
    marker: null,
    color,
    colorRamp: buildColorRamp(color),
    dijkstra: null,
    graph: null,
    distances: null,
    maxDistance: 0,
    done: false,
    pixX: pos.x,
    pixY: pos.y,
  };

  // Create draggable marker
  origin.marker = createMarker(map, lngLat, color, {
    onDrag: (newLngLat) => handleMarkerDrag(origin, newLngLat),
    onDragEnd: (newLngLat) => handleMarkerDragEnd(origin, newLngLat),
    onClick: () => handleMarkerClick(origin),
  });

  origins.push(origin);

  // Compute travel time for this origin
  computeOrigin(origin, pos.x, pos.y);
  startRenderLoop();
}

/**
 * Handle marker drag: recompute that origin's distances (throttled via render loop).
 */
function handleMarkerDrag(origin, lngLat) {
  const { width, height } = rasterData;
  const pos = latLngToPix(lngLat, width, height);

  if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) return;

  origin.pixX = pos.x;
  origin.pixY = pos.y;
  computeOrigin(origin, pos.x, pos.y);

  // Only start render loop if not already running
  if (!renderCtx.computing && renderCtx.timerId === null) {
    startRenderLoop();
  }
}

/**
 * Handle marker drag end: final computation.
 */
function handleMarkerDragEnd(origin, lngLat) {
  handleMarkerDrag(origin, lngLat);
}

/**
 * Handle marker click: remove the marker and its origin.
 */
function handleMarkerClick(origin) {
  // Remove marker from map
  origin.marker.remove();

  // Remove from origins array
  const idx = origins.indexOf(origin);
  if (idx > -1) {
    origins.splice(idx, 1);
  }

  // Reassign colors to maintain order
  origins.forEach((o, i) => {
    o.color = MARKER_COLORS[i];
    o.colorRamp = buildColorRamp(o.color);
    // Update marker color
    const el = o.marker.getElement();
    const svg = el.querySelector("svg");
    if (svg) {
      const path = svg.querySelector("path");
      if (path) path.setAttribute("fill", o.color);
    }
  });

  if (origins.length === 0) {
    // Clear the canvas
    clearTimeout(renderCtx.timerId);
    renderCtx.timerId = null;
    ttCtx.clearRect(0, 0, rasterData.width, rasterData.height);
    ttImageData = ttCtx.createImageData(rasterData.width, rasterData.height);
    updateIsolineLayer(map, { type: "FeatureCollection", features: [] });
    btnDownload.disabled = true;
    currentCatchment = null;
    setStatus(null);
  } else {
    // Re-render with remaining origins
    startRenderLoop();
  }
}

/**
 * Extract and update catchment boundaries for download.
 * Creates per-origin catchment features with origin point as property.
 */
function updateCatchments() {
  if (!rasterData || origins.length === 0) return;

  const { width, height } = rasterData;
  const features = [];

  // For each origin, create a binary mask of pixels belonging to it
  for (const origin of origins) {
    if (!origin.distances) continue;

    const values = new Array(width * height).fill(0);

    // Mark pixels that belong to this origin (closest)
    for (let y = 0; y < height; y++) {
      const row = origin.distances[y];
      if (!row) continue;

      for (let x = 0; x < width; x++) {
        if (row[x] == null) continue;

        // Check if this origin is closest to this pixel
        let isClosest = true;
        const dist = row[x];

        for (const other of origins) {
          if (other === origin || !other.distances) continue;
          const otherRow = other.distances[y];
          if (otherRow && otherRow[x] != null && otherRow[x] < dist) {
            isClosest = false;
            break;
          }
        }

        if (isClosest) {
          values[x + y * width] = 1;
        }
      }
    }

    // Extract contour for this origin's catchment
    const catchmentContours = contours().size([width, height]).thresholds([1])(
      values,
    );

    // Get origin point in WGS84
    const originLngLat = pixToLngLat(origin.pixX, origin.pixY);

    // Convert pixel coordinates → WGS84 and create features
    catchmentContours.forEach((contour) => {
      contour.coordinates.forEach((group) => {
        group.forEach((ring) => {
          ring.forEach((c, i) => {
            ring[i] = pixToLngLat(c[0] - 0.5, c[1] - 0.5);
          });
        });
      });

      features.push({
        type: "Feature",
        properties: {
          origin: originLngLat,
          color: origin.color,
        },
        geometry: contour,
      });
    });
  }

  currentCatchment = {
    type: "FeatureCollection",
    features,
  };

  updateIsolineLayer(map, currentCatchment);
  btnDownload.disabled = features.length === 0;
}
