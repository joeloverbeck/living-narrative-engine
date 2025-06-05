// src/utils/validationUtils.js
/**
 * Validates a dependency instance, checking for its existence and, optionally,
 * required methods or if it's expected to be a function.
 * Logs an error and throws if validation fails.
 *
 * @param {*} dependency - The dependency instance to validate.
 * @param {string} dependencyName - The name of the dependency (for logging and error messages).
 * @param {object} [logger=console] - A logger instance (conforming to ILogger: info, error, debug, warn methods). Defaults to console.
 * @param {object} [options={}] - Validation options.
 * @param {string[]} [options.requiredMethods=[]] - An array of method names that must exist on the dependency.
 * @param {boolean} [options.isFunction=false] - Whether the dependency is expected to be a function.
 * @throws {Error} If the dependency is missing or does not meet validation criteria.
 */
export function validateDependency(
  dependency,
  dependencyName,
  logger = console,
  { requiredMethods = [], isFunction = false } = {}
) {
  // Determine the effective logger. If the provided logger is invalid or is the dependency
  // itself and found to be problematic, fall back to the global console.
  // This check ensures that if 'logger' is the dependency being validated and is, for example, null,
  // 'console.error' will be used for the error message.
  const effectiveLogger =
    logger && typeof logger.error === 'function' ? logger : console;

  if (dependency == null) {
    // Checks for both null and undefined
    const errorMsg = `Missing required dependency: ${dependencyName}.`;
    // If the logger being validated is the one that's missing,
    // effectiveLogger will have already defaulted to console.
    effectiveLogger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (isFunction && typeof dependency !== 'function') {
    const errorMsg = `Dependency '${dependencyName}' must be a function, but got ${typeof dependency}.`;
    effectiveLogger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (requiredMethods && requiredMethods.length > 0) {
    for (const method of requiredMethods) {
      if (
        dependency[method] == null ||
        typeof dependency[method] !== 'function'
      ) {
        // Check for null/undefined or not a function
        const errorMsg = `Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
        effectiveLogger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }
}
