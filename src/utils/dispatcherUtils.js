// src/utils/dispatcherUtils.js

import { SafeEventDispatcher } from '../events/safeEventDispatcher.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Resolves a usable ISafeEventDispatcher instance.
 *
 * @description
 * Instantiates and returns a dispatcher when the execution context contains a
 * validatedEventDispatcher. A custom dispatcher factory can be provided for
 * testing. Construction failures result in `null`.
 * @param {import('../logic/defs.js').ExecutionContext} executionContext - Execution context.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger passed to the dispatcher.
 * @param {(opts: {
 * validatedEventDispatcher: import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher,
 * logger: import('../interfaces/coreServices.js').ILogger
 * }) => import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcherFactory]
 *   Factory used to instantiate the dispatcher when needed.
 * @returns {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher | null}
 *   The resolved dispatcher or `null` when unavailable.
 */
export function resolveSafeDispatcher(
  executionContext,
  logger,
  dispatcherFactory = (opts) => new SafeEventDispatcher(opts)
) {
  const log = ensureValidLogger(logger, 'resolveSafeDispatcher');
  if (!executionContext?.validatedEventDispatcher) {
    log.warn('resolveSafeDispatcher: validatedEventDispatcher not available.');
    return null;
  }

  try {
    return dispatcherFactory({
      validatedEventDispatcher: executionContext.validatedEventDispatcher,
      logger: log,
    });
  } catch (err) {
    log.warn(
      `resolveSafeDispatcher: Failed to create SafeEventDispatcher – ${err.message}`
    );
    return null;
  }
}
