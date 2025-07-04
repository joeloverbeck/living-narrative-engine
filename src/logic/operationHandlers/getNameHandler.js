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
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

/**
 * @typedef {object} GetNameOperationParams
 * @property {'actor'|'target'|string|EntityRefObject} entity_ref
 *   Reference to the entity whose name should be retrieved.
 * @property {string} result_variable
 *   Context variable where the resolved name will be stored.
 * @property {string} [default_value]
 *   Optional fallback name if the component or text is not available.
 */

class GetNameHandler extends BaseOperationHandler {
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('GetNameHandler', {
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
   * Executes the GET_NAME operation.
   *
   * @param {GetNameOperationParams|undefined|null} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'GET_NAME')) {
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
    if (!isNonBlankString(result_variable)) {
      safeDispatchError(
        this.#dispatcher,
        'GET_NAME: "result_variable" must be a non-empty string.',
        { params }
      );
      return;
    }
    if (!ensureEvaluationContext(executionContext, this.#dispatcher, log)) {
      return;
    }
    const resultVar = result_variable.trim();
    const fallback = isNonBlankString(default_value)
      ? default_value.trim()
      : DEFAULT_FALLBACK_CHARACTER_NAME;

    const entityId = resolveEntityId(entity_ref, executionContext);
    if (!entityId) {
      log.warn(
        `GET_NAME: Could not resolve entity from entity_ref. Storing fallback '${fallback}'.`,
        { entity_ref }
      );
      tryWriteContextVariable(
        resultVar,
        fallback,
        executionContext,
        undefined,
        log
      );
      return;
    }

    let name = fallback;
    try {
      const comp = this.#entityManager.getComponentData(
        entityId,
        NAME_COMPONENT_ID
      );
      if (comp && isNonBlankString(comp.text)) {
        name = comp.text.trim();
      }
      log.debug(`GET_NAME: Resolved name for '${entityId}' -> '${name}'.`);
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `GET_NAME: Error retrieving '${NAME_COMPONENT_ID}' from '${entityId}'. Using fallback.`,
        { error: e.message, stack: e.stack }
      );
    }

    tryWriteContextVariable(resultVar, name, executionContext, undefined, log);
  }
}

export default GetNameHandler;
