// src/logic/operationHandlers/getNameHandler.js

/**
 * @file Operation handler to fetch an entity's core:name component text.
 * If the component or text field is missing, a provided default value
 * is stored instead.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */

import { NAME_COMPONENT_ID } from '../../constants/componentIds.js';
import { DEFAULT_FALLBACK_CHARACTER_NAME } from '../../constants/textDefaults.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import storeResult from '../../utils/contextVariableUtils.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';

/**
 * @typedef {object} GetNameOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref
 *   Reference to the entity whose name should be retrieved.
 * @property {string} result_variable
 *   Context variable where the resolved name will be stored.
 * @property {string} [default_value]
 *   Optional fallback name if the component or text is not available.
 */

class GetNameHandler {
  #entityManager;
  #logger;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ entityManager, logger, safeEventDispatcher }) {
    if (!entityManager?.getComponentData) {
      throw new Error('GetNameHandler requires a valid EntityManager.');
    }
    if (!logger?.debug || !logger?.warn || !logger?.error) {
      throw new Error('GetNameHandler requires a valid ILogger instance.');
    }
    if (!safeEventDispatcher?.dispatch) {
      throw new Error('GetNameHandler requires an ISafeEventDispatcher.');
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes the GET_NAME operation.
   *
   * @param {GetNameOperationParams|undefined|null} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;

    if (!params || typeof params !== 'object') {
      safeDispatchError(
        this.#dispatcher,
        'GET_NAME: Missing or invalid parameters.',
        {
          params,
        }
      );
      return;
    }

    const { entity_ref, result_variable, default_value } = params;

    if (!entity_ref) {
      safeDispatchError(
        this.#dispatcher,
        'GET_NAME: "entity_ref" parameter is required.',
        {
          params,
        }
      );
      return;
    }
    if (typeof result_variable !== 'string' || !result_variable.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'GET_NAME: "result_variable" must be a non-empty string.',
        { params }
      );
      return;
    }
    const resultVar = result_variable.trim();
    const fallback =
      typeof default_value === 'string' && default_value.trim()
        ? default_value.trim()
        : DEFAULT_FALLBACK_CHARACTER_NAME;

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      log.warn(
        `GET_NAME: Could not resolve entity from entity_ref. Storing fallback '${fallback}'.`,
        { entity_ref }
      );
      storeResult(resultVar, fallback, executionContext, undefined, log);
      return;
    }

    let name = fallback;
    try {
      const comp = this.#entityManager.getComponentData(
        entityId,
        NAME_COMPONENT_ID
      );
      if (comp && typeof comp.text === 'string' && comp.text.trim()) {
        name = comp.text.trim();
      }
      log.debug(`GET_NAME: Resolved name for '${entityId}' -> '${name}'.`);
    } catch (e) {
      this.#dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `GET_NAME: Error retrieving '${NAME_COMPONENT_ID}' from '${entityId}'. Using fallback.`,
        details: { error: e.message, stack: e.stack },
      });
    }

    storeResult(resultVar, name, executionContext, undefined, log);
  }
}

export default GetNameHandler;
