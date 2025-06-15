// src/logic/operationHandlers/queryComponentOptionalHandler.js

/**
 * @file Operation handler that queries a component but stores `null` if the
 * component is missing instead of `undefined`.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
import { resolveEntityId } from '../../utils/entityRefUtils.js';
/**
 * @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject
 */

/**
 * @typedef {object} QueryComponentOptionalParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref
 * @property {string} component_type
 * @property {string} result_variable
 */

import storeResult from '../../utils/contextVariableUtils.js';

class QueryComponentOptionalHandler {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    if (
      !entityManager ||
      typeof entityManager.getComponentData !== 'function'
    ) {
      throw new Error(
        'QueryComponentOptionalHandler requires a valid EntityManager instance with a getComponentData method.'
      );
    }
    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        'QueryComponentOptionalHandler requires a valid ILogger instance.'
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Execute the QUERY_COMPONENT_OPTIONAL operation.
   *
   * @param {QueryComponentOptionalParams|null|undefined} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;

    if (!params || typeof params !== 'object') {
      logger.error(
        'QueryComponentOptionalHandler: Missing or invalid parameters object.',
        { params }
      );
      return;
    }

    if (
      !executionContext?.evaluationContext?.context ||
      typeof executionContext.evaluationContext.context !== 'object'
    ) {
      logger.error(
        'QueryComponentOptionalHandler: executionContext.evaluationContext.context is missing or invalid. Cannot store result.',
        { executionContext }
      );
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    if (!entity_ref) {
      logger.error(
        'QueryComponentOptionalHandler: Missing required "entity_ref" parameter.',
        { params }
      );
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      logger.error(
        'QueryComponentOptionalHandler: Missing or invalid required "component_type" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedComponentType = component_type.trim();

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      logger.error(
        'QueryComponentOptionalHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedResultVar = result_variable.trim();

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      logger.error(
        'QueryComponentOptionalHandler: Could not resolve entity id from entity_ref.',
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
        `QueryComponentOptionalHandler: Interpreting entity_ref string "${entity_ref.trim()}" as a direct entity ID.`
      );
    }

    logger.debug(
      `QueryComponentOptionalHandler: Attempting to query component "${trimmedComponentType}" from entity "${entityId}". Storing result in context variable "${trimmedResultVar}".`
    );

    try {
      const result = this.#entityManager.getComponentData(
        entityId,
        trimmedComponentType
      );
      const valueToStore = result === undefined ? null : result;
      storeResult(
        trimmedResultVar,
        valueToStore,
        executionContext,
        undefined,
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
          `QueryComponentOptionalHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVar}": ${resultString}`
        );
      } else {
        logger.debug(
          `QueryComponentOptionalHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored 'null' in "${trimmedResultVar}".`
        );
      }
    } catch (error) {
      logger.error(
        `QueryComponentOptionalHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`,
        {
          error: error.message,
          stack: error.stack,
          params,
          resolvedEntityId: entityId,
        }
      );
      const stored = storeResult(
        trimmedResultVar,
        null,
        executionContext,
        undefined,
        logger
      );
      if (stored) {
        logger.warn(
          `QueryComponentOptionalHandler: Stored 'null' in "${trimmedResultVar}" due to EntityManager error.`
        );
      }
    }
  }
}

export default QueryComponentOptionalHandler;
