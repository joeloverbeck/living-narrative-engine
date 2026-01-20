/**
 * @file OverconstrainedConjunctionBuilder - Generates overconstrained conjunction recommendations.
 * @description Extracted from RecommendationEngine to handle the complex logic for
 * generating suggestions when multiple emotion thresholds are ANDed together,
 * each with low pass rates, resulting in extremely low joint probability.
 *
 * Recommendation logic:
 *   - Always suggests 2-of-N rule as alternative
 *   - Optionally suggests OR-softening with similar emotions (if EmotionSimilarityService available)
 *   - Optionally identifies functionally similar emotion groups
 *
 * @see RecommendationEngine.js (orchestrator that delegates to this builder)
 */

/**
 * Builder class for overconstrained_conjunction recommendations.
 *
 * Responsible for:
 * - Building complete overconstrained_conjunction recommendation objects
 * - Generating 2-of-N rule suggestions
 * - Providing OR-softening suggestions with similar emotions (when service available)
 * - Identifying functionally similar emotion groups
 *
 * Optionally depends on EmotionSimilarityService for enhanced suggestions.
 */
class OverconstrainedConjunctionBuilder {
  #emotionSimilarityService;

  /**
   * @param {object} [options]
   * @param {object} [options.emotionSimilarityService] - Optional service for finding similar emotions.
   */
  constructor({ emotionSimilarityService = null } = {}) {
    this.#emotionSimilarityService = emotionSimilarityService;
  }

  /**
   * Build an overconstrained_conjunction recommendation from diagnostic info.
   *
   * @param {object} info - Overconstrained detail object from DiagnosticFacts.
   * @param {string} info.andNodeId - ID of the AND node.
   * @param {Array} info.lowPassChildren - Array of children with low pass rates.
   * @param {number} info.naiveJointProbability - The naive joint probability.
   * @returns {object} The complete recommendation object.
   */
  build(info) {
    const suggestions = this.#buildSuggestions(info);

    return {
      id: `overconstrained_conjunction:${info.andNodeId}`,
      type: 'overconstrained_conjunction',
      severity: 'high',
      confidence: 'high',
      title: 'Overconstrained Conjunction Detected',
      why:
        `${info.lowPassChildren.length} emotion thresholds are ANDed together, ` +
        `each with <10% pass rate. Joint probability: ${(info.naiveJointProbability * 100).toFixed(4)}%`,
      evidence: info.lowPassChildren.map((c) => ({
        metric: c.clauseId,
        value: c.passRate,
        label: `pass rate: ${(c.passRate * 100).toFixed(1)}%`,
      })),
      actions: suggestions,
      predictedEffect:
        'Switching to (2-of-N) or OR-softening can dramatically improve trigger probability.',
      relatedClauseIds: info.lowPassChildren.map((c) => c.clauseId),
      naiveJointProbability: info.naiveJointProbability,
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Build suggestions array for overconstrained conjunction.
   *
   * @param {object} info - Overconstrained detail object.
   * @returns {Array<string>} Array of suggestion strings.
   */
  #buildSuggestions(info) {
    const suggestions = [];
    const n = info.lowPassChildren.length;

    // Suggestion 1: 2-of-N rule (always applicable)
    suggestions.push(
      `Consider a (2-of-${n}) rule: require any 2 of the ${n} conditions instead of all ${n}.`
    );

    // Suggestion 2: OR-softening with similar emotions (derived from weight vectors)
    if (this.#emotionSimilarityService) {
      for (const child of info.lowPassChildren) {
        const similar = this.#emotionSimilarityService.findSimilarEmotions(
          child.emotionName,
          0.7, // minSimilarity threshold
          2 // maxResults
        );

        if (similar.length > 0) {
          const example = similar[0];
          const thresholdStr =
            child.threshold !== null && child.threshold !== undefined
              ? child.threshold
              : '0.X';
          suggestions.push(
            `OR-soften ${child.emotionName}: Replace \`${child.emotionName} ${child.operator} ${thresholdStr}\` ` +
              `with \`(${child.emotionName} ${child.operator} ${thresholdStr} OR ${example.emotionName} >= ${thresholdStr})\` ` +
              `(similarity: ${(example.similarity * 100).toFixed(0)}%)`
          );
        }
      }

      // Suggestion 3: Check if the emotions form a functionally similar group
      const emotionNames = info.lowPassChildren.map((c) => c.emotionName);
      const groupCheck = this.#emotionSimilarityService.checkGroupSimilarity(
        emotionNames,
        0.5
      );

      if (groupCheck.isSimilar) {
        suggestions.push(
          `These ${n} emotions have similar weight signatures (avg similarity: ${(groupCheck.avgSimilarity * 100).toFixed(0)}%). ` +
            `Consider requiring any ${Math.ceil(n / 2)} of them instead of all ${n}.`
        );
      }
    }

    return suggestions;
  }
}

export default OverconstrainedConjunctionBuilder;
