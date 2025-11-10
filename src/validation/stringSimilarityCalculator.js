/**
 * @file String similarity calculator using Levenshtein distance
 * Used for providing helpful suggestions in validation errors
 */

import { validateDependency } from '../utils/dependencyUtils.js';

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
    const len1 = str1.length;
    const len2 = str2.length;

    // Create distance matrix
    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }

    return matrix[len1][len2];
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
      const distance = this.calculateDistance(inputLower, valueLower);

      if (distance < minDistance && distance <= maxDistance) {
        minDistance = distance;
        closest = value;
      }
    }

    return closest;
  }
}

export default StringSimilarityCalculator;
