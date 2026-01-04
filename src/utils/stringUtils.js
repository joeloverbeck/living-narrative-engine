/**
 * @file String manipulation utilities for fuzzy matching and similarity analysis
 * @description Re-exports Levenshtein distance from suggestionUtils for backward compatibility.
 * The canonical implementation lives in suggestionUtils.js - this file provides
 * a stable API for existing consumers.
 */

import { levenshteinDistance as levenshteinDistanceImpl } from './suggestionUtils.js';

// Re-export Levenshtein distance from the canonical source
export { levenshteinDistance } from './suggestionUtils.js';

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
      distance: levenshteinDistanceImpl(target, candidate),
    }))
    .filter((item) => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.value);
}
