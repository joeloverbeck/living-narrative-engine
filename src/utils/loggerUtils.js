// src/utils/loggerUtils.js
// --- FILE START ---
/* eslint-disable no-console */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Ensures that a valid logger object is available. If the provided logger is
 * missing or does not implement the expected methods, a console-based fallback
 * logger is returned. Optionally prefixes fallback log messages with a context
 * string for clarity.
 *
 * @param {ILogger | undefined | null} logger - The logger instance to validate.
 * @param {string} [fallbackMessagePrefix] - Prefix for messages
 * logged by the fallback logger.
 * @returns {ILogger} A valid logger instance.
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
  const fallback = {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    debug: (...args) => console.debug(prefix, ...args),
  };

  if (logger) {
    fallback.warn(
      `An invalid logger instance was provided. Falling back to console logging with prefix "${fallbackMessagePrefix}".`
    );
  }

  return fallback;
}

/**
 * Creates a logger that prepends a prefix to all messages before delegating
 * to the provided base logger. Useful for tagging log output with a service
 * identifier while keeping the original logger implementation.
 *
 * @param {ILogger} baseLogger - The logger to wrap.
 * @param {string} prefix - Prefix to prepend to each logged message.
 * @returns {ILogger} Logger wrapper with prefixed output methods.
 */
export function createPrefixedLogger(baseLogger, prefix) {
  const safePrefix = prefix || '';
  return {
    debug: (msg, ...args) => baseLogger.debug(`${safePrefix}${msg}`, ...args),
    info: (msg, ...args) => baseLogger.info(`${safePrefix}${msg}`, ...args),
    warn: (msg, ...args) => baseLogger.warn(`${safePrefix}${msg}`, ...args),
    error: (msg, ...args) => baseLogger.error(`${safePrefix}${msg}`, ...args),
  };
}

// --- FILE END ---
