// src/errors/missingHandlerError.js

import BaseError from './baseError.js';

/**
 * Error thrown when an operation handler is not found in the registry.
 * This is a runtime error indicating that a rule references an operation
 * type that has no registered handler.
 */
export class MissingHandlerError extends BaseError {
  /**
   * Creates a new MissingHandlerError instance.
   *
   * @param {string} operationType - The operation type that has no handler
   * @param {string} [ruleId] - Optional rule ID context for debugging
   */
  constructor(operationType, ruleId = null) {
    const message = `Cannot execute operation '${operationType}'${ruleId ? ` in rule '${ruleId}'` : ''}: handler not found`;
    const context = { operationType, ruleId };
    super(message, 'MISSING_HANDLER', context);
    this.name = 'MissingHandlerError';
    // Backward compatibility: expose properties directly
    this.operationType = operationType;
    this.ruleId = ruleId;
  }

  /**
   * Returns the severity level for missing handler errors.
   *
   * @returns {string} Severity level for missing handler errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * Returns whether missing handler errors are recoverable.
   *
   * @returns {boolean} Missing handler errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
