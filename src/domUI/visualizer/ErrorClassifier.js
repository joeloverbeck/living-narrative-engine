/**
 * @file Error classification utility for anatomy visualization errors
 * @description Categorizes errors by type, severity, and domain for appropriate handling
 * @see src/errors/anatomyVisualizationError.js, src/domUI/visualizer/ErrorRecovery.js
 */

import { AnatomyVisualizationError } from '../../errors/anatomyVisualizationError.js';
import { AnatomyDataError } from '../../errors/anatomyDataError.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';
import { AnatomyStateError } from '../../errors/anatomyStateError.js';

/**
 * Utility class for classifying and categorizing anatomy visualization errors.
 * Provides methods to analyze errors and determine appropriate handling strategies.
 *
 * @class ErrorClassifier
 */
class ErrorClassifier {
  /**
   * Error categories for classification
   *
   * @readonly
   */
  static ERROR_CATEGORIES = {
    DATA: 'data',
    RENDER: 'render',
    STATE: 'state',
    NETWORK: 'network',
    VALIDATION: 'validation',
    PERMISSION: 'permission',
    RESOURCE: 'resource',
    UNKNOWN: 'unknown',
  };

  /**
   * Error domains for domain-specific handling
   *
   * @readonly
   */
  static ERROR_DOMAINS = {
    ANATOMY: 'anatomy',
    UI: 'ui',
    SYSTEM: 'system',
    NETWORK: 'network',
    USER: 'user',
  };

  /**
   * Recovery priorities based on error characteristics
   *
   * @readonly
   */
  static RECOVERY_PRIORITIES = {
    IMMEDIATE: 'immediate', // Handle immediately, critical system function
    HIGH: 'high', // Handle quickly, major feature impact
    MEDIUM: 'medium', // Handle normally, some feature impact
    LOW: 'low', // Handle when convenient, minor impact
    DEFERRED: 'deferred', // Handle later, cosmetic or edge case
  };

  /**
   * Classify an error and return comprehensive classification data
   *
   * @param {Error} error - Error to classify
   * @param {object} context - Additional context about the error
   * @param {string} context.operation - Operation that was being performed
   * @param {string} context.component - Component where error occurred
   * @param {object} context.data - Data related to the operation
   * @returns {object} Classification result
   */
  static classify(error, context = {}) {
    const classification = {
      // Basic error information
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),

      // Classification results
      category: this._determineCategory(error),
      domain: this._determineDomain(error, context),
      severity: this._determineSeverity(error, context),
      recoverable: this._determineRecoverability(error),
      retryable: this._determineRetryability(error),
      priority: this._determinePriority(error, context),

      // Context information
      operation: context.operation || 'unknown',
      component: context.component || 'unknown',
      userImpact: this._assessUserImpact(error, context),
      systemImpact: this._assessSystemImpact(error, context),

      // Recovery guidance
      recommendedStrategy: this._recommendStrategy(error, context),
      fallbackAvailable: this._checkFallbackAvailability(error, context),
      userMessageSuggested: this._generateUserMessage(error, context),
      actionsSuggested: this._generateActionSuggestions(error, context),
    };

    // Add specific error details if it's an anatomy visualization error
    if (error instanceof AnatomyVisualizationError) {
      classification.anatomyErrorDetails = {
        code: error.code,
        context: error.context,
        metadata: error.metadata,
        userMessage: error.userMessage,
        suggestions: error.suggestions,
      };
    }

