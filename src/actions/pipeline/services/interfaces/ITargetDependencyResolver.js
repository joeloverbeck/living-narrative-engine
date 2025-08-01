/**
 * @file ITargetDependencyResolver - Interface for target dependency resolution
 * @see MultiTargetResolutionStage.js
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
 * @property {boolean} success - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * @typedef {object} DependencyInfo
 * @property {string} targetKey - The target key
 * @property {string[]} dependencies - Array of target keys this target depends on
 * @property {boolean} isOptional - Whether this target is optional
 */

/**
 * Interface for analyzing target definitions and determining resolution order
 *
 * This service is responsible for:
 * - Analyzing target dependencies based on contextFrom relationships
 * - Determining the correct order for target resolution
 * - Detecting circular dependencies
 * - Validating target definition structures
 */
export class ITargetDependencyResolver {
  /**
   * Analyze target definitions and return resolution order
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @param _targetDefinitions
   * @returns {string[]} Dependency-ordered target keys (dependencies first)
   * @throws {Error} If circular dependencies detected
   */
  getResolutionOrder(_targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Validate target definitions for dependency issues
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @param _targetDefinitions
   * @returns {ValidationResult} Validation results with any errors or warnings
   */
  validateDependencies(_targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get dependency information for all targets
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @param _targetDefinitions
   * @returns {DependencyInfo[]} Array of dependency information for each target
   */
  getDependencyGraph(_targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Check if a specific target has circular dependencies
   *
   * @param {string} targetKey - The target key to check
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @param _targetKey
   * @param _targetDefinitions
   * @returns {boolean} True if circular dependency exists
   */
  hasCircularDependency(_targetKey, _targetDefinitions) {
    throw new Error('Method must be implemented by concrete class');
  }
}
