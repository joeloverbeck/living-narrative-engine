/**
 * @file Computes emotion similarity from prototype weight vectors
 * Uses cosine similarity to find functionally related emotions
 */

/**
 * @typedef {Object} SimilarEmotion
 * @property {string} emotionName - The emotion prototype ID
 * @property {number} similarity - Cosine similarity score (0-1)
 */

/**
 * @typedef {Object} GroupSimilarityResult
 * @property {boolean} isSimilar - Whether all pairs exceed minimum similarity
 * @property {number} avgSimilarity - Average pairwise similarity
 */

class EmotionSimilarityService {
  #prototypeRegistry;
  #logger;
  #similarityCache;

  /**
   * @param {Object} deps - Dependencies
   * @param {Object} deps.prototypeRegistryService - Service for accessing emotion prototypes
   * @param {Object} [deps.logger] - Optional logger instance
   */
  constructor({ prototypeRegistryService, logger = null }) {
    if (!prototypeRegistryService) {
      throw new Error(
        'EmotionSimilarityService requires prototypeRegistryService'
      );
    }
    this.#prototypeRegistry = prototypeRegistryService;
    this.#logger = logger;
    this.#similarityCache = new Map();
  }

  /**
   * Find emotions similar to the given emotion based on weight signatures.
   * @param {string} emotionName - The emotion to find similar emotions for
   * @param {number} [minSimilarity=0.7] - Minimum cosine similarity threshold (0-1)
   * @param {number} [maxResults=3] - Maximum number of similar emotions to return
   * @returns {Array<SimilarEmotion>} Array of similar emotions sorted by similarity
   */
  findSimilarEmotions(emotionName, minSimilarity = 0.7, maxResults = 3) {
    if (!emotionName || typeof emotionName !== 'string') {
      return [];
    }

    const allPrototypes = this.#prototypeRegistry.getPrototypesByType('emotion');
    if (!Array.isArray(allPrototypes) || allPrototypes.length === 0) {
      return [];
    }

    const targetProto = allPrototypes.find((p) => p.id === emotionName);
    if (!targetProto?.weights) {
      this.#logger?.debug?.(
        `EmotionSimilarityService: No weights found for emotion "${emotionName}"`
      );
      return [];
    }

    const results = [];
    for (const proto of allPrototypes) {
      if (proto.id === emotionName || !proto.weights) {
        continue;
      }

      const cacheKey = this.#buildCacheKey(emotionName, proto.id);
      let similarity = this.#similarityCache.get(cacheKey);

      if (similarity === undefined) {
        similarity = this.#computeCosineSimilarity(
          targetProto.weights,
          proto.weights
        );
        this.#similarityCache.set(cacheKey, similarity);
      }

