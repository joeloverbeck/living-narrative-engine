/**
 * @file exclusionValidator - Exclusion validation and application for recipe patterns
 * Validates and applies exclusion criteria to filter slots
 * @see src/anatomy/recipePatternResolver/patternResolver.js - Main resolver facade
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';
import { ValidationError } from '../../../errors/validationError.js';
import { resolveSlotGroup } from '../matchers/groupMatcher.js';

/**
 * Validates pattern exclusions.
 * Checks excluded slot groups exist and exclusion properties are valid.
 *
 * @param {object} pattern - Pattern with exclude property
 * @param {object} blueprint - Blueprint for slot group resolution
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} dataRegistry - DataRegistry for template lookup
 * @throws {ValidationError} If exclusions are invalid
 */
export function validateExclusions(
  pattern,
  blueprint,
  patternIndex,
  dataRegistry
) {
  const exclusions = pattern.exclude;

  // Validate excluded slot groups
  if (exclusions.slotGroups && Array.isArray(exclusions.slotGroups)) {
    const template = dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    for (const groupRef of exclusions.slotGroups) {
      const [groupType, groupName] = groupRef.split(':');

      let groupExists = false;
      const topology = template?.topology;

      if (groupType === 'limbSet') {
        const limbSets = Array.isArray(topology?.limbSets)
          ? topology.limbSets
          : [];
        groupExists = limbSets.some((ls) => ls.type === groupName);
      } else {
        const appendages = Array.isArray(topology?.appendages)
          ? topology.appendages
          : [];
        groupExists = appendages.some((a) => a.type === groupName);
      }

      if (!groupExists) {
        throw new ValidationError(
          `Pattern ${patternIndex + 1}: Exclusion slot group '${groupRef}' not found in structure template.`
        );
      }
    }
  }

  // Validate exclusion properties
  if (exclusions.properties !== undefined) {
    if (
      exclusions.properties === null ||
      typeof exclusions.properties !== 'object' ||
      Array.isArray(exclusions.properties)
    ) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: Exclusion property filter must be a valid object with slot properties.`
      );
    }
  }
}

/**
 * Applies pattern exclusions to filter out unwanted slots.
 *
 * Supports:
 * - slotGroups: Array of group references to exclude
 * - properties: Property-based exclusion criteria
 *
 * @param {string[]} slotKeys - Slot keys to filter
 * @param {object} exclusions - Exclusion criteria
 * @param {object} blueprint - Blueprint for resolving slot groups
 * @param {object} deps - Dependencies {dataRegistry, slotGenerator, logger}
 * @returns {string[]} Filtered slot keys
 */
export function applyExclusions(slotKeys, exclusions, blueprint, deps) {
  const { logger } = deps;

  assertPresent(slotKeys, 'Slot keys are required');
  assertPresent(exclusions, 'Exclusions are required');

  let filtered = [...slotKeys];

  // Exclude slot groups
  if (exclusions.slotGroups && Array.isArray(exclusions.slotGroups)) {
    for (const groupRef of exclusions.slotGroups) {
      const excludedKeys = resolveSlotGroup(groupRef, blueprint, {}, deps);
      filtered = filtered.filter((key) => !excludedKeys.includes(key));
      logger.debug(
        `Excluded ${excludedKeys.length} slots from group '${groupRef}'`
      );
    }
  }

  // Exclude by properties
  if (exclusions.properties && blueprint.slots) {
    filtered = filtered.filter((key) => {
      const slotDef = blueprint.slots[key];
      if (!slotDef) return true;

      for (const [prop, value] of Object.entries(exclusions.properties)) {
        if (slotDef[prop] === value) {
          logger.debug(
            `Excluding slot '${key}' due to property ${prop}=${value}`
          );
          return false;
        }
      }
      return true;
    });
  }

  return filtered;
}
