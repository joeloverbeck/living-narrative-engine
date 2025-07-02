import { initializeServiceLogger } from './serviceInitializerUtils.js';

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
    return initializeServiceLogger(serviceName, logger, deps);
  }
}
