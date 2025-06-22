// src/utils/contextVariableUtils.js

import { getModuleLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from './dispatcherUtils.js';
import { isNonBlankString } from './textUtils.js';

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
  const log = getModuleLogger('contextVariableUtils', logger);
  const safeDispatcher =
    dispatcher || resolveSafeDispatcher(executionContext, log);
  const { valid, error, name } = _validateContextAndName(
    variableName,
    executionContext
  );

  if (!valid) {
    if (safeDispatcher) {
      safeDispatchError(safeDispatcher, error.message, { variableName }, log);
    }
    return { success: false, error };
  }

  try {
    executionContext.evaluationContext.context[name] = value;
    return { success: true };
  } catch (e) {
    const err = new Error(
      `writeContextVariable: Failed to write variable "${variableName}"`
    );
    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        err.message,
        {
          variableName,
          error: e.message,
          stack: e.stack,
        },
        log
      );
    }
    return { success: false, error: err };
  }
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
  const log = getModuleLogger('contextVariableUtils', logger);
  const validation = _validateContextAndName(variableName, executionContext);
  if (!validation.valid) {
    const safeDispatcher =
      dispatcher || resolveSafeDispatcher(executionContext, log);
    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        validation.error.message,
        {
          variableName,
        },
        log
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
