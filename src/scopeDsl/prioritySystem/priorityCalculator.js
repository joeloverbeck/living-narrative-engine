/**
 * @file Priority calculator with caching and validation for clothing coverage resolution
 * @description Optimized priority calculation system with performance enhancements
 */

import {
  COVERAGE_PRIORITY,
  LAYER_PRIORITY_WITHIN_COVERAGE,
  VALID_COVERAGE_PRIORITIES,
  VALID_LAYERS,
  PRIORITY_CONFIG,
} from './priorityConstants.js';

// Cache for pre-calculated priority scores
const PRIORITY_SCORE_CACHE = new Map();

/**
 * Calculate coverage priority score
 *
 * @param {string} coveragePriority - Coverage priority (outer, base, underwear, direct)
 * @param {string} layer - Layer type (outer, base, underwear, accessories)
 * @returns {number} Combined priority score (lower = higher priority)
 */
function calculateCoveragePriority(coveragePriority, layer) {
  const coverageScore =
    COVERAGE_PRIORITY[coveragePriority] || COVERAGE_PRIORITY.direct;
  const layerScore =
    LAYER_PRIORITY_WITHIN_COVERAGE[layer] ||
    LAYER_PRIORITY_WITHIN_COVERAGE.base;
  return coverageScore + layerScore;
}

/**
 * Get cached priority score or calculate and cache
 *
 * @param {string} coveragePriority - Coverage priority
 * @param {string} layer - Layer type
 * @returns {number} Priority score
 */
function getCachedPriorityScore(coveragePriority, layer) {
  if (!PRIORITY_CONFIG.enableCaching) {
    return calculateCoveragePriority(coveragePriority, layer);
  }

  const cacheKey = `${coveragePriority}:${layer}`;

  if (!PRIORITY_SCORE_CACHE.has(cacheKey)) {
    const score = calculateCoveragePriority(coveragePriority, layer);

    // Check cache size limit
    if (PRIORITY_SCORE_CACHE.size >= PRIORITY_CONFIG.maxCacheSize) {
      // Simple eviction: clear oldest entries (first inserted)
      const firstKey = PRIORITY_SCORE_CACHE.keys().next().value;
      PRIORITY_SCORE_CACHE.delete(firstKey);
    }

    PRIORITY_SCORE_CACHE.set(cacheKey, score);
  }

  return PRIORITY_SCORE_CACHE.get(cacheKey);
}

/**
 * Validate coverage priority and layer values
 *
 * @param {string} coveragePriority - Coverage priority to validate
 * @param {string} layer - Layer to validate
 * @param {object} logger - Optional logger for warnings
 * @returns {object} Validated values with fallbacks applied if needed
 */
function validatePriorityInputs(coveragePriority, layer, logger) {
  let validatedCoverage = coveragePriority;
  let validatedLayer = layer;

  if (!VALID_COVERAGE_PRIORITIES.includes(coveragePriority)) {
    if (logger && PRIORITY_CONFIG.logInvalidPriorities) {
      logger.warn(
        `Invalid coverage priority: ${coveragePriority}. Using '${PRIORITY_CONFIG.defaultCoveragePriority}' as fallback.`
      );
    }
    validatedCoverage = PRIORITY_CONFIG.defaultCoveragePriority;
  }

  if (!VALID_LAYERS.includes(layer)) {
    if (logger && PRIORITY_CONFIG.logInvalidPriorities) {
      logger.warn(
        `Invalid layer: ${layer}. Using '${PRIORITY_CONFIG.defaultLayer}' as fallback.`
      );
    }
    validatedLayer = PRIORITY_CONFIG.defaultLayer;
  }

  return {
    coveragePriority: validatedCoverage,
    layer: validatedLayer,
  };
}

/**
 * Optimized priority calculation with caching
 *
 * @param {string} coveragePriority - Coverage priority
 * @param {string} layer - Layer type
 * @returns {number} Priority score
 */
export function calculateCoveragePriorityOptimized(coveragePriority, layer) {
  return getCachedPriorityScore(coveragePriority, layer);
}

