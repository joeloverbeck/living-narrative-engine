// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

/**
 * @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject
 */

/**
 * @typedef {object} QueryComponentOperationParams
 * @property {'actor' | 'target' | string | EntityRefObject} entity_ref - Reference to the target entity whose component will be queried.
 * @property {string} component_type - The namespaced ID of the component type to retrieve.
 * @property {string} result_variable - The variable name in `evaluationContext.context` where the component data (or undefined) will be stored.
 */

/**
 * @class QueryComponentHandler
 * Implements the OperationHandler interface for the "QUERY_COMPONENT" operation type.
 * Uses the EntityManager to retrieve component data from a specified entity and stores
 * it in the rule's execution context (`evaluationContext.context`).
 *
 * @implements {OperationHandler}
 */
class QueryComponentHandler {
  /**
     * @private
     * @readonly
     * @type {EntityManager}
     */
  #entityManager;

  /**
     * @private
     * @readonly
     * @type {ILogger}
     */
  #logger;

  /**
     * Creates an instance of QueryComponentHandler.
     * @param {object} dependencies - Dependencies object.
     * @param {EntityManager} dependencies.entityManager - The entity management service.
     * @param {ILogger} dependencies.logger - The logging service instance.
     * @throws {Error} If entityManager or logger are missing or invalid.
     */
  constructor({ entityManager, logger }) {
    // Validate EntityManager dependency
    if (!entityManager || typeof entityManager.getComponentData !== 'function') {
      throw new Error('QueryComponentHandler requires a valid EntityManager instance with a getComponentData method.');
    }
    // Validate Logger dependency
    if (!logger || typeof logger.error !== 'function' || typeof logger.warn !== 'function' || typeof logger.debug !== 'function') {
      throw new Error('QueryComponentHandler requires a valid ILogger instance.');
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
     * Resolves the target entity ID based on the entity_ref parameter and execution context.
     * (Adapted from ModifyComponentHandler)
     * @private
     * @param {QueryComponentOperationParams['entity_ref']} entityRef - The entity reference from parameters.
     * @param {ExecutionContext} executionContext - The execution context containing actor, target etc.
     * @param {ILogger} logger - The logger to use for messages.
     * @returns {string | null} The resolved entity ID or null if resolution fails.
     */
  #resolveEntityId(entityRef, executionContext, logger) {
    const evalContext = executionContext?.evaluationContext;

    if (typeof entityRef === 'string') {
      const trimmedRef = entityRef.trim();
      if (!trimmedRef) {
        logger.error('QueryComponentHandler: Invalid empty string provided for entity_ref.', { entityRef });
        return null;
      }

      if (trimmedRef === 'actor') {
        const actorId = evalContext?.actor?.id;
        if (!actorId) {
          logger.error("QueryComponentHandler: Cannot resolve 'actor' entity ID. Actor missing or has no ID in evaluation context.", { context: evalContext });
          return null;
        }
        return actorId;
      } else if (trimmedRef === 'target') {
        const targetId = evalContext?.target?.id;
        if (!targetId) {
          logger.error("QueryComponentHandler: Cannot resolve 'target' entity ID. Target missing or has no ID in evaluation context.", { context: evalContext });
          return null;
        }
        return targetId;
      } else {
        // Assume it's a direct ID
        logger.debug(`QueryComponentHandler: Interpreting entity_ref string "${trimmedRef}" as a direct entity ID.`);
        return trimmedRef;
      }
    } else if (typeof entityRef === 'object' && entityRef !== null && typeof entityRef.entityId === 'string') {
      const trimmedId = entityRef.entityId.trim();
      if (!trimmedId) {
        logger.error('QueryComponentHandler: Invalid entity_ref object: entityId property is empty or whitespace.', { entityRef });
        return null;
      }
      return trimmedId;
    } else {
      logger.error('QueryComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.', { entityRef });
      return null;
    }
  }

  /**
     * Executes the QUERY_COMPONENT operation.
     * Validates parameters, resolves the target entity ID, retrieves the component data
     * using the EntityManager, and stores the result in the execution context.
     *
     * @param {OperationParams | QueryComponentOperationParams | null | undefined} params - The parameters for the operation.
     * @param {ExecutionContext} executionContext - The context of the execution.
     * @returns {void}
     */
  execute(params, executionContext) {
    // Use logger from context if available, otherwise fallback to injected one
    const logger = executionContext?.logger ?? this.#logger;

    // --- 1. Basic Parameter and Context Validation ---
    if (!params || typeof params !== 'object') {
      logger.error('QueryComponentHandler: Missing or invalid parameters object.', { params });
      return;
    }

    // Ensure the context structure for storing the result exists
    if (!executionContext?.evaluationContext?.context) {
      logger.error('QueryComponentHandler: evaluationContext.context is missing or invalid. Cannot store result.', { executionContext });
      // This indicates a setup issue prior to handler execution.
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    // --- 2. Specific Parameter Validation ---
    if (!entity_ref) {
      logger.error('QueryComponentHandler: Missing required "entity_ref" parameter.', { params });
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      logger.error('QueryComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).', { params });
      return;
    }
    const trimmedComponentType = component_type.trim();

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      logger.error('QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).', { params });
      return;
    }
    const trimmedResultVariable = result_variable.trim();

    // --- 3. Resolve Entity ID ---
    // Pass the selected logger to the resolver
    const entityId = this.#resolveEntityId(entity_ref, executionContext, logger);
    if (!entityId) {
      // Error already logged by #resolveEntityId
      return;
    }

    // --- 4. Call EntityManager and Store Result ---
    logger.debug(`QueryComponentHandler: Attempting to query component "${trimmedComponentType}" from entity "${entityId}". Storing result in context variable "${trimmedResultVariable}".`);

    let result = undefined; // Default to undefined if component/entity not found
    try {
      // Call EntityManager.getComponentData. It returns the data or undefined if not found.
      // It doesn't typically throw errors for 'not found', only potentially for internal issues.
      result = this.#entityManager.getComponentData(entityId, trimmedComponentType);

      // Store the result (which might be an object, null, or undefined)
      executionContext.evaluationContext.context[trimmedResultVariable] = result;

      // Log success and the result value (or indicate if not found)
      if (result !== undefined) {
        // Use JSON.stringify for object results for better debug clarity, handle null explicitly
        const resultString = result === null ? 'null' : (typeof result === 'object' ? JSON.stringify(result) : result);
        logger.debug(`QueryComponentHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVariable}": ${resultString}`);
      } else {
        logger.debug(`QueryComponentHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored 'undefined' in "${trimmedResultVariable}".`);
      }

    } catch (error) {
      // Catch potential unexpected errors from EntityManager (though less likely for getComponentData)
      logger.error(`QueryComponentHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`, {
        error: error.message,
        stack: error.stack, // Optional: include stack trace for debugging
        params: params,
        resolvedEntityId: entityId
      });
      // Store undefined in the context variable on error to prevent downstream issues using a potentially stale value
      try {
        executionContext.evaluationContext.context[trimmedResultVariable] = undefined;
        logger.warn(`QueryComponentHandler: Stored 'undefined' in "${trimmedResultVariable}" due to EntityManager error.`);
      } catch (contextError) {
        logger.error('QueryComponentHandler: Failed to store \'undefined\' in context after EntityManager error.', { contextError: contextError.message });
      }
      // Do not re-throw, allow execution to continue.
    }
  }
}

export default QueryComponentHandler;