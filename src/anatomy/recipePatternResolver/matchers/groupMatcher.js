/**
 * @file groupMatcher - Slot group resolution for recipe pattern matching
 * Handles matchesGroup patterns like "limbSet:leg", "appendage:tail"
 * @see src/anatomy/recipePatternResolver.js - Parent resolver
 */

import { assertNonBlankString, assertPresent } from '../../../utils/dependencyUtils.js';
import { ValidationError } from '../../../errors/validationError.js';

/**
 * Resolves slots matching a group pattern (limbSet:*, appendage:*)
 *
 * Format: "limbSet:leg" or "appendage:tail"
 *
 * @param {string} groupRef - Group reference (e.g., 'limbSet:leg')
 * @param {object} blueprint - Blueprint with structure template
 * @param {object} options - Options {throwOnZeroMatches, allowMissing}
 * @param {object} deps - Dependencies {dataRegistry, slotGenerator, logger}
 * @returns {string[]} Array of matching slot keys
 */
export function resolveSlotGroup(groupRef, blueprint, options = {}, deps) {
  const { throwOnZeroMatches = true, allowMissing = false } = options;
  const { dataRegistry, slotGenerator, logger } = deps;

  assertNonBlankString(
    groupRef,
    'Group reference',
    'resolveSlotGroup',
    logger
  );

  if (!blueprint.structureTemplate) {
    const message = `Cannot resolve slot group '${groupRef}': blueprint has no structure template`;
    logger.warn(message);
    if (allowMissing) {
      return [];
    }
    throw new ValidationError(message);
  }

  // Load structure template from DataRegistry
  const template = dataRegistry.get(
    'anatomyStructureTemplates',
    blueprint.structureTemplate
  );

  if (!template) {
    throw new ValidationError(
      `Structure template not found: ${blueprint.structureTemplate}`
    );
  }

  const [groupType, groupName] = groupRef.split(':');

  if (!groupType || !groupName) {
    throw new ValidationError(
      `Invalid slot group reference format: '${groupRef}'`
    );
  }

  if (groupType !== 'limbSet' && groupType !== 'appendage') {
    throw new ValidationError(
      `Invalid slot group type: '${groupType}'. Expected 'limbSet' or 'appendage'`
    );
  }

  const slotKeys = [];
  let availableGroups = [];
  let hasMatchingDefinitions = false;

  if (groupType === 'limbSet') {
    const limbSets = Array.isArray(template.topology?.limbSets)
      ? template.topology.limbSets
      : [];
    const matchingLimbSets = limbSets.filter(ls => ls.type === groupName);
    availableGroups = limbSets.map(ls => `limbSet:${ls.type}`);
    hasMatchingDefinitions = matchingLimbSets.length > 0;

    logger.debug(
      `Found ${matchingLimbSets.length} limb sets matching type '${groupName}'`
    );

    for (const limbSet of matchingLimbSets) {
      const keys = generateSlotKeysFromLimbSet(limbSet, slotGenerator);
      slotKeys.push(...keys);
    }
  } else if (groupType === 'appendage') {
    const appendages = Array.isArray(template.topology?.appendages)
      ? template.topology.appendages
      : [];
    const matchingAppendages = appendages.filter(a => a.type === groupName);
    availableGroups = appendages.map(a => `appendage:${a.type}`);
    hasMatchingDefinitions = matchingAppendages.length > 0;

    logger.debug(
      `Found ${matchingAppendages.length} appendages matching type '${groupName}'`
    );

    for (const appendage of matchingAppendages) {
      const keys = generateSlotKeysFromAppendage(appendage, slotGenerator);
      slotKeys.push(...keys);
    }
  }

  if (slotKeys.length === 0) {
    if (!hasMatchingDefinitions) {
      if (allowMissing) {
        return [];
      }
      const availableSummary =
        availableGroups.length > 0
          ? ` Available groups: ${availableGroups
              .map(group => `'${group}'`)
              .join(', ')}.`
          : '';

      throw new ValidationError(
        `Slot group '${groupRef}' not found in structure template '${blueprint.structureTemplate}'.${availableSummary}`
      );
    }

    if (throwOnZeroMatches) {
      throw new ValidationError(
        `Slot group '${groupRef}' matched 0 slots in structure template '${blueprint.structureTemplate}'.`
      );
    }

    return [];
  }

  return slotKeys;
}

