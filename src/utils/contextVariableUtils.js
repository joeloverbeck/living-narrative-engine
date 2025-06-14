// src/utils/contextVariableUtils.js
/* eslint-disable no-console */

import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';

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
  const hasContext =
    execCtx?.evaluationContext &&
    typeof execCtx.evaluationContext.context === 'object' &&
    execCtx.evaluationContext.context !== null;

  if (!hasContext) {
    const message =
      'storeResult: evaluationContext.context is missing; cannot store result';
    if (dispatcher?.dispatch) {
      dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message,
        details: { variableName },
      });
    } else if (logger?.error) {
      logger.error(message, { variableName });
    } else {
      console.error(message, { variableName });
    }
    return false;
  }

  try {
    execCtx.evaluationContext.context[variableName] = value;
    return true;
  } catch (e) {
    if (dispatcher?.dispatch) {
      dispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `storeResult: Failed to write variable "${variableName}"`,
        details: { variableName, error: e.message, stack: e.stack },
      });
    } else if (logger?.error) {
      logger.error(`storeResult: Failed to write variable "${variableName}"`, {
        variableName,
        error: e.message,
        stack: e.stack,
      });
    } else {
      console.error(
        `storeResult: Failed to write variable "${variableName}"`,
        e
      );
    }
    return false;
  }
}

export default storeResult;
