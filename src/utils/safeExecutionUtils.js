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
  try {
    return { success: true, result: fn() };
  } catch (error) {
    if (logger && typeof logger.debug === 'function') {
      logger.debug(`${context}: operation failed`, error);
    }
    return { success: false, error };
  }
}
