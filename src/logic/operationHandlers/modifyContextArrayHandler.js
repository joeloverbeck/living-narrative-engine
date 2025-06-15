/**
 * @file This operation handler modifies an array stored within the rule's execution context.
 * @see src/logic/operationHandlers/modifyContextArrayHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { resolvePath } from '../../utils/objectUtils.js';
import storeResult from '../../utils/contextVariableUtils.js';

/**
 * @class ModifyContextArrayHandler
 * @description Handles the 'MODIFY_CONTEXT_ARRAY' operation. It provides direct,
 * in-place modification of an array stored as a context variable.
 */
class ModifyContextArrayHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - The logging service.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
   */
  constructor({ logger, safeEventDispatcher }) {
    if (!logger || typeof logger.warn !== 'function') {
      throw new Error("Dependency 'ILogger' with a 'warn' method is required.");
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        "Dependency 'ISafeEventDispatcher' with dispatch method is required."
      );
    }
    this.#logger = logger;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes the array modification operation on a context variable.
   *
   * @param {object} params - The parameters for the operation.
   * @param {string} params.variable_path - Dot-separated path to the array variable within the context.
   * @param {'push'|'push_unique'|'pop'|'remove_by_value'} params.mode - The operation to perform.
   * @param {*} [params.value] - The value for 'push', 'push_unique', or 'remove_by_value'.
   * @param {string} [params.result_variable] - Optional variable to store the operation's result.
   * @param {ExecutionContext} executionContext - The current execution context.
   */
  execute(params, executionContext) {
    const log = executionContext?.logger ?? this.#logger;

    const { variable_path, mode, value, result_variable } = params;
    if (!variable_path || !mode) {
      log.warn(
        'MODIFY_CONTEXT_ARRAY: Missing required parameters (variable_path, or mode).'
      );
      return;
    }

    const contextObject = executionContext?.evaluationContext?.context;
    if (!contextObject) {
      log.warn(
        'MODIFY_CONTEXT_ARRAY: Cannot execute because the execution context is missing.'
      );
      return;
    }

    const targetArray = resolvePath(contextObject, variable_path);
    if (!Array.isArray(targetArray)) {
      log.warn(
        `MODIFY_CONTEXT_ARRAY: Context variable path '${variable_path}' does not resolve to an array.`
      );
      return;
    }

    let operationResult = null;
    log.debug(
      `MODIFY_CONTEXT_ARRAY: Performing '${mode}' on context variable '${variable_path}'.`
    );

    switch (mode) {
      case 'push':
        if (value === undefined) {
          log.warn(`'push' mode requires a 'value' parameter.`);
          return;
        }
        targetArray.push(value);
        operationResult = targetArray;
        break;

      case 'push_unique':
        if (value === undefined) {
          log.warn(`'push_unique' mode requires a 'value' parameter.`);
          return;
        }
        let exists = false;
        if (typeof value !== 'object' || value === null) {
          exists = targetArray.includes(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          exists = targetArray.some(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (!exists) {
          targetArray.push(value);
        }
        operationResult = targetArray;
        break;

      case 'pop':
        if (targetArray.length > 0) {
          operationResult = targetArray.pop();
        } else {
          operationResult = undefined;
        }
        break;

      case 'remove_by_value':
        if (value === undefined) {
          log.warn(`'remove_by_value' mode requires a 'value' parameter.`);
          return;
        }
        let index;
        if (typeof value !== 'object' || value === null) {
          index = targetArray.indexOf(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          index = targetArray.findIndex(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (index > -1) {
          targetArray.splice(index, 1);
        }
        operationResult = targetArray;
        break;

      default:
        log.warn(`MODIFY_CONTEXT_ARRAY: Unknown mode '${mode}'.`);
        return;
    }

    if (result_variable) {
      storeResult(
        result_variable,
        operationResult,
        executionContext,
        this.#dispatcher,
        log
      );
    }
  }
}

export default ModifyContextArrayHandler;