      if (similarity >= minSimilarity) {
        results.push({ emotionName: proto.id, similarity });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  /**
   * Compute cosine similarity between two weight vectors.
   * @param {Object} weightsA - First emotion's weights
   * @param {Object} weightsB - Second emotion's weights
   * @returns {number} Cosine similarity between 0 and 1
   */
  #computeCosineSimilarity(weightsA, weightsB) {
    if (!weightsA || !weightsB) {
      return 0;
    }

    const allAxes = new Set([
      ...Object.keys(weightsA),
      ...Object.keys(weightsB),
    ]);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const axis of allAxes) {
      const a = weightsA[axis] ?? 0;
      const b = weightsB[axis] ?? 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check if multiple emotions are functionally similar (form a coherent group).
   * @param {Array<string>} emotionNames - Emotions to check
   * @param {number} [minPairwiseSimilarity=0.5] - Minimum similarity between any pair
   * @returns {GroupSimilarityResult} Result with isSimilar flag and average similarity
   */
  checkGroupSimilarity(emotionNames, minPairwiseSimilarity = 0.5) {
    if (!Array.isArray(emotionNames) || emotionNames.length < 2) {
      return { isSimilar: false, avgSimilarity: 0 };
    }

    const allPrototypes = this.#prototypeRegistry.getPrototypesByType('emotion');
    if (!Array.isArray(allPrototypes) || allPrototypes.length === 0) {
      return { isSimilar: false, avgSimilarity: 0 };
    }

    const protoMap = new Map(allPrototypes.map((p) => [p.id, p]));

    let totalSimilarity = 0;
    let pairCount = 0;
    let allAboveThreshold = true;

    for (let i = 0; i < emotionNames.length; i++) {
      for (let j = i + 1; j < emotionNames.length; j++) {
        const protoA = protoMap.get(emotionNames[i]);
        const protoB = protoMap.get(emotionNames[j]);

        if (!protoA?.weights || !protoB?.weights) {
          allAboveThreshold = false;
          continue;
        }

        const cacheKey = this.#buildCacheKey(emotionNames[i], emotionNames[j]);
        let similarity = this.#similarityCache.get(cacheKey);

        if (similarity === undefined) {
          similarity = this.#computeCosineSimilarity(
            protoA.weights,
            protoB.weights
          );
          this.#similarityCache.set(cacheKey, similarity);
        }

        totalSimilarity += similarity;
        pairCount++;

        if (similarity < minPairwiseSimilarity) {
          allAboveThreshold = false;
        }
      }
    }

    return {
      isSimilar: allAboveThreshold && pairCount > 0,
      avgSimilarity: pairCount > 0 ? totalSimilarity / pairCount : 0,
    };
  }

  /**
   * Find emotions with a compatible axis sign direction.
   * Used to suggest alternative emotions when there's an axis sign conflict.
   * @param {string} axisName - The axis to check (e.g., 'engagement')
   * @param {'positive'|'negative'} targetSign - Desired weight sign
   * @param {number} [minWeight=0.1] - Minimum absolute weight magnitude
   * @param {number} [maxResults=3] - Maximum suggestions
   * @returns {Array<{emotionName: string, axisWeight: number}>} Emotions with compatible axis weights, sorted by magnitude
   */
  findEmotionsWithCompatibleAxisSign(
    axisName,
    targetSign,
    minWeight = 0.1,
    maxResults = 3
  ) {
    if (!axisName || typeof axisName !== 'string') {
      return [];
    }
    if (targetSign !== 'positive' && targetSign !== 'negative') {
      return [];
    }

    const allPrototypes = this.#prototypeRegistry.getPrototypesByType('emotion');
    if (!Array.isArray(allPrototypes) || allPrototypes.length === 0) {
      return [];
    }

    const results = [];
    for (const proto of allPrototypes) {
      if (!proto?.weights) {
        continue;
      }

      const weight = proto.weights[axisName];
      if (typeof weight !== 'number') {
        continue;
      }

      const absWeight = Math.abs(weight);
      if (absWeight < minWeight) {
        continue;
      }

      // Check sign compatibility
      const isPositive = weight > 0;
      const matchesSign =
        (targetSign === 'positive' && isPositive) ||
        (targetSign === 'negative' && !isPositive);

      if (matchesSign) {
        results.push({
          emotionName: proto.id,
          axisWeight: weight,
        });
      }
    }

    // Sort by absolute magnitude (descending) so strongest matches come first
    return results
      .sort((a, b) => Math.abs(b.axisWeight) - Math.abs(a.axisWeight))
      .slice(0, maxResults);
  }

  /**
   * Build a cache key for similarity lookups.
   * Ensures consistent ordering for bidirectional lookups.
   * @param {string} emotion1 - First emotion name
   * @param {string} emotion2 - Second emotion name
   * @returns {string} Cache key
   */
  #buildCacheKey(emotion1, emotion2) {
    return emotion1 < emotion2
      ? `${emotion1}:${emotion2}`
      : `${emotion2}:${emotion1}`;
  }

  /**
   * Clear the similarity cache.
   * Useful for testing or when prototypes are reloaded.
   */
  clearCache() {
    this.#similarityCache.clear();
  }
}

export default EmotionSimilarityService;