/**
 * Validates matchesGroup pattern
 * Checks group format, existence in template, and match count
 *
 * @param {object} pattern - Pattern with matchesGroup property
 * @param {object} blueprint - Blueprint with structure template
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} deps - Dependencies {dataRegistry, logger}
 * @throws {ValidationError} If pattern is invalid
 */
export function validateMatchesGroup(pattern, blueprint, patternIndex, deps) {
  const { dataRegistry } = deps;
  const groupRef = pattern.matchesGroup;

  // Validate format
  const [groupType, groupName] = groupRef.split(':');

  if (!groupType || !groupName) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: Slot group '${groupRef}' format invalid. Expected 'limbSet:{type}' or 'appendage:{type}'.`
    );
  }

  if (groupType !== 'limbSet' && groupType !== 'appendage') {
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: Slot group '${groupRef}' format invalid. Expected 'limbSet:{type}' or 'appendage:{type}'.`
    );
  }

  // Load structure template
  const template = dataRegistry.get(
    'anatomyStructureTemplates',
    blueprint.structureTemplate
  );

  // Check group exists in template
  let groupExists = false;
  const availableGroups = [];

  const topology = template?.topology;

  if (groupType === 'limbSet') {
    const limbSets = Array.isArray(topology?.limbSets)
      ? topology.limbSets
      : [];
    groupExists = limbSets.some(ls => ls.type === groupName);
    availableGroups.push(
      ...limbSets.map(ls => `limbSet:${ls.type}`)
    );
  } else {
    const appendages = Array.isArray(topology?.appendages)
      ? topology.appendages
      : [];
    groupExists = appendages.some(a => a.type === groupName);
    availableGroups.push(
      ...appendages.map(a => `appendage:${a.type}`)
    );
  }

  if (!groupExists) {
    const availableStr = availableGroups.length > 0
      ? ` Available groups: ${availableGroups.map(g => `'${g}'`).join(', ')}`
      : '';
    throw new ValidationError(
      `Pattern ${patternIndex + 1}: Slot group '${groupRef}' not found in structure template '${blueprint.structureTemplate}'.${availableStr}`
    );
  }

  try {
    // Need to pass slotGenerator for validation
    resolveSlotGroup(groupRef, blueprint, {
      throwOnZeroMatches: false,
      allowMissing: true,
    }, deps);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(
        `Pattern ${patternIndex + 1}: ${error.message}`
      );
    }

    throw error;
  }
}

/**
 * Generates slot keys from limb set definition
 *
 * @param {object} limbSet - Limb set definition from structure template
 * @param {object} slotGenerator - Slot generator instance
 * @returns {string[]} Array of slot keys
 * @private
 */
function generateSlotKeysFromLimbSet(limbSet, slotGenerator) {
  assertPresent(limbSet, 'Limb set is required');

  // Leverage existing SlotGenerator logic
  return slotGenerator.extractSlotKeysFromLimbSet(limbSet);
}

/**
 * Generates slot keys from appendage definition
 *
 * @param {object} appendage - Appendage definition from structure template
 * @param {object} slotGenerator - Slot generator instance
 * @returns {string[]} Array of slot keys
 * @private
 */
function generateSlotKeysFromAppendage(appendage, slotGenerator) {
  assertPresent(appendage, 'Appendage is required');

  // Leverage existing SlotGenerator logic
  return slotGenerator.extractSlotKeysFromAppendage(appendage);
}
