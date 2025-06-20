/**
 * @file This operation handler modifies an array stored within the rule's execution context.
 * @see src/logic/operationHandlers/modifyContextArrayHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { resolvePath } from '../../utils/objectUtils.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { cloneDeep } from 'lodash';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

/**
 * Safely sets a value on a nested object using a dot-notation path.
 *
 * @param {object} obj The object to modify.
 * @param {string} path The dot-notation path (e.g., 'a.b.c').
 * @param {*} value The value to set at the path.
 */
function setPath(obj, path, value) {
  const pathParts = path.split('.');
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (part === '__proto__' || part === 'constructor') {
      throw new Error(`Unsafe property name detected: ${part}`);
    }
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart === '__proto__' || lastPart === 'constructor') {
    throw new Error(`Unsafe property name detected: ${lastPart}`);
  }
  current[lastPart] = value;
}

/**
 * @class ModifyContextArrayHandler
 * @description Handles the 'MODIFY_CONTEXT_ARRAY' operation. It provides direct,
 * safe modification of an array stored as a context variable by operating on a clone.
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

    if (!assertParamsObject(params, log, 'MODIFY_CONTEXT_ARRAY')) {
      return;
    }

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

    const resolvedValue = resolvePath(contextObject, variable_path);
    let clonedArray;

    if (Array.isArray(resolvedValue)) {
      clonedArray = cloneDeep(resolvedValue);
    } else if (
      resolvedValue === undefined &&
      (mode === 'push' || mode === 'push_unique')
    ) {
      log.debug(
        `MODIFY_CONTEXT_ARRAY: Path '${variable_path}' does not exist. Initializing as empty array for mode '${mode}'.`
      );
      clonedArray = [];
    } else {
      let message = `MODIFY_CONTEXT_ARRAY: Context variable path '${variable_path}' `;
      if (resolvedValue === undefined) {
        message += `does not exist, and mode '${mode}' does not support initialization from undefined.`;
      } else {
        message += `does not resolve to an array (found type: ${typeof resolvedValue}).`;
      }
      log.warn(message);
      return;
    }

    let debugMessage = `MODIFY_CONTEXT_ARRAY: Performing '${mode}' on context variable '${variable_path}'.`;
    if (
      value !== undefined &&
      (mode === 'push' || mode === 'push_unique' || mode === 'remove_by_value')
    ) {
      try {
        // Attempt to stringify, but catch errors for complex objects or circular refs
        debugMessage += ` Value: ${JSON.stringify(value)}.`;
      } catch (e) {
        debugMessage += ` Value: [unable to stringify].`;
      }
    }
    log.debug(debugMessage);

    let operationResult = null;

    switch (mode) {
      case 'push':
        if (value === undefined) {
          log.warn(`'push' mode requires a 'value' parameter.`);
          return;
        }
        clonedArray.push(value);
        operationResult = clonedArray;
        break;

      case 'push_unique': {
        if (value === undefined) {
          log.warn(`'push_unique' mode requires a 'value' parameter.`);
          return;
        }
        let exists = false;
        if (typeof value !== 'object' || value === null) {
          exists = clonedArray.includes(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          exists = clonedArray.some(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (!exists) {
          clonedArray.push(value);
        }
        operationResult = clonedArray;
        break;
      }

      case 'pop':
        if (clonedArray.length > 0) {
          operationResult = clonedArray.pop();
        } else {
          operationResult = undefined;
        }
        break;

      case 'remove_by_value': {
        if (value === undefined) {
          log.warn(`'remove_by_value' mode requires a 'value' parameter.`);
          return;
        }
        let index;
        if (typeof value !== 'object' || value === null) {
          index = clonedArray.indexOf(value);
        } else {
          const valueAsJson = JSON.stringify(value);
          index = clonedArray.findIndex(
            (item) => JSON.stringify(item) === valueAsJson
          );
        }
        if (index > -1) {
          clonedArray.splice(index, 1);
        }
        operationResult = clonedArray;
        break;
      }

      default:
        log.warn(`MODIFY_CONTEXT_ARRAY: Unknown mode '${mode}'.`);
        return;
    }

    // --- FIX: Set the modified clone back into the context ---
    const finalArray = clonedArray;
    setPath(contextObject, variable_path, finalArray);

    // The result variable should get the popped item or the final state of the array
    const resultForStorage = mode === 'pop' ? operationResult : clonedArray;

    if (result_variable) {
      tryWriteContextVariable(
        result_variable,
        resultForStorage,
        executionContext,
        this.#dispatcher,
        log
      );
    }
  }
}

export default ModifyContextArrayHandler;
