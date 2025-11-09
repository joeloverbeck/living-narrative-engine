/**
 * @file Error class for scope resolution failures
 * @description Provides enhanced context for scope resolution failures with rich debugging information
 * @see BaseError.js - Base error class following project standard
 * @see ParameterValidationError.js - Similar pattern for parameter validation
 */

import BaseError from '../../errors/baseError.js';

/**
 * Error thrown when scope resolution fails
 * Provides comprehensive context including scope name, phase, parameters, hints, suggestions, and original errors
 *
 * @class ScopeResolutionError
 * @augments {BaseError}
 */
export class ScopeResolutionError extends BaseError {
  /**
   * Creates a new ScopeResolutionError instance
   *
   * @param {string} message - The error message describing the resolution failure
   * @param {object} [context] - Context information about the resolution failure
   * @param {string} [context.scopeName] - Name of scope being resolved
   * @param {string} [context.phase] - Resolution phase (e.g., "parameter extraction", "filter evaluation")
   * @param {object} [context.parameters] - Object with parameter values for debugging
   * @param {string} [context.expected] - Expected type/structure
   * @param {string} [context.received] - Actual type/structure
   * @param {string} [context.hint] - Suggestion for fixing the error
   * @param {string} [context.suggestion] - Specific action to take
   * @param {string} [context.example] - Code example showing correct usage
   * @param {Error|string} [context.originalError] - Wrapped error object or error message
   */
  constructor(message, context = {}) {
    // Convert Error objects to serializable format before passing to BaseError
    const processedContext = { ...context };
    if (processedContext.originalError && processedContext.originalError instanceof Error) {
      processedContext.originalError = {
        name: processedContext.originalError.name,
        message: processedContext.originalError.message,
        stack: processedContext.originalError.stack
      };
    }

    super(message, 'SCOPE_RESOLUTION_ERROR', processedContext);
    this.name = 'ScopeResolutionError';
  }

  /**
   * Returns the severity level for scope resolution errors
   *
   * @returns {string} Severity level for scope resolution errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * Determines if scope resolution errors are recoverable
   *
   * @returns {boolean} Scope resolution errors are not recoverable
   */
  isRecoverable() {
    return false;
  }

  /**
   * Formats a parameters object with proper indentation
   *
   * @param {object} params - Parameters object to format
   * @param {number} [indent] - Number of spaces for indentation
   * @returns {string} Formatted parameters string
   * @private
   */
  #formatParameters(params, indent = 4) {
    const indentStr = ' '.repeat(indent);
    const lines = [];

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${indentStr}${key}:`);
        const nestedLines = this.#formatParameters(value, indent + 2);
        lines.push(nestedLines);
      } else {
        lines.push(`${indentStr}${key}: ${String(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Extracts the first N lines of a stack trace
   *
   * @param {string} stack - Stack trace string
   * @param {number} [maxLines] - Maximum number of lines to extract
   * @returns {string} Formatted stack trace excerpt
   * @private
   */
  #formatStackExcerpt(stack, maxLines = 5) {
    if (!stack) return '';

    const lines = stack.split('\n').slice(0, maxLines);
    return lines.map(line => `    ${line.trim()}`).join('\n');
  }

  /**
   * Creates a formatted string representation with enhanced context display
   * Overrides BaseError's default toString() to provide multi-section formatted output
   *
   * @returns {string} Formatted error string with sections for all context properties
   */
  toString() {
    const ctx = this.context;
    let result = `${this.name}: ${this.message}`;

    // Add scope name if provided
    if (ctx.scopeName) {
      result += `\n  Scope: ${ctx.scopeName}`;
    }

    // Add phase if provided
    if (ctx.phase) {
      result += `\n  Phase: ${ctx.phase}`;
    }

    // Add parameters if provided
    if (ctx.parameters && typeof ctx.parameters === 'object') {
      result += `\n  Parameters:`;
      result += `\n${this.#formatParameters(ctx.parameters)}`;
    }

    // Add expected type/structure if provided
    if (ctx.expected) {
      result += `\n  Expected: ${ctx.expected}`;
    }

    // Add received type/structure if provided
    if (ctx.received) {
      result += `\n  Received: ${ctx.received}`;
    }

    // Add hint with emoji indicator if provided
    if (ctx.hint) {
      // Handle multi-line hints with proper indentation
      const hintLines = ctx.hint.split('\n');
      result += `\n  💡 Hint: ${hintLines[0]}`;
      for (let i = 1; i < hintLines.length; i++) {
        result += `\n           ${hintLines[i]}`;
      }
    }

    // Add suggestion if provided
    if (ctx.suggestion) {
      const suggestionLines = ctx.suggestion.split('\n');
      result += `\n  Suggestion: ${suggestionLines[0]}`;
      for (let i = 1; i < suggestionLines.length; i++) {
        result += `\n              ${suggestionLines[i]}`;
      }
    }

    // Add example with proper indentation if provided
    if (ctx.example) {
      result += `\n  Example:`;
      const exampleLines = ctx.example.split('\n');
      for (const line of exampleLines) {
        result += `\n    ${line}`;
      }
    }

    // Add original error if provided
    if (ctx.originalError) {
      let errorMsg;
      if (typeof ctx.originalError === 'string') {
        errorMsg = ctx.originalError;
      } else if (typeof ctx.originalError === 'object') {
        // Handle serialized error object
        const errorName = ctx.originalError.name || 'Error';
        const errorMessage = ctx.originalError.message || String(ctx.originalError);
        errorMsg = `${errorName}: ${errorMessage}`;
      } else {
        errorMsg = String(ctx.originalError);
      }
      result += `\n  Original Error: ${errorMsg}`;
    }

    // Add stack trace excerpt if original error has a stack
    if (ctx.originalError && typeof ctx.originalError === 'object' && ctx.originalError.stack) {
      result += `\n  Stack Trace:`;
      result += `\n${this.#formatStackExcerpt(ctx.originalError.stack)}`;
    } else if (this.stack) {
      // Fall back to our own stack trace excerpt
      result += `\n  Stack Trace:`;
      result += `\n${this.#formatStackExcerpt(this.stack)}`;
    }

    // Add BaseError metadata
    result += `\n\n  [BaseError metadata]`;
    result += `\n  Code: ${this.code}`;
    result += `\n  Severity: ${this.severity}`;
    result += `\n  Recoverable: ${this.recoverable}`;
    result += `\n  Timestamp: ${this.timestamp}`;
    result += `\n  Correlation ID: ${this.correlationId}`;

    return result;
  }
}

export default ScopeResolutionError;
