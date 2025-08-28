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
    this.#isDevelopment = config.isDevelopment ?? (typeof globalThis.process !== 'undefined' && globalThis.process.env?.NODE_ENV !== 'production');
    this.#errorBuffer = [];
    this.#maxBufferSize = config.maxBufferSize ?? 100;
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
    // Create standardized error information
    const errorInfo = this.#createErrorInfo(error, context, resolverName, errorCode);

    // Buffer the error for analysis
    this.#bufferError(errorInfo);

    // Log based on environment
    if (this.#isDevelopment) {
      this.#logDetailedError(errorInfo);
    } else {
      this.#logProductionError(errorInfo);
    }

    // Always throw a clean ScopeDslError
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
      originalError: error instanceof Error ? error.stack : null,
    };
  }

  /**
   * Add error to the circular buffer
   * 
   * @param {object} errorInfo - Error information to buffer
   * @private
   */
  #bufferError(errorInfo) {
    this.#errorBuffer.push(errorInfo);

    // Maintain buffer size limit
    if (this.#errorBuffer.length > this.#maxBufferSize) {
      this.#errorBuffer.shift();
    }
  }

  /**
   * Log detailed error information for development environment
   * 
   * @param {object} errorInfo - Error information to log
   * @private
   */
  #logDetailedError(errorInfo) {
    this.#logger.error(`[ScopeDSL:${errorInfo.resolverName}] ${errorInfo.message}`, {
      code: errorInfo.code,
      category: errorInfo.category,
      context: errorInfo.sanitizedContext,
      timestamp: errorInfo.timestamp,
      stack: errorInfo.originalError,
    });
  }

  /**
   * Log minimal error information for production environment
   * 
   * @param {object} errorInfo - Error information to log
   * @private
   */
  #logProductionError(errorInfo) {
    this.#logger.error(`[ScopeDSL:${errorInfo.resolverName}] ${errorInfo.code}: ${errorInfo.message}`);
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
    const lowerMessage = message.toLowerCase();

    // Context-related errors (check context first)
    if (lowerMessage.includes('missing') || lowerMessage.includes('undefined') || lowerMessage.includes('null')) {
      if (!context || Object.keys(context).length === 0) {
        return ErrorCategories.MISSING_CONTEXT;
      }
    }

    // Cycle detection errors
    if (lowerMessage.includes('cycle') || lowerMessage.includes('circular')) {
      return ErrorCategories.CYCLE_DETECTED;
    }

    // Depth limit errors
    if (lowerMessage.includes('depth') || lowerMessage.includes('limit') || lowerMessage.includes('exceed')) {
      return ErrorCategories.DEPTH_EXCEEDED;
    }

    // Configuration errors (check before parse errors since both might contain "invalid")
    if (lowerMessage.includes('config') || lowerMessage.includes('setting') || lowerMessage.includes('option')) {
      return ErrorCategories.CONFIGURATION;
    }

    // Data validation errors (check specific data patterns before general "invalid")
    if (lowerMessage.includes('data format') || lowerMessage.includes('malformed') || lowerMessage.includes('corrupt')) {
      return ErrorCategories.INVALID_DATA;
    }

    // Parse errors (check after data validation to avoid overlap)
    if (lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
      return ErrorCategories.PARSE_ERROR;
    }

    // Resolution failures
    if (lowerMessage.includes('resolve') || lowerMessage.includes('find') || lowerMessage.includes('not found') || lowerMessage.includes('resolution failed')) {
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
      [ErrorCategories.RESOLUTION_FAILURE]: ErrorCodes.RESOLUTION_FAILED_GENERIC,
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

    const seen = new WeakSet();
    
    const sanitize = (obj, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 3 || seen.has(obj)) {
        return '[Circular Reference]';
      }
      
      if (obj === null || obj === undefined) {
        return obj;
      }
      
      if (typeof obj !== 'object') {
        return obj;
      }

      seen.add(obj);

      if (Array.isArray(obj)) {
        return obj.slice(0, 5).map(item => sanitize(item, depth + 1));
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
          } else {
            result[key] = sanitize(obj[key], depth + 1);
          }
        } catch {
          result[key] = '[Sanitization Error]';
        }
      }

      return result;
    };

    return sanitize(context);
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