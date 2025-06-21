// src/utils/dispatcherUtils.js

import { SafeEventDispatcher } from '../events/safeEventDispatcher.js';

/**
 * Resolves a usable ISafeEventDispatcher instance.
 *
 * @description
 * Instantiates and returns a dispatcher when the execution context contains a
 * validatedEventDispatcher. A custom dispatcher class can be provided for
 * testing. Construction failures result in `null`.
 * @param {import('../logic/defs.js').ExecutionContext} execCtx - Execution context.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger passed to the dispatcher.
 * @param {typeof SafeEventDispatcher} [DispatcherClass] -
 *   Class used to instantiate the dispatcher when needed.
 * @returns {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher | null}
 *   The resolved dispatcher or `null` when unavailable.
 */
export function resolveSafeDispatcher(
  execCtx,
  logger,
  DispatcherClass = SafeEventDispatcher
) {
  if (execCtx?.validatedEventDispatcher) {
    try {
      return new DispatcherClass({
        validatedEventDispatcher: execCtx.validatedEventDispatcher,
        logger,
      });
    } catch {
      return null;
    }
  }

  return null;
}
