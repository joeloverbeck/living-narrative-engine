// src/utils/serviceInitializer.js

/**
 * @typedef {object} DependencySpec
 * @property {*} value - The dependency instance.
 * @property {string[]} [requiredMethods] - Methods expected on the dependency.
 * @property {boolean} [isFunction] - Whether the dependency should be a function.
 */

import { validateDependency } from './validationUtils.js';
import { createPrefixedLogger } from './loggerUtils.js';

/**
 * Validates the provided logger and returns a prefixed logger instance.
 *
 * @param {string} serviceName - Name used for log prefix and error messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger to validate.
 * @param {string[]} [loggerMethods] - Required logging methods.
 * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
 */
export function initLogger(
  serviceName,
  logger,
  loggerMethods = ['debug', 'error', 'warn', 'info']
) {
  validateDependency(logger, `${serviceName}: logger`, console, {
    requiredMethods: loggerMethods,
  });
  return createPrefixedLogger(logger, `${serviceName}: `);
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

// --- FILE END ---
