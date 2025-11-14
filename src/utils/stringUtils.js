/**
 * @file String manipulation utilities for fuzzy matching and similarity analysis
 */

/**
 * Calculate Levenshtein distance between two strings.
 * Uses dynamic programming to compute the minimum number of single-character
 * edits (insertions, deletions, or substitutions) required to change one string into another.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance between the two strings
 * @example
 * levenshteinDistance('kitten', 'sitting') // returns 3
 * levenshteinDistance('test', 'test') // returns 0
 */
export function levenshteinDistance(a, b) {
  const matrix = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find the closest string matches from a list of candidates.
 * Returns candidates within the specified edit distance threshold,
 * sorted by their similarity to the target string.
 *
 * @param {string} target - Target string to match against
 * @param {string[]} candidates - Array of candidate strings to search
 * @param {number} [maxDistance] - Maximum edit distance threshold for matches (default: 3)
 * @returns {string[]} Array of matching strings sorted by edit distance (closest first)
 * @example
 * findClosestMatches('test', ['test', 'best', 'rest', 'fest'], 1)
 * // returns ['test', 'best', 'rest', 'fest']
 *
 * findClosestMatches('test', ['hello', 'world'], 3)
 * // returns [] (no matches within distance 3)
 */
export function findClosestMatches(target, candidates, maxDistance = 3) {
  return candidates
    .map((candidate) => ({
      value: candidate,
      distance: levenshteinDistance(target, candidate),
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.value);
}
