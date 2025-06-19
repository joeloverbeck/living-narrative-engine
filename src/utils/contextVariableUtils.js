// src/utils/contextVariableUtils.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from './dispatcherUtils.js';

/**
 * Safely stores a value into `execCtx.evaluationContext.context`. If the context
 * is missing, an error is dispatched (or logged) and the function returns a
 * failure result.
 *
 * @param {string} variableName - Name of the variable to store.
 * @param {*} value - The value to store.
 * @param {import('../logic/defs.js').ExecutionContext} execCtx - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] -
 * Optional dispatcher for error events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger used when no dispatcher is provided.
 * @returns {{success: boolean, error?: Error}} Result of the store operation.
 */
export function storeResult(variableName, value, execCtx, dispatcher, logger) {
  const log = getModuleLogger('contextVariableUtils', logger);
  const safeDispatcher = resolveSafeDispatcher(execCtx, dispatcher, log);

  const hasContext =
    execCtx?.evaluationContext &&
    typeof execCtx.evaluationContext.context === 'object' &&
    execCtx.evaluationContext.context !== null;

  if (!hasContext) {
    const err = new Error(
      'storeResult: evaluationContext.context is missing; cannot store result'
    );
    if (safeDispatcher) {
      safeDispatchError(safeDispatcher, err.message, { variableName });
    }
    return { success: false, error: err };
  }

  try {
    execCtx.evaluationContext.context[variableName] = value;
    return { success: true };
  } catch (e) {
    const err = new Error(
      `storeResult: Failed to write variable "${variableName}"`
    );
    if (safeDispatcher) {
      safeDispatchError(safeDispatcher, err.message, {
        variableName,
        error: e.message,
        stack: e.stack,
      });
    }
    return { success: false, error: err };
  }
}

/**
 * Wrapper around {@link storeResult} that trims the variable name and validates
 * it before storage.
 *
 * @param {string|null|undefined} variableName - Target context variable name.
 * @param {*} value - Value to store.
 * @param {import('../logic/defs.js').ExecutionContext} execCtx - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher]
 *   Optional dispatcher for error events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger used when no dispatcher is provided.
 * @returns {boolean} `true` when the value was successfully stored.
 */
export function setContextValueResult(
  variableName,
  value,
  execCtx,
  dispatcher,
  logger
) {
  const trimmedName =
    typeof variableName === 'string' ? variableName.trim() : '';
  const log = getModuleLogger('contextVariableUtils', logger);

  if (!trimmedName) {
    const safeDispatcher = resolveSafeDispatcher(execCtx, dispatcher, log);
    const err = new Error(
      'setContextValue: variableName must be a non-empty string.'
    );
    if (safeDispatcher) {
      safeDispatchError(safeDispatcher, err.message, {
        variableName,
      });
    }
    return { success: false, error: err };
  }

  return storeResult(trimmedName, value, execCtx, dispatcher, logger);
}

/**
 *
 * @param variableName
 * @param value
 * @param execCtx
 * @param dispatcher
 * @param logger
 */
export function setContextValue(
  variableName,
  value,
  execCtx,
  dispatcher,
  logger
) {
  return setContextValueResult(variableName, value, execCtx, dispatcher, logger)
    .success;
}

export default storeResult;
