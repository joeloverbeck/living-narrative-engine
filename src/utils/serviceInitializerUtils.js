// src/utils/serviceInitializerUtils.js

/**
 * @typedef {object} DependencySpec
 * @property {*} value - The dependency instance.
 * @property {string[]} [requiredMethods] - Methods expected on the dependency.
 * @property {boolean} [isFunction] - Whether the dependency should be a function.
 */

import {
  createPrefixedLogger,
  initLogger as baseInitLogger,
} from './loggerUtils.js';
import { validateDependency } from './validationUtils.js';

/**
 * Validates the provided logger and returns a prefixed logger instance.
 *
 * @param {string} serviceName - Name used for log prefix and error messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger to validate.
 * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
 */
export function initLogger(serviceName, logger) {
  const validated = baseInitLogger(serviceName, logger);
  return createPrefixedLogger(validated, `${serviceName}: `);
}

/**
 * Validates a set of service dependencies using `validateDependency`.
 *
 * @param {string} serviceName - Name used in validation error messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for validation errors.
 * @param {Record<string, DependencySpec>} deps - Dependency map.
 * @returns {void}
 */
export function validateServiceDeps(serviceName, logger, deps) {
  if (!deps) return;
  for (const [depName, spec] of Object.entries(deps)) {
    if (!spec) continue;
    validateDependency(spec.value, `${serviceName}: ${depName}`, logger, {
      requiredMethods: spec.requiredMethods,
      isFunction: spec.isFunction,
    });
  }
}

/**
 * @description Convenience helper that initializes a service logger and
 * validates its dependencies in one step.
 * @param {string} serviceName - The service name used for logger prefixing and
 *   validation messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger to
 *   validate and wrap.
 * @param {Record<string, DependencySpec>} [deps] - Optional dependency map for
 *   validation via {@link validateServiceDeps}.
 * @returns {import('../interfaces/coreServices.js').ILogger} The initialized and
 *   prefixed logger instance.
 */
export function setupService(serviceName, logger, deps) {
  const prefixedLogger = initLogger(serviceName, logger);
  validateServiceDeps(serviceName, prefixedLogger, deps);
  return prefixedLogger;
}

// --- FILE END ---
