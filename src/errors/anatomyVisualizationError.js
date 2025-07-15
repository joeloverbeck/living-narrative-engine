/**
 * @file Base error class for anatomy visualization operations
 * @see src/domUI/visualizer/ErrorRecovery.js
 */

/**
 * Base error class for all anatomy visualization related errors.
 * Provides common functionality for error categorization, severity levels,
 * and recovery guidance.
 *
 * @class
 * @augments {Error}
 */
export class AnatomyVisualizationError extends Error {
  /**
   * Create a new AnatomyVisualizationError instance.
   *
   * @param {string} message - The error message
   * @param {object} options - Error options
   * @param {string} options.code - Error code for programmatic handling
   * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} options.severity - Error severity level
   * @param {string} options.context - Additional context about the error
   * @param {Error} options.cause - Original error that caused this error
   * @param {object} options.metadata - Additional metadata for debugging
   * @param {boolean} options.recoverable - Whether this error is recoverable
   * @param {string} options.userMessage - User-friendly error message
   * @param {Array<string>} options.suggestions - Recovery suggestions for the user
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'AnatomyVisualizationError';
    
    // Error classification
    this.code = options.code || 'ANATOMY_VISUALIZATION_ERROR';
    this.severity = options.severity || 'MEDIUM';
    this.context = options.context || 'Unknown context';
    this.recoverable = options.recoverable !== false; // Default to recoverable
    
    // User-facing information
    this.userMessage = options.userMessage || this._getDefaultUserMessage();
    this.suggestions = options.suggestions || this._getDefaultSuggestions();
    
    // Debugging information
    this.cause = options.cause || null;
    this.metadata = options.metadata || {};
    this.timestamp = new Date().toISOString();
    
    // Stack trace handling
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get error details formatted for logging
   *
   * @returns {object} Formatted error details
   */
  getErrorDetails() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      suggestions: this.suggestions,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : null
    };
  }

  /**
   * Get user-friendly error information
   *
   * @returns {object} User-friendly error details
   */
  getUserInfo() {
    return {
      message: this.userMessage,
      severity: this.severity,
      recoverable: this.recoverable,
      suggestions: this.suggestions,
      timestamp: this.timestamp
    };
  }

  /**
   * Check if error is of specified severity level or higher
   *
   * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} level - Severity level to check
   * @returns {boolean} True if error is at or above specified severity
   */
  isAtLeastSeverity(level) {
    const severityLevels = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3,
      'CRITICAL': 4
    };
    
    const currentLevel = severityLevels[this.severity] || 2;
    const checkLevel = severityLevels[level] || 2;
    
    return currentLevel >= checkLevel;
  }

  /**
   * Convert error to JSON for serialization
   *
   * @returns {object} JSON representation of the error
   */
  toJSON() {
    return this.getErrorDetails();
  }

  /**
   * Get default user message based on error properties
   *
   * @private
   * @returns {string} Default user message
   */
  _getDefaultUserMessage() {
    switch (this.severity) {
      case 'CRITICAL':
        return 'A critical error occurred in the anatomy visualizer. Please refresh the page.';
      case 'HIGH':
        return 'An error occurred while processing anatomy data. Some features may not work correctly.';
      case 'MEDIUM':
        return 'A problem occurred with the anatomy visualization. You can try again.';
      case 'LOW':
        return 'A minor issue occurred with the anatomy visualizer.';
      default:
        return 'An error occurred in the anatomy visualizer.';
    }
  }

  /**
   * Get default recovery suggestions
   *
   * @private
   * @returns {Array<string>} Default recovery suggestions
   */
  _getDefaultSuggestions() {
    const baseSuggestions = [];
    
    if (this.recoverable) {
      baseSuggestions.push('Try the operation again');
    }
    
    switch (this.severity) {
      case 'CRITICAL':
        baseSuggestions.push('Refresh the page');
        baseSuggestions.push('Contact support if the problem persists');
        break;
      case 'HIGH':
        baseSuggestions.push('Check your network connection');
        baseSuggestions.push('Try selecting a different entity');
        break;
      case 'MEDIUM':
      case 'LOW':
        baseSuggestions.push('Wait a moment and try again');
        break;
    }
    
    return baseSuggestions;
  }
}