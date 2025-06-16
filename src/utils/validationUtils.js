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
      if (
        dependency[method] === null ||
        dependency[method] === undefined ||
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

/**
 * @description Validates a set of loader dependencies using {@link validateDependency}.
 * The provided logger is validated first and then used for all subsequent checks.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger to record validation errors.
 * @param {Array<{dependency: *, name: string, methods: string[]}>} checks - Dependencies to validate.
 * @returns {void}
 * @throws {Error} If any dependency fails validation.
 */
export function validateLoaderDeps(logger, checks) {
  validateDependency(logger, 'ILogger', console, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });

  for (const { dependency, name, methods = [] } of checks) {
    validateDependency(dependency, name, logger, { requiredMethods: methods });
  }
}

/**
 * Validates that a chosen action index is an integer within the
 * bounds of the available actions.
 *
 * @param {number} chosenIndex
 * @param {number} actionsLength
 * @param {string} providerName
 * @param {string} actorId
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
 * @param {import('../interfaces/coreServices.js').ILogger} logger
 * @param {object} [debugData]
 * @throws {Error} If the index is invalid or out of range.
 */
export function assertValidActionIndex(
  chosenIndex,
  actionsLength,
  providerName,
  actorId,
  dispatcher,
  logger,
  debugData = {}
) {
  if (!Number.isInteger(chosenIndex)) {
    safeDispatchError(
      dispatcher,
      `${providerName}: Did not receive a valid integer 'chosenIndex' for actor ${actorId}.`,
      debugData
    );
    throw new Error('Could not resolve the chosen action to a valid index.');
  }

  if (chosenIndex < 1 || chosenIndex > actionsLength) {
    safeDispatchError(
      dispatcher,
      `${providerName}: invalid chosenIndex (${chosenIndex}) for actor ${actorId}.`,
      { ...debugData, actionsCount: actionsLength }
    );
    throw new Error('Player chose an index that does not exist for this turn.');
  }
}
