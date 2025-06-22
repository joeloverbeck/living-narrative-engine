// src/logic/operationHandlers/queryComponentsHandler.js

/**
 * @file Handles the QUERY_COMPONENTS operation which retrieves multiple
 * components from an entity at once.
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { writeContextVariable } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import ComponentOperationHandler from './componentOperationHandler.js';

/**
 * Parameters for the QUERY_COMPONENTS operation.
 *
 * @typedef {object} QueryComponentsParams
 * @property {'actor'|'target'|string|import('./modifyComponentHandler.js').EntityRefObject} entity_ref
 *   Reference to the entity from which to fetch components.
 * @property {Array<{component_type: string, result_variable: string}>} pairs
 *   Array of component/result variable pairs.
 */

class QueryComponentsHandler extends ComponentOperationHandler {
  /** @type {IEntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('QueryComponentsHandler', {
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
   * Execute the QUERY_COMPONENTS operation.
   *
   * @param {QueryComponentsParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (
      !assertParamsObject(params, this.#dispatcher, 'QueryComponentsHandler')
    ) {
      return;
    }

    if (
      !executionContext?.evaluationContext?.context ||
      typeof executionContext.evaluationContext.context !== 'object'
    ) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: executionContext.evaluationContext.context is missing or invalid.',
        { executionContext }
      );
      return;
    }

    const { entity_ref, pairs } = params;

    const entityId = this.validateEntityRef(
      entity_ref,
      logger,
      'QueryComponentsHandler',
      executionContext
    );
    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: Could not resolve entity id from entity_ref.',
        { entityRef: entity_ref }
      );
      return;
    }
    if (!Array.isArray(pairs) || pairs.length === 0) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: "pairs" must be a non-empty array.',
        { params }
      );
      return;
    }

    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object') continue;
      const { component_type, result_variable } = pair;
      const trimmedType = this.requireComponentType(
        component_type,
        logger,
        'QueryComponentsHandler'
      );
      if (!trimmedType) {
        safeDispatchError(
          this.#dispatcher,
          'QueryComponentsHandler: Invalid component_type in pair.',
          { pair }
        );
        continue;
      }
      if (
        !result_variable ||
        typeof result_variable !== 'string' ||
        !result_variable.trim()
      ) {
        safeDispatchError(
          this.#dispatcher,
          'QueryComponentsHandler: Invalid result_variable in pair.',
          { pair }
        );
        continue;
      }
      const trimmedVar = result_variable.trim();
      let result;
      try {
        result = this.#entityManager.getComponentData(entityId, trimmedType);
      } catch (e) {
        safeDispatchError(
          this.#dispatcher,
          `QueryComponentsHandler: Error retrieving component "${trimmedType}" from entity "${entityId}"`,
          { error: e.message, stack: e.stack }
        );
        result = undefined;
      }

      const valueToStore = result === undefined ? null : result;
      writeContextVariable(
        trimmedVar,
        valueToStore,
        executionContext,
        this.#dispatcher,
        logger
      );

      if (result !== undefined) {
        logger.debug(
          `QueryComponentsHandler: Stored component "${trimmedType}" value in "${trimmedVar}".`
        );
      } else {
        logger.debug(
          `QueryComponentsHandler: Component "${trimmedType}" not found on entity "${entityId}". Stored null in "${trimmedVar}".`
        );
      }
    }
  }
}

export default QueryComponentsHandler;
