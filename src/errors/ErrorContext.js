/**
 * @file ErrorContext - Utility class for error context management
 * @description Provides utilities for extracting, enhancing, and managing error context information
 * @see CentralErrorHandler.js - Primary consumer of these utilities
 * @see baseError.js - Base error class that context utilities work with
 */

import { v4 as uuidv4 } from 'uuid';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * Utility class for error context management and manipulation
 *
 * @class
 */
export class ErrorContext {
  /**
   * Extract context information from an error object
   *
   * @param {Error} error - The error to extract context from
   * @returns {object} Extracted context information
   */
  static extract(error) {
    if (!error) {
      return {};
    }

    const context = {
      errorType: error.constructor.name,
      message: error.message,
      timestamp: Date.now(),
    };

    // Add stack trace if available
    if (error.stack) {
      context.stack = error.stack;
    }

    // Extract BaseError specific context
    if (error.context && typeof error.context === 'object') {
      context.originalContext = { ...error.context };
    }

    // Extract BaseError specific properties
    if (error.code) {
      context.code = error.code;
    }
    if (error.severity) {
      context.severity = error.severity;
    }
    if (error.recoverable !== undefined) {
      context.recoverable = error.recoverable;
    }
    if (error.correlationId) {
      context.correlationId = error.correlationId;
    }

    // Extract additional error properties
    if (error.cause) {
      context.cause = ErrorContext.extract(error.cause);
    }

    return context;
  }

  /**
   * Enhance an error with additional context information
   *
   * @param {Error} error - The error to enhance
   * @param {object} additionalContext - Additional context to add
   * @returns {Error} The enhanced error (may be the same instance or a new one)
   */
  static enhance(error, additionalContext = {}) {
    if (!error) {
      throw new Error('ErrorContext.enhance: error parameter is required');
    }

    if (!additionalContext || typeof additionalContext !== 'object') {
      return error;
    }

    // If it's a BaseError, use its addContext method
    if (error.addContext && typeof error.addContext === 'function') {
      for (const [key, value] of Object.entries(additionalContext)) {
        if (isNonBlankString(key)) {
          error.addContext(key, value);
        }
      }
      return error;
    }

    // For regular Error objects, try to add context as properties
    try {
      for (const [key, value] of Object.entries(additionalContext)) {
        if (
          isNonBlankString(key) &&
          !Object.prototype.hasOwnProperty.call(error, key)
        ) {
          error[key] = value;
        }
      }
    } catch {
      // If error is frozen/sealed, we can't modify it
      // This is acceptable behavior
    }

    return error;
  }

  /**
   * Generate a unique correlation ID for error tracking
   *
   * @param {string} prefix - Optional prefix for the correlation ID
   * @returns {string} Unique correlation ID
   */
  static generateCorrelationId(prefix = 'err') {
    if (!isNonBlankString(prefix)) {
      prefix = 'err';
    }

    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0]; // Use first segment of UUID for brevity

    return `${prefix}_${timestamp}_${uuid}`;
  }

  /**
   * Sanitize context object to ensure it's safe for logging/serialization
   *
   * @param {object} context - Context object to sanitize
   * @param {number} maxDepth - Maximum depth for nested objects
   * @returns {object} Sanitized context object
   */
  static sanitize(context, maxDepth = 5) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    return this.#sanitizeRecursive(context, maxDepth, 0, new WeakSet());
  }

  /**
   * Merge multiple context objects safely
   *
   * @param {...object} contexts - Context objects to merge
   * @returns {object} Merged context object
   */
  static merge(...contexts) {
    const result = {};

    for (const context of contexts) {
      if (context && typeof context === 'object') {
        for (const [key, value] of Object.entries(context)) {
          if (isNonBlankString(key)) {
            result[key] = value;
          }
        }
      }
    }

    return result;
  }

  /**
   * Create a context snapshot for a specific operation
   *
   * @param {string} operation - Operation name
   * @param {object} additionalContext - Additional context information
   * @returns {object} Context snapshot
   */
  static createSnapshot(operation, additionalContext = {}) {
    if (!isNonBlankString(operation)) {
      throw new Error(
        'ErrorContext.createSnapshot: operation parameter is required'
      );
    }

    return this.merge(
      {
        operation,
        snapshotId: this.generateCorrelationId('snapshot'),
        timestamp: Date.now(),
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      },
      additionalContext
    );
  }

  /**
   * Recursively sanitize context objects
   *
   * @private
   * @param {*} obj - Object to sanitize
   * @param {number} maxDepth - Maximum depth
   * @param {number} currentDepth - Current depth
   * @param {WeakSet} seen - Set of seen objects to prevent circular references
   * @returns {*} Sanitized object
   */
  static #sanitizeRecursive(obj, maxDepth, currentDepth, seen) {
    // Handle primitive types
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Check for maximum depth
    if (currentDepth >= maxDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    // Check for circular references
    if (seen.has(obj)) {
      return '[CIRCULAR_REFERENCE]';
    }
    seen.add(obj);

    try {
      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map((item) =>
          this.#sanitizeRecursive(item, maxDepth, currentDepth + 1, seen)
        );
      }

      // Handle dates
      if (obj instanceof Date) {
        return obj.toISOString();
      }

      // Handle errors
      if (obj instanceof Error) {
        return {
          name: obj.name,
          message: obj.message,
          stack: obj.stack,
        };
      }

      // Handle regular objects
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          continue;
        }

        // Sanitize sensitive keys
        if (this.#isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        sanitized[key] = this.#sanitizeRecursive(
          value,
          maxDepth,
          currentDepth + 1,
          seen
        );
      }

      return sanitized;
    } catch {
      return '[SANITIZATION_ERROR]';
    } finally {
      seen.delete(obj);
    }
  }

  /**
   * Check if a key contains sensitive information that should be redacted
   *
   * @private
   * @param {string} key - Key to check
   * @returns {boolean} True if key is sensitive
   */
  static #isSensitiveKey(key) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /session/i,
      /cookie/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(key));
  }
}

export default ErrorContext;
