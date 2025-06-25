// src/utils/contextVariableUtils.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from './dispatcherUtils.js';
import { isNonBlankString } from './textUtils.js';
import { safeCall } from './safeExecutionUtils.js';

/**
 * Validate that the context exists and the variable name is valid.
 *
 * @param {string} variableName Variable name to validate.
 * @param {import('../logic/defs.js').ExecutionContext} executionContext Execution context.
 * @returns {{valid: boolean, error?: Error, name?: string}} Validation result.
 * @private
 */
function _validateContextAndName(variableName, executionContext) {
  if (!isNonBlankString(variableName)) {
    return {
      valid: false,
      error: new Error(`Invalid variableName: "${variableName}"`),
    };
  }

  const hasContext =
    executionContext?.evaluationContext &&
    typeof executionContext.evaluationContext.context === 'object' &&
    executionContext.evaluationContext.context !== null;

  if (!hasContext) {
    return {
      valid: false,
      error: new Error(
        'writeContextVariable: evaluationContext.context is missing; cannot store value'
      ),
    };
  }

  return { valid: true, name: variableName };
}

/**
 * Safely assign a key-value pair on the provided context object.
 *
 * @description Safely assigns a value to a key on the provided context object.
 *   Any thrown error is caught and returned in the result structure.
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
  const { valid, error, name } = _validateContextAndName(
    variableName,
    executionContext
  );

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

  const { success, error: setError } = setContextValue(
    executionContext.evaluationContext.context,
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
  const validation = _validateContextAndName(variableName, executionContext);
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
