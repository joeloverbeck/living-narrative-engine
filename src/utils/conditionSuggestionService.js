/**
 * @file Condition ID suggestion service for helpful error messages
 * @description Wraps suggestionUtils with condition-specific namespace handling.
 * Provides suggestions for missing condition IDs based on Levenshtein distance
 * with namespace-aware prioritization.
 */

import { findSimilar } from './suggestionUtils.js';

/**
 * Get suggestions for a missing condition ID
 *
 * @param {string} missingConditionId - The condition ID that was not found
 * @param {Map<string, object> | Array<string> | Array<object>} registry - Available conditions
 * @param {object} [options]
 * @param {number} [options.maxSuggestions] - Maximum suggestions to return
 * @returns {string[]} - Array of similar condition IDs, sorted by similarity
 *   (same namespace prioritized)
 * @example
 * // With array of strings
 * getSuggestions('core:actorr', ['core:actor', 'core:target', 'positioning:close'])
 * // returns ['core:actor', 'core:target']
 * @example
 * // With array of objects
 * getSuggestions('positioning:close', [
 *   { id: 'positioning:closeness' },
 *   { id: 'core:close' }
 * ])
 * // returns ['positioning:closeness', 'core:close'] (same namespace first)
 */
export function getSuggestions(missingConditionId, registry, options = {}) {
  const { maxSuggestions = 3 } = options;

  // Extract condition IDs from registry
  const conditionIds = extractConditionIds(registry);

  // Filter exact matches (shouldn't suggest the same ID)
  const candidates = conditionIds.filter(
    (id) => id.toLowerCase() !== missingConditionId.toLowerCase()
  );

  // Use existing findSimilar with namespace-aware boosting
  return findSimilarWithNamespaceBoost(missingConditionId, candidates, {
    maxSuggestions,
  });
}

/**
 * Extract condition IDs from various registry formats
 *
 * @param {Map<string, object> | Array<string> | Array<object> | null | undefined} registry
 * @returns {string[]} Array of condition ID strings
 * @private
 */
function extractConditionIds(registry) {
  if (!registry) {
    return [];
  }

  if (Array.isArray(registry)) {
    return registry
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter(Boolean);
  }

  if (registry instanceof Map) {
    return Array.from(registry.keys());
  }

  return [];
}

/**
 * Find similar strings with namespace prioritization
 *
 * @param {string} input - Input string to match
 * @param {string[]} candidates - Candidate strings
 * @param {object} options - Options
 * @param {number} options.maxSuggestions - Maximum suggestions
 * @returns {string[]} Suggestions sorted by similarity with same namespace first
 * @private
 */
function findSimilarWithNamespaceBoost(input, candidates, options) {
  // Extract namespace from input (e.g., "core:actor" -> "core")
  const inputNs = input.includes(':') ? input.split(':')[0] : null;

  // Get base results from findSimilar - get more to allow re-ranking
  const results = findSimilar(input, candidates, {
    maxDistance: 5,
    maxSuggestions: options.maxSuggestions * 2,
    caseInsensitive: true,
  });

  // If no namespace in input, return as-is
  if (!inputNs) {
    return results.slice(0, options.maxSuggestions);
  }

  // Re-rank: same namespace first
  const sameNs = results.filter((r) => r.startsWith(inputNs + ':'));
  const otherNs = results.filter((r) => !r.startsWith(inputNs + ':'));

  return [...sameNs, ...otherNs].slice(0, options.maxSuggestions);
}
