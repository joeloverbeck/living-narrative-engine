import { ScopeDslError } from '../errors/scopeDslError.js';
import { ErrorCategories } from './scopeDslErrorHandler.js';

/**
 * Predefined error message templates aligned with existing error categories
 */
const ERROR_TEMPLATES = {
  missingContext: {
    category: ErrorCategories.MISSING_CONTEXT,
    message: 'Required context field "{field}" is missing for {resolver}',
  },
  invalidData: {
    category: ErrorCategories.INVALID_DATA,
    message:
      'Invalid data format in {field}: expected {expected}, got {actual}',
  },
  resolutionFailure: {
    category: ErrorCategories.RESOLUTION_FAILURE,
    message: 'Failed to resolve {path} in {resolver}: {reason}',
  },
  cycleDetected: {
    category: ErrorCategories.CYCLE_DETECTED,
    message: 'Circular reference detected in {path} at depth {depth}',
  },
  depthExceeded: {
    category: ErrorCategories.DEPTH_EXCEEDED,
    message: 'Maximum depth {maxDepth} exceeded at {path}',
  },
  parseError: {
    category: ErrorCategories.PARSE_ERROR,
    message: 'Parse error in {source}: {reason}',
  },
  configuration: {
    category: ErrorCategories.CONFIGURATION,
    message: 'Configuration error in {setting}: {reason}',
  },
};

/**
 * Factory for creating standardized error messages with template support.
 *
 * Provides backward-compatible error creation for unknown node types and
 * enhanced template-based error creation aligned with existing error categories.
 */
export default {
  /**
   * Creates a ScopeDslError for unknown node kinds.
   *
   * @param {string} kind - The unknown node kind
   * @param {*} value - The full node value for context
   * @returns {ScopeDslError} A new ScopeDslError instance
   */
  unknown(kind, value) {
    return new ScopeDslError(
      `Unknown node kind: '${kind}'. Full node: ${JSON.stringify(value)}`
    );
  },

  /**
   * Creates a ScopeDslError from a predefined template with parameter interpolation.
   *
   * @param {string} templateKey - The template key (e.g., 'missingContext', 'invalidData')
   * @param {object} params - Parameters for template interpolation
   * @returns {ScopeDslError} A new ScopeDslError instance
   */
  fromTemplate(templateKey, params = {}) {
    const template = ERROR_TEMPLATES[templateKey];
    if (!template) {
      // Fallback for unknown template keys
      return new ScopeDslError(
        `Unknown error template: '${templateKey}'. Parameters: ${JSON.stringify(params)}`
      );
    }

    const interpolatedMessage = this._interpolateMessage(
      template.message,
      params
    );
    return new ScopeDslError(interpolatedMessage);
  },

  /**
   * Creates a ScopeDslError for a specific category with custom message.
   *
   * @param {string} category - The error category from ErrorCategories
   * @param {string} message - The error message
   * @param {object} params - Optional parameters for message interpolation
   * @returns {ScopeDslError} A new ScopeDslError instance
   */
  createForCategory(category, message, params = {}) {
    const interpolatedMessage = this._interpolateMessage(message, params);
    return new ScopeDslError(interpolatedMessage);
  },

  /**
   * Creates a ScopeDslError with optional error handler integration.
   *
   * When errorHandler is provided, the error is processed through the handler
   * which adds error codes and categorization. Otherwise, creates a basic error.
   *
   * @param {string} templateKey - The template key
   * @param {object} params - Parameters for template interpolation
   * @param {object} context - Resolution context for error handler
   * @param {string} resolverName - Name of the resolver for error handler
   * @param {object} errorHandler - Optional error handler for processing
   * @returns {ScopeDslError} A new ScopeDslError instance
   */
  createWithHandler(templateKey, params, context, resolverName, errorHandler) {
    if (!errorHandler) {
      // Fallback to template-based creation if no handler provided
      return this.fromTemplate(templateKey, params);
    }

    const template = ERROR_TEMPLATES[templateKey];
    if (!template) {
      // Use error handler for unknown template handling
      errorHandler.handleError(
        `Unknown error template: '${templateKey}'`,
        context,
        resolverName
      );
      return; // handleError always throws, this line won't be reached
    }

    const interpolatedMessage = this._interpolateMessage(
      template.message,
      params
    );

    // Use error handler for consistent processing with codes and categorization
    errorHandler.handleError(interpolatedMessage, context, resolverName);
    return; // handleError always throws, this line won't be reached
  },

  /**
   * Interpolates template parameters into message strings.
   *
   * Replaces {placeholder} tokens with corresponding values from params.
   * Handles missing parameters gracefully by leaving placeholders in place.
   *
   * @param {string} message - The message template with {placeholder} tokens
   * @param {object} params - The parameters object for interpolation
   * @returns {string} The interpolated message
   * @private
   */
  _interpolateMessage(message, params) {
    if (!params || typeof params !== 'object') {
      return message;
    }

    return message.replace(/\{([^}]+)\}/g, (match, key) => {
      // Support nested property access (e.g., {config.setting})
      const keys = key.split('.');
      let value = params;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Return original placeholder if parameter is missing
          return match;
        }
      }

      // Convert value to string, handling special cases
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'string') return value;

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    });
  },
};
