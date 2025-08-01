/**
 * @file ILegacyTargetCompatibilityLayer - Interface for legacy action compatibility
 * @see MultiTargetResolutionStage.js
 */

/** @typedef {import('../../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../actionTypes.js').ActionDefinition} ActionDefinition */

/**
 * @typedef {object} LegacyCompatibilityResult
 * @property {boolean} isLegacy - Whether the action uses legacy format
 * @property {Record<string, TargetDefinition>} [targetDefinitions] - Converted target definitions
 * @property {string} [error] - Error message if conversion failed
 */

/**
 * @typedef {object} TargetDefinition
 * @property {string} scope - Scope ID or expression
 * @property {string} placeholder - Template placeholder name
 * @property {string} [description] - Human-readable description
 * @property {string} [contextFrom] - Use another target as context
 * @property {boolean} [optional] - Whether target is optional
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} [errors] - List of validation errors
 */

/**
 * Interface for handling legacy single-target action compatibility
 *
 * This service is responsible for:
 * - Detecting legacy action formats (targetType, targetCount)
 * - Converting legacy formats to modern multi-target format
 * - Maintaining backward compatibility with existing actions
 * - Providing migration paths for legacy content
 */
export class ILegacyTargetCompatibilityLayer {
  /**
   * Check if an action uses legacy target format
   *
   * @param {ActionDefinition} _actionDef - Action definition to check
   * @returns {boolean} True if action uses legacy format
   */
  isLegacyAction(_actionDef) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Convert legacy action format to modern multi-target format
   *
   * @param {ActionDefinition} _actionDef - Legacy action definition
   * @param {Entity} _actor - Acting entity for context
   * @returns {LegacyCompatibilityResult} Conversion result with target definitions
   */
  convertLegacyFormat(_actionDef, _actor) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get suggested migration for a legacy action
   *
   * @param {ActionDefinition} _actionDef - Legacy action definition
   * @returns {string} Suggested modern format as a string
   */
  getMigrationSuggestion(_actionDef) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Validate that a converted action maintains semantic equivalence
   *
   * @param {ActionDefinition} _legacyAction - Original legacy action
   * @param {Record<string, TargetDefinition>} _modernTargets - Converted targets
   * @returns {ValidationResult} Validation results
   */
  validateConversion(_legacyAction, _modernTargets) {
    throw new Error('Method must be implemented by concrete class');
  }
}
