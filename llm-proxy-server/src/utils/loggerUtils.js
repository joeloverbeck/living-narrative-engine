// llm-proxy-server/src/utils/loggerUtils.js
/* eslint-disable no-console */
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

/**
 * Masks an API key for safe logging based on the environment.
 * In production: returns '[MASKED]'
 * In development: shows first character + asterisks
 * @param {string | null | undefined} apiKey - The API key to mask.
 * @returns {string} The masked API key.
 */
export function maskApiKey(apiKey) {
  if (apiKey === null) return '[NULL]';
  if (apiKey === undefined) return '[UNDEFINED]';
  if (apiKey === '') return '[EMPTY]';

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    return '[MASKED]';
  }

  // Development mode: show first 4 characters + asterisks for better debugging
  if (apiKey.length <= 1) {
    return '*'.repeat(apiKey.length);
  }

  if (apiKey.length <= 4) {
    const firstChar = apiKey.charAt(0);
    const asterisks = '*'.repeat(apiKey.length - 1);
    return firstChar + asterisks;
  }

  const visibleChars = apiKey.substring(0, 4);
  const asterisks = '*'.repeat(apiKey.length - 4);
  return visibleChars + asterisks;
}

/**
 * Deep clones an object and masks sensitive fields.
 * @private
 * @param {any} obj - The object to sanitize.
 * @returns {any} The sanitized object.
 */
function sanitizeLogContext(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeLogContext);
  }

  const sanitized = {};
  const sensitiveFields = [
    'apiKey',
    'apikey',
    'api_key',
    'authorization',
    'password',
    'secret',
    'token',
  ];

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (sensitiveFields.includes(keyLower)) {
      sanitized[key] = maskApiKey(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogContext(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates a secure logger wrapper that masks sensitive information.
 * @param {ILogger} logger - The underlying logger instance.
 * @returns {ILogger} A logger that automatically masks sensitive data.
 */
export function createSecureLogger(logger) {
  return {
    debug: (message, context) => {
      logger.debug(message, context ? sanitizeLogContext(context) : context);
    },
    info: (message, context) => {
      logger.info(message, context ? sanitizeLogContext(context) : context);
    },
    warn: (message, context) => {
      logger.warn(message, context ? sanitizeLogContext(context) : context);
    },
    error: (message, context) => {
      logger.error(message, context ? sanitizeLogContext(context) : context);
    },
  };
}
