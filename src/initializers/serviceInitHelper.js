// src/initializers/serviceInitHelper.js

/**
 * @module ServiceInitHelper
 * @description Helper functions for initializing services and handlers.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../utils/serviceInitializerUtils.js').DependencySpec} DependencySpec */

import { setupPrefixedLogger } from '../utils/loggerUtils.js';
import { validateDependencies } from '../utils/dependencyUtils.js';

/**
 * Create a prefixed logger for a service or handler.
 *
 * @param {string} serviceName - Name used for log prefixing.
 * @param {ILogger | undefined | null} logger - Base logger instance.
 * @returns {ILogger} Prefixed logger instance.
 */
export function setupServiceLogger(serviceName, logger) {
  return setupPrefixedLogger(logger, `${serviceName}: `);
}

/**
 * Validate a map of service dependencies.
 *
 * @param {string} serviceName - Name used in validation messages.
 * @param {ILogger} logger - Logger for validation output.
 * @param {Record<string, DependencySpec>} [dependencyMap] - Dependency spec map.
 * @returns {void}
 */
export function validateServiceDependencies(
  serviceName,
  logger,
  dependencyMap
) {
  if (!dependencyMap) return;

  const checks = [];
  for (const [depName, spec] of Object.entries(dependencyMap)) {
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

export default {
  setupServiceLogger,
  validateServiceDependencies,
};
