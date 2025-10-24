// src/utils/serviceInitializerUtils.js

/**
 * @typedef {object} DependencySpec
 * @property {*} value - The dependency instance.
 * @property {string[]} [requiredMethods] - Methods expected on the dependency.
 * @property {boolean} [isFunction] - Whether the dependency should be a function.
 */

import { createPrefixedLogger, initLogger } from './loggerUtils.js';
import { validateDependencies } from './dependencyUtils.js';

// Import from dedicated types file - breaks circular dependency!
/** @typedef {import('../logic/types/executionTypes.js').ExecutionContext} ExecutionContext */

/**
 * @class ServiceSetup
 * @description Helper class for initializing services and handlers. Provides
 *   methods to create prefixed loggers, validate dependencies and resolve
 *   execution loggers.
 */
export class ServiceSetup {
  /**
   * Create a prefixed logger for a service or handler.
   *
   * @param {string} serviceName - Name used for log prefixing.
   * @param {import('../interfaces/coreServices.js').ILogger | undefined | null} logger
   *   - Logger instance to wrap.
   * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger instance.
   */
  createLogger(serviceName, logger) {
    const validatedLogger = initLogger(serviceName, logger);
    return createPrefixedLogger(validatedLogger, `${serviceName}: `);
  }

  /**
   * Validate a map of service dependencies.
   *
   * @param {string} serviceName - Name used in validation messages.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for validation output.
   * @param {Record<string, DependencySpec>} [deps] - Map of dependency specs.
   * @returns {void}
   */
  validateDeps(serviceName, logger, deps) {
    if (!deps) return;

    const checks = [];
    for (const depName of Object.keys(deps)) {
      const spec = deps[depName];
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
   * Initialize a prefixed logger and validate dependencies in one step.
   *
   * @param {string} serviceName - Name used for prefixing and validation.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   * @param {Record<string, DependencySpec>} [deps] - Dependency map for validation.
   * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
   */
  setupService(serviceName, logger, deps) {
    const prefixed = this.createLogger(serviceName, logger);
    this.validateDeps(serviceName, prefixed, deps);
    return prefixed;
  }

  /**
   * Resolve the logger to use for execution.
   *
   * @param {import('../interfaces/coreServices.js').ILogger} defaultLogger - Default logger.
   * @param {ExecutionContext} [executionContext] - Optional context.
   * @returns {import('../interfaces/coreServices.js').ILogger} Logger for execution.
   */
  resolveExecutionLogger(defaultLogger, executionContext) {
    return executionContext?.logger ?? defaultLogger;
  }
}

// -- Legacy function exports maintained for backwards compatibility -----------

const _defaultServiceSetup = new ServiceSetup();

/**
 * Create a prefixed logger for a service or handler.
 *
 * @param {string} serviceName - Name used for log prefixing.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Base logger.
 * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
 */
export function setupServiceLogger(serviceName, logger) {
  return _defaultServiceSetup.createLogger(serviceName, logger);
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
  _defaultServiceSetup.validateDeps(serviceName, logger, deps);
}

/**
 * Alias for {@link validateServiceDeps} kept for backward compatibility.
 *
 * @param {string} serviceName - Name used in validation messages.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {Record<string, DependencySpec>} deps - Dependency map.
 * @returns {void}
 */
export const validateServiceDependencies = validateServiceDeps;

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
  return _defaultServiceSetup.setupService(serviceName, logger, deps);
}

/**
 * Alias for {@link setupService} used by operation handlers.
 *
 * @param {string} handlerName - Handler name for logging.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {Record<string, DependencySpec>} [deps] - Optional dependencies.
 * @returns {import('../interfaces/coreServices.js').ILogger} Prefixed logger.
 */
export function initHandlerLogger(handlerName, logger, deps) {
  return _defaultServiceSetup.setupService(handlerName, logger, deps);
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
  return _defaultServiceSetup.setupService(serviceName, logger, deps);
}

/**
 * Resolve the logger to use for an execution context.
 *
 * @param {import('../interfaces/coreServices.js').ILogger} defaultLogger - The default logger.
 * @param {ExecutionContext} [executionContext] - Optional execution context.
 * @returns {import('../interfaces/coreServices.js').ILogger} Logger for execution.
 */
export function resolveExecutionLogger(defaultLogger, executionContext) {
  return _defaultServiceSetup.resolveExecutionLogger(
    defaultLogger,
    executionContext
  );
}

// --- FILE END ---
