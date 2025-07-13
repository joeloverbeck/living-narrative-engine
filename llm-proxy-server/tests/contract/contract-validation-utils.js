/**
 * @file contract-validation-utils.js
 * @description Utilities for JSON schema validation and contract compliance testing
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contract validation utility class for LLM Proxy Server API
 */
export class ContractValidator {
  #ajv;
  #requestSchemaValidator;
  #errorResponseSchemaValidator;

  /**
   *
   */
  constructor() {
    // Initialize AJV with strict mode and formats
    this.#ajv = new Ajv({
      strict: true,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      removeAdditional: false, // Don't remove additional properties for validation
    });

    // Add format validators
    addFormats(this.#ajv);

    // Load and compile schemas
    this.#loadSchemas();
  }

  /**
   * Load and compile JSON schemas
   * @private
   */
  #loadSchemas() {
    try {
      // Load request schema
      const requestSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'request-schema.json'
      );
      const requestSchema = JSON.parse(readFileSync(requestSchemaPath, 'utf8'));
      this.#requestSchemaValidator = this.#ajv.compile(requestSchema);

      // Load error response schema
      const errorResponseSchemaPath = join(
        process.cwd(),
        'tests',
        'contract',
        'schemas',
        'error-response-schema.json'
      );
      const errorResponseSchema = JSON.parse(
        readFileSync(errorResponseSchemaPath, 'utf8')
      );
      this.#errorResponseSchemaValidator =
        this.#ajv.compile(errorResponseSchema);
    } catch (error) {
      throw new Error(`Failed to load contract schemas: ${error.message}`);
    }
  }

  /**
   * Validate a request against the contract schema
   * @param {object} request - The request object to validate
   * @returns {object} Validation result with isValid and errors
   */
  validateRequest(request) {
    const isValid = this.#requestSchemaValidator(request);
    return {
      isValid,
      errors: this.#requestSchemaValidator.errors || [],
      formattedErrors: this.#formatErrors(
        this.#requestSchemaValidator.errors || []
      ),
    };
  }

  /**
   * Validate an error response against the contract schema
   * @param {object} errorResponse - The error response object to validate
   * @returns {object} Validation result with isValid and errors
   */
  validateErrorResponse(errorResponse) {
    const isValid = this.#errorResponseSchemaValidator(errorResponse);
    return {
      isValid,
      errors: this.#errorResponseSchemaValidator.errors || [],
      formattedErrors: this.#formatErrors(
        this.#errorResponseSchemaValidator.errors || []
      ),
    };
  }

  /**
   * Format AJV errors into human-readable messages
   * @param {Array} errors - AJV error array
   * @returns {Array} Formatted error messages
   * @private
   */
  #formatErrors(errors) {
    return errors.map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message;
      const value = error.data;

      let formattedMessage = `${path}: ${message}`;

      if (error.keyword === 'required') {
        formattedMessage = `Missing required property: ${error.params.missingProperty}`;
      } else if (error.keyword === 'enum') {
        formattedMessage = `${path}: must be one of [${error.params.allowedValues.join(', ')}], got: ${value}`;
      } else if (error.keyword === 'type') {
        formattedMessage = `${path}: must be ${error.params.type}, got: ${typeof value}`;
      } else if (error.keyword === 'additionalProperties') {
        formattedMessage = `${path}: additional property '${error.params.additionalProperty}' is not allowed`;
      } else if (value !== undefined) {
        formattedMessage += ` (received: ${JSON.stringify(value)})`;
      }

      return {
        path,
        keyword: error.keyword,
        message: formattedMessage,
        value,
        params: error.params,
      };
    });
  }

  /**
   * Assert that a request is valid according to the contract
   * @param {object} request - The request to validate
   * @param {string} testContext - Context for error messages
   * @throws {Error} If validation fails
   */
  assertValidRequest(request, testContext = 'Request validation') {
    const result = this.validateRequest(request);
    if (!result.isValid) {
      const errorDetails = result.formattedErrors
        .map((e) => e.message)
        .join('\n  ');
      throw new Error(`${testContext} failed:\n  ${errorDetails}`);
    }
  }

  /**
   * Assert that an error response is valid according to the contract
   * @param {object} errorResponse - The error response to validate
   * @param {string} testContext - Context for error messages
   * @throws {Error} If validation fails
   */
  assertValidErrorResponse(
    errorResponse,
    testContext = 'Error response validation'
  ) {
    const result = this.validateErrorResponse(errorResponse);
    if (!result.isValid) {
      const errorDetails = result.formattedErrors
        .map((e) => e.message)
        .join('\n  ');
      throw new Error(`${testContext} failed:\n  ${errorDetails}`);
    }
  }

  /**
   * Validate that HTTP status code matches contract expectations
   * @param {number} statusCode - The HTTP status code
   * @param {string} stage - The error stage
   * @returns {object} Validation result
   */
  validateStatusCodeForStage(statusCode, stage) {
    const expectedStatusCodes = {
      request_validation: [400],
      request_validation_llmid_missing: [400],
      request_validation_payload_missing: [400],
      llm_config_lookup_error: [400, 404],
      llm_config_lookup_failed: [400, 404],
      api_key_retrieval_error: [500, 401, 403],
      llm_endpoint_resolution_error: [500],
      llm_forwarding_error_network: [502],
      llm_forwarding_error_http_client: [400, 401, 403, 404, 429],
      llm_forwarding_error_http_server: [502, 503],
      internal_proxy_error: [500],
      internal_api_key_service_state_error: [500],
      internal_llm_service_exception: [500],
      initialization_failure: [503],
      initialization_failure_unknown: [503],
    };

    const expected = expectedStatusCodes[stage];
    const isValid = expected ? expected.includes(statusCode) : true; // Allow any code for unknown stages

    return {
      isValid,
      expected,
      actual: statusCode,
      message: isValid
        ? `Status code ${statusCode} is valid for stage '${stage}'`
        : `Status code ${statusCode} is not valid for stage '${stage}'. Expected one of: [${expected?.join(', ') || 'any'}]`,
    };
  }

  /**
   * Get all valid stage enum values from the schema
   * @returns {Array} Array of valid stage values
   */
  getValidStages() {
    return [
      'request_validation',
      'request_validation_llmid_missing',
      'request_validation_payload_missing',
      'llm_config_lookup_error',
      'llm_config_lookup_failed',
      'api_key_retrieval_error',
      'llm_endpoint_resolution_error',
      'llm_forwarding_error_network',
      'llm_forwarding_error_http_client',
      'llm_forwarding_error_http_server',
      'internal_proxy_error',
      'internal_api_key_service_state_error',
      'internal_llm_service_exception',
      'initialization_failure',
      'initialization_failure_unknown',
    ];
  }

  /**
   * Validate security requirements for responses
   * @param {object} response - The response object to check
   * @returns {object} Security validation result
   */
  validateSecurityRequirements(response) {
    const issues = [];
    const responseStr = JSON.stringify(response).toLowerCase();

    // Check for API key exposure
    const apiKeyPatterns = [
      /sk-[a-zA-Z0-9]{20,}/i, // OpenAI style (reduced minimum length)
      /sk-ant-[a-zA-Z0-9-]+/i, // Anthropic style
      /\bapikey\b/i, // Generic API key references (compound word)
      /bearer\s+[a-zA-Z0-9-_=.]{15,}/i, // Bearer tokens (reduced min length)
      /\bauthorization\b/i, // Authorization headers (word boundary)
    ];

    apiKeyPatterns.forEach((pattern) => {
      if (pattern.test(responseStr)) {
        issues.push({
          type: 'api_key_exposure',
          pattern: pattern.toString(),
          description: `Potential API key or authorization token detected in response`,
        });
      }
    });

    // Check for sensitive configuration exposure
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /private[_-]?key/i,
      /\.env/i,
      /config[_-]?file/i,
    ];

    sensitivePatterns.forEach((pattern) => {
      if (pattern.test(responseStr)) {
        issues.push({
          type: 'sensitive_data_exposure',
          pattern: pattern.toString(),
          description: `Potential sensitive configuration data detected in response`,
        });
      }
    });

    return {
      isSecure: issues.length === 0,
      issues,
      summary:
        issues.length === 0
          ? 'No security issues detected'
          : `${issues.length} potential security issue(s) detected`,
    };
  }

  /**
   * Get schema information for debugging
   * @returns {object} Schema information
   */
  getSchemaInfo() {
    return {
      requestSchema: {
        id: this.#requestSchemaValidator.schema.$id,
        title: this.#requestSchemaValidator.schema.title,
        required: this.#requestSchemaValidator.schema.required,
      },
      errorResponseSchema: {
        id: this.#errorResponseSchemaValidator.schema.$id,
        title: this.#errorResponseSchemaValidator.schema.title,
        required: this.#errorResponseSchemaValidator.schema.required,
        stageEnum:
          this.#errorResponseSchemaValidator.schema.properties.stage.enum,
      },
    };
  }
}

