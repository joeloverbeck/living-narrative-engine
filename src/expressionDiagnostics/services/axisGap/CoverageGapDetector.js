/**
 * @file Coverage gap detection for prototype weight analysis.
 * @description Detects clusters of prototypes that are distant from all existing axes.
 */

import {
  collectAxes,
  buildPrototypeLookup,
  normalizeVector,
  computeVectorMagnitude,
  checkSubspaceGap,
} from '../../utils/vectorMathUtils.js';

/**
 * @typedef {object} CoverageGapResult
 * @property {string} clusterId - Cluster identifier.
 * @property {string[]} centroidPrototypes - Prototype IDs in the cluster.
 * @property {number} distanceToNearestAxis - Distance from centroid to nearest axis.
 * @property {Record<string, number>} suggestedAxisDirection - Normalized centroid vector.
 * @property {string} clusteringMethod - Method used ('profile-based' or 'dbscan').
 * @property {number} [clusterMagnitude] - Magnitude of cluster centroid (if magnitude-aware).
 * @property {number} [clusterSize] - Number of prototypes in cluster (if magnitude-aware).
 * @property {number} [gapScore] - Magnitude-weighted gap score (if magnitude-aware).
 * @property {Record<number, {distance: number, subspaceAxes: string[]}>} [subspaceDistances] - Distances to k-subspaces.
 */

/**
 * Service for detecting coverage gaps in prototype weight distributions.
 */
export class CoverageGapDetector {
  #config;
  #densityClusteringService;

