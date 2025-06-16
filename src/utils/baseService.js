// src/utils/baseService.js

import { setupService } from './serviceInitializerUtils.js';

/**
 * @class BaseService
 * @description Provides a protected helper for initializing service loggers
 * and validating dependencies using {@link setupService}.
 */
export class BaseService {
  /**
   * Initialize the service's logger and validate dependencies.
   *
   * @protected
   * @param {string} serviceName - Name used for log prefixing and validation messages.
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   * @param {Record<string, import('./serviceInitializerUtils.js').DependencySpec>} [deps]
   *   - Map of dependency specifications to validate.
   * @returns {import('../interfaces/coreServices.js').ILogger} The initialized logger.
   */
  _init(serviceName, logger, deps) {
    return setupService(serviceName, logger, deps);
  }
}

export default BaseService;
