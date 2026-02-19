import { CELL_SIZE } from '../config.js';

const SQRT2 = Math.SQRT2;

/**
 * Raster-based graph for Dijkstra.
 * Supports 8-connectivity (cardinal + diagonal) with √2 cost multiplier for diagonals.
 * Nodes is the flat pixel array from buildNodes(), each element has .speed (km/h) or 0 for barriers.
 */
export class ImageGraph {
  constructor(width, height, nodes) {
    this.width  = width;
    this.height = height;
    this.nodes  = nodes;
    this.distances = [];
  }

  currentDistance(node) {
    const dy = this.distances[node.y];
    if (dy == null) return Number.MAX_SAFE_INTEGER;
    const d = dy[node.x];
    return d == null ? Number.MAX_SAFE_INTEGER : d;
  }

  setCurrentDistance(node, distance) {
    let dy = this.distances[node.y];
    if (dy == null) dy = this.distances[node.y] = [];
    dy[node.x] = distance;
  }

  /** Adds a neighbor to result if reachable, with cost scaled by mult. */
  getCost_(x, y, mult, result) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const node = this.nodes[x + y * this.width];
    if (node.speed) {
      // cost = distance (m) → km → hours → seconds
      result.push({
        cost: (CELL_SIZE[0] / 1000 / node.speed) * 3600 * mult,
        node: { x, y },
      });
    }
  }

  /** Returns all reachable 8-connected neighbors with their travel costs. */
  connections(node) {
    const { x, y } = node;
    const r = [];
    // Cardinal directions (×1.0)
    this.getCost_(x - 1, y,     1.0,   r);
    this.getCost_(x + 1, y,     1.0,   r);
    this.getCost_(x,     y - 1, 1.0,   r);
    this.getCost_(x,     y + 1, 1.0,   r);
    // Diagonal directions (×√2)
    this.getCost_(x - 1, y - 1, SQRT2, r);
    this.getCost_(x + 1, y - 1, SQRT2, r);
    this.getCost_(x - 1, y + 1, SQRT2, r);
    this.getCost_(x + 1, y + 1, SQRT2, r);
    return r;
  }
}
