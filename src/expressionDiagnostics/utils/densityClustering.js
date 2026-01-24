/**
 * @file DBSCAN density-based clustering for axis gap detection.
 * @see specs/axis-gap-detection-spec.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} ClusterPoint
 * @property {string} id - Unique identifier for the point
 * @property {Record<string, number>} vector - Vector of axis weights
 */

/**
 * Provides DBSCAN density-based clustering with cosine distance.
 * Used as an alternative to profile-based clustering for coverage gap detection.
 */
class DensityClusteringService {
  #logger;
  #distanceFunction;

  /**
   * Create a DensityClusteringService.
   *
   * @param {object} deps - Constructor dependencies
   * @param {object} deps.logger - ILogger instance
   * @param {Function} [deps.distanceFunction] - Custom distance function (defaults to cosine)
   */
  constructor({ logger, distanceFunction = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#distanceFunction = distanceFunction ?? this.#cosineDistance.bind(this);
  }

  /**
   * Performs DBSCAN clustering on the provided points.
   *
   * @param {ClusterPoint[]} points - Array of points to cluster
   * @param {number} epsilon - Maximum distance for neighborhood membership
   * @param {number} minPoints - Minimum points required to form a core point
   * @returns {Map<string, string[]>} Map of clusterId to array of point IDs
   */
  cluster(points, epsilon, minPoints) {
    if (!Array.isArray(points) || points.length === 0) {
      return new Map();
    }

    const eps = Number.isFinite(epsilon) ? Math.max(0, epsilon) : 0.4;
    const minPts = Number.isFinite(minPoints) ? Math.max(1, Math.floor(minPoints)) : 3;

    this.#logger.debug('DensityClusteringService: Starting DBSCAN', {
      pointCount: points.length,
      epsilon: eps,
      minPoints: minPts,
    });

    // Initialize labels: -1 = unvisited, 0 = noise, >0 = cluster ID
    const labels = new Map();
    for (const point of points) {
      labels.set(point.id, -1);
    }

    // Build index for efficient neighbor lookup
    const pointsById = new Map(points.map((p) => [p.id, p]));

    let clusterId = 0;

    for (const point of points) {
      if (labels.get(point.id) !== -1) {
        continue; // Already processed
      }

      const neighbors = this.#rangeQuery(point, points, eps);

      // Standard DBSCAN: minPts includes the point itself
      // So a core point needs at least (minPts - 1) other neighbors
      if (neighbors.length + 1 < minPts) {
        labels.set(point.id, 0); // Mark as noise
        continue;
      }

      // Start new cluster
      clusterId++;
      labels.set(point.id, clusterId);

      // Expand cluster
      const seedSet = [...neighbors];
      let seedIdx = 0;

      while (seedIdx < seedSet.length) {
        const neighborId = seedSet[seedIdx];
        seedIdx++;

        const neighborLabel = labels.get(neighborId);

        if (neighborLabel === 0) {
          // Change noise to border point
          labels.set(neighborId, clusterId);
        }

        if (neighborLabel !== -1) {
          continue; // Already processed
        }

        labels.set(neighborId, clusterId);

        const neighborPoint = pointsById.get(neighborId);
        if (!neighborPoint) {
          continue;
        }

        const neighborNeighbors = this.#rangeQuery(neighborPoint, points, eps);

        // Standard DBSCAN: include point itself in count
        if (neighborNeighbors.length + 1 >= minPts) {
          // Add new neighbors to seed set (avoiding duplicates)
          for (const nn of neighborNeighbors) {
            if (!seedSet.includes(nn)) {
              seedSet.push(nn);
            }
          }
        }
      }
    }

    // Build result map
    const clusters = new Map();

    for (const [pointId, label] of labels.entries()) {
      if (label > 0) {
        const key = `cluster-${label}`;
        if (!clusters.has(key)) {
          clusters.set(key, []);
        }
        clusters.get(key).push(pointId);
      }
    }

    this.#logger.debug('DensityClusteringService: DBSCAN complete', {
      clusterCount: clusters.size,
      noiseCount: Array.from(labels.values()).filter((l) => l === 0).length,
    });

    return clusters;
  }

  /**
   * Finds all points within epsilon distance of the query point.
   *
   * @param {ClusterPoint} queryPoint - The point to find neighbors for
   * @param {ClusterPoint[]} allPoints - All points to search
   * @param {number} epsilon - Maximum distance threshold
   * @returns {string[]} Array of neighbor point IDs (excluding query point)
   */
  #rangeQuery(queryPoint, allPoints, epsilon) {
    const neighbors = [];

    for (const point of allPoints) {
      if (point.id === queryPoint.id) {
        continue;
      }

      const distance = this.#distanceFunction(queryPoint.vector, point.vector);

      if (Number.isFinite(distance) && distance <= epsilon) {
        neighbors.push(point.id);
      }
    }

    return neighbors;
  }

  /**
   * Computes cosine distance between two vectors.
   * Cosine distance = 1 - cosine similarity
   *
   * @param {Record<string, number>} vectorA - First vector
   * @param {Record<string, number>} vectorB - Second vector
   * @returns {number} Distance in range [0, 2]
   */
  #cosineDistance(vectorA, vectorB) {
    if (!vectorA || !vectorB || typeof vectorA !== 'object' || typeof vectorB !== 'object') {
      return 2; // Maximum distance for invalid inputs
    }

    // Get union of all keys
    const allKeys = new Set([...Object.keys(vectorA), ...Object.keys(vectorB)]);

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const key of allKeys) {
      const a = Number.isFinite(vectorA[key]) ? vectorA[key] : 0;
      const b = Number.isFinite(vectorB[key]) ? vectorB[key] : 0;

      dotProduct += a * b;
      magnitudeA += a * a;
      magnitudeB += b * b;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 2; // Maximum distance for zero vectors
    }

    const cosineSimilarity = dotProduct / (magnitudeA * magnitudeB);
    // Clamp to [-1, 1] to handle floating point errors
    const clampedSimilarity = Math.max(-1, Math.min(1, cosineSimilarity));

    return 1 - clampedSimilarity;
  }
}

export default DensityClusteringService;
