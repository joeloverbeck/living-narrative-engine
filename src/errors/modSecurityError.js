/**
 * @file Security error class for mod validation security violations
 * @description Handles security-related errors like path traversal, JSON bombs, and malicious input
 */

import { ModValidationError } from './modValidationError.js';

/**
 * Security levels for categorizing severity
 *
 * @enum {string}
 */
export const SecurityLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

/**
 * Error thrown when security violations are detected during mod validation
 *
 * @class
 * @augments {ModValidationError}
 */
export class ModSecurityError extends ModValidationError {
  /**
   * Creates a new ModSecurityError instance
   *
   * @param {string} message - The error message describing the security violation
   * @param {string} securityLevel - Severity level (LOW, MEDIUM, HIGH, CRITICAL)
   * @param {object} context - Context information about the security violation
   */
  constructor(message, securityLevel, context) {
    // Security violations are never recoverable
    super(message, 'SECURITY_VIOLATION', context, false);
    this.name = 'ModSecurityError';
    this.securityLevel = securityLevel;

    // Store security-specific context
    this._enhancedContext = {
      ...context,
      securityLevel,
      reportedAt: new Date().toISOString(),
      requiresAudit:
        securityLevel === SecurityLevel.CRITICAL ||
        securityLevel === SecurityLevel.HIGH,
    };
  }

  /**
   * Getter for enhanced context
   */
  get context() {
    return this._enhancedContext || super.context;
  }

  /**
   * Determines if this is a critical security violation requiring immediate action
   *
   * @returns {boolean} True if critical or high severity
   */
  isCritical() {
    return (
      this.securityLevel === SecurityLevel.CRITICAL ||
      this.securityLevel === SecurityLevel.HIGH
    );
  }

  /**
   * Generates a security incident report
   *
   * @returns {object} Security incident details
   */
  generateIncidentReport() {
    return {
      incidentType: 'SECURITY_VIOLATION',
      severity: this.securityLevel,
      timestamp: this.timestamp,
      message: this.message,
      context: this.context,
      recommendedActions: this._getRecommendedActions(),
      requiresNotification: this.isCritical(),
    };
  }

  /**
   * Gets recommended actions based on security level
   *
   * @private
   * @returns {string[]} List of recommended actions
   */
  _getRecommendedActions() {
    const actions = ['Log security incident', 'Review mod source'];

    if (this.securityLevel === SecurityLevel.CRITICAL) {
      actions.push('Quarantine mod immediately');
      actions.push('Perform security audit');
      actions.push('Notify security team');
    } else if (this.securityLevel === SecurityLevel.HIGH) {
      actions.push('Block mod loading');
      actions.push('Investigate mod author');
    } else if (this.securityLevel === SecurityLevel.MEDIUM) {
      actions.push('Flag mod for review');
    }

    return actions;
  }

  /**
   * @returns {string} Severity level for mod security errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Mod security errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ModSecurityError;
