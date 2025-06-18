/**
 * @file Utility functions for resolving loggers within turn states.
 */

/**
 * @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 */

/**
 * Safely resolves a logger using a turn context or handler fallback.
 *
 * @param {ITurnContext | null} turnCtx - Current ITurnContext, if available.
 * @param {BaseTurnHandler} [handler] - Optional handler providing a logger.
 * @returns {import('../../logging/consoleLogger.js').default | Console} The resolved logger.
 */
export function resolveLogger(turnCtx, handler) {
  try {
    if (turnCtx && typeof turnCtx.getLogger === 'function') {
      const logger = turnCtx.getLogger();
      if (logger) {
        return logger;
      }
    }
  } catch (err) {
    console.error(`Error getting logger from turnCtx: ${err.message}`, err);
  }

  try {
    if (handler && typeof handler.getLogger === 'function') {
      const logger = handler.getLogger();
      if (logger) {
        return logger;
      }
    }
  } catch (err) {
    console.error(`Error getting logger from handler: ${err.message}`, err);
  }

  return console;
}

export default resolveLogger;
