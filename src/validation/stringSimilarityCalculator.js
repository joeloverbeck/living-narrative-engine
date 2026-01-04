/**
 * @file String similarity calculator using Levenshtein distance
 * @description Used for providing helpful suggestions in validation errors.
 * Uses the canonical Levenshtein implementation from suggestionUtils.js.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { levenshteinDistance } from '../utils/suggestionUtils.js';

/**
 * Calculates string similarity and finds closest matches
 */
class StringSimilarityCalculator {
  /**
   * Creates a new StringSimilarityCalculator instance
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // Logger validated but not stored as it's not used in this implementation
  }

  /**
   * Calculates Levenshtein distance between two strings
   *
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  calculateDistance(str1, str2) {
    return levenshteinDistance(str1, str2);
  }

  /**
   * Finds the closest match from a list of valid values
   *
   * @param {string} input - Input string to match
   * @param {Array<string>} validValues - List of valid values
   * @param {number} maxDistance - Maximum edit distance to consider
   * @returns {string|null} Closest match or null
   */
  findClosest(input, validValues, maxDistance = 3) {
    if (!input || !validValues || validValues.length === 0) {
      return null;
    }

    const inputLower = input.toLowerCase();
    let closest = null;
    let minDistance = Infinity;

    for (const value of validValues) {
      const valueLower = value.toLowerCase();
      const distance = levenshteinDistance(inputLower, valueLower);

      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        closest = value;
      }
    }

    return closest;
  }
}

export default StringSimilarityCalculator;
