// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';

/**
 * @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject
 */

/**
 * @typedef {object} QueryComponentOperationParams
 * @property {'actor' | 'target' | string | EntityRefObject} entity_ref - Reference to the target entity.
 * @property {string} component_type - The namespaced ID of the component type.
 * @property {string} result_variable - Variable name in `executionContext.evaluationContext.context`.
 */

import storeResult from '../../utils/contextVariableUtils.js';

class QueryComponentHandler {
  #entityManager;
  #logger;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ entityManager, logger, safeEventDispatcher }) {
    if (
      !entityManager ||
      typeof entityManager.getComponentData !== 'function'
    ) {
      throw new Error(
        'QueryComponentHandler requires a valid EntityManager instance with a getComponentData method.'
      );
    }
    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        'QueryComponentHandler requires a valid ILogger instance.'
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
    if (!safeEventDispatcher?.dispatch) {
      throw new Error(
        'QueryComponentHandler requires an ISafeEventDispatcher.'
      );
    }
    this.#dispatcher = safeEventDispatcher;
  }

  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;

    if (!params || typeof params !== 'object') {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid parameters object.',
        { params }
      );
      return;
    }

    // This check correctly targets the nested context for variable storage, aligning with test structure.
    if (
      !executionContext?.evaluationContext?.context ||
      typeof executionContext.evaluationContext.context !== 'object'
    ) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: executionContext.evaluationContext.context is missing or invalid. Cannot store result.',
        { executionContext }
      );
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    if (!entity_ref) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing required "entity_ref" parameter.',
        { params }
      );
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedComponentType = component_type.trim();

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedResultVariable = result_variable.trim();

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Could not resolve entity id from entity_ref.',
        { entityRef: entity_ref }
      );

      return;
    }

    if (
      typeof entity_ref === 'string' &&
      entity_ref.trim() &&
      entity_ref.trim() !== 'actor' &&
      entity_ref.trim() !== 'target'
    ) {
      logger.debug(
        `QueryComponentHandler: Interpreting entity_ref string "${entity_ref.trim()}" as a direct entity ID.`
      );
    }

    logger.debug(
      `QueryComponentHandler: Attempting to query component "${trimmedComponentType}" from entity "${entityId}". Storing result in context variable "${trimmedResultVariable}".`
    );

    let result = undefined;
    try {
      result = this.#entityManager.getComponentData(
        entityId,
        trimmedComponentType
      );

      storeResult(
        trimmedResultVariable,
        result,
        executionContext,
        this.#dispatcher,
        logger
      );

      if (result !== undefined) {
        const resultString =
          result === null
            ? 'null'
            : typeof result === 'object'
              ? JSON.stringify(result)
              : result;
        logger.debug(
          `QueryComponentHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVariable}": ${resultString}`
        );
      } else {
        logger.debug(
          `QueryComponentHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored 'undefined' in "${trimmedResultVariable}".`
        );
      }
    } catch (error) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `QueryComponentHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`,
        details: {
          error: error.message,
          stack: error.stack,
          params: params,
          resolvedEntityId: entityId,
        },
      });
      const stored = storeResult(
        trimmedResultVariable,
        undefined,
        executionContext,
        this.#dispatcher,
        logger
      );
      if (stored) {
        logger.warn(
          `QueryComponentHandler: Stored 'undefined' in "${trimmedResultVariable}" due to EntityManager error.`
        );
      }
    }
  }
}

export default QueryComponentHandler;
