/**
 * @file Access error class for mod validation file access issues
 * @description Handles file access errors, permissions, and missing files
 */

import { ModValidationError } from './modValidationError.js';

/**
 * Error thrown when file access fails during mod validation
 *
 * @class
 * @augments {ModValidationError}
 */
export class ModAccessError extends ModValidationError {
  /**
   * Creates a new ModAccessError instance
   *
   * @param {string} message - The error message describing the access failure
   * @param {string} filePath - Path to the file that couldn't be accessed
   * @param {object} context - Additional context about the access failure
   */
  constructor(message, filePath, context) {
    // Access errors are often recoverable (can skip file, retry, etc.)
    const isRecoverable = ModAccessError._determineRecoverability(
      message,
      context
    );
    super(message, 'ACCESS_DENIED', context, isRecoverable);
    this.name = 'ModAccessError';
    this.filePath = filePath;

    // Store enhanced context for access tracking
    this._enhancedContext = {
      ...context,
      filePath,
      accessType: this._detectAccessType(message, context),
      canRetry: this._checkRetryability(context),
      alternativeActions: this._getAlternativeActions(context),
    };
  }

  /**
   * Getter for enhanced context
   */
  get context() {
    return this._enhancedContext || super.context;
  }

  /**
   * Determines if the access error is recoverable
   *
   * @private
   * @static
   * @param {string} message - Error message
   * @param {object} context - Error context
   * @returns {boolean} True if recoverable
   */
  static _determineRecoverability(message, context) {
    const lowerMessage = message.toLowerCase();

    // File not found - can skip and continue
    if (lowerMessage.includes('enoent') || lowerMessage.includes('not found')) {
      return true;
    }

    // Temporary lock - can retry
    if (lowerMessage.includes('ebusy') || lowerMessage.includes('locked')) {
      return true;
    }

    // Permission denied - generally not recoverable without intervention
    if (
      lowerMessage.includes('eacces') ||
      lowerMessage.includes('permission')
    ) {
      return false;
    }

    // Network issues - can retry
    if (
      lowerMessage.includes('etimedout') ||
      lowerMessage.includes('network')
    ) {
      return true;
    }

    return context.recoverable !== false;
  }

  /**
   * Detects the type of access error
   *
   * @private
   * @param {string} message - Error message
   * @param {object} context - Error context
   * @returns {string} Type of access error
   */
  _detectAccessType(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('enoent') || lowerMessage.includes('not found')) {
      return 'FILE_NOT_FOUND';
    }
    if (
      lowerMessage.includes('eacces') ||
      lowerMessage.includes('permission')
    ) {
      return 'PERMISSION_DENIED';
    }
    if (lowerMessage.includes('ebusy') || lowerMessage.includes('locked')) {
      return 'FILE_LOCKED';
    }
    if (lowerMessage.includes('eisdir')) {
      return 'IS_DIRECTORY';
    }
    if (lowerMessage.includes('emfile') || lowerMessage.includes('too many')) {
      return 'TOO_MANY_OPEN_FILES';
    }
    if (lowerMessage.includes('etimedout')) {
      return 'TIMEOUT';
    }

    return context.accessType || 'UNKNOWN_ACCESS_ERROR';
  }

  /**
   * Checks if the operation can be retried
   *
   * @private
   * @param {object} context - Error context
   * @returns {boolean} True if retryable
   */
  _checkRetryability(context) {
    // Don't retry if already retried multiple times
    if (context.retryCount >= 3) {
      return false;
    }

    const retryableTypes = ['FILE_LOCKED', 'TOO_MANY_OPEN_FILES', 'TIMEOUT'];

    return retryableTypes.includes(this.context.accessType);
  }

  /**
   * Gets alternative actions when file access fails
   *
   * @private
   * @param {object} context - Error context
   * @returns {string[]} List of alternative actions
   */
  _getAlternativeActions(context) {
    const actions = [];

    switch (this.context.accessType) {
      case 'FILE_NOT_FOUND':
        actions.push('skip_file');
        actions.push('use_default');
        break;
      case 'PERMISSION_DENIED':
        actions.push('request_permission');
        actions.push('skip_file');
        break;
      case 'FILE_LOCKED':
        actions.push('retry_with_delay');
        actions.push('skip_file');
        break;
      case 'TOO_MANY_OPEN_FILES':
        actions.push('close_unused_handles');
        actions.push('retry_with_delay');
        break;
      default:
        actions.push('skip_file');
        actions.push('log_and_continue');
    }

    if (context.hasDefault) {
      actions.push('use_default_value');
    }

    return actions;
  }

  /**
   * Generates an access failure report
   *
   * @returns {object} Access failure details
   */
  generateAccessReport() {
    return {
      filePath: this.filePath,
      accessType: this.context.accessType,
      timestamp: this.timestamp,
      message: this.message,
      recoverable: this.recoverable,
      canRetry: this.context.canRetry,
      alternativeActions: this.context.alternativeActions,
      suggestedFixes: this._getSuggestedFixes(),
    };
  }

  /**
   * Gets suggested fixes for the access error
   *
   * @private
   * @returns {string[]} List of suggested fixes
   */
  _getSuggestedFixes() {
    const fixes = [];

    switch (this.context.accessType) {
      case 'FILE_NOT_FOUND':
        fixes.push('Verify file path is correct');
        fixes.push('Check if file was deleted or moved');
        fixes.push('Ensure mod is properly installed');
        break;
      case 'PERMISSION_DENIED':
        fixes.push('Check file permissions');
        fixes.push('Run with appropriate privileges');
        fixes.push('Verify file ownership');
        break;
      case 'FILE_LOCKED':
        fixes.push('Close other programs using the file');
        fixes.push('Wait and retry');
        break;
      case 'TOO_MANY_OPEN_FILES':
        fixes.push('Increase file descriptor limit');
        fixes.push('Close unused file handles');
        fixes.push('Process files in smaller batches');
        break;
      default:
        fixes.push('Check system logs for details');
        fixes.push('Verify filesystem integrity');
    }

    return fixes;
  }

  /**
   * @returns {string} Severity level for mod access errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Mod access errors recoverability based on context
   */
  isRecoverable() {
    return this.recoverable;
  }
}

export default ModAccessError;