  /**
   * Create a CoverageGapDetector.
   *
   * @param {object} [config] - Configuration options.
   * @param {string} [config.coverageGapClusteringMethod] - 'profile-based' or 'dbscan' (default: 'profile-based').
   * @param {number} [config.coverageGapAxisDistanceThreshold] - Static distance threshold (default: 0.6).
   * @param {number} [config.coverageGapMinClusterSize] - Minimum cluster size (default: 3).
   * @param {boolean} [config.enableMagnitudeAwareGapScoring] - Enable magnitude-aware scoring (default: true).
   * @param {boolean} [config.enableAdaptiveThresholds] - Enable adaptive threshold computation (default: false).
   * @param {number} [config.dbscanEpsilon] - DBSCAN epsilon parameter (default: 0.4).
   * @param {number} [config.dbscanMinPoints] - DBSCAN minPoints parameter (default: 3).
   * @param {number} [config.adaptiveThresholdSeed] - Seed for adaptive threshold RNG (default: 42).
   * @param {number} [config.coverageGapMaxSubspaceDimension] - Max k for subspace testing (default: 3).
   * @param {Record<number, number>} [config.coverageGapSubspaceThresholds] - Thresholds per subspace dimension.
   * @param {object} [densityClusteringService] - Optional DensityClusteringService for DBSCAN clustering.
   */
  constructor(config = {}, densityClusteringService = null) {
    this.#config = {
      coverageGapClusteringMethod:
        config.coverageGapClusteringMethod ?? 'profile-based',
      coverageGapAxisDistanceThreshold:
        config.coverageGapAxisDistanceThreshold ?? 0.6,
      coverageGapMinClusterSize: config.coverageGapMinClusterSize ?? 3,
      enableMagnitudeAwareGapScoring:
        config.enableMagnitudeAwareGapScoring !== false,
      enableAdaptiveThresholds: config.enableAdaptiveThresholds ?? false,
      dbscanEpsilon: config.dbscanEpsilon ?? 0.4,
      dbscanMinPoints: config.dbscanMinPoints ?? 3,
      adaptiveThresholdSeed: config.adaptiveThresholdSeed ?? 42,
      coverageGapMaxSubspaceDimension:
        config.coverageGapMaxSubspaceDimension ?? 3,
      coverageGapSubspaceThresholds: config.coverageGapSubspaceThresholds ?? {
        1: 0.6,
        2: 0.5,
        3: 0.4,
      },
    };
    this.#densityClusteringService = densityClusteringService;
  }

  /**
   * Detect coverage gaps in prototype distributions.
   *
   * @param {Map|object} profiles - Profile map with nearestClusterId/clusterId per prototype.
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @returns {CoverageGapResult[]} Array of coverage gap results.
   */
  detect(profiles, prototypes = []) {
    const axes = collectAxes(prototypes);
    if (axes.length === 0) {
      return [];
    }

    // Choose clustering method based on config
    const clusteringMethod = this.#config.coverageGapClusteringMethod;
    let clusters;

    if (clusteringMethod === 'dbscan' && this.#densityClusteringService) {
      clusters = this.#performDBSCANClustering(prototypes, axes);
    } else {
      // Default: profile-based clustering
      if (!profiles || (profiles instanceof Map && profiles.size === 0)) {
        return [];
      }
      clusters = this.extractClusters(profiles);
    }

    if (clusters.size === 0) {
      return [];
    }

    const prototypeLookup = buildPrototypeLookup(prototypes);

    const minClusterSize = Math.max(
      1,
      Math.floor(this.#config.coverageGapMinClusterSize)
    );
    const enableMagnitudeAware = this.#config.enableMagnitudeAwareGapScoring;

    const gaps = [];

    for (const [clusterId, members] of clusters.entries()) {
      const memberIds = members.filter((memberId) =>
        prototypeLookup.has(memberId)
      );
      if (memberIds.length < minClusterSize) {
        continue;
      }

      const centroid = this.computeClusterCentroid(
        memberIds,
        prototypeLookup,
        axes
      );
      if (!centroid) {
        continue;
      }

      // Compute magnitude BEFORE normalization
      const clusterMagnitude = computeVectorMagnitude(centroid);
      const clusterSize = memberIds.length;

      const suggestedAxisDirection = normalizeVector(centroid);
      if (!suggestedAxisDirection) {
        continue;
      }

      // Use multi-axis subspace distance checking
      // Gap is flagged only if distant from ALL subspace dimensions (k=1,2,...,maxK)
      const maxK = Math.min(
        this.#config.coverageGapMaxSubspaceDimension,
        axes.length
      );
      const subspaceThresholds = this.#config.coverageGapSubspaceThresholds;

      const subspaceResult = checkSubspaceGap(
        suggestedAxisDirection,
        axes,
        subspaceThresholds,
        maxK
      );

      // If not a gap in the subspace sense, skip this cluster
      if (!subspaceResult.isGap) {
        continue;
      }

      // Extract k=1 distance for backward compatibility
      const distanceToNearestAxis = subspaceResult.distances[1]?.distance ?? 1;

      // Compute magnitude-weighted gap score
      let gapScore = distanceToNearestAxis;
      if (enableMagnitudeAware && clusterMagnitude > 0) {
        // Use log1p to dampen extreme values while preserving relative ordering
        gapScore =
          distanceToNearestAxis * Math.log1p(clusterMagnitude * clusterSize);
      }

      const gapEntry = {
        clusterId,
        centroidPrototypes: memberIds.slice().sort(),
        distanceToNearestAxis,
        suggestedAxisDirection,
        clusteringMethod,
        subspaceDistances: subspaceResult.distances,
      };

      // Only include magnitude-aware fields when feature is enabled
      if (enableMagnitudeAware) {
        gapEntry.clusterMagnitude = clusterMagnitude;
        gapEntry.clusterSize = clusterSize;
        gapEntry.gapScore = gapScore;
      }

      gaps.push(gapEntry);
    }

    // Sort by gap score (highest first) when magnitude-aware
    if (enableMagnitudeAware) {
      gaps.sort((a, b) => b.gapScore - a.gapScore);
    }

    return gaps;
  }

  /**
   * Extract clusters from profile data.
   *
   * @param {Map|object} profiles - Profile data with nearestClusterId/clusterId.
   * @returns {Map<string, string[]>} Map of clusterId to member prototype IDs.
   */
  extractClusters(profiles) {
    const clusters = new Map();

    if (!profiles) {
      return clusters;
    }

    const entries =
      profiles instanceof Map ? profiles.entries() : Object.entries(profiles);

    for (const [prototypeId, profile] of entries) {
      const clusterId =
        profile?.nearestClusterId ?? profile?.clusterId ?? null;
      if (!clusterId) {
        continue;
      }
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId).push(prototypeId);
    }

    return clusters;
  }

  /**
   * Compute the centroid of a cluster.
   *
   * @param {string[]} memberIds - Array of member prototype IDs.
   * @param {Map<string, object>} prototypeLookup - Map of ID to prototype.
   * @param {string[]} axes - Array of axis names.
   * @returns {Record<string, number>|null} Centroid vector or null.
   */
  computeClusterCentroid(memberIds, prototypeLookup, axes) {
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return null;
    }
    if (!Array.isArray(axes) || axes.length === 0) {
      return null;
    }

    const totals = {};
    for (const axis of axes) {
      totals[axis] = 0;
    }

    let counted = 0;
    for (const memberId of memberIds) {
      const prototype = prototypeLookup.get(memberId);
      const weights = prototype?.weights ?? {};
      counted += 1;
      for (const axis of axes) {
        const value = weights[axis];
        if (Number.isFinite(value)) {
          totals[axis] += value;
        }
      }
    }

    if (counted === 0) {
      return null;
    }

    const centroid = {};
    for (const axis of axes) {
      centroid[axis] = totals[axis] / counted;
    }

    return centroid;
  }

  /**
   * Performs DBSCAN clustering on prototypes for coverage gap detection.
   *
   * @param {Array} prototypes - Array of prototype objects.
   * @param {string[]} axes - Array of axis names.
   * @returns {Map<string, string[]>} Cluster ID to member IDs.
   */
  #performDBSCANClustering(prototypes, axes) {
    if (!this.#densityClusteringService || !Array.isArray(prototypes)) {
      return new Map();
    }

    // Build points array for DBSCAN
    const points = prototypes.map((prototype, index) => {
      const id =
        prototype?.id ?? prototype?.prototypeId ?? `prototype-${index}`;
      const weights = prototype?.weights ?? {};

      // Build vector with all axes
      const vector = {};
      for (const axis of axes) {
        vector[axis] = Number.isFinite(weights[axis]) ? weights[axis] : 0;
      }

      return { id, vector };
    });

    const epsilon = Number.isFinite(this.#config.dbscanEpsilon)
      ? this.#config.dbscanEpsilon
      : 0.4;
    const minPoints = Number.isFinite(this.#config.dbscanMinPoints)
      ? this.#config.dbscanMinPoints
      : 3;

    return this.#densityClusteringService.cluster(points, epsilon, minPoints);
  }
}
