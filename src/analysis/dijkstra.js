/**
 * Binary min-heap Dijkstra implementation, graph-agnostic.
 * maxDistanceSeconds is the travel time cutoff in seconds.
 */
export class Dijkstra {
  constructor(graph, startNode, maxDistanceSeconds) {
    this.graph = graph;
    this.maxDistanceSeconds = maxDistanceSeconds;
    this.unexplored = [{ cost: 0, node: startNode }];
    this.maxDistance = 0;
  }

  /** Processes one node from the heap. Returns true when the queue is empty. */
  step() {
    if (this.unexplored.length === 0) return true;

    const head = this.unexplored[0];
    const last = this.unexplored.pop();
    if (this.unexplored.length > 0) {
      this.unexplored[0] = last;
      this.sinkDown_(0);
    }

    const connections = this.graph.connections(head.node);
    for (let i = 0; i < connections.length; i++) {
      const con = connections[i];
      const cost = con.cost + head.cost;
      if (cost < this.graph.currentDistance(con.node) && cost < this.maxDistanceSeconds) {
        con.cost = cost;
        if (cost > this.maxDistance) this.maxDistance = cost;
        this.graph.setCurrentDistance(con.node, cost);
        this.unexplored.push(con);
        this.bubbleUp_(this.unexplored.length - 1);
      }
    }
    return this.unexplored.length === 0;
  }

  sinkDown_(index) {
    const entry = this.unexplored[index];
    const cost = entry.cost;
    const len = this.unexplored.length;
    while (true) {
      const child2Index = (index + 1) * 2;
      const child1Index = child2Index - 1;
      let swapIndex = -1;
      let swapCost = cost;
      if (child1Index < len && this.unexplored[child1Index].cost < swapCost) {
        swapIndex = child1Index;
        swapCost = this.unexplored[child1Index].cost;
      }
      if (child2Index < len && this.unexplored[child2Index].cost < swapCost) {
        swapIndex = child2Index;
      }
      if (swapIndex === -1) return;
      this.unexplored[index] = this.unexplored[swapIndex];
      this.unexplored[swapIndex] = entry;
      index = swapIndex;
    }
  }

  bubbleUp_(index) {
    const entry = this.unexplored[index];
    const cost = entry.cost;
    while (index > 0) {
      const parentIndex = Math.floor((index + 1) / 2) - 1;
      const parent = this.unexplored[parentIndex];
      if (cost >= parent.cost) break;
      this.unexplored[parentIndex] = entry;
      this.unexplored[index] = parent;
      index = parentIndex;
    }
  }
}
