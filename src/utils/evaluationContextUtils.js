// src/utils/evaluationContextUtils.js
/**
 * @file Utilities for working with the evaluationContext structure.
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { getModuleLogger } from './loggerUtils.js';
import { resolveSafeDispatcher } from './dispatcherUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';

/**
 * Ensures that `executionContext.evaluationContext.context` exists and is an object.
 * Logs and dispatches a standardized error when the context is missing.
 *
 * @param {ExecutionContext} executionContext - The current execution context.
 * @param {ISafeEventDispatcher} [dispatcher] - Optional dispatcher for error events.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {object|null} The context object when available, otherwise `null`.
 */
export function ensureEvaluationContext(executionContext, dispatcher, logger) {
  const log = getModuleLogger('ensureEvaluationContext', logger);
  const context = executionContext?.evaluationContext?.context;
  if (context && typeof context === 'object') {
    return context;
  }

  const safeDispatcher =
    dispatcher || resolveSafeDispatcher(executionContext, log);
  const message =
    'executionContext.evaluationContext.context is missing or invalid.';
  if (safeDispatcher) {
    safeDispatchError(safeDispatcher, message, { executionContext }, log);
  } else {
    log.error(message, { hasExecutionContext: !!executionContext });
  }
  return null;
}

// --- FILE END ---
