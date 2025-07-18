// src/utils/loggerUtils.js
// --- FILE START ---
/* eslint-disable no-console */
/**
 * @file Utility functions for logging.
 * @description Re-exported from {@link src/utils/index.js}. Prefer importing
 * from the central index.
 */

/**
 * Ensures that a valid logger object is available. If the provided logger is
 * missing or does not implement the expected methods, a console-based fallback
 * logger is returned. Optionally prefixes fallback log messages with a context
 * string for clarity.
 *
 * @param {(import("../interfaces/coreServices.js").ILogger | undefined | null)} logger - The logger instance to validate.
 * @param {string} [fallbackMessagePrefix] - Prefix for messages
 * logged by the fallback logger.
 * @returns {import("../interfaces/coreServices.js").ILogger} A valid logger instance.
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
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  const fallback = {
    /**
     * @param {string} message
     * @param {...any} args
     * @returns {void}
     */
    info(message, ...args) {
      console.info(prefix, message, ...args);
    },
    /**
     * @param {string} message
     * @param {...any} args
     * @returns {void}
     */
    warn(message, ...args) {
      console.warn(prefix, message, ...args);
    },
    /**
     * @param {string} message
     * @param {...any} args
     * @returns {void}
     */
    error(message, ...args) {
      console.error(prefix, message, ...args);
    },
    /**
     * @param {string} message
     * @param {...any} args
     * @returns {void}
     */
    debug(message, ...args) {
      console.debug(prefix, message, ...args);
    },
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
 * @param {import("../interfaces/coreServices.js").ILogger} baseLogger - The logger to wrap.
 * @param {string} prefix - Prefix to prepend to each logged message.
 * @returns {import("../interfaces/coreServices.js").ILogger} Logger wrapper with prefixed output methods.
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

/**
 * Convenience wrapper that validates the provided logger and returns a new logger that
 * automatically prefixes all messages. Useful for utilities that consistently tag their log output.
 *
 * @description Convenience wrapper that validates the provided logger and
 * returns a new logger that automatically prefixes all messages. Useful for
 * utilities that consistently tag their log output.
 * @param {(import("../interfaces/coreServices.js").ILogger | undefined | null)} logger - Logger instance to validate.
 * @param {string} prefix - The prefix applied to each log message.
 * @returns {import("../interfaces/coreServices.js").ILogger} Logger instance that prepends `prefix` to each message.
 */
export function getPrefixedLogger(logger, prefix) {
  const validLogger = ensureValidLogger(logger, prefix);
  const effectivePrefix = prefix || '';
  return createPrefixedLogger(validLogger, effectivePrefix);
}

/**
 * Validates the given logger and returns a prefixed wrapper using the provided
 * prefix. This is a light-weight helper for service initialization where a
 * simple prefixed logger is sufficient.
 *
 * @param {(import("../interfaces/coreServices.js").ILogger | undefined | null)} logger - Logger instance to validate.
 * @param {string} prefix - Prefix to prepend to every log message.
 * @returns {import("../interfaces/coreServices.js").ILogger} Logger instance that prefixes messages with `prefix`.
 */
export function setupPrefixedLogger(logger, prefix) {
  const name = (prefix || '').replace(/[:\s]+$/, '');
  const validated = initLogger(name, logger);
  return createPrefixedLogger(validated, prefix || '');
}

/**
 * Convenience wrapper for creating a logger prefixed with the module name in square brackets.
 * Falls back to the console when the base logger is missing.
 *
 * @description Convenience wrapper for creating a logger prefixed with the
 * module name in square brackets. Falls back to the console when the base
 * logger is missing.
 * @param {string} moduleName - Name of the module using the logger.
 * @param {(import("../interfaces/coreServices.js").ILogger | undefined | null)} logger - Optional logger instance.
 * @returns {import("../interfaces/coreServices.js").ILogger} Logger instance that prefixes messages with `[moduleName]`.
 */
export function getModuleLogger(moduleName, logger) {
  return getPrefixedLogger(logger, `[${moduleName}] `);
}

/**
 * Validates a logger and returns a safe logger instance via {@link ensureValidLogger}.
 * When `optional` is true, missing loggers are allowed and will result in a console-based fallback.
 *
 * @description Validates a logger and returns a safe logger instance via
 * {@link ensureValidLogger}. When `optional` is true, missing loggers are
 * allowed and will result in a console-based fallback.
 * @param {string} serviceName - Name used for fallback prefix and error messages.
 * @param {(import("../interfaces/coreServices.js").ILogger | undefined | null)} logger - Logger instance to validate.
 * @param {object} [options] - Additional options.
 * @param {boolean} [options.optional] - Whether the logger is optional.
 * @returns {import("../interfaces/coreServices.js").ILogger} A valid logger instance.
 */
export function initLogger(serviceName, logger, { optional = false } = {}) {
  if (!optional || logger) {
    // Inline logger validation to avoid circular dependency
    if (logger === null || logger === undefined) {
      const errorMsg = 'Missing required dependency: logger.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Check required methods
    const requiredMethods = ['info', 'warn', 'error', 'debug'];
    for (const method of requiredMethods) {
      if (typeof logger[method] !== 'function') {
        const errorMsg = `Invalid or missing method '${method}' on dependency 'logger'.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }
  return ensureValidLogger(logger, serviceName);
}

/**
 * Logs a truncated preview of `data` at the debug level.
 * If `data` is not a string, it will be JSON stringified first.
 *
 * @param {import("../interfaces/coreServices.js").ILogger} logger - Logger instance used to emit the preview.
 * @param {string} label - Text to prepend to the preview message.
 * @param {any} data - The data to preview.
 * @param {number} [length] - Maximum number of characters to include.
 * @returns {void}
 */
export function logPreview(logger, label, data, length = 100) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const preview = str.substring(0, length) + (str.length > length ? '...' : '');
  logger.debug(`${label}${preview}`);
}

/**
 * Logs a start message using the debug level.
 *
 * @description Prepends a play emoji to the provided context string and logs
 * it at the debug level.
 * @param {import("../interfaces/coreServices.js").ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @returns {void}
 */
export function logStart(logger, context) {
  logger.debug(`▶️  ${context}`);
}

/**
 * Logs an end/completion message using the debug level.
 *
 * @description Prepends a check mark emoji to the provided context string and
 * logs it at the debug level.
 * @param {import("../interfaces/coreServices.js").ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @returns {void}
 */
export function logEnd(logger, context) {
  logger.debug(`✅ ${context}`);
}

/**
 * Logs an error message using the error level.
 *
 * @description Prepends a cross mark emoji to the provided context and appends
 * the error's message. The full error object is also passed to the logger for
 * stack traces.
 * @param {import("../interfaces/coreServices.js").ILogger} logger - Logger instance used to emit the message.
 * @param {string} context - Descriptive context for the log message.
 * @param {Error} err - The error to log alongside the message.
 * @returns {void}
 */
export function logError(logger, context, err) {
  logger.error(`❌ ${context}: ${err.message}`, err);
}

// --- FILE END ---
