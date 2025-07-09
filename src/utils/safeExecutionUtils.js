/**
 * @module safeExecutionUtils
 * @description Helper for executing functions with error capture.
 */

/**
 * Result object returned by {@link safeExecute}.
 *
 * @typedef {object} ExecutionResult
 * @property {boolean} success Indicates whether the operation succeeded.
 * @property {any} [result] Result value when successful.
 * @property {any} [error] Error value when unsuccessful.
 */

/**
 * Safely executes a synchronous or asynchronous function.
 *
 * @description
 * Provides a common wrapper around try/catch logic and normalizes the
 * return shape for both sync and async callbacks. If the executed function
 * returns a Promise, the result is also wrapped in a Promise.
 * @param {() => any | Promise<any>} fn - Function to execute.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger used for debug output.
 * @param {string} [context] - Context message for logging.
 * @returns {ExecutionResult | Promise<ExecutionResult>} Normalized result object.
 */
export function safeExecute(fn, logger, context = 'safeExecute') {
  try {
    const maybePromise = fn();
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise
        .then(
          /**
           * @param {any} result
           * @returns {ExecutionResult}
           */
          (result) => ({ success: true, result })
        )
        .catch(
          /**
           * @param {any} error
           * @returns {ExecutionResult}
           */
          (error) => {
            if (logger && typeof logger.debug === 'function') {
              logger.debug(`${context}: operation failed`, error);
            }
            return { success: false, error };
          }
        );
    }
    return { success: true, result: maybePromise };
  } catch (error) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(`${context}: operation failed`, error);
    }
    return { success: false, error };
  }
}
