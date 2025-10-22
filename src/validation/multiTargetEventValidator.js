/**
 * @file Multi-target event validation with enhanced business rules
 */

import {
  assertPresent,
  assertNonBlankString,
} from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * Validates multi-target events with business rules and consistency checks
 */
export class MultiTargetEventValidator {
  #logger;
  #performanceMetrics;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#performanceMetrics = {
      validationCount: 0,
      totalTime: 0,
      errorCount: 0,
    };
  }

  /**
   * Validates a multi-target event with comprehensive checks
   *
   * @param {object} event - Event payload to validate
   * @returns {object} Validation result with errors and warnings
   */
  validateEvent(event) {
    const startTime = performance.now();

    try {
      assertPresent(event, 'Event payload is required');

      const result = this.#performValidation(event);

      this.#updateMetrics(startTime, result.errors.length > 0);

      return result;
    } catch (error) {
      this.#logger.error('Multi-target validation failed', error);
      this.#updateMetrics(startTime, true);

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        details: {},
      };
    }
  }

  /**
   * Performs comprehensive validation checks
   *
   * @param {object} event - Event to validate
   * @returns {object} Validation result
   */
  #performValidation(event) {
    const errors = [];
    const warnings = [];
    const details = {
      hasMultipleTargets: false,
      targetCount: 0,
      primaryTarget: null,
      consistencyIssues: [],
    };

    // Basic structure validation
    this.#validateBasicStructure(event, errors);

    // Multi-target specific validation
    if (event.targets && typeof event.targets === 'object') {
      this.#validateTargetsObject(event, errors, warnings, details);
      this.#validateTargetConsistency(event, warnings, details);
    }

    // Legacy compatibility validation
    this.#validateLegacyCompatibility(event, errors, warnings);

    // Business rule validation
    this.#validateBusinessRules(event, errors, warnings, details);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details,
    };
  }

  /**
   * Validates basic event structure
   *
   * @param {object} event - Event to validate
   * @param {Array} errors - Error collection
   */
  #validateBasicStructure(event, errors) {
    // These should be caught by schema validation, but double-check
    if (!event.eventName || event.eventName !== 'core:attempt_action') {
      errors.push('Invalid event name - must be "core:attempt_action"');
    }

    if (
      !event.actorId ||
      typeof event.actorId !== 'string' ||
      !event.actorId.trim()
    ) {
      errors.push('actorId must be a non-empty string');
    }

    if (
      !event.actionId ||
      typeof event.actionId !== 'string' ||
      !event.actionId.trim()
    ) {
      errors.push('actionId must be a non-empty string');
    }

    if (
      !event.originalInput ||
      typeof event.originalInput !== 'string' ||
      !event.originalInput.trim()
    ) {
      errors.push('originalInput must be a non-empty string');
    }

    // Must have either targets or targetId (targetId can be null for targetless actions)
    if (!event.targets && event.targetId === undefined) {
      errors.push('Event must have either targets object or targetId field');
    }
  }

  /**
   * Validates targets object structure and content
   *
   * @param {object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   * @param {object} details - Validation details
   */
  #validateTargetsObject(event, errors, warnings, details) {
    const targets = event.targets;

    // Check if targets object is empty
    const targetKeys = Object.keys(targets);
    if (targetKeys.length === 0) {
      errors.push('targets object cannot be empty');
      return;
    }

    details.targetCount = targetKeys.length;
    details.hasMultipleTargets = targetKeys.length > 1;

    // Validate each target
    for (const [key, targetId] of Object.entries(targets)) {
      if (!this.#isValidTargetKey(key)) {
        warnings.push(
          `Target key "${key}" should follow naming conventions (alphanumeric with underscores)`
        );
      }

      if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
        errors.push(`Target "${key}" must have a non-empty string value`);
        continue;
      }

      if (!this.#isValidEntityId(targetId)) {
        warnings.push(
          `Target "${key}" ID "${targetId}" should follow entity ID format (letters, numbers, underscore, colon)`
        );
      }
    }

    // Determine primary target
    details.primaryTarget = this.#determinePrimaryTarget(targets);
  }

  /**
   * Validates consistency between targets object and targetId
   *
   * @param {object} event - Event to validate
   * @param {Array} warnings - Warning collection
   * @param {object} details - Validation details
   */
  #validateTargetConsistency(event, warnings, details) {
    if (!event.targets || !event.targetId) {
      return;
    }

    const targets = event.targets;
    const targetId = event.targetId;

    // Check if targetId matches any target in targets object
    const targetValues = Object.values(targets);
    if (!targetValues.includes(targetId)) {
      warnings.push(
        `targetId "${targetId}" does not match any target in targets object`
      );
      details.consistencyIssues.push('targetId_mismatch');
    }

    // Check if targetId matches expected primary target
    const expectedPrimary = details.primaryTarget;
    if (expectedPrimary && targetId !== expectedPrimary) {
      warnings.push(
        `targetId "${targetId}" does not match expected primary target "${expectedPrimary}"`
      );
      details.consistencyIssues.push('primary_target_mismatch');
    }

    // Check for duplicate targets
    const uniqueTargets = new Set(targetValues);
    if (uniqueTargets.size !== targetValues.length) {
      warnings.push('targets object contains duplicate target IDs');
      details.consistencyIssues.push('duplicate_targets');
    }
  }

  /**
   * Validates legacy compatibility requirements
   *
   * @param {object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   */
  #validateLegacyCompatibility(event, errors, warnings) {
    // If using targets object, must also have targetId for backward compatibility
    if (
      event.targets &&
      Object.keys(event.targets).length > 0 &&
      !event.targetId
    ) {
      errors.push(
        'targetId is required for backward compatibility when targets object is present'
      );
    }

    // Legacy events should work unchanged
    if (event.targetId !== undefined && !event.targets) {
      // This is a legacy event - ensure it's properly structured
      // Null targetId is allowed for actions without targets (like emotes)
      if (event.targetId !== null && typeof event.targetId !== 'string') {
        errors.push('Legacy targetId must be a string or null');
      }
    }
  }

  /**
   * Validates business rules for multi-target events
   *
   * @param {object} event - Event to validate
   * @param {Array} errors - Error collection
   * @param {Array} warnings - Warning collection
   * @param {object} details - Validation details
   */
  #validateBusinessRules(event, errors, warnings, details) {
    // Check for reasonable target limits
    if (details.targetCount > 10) {
      warnings.push(
        `Event has ${details.targetCount} targets - consider if this is necessary for performance`
      );
    }

    // Validate common target naming patterns
    if (event.targets) {
      this.#validateTargetNamingPatterns(event.targets, warnings);
    }

    // Check for potential target relationship issues
    if (
      event.actorId &&
      details.primaryTarget &&
      event.actorId === details.primaryTarget
    ) {
      warnings.push(
        'Actor and primary target are the same entity - verify this is intentional'
      );
    }

    // Validate action-target compatibility (if we have action definitions available)
    this.#validateActionTargetCompatibility(event, warnings);
  }

  /**
   * Validates target naming patterns and conventions
   *
   * @param {object} targets - Targets object
   * @param {Array} warnings - Warning collection
   */
  #validateTargetNamingPatterns(targets, warnings) {
    const commonPatterns = {
      primary: 'Primary target',
      secondary: 'Secondary target',
      item: 'Item being used',
      target: 'Target of action',
      recipient: 'Recipient of action',
      location: 'Location reference',
      tool: 'Tool being used',
      container: 'Container reference',
    };

    const targetKeys = Object.keys(targets);

    // Check for good naming patterns
    const hasDescriptiveNames = targetKeys.some(
      (key) => key.length > 2 && !key.match(/^(t1|t2|t3|obj|tgt)$/i)
    );

    if (!hasDescriptiveNames && targetKeys.length > 1) {
      warnings.push(
        'Consider using descriptive target names (e.g., "item", "recipient") instead of generic names'
      );
    }

    // Check for conflicting primary/target patterns
    if (
      targets.primary &&
      targets.target &&
      targets.primary === targets.target
    ) {
      warnings.push(
        'primary and target refer to the same entity - consider using just one'
      );
    }
  }

  /**
   * Validates action-target compatibility
   *
   * @param {object} event - Event to validate
   * @param {Array} warnings - Warning collection
   */
  #validateActionTargetCompatibility(event, warnings) {
    // This is a placeholder for future action-specific validation
    // When action definitions are available, we can validate:
    // - Required target types for specific actions
    // - Valid target combinations
    // - Action-specific target naming conventions

    this.#logger.debug(
      'Action-target compatibility validation not yet implemented',
      {
        actionId: event.actionId,
        targetCount: event.targets ? Object.keys(event.targets).length : 0,
      }
    );
  }

  /**
   * Determines the primary target from targets object
   *
   * @param {object} targets - Targets object
   * @returns {string|null} Primary target ID
   */
  #determinePrimaryTarget(targets) {
    // Prefer explicit 'primary' key
    if (targets.primary) {
      return targets.primary;
    }

    // Common primary target key patterns
    const primaryPatterns = ['target', 'recipient', 'item', 'person'];
    for (const pattern of primaryPatterns) {
      if (targets[pattern]) {
        return targets[pattern];
      }
    }

    // Fallback to first target
    const firstKey = Object.keys(targets)[0];
    return firstKey ? targets[firstKey] : null;
  }

  /**
   * Validates target key naming conventions
   *
   * @param {string} key - Target key to validate
   * @returns {boolean} True if key follows conventions
   */
  #isValidTargetKey(key) {
    // Allow alphanumeric characters and underscores
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key);
  }

  /**
   * Validates entity ID format
   *
   * @param {string} entityId - Entity ID to validate
   * @returns {boolean} True if ID follows conventions
   */
  #isValidEntityId(entityId) {
    // Allow letters, numbers, underscores, and colons (for namespaced IDs)
    return /^[a-zA-Z0-9_:-]+$/.test(entityId);
  }

  /**
   * Updates performance metrics
   *
   * @param {number} startTime - Validation start time
   * @param {boolean} hasErrors - Whether validation had errors
   */
  #updateMetrics(startTime, hasErrors) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.#performanceMetrics.validationCount++;
    this.#performanceMetrics.totalTime += duration;

    if (hasErrors) {
      this.#performanceMetrics.errorCount++;
    }

    // Log performance warnings
    if (duration > 10) {
      this.#logger.warn('Multi-target validation took longer than expected', {
        duration: duration.toFixed(2),
        target: '< 10ms',
      });
    }
  }

  /**
   * Gets performance metrics for monitoring
   *
   * @returns {object} Performance metrics
   */
  getPerformanceMetrics() {
    const metrics = { ...this.#performanceMetrics };

    if (metrics.validationCount > 0) {
      metrics.averageTime = metrics.totalTime / metrics.validationCount;
      metrics.errorRate = metrics.errorCount / metrics.validationCount;
    } else {
      metrics.averageTime = 0;
      metrics.errorRate = 0;
    }

    return metrics;
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    this.#performanceMetrics = {
      validationCount: 0,
      totalTime: 0,
      errorCount: 0,
    };
  }
}

export default MultiTargetEventValidator;
