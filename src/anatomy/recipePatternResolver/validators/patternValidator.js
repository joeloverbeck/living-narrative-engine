/**
 * @file patternValidator - Pattern validation functions for recipe pattern resolution
 * Validates pattern mutual exclusivity and blueprint version compatibility
 * @see src/anatomy/recipePatternResolver/patternResolver.js - Main resolver facade
 */

import { ValidationError } from '../../../errors/validationError.js';

/**
 * Validates that pattern uses exactly one matcher type.
 * Ensures mutual exclusivity of matches, matchesGroup, matchesPattern, matchesAll.
 *
 * @param {object} pattern - Pattern definition to validate
 * @param {number} patternIndex - Pattern index for error messages
 * @throws {ValidationError} If pattern has multiple or no matchers
 */
export function validatePatternMutualExclusivity(pattern, patternIndex) {
  const matchers = ['matches', 'matchesGroup', 'matchesPattern', 'matchesAll'];
  const presentMatchers = matchers.filter((m) => pattern[m] !== undefined);

  if (presentMatchers.length === 0) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1} has no matcher: must specify exactly one of 'matches', 'matchesGroup', 'matchesPattern', or 'matchesAll'.`
    );
  }

  if (presentMatchers.length > 1) {
    throw new ValidationError(
      `Pattern ${patternIndex + 1} has multiple matchers: found ${presentMatchers.map((m) => `'${m}'`).join(' and ')}. Only one is allowed per pattern.`
    );
  }
}

/**
 * Validates blueprint version compatibility with pattern type.
 * V2 patterns require schemaVersion: "2.0" and structureTemplate.
 *
 * @param {object} pattern - Pattern definition to validate
 * @param {object} blueprint - Blueprint to check version
 * @param {number} patternIndex - Pattern index for error messages
 * @param {object} dataRegistry - DataRegistry for template lookup
 * @throws {ValidationError} If version requirements not met
 */
export function validateBlueprintVersion(
  pattern,
  blueprint,
  patternIndex,
  dataRegistry
) {
  // Only matchesGroup requires V2 blueprint with structure template
  // matchesPattern and matchesAll work with any blueprint version
  if (!pattern.matchesGroup) {
    return;
  }

  // matchesGroup requires schemaVersion: "2.0"
  if (blueprint.schemaVersion !== '2.0') {
    throw new ValidationError(
      `Pattern ${patternIndex + 1} uses 'matchesGroup' but blueprint '${blueprint.id}' has schemaVersion '${blueprint.schemaVersion || '1.0'}'. matchesGroup requires schemaVersion '2.0'.`
    );
  }

  // Check blueprint has structureTemplate
  if (!blueprint.structureTemplate) {
    throw new ValidationError(
      `Blueprint '${blueprint.id}' has schemaVersion '2.0' but no 'structureTemplate' property. matchesGroup requires a structure template.`
    );
  }

  // Check structure template exists
  const template = dataRegistry.get(
    'anatomyStructureTemplates',
    blueprint.structureTemplate
  );

  if (!template) {
    throw new ValidationError(
      `Structure template '${blueprint.structureTemplate}' not found. Ensure template exists and is loaded before blueprint.`
    );
  }
}
