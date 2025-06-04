// llm-proxy-server/src/utils/loggerUtils.js

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Ensures that a valid logger object is available, providing a console fallback if necessary.
 * @param {ILogger | undefined | null} logger - The logger instance to validate.
 * @param {string} [fallbackMessagePrefix] - A prefix for messages logged by the fallback console logger.
 * @returns {ILogger} A valid logger instance (either the one provided or a console-based fallback).
 */
export function ensureValidLogger(
  logger,
  fallbackMessagePrefix = 'FallbackLogger'
) {
  if (
    logger &&
    typeof logger.info === 'function' &&
    typeof logger.warn === 'function' &&
    typeof logger.error === 'function' &&
    typeof logger.debug === 'function'
  ) {
    return logger;
  }

  const prefix = fallbackMessagePrefix ? `${fallbackMessagePrefix}: ` : '';
  // Create a simple console logger that adheres to ILogger
  const fallbackLogger = {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    debug: (...args) => console.debug(prefix, ...args),
  };

  if (logger) {
    // Logger was provided but invalid
    fallbackLogger.warn(
      `An invalid logger instance was provided. Falling back to console logging with prefix "${fallbackMessagePrefix}".`
    );
  } else {
    // Logger was not provided at all
    // This case might be too noisy if ensureValidLogger is called frequently in contexts where logger might legitimately be undefined.
    // Consider if this specific log is always desirable. For now, keeping it for explicitness.
    // fallbackLogger.info(`No logger instance was provided. Using console logging with prefix "${fallbackMessagePrefix}".`);
  }

  return fallbackLogger;
}
