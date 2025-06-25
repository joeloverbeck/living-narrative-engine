// src/utils/evaluationContextUtils.js

/**
 * @module evaluationContextUtils
 * @description Utilities for validating and retrieving the evaluation context.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */

import { ensureValidLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * Ensures that `executionContext.evaluationContext.context` exists and is an object.
 *
 * Logs an error and dispatches a `core:system_error_occurred` event when the
 * context is missing or invalid.
 *
 * @param {ExecutionContext} executionContext - The current execution context.
 * @param {ISafeEventDispatcher} [dispatcher] - Dispatcher for error events.
 * @param {ILogger} [logger] - Optional logger used when dispatcher is absent.
 * @returns {object|null} The context object or `null` when unavailable.
 */
export function ensureEvaluationContext(executionContext, dispatcher, logger) {
  const log = ensureValidLogger(logger, 'ensureEvaluationContext');

  const ctx = executionContext?.evaluationContext?.context;
  if (ctx && typeof ctx === 'object') {
    return ctx;
  }

  const message =
    'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.';

  if (dispatcher && typeof dispatcher.dispatch === 'function') {
    safeDispatchError(
      dispatcher,
      message,
      { hasExecutionContext: !!executionContext },
      log
    );
  } else {
    log.error(message);
  }

  return null;
}

// --- FILE END ---