/**
 * Create a shared contract validator instance
 */
export const contractValidator = new ContractValidator();

/**
 * Jest custom matchers for contract validation
 */
export const contractMatchers = {
  /**
   * Custom matcher to validate request contracts
   * @param {object} received - The object to validate
   * @returns {object} Jest matcher result
   */
  toMatchRequestContract(received) {
    const result = contractValidator.validateRequest(received);

    return {
      pass: result.isValid,
      message: () =>
        result.isValid
          ? `Expected request not to match contract schema`
          : `Expected request to match contract schema:\n${result.formattedErrors.map((e) => `  ${e.message}`).join('\n')}`,
    };
  },

  /**
   * Custom matcher to validate error response contracts
   * @param {object} received - The response object to validate
   * @returns {object} Jest matcher result
   */
  toMatchErrorResponseContract(received) {
    const result = contractValidator.validateErrorResponse(received);

    return {
      pass: result.isValid,
      message: () =>
        result.isValid
          ? `Expected error response not to match contract schema`
          : `Expected error response to match contract schema:\n${result.formattedErrors.map((e) => `  ${e.message}`).join('\n')}`,
    };
  },

  /**
   * Custom matcher to validate security requirements
   * @param {object} received - The response object to validate
   * @returns {object} Jest matcher result
   */
  toMeetSecurityRequirements(received) {
    const result = contractValidator.validateSecurityRequirements(received);

    return {
      pass: result.isSecure,
      message: () =>
        result.isSecure
          ? `Expected response not to meet security requirements`
          : `Expected response to meet security requirements:\n${result.issues.map((i) => `  ${i.description}`).join('\n')}`,
    };
  },
};
