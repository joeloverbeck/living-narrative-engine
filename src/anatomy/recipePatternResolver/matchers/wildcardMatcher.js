/**
 * @file wildcardMatcher - Wildcard pattern matching for recipe slot resolution
 * Handles matchesPattern patterns like "leg_*", "*_left", "*tentacle*"
 * @see src/anatomy/recipePatternResolver.js - Parent resolver
 */

import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';
import { ValidationError } from '../../../errors/validationError.js';

/**
 * Resolves slots matching a wildcard pattern (leg_*, *_left, *tentacle*)
 *
 * @param {string} pattern - Wildcard pattern string
 * @param {string[]} slotKeys - Available slot keys to match against
 * @param {object} logger - Logger instance
 * @returns {string[]} Array of matching slot keys
 */
export function resolveWildcardPattern(pattern, slotKeys, logger) {
  assertNonBlankString(
    pattern,
    'Pattern',
    'resolveWildcardPattern',
    logger
  );
  assertPresent(slotKeys, 'Slot keys array is required');

  const regex = wildcardToRegex(pattern);
  const matches = slotKeys.filter(key => regex.test(key));

  logger.debug(
    `Wildcard pattern '${pattern}' matched ${matches.length} of ${slotKeys.length} slots`
  );

  return matches;
}

/**
 * Validates matchesPattern wildcard pattern
 *
 * @param {object} pattern - Pattern with matchesPattern property
 * @param {object} blueprint - Blueprint context
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} logger - Logger instance
 * @throws {ValidationError} If pattern is invalid
 */
export function validateMatchesPattern(pattern, blueprint, patternIndex, logger) {
  const patternStr = pattern.matchesPattern;

  // Check pattern is non-empty string
  if (typeof patternStr !== 'string' || patternStr.length === 0) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: Pattern must be a non-empty string`
    );
  }

  const blueprintSlotKeys = Object.keys(blueprint.slots || {});
  const matchedKeys = resolveWildcardPattern(
    patternStr,
    blueprintSlotKeys,
    logger
  );

  if (matchedKeys.length === 0) {
    return;
  }
}

/**
 * Converts wildcard pattern to regular expression
 * Escapes regex special characters and replaces * with .*
 *
 * @param {string} pattern - Wildcard pattern (e.g., "leg_*", "*_left")
 * @returns {RegExp} Compiled regular expression
 */
export function wildcardToRegex(pattern) {
  // Escape all regex special characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Replace * with .*
  const regexPattern = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`);
}
