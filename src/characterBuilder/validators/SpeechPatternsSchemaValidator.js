/**
 * @file Schema validation utilities for speech patterns generation
 *
 * Provides schema-based validation for speech patterns operations:
 * - JSON schema validation using AjvSchemaValidator
 * - Data sanitization and security measures
 * - Simple, schema-driven validation approach
 * @see ../services/SpeechPatternsResponseProcessor.js
 * @see ../services/SpeechPatternsGenerator.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator
 */

/**
 * Schema validation service for speech patterns generation
 * Relies on JSON schema for validation rules
 */
export class SpeechPatternsSchemaValidator {
  /** @private @type {AjvSchemaValidator} */
  #schemaValidator;

  /** @private @type {ILogger} */
  #logger;

  /** @private @type {string} */
  #schemaId =
    'schema://living-narrative-engine/speech-patterns-response.schema.json';

  /**
   * Creates a new SpeechPatternsSchemaValidator
   *
   * @param {object} dependencies - Required dependencies
   * @param {ILogger} dependencies.logger - Logger for debugging and error reporting
   * @param {AjvSchemaValidator} dependencies.schemaValidator - AJV schema validator instance
   */
  constructor({ logger, schemaValidator }) {
    assertPresent(logger, 'Logger is required');
    assertPresent(schemaValidator, 'Schema validator is required');

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });

    if (schemaValidator && typeof schemaValidator === 'object') {
      validateDependency(schemaValidator, 'AjvSchemaValidator', logger, {
        requiredMethods: ['validate', 'isSchemaLoaded'],
      });
    }

    this.#logger = logger;
    this.#schemaValidator = schemaValidator;
  }

  /**
   * Validates speech patterns response against the JSON schema
   *
   * @param {object} response - Response to validate
   * @returns {Promise<{isValid: boolean, errors: string[], warnings: string[]}>}
   */
  async validateResponse(response) {
    try {
      // Check if schema is loaded
      if (!this.#schemaValidator.isSchemaLoaded(this.#schemaId)) {
        this.#logger.warn(
          `Schema '${this.#schemaId}' not loaded, validation will be limited`
        );
        // Return valid if schema isn't loaded - trust the structure
        return {
          isValid: true,
          errors: [],
          warnings: ['Schema validation unavailable'],
        };
      }

      // Validate against schema
      const validationResult = this.#schemaValidator.validate(
        this.#schemaId,
        response
      );

      if (validationResult.isValid) {
        this.#logger.debug('Response passed schema validation');
        return { isValid: true, errors: [], warnings: [] };
      }

      // Format schema validation errors for readability
      const errors = this.#formatSchemaErrors(validationResult.errors);

      this.#logger.debug('Schema validation failed', { errors });
      return { isValid: false, errors, warnings: [] };
    } catch (error) {
      this.#logger.error('Validation error', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Validates and sanitizes speech patterns response
   * Performs validation and returns sanitized data
   *
   * @param {object} response - Response to validate and sanitize
   * @returns {Promise<{isValid: boolean, errors: string[], sanitizedResponse: object | null}>}
   */
  async validateAndSanitizeResponse(response) {
    try {
      // Sanitize the response
      const sanitizedResponse = this.#sanitizeResponse(response);

      // Validate the sanitized response
      const validationResult = await this.validateResponse(sanitizedResponse);

      return {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        sanitizedResponse: validationResult.isValid ? sanitizedResponse : null,
      };
    } catch (error) {
      this.#logger.error('Error during validation and sanitization', error);
      return {
        isValid: false,
        errors: [`Processing error: ${error.message}`],
        sanitizedResponse: null,
      };
    }
  }

  /**
   * Validates individual speech pattern
   *
   * @param {object} pattern - Pattern to validate
   * @returns {Promise<{isValid: boolean, errors: string[]}>}
   */
  async validatePattern(pattern) {
    // Create a minimal response wrapper for schema validation
    const wrappedResponse = {
      characterName: 'Test',
      speechPatterns: [pattern],
    };

    const result = await this.validateResponse(wrappedResponse);

    // Filter errors to only pattern-related ones
    const patternErrors = result.errors.filter(
      (err) => err.includes('speechPatterns') || err.includes('Pattern')
    );

    return {
      isValid: patternErrors.length === 0,
      errors: patternErrors,
    };
  }

  /**
   * Sanitizes input to prevent XSS and injection attacks
   *
   * @param {*} input - Input to sanitize
   * @returns {*} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove dangerous patterns
    let sanitized = input
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove iframe tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove data: URLs for safety
      .replace(/data:[^"'\s]*/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript:/gi, '')
      // Remove all HTML tags but preserve content
      .replace(/<[^>]*>/gi, '');

    // Clean up any excessive whitespace left by removals
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Gets information about the validation schema
   *
   * @returns {object} Schema information
   */
  getSchemaInfo() {
    return {
      schemaId: this.#schemaId,
      version: '1.0.0',
      description: 'Speech Patterns Response Validation Schema',
    };
  }

  /**
   * Sanitizes the entire response object
   *
   * @private
   * @param {object} response - Response to sanitize
   * @returns {object} Sanitized response
   */
  #sanitizeResponse(response) {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = {
      ...response,
      characterName: this.sanitizeInput(response.characterName),
    };

    if (Array.isArray(response.speechPatterns)) {
      sanitized.speechPatterns = response.speechPatterns.map((pattern) => {
        const sanitizedPattern = {
          type: this.sanitizeInput(pattern.type),
        };

        // Handle contexts array (optional)
        if (Array.isArray(pattern.contexts)) {
          sanitizedPattern.contexts = pattern.contexts.map((ctx) =>
            this.sanitizeInput(ctx)
          );
        }

        // Handle examples array (required)
        if (Array.isArray(pattern.examples)) {
          sanitizedPattern.examples = pattern.examples.map((ex) =>
            this.sanitizeInput(ex)
          );
        }

        return sanitizedPattern;
      });
    }

    if (response.generatedAt) {
      sanitized.generatedAt = this.sanitizeInput(response.generatedAt);
    }

    return sanitized;
  }

  /**
   * Format schema validation errors for user display
   *
   * @private
   * @param {Array} errors - Raw schema validation errors
   * @returns {string[]} Formatted error messages
   */
  #formatSchemaErrors(errors) {
    if (!Array.isArray(errors)) {
      return ['Invalid response format'];
    }

    return errors.map((error) => {
      // Handle different error formats from AJV
      if (typeof error === 'string') {
        return error;
      }

      if (error.message || error.keyword) {
        const path = error.instancePath || error.dataPath || '';
        const keyword = error.keyword || error.message || '';

        // Create user-friendly error messages
        if (
          (keyword === 'minItems' || error.message === 'minItems') &&
          path.includes('speechPatterns')
        ) {
          return `Not enough speech patterns generated (minimum 3 required)`;
        }
        if (
          (keyword === 'maxItems' || error.message === 'maxItems') &&
          path.includes('speechPatterns')
        ) {
          return `Too many speech patterns generated (maximum 30 allowed)`;
        }
        if (keyword === 'required' || error.message === 'required') {
          return `Missing required field: ${error.params?.missingProperty || 'unknown'}`;
        }
        if (
          keyword === 'minLength' ||
          keyword === 'maxLength' ||
          error.message === 'minLength' ||
          error.message === 'maxLength'
        ) {
          const fieldName = path.split('/').pop() || 'field';
          const msg =
            error.message === 'minLength' || error.message === 'maxLength'
              ? `${error.message}`
              : error.message;
          return `${fieldName} length invalid: ${msg}`;
        }

        // Default formatting - handle both keyword and message as the error type
        const errorType = error.keyword || error.message || 'Unknown error';
        return path ? `${path}: ${errorType}` : errorType;
      }

      return 'Unknown validation error';
    });
  }
}

export default SpeechPatternsSchemaValidator;
