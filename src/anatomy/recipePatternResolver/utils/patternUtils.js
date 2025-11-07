/**
 * @file patternUtils - Utility functions for pattern manipulation
 * Common helper functions for pattern type detection and analysis
 * @see src/anatomy/recipePatternResolver/patternResolver.js - Main resolver facade
 */

/**
 * Determines whether a pattern currently exposes a matcher definition.
 *
 * @param {object} pattern - Pattern definition to inspect
 * @returns {boolean} True when any matcher is defined
 */
export function hasMatcher(pattern) {
  if (Array.isArray(pattern.matches) && pattern.matches.length > 0) {
    return true;
  }

  if (pattern.matchesGroup !== undefined) {
    return true;
  }

  if (pattern.matchesPattern !== undefined) {
    return true;
  }

  return pattern.matchesAll !== undefined;
}

/**
 * Detects which matcher type a pattern uses.
 *
 * @param {object} pattern - Pattern to analyze
 * @returns {string|null} Matcher type ('matches', 'matchesGroup', 'matchesPattern', 'matchesAll') or null
 */
export function detectMatcherType(pattern) {
  if (Array.isArray(pattern.matches) && pattern.matches.length > 0) {
    return 'matches';
  }

  if (pattern.matchesGroup !== undefined) {
    return 'matchesGroup';
  }

  if (pattern.matchesPattern !== undefined) {
    return 'matchesPattern';
  }

  if (pattern.matchesAll !== undefined) {
    return 'matchesAll';
  }

  return null;
}
