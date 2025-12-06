/**
 * @file Corruption error class for mod validation file corruption issues
 * @description Handles file corruption, malformed data, and parsing failures
 */

import { ModValidationError } from './modValidationError.js';

/**
 * Error thrown when file corruption is detected during mod validation
 *
 * @class
 * @augments {ModValidationError}
 */
export class ModCorruptionError extends ModValidationError {
  /**
   * Creates a new ModCorruptionError instance
   *
   * @param {string} message - The error message describing the corruption
   * @param {string} filePath - Path to the corrupted file
   * @param {object} context - Additional context about the corruption
   */
  constructor(message, filePath, context) {
    // File corruption is generally non-recoverable
    super(message, 'FILE_CORRUPTION', context, false);
    this.name = 'ModCorruptionError';
    this.filePath = filePath;

    // Store enhanced context for corruption tracking
    this._enhancedContext = {
      ...context,
      filePath,
      corruptionType: this._detectCorruptionType(message, context),
      canPartiallyRecover: this._checkPartialRecovery(context),
    };
  }

  /**
   * Getter for enhanced context
   */
  get context() {
    return this._enhancedContext || super.context;
  }

  /**
   * Attempts to detect the type of corruption based on error details
   *
   * @private
   * @param {string} message - Error message
   * @param {object} context - Error context
   * @returns {string} Type of corruption detected
   */
  _detectCorruptionType(message, context) {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('unexpected token') ||
      lowerMessage.includes('json')
    ) {
      return 'MALFORMED_JSON';
    }
    if (lowerMessage.includes('encoding') || lowerMessage.includes('utf')) {
      return 'ENCODING_ERROR';
    }
    if (
      lowerMessage.includes('truncated') ||
      lowerMessage.includes('incomplete')
    ) {
      return 'TRUNCATED_FILE';
    }
    if (context.parseError) {
      return 'PARSE_ERROR';
    }

    return 'UNKNOWN_CORRUPTION';
  }

  /**
   * Checks if partial recovery is possible
   *
   * @private
   * @param {object} context - Error context
   * @returns {boolean} True if partial recovery might be possible
   */
  _checkPartialRecovery(context) {
    // Some corruption types might allow partial data extraction
    if (context.partialData) {
      return true;
    }

    // JSON with minor syntax errors might be fixable
    if (context.parseError && context.parseError.includes('trailing comma')) {
      return true;
    }

    return false;
  }

  /**
   * Generates a corruption report for debugging
   *
   * @returns {object} Corruption details
   */
  generateCorruptionReport() {
    return {
      filePath: this.filePath,
      corruptionType: this.context.corruptionType,
      timestamp: this.timestamp,
      message: this.message,
      canPartiallyRecover: this.context.canPartiallyRecover,
      suggestedActions: this._getSuggestedActions(),
    };
  }

  /**
   * Gets suggested actions for handling the corruption
   *
   * @private
   * @returns {string[]} List of suggested actions
   */
  _getSuggestedActions() {
    const actions = [];

    switch (this.context.corruptionType) {
      case 'MALFORMED_JSON':
        actions.push('Validate JSON syntax');
        actions.push('Check for trailing commas');
        actions.push('Verify proper quote usage');
        break;
      case 'ENCODING_ERROR':
        actions.push('Check file encoding (should be UTF-8)');
        actions.push('Remove special characters');
        break;
      case 'TRUNCATED_FILE':
        actions.push('Verify file was fully written');
        actions.push('Check disk space');
        actions.push('Re-download or restore from backup');
        break;
      default:
        actions.push('Restore file from backup');
        actions.push('Re-create file from template');
    }

    if (this.context.canPartiallyRecover) {
      actions.push('Attempt partial data recovery');
    }

    return actions;
  }

  /**
   * @returns {string} Severity level for mod corruption errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Mod corruption errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ModCorruptionError;
