/**
 * @file LLM error mapping service implementation
 * @see src/llms/services/llmErrorMapper.js
 */

import { ILLMErrorMapper } from '../interfaces/ILLMErrorMapper.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  LLMInteractionError,
  ApiKeyError,
  InsufficientCreditsError,
  ContentPolicyError,
  PermissionError,
  BadRequestError,
  MalformedResponseError,
} from '../../errors/llmInteractionErrors.js';
import { ConfigurationError } from '../../errors/configurationError.js';
import PromptTooLongError from '../../errors/promptTooLongError.js';
import { LLMStrategyError } from '../errors/LLMStrategyError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ILLMErrorMapper.js').ErrorContext} ErrorContext
 * @typedef {import('../interfaces/ILLMErrorMapper.js').DomainErrorType} DomainErrorType
 */

/**
 * @class LLMErrorMapper
 * @implements {ILLMErrorMapper}
 * @description Maps errors from various sources to domain-specific errors
 */
export class LLMErrorMapper extends ILLMErrorMapper {
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    super();
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = logger;
    this.#logger.debug('LLMErrorMapper: Instance created.');
  }

  /**
   * @param {Error} error
   * @param {ErrorContext} [context]
   * @returns {Error}
   */
  mapHttpError(error, context = {}) {
    const { llmId = 'unknown', status, responseBody } = context;

    // If it's already a domain error, return as-is
    if (this.#isDomainError(error)) {
      return error;
    }

    // Handle HTTP status-based errors
    if (status || error.status) {
      const errorStatus = status || error.status;
      const errorBody = responseBody || error.responseBody || error.body;
      const errorType = this.getErrorTypeFromStatus(errorStatus, errorBody);

      return this.createDomainError(
        errorType,
        error.message || `HTTP ${errorStatus} error`,
        {
          ...context,
          status: errorStatus,
          responseBody: errorBody,
          originalError: error,
        }
      );
    }

    // Handle network errors
    if (
      error.name === 'NetworkError' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    ) {
      return new LLMInteractionError(
        error.message || 'Network error occurred',
        {
          llmId,
          originalError: error,
          ...context,
        }
      );
    }

    // Handle JSON processing errors
    if (error.name === 'JsonProcessingError') {
      return new MalformedResponseError(
        error.message || 'Failed to process JSON response',
        {
          llmId,
          originalError: error,
          ...context,
        }
      );
    }

    // Default to generic LLM interaction error
    return new LLMInteractionError(error.message || 'Unknown error occurred', {
      llmId,
      originalError: error,
      ...context,
    });
  }

  /**
   * @param {DomainErrorType} type
   * @param {string} message
   * @param {ErrorContext} [context]
   * @returns {Error}
   */
  createDomainError(type, message, context = {}) {
    const { llmId = 'unknown', status, responseBody, originalError } = context;

    switch (type) {
      case 'api_key':
        return new ApiKeyError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });

      case 'insufficient_credits':
        return new InsufficientCreditsError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });

      case 'content_policy':
        return new ContentPolicyError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });

      case 'permission':
        return new PermissionError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });

      case 'bad_request':
        return new BadRequestError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });

      case 'malformed_response':
        return new MalformedResponseError(message, {
          llmId,
          originalError,
        });

      case 'configuration':
        return new ConfigurationError(message, {
          llmId,
          problematicField: context.problematicField,
          originalError,
        });

      case 'generic':
      default:
        return new LLMInteractionError(message, {
          status,
          llmId,
          responseBody,
          originalError,
        });
    }
  }

  /**
   * @param {Error} error
   * @param {ErrorContext} context
   * @returns {void}
   */
  logError(error, context) {
    const details = this.extractErrorDetails(error, context);

    // Determine log level based on error severity
    if (this.#isCriticalError(error)) {
      this.#logger.error(details.message, details);
    } else if (this.#isWarningError(error)) {
      this.#logger.warn(details.message, details);
    } else {
      this.#logger.debug(details.message, details);
    }
  }

  /**
   * @param {number} status
   * @param {*} [responseBody]
   * @returns {DomainErrorType}
   */
  getErrorTypeFromStatus(status, responseBody) {
    switch (status) {
      case 401:
        return 'api_key';

      case 402:
        return 'insufficient_credits';

      case 403:
        // Check response body for content policy violations
        const bodyStr = JSON.stringify(responseBody || '').toLowerCase();
        if (bodyStr.includes('policy') || bodyStr.includes('content')) {
          return 'content_policy';
        }
        return 'permission';

      case 400:
        return 'bad_request';

      case 422:
        return 'bad_request';

      case 429:
        return 'generic'; // Rate limit - handled as generic for retry

      case 500:
      case 502:
      case 503:
      case 504:
        return 'generic'; // Server errors

      default:
        return 'generic';
    }
  }

  /**
   * @param {Error} error
   * @returns {boolean}
   */
  isConfigurationError(error) {
    return (
      error instanceof ConfigurationError ||
      error.name === 'ConfigurationError' ||
      error.problematicField !== undefined
    );
  }

  /**
   * @param {Error} error
   * @param {ErrorContext} [context]
   * @returns {object}
   */
  extractErrorDetails(error, context = {}) {
    const details = {
      message: error.message || 'Unknown error',
      errorName: error.name || 'Error',
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
    };

    // Add context information
    if (context.llmId) {
      details.llmId = context.llmId;
    }
    if (context.operation) {
      details.operation = context.operation;
    }

    // Add HTTP-specific details
    if (error.status || context.status) {
      details.status = error.status || context.status;
    }
    if (error.responseBody || context.responseBody) {
      details.responseBody = error.responseBody || context.responseBody;
    }

    // Add configuration error details
    if (this.isConfigurationError(error)) {
      details.isConfigurationError = true;
      if (error.problematicField || error.problematicFields) {
        details.problematicFields =
          error.problematicFields || error.problematicField;
      }
    }

    // Add stack trace for debugging (only in non-production)
    if (error.stack) {
      details.stack = error.stack;
    }

    // Add original error if wrapped
    if (error.originalError || context.originalError) {
      const originalError = error.originalError || context.originalError;
      details.originalError = {
        message: originalError.message,
        name: originalError.name,
        type: originalError.constructor.name,
      };
    }

    return details;
  }

  /**
   * @private
   * @param {Error} error
   * @returns {boolean}
   */
  #isDomainError(error) {
    return (
      error instanceof LLMInteractionError ||
      error instanceof ApiKeyError ||
      error instanceof InsufficientCreditsError ||
      error instanceof ContentPolicyError ||
      error instanceof PermissionError ||
      error instanceof BadRequestError ||
      error instanceof MalformedResponseError ||
      error instanceof ConfigurationError ||
      error instanceof PromptTooLongError ||
      error instanceof LLMStrategyError
    );
  }

  /**
   * @private
   * @param {Error} error
   * @returns {boolean}
   */
  #isCriticalError(error) {
    return (
      error instanceof ApiKeyError ||
      error instanceof ConfigurationError ||
      error instanceof PermissionError ||
      (error.status && error.status >= 500)
    );
  }

  /**
   * @private
   * @param {Error} error
   * @returns {boolean}
   */
  #isWarningError(error) {
    return (
      error instanceof InsufficientCreditsError ||
      error instanceof ContentPolicyError ||
      error instanceof BadRequestError ||
      error.status === 429
    ); // Rate limit
  }
}

export default LLMErrorMapper;
