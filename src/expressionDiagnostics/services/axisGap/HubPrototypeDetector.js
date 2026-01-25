/**
 * @file Hub prototype detection for overlap graph analysis.
 * @description Identifies prototype nodes that connect multiple clusters in the overlap graph.
 */

import { clamp01 } from '../../utils/vectorMathUtils.js';

/**
 * @typedef {object} HubResult
 * @property {string} prototypeId - Hub prototype identifier.
 * @property {number} hubScore - Hub score based on degree and edge weight variance.
 * @property {number} betweennessCentrality - Normalized betweenness centrality [0, 1].
 * @property {string[]} overlappingPrototypes - Neighbor prototype IDs.
 * @property {number} neighborhoodDiversity - Number of distinct clusters among neighbors.
 * @property {string} suggestedAxisConcept - Suggested axis based on neighbor weights.
 */

/**
 * Service for detecting hub prototypes in overlap graphs.
 */
export class HubPrototypeDetector {
  #config;

  /**
   * Create a HubPrototypeDetector.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.hubMinDegree] - Minimum degree to be considered a hub (default: 4).
   * @param {number} [config.hubMinDegreeRatio] - Minimum degree as ratio of total nodes (default: 0.1).
   * @param {number} [config.hubMaxEdgeWeight] - Maximum edge weight threshold (default: 0.9).
   * @param {number} [config.hubMinNeighborhoodDiversity] - Minimum neighborhood diversity (default: 2).
   * @param {number} [config.hubBetweennessWeight] - Weight for betweenness centrality in hub detection (default: 0.3).
   * @param {number} [config.compositeScoreGateOverlapWeight] - Weight for gate overlap in composite (default: 0.3).
   * @param {number} [config.compositeScoreCorrelationWeight] - Weight for correlation in composite (default: 0.2).
   * @param {number} [config.compositeScoreGlobalDiffWeight] - Weight for global diff in composite (default: 0.5).
   */
  constructor(config = {}) {
    this.#config = {
      hubMinDegree: config.hubMinDegree ?? 4,
      hubMinDegreeRatio: config.hubMinDegreeRatio ?? 0.1,
      hubMaxEdgeWeight: config.hubMaxEdgeWeight ?? 0.9,
      hubMinNeighborhoodDiversity: config.hubMinNeighborhoodDiversity ?? 2,
      hubBetweennessWeight: config.hubBetweennessWeight ?? 0.3,
      compositeScoreGateOverlapWeight:
        config.compositeScoreGateOverlapWeight ?? 0.3,
      compositeScoreCorrelationWeight:
        config.compositeScoreCorrelationWeight ?? 0.2,
      compositeScoreGlobalDiffWeight:
        config.compositeScoreGlobalDiffWeight ?? 0.5,
    };
  }

  /**
   * Identify hub prototypes from pair comparison results.
   *
   * @param {Array<object>} pairResults - Array of pair comparison results.
   * @param {Map|object} [profiles] - Profile data for neighborhood diversity calculation.
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} [prototypes] - Prototype objects.
   * @returns {HubResult[]} Array of hub prototype findings.
   */
  detect(pairResults, profiles = new Map(), prototypes = []) {
    if (!Array.isArray(pairResults) || pairResults.length === 0) {
      return { hubs: [], diagnostics: this.#emptyDiagnostics() };
    }

    const graph = this.buildOverlapGraph(pairResults);
    if (graph.size === 0) {
      return { hubs: [], diagnostics: this.#emptyDiagnostics() };
    }

    // Compute adaptive hub minimum degree
    const numNodes = graph.size;
    const degreeFloor = Math.max(1, Math.floor(this.#config.hubMinDegree));
    const degreeRatio = this.#config.hubMinDegreeRatio ?? 0.1;
    const hubMinDegree = Math.max(
      degreeFloor,
      Math.floor(numNodes * degreeRatio)
    );

    const hubMaxEdgeWeight = Number.isFinite(this.#config.hubMaxEdgeWeight)
      ? this.#config.hubMaxEdgeWeight
      : 0.9;
    const hubMinNeighborhoodDiversity = Math.max(
      1,
      Math.floor(this.#config.hubMinNeighborhoodDiversity)
    );

    // Compute betweenness centrality for all nodes
    const betweenness = this.computeBetweennessCentrality(graph);

    const hubs = [];

    // Diagnostic counters
    let passedDegreeFilter = 0;
    let filteredEdgeCount = 0;
    let passedDiversityFilter = 0;

    for (const [nodeId, neighbors] of graph.entries()) {
      const rawDegree = neighbors.size;

      // Fix: Filter edges rather than disqualifying entire node
      // A hub with 10 good connections and 1 near-duplicate should still be considered
      const eligibleEdges = new Map();
      for (const [neighborId, weight] of neighbors.entries()) {
        if (weight <= hubMaxEdgeWeight) {
          eligibleEdges.set(neighborId, weight);
        }
      }

      const eligibleDegree = eligibleEdges.size;
      const excludedEdges = rawDegree - eligibleDegree;

      if (excludedEdges > 0) {
        filteredEdgeCount += excludedEdges;
      }

      // Check degree on filtered edges
      if (eligibleDegree < hubMinDegree) {
        continue;
      }
      passedDegreeFilter += 1;

      // Use filtered edges for diversity check
      const eligibleNeighborIds = Array.from(eligibleEdges.keys());
      const neighborhoodDiversity = this.#getNeighborhoodDiversity(
        eligibleNeighborIds,
        profiles
      );
      if (neighborhoodDiversity < hubMinNeighborhoodDiversity) {
        continue;
      }
      passedDiversityFilter += 1;

      // Use filtered edges for scoring
      const eligibleWeights = Array.from(eligibleEdges.values());
      const hubScore = this.computeHubScore(eligibleWeights);
      const betweennessCentrality = betweenness.get(nodeId) ?? 0;

      hubs.push({
        prototypeId: nodeId,
        hubScore,
        betweennessCentrality,
        overlappingPrototypes: eligibleNeighborIds.slice().sort(),
        neighborhoodDiversity,
        eligibleDegree,
        excludedEdges,
        suggestedAxisConcept: this.#suggestAxisConcept(
          nodeId,
          eligibleNeighborIds,
          prototypes
        ),
      });
    }

    const diagnostics = {
      totalNodes: numNodes,
      passedDegreeFilter,
      filteredEdgeCount,
      passedDiversityFilter,
      effectiveHubMinDegree: hubMinDegree,
      hubMaxEdgeWeight,
      hubMinNeighborhoodDiversity,
      hubsDetected: hubs.length,
    };

    return { hubs, diagnostics };
  }

  /**
   * Build an overlap graph from pair results.
   *
   * @param {Array<object>} pairResults - Array of pair comparison results.
   * @returns {Map<string, Map<string, number>>} Graph as adjacency map.
   */
  buildOverlapGraph(pairResults) {
    const graph = new Map();

    if (!Array.isArray(pairResults)) {
      return graph;
    }

    for (const pairResult of pairResults) {
      const { idA, idB } = this.#extractPairIds(pairResult);
      if (!idA || !idB || idA === idB) {
        continue;
      }

      const weight = this.#getEdgeWeight(pairResult);
      if (!Number.isFinite(weight) || weight <= 0) {
        continue;
      }

      this.#addEdge(graph, idA, idB, weight);
      this.#addEdge(graph, idB, idA, weight);
    }

    return graph;
  }

  /**
   * Compute betweenness centrality for all nodes using Brandes' algorithm.
   * Betweenness centrality measures how often a node lies on shortest paths.
   *
   * @param {Map<string, Map<string, number>>} graph - Adjacency map.
   * @returns {Map<string, number>} Node ID to normalized betweenness [0, 1].
   */
  computeBetweennessCentrality(graph) {
    const betweenness = new Map();
    const nodes = Array.from(graph.keys());

    // Initialize betweenness to 0 for all nodes
    for (const node of nodes) {
      betweenness.set(node, 0);
    }

    // Handle edge cases
    if (nodes.length <= 2) {
      return betweenness;
    }

    // Brandes' algorithm: run BFS from each source
    for (const source of nodes) {
      // Single-source shortest paths
      const stack = [];
      const predecessors = new Map();
      const sigma = new Map(); // Number of shortest paths
      const distance = new Map();
      const delta = new Map(); // Dependency accumulator

      for (const node of nodes) {
        predecessors.set(node, []);
        sigma.set(node, 0);
        distance.set(node, -1);
        delta.set(node, 0);
      }

      sigma.set(source, 1);
      distance.set(source, 0);

      // BFS traversal
      const queue = [source];
      while (queue.length > 0) {
        const current = queue.shift();
        stack.push(current);

        const neighbors = graph.get(current);
        if (!neighbors) continue;

        const currentDist = distance.get(current);

        for (const neighbor of neighbors.keys()) {
          // First visit - discovered via BFS
          if (distance.get(neighbor) < 0) {
            distance.set(neighbor, currentDist + 1);
            queue.push(neighbor);
          }
          // Shortest path to neighbor via current
          if (distance.get(neighbor) === currentDist + 1) {
            sigma.set(neighbor, sigma.get(neighbor) + sigma.get(current));
            predecessors.get(neighbor).push(current);
          }
        }
      }

      // Accumulate dependencies in reverse BFS order
      while (stack.length > 0) {
        const current = stack.pop();
        const preds = predecessors.get(current);

        for (const pred of preds) {
          const sigmaRatio = sigma.get(pred) / sigma.get(current);
          const deltaCurrent = delta.get(current);
          delta.set(pred, delta.get(pred) + sigmaRatio * (1 + deltaCurrent));
        }

        if (current !== source) {
          betweenness.set(
            current,
            betweenness.get(current) + delta.get(current)
          );
        }
      }
    }

    // Normalize betweenness to [0, 1]
    // For undirected graphs, divide by 2 since each pair is counted twice
    // Normalization factor: (n-1)(n-2)/2 for undirected graphs
    const n = nodes.length;
    const normFactor = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;

    let maxBetweenness = 0;
    for (const [node, value] of betweenness.entries()) {
      const normalized = value / 2 / normFactor; // Divide by 2 for undirected
      betweenness.set(node, normalized);
      if (normalized > maxBetweenness) {
        maxBetweenness = normalized;
      }
    }

    // Scale to [0, 1] based on actual max if needed
    if (maxBetweenness > 1) {
      for (const [node, value] of betweenness.entries()) {
        betweenness.set(node, value / maxBetweenness);
      }
    }

    return betweenness;
  }

  /**
   * Compute hub score from edge weights.
   * Score = degree * (1 - normalizedVariance), rewarding high connectivity with even weights.
   *
   * Edge weights are clamped to [0, 1], so maximum variance is 0.25 (achieved when
   * half the values are 0 and half are 1). We normalize variance to [0, 1] range
   * to ensure the full penalty spectrum is available.
   *
   * @param {number[]} edgeWeights - Array of edge weights.
   * @returns {number} Hub score.
   */
  computeHubScore(edgeWeights) {
    if (!Array.isArray(edgeWeights) || edgeWeights.length === 0) {
      return 0;
    }

    const degree = edgeWeights.length;
    const mean =
      edgeWeights.reduce((sum, value) => sum + value, 0) / edgeWeights.length;
    const variance =
      edgeWeights.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      edgeWeights.length;

    // Maximum variance for [0,1] bounded values is 0.25 (half 0s, half 1s)
    // Normalize to [0, 1] range for full penalty spectrum
    const MAX_VARIANCE_FOR_UNIT_INTERVAL = 0.25;
    const normalizedVariance = clamp01(variance / MAX_VARIANCE_FOR_UNIT_INTERVAL);

    const score = degree * (1 - normalizedVariance);
    return Math.max(0, score);
  }

  /**
   * Add an edge to the graph.
   *
   * @param {Map<string, Map<string, number>>} graph - Graph adjacency map.
   * @param {string} fromId - Source node ID.
   * @param {string} toId - Target node ID.
   * @param {number} weight - Edge weight.
   */
  #addEdge(graph, fromId, toId, weight) {
    if (!graph.has(fromId)) {
      graph.set(fromId, new Map());
    }
    const neighbors = graph.get(fromId);
    const existing = neighbors.get(toId);
    if (!Number.isFinite(existing) || weight > existing) {
      neighbors.set(toId, weight);
    }
  }

  /**
   * Extract pair IDs from a pair result object.
   *
   * @param {object} pairResult - Pair comparison result.
   * @returns {{idA: string|null, idB: string|null}} Extracted IDs.
   */
  #extractPairIds(pairResult) {
    const idA =
      pairResult?.prototypeAId ??
      pairResult?.prototypeA?.id ??
      pairResult?.prototypeA ??
      pairResult?.aId ??
      pairResult?.prototypes?.a ??
      null;
    const idB =
      pairResult?.prototypeBId ??
      pairResult?.prototypeB?.id ??
      pairResult?.prototypeB ??
      pairResult?.bId ??
      pairResult?.prototypes?.b ??
      null;

    return {
      idA: this.#coercePrototypeId(idA),
      idB: this.#coercePrototypeId(idB),
    };
  }

  /**
   * Coerce a prototype ID to string.
   *
   * @param {unknown} rawId - Raw ID value.
   * @returns {string|null} Coerced ID or null.
   */
  #coercePrototypeId(rawId) {
    if (typeof rawId === 'string' && rawId.length > 0) {
      return rawId;
    }
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      return String(rawId);
    }
    return null;
  }

  /**
   * Get edge weight from pair result.
   *
   * @param {object} pairResult - Pair comparison result.
   * @returns {number} Edge weight (NaN if not available).
   */
  #getEdgeWeight(pairResult) {
    const explicitWeight =
      pairResult?.overlapScore ??
      pairResult?.edgeWeight ??
      pairResult?.overlapWeight;
    if (Number.isFinite(explicitWeight)) {
      return clamp01(explicitWeight);
    }

    const metrics =
      pairResult?.classification?.metrics ?? pairResult?.metrics ?? {};
    const compositeWeight = this.#computeCompositeEdgeWeight(metrics);
    if (Number.isFinite(compositeWeight)) {
      return clamp01(compositeWeight);
    }

    if (Number.isFinite(metrics.activationJaccard)) {
      return clamp01(metrics.activationJaccard);
    }

    if (Number.isFinite(metrics.maeGlobal)) {
      return clamp01(1 - metrics.maeGlobal);
    }

    if (Number.isFinite(metrics.maeCoPass)) {
      return clamp01(1 - metrics.maeCoPass);
    }

    return NaN;
  }

  /**
   * Compute composite edge weight from metrics.
   *
   * @param {object} metrics - Pair metrics.
   * @returns {number} Composite weight (NaN if not computable).
   */
  #computeCompositeEdgeWeight(metrics) {
    const gateOverlapRatio = metrics.gateOverlapRatio;
    const pearsonCorrelation = metrics.pearsonCorrelation;
    const globalMeanAbsDiff = metrics.globalMeanAbsDiff;
    const wGate = this.#config.compositeScoreGateOverlapWeight;
    const wCorr = this.#config.compositeScoreCorrelationWeight;
    const wDiff = this.#config.compositeScoreGlobalDiffWeight;

    if (
      Number.isFinite(gateOverlapRatio) &&
      Number.isFinite(pearsonCorrelation) &&
      Number.isFinite(globalMeanAbsDiff)
    ) {
      const normalizedCorr = (pearsonCorrelation + 1) / 2;
      const clampedGlobalDiff = clamp01(globalMeanAbsDiff);
      return (
        gateOverlapRatio * wGate +
        normalizedCorr * wCorr +
        (1 - clampedGlobalDiff) * wDiff
      );
    }

    if (
      Number.isFinite(gateOverlapRatio) &&
      Number.isFinite(pearsonCorrelation)
    ) {
      const normalizedCorr = (pearsonCorrelation + 1) / 2;
      const total = wGate + wCorr;
      if (total > 0) {
        return (
          gateOverlapRatio * (wGate / total) + normalizedCorr * (wCorr / total)
        );
      }
    }

    if (Number.isFinite(gateOverlapRatio)) {
      return gateOverlapRatio;
    }

    if (Number.isFinite(pearsonCorrelation)) {
      return (pearsonCorrelation + 1) / 2;
    }

    return NaN;
  }

  /**
   * Get neighborhood diversity (distinct cluster count among neighbors).
   *
   * @param {string[]} neighborIds - Neighbor prototype IDs.
   * @param {Map|object} profiles - Profile data.
   * @returns {number} Number of distinct clusters.
   */
  #getNeighborhoodDiversity(neighborIds, profiles) {
    const clusterIds = new Set();
    for (const neighborId of neighborIds) {
      const profile = this.#getProfile(profiles, neighborId);
      const clusterId =
        profile?.nearestClusterId ?? profile?.clusterId ?? null;
      if (clusterId !== null && clusterId !== undefined) {
        clusterIds.add(clusterId);
      }
    }
    return clusterIds.size;
  }

  /**
   * Get profile for a prototype.
   *
   * @param {Map|object} profiles - Profile data.
   * @param {string} prototypeId - Prototype ID.
   * @returns {object|null} Profile or null.
   */
  #getProfile(profiles, prototypeId) {
    if (profiles instanceof Map) {
      return profiles.get(prototypeId);
    }
    if (profiles && typeof profiles === 'object') {
      return profiles[prototypeId];
    }
    return null;
  }

  /**
   * Suggest an axis concept based on neighbor weights.
   *
   * @param {string} _prototypeId - Hub prototype ID (unused).
   * @param {string[]} neighbors - Neighbor prototype IDs.
   * @param {Array} prototypes - Prototype objects.
   * @returns {string} Suggested axis name.
   */
  #suggestAxisConcept(_prototypeId, neighbors, prototypes) {
    if (!Array.isArray(prototypes) || prototypes.length === 0) {
      return 'shared overlap';
    }

    const prototypeLookup = new Map();
    for (const prototype of prototypes) {
      const id = prototype?.id ?? prototype?.prototypeId ?? null;
      if (id) {
        prototypeLookup.set(id, prototype);
      }
    }

    const axisTotals = new Map();
    const axisCounts = new Map();

    for (const neighborId of neighbors) {
      const prototype = prototypeLookup.get(neighborId);
      const weights = prototype?.weights;
      if (!weights || typeof weights !== 'object') {
        continue;
      }
      for (const [axis, value] of Object.entries(weights)) {
        if (!Number.isFinite(value)) {
          continue;
        }
        axisTotals.set(axis, (axisTotals.get(axis) ?? 0) + Math.abs(value));
        axisCounts.set(axis, (axisCounts.get(axis) ?? 0) + 1);
      }
    }

    let bestAxis = null;
    let bestScore = -Infinity;
    for (const [axis, total] of axisTotals.entries()) {
      const count = axisCounts.get(axis) ?? 0;
      if (count === 0) {
        continue;
      }
      const avg = total / count;
      if (avg > bestScore) {
        bestScore = avg;
        bestAxis = axis;
      }
    }

    return bestAxis ?? 'shared overlap';
  }


  /**
   * Create empty diagnostics object for early returns.
   *
   * @returns {object} Empty diagnostics.
   */
  #emptyDiagnostics() {
    return {
      totalNodes: 0,
      passedDegreeFilter: 0,
      filteredEdgeCount: 0,
      passedDiversityFilter: 0,
      effectiveHubMinDegree: 0,
      hubMaxEdgeWeight: 0,
      hubMinNeighborhoodDiversity: 0,
      hubsDetected: 0,
    };
  }
}
