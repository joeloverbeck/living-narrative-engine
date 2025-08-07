/**
 * @file Migration helper for ActionDiscoveryService tracing enhancement
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Helper to validate ActionDiscoveryService action tracing setup
 */
class ActionDiscoveryServiceTracingValidator {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(
      logger,
      'ActionDiscoveryServiceTracingValidator'
    );
  }

  /**
   * Validate that action tracing is properly configured
   *
   * @param {import('../actionDiscoveryService.js').ActionDiscoveryService} discoveryService - Service to validate
   * @returns {object} Validation results
   */
  validateConfiguration(discoveryService) {
    const status = discoveryService.getActionTracingStatus();
    const issues = [];
    const warnings = [];

    // Check availability
    if (!status.available) {
      if (!status.hasFilter) {
        issues.push('ActionTraceFilter is not registered or available');
      }
      if (!status.hasFactory) {
        issues.push(
          'ActionAwareTraceContextFactory is not registered or available'
        );
      }

      warnings.push(
        'Action tracing will not be available for ActionDiscoveryService'
      );
    }

    // Check enabled state
    if (status.available && !status.enabled) {
      warnings.push(
        'Action tracing is available but disabled in configuration'
      );
    }

    const result = {
      valid: issues.length === 0,
      available: status.available,
      enabled: status.enabled,
      issues,
      warnings,
    };

    this.#logValidationResults(result);
    return result;
  }

  #logValidationResults(result) {
    if (result.valid) {
      this.#logger.info(
        'ActionDiscoveryService action tracing validation passed',
        {
          available: result.available,
          enabled: result.enabled,
          warningCount: result.warnings.length,
        }
      );
    } else {
      this.#logger.error(
        'ActionDiscoveryService action tracing validation failed',
        {
          issues: result.issues,
          warnings: result.warnings,
        }
      );
    }

    // Log warnings
    result.warnings.forEach((warning) => {
      this.#logger.warn(`ActionDiscoveryService tracing: ${warning}`);
    });
  }
}

export default ActionDiscoveryServiceTracingValidator;
