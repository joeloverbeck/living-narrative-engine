/**
 * @file Centralized error handler for ScopeDSL system
 * @description Provides environment-aware error processing, context sanitization, and error buffering
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ScopeDslError } from '../errors/scopeDslError.js';
import { ErrorCategories } from '../constants/errorCategories.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Centralized error handler for ScopeDSL system
 *
 * Provides environment-aware error handling, context sanitization,
 * and error buffering capabilities for consistent error processing
 * across all ScopeDSL resolvers.
 */
class ScopeDslErrorHandler {
  #logger;
  #isDevelopment;
  #errorBuffer;
  #maxBufferSize;
  #bufferIndex;
  #sanitizationWeakSet;
  #categoryCache;

  /**
   * Creates a new ScopeDslErrorHandler instance
   *
   * @param {object} dependencies - Dependency object
   * @param {import('../../interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
   * @param {object} [dependencies.config] - Configuration options
   * @throws {Error} If required dependencies are invalid
   */
  constructor({ logger, config = {} }) {
    // Validate required dependencies
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['error', 'warn', 'debug', 'info'],
    });

    this.#logger = logger;
    this.#isDevelopment =
      config.isDevelopment ??
      (typeof globalThis.process !== 'undefined' &&
        globalThis.process.env?.NODE_ENV !== 'production');
    this.#errorBuffer = [];
    this.#maxBufferSize = config.maxBufferSize ?? 100;
    this.#bufferIndex = 0;
    this.#sanitizationWeakSet = new WeakSet();
    this.#categoryCache = new Map();
  }

  /**
   * Handle an error with environment-aware processing
   *
   * @param {Error|string} error - The error or error message
   * @param {object} context - Resolution context for debugging
   * @param {string} resolverName - Name of the resolver that encountered the error
   * @param {string} [errorCode] - Optional specific error code
   * @throws {ScopeDslError} Always throws a standardized error
   */
  handleError(error, context, resolverName, errorCode = null) {
    let errorInfo;

    try {
      // Create standardized error information
      errorInfo = this.#createErrorInfo(
        error,
        context,
        resolverName,
        errorCode
      );
    } catch (createError) {
      // Fallback for critical error info creation failures
      errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        resolverName: resolverName || 'unknown',
        category: ErrorCategories.UNKNOWN,
        code: ErrorCodes.UNKNOWN_ERROR,
        timestamp: new Date().toISOString(),
        sanitizedContext: { error: 'Context sanitization failed' },
        originalError: createError.stack,
      };
    }

    try {
      // Buffer the error for analysis
      this.#bufferError(errorInfo);
    } catch (bufferError) {
      // Continue even if buffering fails - don't let it break error handling
      if (this.#isDevelopment) {
        this.#logger.warn('Error buffering failed:', bufferError.message);
      }
    }

    try {
      // Log based on environment
      if (this.#isDevelopment) {
        this.#logDetailedError(errorInfo);
      } else {
        this.#logProductionError(errorInfo);
      }
    } catch (logError) {
      // Continue even if logging fails - don't let it break error handling
      // Use console as fallback if logger fails
      try {
        // eslint-disable-next-line no-console
        console.error(
          `[ScopeDSL:${errorInfo.resolverName}] Logging failed:`,
          logError.message
        );
      } catch {
        // Even console failed, but we still need to throw the original error
      }
    }

    // Always throw a clean ScopeDslError - this is critical path
    throw this.#createScopeDslError(errorInfo);
  }

  /**
   * Get the current error buffer for analysis
   *
   * @returns {Array} Copy of the current error buffer
   */
  getErrorBuffer() {
    return [...this.#errorBuffer];
  }

  /**
   * Clear the error buffer
   */
  clearErrorBuffer() {
    this.#errorBuffer = [];
    this.#bufferIndex = 0;
  }

  /**
   * Create standardized error information object
   *
   * @param {Error|string} error - Original error or message
   * @param {object} context - Resolution context
   * @param {string} resolverName - Name of the resolver
   * @param {string} [errorCode] - Optional error code
   * @returns {object} Standardized error information
   * @private
   */
  #createErrorInfo(error, context, resolverName, errorCode) {
    const message = error instanceof Error ? error.message : String(error);
    const timestamp = new Date().toISOString();
    const category = this.#categorizeError(message, context);
    const sanitizedContext = this.#sanitizeContext(context);

    return {
      message,
      resolverName,
      category,
      code: errorCode || this.#generateErrorCode(category),
      timestamp,
      sanitizedContext,
      originalError:
        error instanceof Error && this.#isDevelopment ? error.stack : null,
    };
  }

  /**
   * Add error to the circular buffer
   *
   * @param {object} errorInfo - Error information to buffer
   * @private
   */
  #bufferError(errorInfo) {
    try {
      // Use circular buffer to avoid expensive shift operations
      if (this.#errorBuffer.length < this.#maxBufferSize) {
        // Buffer not full yet, simple push
        this.#errorBuffer.push(errorInfo);
      } else {
        // Buffer is full, overwrite oldest entry
        this.#errorBuffer[this.#bufferIndex] = errorInfo;
        this.#bufferIndex = (this.#bufferIndex + 1) % this.#maxBufferSize;
      }
    } catch (error) {
      // If buffer operations fail, reset buffer to prevent corruption
      this.#errorBuffer = [];
      this.#bufferIndex = 0;
      // Re-throw to let caller handle gracefully
      throw new Error(`Buffer operation failed: ${error.message}`);
    }
  }

  /**
   * Log detailed error information for development environment
   *
   * @param {object} errorInfo - Error information to log
   * @private
   */
  #logDetailedError(errorInfo) {
    this.#logger.error(
      `[ScopeDSL:${errorInfo.resolverName}] ${errorInfo.message}`,
      {
        code: errorInfo.code,
        category: errorInfo.category,
        context: errorInfo.sanitizedContext,
        timestamp: errorInfo.timestamp,
        stack: errorInfo.originalError,
      }
    );
  }

  /**
   * Log minimal error information for production environment
   *
   * @param {object} errorInfo - Error information to log
   * @private
   */
  #logProductionError(errorInfo) {
    this.#logger.error(
      `[ScopeDSL:${errorInfo.resolverName}] ${errorInfo.code}: ${errorInfo.message}`
    );
  }

  /**
   * Categorize error based on message patterns and context
   *
   * @param {string} message - Error message
   * @param {object} context - Resolution context
   * @returns {string} Error category
   * @private
   */
  #categorizeError(message, context) {
    // Use cached toLowerCase result for performance
    let lowerMessage = this.#categoryCache.get(message);
    if (lowerMessage === undefined) {
      lowerMessage = message.toLowerCase();
      // Limit cache size to prevent memory leaks
      if (this.#categoryCache.size >= 100) {
        this.#categoryCache.clear();
      }
      this.#categoryCache.set(message, lowerMessage);
    }

    // Context-related errors (check context first)
    if (
      lowerMessage.includes('missing') ||
      lowerMessage.includes('undefined') ||
      lowerMessage.includes('null')
    ) {
      if (!context || Object.keys(context).length === 0) {
        return ErrorCategories.MISSING_CONTEXT;
      }
    }

    // Cycle detection errors
    if (lowerMessage.includes('cycle') || lowerMessage.includes('circular')) {
      return ErrorCategories.CYCLE_DETECTED;
    }

    // Depth limit errors
    if (
      lowerMessage.includes('depth') ||
      lowerMessage.includes('limit') ||
      lowerMessage.includes('exceed')
    ) {
      return ErrorCategories.DEPTH_EXCEEDED;
    }

    // Configuration errors (check before parse errors since both might contain "invalid")
    if (
      lowerMessage.includes('config') ||
      lowerMessage.includes('setting') ||
      lowerMessage.includes('option')
    ) {
      return ErrorCategories.CONFIGURATION;
    }

    // Data validation errors (check specific data patterns before general "invalid")
    if (
      lowerMessage.includes('data format') ||
      lowerMessage.includes('malformed') ||
      lowerMessage.includes('corrupt')
    ) {
      return ErrorCategories.INVALID_DATA;
    }

    // Parse errors (check after data validation to avoid overlap)
    if (lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
      return ErrorCategories.PARSE_ERROR;
    }

    // Resolution failures
    if (
      lowerMessage.includes('resolve') ||
      lowerMessage.includes('find') ||
      lowerMessage.includes('not found') ||
      lowerMessage.includes('resolution failed')
    ) {
      return ErrorCategories.RESOLUTION_FAILURE;
    }

    // General invalid cases (after specific checks)
    if (lowerMessage.includes('invalid')) {
      return ErrorCategories.INVALID_DATA;
    }

    return ErrorCategories.UNKNOWN;
  }

  /**
   * Generate error code based on category
   *
   * @param {string} category - Error category
   * @returns {string} Generated error code
   * @private
   */
  #generateErrorCode(category) {
    const codeMap = {
      [ErrorCategories.MISSING_CONTEXT]: ErrorCodes.MISSING_CONTEXT_GENERIC,
      [ErrorCategories.INVALID_DATA]: ErrorCodes.INVALID_DATA_GENERIC,
      [ErrorCategories.RESOLUTION_FAILURE]:
        ErrorCodes.RESOLUTION_FAILED_GENERIC,
      [ErrorCategories.CYCLE_DETECTED]: ErrorCodes.CYCLE_DETECTED,
      [ErrorCategories.DEPTH_EXCEEDED]: ErrorCodes.MAX_DEPTH_EXCEEDED,
      [ErrorCategories.PARSE_ERROR]: ErrorCodes.PARSE_ERROR_GENERIC,
      [ErrorCategories.CONFIGURATION]: ErrorCodes.CONFIGURATION_GENERIC,
      [ErrorCategories.UNKNOWN]: ErrorCodes.UNKNOWN_GENERIC,
    };

    return codeMap[category] || ErrorCodes.UNKNOWN_ERROR;
  }

  /**
   * Sanitize context object to prevent circular references
   *
   * @param {object} context - Original context
   * @returns {object} Sanitized context safe for serialization
   * @private
   */
  #sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    // Quick check for simple objects to avoid expensive sanitization
    if (this.#isSimpleObject(context)) {
      return { ...context };
    }

    try {
      // Reuse WeakSet for better performance (clear it for each sanitization)
      this.#sanitizationWeakSet = new WeakSet();
      const seen = this.#sanitizationWeakSet;

      const sanitize = (obj, depth = 0) => {
        try {
          // Prevent infinite recursion and excessive depth
          if (depth > 3) {
            return '[Max Depth Exceeded]';
          }

          // Check for circular references
          if (obj && typeof obj === 'object' && seen.has(obj)) {
            return '[Circular Reference]';
          }

          if (obj === null || obj === undefined) {
            return obj;
          }

          if (typeof obj !== 'object') {
            return obj;
          }

          // Add to seen set only for objects
          seen.add(obj);

          if (Array.isArray(obj)) {
            // Limit array size to prevent memory issues
            return obj.slice(0, 5).map((item, index) => {
              try {
                return sanitize(item, depth + 1);
              } catch {
                return `[Array Item ${index} Error]`;
              }
            });
          }

          const result = {};
          const keys = Object.keys(obj).slice(0, 10); // Limit keys to prevent memory issues

          for (const key of keys) {
            try {
              // Skip functions and complex objects that might cause issues
              if (typeof obj[key] === 'function') {
                result[key] = '[Function]';
              } else if (obj[key] instanceof Error) {
                result[key] = obj[key].message;
              } else if (
                obj[key] &&
                typeof obj[key] === 'object' &&
                obj[key].constructor &&
                obj[key].constructor.name !== 'Object' &&
                obj[key].constructor.name !== 'Array'
              ) {
                // Complex objects like DOM nodes, etc.
                result[key] = `[${obj[key].constructor.name}]`;
              } else {
                result[key] = sanitize(obj[key], depth + 1);
              }
            } catch (sanitizeError) {
              result[key] = `[Sanitization Error: ${sanitizeError.message}]`;
            }
          }

          return result;
        } catch (innerError) {
          return `[Inner Sanitization Error: ${innerError.message}]`;
        }
      };

      return sanitize(context);
    } catch (outerError) {
      // Ultimate fallback if all sanitization fails
      return {
        error: 'Context sanitization completely failed',
        reason: outerError.message,
        type: typeof context,
        hasKeys:
          context && typeof context === 'object'
            ? Object.keys(context).length > 0
            : false,
      };
    }
  }

  /**
   * Check if an object is simple enough to avoid deep sanitization
   *
   * @param {object} obj - Object to check
   * @returns {boolean} True if object is simple
   * @private
   */
  #isSimpleObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return false;
    }

    // Fast checks first to bail early
    if (obj.constructor !== Object) {
      return false; // Not a plain object
    }

    const keys = Object.keys(obj);
    if (keys.length > 5) {
      return false; // Too many keys, might be complex
    }

    // Check if all values are primitive types (optimized loop)
    for (let i = 0; i < keys.length; i++) {
      try {
        const value = obj[keys[i]];
        const valueType = typeof value;
        if (valueType === 'object' && value !== null) {
          return false; // Contains nested objects
        }
        if (valueType === 'function') {
          return false; // Contains functions
        }
      } catch {
        // If we can't access the property safely, it's not simple
        return false;
      }
    }

    return true;
  }

  /**
   * Create a ScopeDslError from error information
   *
   * @param {object} errorInfo - Standardized error information
   * @returns {ScopeDslError} New ScopeDslError instance
   * @private
   */
  #createScopeDslError(errorInfo) {
    const formattedMessage = `[${errorInfo.code}] ${errorInfo.message}`;
    return new ScopeDslError(formattedMessage);
  }
}

export default ScopeDslErrorHandler;
export { ErrorCategories };
