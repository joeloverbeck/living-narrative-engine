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
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import {
  advancedArrayModify,
  ARRAY_MODIFICATION_MODES,
} from '../utils/arrayModifyUtils.js';
import { setByPath } from '../utils/objectPathUtils.js';

/**
 * @class ModifyContextArrayHandler
 * @description Handles the 'MODIFY_CONTEXT_ARRAY' operation. It provides direct,
 * safe modification of an array stored as a context variable by operating on a clone.
 * @implements {OperationHandler}
 */
class ModifyContextArrayHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * Construct a new ModifyContextArrayHandler.
   *
   * @param {object} deps - The dependencies for the handler.
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
   * Validate parameters for {@link execute}.
   *
   * @param {object} params - Raw parameters object.
   * @param {ILogger} logger - Logger instance for diagnostics.
   * @returns {{
   *   variablePath: string,
   *   mode: 'push'|'push_unique'|'pop'|'remove_by_value',
   *   value: *,
   *   resultVariable: string|null
   * }|null} Normalized parameters or `null` when invalid.
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, logger, 'MODIFY_CONTEXT_ARRAY')) {
      return null;
    }

    const { variable_path, mode, value, result_variable } = params;
    
    if (!variable_path || !mode) {
      logger.warn(
        'MODIFY_CONTEXT_ARRAY: Missing required parameters (variable_path, or mode).'
      );
      return null;
    }

    if (!ARRAY_MODIFICATION_MODES.includes(mode)) {
      logger.warn(`MODIFY_CONTEXT_ARRAY: Unknown mode '${mode}'.`);
      return null;
    }

    if (
      value === undefined &&
      (mode === 'push' || mode === 'push_unique' || mode === 'remove_by_value')
    ) {
      logger.warn(`'${mode}' mode requires a 'value' parameter.`);
      return null;
    }

    return {
      variablePath: variable_path,
      mode,
      value,
      resultVariable: result_variable || null
    };
  }

  /**
   * Resolve the array from the context, handling initialization for push modes.
   *
   * @param {object} contextObject - The execution context object.
   * @param {string} variablePath - Dot-separated path to the array variable.
   * @param {string} mode - The operation mode.
   * @param {ILogger} logger - Logger instance.
   * @returns {Array|null} The cloned array or `null` if resolution fails.
   * @private
   */
  #resolveArray(contextObject, variablePath, mode, logger) {
    const resolvedValue = resolvePath(contextObject, variablePath);

    if (Array.isArray(resolvedValue)) {
      return cloneDeep(resolvedValue);
    }

    if (
      resolvedValue === undefined &&
      (mode === 'push' || mode === 'push_unique')
    ) {
      logger.debug(
        `MODIFY_CONTEXT_ARRAY: Path '${variablePath}' does not exist. Initializing as empty array for mode '${mode}'.`
      );
      return [];
    }

    let message = `MODIFY_CONTEXT_ARRAY: Context variable path '${variablePath}' `;
    if (resolvedValue === undefined) {
      message += `does not exist, and mode '${mode}' does not support initialization from undefined.`;
    } else {
      message += `does not resolve to an array (found type: ${typeof resolvedValue}).`;
    }
    logger.warn(message);
    return null;
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

    // Validate parameters
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return;
    }

    const { variablePath, mode, value, resultVariable } = validated;

    // Ensure execution context exists
    const contextObject = ensureEvaluationContext(
      executionContext,
      this.#dispatcher,
      log
    );
    if (!contextObject) {
      return;
    }

    // Resolve the array
    const clonedArray = this.#resolveArray(contextObject, variablePath, mode, log);
    if (!clonedArray) {
      return;
    }

    // Log the operation
    let debugMessage = `MODIFY_CONTEXT_ARRAY: Performing '${mode}' on context variable '${variablePath}'.`;
    if (
      value !== undefined &&
      (mode === 'push' || mode === 'push_unique' || mode === 'remove_by_value')
    ) {
      try {
        // Attempt to stringify, but catch errors for complex objects or circular refs
        debugMessage += ` Value: ${JSON.stringify(value)}.`;
      } catch {
        debugMessage += ` Value: [unable to stringify].`;
      }
    }
    log.debug(debugMessage);

    // Apply the modification
    const { nextArray, result } = advancedArrayModify(
      mode,
      clonedArray,
      value,
      log
    );

    // Set the modified array back into the context
    setByPath(contextObject, variablePath, nextArray);

    // Store result if requested
    if (resultVariable) {
      const resultForStorage = mode === 'pop' ? result : nextArray;
      tryWriteContextVariable(
        resultVariable,
        resultForStorage,
        executionContext,
        this.#dispatcher,
        log
      );
    }
  }
}

export default ModifyContextArrayHandler;
