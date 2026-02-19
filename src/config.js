export const EPSG_PROJECT = 'EPSG:32630';
export const EPSG_MAP = 'EPSG:4326';

// Approximate Burkina Faso bounding box — used only for the initial fitBounds
// before the TIFF has loaded. All precise coordinate math uses setGeoref() values
// read from the TIFF's own geotransform (pixel-edge convention).
export const BBX_UTM = [180946.466, 1733383.302, 1151096.521, 998140.887];

export const CELL_SIZE = [924.833227181229745, 924.833227181232814]; // meters/pixel

export const CLASS_NULL = 65535;
export const TIFF_URL = './landcover.tiff';

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
