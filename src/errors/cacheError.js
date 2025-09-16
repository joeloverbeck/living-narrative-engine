/**
 * @file Cache-specific error types for consistent error handling
 */

import BaseError from './baseError.js';

/**
 * Base error for cache operations
 */
export class CacheError extends BaseError {
  /**
   * @param {string} message - Error message
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, cause) {
    const context = { cause };
    super(message, 'CACHE_ERROR', context);
    this.name = 'CacheError';
    // Backward compatibility
    this.cause = cause;
  }

  /**
   * @returns {string} Severity level for cache errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Cache errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

/**
 * Error for cache key validation failures
 */
export class CacheKeyError extends CacheError {
  /**
   * @param {string} message - Error message
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, cause) {
    super(message, cause);
    this.name = 'CacheKeyError';
  }
}

/**
 * Error for cache validation failures
 */
export class CacheValidationError extends CacheError {
  /**
   * @param {string} message - Error message
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, cause) {
    super(message, cause);
    this.name = 'CacheValidationError';
  }
}
