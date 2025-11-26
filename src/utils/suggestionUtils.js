/**
 * @file suggestionUtils.js
 * @description Provides fuzzy matching and "Did you mean?" suggestions using Levenshtein distance.
 * Used to provide helpful error messages when users mistype operation types or parameter names.
 */

/**
 * Calculates Levenshtein distance between two strings.
 * Uses standard dynamic programming approach.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance (minimum number of single-character edits)
 */
export function levenshteinDistance(a, b) {
  // Handle edge cases
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

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
 * Finds similar strings from a list based on Levenshtein distance.
 *
 * @param {string} input - The unknown string to match
 * @param {string[]} candidates - List of valid strings to match against
 * @param {object} [options] - Configuration options
 * @param {number} [options.maxDistance] - Maximum edit distance for suggestions (default: 3)
 * @param {number} [options.maxSuggestions] - Maximum number of suggestions to return (default: 3)
 * @param {boolean} [options.caseInsensitive] - Whether to ignore case when matching (default: true)
 * @returns {string[]} Similar strings sorted by distance (closest first)
 */
export function findSimilar(input, candidates, options = {}) {
  const {
    maxDistance = 3,
    maxSuggestions = 3,
    caseInsensitive = true,
  } = options;

  if (!input || !candidates || candidates.length === 0) {
    return [];
  }

  const normalizedInput = caseInsensitive ? input.toUpperCase() : input;

  const matches = candidates
    .map((candidate) => {
      const normalizedCandidate = caseInsensitive
        ? candidate.toUpperCase()
        : candidate;
      return {
        value: candidate,
        distance: levenshteinDistance(normalizedInput, normalizedCandidate),
      };
    })
    .filter((match) => match.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions);

  return matches.map((m) => m.value);
}

/**
 * Generates a "Did you mean?" suggestion message.
 *
 * @param {string} input - The unknown string
 * @param {string[]} candidates - List of valid strings
 * @param {object} [options] - Configuration options (passed to findSimilar)
 * @returns {string|null} Suggestion message or null if no good matches
 */
export function suggestDidYouMean(input, candidates, options = {}) {
  const similar = findSimilar(input, candidates, options);

  if (similar.length === 0) {
    return null;
  }

  if (similar.length === 1) {
    return `Did you mean "${similar[0]}"?`;
  }

  // Clone to avoid mutating original
  const suggestions = [...similar];
  const last = suggestions.pop();
  return `Did you mean "${suggestions.join('", "')}" or "${last}"?`;
}

/**
 * Suggests operation types similar to an unknown type.
 * Uses higher maxDistance since operation types are longer strings.
 *
 * @param {string} unknownType - The unknown operation type
 * @param {string[]} knownTypes - List of known operation types
 * @returns {string|null} Suggestion message or null
 */
export function suggestOperationType(unknownType, knownTypes) {
  return suggestDidYouMean(unknownType, knownTypes, {
    maxDistance: 5, // Allow more distance for operation types (longer strings like SET_COMPONENT)
    maxSuggestions: 2,
    caseInsensitive: true, // Operation types are uppercase by convention
  });
}

/**
 * Suggests parameter names similar to an unknown parameter.
 *
 * @param {string} unknownParam - The unknown parameter name
 * @param {string[]} knownParams - List of known parameter names
 * @returns {string|null} Suggestion message or null
 */
export function suggestParameterName(unknownParam, knownParams) {
  return suggestDidYouMean(unknownParam, knownParams, {
    maxDistance: 3,
    maxSuggestions: 2,
    caseInsensitive: false, // Parameter names are case-sensitive
  });
}

/**
 * Checks if a string is a likely typo of another.
 * Useful for validation hints.
 *
 * @param {string} input - Input string
 * @param {string} expected - Expected string
 * @param {number} [threshold] - Maximum distance to consider a typo (default: 2)
 * @returns {boolean} True if input is likely a typo of expected
 */
export function isLikelyTypo(input, expected, threshold = 2) {
  return (
    levenshteinDistance(input.toUpperCase(), expected.toUpperCase()) <=
    threshold
  );
}

export default {
  levenshteinDistance,
  findSimilar,
  suggestDidYouMean,
  suggestOperationType,
  suggestParameterName,
  isLikelyTypo,
};