/**
 * Safe priority calculation with validation
 *
 * @param {string} coveragePriority - Coverage priority
 * @param {string} layer - Layer type
 * @param {object} logger - Optional logger for warnings
 * @returns {number} Priority score
 */
export function calculatePriorityWithValidation(
  coveragePriority,
  layer,
  logger
) {
  if (!PRIORITY_CONFIG.enableValidation) {
    return calculateCoveragePriorityOptimized(coveragePriority, layer);
  }

  const validated = validatePriorityInputs(coveragePriority, layer, logger);
  return calculateCoveragePriorityOptimized(
    validated.coveragePriority,
    validated.layer
  );
}

/**
 * Enhanced candidate sorting with tie-breaking
 *
 * @param {Array} candidates - Array of candidate objects to sort
 * @returns {Array} Sorted candidates (lowest priority score first)
 */
export function sortCandidatesWithTieBreaking(candidates) {
  if (!PRIORITY_CONFIG.enableTieBreaking) {
    return candidates.sort((a, b) => a.priority - b.priority);
  }

  return candidates.sort((a, b) => {
    // Primary sort: priority score (lower = higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // Tie-breaker 1: Prefer items from different slots (coverage over direct)
    if (a.source !== b.source) {
      return a.source === 'coverage' ? -1 : 1;
    }

    // Tie-breaker 2: Prefer items equipped more recently (if timestamp available)
    if (a.equipTimestamp && b.equipTimestamp) {
      return b.equipTimestamp - a.equipTimestamp;
    }

    // Final tie-breaker: Item ID alphabetical order (for consistency)
    return a.itemId.localeCompare(b.itemId);
  });
}

/**
 * Apply contextual modifiers to base priority (future enhancement)
 *
 * @param {number} basePriority - Base priority score
 * @param {object} candidate - Candidate object
 * @param {object} context - Contextual information
 * @returns {number} Adjusted priority score
 */
export function applyContextualModifiers(basePriority, candidate, context) {
  if (!PRIORITY_CONFIG.enableContextualModifiers || !context) {
    return basePriority;
  }

  let adjustedPriority = basePriority;

  // Weather-based adjustments (future enhancement)
  if (context.weather === 'cold' && candidate.coveragePriority === 'outer') {
    adjustedPriority -= 10; // Prioritize outer layers in cold weather
  }

  // Damage-based adjustments (future enhancement)
  if (candidate.damaged === true) {
    adjustedPriority += 50; // Deprioritize damaged items
  }

  // Social context adjustments (future enhancement)
  if (context.social === 'formal' && candidate.layer === 'accessories') {
    adjustedPriority -= 5; // Prioritize accessories in formal settings
  }

  return adjustedPriority;
}

/**
 * Clear the priority cache (useful for testing and memory management)
 */
export function clearPriorityCache() {
  PRIORITY_SCORE_CACHE.clear();
}

/**
 * Get cache statistics for monitoring and debugging
 *
 * @returns {object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: PRIORITY_SCORE_CACHE.size,
    maxSize: PRIORITY_CONFIG.maxCacheSize,
    enabled: PRIORITY_CONFIG.enableCaching,
    hitRate: 0, // Would need hit/miss tracking for actual implementation
  };
}

/**
 * Get layer array for a given clothing access mode
 * Replaces local LAYER_PRIORITY constants with consolidated system
 *
 * @param {string} mode - Clothing access mode
 * @returns {Array<string>} Array of layer names in priority order
 */
export function getLayersByMode(mode) {
  switch (mode) {
    case 'topmost':
    case 'all':
      return [...VALID_LAYERS]; // Create copy to avoid readonly type issues
    case 'topmost_no_accessories':
      return VALID_LAYERS.filter((layer) => layer !== 'accessories');
    case 'outer':
    case 'base':
    case 'underwear':
      return [mode]; // Single layer mode
    default:
      return [...VALID_LAYERS]; // Safe fallback to all layers
  }
}
