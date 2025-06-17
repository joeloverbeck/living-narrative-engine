// src/utils/dispatcherUtils.js

import { SafeEventDispatcher } from '../events/safeEventDispatcher.js';

/**
 * Resolves a usable ISafeEventDispatcher instance.
 *
 * @description
 * Returns the provided dispatcher when available. Otherwise, if the execution
 * context contains a validatedEventDispatcher, a new SafeEventDispatcher is
 * constructed using the supplied logger. Construction failures result in
 * `null`.
 * @param {import('../logic/defs.js').ExecutionContext} execCtx - Execution context.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] -
 *   Optional pre-existing dispatcher.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger passed to the SafeEventDispatcher.
 * @returns {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher | null}
 *   The resolved dispatcher or `null` when unavailable.
 */
export function resolveSafeDispatcher(execCtx, dispatcher, logger) {
  if (dispatcher) {
    return dispatcher;
  }

  if (execCtx?.validatedEventDispatcher) {
    try {
      return new SafeEventDispatcher({
        validatedEventDispatcher: execCtx.validatedEventDispatcher,
        logger,
      });
    } catch {
      return null;
    }
  }

  return null;
}

export default resolveSafeDispatcher;
