export const EPSG_PROJECT = 'EPSG:32616'; // WGS 84 / UTM zone 16N (Belize)
export const EPSG_MAP = 'EPSG:4326';

// Bounding box of landcover_belize.tiff in EPSG:32616 (metres).
// Format: [xMin, yNorth, xMax, ySouth] — pixel-edge convention.
// Used as fallback before the TIFF's own geotransform is read by setGeoref().
export const BBX_UTM = [211800, 2095500, 497700, 1707300];

export const CELL_SIZE = [300, 300]; // fallback metres/pixel; real value comes from the TIFF

export const CLASS_NULL = 65535;
export const TIFF_URL = `${import.meta.env.BASE_URL}landcover_belize.tiff`;

export const DEFAULT_MAX_TIME_HOURS = 3;
export const TIME_SLICE_MS = 80;   // Dijkstra compute budget per step() call
export const RENDER_BUDGET_MS = 100; // Total step() time budget

export const MARKER_COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#42d4f4', // cyan
  '#f032e6', // magenta
  '#bfef45', // lime
];

// Belize — AccessMod 6 scenario "walking + motorized" (export datasets/13.csv):
// walk off-road and on paths, drive on roads/tracks, take the ferry to the cayes.
// mode: 1 = walking, 2 = bicycling, 3 = motorized.
// Speed 0 = barrier (water); the ferry is the only way across.
// Muted (pastel) colors so the saturated travel-time overlay stays readable on top;
// land-cover hues are derived from the ESA WorldCover palette.
export const DEFAULT_MODEL = [
  { class: 10,   name: 'Tree cover',               speed: 3,   mode: 1, color_hex: '#a1b597' },
  { class: 20,   name: 'Shrubland',                speed: 4,   mode: 1, color_hex: '#f9dcb0' },
  { class: 30,   name: 'Grassland',                speed: 5,   mode: 1, color_hex: '#fbf6c0' },
  { class: 40,   name: 'Cropland',                 speed: 4,   mode: 1, color_hex: '#ecd2ec' },
  { class: 50,   name: 'Built-up',                 speed: 5,   mode: 1, color_hex: '#f5ae97' },
  { class: 60,   name: 'Bare / sparse vegetation', speed: 4,   mode: 1, color_hex: '#d8d8d8' },
  { class: 80,   name: 'Permanent water bodies',   speed: 0,   mode: 1, color_hex: '#b9cde0' },
  { class: 90,   name: 'Herbaceous wetland',       speed: 1,   mode: 1, color_hex: '#bac8c9' },
  { class: 95,   name: 'Mangroves',                speed: 0.5, mode: 1, color_hex: '#bae2c3' },
  { class: 1001, name: 'Motorway and trunk',       speed: 80,  mode: 3, color_hex: '#6b6b6b' },
  { class: 1002, name: 'Primary road',             speed: 60,  mode: 3, color_hex: '#808080' },
  { class: 1003, name: 'Secondary road',           speed: 50,  mode: 3, color_hex: '#949494' },
  { class: 1004, name: 'Tertiary road',            speed: 40,  mode: 3, color_hex: '#a6a6a6' },
  { class: 1005, name: 'Local road',               speed: 30,  mode: 3, color_hex: '#b3b3b3' },
  { class: 1006, name: 'Track',                    speed: 15,  mode: 3, color_hex: '#c2b8a8' },
  { class: 1007, name: 'Path',                     speed: 5,   mode: 1, color_hex: '#cdc4b6' },
  { class: 1008, name: 'Ferry',                    speed: 20,  mode: 3, color_hex: '#7a6f9b' },
];
