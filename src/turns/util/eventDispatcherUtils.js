/**
 * @file Helper for retrieving a SafeEventDispatcher in turn states.
 */

/**
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

import { resolveLogger } from './loggerUtils.js';

/**
 * Safely resolves a SafeEventDispatcher using a turn context or handler fallback.
 *
 * @param {ITurnContext | null} turnCtx - Current ITurnContext.
 * @param {BaseTurnHandler} [handler] - Optional handler providing a dispatcher.
 * @returns {ISafeEventDispatcher|null} The dispatcher or `null` if unavailable.
 */
export function getSafeEventDispatcher(turnCtx, handler) {
  const logger = resolveLogger(turnCtx, handler);

  if (turnCtx && typeof turnCtx.getSafeEventDispatcher === 'function') {
    try {
      const dispatcher = turnCtx.getSafeEventDispatcher();
      if (dispatcher && typeof dispatcher.dispatch === 'function') {
        return dispatcher;
      }
    } catch (err) {
      logger.error(
        `Error calling turnCtx.getSafeEventDispatcher(): ${err.message}`,
        err
      );
    }
  }

  if (
    handler?.safeEventDispatcher &&
    typeof handler.safeEventDispatcher.dispatch === 'function'
  ) {
    logger.warn(
      'SafeEventDispatcher not found on ITurnContext. Falling back to handler.safeEventDispatcher.'
    );
    return handler.safeEventDispatcher;
  }

  logger.warn('SafeEventDispatcher unavailable.');
  return null;
}

export default getSafeEventDispatcher;
