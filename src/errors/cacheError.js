/**
 * @file Cache-specific error types for consistent error handling
 */

/**
 * Base error for cache operations
 */
export class CacheError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, cause) {
    super(message);
    this.name = 'CacheError';
    this.cause = cause;
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
