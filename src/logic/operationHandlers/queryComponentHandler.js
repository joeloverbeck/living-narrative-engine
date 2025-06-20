// src/logic/operationHandlers/queryComponentHandler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
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

class QueryComponentHandler extends ComponentOperationHandler {
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

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

  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (
      !assertParamsObject(params, this.#dispatcher, 'QueryComponentHandler')
    ) {
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

    const { entity_ref, component_type, result_variable, missing_value } =
      params;

    if (!entity_ref) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing required "entity_ref" parameter.',
        { params }
      );
      return;
    }
    const trimmedComponentType = this.validateComponentType(component_type);
    if (!trimmedComponentType) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid required "component_type" parameter (must be non-empty string).',
        { params }
      );
      return;
    }

    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentHandler: Missing or invalid required "result_variable" parameter (must be non-empty string).',
        { params }
      );
      return;
    }
    const trimmedResultVariable = result_variable.trim();

    const entityId = this.resolveEntity(entity_ref, executionContext);
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

      const valueToStore = result === undefined ? missing_value : result;

      writeContextVariable(
        result_variable,
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
          `QueryComponentHandler: Successfully queried component "${trimmedComponentType}" from entity "${entityId}". Result stored in "${trimmedResultVariable}": ${resultString}`
        );
      } else {
        const missingString =
          missing_value === null
            ? 'null'
            : missing_value === undefined
              ? 'undefined'
              : typeof missing_value === 'object'
                ? JSON.stringify(missing_value)
                : missing_value;
        logger.debug(
          `QueryComponentHandler: Component "${trimmedComponentType}" not found on entity "${entityId}". Stored '${missingString}' in "${trimmedResultVariable}".`
        );
      }
    } catch (error) {
      safeDispatchError(
        this.#dispatcher,
        `QueryComponentHandler: Error during EntityManager.getComponentData for component "${trimmedComponentType}" on entity "${entityId}".`,
        {
          error: error.message,
          stack: error.stack,
          params: params,
          resolvedEntityId: entityId,
        }
      );
      const stored = writeContextVariable(
        result_variable,
        missing_value,
        executionContext,
        this.#dispatcher,
        logger
      );
      if (stored.success) {
        const missingString =
          missing_value === null
            ? 'null'
            : missing_value === undefined
              ? 'undefined'
              : typeof missing_value === 'object'
                ? JSON.stringify(missing_value)
                : missing_value;
        logger.warn(
          `QueryComponentHandler: Stored '${missingString}' in "${trimmedResultVariable}" due to EntityManager error.`
        );
      }
    }
  }
}

export default QueryComponentHandler;
