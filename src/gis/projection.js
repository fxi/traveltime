import proj4 from 'proj4';
import { BBX_UTM, CELL_SIZE, EPSG_PROJECT, EPSG_MAP } from '../config.js';

proj4.defs([
  ['EPSG:4326', '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'],
  ['EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'],
]);

export function projToMap(coord) { return proj4(EPSG_PROJECT, EPSG_MAP, coord); }
export function projToUtm(coord) { return proj4(EPSG_MAP, EPSG_PROJECT, coord); }

// Mutable georeferencing state — initialised from config constants as a fallback
// for the initial fitBounds call. Replaced with the TIFF's own values by setGeoref().
let _xMin      = Math.min(BBX_UTM[0], BBX_UTM[2]);
let _yNorth    = Math.max(BBX_UTM[1], BBX_UTM[3]);
let _xMax      = Math.max(BBX_UTM[0], BBX_UTM[2]);
let _ySouth    = Math.min(BBX_UTM[1], BBX_UTM[3]);
let _cellSizeX = CELL_SIZE[0];
let _cellSizeY = CELL_SIZE[1];

/**
 * Updates georeferencing from the TIFF's own geotransform (pixel-edge convention).
 *   origin     — [xMin, yNorth, 0]  (top-left pixel-edge corner, image CRS)
 *   resolution — [xRes, yRes, 0]    (yRes is negative for north-up images)
 *   width, height — raster dimensions in pixels
 */
export function setGeoref({ origin, resolution, width, height }) {
  _xMin      = origin[0];
  _yNorth    = origin[1];
  _cellSizeX = Math.abs(resolution[0]);
  _cellSizeY = Math.abs(resolution[1]);
  _xMax      = _xMin   + width  * _cellSizeX;
  _ySouth    = _yNorth - height * _cellSizeY;
}

/**
 * Returns the four corners of the raster in [lng, lat] order,
 * clockwise from top-left (NW), for use as MapLibre canvas source coordinates.
 */
export function getRasterCorners() {
  return [
    projToMap([_xMin,  _yNorth]),  // NW
    projToMap([_xMax,  _yNorth]),  // NE
    projToMap([_xMax,  _ySouth]),  // SE
    projToMap([_xMin,  _ySouth]),  // SW
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
  // Math.floor: snaps to the pixel *containing* the cursor, not the nearest centre.
  // This ensures the Dijkstra source aligns visually with where the cursor is pointing.
  return {
    x: Math.max(0, Math.min(Math.floor((utmX   - _xMin)   / _cellSizeX), w - 1)),
    y: Math.max(0, Math.min(Math.floor((_yNorth - utmY)   / _cellSizeY), h - 1)),
  };
}

/**
 * Converts raster pixel (x, y) back to [lng, lat].
 * Returns the pixel-edge corner by default.
 * Pass x+0.5, y+0.5 to get the geographic centre of the pixel.
 */
export function pixToLngLat(x, y) {
  return projToMap([_xMin + x * _cellSizeX, _yNorth - y * _cellSizeY]);
}
