/**
 * @file Enhanced event validation service with multi-target support
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import MultiTargetEventValidator from './multiTargetEventValidator.js';

/**
 * Service for validating events with schema and business rule validation
 */
export class EventValidationService {
  #logger;
  #schemaValidator;
  #multiTargetValidator;

  constructor({ logger, schemaValidator }) {
    this.#logger = ensureValidLogger(logger);
    validateDependency(schemaValidator, 'ISchemaValidator');

    this.#schemaValidator = schemaValidator;
    this.#multiTargetValidator = new MultiTargetEventValidator({ logger });
  }

  /**
   * Validates an event with comprehensive checks
   *
   * @param {object} event - Event to validate
   * @param {string} schemaId - Schema ID for validation
   * @returns {object} Complete validation result
   */
  async validateEvent(event, schemaId = 'core:attempt_action') {
    try {
      // Step 1: Schema validation
      const schemaResult = this.#schemaValidator.validate(schemaId, event);

      // If schema validation fails, return early
      if (!schemaResult.isValid) {
        return {
          isValid: false,
          errors: schemaResult.errors || [],
          warnings: [],
          source: 'schema',
          details: {},
        };
      }

      // Step 2: Multi-target business rule validation
      const businessResult = this.#multiTargetValidator.validateEvent(event);

      // Combine results
      return {
        isValid: businessResult.isValid,
        errors: [...(schemaResult.errors || []), ...businessResult.errors],
        warnings: [
          ...(schemaResult.warnings || []),
          ...businessResult.warnings,
        ],
        source: businessResult.isValid ? 'complete' : 'business_rules',
        details: businessResult.details,
      };
    } catch (error) {
      this.#logger.error('Event validation failed', error);

      return {
        isValid: false,
        errors: [`Validation service error: ${error.message}`],
        warnings: [],
        source: 'service',
        details: {},
      };
    }
  }

  /**
   * Validates multiple events in batch
   *
   * @param {Array} events - Events to validate
   * @param {string} schemaId - Schema ID for validation
   * @returns {Array} Validation results for each event
   */
  async validateEvents(events, schemaId = 'core:attempt_action') {
    const results = [];

    for (let i = 0; i < events.length; i++) {
      try {
        const result = await this.validateEvent(events[i], schemaId);
        results.push({
          index: i,
          event: events[i],
          ...result,
        });
      } catch (error) {
        this.#logger.error(`Failed to validate event at index ${i}`, error);
        results.push({
          index: i,
          event: events[i],
          isValid: false,
          errors: [`Validation error: ${error.message}`],
          warnings: [],
          source: 'batch_error',
          details: {},
        });
      }
    }

    return results;
  }

  /**
   * Gets validation performance metrics
   *
   * @returns {object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      multiTarget: this.#multiTargetValidator.getPerformanceMetrics(),
    };
  }

  /**
   * Resets validation performance metrics
   */
  resetPerformanceMetrics() {
    this.#multiTargetValidator.resetPerformanceMetrics();
  }
}

export default EventValidationService;
