export const EPSG_PROJECT = 'EPSG:3857';
export const EPSG_MAP = 'EPSG:4326';

// Bounding box of landcover_3857.tiff in EPSG:3857 (Web Mercator, metres).
// Format: [xMin, yNorth, xMax, ySouth] — pixel-edge convention.
// Used as fallback before the TIFF's own geotransform is read by setGeoref().
export const BBX_UTM = [-665232.623867248767, 1767530.945019772742, 341128.741274, 1003986.271270];

export const CELL_SIZE = [948.502700081797570, 948.502700081797570]; // EPSG:3857 metres/pixel

export const CLASS_NULL = 65535;
export const TIFF_URL = `${import.meta.env.BASE_URL}landcover_3857.tiff`;

export const DEFAULT_MAX_TIME_HOURS = 3;
export const TIME_SLICE_MS = 80;   // Dijkstra compute budget per step() call
export const RENDER_BUDGET_MS = 100; // Total step() time budget

export const DEFAULT_MODEL = [
  { class: 1,    name: 'Bare areas',              speed: 2.5,  mode: 1, color_hex: '#1a4cf6' },
  { class: 2,    name: 'Urban',                   speed: 2.5,  mode: 1, color_hex: '#a07d60' },
  { class: 3,    name: 'Low dense vegetation',    speed: 2,    mode: 1, color_hex: '#dbfc40' },
  { class: 4,    name: 'Medium dense vegetation', speed: 1.5,  mode: 1, color_hex: '#dbd740' },
  { class: 5,    name: 'Dense vegetation',        speed: 1,    mode: 1, color_hex: '#987ab8' },
  { class: 2001, name: 'Primary road',            speed: 80,   mode: 3, color_hex: '#ccb3fe' },
  { class: 2002, name: 'Secondary road',          speed: 70,   mode: 3, color_hex: '#0a283f' },
  { class: 2003, name: 'Tertiary road',           speed: 60,   mode: 3, color_hex: '#363449' },
  { class: 2004, name: 'Urban road',              speed: 50,   mode: 3, color_hex: '#f05acf' },
];
