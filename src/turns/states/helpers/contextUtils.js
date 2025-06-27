/**
 * @file Helper utilities for retrieving logger and SafeEventDispatcher from a turn context or handler.
 */

/**
 * @typedef {import('../../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../../../logging/consoleLogger.js').default|Console} Logger
 * @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Retrieves a logger from the given turn context or handler.
 * Falls back to the console when unavailable.
 *
 * @param {ITurnContext|null} turnContext - The current ITurnContext, if any.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {Logger} The resolved logger instance.
 */
export function getLogger(turnContext, handler) {
  try {
    if (turnContext && typeof turnContext.getLogger === 'function') {
      const logger = turnContext.getLogger();
      if (logger) {
        return logger;
      }
    }
  } catch (err) {
    console.error(
      `ContextUtils.getLogger: Error getting logger from turnContext: ${err.message}`,
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
 * Retrieves a SafeEventDispatcher from the given context or handler.
 * Falls back to `handler.getSafeEventDispatcher()` when necessary.
 *
 * @param {ITurnContext|null} turnContext - The current ITurnContext, if any.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {ISafeEventDispatcher|null} The resolved dispatcher or null if unavailable.
 */
export function getSafeEventDispatcher(turnContext, handler) {
  if (turnContext && typeof turnContext.getSafeEventDispatcher === 'function') {
    try {
      const dispatcher = turnContext.getSafeEventDispatcher();
      if (dispatcher && typeof dispatcher.dispatch === 'function') {
        return dispatcher;
      }
    } catch (err) {
      getLogger(turnContext, handler).error(
        `ContextUtils.getSafeEventDispatcher: Error calling turnContext.getSafeEventDispatcher(): ${err.message}`,
        err
      );
    }
  }

  if (handler && typeof handler.getSafeEventDispatcher === 'function') {
    try {
      const dispatcher = handler.getSafeEventDispatcher();
      if (dispatcher && typeof dispatcher.dispatch === 'function') {
        getLogger(turnContext, handler).warn(
          'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher not found on ITurnContext. Falling back to handler.getSafeEventDispatcher().'
        );
        return dispatcher;
      }
    } catch (err) {
      getLogger(turnContext, handler).error(
        `ContextUtils.getSafeEventDispatcher: Error calling handler.getSafeEventDispatcher(): ${err.message}`,
        err
      );
    }
  }

  getLogger(turnContext, handler).warn(
    'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher unavailable.'
  );
  return null;
}

/**
 * Resolves a logger using the provided context or handler.
 *
 * @description Wrapper matching the previous `_resolveLogger` method on
 * `AbstractTurnState`.
 * @param {ITurnContext|null} turnContext - The ITurnContext instance.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {Logger} The resolved logger.
 */
/**
 * Backwards compatible alias for {@link getLogger}.
 *
 * @deprecated Use {@link getLogger} instead.
 */
export const resolveLogger = getLogger;

/**
 * Safely resolves a SafeEventDispatcher using the provided context or handler.
 *
 * @description Mirrors the old `_getSafeEventDispatcher` method from
 * `AbstractTurnState`.
 * @param {ITurnContext|null} turnContext - The ITurnContext instance.
 * @param {BaseTurnHandler} [handler] - Optional handler fallback.
 * @returns {ISafeEventDispatcher|null} The resolved dispatcher or null.
 */
/**
 * Backwards compatible alias for {@link getSafeEventDispatcher}.
 *
 * @deprecated Use {@link getSafeEventDispatcher} instead.
 */
export const resolveSafeDispatcher = getSafeEventDispatcher;