    return classification;
  }

  /**
   * Check if an error should be reported to external systems
   *
   * @param {Error} error - Error to check
   * @param {object} context - Error context
   * @returns {boolean} True if error should be reported
   */
  static shouldReport(error, context = {}) {
    const classification = this.classify(error, context);

    // Always report critical errors
    if (classification.severity === 'CRITICAL') {
      return true;
    }

    // Report high severity errors that affect system functionality
    if (
      classification.severity === 'HIGH' &&
      classification.systemImpact === 'major'
    ) {
      return true;
    }

    // Report recurring errors (would need error history to determine)
    // This would be implemented with error history tracking

    // Report errors with unknown causes for investigation
    if (classification.category === this.ERROR_CATEGORIES.UNKNOWN) {
      return true;
    }

    return false;
  }

  /**
   * Get error urgency level for prioritization
   *
   * @param {Error} error - Error to assess
   * @param {object} context - Error context
   * @returns {string} Urgency level
   */
  static getUrgency(error, context = {}) {
    const classification = this.classify(error, context);

    // Critical errors are always urgent
    if (classification.severity === 'CRITICAL') {
      return 'urgent';
    }

    // High impact on core functionality
    if (
      classification.userImpact === 'blocking' ||
      classification.systemImpact === 'major'
    ) {
      return 'high';
    }

    // Medium impact or important operations
    if (
      classification.userImpact === 'significant' ||
      classification.priority === 'HIGH'
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Determine error category
   *
   * @private
   * @param {Error} error - Error to categorize
   * @returns {string} Error category
   */
  static _determineCategory(error) {
    if (error instanceof AnatomyDataError) {
      return this.ERROR_CATEGORIES.DATA;
    }
    if (error instanceof AnatomyRenderError) {
      return this.ERROR_CATEGORIES.RENDER;
    }
    if (error instanceof AnatomyStateError) {
      return this.ERROR_CATEGORIES.STATE;
    }

    // Check error patterns for non-anatomy errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return this.ERROR_CATEGORIES.NETWORK;
    }
    if (
      error.name === 'ValidationError' ||
      error.message.includes('validation')
    ) {
      return this.ERROR_CATEGORIES.VALIDATION;
    }
    if (
      error.message.includes('permission') ||
      error.message.includes('unauthorized')
    ) {
      return this.ERROR_CATEGORIES.PERMISSION;
    }
    if (error.message.includes('memory') || error.message.includes('quota')) {
      return this.ERROR_CATEGORIES.RESOURCE;
    }

    return this.ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Determine error domain
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} Error domain
   */
  static _determineDomain(error, context) {
    // Anatomy visualization errors
    if (error instanceof AnatomyVisualizationError) {
      return this.ERROR_DOMAINS.ANATOMY;
    }

    // UI-related errors
    if (
      context.component &&
      (context.component.includes('UI') ||
        context.component.includes('Renderer') ||
        context.component.includes('Dom'))
    ) {
      return this.ERROR_DOMAINS.UI;
    }

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return this.ERROR_DOMAINS.NETWORK;
    }

    // User input errors
    if (
      error.message.includes('invalid input') ||
      error.message.includes('user')
    ) {
      return this.ERROR_DOMAINS.USER;
    }

    return this.ERROR_DOMAINS.SYSTEM;
  }

  /**
   * Determine error severity
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} Severity level
   */
  static _determineSeverity(error, context) {
    // Use anatomy error severity if available
    if (error instanceof AnatomyVisualizationError) {
      return error.severity;
    }

    // Critical system errors
    if (error.name === 'TypeError' && context.operation === 'initialization') {
      return 'CRITICAL';
    }

    // High severity for core functionality
    if (
      context.operation &&
      ['entity_selection', 'anatomy_loading', 'rendering'].includes(
        context.operation
      )
    ) {
      return 'HIGH';
    }

    // Medium severity for feature functionality
    if (context.component && context.component.includes('UI')) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Determine if error is recoverable
   *
   * @private
   * @param {Error} error - Error to analyze
   * @returns {boolean} True if recoverable
   */
  static _determineRecoverability(error) {
    // Use anatomy error recoverability if available
    if (error instanceof AnatomyVisualizationError) {
      return error.recoverable;
    }

    // Network errors are typically recoverable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Validation errors may be recoverable with different input
    if (error.name === 'ValidationError') {
      return true;
    }

    // System errors are typically not recoverable
    if (error.name === 'ReferenceError' || error.name === 'TypeError') {
      return false;
    }

    // Default to recoverable for unknown errors
    return true;
  }

  /**
   * Determine if error is retryable
   *
   * @private
   * @param {Error} error - Error to analyze
   * @returns {boolean} True if retryable
   */
  static _determineRetryability(error) {
    // Network errors are retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Timeout errors are retryable
    if (error.message.includes('timeout')) {
      return true;
    }

    // Some anatomy errors are retryable
    if (
      error instanceof AnatomyDataError &&
      error.code === 'MISSING_ANATOMY_PARTS'
    ) {
      return true;
    }
    if (
      error instanceof AnatomyRenderError &&
      error.code === 'SVG_RENDERING_FAILED'
    ) {
      return true;
    }

    // Validation and permission errors are typically not retryable
    if (
      error.name === 'ValidationError' ||
      error.message.includes('permission')
    ) {
      return false;
    }

    return false;
  }

  /**
   * Determine recovery priority
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} Priority level
   */
  static _determinePriority(error, context) {
    const severity = this._determineSeverity(error, context);
    const userImpact = this._assessUserImpact(error, context);

    if (severity === 'CRITICAL') {
      return this.RECOVERY_PRIORITIES.IMMEDIATE;
    }

    if (severity === 'HIGH' && userImpact === 'blocking') {
      return this.RECOVERY_PRIORITIES.IMMEDIATE;
    }

    if (severity === 'HIGH') {
      return this.RECOVERY_PRIORITIES.HIGH;
    }

    if (severity === 'MEDIUM' && userImpact === 'significant') {
      return this.RECOVERY_PRIORITIES.HIGH;
    }

    if (severity === 'MEDIUM') {
      return this.RECOVERY_PRIORITIES.MEDIUM;
    }

    return this.RECOVERY_PRIORITIES.LOW;
  }

  /**
   * Assess user impact level
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} User impact level
   */
  static _assessUserImpact(error, context) {
    // Critical operations block user completely
    if (context.operation === 'initialization') {
      return 'blocking';
    }

    // Core features have significant impact
    if (
      context.operation &&
      ['entity_selection', 'anatomy_loading'].includes(context.operation)
    ) {
      return 'significant';
    }

    // Rendering issues have moderate impact
    if (
      context.operation === 'rendering' ||
      error instanceof AnatomyRenderError
    ) {
      return 'moderate';
    }

    // UI issues have minor impact
    if (context.component && context.component.includes('UI')) {
      return 'minor';
    }

    return 'minimal';
  }

  /**
   * Assess system impact level
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} System impact level
   */
  static _assessSystemImpact(error, context) {
    // State errors can have major system impact
    if (error instanceof AnatomyStateError) {
      return 'major';
    }

    // Initialization errors affect the entire system
    if (context.operation === 'initialization') {
      return 'major';
    }

    // Data errors affect specific features
    if (error instanceof AnatomyDataError) {
      return 'moderate';
    }

    // Render errors typically have minor system impact
    if (error instanceof AnatomyRenderError) {
      return 'minor';
    }

    return 'minimal';
  }

  /**
   * Recommend recovery strategy
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} Recommended strategy
   */
  static _recommendStrategy(error, context) {
    if (this._determineRetryability(error)) {
      return 'retry';
    }

    if (this._determineRecoverability(error)) {
      return 'fallback';
    }

    return 'user_intervention';
  }

  /**
   * Check if fallback is available
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {boolean} True if fallback is available
   */
  static _checkFallbackAvailability(error, context) {
    // Render errors typically have fallbacks
    if (error instanceof AnatomyRenderError) {
      return true;
    }

    // Data errors may have fallbacks
    if (
      error instanceof AnatomyDataError &&
      ['MISSING_ANATOMY_PARTS', 'MISSING_ANATOMY_DATA'].includes(error.code)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate user-friendly error message
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} User-friendly message
   */
  static _generateUserMessage(error, context) {
    if (error instanceof AnatomyVisualizationError) {
      return error.userMessage;
    }

    const category = this._determineCategory(error);
    const severity = this._determineSeverity(error, context);

    if (severity === 'CRITICAL') {
      return 'A critical error occurred. Please refresh the page.';
    }

    switch (category) {
      case this.ERROR_CATEGORIES.NETWORK:
        return 'Network connection issue. Please check your internet connection.';
      case this.ERROR_CATEGORIES.VALIDATION:
        return 'Invalid input provided to the anatomy visualizer.';
      case this.ERROR_CATEGORIES.PERMISSION:
        return 'You do not have permission to view this anatomy data.';
      case this.ERROR_CATEGORIES.RESOURCE:
        return 'Insufficient resources to display the anatomy visualization.';
      default:
        return 'An error occurred with the anatomy visualizer.';
    }
  }

  /**
   * Generate action suggestions
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {Array<string>} Action suggestions
   */
  static _generateActionSuggestions(error, context) {
    if (error instanceof AnatomyVisualizationError) {
      return error.suggestions;
    }

    const suggestions = [];
    const category = this._determineCategory(error);
    const retryable = this._determineRetryability(error);

    if (retryable) {
      suggestions.push('Try again');
    }

    switch (category) {
      case this.ERROR_CATEGORIES.NETWORK:
        suggestions.push('Check your internet connection');
        suggestions.push('Try again in a moment');
        break;
      case this.ERROR_CATEGORIES.VALIDATION:
        suggestions.push('Check your input and try again');
        suggestions.push('Ensure all required fields are filled correctly');
        break;
      case this.ERROR_CATEGORIES.PERMISSION:
        suggestions.push('Contact your administrator for access');
        suggestions.push('Ensure you are logged in with the correct account');
        break;
      case this.ERROR_CATEGORIES.RESOURCE:
        suggestions.push('Close other applications to free up resources');
        suggestions.push('Try again with a smaller dataset');
        break;
      default:
        suggestions.push('Refresh the page');
        suggestions.push('Contact support if the problem persists');
    }

    return suggestions;
  }
}

export { ErrorClassifier };
