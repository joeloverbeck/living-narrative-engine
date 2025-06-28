import { validateServiceDeps } from './serviceInitializerUtils.js';
import { setupPrefixedLogger } from './loggerUtils.js';

/**
 * @class BaseService
 * @description Base class providing helpers for logger initialization and
 * dependency validation.
 */
export class BaseService {
  /**
   * Initialize a prefixed logger and validate dependencies.
   *
   * @protected
   * @param {string} serviceName - Name used for log prefixing and error context.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   * @param {Record<string, import('./serviceInitializerUtils.js').DependencySpec>} [deps]
   *   - Map of dependency specifications to validate.
   * @returns {import('../interfaces/coreServices.js').ILogger} The initialized logger.
   */
  _init(serviceName, logger, deps) {
    const prefixed = setupPrefixedLogger(logger, `${serviceName}: `);
    this._validateDeps(serviceName, prefixed, deps);
    return prefixed;
  }

  /**
   * Validate injected dependencies.
   *
   * @protected
   * @param {string} serviceName - Service name for error messages.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for validation.
   * @param {Record<string, import('./serviceInitializerUtils.js').DependencySpec>} [deps]
   *   - Dependency map to validate.
   * @returns {void}
   */
  _validateDeps(serviceName, logger, deps) {
    validateServiceDeps(serviceName, logger, deps);
  }
}
