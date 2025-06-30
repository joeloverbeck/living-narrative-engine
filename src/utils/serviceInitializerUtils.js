// src/utils/serviceInitializerUtils.js

/**
 * @typedef {object} DependencySpec
 * @property {*} value - The dependency instance.
 * @property {string[]} [requiredMethods] - Methods expected on the dependency.
 * @property {boolean} [isFunction] - Whether the dependency should be a function.
 */

import { setupPrefixedLogger } from './loggerUtils.js';
import { validateDependencies } from './dependencyUtils.js';

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

  const checks = [];

  for (const [depName, spec] of Object.entries(deps)) {
    if (!spec) continue;
    checks.push({
      dependency: spec.value,
      name: `${serviceName}: ${depName}`,
      methods: spec.requiredMethods,
      isFunction: spec.isFunction,
    });
  }

  validateDependencies(checks, logger);
}

/**
 * Initialize a service logger and validate dependencies.
 *
 * @description Convenience helper that initializes a service logger via
 *   {@link setupPrefixedLogger} and validates its dependencies in one step.
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
  const prefixedLogger = setupPrefixedLogger(logger, `${serviceName}: `);
  validateServiceDeps(serviceName, prefixedLogger, deps);
  return prefixedLogger;
}

/**
 * Initialize and return a service logger.
 *
 * @description Thin wrapper around {@link setupService} for shared
 *   initialization logic across services and handlers.
 * @param {string} serviceName - Name used for log prefixing.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Base logger.
 * @param {Record<string, DependencySpec>} [deps] - Optional dependencies.
 * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
 */
export function initializeServiceLogger(serviceName, logger, deps) {
  return setupService(serviceName, logger, deps);
}

// --- FILE END ---
