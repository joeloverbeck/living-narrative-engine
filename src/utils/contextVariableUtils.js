// src/utils/contextVariableUtils.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from './dispatcherUtils.js';
import { isNonBlankString } from './textUtils.js';
import { safeCall } from './safeExecutionUtils.js';
import {
  getEvaluationContext,
  ensureEvaluationContext,
} from './evaluationContextUtils.js';

/**
 * Validate that the variable name is usable for storage.
 *
 * @param {string} variableName Variable name to validate.
 * @returns {{valid: boolean, error?: Error, name?: string}} Validation result.
 * @private
 */
function _validateVariableName(variableName) {
  if (!isNonBlankString(variableName)) {
    return {
      valid: false,
      error: new Error(`Invalid variableName: "${variableName}"`),
    };
  }

  return { valid: true, name: variableName };
}

/**
 * Safely assign a key-value pair on the provided context object.
 *
 * @description Safely assigns a value to a key on the provided context object.
 *   Any thrown error is caught and returned in the result structure. **This
 *   function mutates the provided `context` object.**
 * @param {object} context - Context object that will receive the new value.
 * @param {string} key - Property name to set on the context.
 * @param {*} value - Value to assign.
 * @returns {{success: boolean, error?: Error}} Result of the assignment.
 */
export function setContextValue(context, key, value) {
  const { success, error } = safeCall(() => {
    context[key] = value;
  });
  return success ? { success: true } : { success: false, error };
}

/**
 * Creates a new context object with the specified key/value pair assigned.
 *
 * @description Immutable alternative to {@link setContextValue}. The original
 *   `context` object is not modified.
 * @param {object} context - Original context object.
 * @param {string} key - Property name to set on the context.
 * @param {*} value - Value to assign.
 * @returns {{success: boolean, context?: object, error?: Error}} Result object
 *   containing the new context when successful.
 */
export function withUpdatedContext(context, key, value) {
  if (!context || typeof context !== 'object') {
    return {
      success: false,
      error: new Error('withUpdatedContext: invalid context object'),
    };
  }

  const { success, result, error } = safeCall(() => ({
    ...context,
    [key]: value,
  }));
  return success
    ? { success: true, context: result }
    : { success: false, error };
}

/**
 * Safely stores a value into `executionContext.evaluationContext.context`. If the context
 * is missing, an error is dispatched (or logged) and the function returns a
 * failure result.
 *
 * @param {string} variableName - Name of the variable to store.
 * @param {*} value - The value to store.
 * @param {import('../logic/defs.js').ExecutionContext} executionContext - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] -
 * Optional dispatcher for error events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger used when no dispatcher is provided.
 * @returns {{success: boolean, error?: Error}} Result of the store operation.
 */
export function writeContextVariable(
  variableName,
  value,
  executionContext,
  dispatcher,
  logger
) {
  const moduleLogger = getModuleLogger('contextVariableUtils', logger);
  const safeDispatcher =
    dispatcher || resolveSafeDispatcher(executionContext, moduleLogger);
  const { valid, error, name } = _validateVariableName(variableName);

  if (!valid) {
    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        error.message,
        { variableName },
        moduleLogger
      );
    }
    return { success: false, error };
  }

  const contextObject = ensureEvaluationContext(
    executionContext,
    safeDispatcher,
    moduleLogger
  );
  if (!contextObject) {
    return {
      success: false,
      error: new Error(
        'writeContextVariable: evaluationContext.context is missing; cannot store value'
      ),
    };
  }

  const { success, error: setError } = setContextValue(
    contextObject,
    name,
    value
  );
  if (success) {
    return { success: true };
  }
  const err = new Error(
    `writeContextVariable: Failed to write variable "${variableName}"`
  );
  if (safeDispatcher) {
    safeDispatchError(
      safeDispatcher,
      err.message,
      {
        variableName,
        error: setError?.message,
        stack: setError?.stack,
      },
      moduleLogger
    );
  }
  return { success: false, error: err };
}

/**
 * Wrapper around {@link writeContextVariable} that validates the variable name
 * before storage.
 *
 * @param {string|null|undefined} variableName - Target context variable name.
 * @param {*} value - Value to store.
 * @param {import('../logic/defs.js').ExecutionContext} executionContext - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher]
 *   Optional dispatcher for error events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger used when no dispatcher is provided.
 * @returns {{success: boolean, error?: Error}} Result of the store operation.
 */
export function tryWriteContextVariable(
  variableName,
  value,
  executionContext,
  dispatcher,
  logger
) {
  const moduleLogger = getModuleLogger('contextVariableUtils', logger);
  const validation = _validateVariableName(variableName);
  if (!validation.valid) {
    const safeDispatcher =
      dispatcher || resolveSafeDispatcher(executionContext, moduleLogger);
    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        validation.error.message,
        {
          variableName,
        },
        moduleLogger
      );
    }
    return { success: false, error: validation.error };
  }

  return writeContextVariable(
    validation.name,
    value,
    executionContext,
    dispatcher,
    logger
  );
}
