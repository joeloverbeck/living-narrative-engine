/**
 * @file Expression Evaluation Logger - Posts evaluation log entries to proxy server.
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

class ExpressionEvaluationLogger {
  #endpointConfig;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.endpointConfig
   * @param {ILogger} deps.logger
   */
  constructor({ endpointConfig, logger }) {
    validateDependency(endpointConfig, 'EndpointConfig', logger, {
      requiredMethods: ['getExpressionLogEndpoint'],
    });
    validateDependency(logger, 'logger');

    this.#endpointConfig = endpointConfig;
    this.#logger = logger;
  }

  /**
   * Post an expression evaluation log entry.
   *
   * @param {object} entry
   * @returns {Promise<boolean>} True when the request succeeds.
   */
  async logEvaluation(entry) {
    if (!entry) {
      this.#logger.debug(
        'ExpressionEvaluationLogger: Missing entry, skipping log request.'
      );
      return false;
    }

    const endpoint = this.#endpointConfig.getExpressionLogEndpoint();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry }),
      });

      if (!response.ok) {
        this.#logger.debug(
          `ExpressionEvaluationLogger: Log request failed with ${response.status}.`
        );
        return false;
      }

      return true;
    } catch (error) {
      this.#logger.debug('ExpressionEvaluationLogger: Log request failed.', error);
      return false;
    }
  }
}

export default ExpressionEvaluationLogger;
