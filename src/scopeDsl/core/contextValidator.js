// src/scopeDsl/core/contextValidator.js

/**
 * @file Context Validator for Scope-DSL
 * @description Handles validation of context objects and their properties
 */

/**
 * Handles validation of context objects and their critical properties
 *
 * Provides centralized validation logic that can be used independently
 * or in conjunction with ContextMerger.
 */
class ContextValidator {
  /**
   * Creates a new ContextValidator instance
   *
   * @param {string[]} criticalProperties - Array of property names that must be present
   */
  constructor(
    criticalProperties = [
      'actorEntity',
      'runtimeCtx',
      'dispatcher',
      'cycleDetector',
      'depthGuard',
    ]
  ) {
    this.criticalProperties = criticalProperties;
  }

  /**
   * Validates that all critical properties are present and valid
   *
   * @param {object} context - Context object to validate
   * @throws {Error} If any critical property is missing or invalid
   * @returns {boolean} True if validation passes
   */
  validate(context) {
    if (!context || typeof context !== 'object') {
      throw new Error('[CRITICAL] Context must be a valid object');
    }

    // Check for missing critical properties
    const missingProperties = this._findMissingCriticalProperties(context);
    if (missingProperties.length > 0) {
      throw new Error(
        `[CRITICAL] Context is missing required properties: ${missingProperties.join(', ')}`
      );
    }

    // Validate specific property types and values
    this._validatePropertyTypes(context);

    return true;
  }

  /**
   * Validates that a context is suitable for merging operations
   *
   * @param {object} baseContext - Base context to validate
   * @param {object} overlayContext - Overlay context to validate
   * @throws {Error} If contexts are not suitable for merging
   * @returns {boolean} True if contexts can be safely merged
   */
  validateForMerging(baseContext, overlayContext) {
    // Base context must have all critical properties
    this.validate(baseContext);

    // Overlay context can be null/undefined (will be handled by merger)
    if (overlayContext) {
      this._validatePartialContext(overlayContext);
    }

    return true;
  }

  /**
   * Validates specific property types and values
   *
   * @param {object} context - Context to validate
   * @throws {Error} If any property has invalid type or value
   * @private
   */
  _validatePropertyTypes(context) {
    // actorEntity should be an object with an id
    if (context.actorEntity && typeof context.actorEntity.id !== 'string') {
      throw new Error('[CRITICAL] actorEntity must have an id property');
    }

    // runtimeCtx should be an object
    if (context.runtimeCtx && typeof context.runtimeCtx !== 'object') {
      throw new Error('[CRITICAL] runtimeCtx must be an object');
    }

    // dispatcher should have a resolve method
    if (
      context.dispatcher &&
      typeof context.dispatcher.resolve !== 'function'
    ) {
      throw new Error('[CRITICAL] dispatcher must have a resolve method');
    }

    // depth should be a non-negative number
    if (
      context.depth !== undefined &&
      (typeof context.depth !== 'number' || context.depth < 0)
    ) {
      throw new Error('[CRITICAL] depth must be a non-negative number');
    }

    // cycleDetector should have enter and leave methods
    if (context.cycleDetector) {
      if (
        typeof context.cycleDetector.enter !== 'function' ||
        typeof context.cycleDetector.leave !== 'function'
      ) {
        throw new Error(
          '[CRITICAL] cycleDetector must have enter and leave methods'
        );
      }
    }

    // depthGuard should have an ensure method
    if (context.depthGuard && typeof context.depthGuard.ensure !== 'function') {
      throw new Error('[CRITICAL] depthGuard must have an ensure method');
    }
  }

  /**
   * Validates a partial context (used for overlay contexts)
   *
   * @param {object} context - Partial context to validate
   * @throws {Error} If context contains invalid properties
   * @private
   */
  _validatePartialContext(context) {
    if (typeof context !== 'object') {
      throw new Error('[CRITICAL] Overlay context must be an object');
    }

    // Validate only the properties that are present
    if (context.actorEntity && typeof context.actorEntity.id !== 'string') {
      throw new Error('[CRITICAL] actorEntity must have an id property');
    }

    if (context.runtimeCtx && typeof context.runtimeCtx !== 'object') {
      throw new Error('[CRITICAL] runtimeCtx must be an object');
    }

    if (
      context.dispatcher &&
      typeof context.dispatcher.resolve !== 'function'
    ) {
      throw new Error('[CRITICAL] dispatcher must have a resolve method');
    }

    if (
      context.depth !== undefined &&
      (typeof context.depth !== 'number' || context.depth < 0)
    ) {
      throw new Error('[CRITICAL] depth must be a non-negative number');
    }
  }

  /**
   * Finds missing critical properties in a context
   *
   * @param {object} context - Context to check
   * @returns {string[]} Array of missing critical property names
   * @private
   */
  _findMissingCriticalProperties(context) {
    return this.criticalProperties.filter((prop) => !context[prop]);
  }

  /**
   * Checks if a context has all required critical properties
   *
   * @param {object} context - Context to check
   * @returns {boolean} True if all critical properties are present
   */
  hasAllCriticalProperties(context) {
    return this._findMissingCriticalProperties(context).length === 0;
  }

  /**
   * Gets the list of critical properties this validator checks
   *
   * @returns {string[]} Array of critical property names
   */
  getCriticalProperties() {
    return [...this.criticalProperties];
  }

  /**
   * Creates a validator with custom critical properties
   *
   * @param {string[]} criticalProperties - Custom critical properties
   * @returns {ContextValidator} New validator instance
   */
  static withCriticalProperties(criticalProperties) {
    return new ContextValidator(criticalProperties);
  }
}

export default ContextValidator;
