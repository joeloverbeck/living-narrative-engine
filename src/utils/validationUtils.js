// src/utils/validationUtils.js
import { safeDispatchError } from './safeDispatchErrorUtils.js';
/**
 * Validates a dependency instance, checking for its existence and, optionally,
 * required methods or if it's expected to be a function.
 * Logs an error and throws if validation fails.
 *
 * @param {*} dependency - The dependency instance to validate.
 * @param {string} dependencyName - The name of the dependency (for logging and error messages).
 * @param {object} [logger] - A logger instance (conforming to ILogger: info, error, debug, warn methods). Defaults to console.
 * @param {object} [options] - Validation options.
 * @param {string[]} [options.requiredMethods] - An array of method names that must exist on the dependency.
 * @param {boolean} [options.isFunction] - Whether the dependency is expected to be a function.
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

  if (dependency === null || dependency === undefined) {
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
      const actualMethod = dependency[method]; // Get the method itself
      if (typeof actualMethod !== 'function') {
        const errorMsg = `Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
        effectiveLogger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }
}

/**
 * Validate a list of dependencies using {@link validateDependency}.
 *
 * @description Iterates over each spec and validates the dependency.
 * @param {Iterable<{dependency: *, name: string, methods?: string[], isFunction?: boolean}>} deps
 *   Iterable of dependency specs.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger used for validation errors.
 * @returns {void}
 */
export function validateDependencies(deps, logger) {
  if (!deps) return;

  for (const { dependency, name, methods = [], isFunction = false } of deps) {
    validateDependency(dependency, name, logger, {
      requiredMethods: methods,
      isFunction,
    });
  }
}

/**
 * @description Validates a set of loader dependencies using {@link validateDependency}.
 * The provided logger is validated first and then used for all subsequent checks.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger to record validation errors.
 * @param {Array<{dependency: *, name: string, methods: string[]}>} checks - Dependencies to validate.
 * @returns {void}
 * @throws {Error} If any dependency fails validation.
 */
export function validateLoaderDeps(logger, checks) {
  const deps = [
    {
      dependency: logger,
      name: 'ILogger',
      methods: ['info', 'warn', 'error', 'debug'],
    },
    ...(checks || []),
  ];

  validateDependencies(deps, logger);
}
