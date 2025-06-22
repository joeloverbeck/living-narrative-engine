/**
 * @file Helper utilities for retrieving logger and SafeEventDispatcher from a turn context or handler.
 */

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../logging/consoleLogger.js').default|Console} Logger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Resolves a logger using the provided context or handler.
 * Falls back to the console when unavailable.
 *
 * @param {ITurnContext|null} turnCtx - The current ITurnContext, if any.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {Logger} The resolved logger instance.
 */
export function getLogger(turnCtx, handler) {
  try {
    if (turnCtx && typeof turnCtx.getLogger === 'function') {
      const logger = turnCtx.getLogger();
      if (logger) {
        return logger;
      }
    }
  } catch (err) {
    console.error(
      `ContextUtils.getLogger: Error getting logger from turnCtx: ${err.message}`,
      err
    );
  }

  try {
    if (handler && typeof handler.getLogger === 'function') {
      const logger = handler.getLogger();
      if (logger) {
        return logger;
      }
    }
  } catch (err) {
    console.error(
      `ContextUtils.getLogger: Error getting logger from handler: ${err.message}`,
      err
    );
  }

  return console;
}

/**
 * Safely resolves a SafeEventDispatcher using the provided context or handler.
 * Falls back to handler.getSafeEventDispatcher() when necessary.
 *
 * @param {ITurnContext|null} turnCtx - The current ITurnContext, if any.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {ISafeEventDispatcher|null} The resolved dispatcher or null if unavailable.
 */
export function getSafeEventDispatcher(turnCtx, handler) {
  if (turnCtx && typeof turnCtx.getSafeEventDispatcher === 'function') {
    try {
      const dispatcher = turnCtx.getSafeEventDispatcher();
      if (dispatcher && typeof dispatcher.dispatch === 'function') {
        return dispatcher;
      }
    } catch (err) {
      getLogger(turnCtx, handler).error(
        `ContextUtils.getSafeEventDispatcher: Error calling turnCtx.getSafeEventDispatcher(): ${err.message}`,
        err
      );
    }
  }

  if (handler && typeof handler.getSafeEventDispatcher === 'function') {
    try {
      const dispatcher = handler.getSafeEventDispatcher();
      if (dispatcher && typeof dispatcher.dispatch === 'function') {
        getLogger(turnCtx, handler).warn(
          'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher not found on ITurnContext. Falling back to handler.getSafeEventDispatcher().'
        );
        return dispatcher;
      }
    } catch (err) {
      getLogger(turnCtx, handler).error(
        `ContextUtils.getSafeEventDispatcher: Error calling handler.getSafeEventDispatcher(): ${err.message}`,
        err
      );
    }
  }

  getLogger(turnCtx, handler).warn(
    'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher unavailable.'
  );
  return null;
}
