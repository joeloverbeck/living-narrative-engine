// src/logic/operationHandlers/queryComponentsHandler.js

/**
 * @file Handles the QUERY_COMPONENTS operation which retrieves multiple
 * components from an entity at once.
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { setContextValue } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import { assertParamsObject } from '../../utils/handlerUtils/params.js';

/**
 * Parameters for the QUERY_COMPONENTS operation.
 *
 * @typedef {object} QueryComponentsParams
 * @property {'actor'|'target'|string|import('./modifyComponentHandler.js').EntityRefObject} entity_ref
 *   Reference to the entity from which to fetch components.
 * @property {Array<{component_type: string, result_variable: string}>} pairs
 *   Array of component/result variable pairs.
 */

class QueryComponentsHandler {
  /** @type {IEntityManager} */ #entityManager;
  /** @type {ILogger} */ #logger;
  /** @type {ISafeEventDispatcher} */ #dispatcher;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({ entityManager, logger, safeEventDispatcher }) {
    if (!entityManager?.getComponentData) {
      throw new Error('QueryComponentsHandler requires a valid IEntityManager');
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error('QueryComponentsHandler requires a valid ILogger');
    }
    if (!safeEventDispatcher?.dispatch) {
      throw new Error('QueryComponentsHandler requires ISafeEventDispatcher');
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Execute the QUERY_COMPONENTS operation.
   *
   * @param {QueryComponentsParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = executionContext?.logger ?? this.#logger;

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

    if (!entity_ref) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: Missing required "entity_ref" parameter.',
        { params }
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

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'QueryComponentsHandler: Could not resolve entity id from entity_ref.',
        { entityRef: entity_ref }
      );
      return;
    }

    for (const pair of pairs) {
      if (!pair || typeof pair !== 'object') continue;
      const { component_type, result_variable } = pair;
      if (
        !component_type ||
        typeof component_type !== 'string' ||
        !component_type.trim()
      ) {
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
      const trimmedType = component_type.trim();
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
      setContextValue(
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
