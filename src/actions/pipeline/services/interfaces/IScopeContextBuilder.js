/**
 * @file IScopeContextBuilder - Interface for building scope evaluation contexts
 * @see MultiTargetResolutionStage.js
 */

/** @typedef {import('../../../../entities/entity.js').default} Entity */

/**
 * @typedef {object} ScopeContext
 * @property {string} actorId - ID of the acting entity
 * @property {string} [locationId] - ID of the current location
 * @property {Object.<string, any>} customContext - Additional context variables
 * @property {Object.<string, Entity>} resolvedTargets - Previously resolved targets
 */

/**
 * @typedef {object} ResolvedTarget
 * @property {string} id - Entity ID
 * @property {string} displayName - Display name for formatting
 * @property {object} entity - Full entity object
 */

/**
 * @typedef {object} ContextBuildResult
 * @property {boolean} success - Whether context was built successfully
 * @property {ScopeContext} [context] - The built context if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * Interface for building contexts used in scope evaluation
 *
 * This service is responsible for:
 * - Creating evaluation contexts for scope DSL
 * - Managing resolved target injection into contexts
 * - Building hierarchical contexts from contextFrom relationships
 * - Providing context validation and error handling
 */
export class IScopeContextBuilder {
  /**
   * Build initial context for scope evaluation
   *
   * @param {Entity} actor - The acting entity
   * @param {object} actionContext - Action discovery context
   * @param _actor
   * @param _actionContext
   * @returns {ScopeContext} Initial evaluation context
   */
  buildInitialContext(_actor, _actionContext) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Add resolved target to the evaluation context
   *
   * @param {ScopeContext} context - Current evaluation context
   * @param {string} targetKey - Key of the resolved target
   * @param {ResolvedTarget} resolvedTarget - The resolved target data
   * @param _context
   * @param _targetKey
   * @param _resolvedTarget
   * @returns {ScopeContext} Updated context with target added
   */
  addResolvedTarget(_context, _targetKey, _resolvedTarget) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Build context for a target that depends on another target
   *
   * @param {ScopeContext} baseContext - Base evaluation context
   * @param {string} contextFromKey - Key of the target to use as context
   * @param {Object.<string, ResolvedTarget>} resolvedTargets - All resolved targets
   * @param _baseContext
   * @param _contextFromKey
   * @param _resolvedTargets
   * @returns {ContextBuildResult} Result with built context or error
   */
  buildDependentContext(_baseContext, _contextFromKey, _resolvedTargets) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Merge multiple contexts together
   *
   * @param {ScopeContext[]} contexts - Array of contexts to merge
   * @param _contexts
   * @returns {ScopeContext} Merged context
   */
  mergeContexts(_contexts) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Validate a scope context
   *
   * @param {ScopeContext} context - Context to validate
   * @param _context
   * @returns {ValidationResult} Validation results
   */
  validateContext(_context) {
    throw new Error('Method must be implemented by concrete class');
  }
}
