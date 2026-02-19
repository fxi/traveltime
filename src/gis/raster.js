import { fromArrayBuffer } from 'geotiff';

/**
 * Loads a GeoTIFF from a URL and returns { width, height, raster }.
 * raster is the first band as a TypedArray of integer class values.
 */
export async function loadRaster(url) {
  const buf    = await (await fetch(url)).arrayBuffer();
  const tiff   = await fromArrayBuffer(buf);
  const image  = await tiff.getImage();
  const rasters = await image.readRasters();
  return {
    width:  image.getWidth(),
    height: image.getHeight(),
    raster: rasters[0],
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Builds a flat nodes array from a raster + model.
 * Each element is the matching model rule (with .speed) or a barrier { speed: 0 }.
 * Uses a Map for O(1) lookup instead of Array.find() per pixel.
 */
export function buildNodes(raster, model) {
  const modelMap = new Map(model.map(r => [r.class, r]));
  const barrier = { speed: 0 };
  return Array.from(raster, v => modelMap.get(v) ?? barrier);
}

/**
 * Renders the landcover raster onto a canvas using the model color mapping.
 * Pixels with no matching class are transparent.
 * Uses a Map for O(1) per-pixel lookup (~10× faster than Array.find).
 */
export function renderLandcoverCanvas(canvas, width, height, raster, model) {
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const modelMap = new Map(model.map(r => [r.class, hexToRgb(r.color_hex)]));

  for (let i = 0; i < width * height; i++) {
    const rgb = modelMap.get(raster[i]);
    if (rgb) {
      const p = i * 4;
      data[p]     = rgb[0];
      data[p + 1] = rgb[1];
      data[p + 2] = rgb[2];
      data[p + 3] = 255;
    }
    // else: transparent (data defaults to 0)
  }

  ctx.putImageData(img, 0, 0);
}
