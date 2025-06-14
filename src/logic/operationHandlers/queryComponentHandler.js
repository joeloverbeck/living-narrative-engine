// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
import resolveEntityId from '../../utils/entityRefUtils.js';

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

  constructor({ entityManager, logger }) {
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
  }

  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;

    if (!params || typeof params !== 'object') {
      logger.error(
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
      logger.error(
        'QueryComponentHandler: executionContext.evaluationContext.context is missing or invalid. Cannot store result.',
        { executionContext }
      );
      return;
    }

    const { entity_ref, component_type, result_variable } = params;

    if (!entity_ref) {
      logger.error(
        'QueryComponentHandler: Missing required "entity_ref" parameter.',
        { params }
      );
      return;
    }
    if (typeof component_type !== 'string' || !component_type.trim()) {
      logger.error(
        'QueryComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedComponentType = component_type.trim();

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      logger.error(
        'QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedResultVariable = result_variable.trim();

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      if (typeof entity_ref === 'string') {
        const trimmedRef = entity_ref.trim();
        if (!trimmedRef) {
          logger.error(
            'QueryComponentHandler: Invalid empty string provided for entity_ref.',
            { entityRef: entity_ref }
          );
        } else if (trimmedRef === 'actor') {
          logger.error(
            "QueryComponentHandler: Cannot resolve 'actor' entity ID. Actor missing or has no ID in evaluationContext.actor.",
            { evalContextActor: executionContext?.evaluationContext?.actor }
          );
        } else if (trimmedRef === 'target') {
          logger.error(
            "QueryComponentHandler: Cannot resolve 'target' entity ID. Target missing or has no ID in evaluationContext.target.",
            { evalContextTarget: executionContext?.evaluationContext?.target }
          );
        } else {
          logger.error(
            'QueryComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.',
            { entityRef: entity_ref }
          );
        }
      } else if (
        entity_ref &&
        typeof entity_ref === 'object' &&
        typeof entity_ref.entityId === 'string'
      ) {
        if (!entity_ref.entityId.trim()) {
          logger.error(
            'QueryComponentHandler: Invalid entity_ref object: entityId property is empty or whitespace.',
            { entityRef: entity_ref }
          );
        } else {
          logger.error(
            'QueryComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.',
            { entityRef: entity_ref }
          );
        }
      } else {
        logger.error(
          'QueryComponentHandler: Invalid entity_ref parameter. Must be "actor", "target", a non-empty entity ID string, or an object like { entityId: "..." }.',
          { entityRef: entity_ref }
        );
      }
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
          `QueryComponentHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVariable}": ${resultString}`
        );
      } else {
        logger.debug(
          `QueryComponentHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored 'undefined' in "${trimmedResultVariable}".`
        );
      }
    } catch (error) {
      logger.error(
        `QueryComponentHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`,
        {
          error: error.message,
          stack: error.stack,
          params: params,
          resolvedEntityId: entityId,
        }
      );
      const stored = storeResult(
        trimmedResultVariable,
        undefined,
        executionContext,
        undefined,
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
