/**
 * @file Hub prototype detection for overlap graph analysis.
 * @description Identifies prototype nodes that connect multiple clusters in the overlap graph.
 */

import { clamp01 } from '../../utils/vectorMathUtils.js';

/**
 * @typedef {object} HubResult
 * @property {string} prototypeId - Hub prototype identifier.
 * @property {number} hubScore - Hub score based on degree and edge weight variance.
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
   * @param {number} [config.hubMaxEdgeWeight] - Maximum edge weight threshold (default: 0.9).
   * @param {number} [config.hubMinNeighborhoodDiversity] - Minimum neighborhood diversity (default: 2).
   * @param {number} [config.compositeScoreGateOverlapWeight] - Weight for gate overlap in composite (default: 0.3).
   * @param {number} [config.compositeScoreCorrelationWeight] - Weight for correlation in composite (default: 0.2).
   * @param {number} [config.compositeScoreGlobalDiffWeight] - Weight for global diff in composite (default: 0.5).
   */
  constructor(config = {}) {
    this.#config = {
      hubMinDegree: config.hubMinDegree ?? 4,
      hubMaxEdgeWeight: config.hubMaxEdgeWeight ?? 0.9,
      hubMinNeighborhoodDiversity: config.hubMinNeighborhoodDiversity ?? 2,
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
      return [];
    }

    const graph = this.buildOverlapGraph(pairResults);
    if (graph.size === 0) {
      return [];
    }

    const hubMinDegree = Math.max(1, Math.floor(this.#config.hubMinDegree));
    const hubMaxEdgeWeight = Number.isFinite(this.#config.hubMaxEdgeWeight)
      ? this.#config.hubMaxEdgeWeight
      : 0.9;
    const hubMinNeighborhoodDiversity = Math.max(
      1,
      Math.floor(this.#config.hubMinNeighborhoodDiversity)
    );

    const hubs = [];

    for (const [nodeId, neighbors] of graph.entries()) {
      const neighborIds = Array.from(neighbors.keys());
      const degree = neighborIds.length;
      if (degree < hubMinDegree) {
        continue;
      }

      const edgeWeights = Array.from(neighbors.values());
      if (edgeWeights.some((weight) => weight > hubMaxEdgeWeight)) {
        continue;
      }

      const neighborhoodDiversity = this.#getNeighborhoodDiversity(
        neighborIds,
        profiles
      );
      if (neighborhoodDiversity < hubMinNeighborhoodDiversity) {
        continue;
      }

      const hubScore = this.computeHubScore(edgeWeights);

      hubs.push({
        prototypeId: nodeId,
        hubScore,
        overlappingPrototypes: neighborIds.slice().sort(),
        neighborhoodDiversity,
        suggestedAxisConcept: this.#suggestAxisConcept(
          nodeId,
          neighborIds,
          prototypes
        ),
      });
    }

    return hubs;
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
   * Compute hub score from edge weights.
   * Score = degree * (1 - variance), rewarding high connectivity with even weights.
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
    const clampedVariance = clamp01(variance);
    const score = degree * (1 - clampedVariance);
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
   * @param {*} rawId - Raw ID value.
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
}
