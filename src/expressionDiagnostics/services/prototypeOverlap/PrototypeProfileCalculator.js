/**
 * @file PrototypeProfileCalculator - Compute per-prototype profile signals.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

const DEFAULT_LOW_VOLUME_THRESHOLD = 0.05;
const DEFAULT_LOW_NOVELTY_THRESHOLD = 0.15;
const DEFAULT_SINGLE_AXIS_FOCUS_THRESHOLD = 0.6;
const DEFAULT_CLUSTER_COUNT = 10;
const DEFAULT_CLUSTERING_METHOD = 'k-means';
const DEFAULT_MAX_ITERATIONS = 10;

class PrototypeProfileCalculator {
  #logger;
  #lowVolumeThreshold;
  #lowNoveltyThreshold;
  #singleAxisFocusThreshold;
  #clusterCount;
  #clusteringMethod;
  #maxIterations;

  /**
   * Create a PrototypeProfileCalculator instance.
   *
   * @param {object} options - Constructor options.
   * @param {object} [options.config] - Configuration with thresholds.
   * @param {import('../../../interfaces/coreServices.js').ILogger} options.logger - Logger instance.
   */
  constructor({ config = {}, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#lowVolumeThreshold = Number.isFinite(config.lowVolumeThreshold)
      ? config.lowVolumeThreshold
      : DEFAULT_LOW_VOLUME_THRESHOLD;
    this.#lowNoveltyThreshold = Number.isFinite(config.lowNoveltyThreshold)
      ? config.lowNoveltyThreshold
      : DEFAULT_LOW_NOVELTY_THRESHOLD;
    this.#singleAxisFocusThreshold = Number.isFinite(
      config.singleAxisFocusThreshold
    )
      ? config.singleAxisFocusThreshold
      : DEFAULT_SINGLE_AXIS_FOCUS_THRESHOLD;
    this.#clusterCount = Number.isInteger(config.clusterCount)
      ? Math.max(1, config.clusterCount)
      : DEFAULT_CLUSTER_COUNT;
    this.#clusteringMethod =
      typeof config.clusteringMethod === 'string'
        ? config.clusteringMethod
        : DEFAULT_CLUSTERING_METHOD;
    this.#maxIterations = Number.isInteger(config.maxIterations)
      ? Math.max(1, config.maxIterations)
      : DEFAULT_MAX_ITERATIONS;

    if (this.#clusteringMethod !== 'k-means') {
      this.#logger.warn(
        'PrototypeProfileCalculator: unsupported clustering method; falling back to k-means.',
        { clusteringMethod: this.#clusteringMethod }
      );
      this.#clusteringMethod = 'k-means';
    }
  }

  /**
   * Calculate profile metrics for all prototypes.
   *
   * @param {Array<object>} prototypes - Prototype definitions.
   * @param {Map<string, PrototypeOutputVector>} outputVectors - Output vectors by prototype id.
   * @returns {Map<string, PrototypeProfile>} Profile map by prototype id.
   */
  calculateAll(prototypes, outputVectors) {
    if (!Array.isArray(prototypes)) {
      throw new Error(
        'PrototypeProfileCalculator.calculateAll expects prototypes array'
      );
    }
    if (!(outputVectors instanceof Map)) {
      throw new Error(
        'PrototypeProfileCalculator.calculateAll expects outputVectors map'
      );
    }

    const profiles = new Map();
    if (prototypes.length === 0) {
      return profiles;
    }

    const clusterCentroids = this.computeClusterCentroids(outputVectors);

    for (const prototype of prototypes) {
      const prototypeId = this.#getPrototypeId(prototype);
      const outputVector = outputVectors.get(prototypeId);
      if (!outputVector) {
        const message =
          'PrototypeProfileCalculator: missing output vector for prototype.';
        this.#logger.error(message, { prototypeId });
        throw new Error(message);
      }

      const profile = this.calculateSingle(
        prototype,
        outputVector,
        clusterCentroids
      );
      profiles.set(prototypeId, profile);
    }

    return profiles;
  }

  /**
   * Calculate profile for a single prototype.
   *
   * @param {object} prototype - Prototype definition.
   * @param {PrototypeOutputVector} outputVector - Output vector for the prototype.
   * @param {Array<{centroid: Float32Array, id: string}>} clusterCentroids - Centroids to compare against.
   * @returns {PrototypeProfile} Profile metrics for the prototype.
   */
  calculateSingle(prototype, outputVector, clusterCentroids) {
    const prototypeId = this.#getPrototypeId(prototype);
    const weights = prototype?.weights ?? {};
    this.#validateOutputVector(outputVector, prototypeId);

    const gateVolume = this.#computeGateVolume(outputVector);
    const weightEntropy = this.#computeWeightEntropy(weights);
    const weightConcentration = this.#computeWeightConcentration(weights);
    const { deltaFromNearestCenter, nearestClusterId } =
      this.#computeNearestCluster(outputVector, clusterCentroids);

    const isExpressionCandidate =
      gateVolume < this.#lowVolumeThreshold &&
      deltaFromNearestCenter < this.#lowNoveltyThreshold &&
      weightConcentration > this.#singleAxisFocusThreshold;

    return {
      prototypeId,
      gateVolume,
      weightEntropy,
      weightConcentration,
      deltaFromNearestCenter,
      nearestClusterId,
      isExpressionCandidate,
    };
  }

  /**
   * Compute cluster centroids from all output vectors.
   *
   * @param {Map<string, PrototypeOutputVector>} outputVectors - Output vectors by prototype id.
   * @returns {Array<{centroid: Float32Array, id: string}>} Cluster centroids.
   */
  computeClusterCentroids(outputVectors) {
    if (!(outputVectors instanceof Map)) {
      throw new Error(
        'PrototypeProfileCalculator.computeClusterCentroids expects outputVectors map'
      );
    }

    const vectors = Array.from(outputVectors.values());
    if (vectors.length === 0) {
      return [];
    }

    const intensityVectors = vectors.map((vector) => {
      this.#validateOutputVector(vector, vector.prototypeId);
      return vector.intensities;
    });

    const vectorLength = intensityVectors[0]?.length ?? 0;
    for (const vector of intensityVectors) {
      if (vector.length !== vectorLength) {
        const message =
          'PrototypeProfileCalculator: intensity vectors must have consistent length.';
        this.#logger.error(message, {
          expected: vectorLength,
          received: vector.length,
        });
        throw new Error(message);
      }
    }

    const centroids =
      this.#clusteringMethod === 'k-means'
        ? this.#kMeans(intensityVectors)
        : [];

    return centroids.map((centroid, index) => ({
      centroid,
      id: `cluster-${index}`,
    }));
  }

  #kMeans(intensityVectors) {
    const vectorCount = intensityVectors.length;
    if (vectorCount === 0) {
      return [];
    }

    const k = Math.min(this.#clusterCount, vectorCount);
    const vectorLength = intensityVectors[0].length;
    const centroids = [];
    for (let i = 0; i < k; i += 1) {
      centroids.push(Float32Array.from(intensityVectors[i]));
    }

    const assignments = new Array(vectorCount).fill(-1);

    for (let iter = 0; iter < this.#maxIterations; iter += 1) {
      let changed = 0;
      const sums = Array.from({ length: k }, () => new Float64Array(vectorLength));
      const counts = new Array(k).fill(0);

      for (let i = 0; i < vectorCount; i += 1) {
        const vector = intensityVectors[i];
        const nearestIndex = this.#findNearestCentroid(vector, centroids);
        if (assignments[i] !== nearestIndex) {
          changed += 1;
          assignments[i] = nearestIndex;
        }
        counts[nearestIndex] += 1;
        const sum = sums[nearestIndex];
        for (let d = 0; d < vectorLength; d += 1) {
          sum[d] += vector[d];
        }
      }

      for (let c = 0; c < k; c += 1) {
        if (counts[c] === 0) {
          continue;
        }
        const centroid = centroids[c];
        const sum = sums[c];
        for (let d = 0; d < vectorLength; d += 1) {
          centroid[d] = sum[d] / counts[c];
        }
      }

      if (changed === 0) {
        break;
      }
    }

    return centroids;
  }

  #findNearestCentroid(vector, centroids) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < centroids.length; i += 1) {
      const distance = this.#squaredDistance(vector, centroids[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  #computeNearestCluster(outputVector, clusterCentroids) {
    if (!Array.isArray(clusterCentroids) || clusterCentroids.length === 0) {
      return { deltaFromNearestCenter: NaN, nearestClusterId: '' };
    }

    const vector = outputVector.intensities;
    let bestDistance = Number.POSITIVE_INFINITY;
    let nearestClusterId = '';

    for (const cluster of clusterCentroids) {
      const distance = this.#squaredDistance(vector, cluster.centroid);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearestClusterId = cluster.id;
      }
    }

    return {
      deltaFromNearestCenter: Math.sqrt(bestDistance),
      nearestClusterId,
    };
  }

  #squaredDistance(vectorA, vectorB) {
    const length = Math.min(vectorA.length, vectorB.length);
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      const diff = vectorA[i] - vectorB[i];
      sum += diff * diff;
    }
    return sum;
  }

  #computeGateVolume(outputVector) {
    if (Number.isFinite(outputVector.activationRate)) {
      return outputVector.activationRate;
    }

    const gateResults = outputVector.gateResults;
    if (!gateResults || typeof gateResults.length !== 'number') {
      const message =
        'PrototypeProfileCalculator: outputVector must include activationRate or gateResults.';
      this.#logger.error(message, { outputVector });
      throw new Error(message);
    }

    const count = gateResults.length;
    if (count === 0) {
      return 0;
    }

    let passCount = 0;
    for (let i = 0; i < count; i += 1) {
      if (gateResults[i] > 0) {
        passCount += 1;
      }
    }
    return passCount / count;
  }

  #computeWeightEntropy(weights) {
    const values = Object.values(weights)
      .map((value) => Math.abs(value))
      .filter((value) => value > 0);
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return 0;
    }
    const probs = values.map((value) => value / sum);
    return -probs.reduce(
      (entropy, probability) =>
        entropy + (probability > 0 ? probability * Math.log2(probability) : 0),
      0
    );
  }

  #computeWeightConcentration(weights) {
    const values = Object.values(weights).map((value) => Math.abs(value));
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return 0;
    }
    return Math.max(...values) / sum;
  }

  #getPrototypeId(prototype) {
    if (!prototype || typeof prototype !== 'object') {
      const message =
        'PrototypeProfileCalculator: prototype must be an object.';
      this.#logger.error(message, { prototype });
      throw new Error(message);
    }
    const prototypeId = prototype.id;
    if (typeof prototypeId !== 'string' || prototypeId.length === 0) {
      const message =
        'PrototypeProfileCalculator: prototype.id must be a non-empty string.';
      this.#logger.error(message, { prototypeId });
      throw new Error(message);
    }
    return prototypeId;
  }

  #validateOutputVector(outputVector, prototypeId) {
    if (!outputVector || typeof outputVector !== 'object') {
      const message =
        'PrototypeProfileCalculator: outputVector must be an object.';
      this.#logger.error(message, { prototypeId, outputVector });
      throw new Error(message);
    }

    const { intensities } = outputVector;
    if (!intensities || typeof intensities.length !== 'number') {
      const message =
        'PrototypeProfileCalculator: outputVector.intensities must be array-like.';
      this.#logger.error(message, { prototypeId, intensities });
      throw new Error(message);
    }
  }
}

export default PrototypeProfileCalculator;

/**
 * @typedef {object} PrototypeProfile
 * @property {string} prototypeId
 * @property {number} gateVolume - Activation rate under broad sampling [0,1]
 * @property {number} weightEntropy - Shannon entropy of normalized |weights|
 * @property {number} weightConcentration - Max |weight| / sum |weights|
 * @property {number} deltaFromNearestCenter - L2 distance to nearest cluster centroid
 * @property {string} nearestClusterId - ID of nearest cluster centroid
 * @property {boolean} isExpressionCandidate - Low-volume + low-novelty + single-axis
 */

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId
 * @property {Float32Array} gateResults
 * @property {Float32Array} intensities
 * @property {number} activationRate
 */
