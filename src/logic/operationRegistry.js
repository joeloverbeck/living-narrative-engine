// src/logic/operationRegistry.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('./defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */ // Optional: If injecting logger

/**
 * @class OperationRegistry
 * Manages the mapping between operation type strings (e.g., "LOG", "MODIFY_COMPONENT")
 * and their corresponding handler function implementations (`OperationHandler`).
 * This allows the system (specifically the OperationInterpreter) to dynamically find
 * and execute the correct logic for any given operation defined in game data.
 *
 * Example Usage:
 * const registry = new OperationRegistry();
 * registry.register('LOG', logOperationHandler);
 * // ... later ...
 * const handler = registry.getHandler('LOG');
 * if (handler) {
 * handler(operation.parameters, executionContext);
 * }
 */
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
  #logger; // Optional: Inject logger if detailed warnings are needed

  /**
     * Creates an instance of OperationRegistry.
     * @param {object} [dependencies] - Optional dependencies.
     * @param {ILogger} [dependencies.logger] - Optional logger for warnings.
     */
  constructor({ logger } = {}) {
    this.#registry = new Map();
    this.#logger = logger ?? null; // Store logger if provided
    // Use the internal log method to handle potential logger errors during init
    this.#log('info', 'OperationRegistry initialized.');
  }

  /**
     * Registers an OperationHandler for a specific operation type.
     * Logs a warning if a handler for the given type is already registered,
     * overwriting the previous one.
     *
     * @param {string} operationType - The unique string identifier for the operation type (e.g., "MODIFY_COMPONENT"). Must be non-empty.
     * @param {OperationHandler} handler - The function that implements the logic for this operation type.
     * @returns {void}
     * @throws {Error} if operationType is not a non-empty string.
     * @throws {Error} if handler is not a function.
     */
  register(operationType, handler) {
    if (typeof operationType !== 'string' || !operationType.trim()) {
      const errorMsg = 'OperationRegistry.register: operationType must be a non-empty string.';
      // Log before throwing to ensure message is captured even if error is caught elsewhere
      this.#log('error', errorMsg);
      throw new Error(errorMsg);
    }
    if (typeof handler !== 'function') {
      // Include operationType in the error message for better context
      const errorMsg = `OperationRegistry.register: handler for type "${operationType}" must be a function.`;
      this.#log('error', errorMsg);
      throw new Error(errorMsg);
    }

    // Trim the type for consistent storage and lookup
    const trimmedType = operationType.trim();

    if (this.#registry.has(trimmedType)) {
      this.#log('warn', `OperationRegistry: Overwriting existing handler for operation type "${trimmedType}".`);
    }

    this.#registry.set(trimmedType, handler);
    this.#log('debug', `OperationRegistry: Registered handler for operation type "${trimmedType}".`);
  }

  /**
     * Retrieves the OperationHandler associated with the given operation type.
     *
     * @param {string} operationType - The string identifier of the operation type to retrieve the handler for.
     * @returns {OperationHandler | undefined} The registered handler function, or undefined if no handler is registered for the type.
     */
  getHandler(operationType) {
    if (typeof operationType !== 'string') {
      this.#log('warn', `OperationRegistry.getHandler: Received non-string operationType: ${typeof operationType}. Returning undefined.`);
      return undefined;
    }

    // *** FIX: Trim the operationType before lookup to match registration behavior ***
    const trimmedType = operationType.trim();

    const handler = this.#registry.get(trimmedType);
    if (!handler) {
      // Log the trimmed type for which the handler wasn't found
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
    // Determine the primary log function (logger method or console method)
    // Fallback to console.log if the specific level (like debug) doesn't exist on console
    const logFunc = this.#logger?.[level] ?? console[level] ?? console.log;

    try {
      // Attempt to log using the determined function
      logFunc(message, ...args);
    } catch (logError) {
      // --- Fallback Log ---
      // If the primary log function itself throws an error (e.g., faulty logger),
      // log the original message AND the error to the console.
      // Use console.error for the error message itself for higher visibility.
      console.error(`Error occurred in logging utility while trying to log message: "${message}"`, logError);

      // Still attempt to log the original message using a safe fallback (console.log)
      // Prepend the level to the message for context.
      try {
        console.log(`[${level.toUpperCase()}] ${message}`, ...args);
      } catch (fallbackError) {
        // If even the final fallback fails, there's not much more we can do.
        console.error('Critical logging failure: Even fallback console.log failed.', fallbackError);
      }
    }
  }
}

export default OperationRegistry;