/**
 * @file propertyMatcher - Property-based filtering for recipe slot resolution
 * Handles matchesAll patterns with slotType, orientation, socketId filters
 * @see src/anatomy/recipePatternResolver.js - Parent resolver
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';
import { ValidationError } from '../../../errors/validationError.js';
import { wildcardToRegex } from './wildcardMatcher.js';

/**
 * Resolves slots matching property filters (slotType, orientation, socketId)
 *
 * Filters slots by:
 * - slotType: Exact match on slot's partType requirement
 * - orientation: Pattern match on slot's orientation (supports wildcards)
 * - socketId: Pattern match on slot's socket (supports wildcards)
 *
 * @param {object} filter - Filter criteria object
 * @param {object} blueprintSlots - Blueprint's slot definitions
 * @param {object} logger - Logger instance
 * @returns {string[]} Array of matching slot keys
 */
export function resolvePropertyFilter(filter, blueprintSlots, logger) {
  assertPresent(filter, 'Filter is required');
  assertPresent(blueprintSlots, 'Blueprint slots are required');

  const matchedKeys = [];

  for (const [slotKey, slotDef] of Object.entries(blueprintSlots)) {
    let matches = true;

    // Filter by slotType (exact match on partType requirement)
    if (
      filter.slotType &&
      slotDef.requirements?.partType !== filter.slotType
    ) {
      matches = false;
    }

    // Filter by orientation (with wildcard support)
    if (filter.orientation && slotDef.orientation) {
      const orientationRegex = wildcardToRegex(filter.orientation);
      if (!orientationRegex.test(slotDef.orientation)) {
        matches = false;
      }
    } else if (filter.orientation && !slotDef.orientation) {
      // Filter specifies orientation but slot has none
      matches = false;
    }

    // Filter by socketId (with wildcard support)
    if (filter.socketId && slotDef.socket) {
      const socketRegex = wildcardToRegex(filter.socketId);
      if (!socketRegex.test(slotDef.socket)) {
        matches = false;
      }
    } else if (filter.socketId && !slotDef.socket) {
      // Filter specifies socket but slot has none
      matches = false;
    }

    if (matches) {
      matchedKeys.push(slotKey);
    }
  }

  logger.debug(
    `Property filter matched ${matchedKeys.length} of ${Object.keys(blueprintSlots).length} slots`
  );

  return matchedKeys;
}

/**
 * Validates matchesAll property-based filter
 * Checks at least one filter property exists, validates wildcard usage
 *
 * @param {object} pattern - Pattern with matchesAll property
 * @param {object} blueprint - Blueprint context
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} logger - Logger instance
 * @throws {ValidationError} If pattern is invalid or has unsupported properties
 */
export function validateMatchesAll(pattern, blueprint, patternIndex, logger) {
  const filter = pattern.matchesAll;

  // Check at least one filter property
  const filterProps = ['slotType', 'orientation', 'socketId'];
  const presentProps = filterProps.filter(p => filter[p] !== undefined);

  if (presentProps.length === 0) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: matchesAll must have at least one filter property: 'slotType', 'orientation', or 'socketId'.`
    );
  }

  // Validate wildcard restrictions: slotType doesn't support wildcards
  if (filter.slotType && typeof filter.slotType === 'string' && filter.slotType.includes('*')) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: matchesAll wildcard pattern on 'slotType' is not supported. Wildcards only work on 'orientation' and 'socketId'.`
    );
  }

  const matchedKeys = resolvePropertyFilter(
    filter,
    blueprint.slots || {},
    logger
  );

  if (matchedKeys.length === 0) {
    return;
  }
}
