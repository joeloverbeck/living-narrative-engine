/**
 * @file This operation handler determins if a component exists in an entity.
 * @see src/logic/operationHandlers/hasComponentHandler.js
 */

// --- Type-hints --------------------------------------------------------------
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */

/**
 * Parameters accepted by {@link HasComponentHandler#execute}.
 *
 * @typedef {object} HasComponentOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref - Required. Reference to the entity to check.
 * @property {string} component_type - Required. The namespaced type ID of the component to check for.
 * @property {string} result_variable - Required. The context variable where the boolean result (true/false) will be stored.
 */

// -----------------------------------------------------------------------------
// Handler implementation
// -----------------------------------------------------------------------------

class HasComponentHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of HasComponentHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {IEntityManager} dependencies.entityManager - The entity management service.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ entityManager, logger }) {
    if (!logger || typeof logger.warn !== 'function') {
      throw new Error('HasComponentHandler requires a valid ILogger instance.');
    }
    if (!entityManager || typeof entityManager.hasComponent !== 'function') {
      throw new Error(
        'HasComponentHandler requires a valid IEntityManager instance with a hasComponent method.'
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Resolves an entity reference to an entity ID.
   * (Copied from ModifyComponentHandler as the logic is identical)
   *
   * @private
   * @param {HasComponentOperationParams['entity_ref']} ref - The entity reference from parameters.
   * @param {ExecutionContext} ctx - The execution context.
   * @returns {string | null} The resolved entity ID or null.
   */
  #resolveEntityId(ref, ctx) {
    const ec = ctx?.evaluationContext ?? {};
    if (typeof ref === 'string') {
      const t = ref.trim();
      if (!t) return null;
      if (t === 'actor') return ec.actor?.id ?? null;
      if (t === 'target') return ec.target?.id ?? null;
      return t; // Assume direct ID
    }
    if (
      ref &&
      typeof ref === 'object' &&
      typeof ref.entityId === 'string' &&
      ref.entityId.trim()
    ) {
      return ref.entityId.trim();
    }
    return null;
  }

  /**
   * Executes the HAS_COMPONENT operation.
   *
   * @param {HasComponentOperationParams | null | undefined} params - The parameters for the operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {void}
   * @implements {OperationHandler}
   */
  execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;

    // 1. Validate Parameters
    if (!params || typeof params !== 'object') {
      log.warn('HAS_COMPONENT: Parameters missing or invalid.', { params });
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    if (!entity_ref) {
      log.warn('HAS_COMPONENT: "entity_ref" parameter is required.');
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      log.warn(
        'HAS_COMPONENT: "component_type" parameter must be a non-empty string.'
      );
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      log.warn(
        'HAS_COMPONENT: "result_variable" parameter must be a non-empty string.'
      );
      return;
    }

    const trimmedResultVar = result_variable.trim();
    const trimmedComponentType = component_type.trim();

    // 2. Resolve Entity ID
    const entityId = this.#resolveEntityId(entity_ref, executionContext);

    // 3. Perform check and store result
    let result = false; // Default to false
    if (!entityId) {
      log.warn(
        `HAS_COMPONENT: Could not resolve entity from entity_ref. Storing 'false' in "${trimmedResultVar}".`,
        {
          entity_ref,
        }
      );
      // `result` is already false, so we just proceed to storage.
    } else {
      try {
        result = this.#entityManager.hasComponent(
          entityId,
          trimmedComponentType
        );
        log.debug(
          `HAS_COMPONENT: Entity "${entityId}" ${
            result ? 'has' : 'does not have'
          } component "${trimmedComponentType}". Storing result in "${trimmedResultVar}".`
        );
      } catch (e) {
        log.error(
          `HAS_COMPONENT: An error occurred while checking for component "${trimmedComponentType}" on entity "${entityId}". Storing 'false'.`,
          { error: e }
        );
        result = false; // Ensure result is false on error
      }
    }

    // 4. Store the final boolean result in the context
    try {
      if (executionContext?.evaluationContext?.context) {
        executionContext.evaluationContext.context[trimmedResultVar] = result;
      } else {
        log.error(
          `HAS_COMPONENT: evaluationContext.context is not available. Cannot store result in "${trimmedResultVar}".`
        );
      }
    } catch (e) {
      log.error(
        `HAS_COMPONENT: Failed to write result to context variable "${trimmedResultVar}".`,
        { error: e }
      );
    }
  }
}

export default HasComponentHandler;
