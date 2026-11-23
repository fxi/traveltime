#!/usr/bin/env bash
# Build public/landcover_belize.tiff from an AccessMod 6 export zip.
# Usage: scripts/prep_belize.sh <export.zip> [resolution_m]
# Requires GDAL >= 3.11 (`gdal raster reclassify`); no Python / muparser needed.
set -euo pipefail
ZIP="${1:?usage: $0 <export.zip> [resolution_m]}"
RES="${2:-300}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/landcover_belize.tiff"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

unzip -q -o "$ZIP" 'runs/1/land_cover_merged.tif' -d "$TMP"

# Int32 (nodata = INT32_MIN) -> UInt16 with nodata 0 (all classes fit in 1..65534).
gdal_translate -q -ot UInt16 -a_nodata 0 "$TMP/runs/1/land_cover_merged.tif" "$TMP/base.tif"

# Roads (>= 1001): resample with min so 1-px roads stay continuous and the most
# important road wins a cell (AccessMod: lower class = bigger road, 1001 = motorway).
gdal raster reclassify -q -m "[1001,65534]=PASS_THROUGH; DEFAULT=NO_DATA" "$TMP/base.tif" "$TMP/roads.tif"
gdalwarp -q -tr "$RES" "$RES" -tap -r min "$TMP/roads.tif" "$TMP/roads_r.tif"

# Land cover (< 1000): resample with mode.
gdal raster reclassify -q -m "[1,999]=PASS_THROUGH; DEFAULT=NO_DATA" "$TMP/base.tif" "$TMP/lc.tif"
gdalwarp -q -tr "$RES" "$RES" -tap -r mode "$TMP/lc.tif" "$TMP/lc_r.tif"

# Merge: gdalwarp paints later sources over earlier ones, skipping nodata -> roads on top.
gdalwarp -q "$TMP/lc_r.tif" "$TMP/roads_r.tif" "$TMP/merged.tif"

# Final nodata convention used by the app: 65535.
gdalwarp -q -srcnodata 0 -dstnodata 65535 -co COMPRESS=DEFLATE -co PREDICTOR=2 "$TMP/merged.tif" "$TMP/final.tif"
gdal_translate -q -co COMPRESS=DEFLATE -co PREDICTOR=2 "$TMP/final.tif" "$OUT"
echo "Wrote $OUT"
