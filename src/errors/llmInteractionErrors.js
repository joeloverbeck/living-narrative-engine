/**
 * @file Defines custom error classes for LLM API interaction failures.
 */

/**
 * Base error for failures during interaction with a Large Language Model service.
 *
 * @class LLMInteractionError
 * @augments Error
 * @description Base error for failures during interaction with a Large Language Model service.
 */
export class LLMInteractionError extends Error {
  /**
   * Creates a new LLMInteractionError instance.
   *
   * @param {string} message - The error message.
   * @param {object} [details] - Optional contextual details.
   * @param {number} [details.status] - HTTP status code associated with the failure.
   * @param {string} [details.llmId] - Identifier of the LLM involved.
   * @param {any} [details.responseBody] - Parsed response body from the LLM provider.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'LLMInteractionError';
    this.status = details.status;
    this.llmId = details.llmId;
    this.responseBody = details.responseBody;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMInteractionError);
    }
  }
}

/**
 * @class ApiKeyError
 * @augments LLMInteractionError
 * @description Error representing invalid or missing API key issues.
 */
export class ApiKeyError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ApiKeyError';
  }
}

/**
 * @class InsufficientCreditsError
 * @augments LLMInteractionError
 * @description Error indicating the account lacks sufficient credits.
 */
export class InsufficientCreditsError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * @class ContentPolicyError
 * @augments LLMInteractionError
 * @description Error thrown when the request violates content policy.
 */
export class ContentPolicyError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ContentPolicyError';
  }
}

/**
 * @class PermissionError
 * @augments LLMInteractionError
 * @description Error representing a permission or authentication failure that is not content policy related.
 */
export class PermissionError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'PermissionError';
  }
}

/**
 * @class BadRequestError
 * @augments LLMInteractionError
 * @description Error representing a malformed or invalid request body.
 */
export class BadRequestError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'BadRequestError';
  }
}

/**
 * @class MalformedResponseError
 * @augments LLMInteractionError
 * @description Error thrown when the LLM returns malformed or unparsable JSON.
 */
export class MalformedResponseError extends LLMInteractionError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'MalformedResponseError';
  }
}
