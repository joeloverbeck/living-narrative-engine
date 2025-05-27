// src/logic/operationRegistry.js
// --- FILE START ---

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('./defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

class OperationRegistry {
  /**
   * Internal storage for mapping operation type strings to operationHandlers.
   * @private
   * @readonly
   * @type {Map<string, OperationHandler>}
   */
  #registry;

  /**
   * Optional logger instance for internal messages (like registration warnings).
   * @private
   * @type {ILogger | null}
   */
  #logger;

  /**
   * Creates an instance of OperationRegistry.
   * @param {object} [dependencies] - Optional dependencies.
   * @param {ILogger} [dependencies.logger] - Optional logger for warnings.
   */
  constructor({ logger } = {}) {
    this.#registry = new Map();
    this.#logger = logger ?? null;
    this.#log('info', 'OperationRegistry initialized.');
  }

  register(operationType, handler) {
    if (typeof operationType !== 'string' || !operationType.trim()) {
      const errorMsg = 'OperationRegistry.register: operationType must be a non-empty string.';
      this.#log('error', errorMsg);
      throw new Error(errorMsg);
    }
    if (typeof handler !== 'function') {
      const errorMsg = `OperationRegistry.register: handler for type "${operationType}" must be a function.`;
      this.#log('error', errorMsg);
      throw new Error(errorMsg);
    }

    const trimmedType = operationType.trim();

    if (this.#registry.has(trimmedType)) {
      this.#log('warn', `OperationRegistry: Overwriting existing handler for operation type "${trimmedType}".`);
    }

    this.#registry.set(trimmedType, handler);
    this.#log('debug', `OperationRegistry: Registered handler for operation type "${trimmedType}".`);
  }

  getHandler(operationType) {
    if (typeof operationType !== 'string') {
      this.#log('warn', `OperationRegistry.getHandler: Received non-string operationType: ${typeof operationType}. Returning undefined.`);
      return undefined;
    }
    const trimmedType = operationType.trim();
    const handler = this.#registry.get(trimmedType);
    if (!handler) {
      this.#log('debug', `OperationRegistry: No handler found for operation type "${trimmedType}".`);
    }
    return handler;
  }

  /**
   * Internal logging helper that uses the injected logger or falls back to console.
   * Also handles errors thrown by the logger itself.
   * @private
   * @param {'info' | 'warn' | 'error' | 'debug'} level - Log level.
   * @param {string} message - The log message.
   * @param {any[]} [args] - Additional arguments to log.
   */
  #log(level, message, ...args) {
    try {
      // Check if the logger exists and the specific log method exists
      if (this.#logger && typeof this.#logger[level] === 'function') {
        // Call the method directly on the logger instance to preserve 'this' context
        this.#logger[level](message, ...args);
      } else if (console[level] && typeof console[level] === 'function') {
        // Fallback to console's method if logger or its method is unavailable
        console[level](message, ...args);
      } else {
        // Absolute fallback if the specific console method (e.g., console.debug) doesn't exist
        console.log(`[${level.toUpperCase()}] ${message}`, ...args);
      }
    } catch (logError) {
      // --- Fallback Log (if the chosen logger/console method itself threw an error) ---
      console.error(`Error occurred in logging utility (faulty logger method for level '${level}') trying to log message: "${message}"`, logError);

      // Attempt to log the original message using a very safe fallback
      try {
        // MODIFIED LINE: Removed "[FALLBACK - ...]" prefix
        console.log(`[${level.toUpperCase()}] ${message}`, ...args);
      } catch (fallbackError) {
        console.error('CRITICAL LOGGING FAILURE: Even the final console.log fallback failed.', fallbackError);
      }
    }
  }
}

export default OperationRegistry;
// --- FILE END ---