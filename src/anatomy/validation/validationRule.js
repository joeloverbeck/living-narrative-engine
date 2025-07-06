/**
 * @file Base class for anatomy graph validation rules
 */

/**
 * @typedef {object} ValidationContext
 * @property {string[]} entityIds - All entity IDs in the graph
 * @property {object} recipe - The recipe used to assemble the graph
 * @property {Set<string>} socketOccupancy - Occupied sockets tracking
 * @property {import('../../interfaces/IEntityManager.js').IEntityManager} entityManager
 * @property {import('../../interfaces/coreServices.js').ILogger} logger
 */

/**
 * @typedef {object} ValidationIssue
 * @property {'error' | 'warning' | 'info'} severity
 * @property {string} message
 * @property {string} ruleId - The ID of the rule that generated this issue
 * @property {object} [context] - Additional context about the issue
 */

/**
 * Base class for validation rules following Chain of Responsibility pattern
 */
export class ValidationRule {
  /**
   * @returns {string} Unique identifier for this rule
   */
  get ruleId() {
    throw new Error('ruleId must be implemented by subclass');
  }

  /**
   * @returns {string} Human-readable name for this rule
   */
  get ruleName() {
    throw new Error('ruleName must be implemented by subclass');
  }

  /**
   * Check if this rule should be applied in the current validation context
   *
   * @param {ValidationContext} context - The validation context
   * @returns {boolean} True if this rule should be applied
   */
  shouldApply(context) {
    return true;
  }

  /**
   * Validate the graph according to this rule
   *
   * @param {ValidationContext} context - The validation context
   * @returns {Promise<ValidationIssue[]>} Array of validation issues found
   */
  async validate(context) {
    throw new Error('validate must be implemented by subclass');
  }

  /**
   * Helper method to create an error issue
   *
   * @protected
   * @param {string} message - The error message
   * @param {object} [additionalContext] - Additional context
   * @returns {ValidationIssue}
   */
  createError(message, additionalContext = {}) {
    return {
      severity: 'error',
      message,
      ruleId: this.ruleId,
      context: additionalContext,
    };
  }

  /**
   * Helper method to create a warning issue
   *
   * @protected
   * @param {string} message - The warning message
   * @param {object} [additionalContext] - Additional context
   * @returns {ValidationIssue}
   */
  createWarning(message, additionalContext = {}) {
    return {
      severity: 'warning',
      message,
      ruleId: this.ruleId,
      context: additionalContext,
    };
  }

  /**
   * Helper method to create an info issue
   *
   * @protected
   * @param {string} message - The info message
   * @param {object} [additionalContext] - Additional context
   * @returns {ValidationIssue}
   */
  createInfo(message, additionalContext = {}) {
    return {
      severity: 'info',
      message,
      ruleId: this.ruleId,
      context: additionalContext,
    };
  }
}

export default ValidationRule;
