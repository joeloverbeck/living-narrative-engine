/**
 * @file precedenceValidator - Pattern precedence validation
 * Validates pattern precedence and warns about potential conflicts
 * @see src/anatomy/recipePatternResolver/patternResolver.js - Main resolver facade
 */

import { resolveSlotGroup } from '../matchers/groupMatcher.js';
import { resolveWildcardPattern } from '../matchers/wildcardMatcher.js';
import { resolvePropertyFilter } from '../matchers/propertyMatcher.js';

/**
 * Resolves a pattern to its matching slot keys (for precedence validation).
 *
 * @param {object} pattern - Pattern to resolve
 * @param {object} blueprint - Blueprint context
 * @param {object} deps - Dependencies {dataRegistry, slotGenerator, logger}
 * @returns {string[]} Array of slot keys
 */
function resolvePatternToKeys(pattern, blueprint, deps) {
  const { logger } = deps;

  try {
    if (pattern.matches) {
      return pattern.matches;
    } else if (pattern.matchesGroup) {
      return resolveSlotGroup(pattern.matchesGroup, blueprint, {}, deps);
    } else if (pattern.matchesPattern) {
      return resolveWildcardPattern(
        pattern.matchesPattern,
        Object.keys(blueprint.slots || {}),
        logger
      );
    } else if (pattern.matchesAll) {
      return resolvePropertyFilter(
        pattern.matchesAll,
        blueprint.slots || {},
        logger
      );
    }
    return [];
  } catch {
    // Validation errors already thrown, return empty for precedence check
    return [];
  }
}

/**
 * Gets pattern specificity score for precedence ordering.
 * Higher score = more specific.
 *
 * @param {object} pattern - Pattern to score
 * @returns {number} Specificity score (1-4)
 */
function getPatternSpecificity(pattern) {
  if (pattern.matches) return 4; // Explicit list
  if (pattern.matchesAll) return 3; // Property-based
  if (pattern.matchesPattern) return 2; // Wildcard pattern
  // At this point validation guarantees a matchesGroup pattern
  return 1;
}

/**
 * Gets human-readable pattern description.
 *
 * @param {object} pattern - Pattern to describe
 * @returns {string} Pattern description
 */
export function getPatternDescription(pattern) {
  if (pattern.matches) {
    return `matches: explicit list`;
  }

  if (pattern.matchesGroup) {
    return `matchesGroup: '${pattern.matchesGroup}'`;
  }

  if (pattern.matchesPattern) {
    return `matchesPattern: '${pattern.matchesPattern}'`;
  }

  return `matchesAll: ${JSON.stringify(pattern.matchesAll ?? {})}`;
}

/**
 * Validates pattern precedence and warns about potential conflicts.
 * Detects overlapping patterns with equal specificity.
 *
 * @param {object[]} patterns - All patterns to check
 * @param {object} blueprint - Blueprint for slot resolution
 * @param {object} deps - Dependencies {dataRegistry, slotGenerator, logger}
 */
export function validatePatternPrecedence(patterns, blueprint, deps) {
  const { logger } = deps;

  // Check for overlapping patterns
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const pattern1 = patterns[i];
      const pattern2 = patterns[j];

      // Resolve both patterns
      const keys1 = resolvePatternToKeys(pattern1, blueprint, deps);
      const keys2 = resolvePatternToKeys(pattern2, blueprint, deps);

      // Check for overlap
      const overlap = keys1.filter((k) => keys2.includes(k));

      if (overlap.length > 0) {
        const spec1 = getPatternSpecificity(pattern1);
        const spec2 = getPatternSpecificity(pattern2);

        if (spec1 === spec2) {
          const desc1 = getPatternDescription(pattern1);
          const desc2 = getPatternDescription(pattern2);

          logger.warn(
            `Pattern ${i + 1} (${desc1}) and Pattern ${j + 1} (${desc2}) have equal specificity and may match the same slots (${overlap.length} overlapping). Consider making patterns more specific.`
          );
        }
      }
    }
  }
}
