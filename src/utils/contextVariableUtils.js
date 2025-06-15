// src/utils/contextVariableUtils.js

import { getPrefixedLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchError.js';
import { SafeEventDispatcher } from '../events/safeEventDispatcher.js';

/**
 * Safely stores a value into `execCtx.evaluationContext.context`. If the context
 * is missing, an error is dispatched (or logged) and the function returns
 * `false`.
 *
 * @param {string} variableName - Name of the variable to store.
 * @param {*} value - The value to store.
 * @param {import('../logic/defs.js').ExecutionContext} execCtx - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] -
 * Optional dispatcher for error events.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger used when no dispatcher is provided.
 * @returns {boolean} `true` if the value was stored successfully, otherwise `false`.
 */
export function storeResult(variableName, value, execCtx, dispatcher, logger) {
  const log = getPrefixedLogger(logger, '[contextVariableUtils] ');

  let safeDispatcher = dispatcher;
  if (!safeDispatcher && execCtx?.validatedEventDispatcher) {
    try {
      safeDispatcher = new SafeEventDispatcher({
        validatedEventDispatcher: execCtx.validatedEventDispatcher,
        logger: log,
      });
    } catch {
      safeDispatcher = null;
    }
  }

  const hasContext =
    execCtx?.evaluationContext &&
    typeof execCtx.evaluationContext.context === 'object' &&
    execCtx.evaluationContext.context !== null;

  if (!hasContext) {
    const message =
      'storeResult: evaluationContext.context is missing; cannot store result';
    if (safeDispatcher) {
      safeDispatchError(safeDispatcher, message, { variableName });
    }
    return false;
  }

  try {
    execCtx.evaluationContext.context[variableName] = value;
    return true;
  } catch (e) {
    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        `storeResult: Failed to write variable "${variableName}"`,
        {
          variableName,
          error: e.message,
          stack: e.stack,
        }
      );
    }
    return false;
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
export function setContextValue(
  variableName,
  value,
  execCtx,
  dispatcher,
  logger
) {
  const trimmedName =
    typeof variableName === 'string' ? variableName.trim() : '';
  const log = getPrefixedLogger(logger, '[contextVariableUtils] ');

  if (!trimmedName) {
    let safeDispatcher = dispatcher;
    if (!safeDispatcher && execCtx?.validatedEventDispatcher) {
      try {
        safeDispatcher = new SafeEventDispatcher({
          validatedEventDispatcher: execCtx.validatedEventDispatcher,
          logger: log,
        });
      } catch {
        safeDispatcher = null;
      }
    }

    if (safeDispatcher) {
      safeDispatchError(
        safeDispatcher,
        'setContextValue: variableName must be a non-empty string.',
        {
          variableName,
        }
      );
    }
    return false;
  }

  return storeResult(trimmedName, value, execCtx, dispatcher, logger);
}

export default storeResult;
