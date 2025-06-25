// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';

/**
 * @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject
 */

/**
 * @typedef {object} QueryComponentOperationParams
 * @property {'actor' | 'target' | string | EntityRefObject} entity_ref - Reference to the target entity.
 * @property {string} component_type - The namespaced ID of the component type.
 * @property {string} result_variable - Variable name in `executionContext.evaluationContext.context`.
 * @property {*} [missing_value] - Optional value to store when the component is
 *   missing or an error occurs. Defaults to `undefined` if not provided.
 */

import { writeContextVariable } from '../../utils/contextVariableUtils.js';

/**
 * @implements {OperationHandler}
 */
class QueryComponentHandler extends ComponentOperationHandler {
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {EntityOperationDeps} deps - Dependencies object
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('QueryComponentHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate parameters and context for {@link QueryComponentHandler#execute}.
   *
   * @param {QueryComponentOperationParams} params - Raw parameters object.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @param {ILogger} logger - Logger for diagnostics.
   * @returns {{
   *   entityId:string,
   *   componentType:string,
   *   resultVar:string,
   *   trimmedResultVar:string,
   *   missingValue:*
   * }|null}
   *   Normalized values or `null` when validation fails.
   * @private
   */
  #validateParams(params, executionContext, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'QueryComponentHandler')
    ) {
      return null;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return null;
    }

    const { entity_ref, component_type, result_variable, missing_value } =
      params;

    const validated = this.validateEntityAndType(
      entity_ref,
      component_type,
      logger,
      'QueryComponentHandler',
      executionContext
    );
    if (!validated) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Could not resolve entity id from entity_ref or component_type.',
        { params }
      );
      return null;
    }
    const { entityId, type: trimmedComponentType } = validated;

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return null;
    }
    const trimmedResultVariable = result_variable.trim();

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

    return {
      entityId,
      componentType: trimmedComponentType,
      resultVar: result_variable,
      trimmedResultVar: trimmedResultVariable,
      missingValue: missing_value,
    };
  }

  /**
   * Retrieve a component and store the result in context.
   *
   * @param {string} entityId - Entity identifier.
   * @param {string} componentType - Component type to fetch.
   * @param {string} resultVar - Context variable name for storage.
   * @param trimmedResultVar
   * @param {*} missingValue - Value to store when component is missing or on error.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @param {ILogger} logger - Logger for diagnostics.
   * @returns {void}
   * @private
   */
  #fetchAndStoreComponent(
    entityId,
    componentType,
    resultVar,
    trimmedResultVar,
    missingValue,
    executionContext,
    logger
  ) {
    logger.debug(
      `QueryComponentHandler: Attempting to query component "${componentType}" from entity "${entityId}". Storing result in context variable "${trimmedResultVar}".`
    );

    let result;
    try {
      result = this.#entityManager.getComponentData(entityId, componentType);

      const valueToStore = result === undefined ? missingValue : result;

      writeContextVariable(
        resultVar,
        valueToStore,
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
          `QueryComponentHandler: Successfully queried component "${componentType}" from entity "${entityId}". Result stored in "${trimmedResultVar}": ${resultString}`
        );
      } else {
        const missingString =
          missingValue === null
            ? 'null'
            : missingValue === undefined
              ? 'undefined'
              : typeof missingValue === 'object'
                ? JSON.stringify(missingValue)
                : missingValue;
        logger.debug(
          `QueryComponentHandler: Component "${componentType}" not found on entity "${entityId}". Stored '${missingString}' in "${trimmedResultVar}".`
        );
      }
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `QueryComponentHandler: Error during EntityManager.getComponentData for component "${componentType}" on entity "${entityId}".`,
        {
          error: error.message,
          stack: error.stack,
          params: {
            entityId,
            componentType,
            resultVar,
            trimmedResultVar,
            missingValue,
          },
          resolvedEntityId: entityId,
        }
      );
      const stored = writeContextVariable(
        resultVar,
        missingValue,
        executionContext,
        this.#dispatcher,
        logger
      );
      if (stored.success) {
        const missingString =
          missingValue === null
            ? 'null'
            : missingValue === undefined
              ? 'undefined'
              : typeof missingValue === 'object'
                ? JSON.stringify(missingValue)
                : missingValue;
        logger.warn(
          `QueryComponentHandler: Stored '${missingString}' in "${trimmedResultVar}" due to EntityManager error.`
        );
      }
    }
  }

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const validated = this.#validateParams(params, executionContext, logger);
    if (!validated) return;

    const {
      entityId,
      componentType,
      resultVar,
      trimmedResultVar,
      missingValue,
    } = validated;

    this.#fetchAndStoreComponent(
      entityId,
      componentType,
      resultVar,
      trimmedResultVar,
      missingValue,
      executionContext,
      logger
    );
  }
}

export default QueryComponentHandler;
