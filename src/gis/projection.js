import proj4 from 'proj4';
import { BBX_UTM, CELL_SIZE, EPSG_PROJECT, EPSG_MAP } from '../config.js';

proj4.defs([
  ['EPSG:4326',  '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'],
  ['EPSG:32630', '+proj=utm +zone=30 +datum=WGS84 +units=m +no_defs'],
]);

export function projToMap(coord) { return proj4(EPSG_PROJECT, EPSG_MAP, coord); }
export function projToUtm(coord) { return proj4(EPSG_MAP, EPSG_PROJECT, coord); }

/**
 * Returns the four corners of the raster in [lng, lat] order,
 * clockwise from top-left (NW), for use as MapLibre canvas source coordinates.
 */
export function getRasterCorners() {
  const [xMin, yNorth, xMax, ySouth] = BBX_UTM;
  return [
    projToMap([xMin, yNorth]),  // NW
    projToMap([xMax, yNorth]),  // NE
    projToMap([xMax, ySouth]),  // SE
    projToMap([xMin, ySouth]),  // SW
  ];
}

/** Returns [[sw], [ne]] for MapLibre fitBounds. */
export function getRasterBounds() {
  const corners = getRasterCorners();
  return [corners[3], corners[1]]; // SW, NE
}

/** Converts a MapLibre LngLat to raster pixel { x, y }, clamped to image bounds. */
export function latLngToPix(lngLat, w, h) {
  const [utmX, utmY] = projToUtm([lngLat.lng, lngLat.lat]);
  const xMin   = Math.min(BBX_UTM[0], BBX_UTM[2]);
  const yNorth = Math.max(BBX_UTM[1], BBX_UTM[3]);
  // Math.floor: snaps to the pixel *containing* the cursor, not the nearest centre.
  // This ensures the Dijkstra source aligns visually with where the cursor is pointing.
  return {
    x: Math.max(0, Math.min(Math.floor((utmX  - xMin)   / CELL_SIZE[0]), w - 1)),
    y: Math.max(0, Math.min(Math.floor((yNorth - utmY)  / CELL_SIZE[1]), h - 1)),
  };
}

/** Converts raster pixel (x, y) back to [lng, lat]. */
export function pixToLngLat(x, y) {
  const xMin   = Math.min(BBX_UTM[0], BBX_UTM[2]);
  const yNorth = Math.max(BBX_UTM[1], BBX_UTM[3]);
  return projToMap([xMin + x * CELL_SIZE[0], yNorth - y * CELL_SIZE[1]]);
}
