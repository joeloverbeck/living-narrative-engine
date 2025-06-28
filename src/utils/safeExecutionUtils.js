/**
 * @module safeExecutionUtils
 * @description Helper for executing functions with error capture.
 */

/**
 * Executes a function and captures any thrown error.
 *
 * @param {() => any} fn - Function to execute.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger used for debug output.
 * @param {string} [context] - Context message for logging.
 * @returns {{success: boolean, result?: any, error?: any}} Execution result.
 */
export function safeCall(fn, logger, context = 'safeCall') {
  return safeExecute(fn, logger, context);
}

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
 * @returns
 *   | {success: true, result: any}
 *   | {success: false, error: any}
 *   | Promise<{success: true, result: any} | {success: false, error: any}>
 */
export function safeExecute(fn, logger, context = 'safeExecute') {
  try {
    const maybePromise = fn();
    if (maybePromise && typeof maybePromise.then === 'function') {
      return maybePromise
        .then((result) => ({ success: true, result }))
        .catch((error) => {
          if (logger && typeof logger.debug === 'function') {
            logger.debug(`${context}: operation failed`, error);
          }
          return { success: false, error };
        });
    }
    return { success: true, result: maybePromise };
  } catch (error) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(`${context}: operation failed`, error);
    }
    return { success: false, error };
  }
}
