/**
 * @file Schema validation utilities for speech patterns generation
 *
 * Provides comprehensive validation functions for speech patterns operations:
 * - LLM response validation with detailed error reporting
 * - Individual pattern validation
 * - Data sanitization and security measures
 * - Schema compliance validation using AjvSchemaValidator
 * @see ../services/SpeechPatternsResponseProcessor.js
 * @see ../services/SpeechPatternsGenerator.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';
import { SpeechPatternsGenerationError } from '../errors/SpeechPatternsGenerationError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator
 */

/**
 * Configuration for speech patterns validation
 */
const VALIDATION_CONFIG = {
  minPatterns: 3,
  maxPatterns: 30,
  minPatternLength: 5,
  maxPatternLength: 500,
  minExampleLength: 3,
  maxExampleLength: 1000,
  maxCircumstancesLength: 200,
  maxCharacterNameLength: 100,
};

/**
 * Schema validation service for speech patterns generation
 */
export class SpeechPatternsSchemaValidator {
  /** @private @type {AjvSchemaValidator} */
  #schemaValidator;

  /** @private @type {ILogger} */
  #logger;

  /** @private @type {string} */
  #schemaId =
    'schema://living-narrative-engine/speech-patterns-response.schema.json';

  constructor(dependencies) {
    validateDependency(
      dependencies.schemaValidator,
      'AjvSchemaValidator',
      null,
      {
        requiredMethods: ['validate', 'isSchemaLoaded'],
      }
    );
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#schemaValidator = dependencies.schemaValidator;
    this.#logger = dependencies.logger;
  }

  /**
   * Validate speech patterns response against schema
   *
   * @param {object} response - Response to validate
   * @returns {Promise<object>} Validation result with isValid boolean and errors array
   */
  async validateResponse(response) {
    try {
      this.#logger.debug('Validating speech patterns response', {
        patternCount: response?.speechPatterns?.length || 0,
        hasCharacterName: Boolean(response?.characterName),
      });

      // Check if schema is loaded
      if (!this.#schemaValidator.isSchemaLoaded(this.#schemaId)) {
        this.#logger.warn(
          `Schema '${this.#schemaId}' not loaded, falling back to basic validation`
        );
        return this.#basicValidation(response);
      }

      // Use schema validator
      const validationResult = this.#schemaValidator.validate(
        this.#schemaId,
        response
      );

      if (validationResult.isValid) {
        this.#logger.debug(
          'Speech patterns response schema validation successful'
        );
        return { isValid: true, errors: [] };
      } else {
        this.#logger.warn('Speech patterns response schema validation failed', {
          errors: validationResult.errors,
        });
        return {
          isValid: false,
          errors: this.#formatValidationErrors(validationResult.errors),
        };
      }
    } catch (error) {
      this.#logger.error('Schema validation error', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }

  /**
   * Validate individual speech pattern
   *
   * @param {object} pattern - Pattern to validate
   * @returns {Promise<object>} Validation result
   */
  async validatePattern(pattern) {
    try {
      // Create a minimal response structure for validation
      const testResponse = {
        characterName: 'Test Character',
        speechPatterns: [pattern],
        generatedAt: new Date().toISOString(),
      };

      const result = await this.validateResponse(testResponse);

      if (result.isValid) {
        return { isValid: true, errors: [] };
      } else {
        // Filter errors to only those related to the pattern
        const patternErrors = result.errors.filter(
          (error) =>
            error.includes('speechPatterns[0]') ||
            error.toLowerCase().includes('pattern') ||
            error.toLowerCase().includes('example')
        );

        return {
          isValid: patternErrors.length === 0 ? result.isValid : false,
          errors: patternErrors.length > 0 ? patternErrors : result.errors,
        };
      }
    } catch (error) {
      this.#logger.error('Pattern validation error', error);
      return {
        isValid: false,
        errors: [`Pattern validation error: ${error.message}`],
      };
    }
  }

  /**
   * Basic validation fallback when schema is not available
   *
   * @private
   * @param {object} response - Response to validate
   * @returns {object} Validation result
   */
  #basicValidation(response) {
    const errors = [];

    // Check basic structure
    if (!response || typeof response !== 'object') {
      errors.push('Response must be a valid object');
      return { isValid: false, errors };
    }

    // Validate character name
    if (!response.characterName || typeof response.characterName !== 'string') {
      errors.push('Character name is required and must be a string');
    } else if (response.characterName.trim().length === 0) {
      errors.push('Character name cannot be empty');
    } else if (
      response.characterName.length > VALIDATION_CONFIG.maxCharacterNameLength
    ) {
      errors.push(
        `Character name too long (max ${VALIDATION_CONFIG.maxCharacterNameLength} characters)`
      );
    }

    // Validate speech patterns array
    if (!response.speechPatterns || !Array.isArray(response.speechPatterns)) {
      errors.push('Speech patterns must be an array');
      return { isValid: false, errors };
    }

    const patterns = response.speechPatterns;

    // Check pattern count
    if (patterns.length < VALIDATION_CONFIG.minPatterns) {
      errors.push(
        `At least ${VALIDATION_CONFIG.minPatterns} speech patterns are required`
      );
    }

    if (patterns.length > VALIDATION_CONFIG.maxPatterns) {
      errors.push(
        `Maximum ${VALIDATION_CONFIG.maxPatterns} speech patterns allowed`
      );
    }

    // Validate individual patterns
    patterns.forEach((pattern, index) => {
      this.#validatePatternStructure(pattern, index, errors);
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate individual pattern structure
   *
   * @private
   * @param {object} pattern - Pattern to validate
   * @param {number} index - Pattern index for error reporting
   * @param {Array} errors - Errors array to populate
   */
  #validatePatternStructure(pattern, index, errors) {
    const prefix = `Pattern ${index + 1}`;

    if (!pattern || typeof pattern !== 'object') {
      errors.push(`${prefix}: must be an object`);
      return;
    }

    // Validate pattern description
    if (!pattern.pattern || typeof pattern.pattern !== 'string') {
      errors.push(`${prefix}: pattern description is required`);
    } else {
      const trimmed = pattern.pattern.trim();
      if (trimmed.length < VALIDATION_CONFIG.minPatternLength) {
        errors.push(
          `${prefix}: pattern description too short (min ${VALIDATION_CONFIG.minPatternLength} characters)`
        );
      }
      if (trimmed.length > VALIDATION_CONFIG.maxPatternLength) {
        errors.push(
          `${prefix}: pattern description too long (max ${VALIDATION_CONFIG.maxPatternLength} characters)`
        );
      }

      // Check for generic patterns
      if (trimmed.match(/^(says|talks|speaks|has a way of speaking)\b/i)) {
        errors.push(
          `${prefix}: pattern description should be more specific than generic terms`
        );
      }
    }

    // Validate example
    if (!pattern.example || typeof pattern.example !== 'string') {
      errors.push(`${prefix}: example is required`);
    } else {
      const trimmed = pattern.example.trim();
      if (trimmed.length < VALIDATION_CONFIG.minExampleLength) {
        errors.push(
          `${prefix}: example too short (min ${VALIDATION_CONFIG.minExampleLength} characters)`
        );
      }
      if (trimmed.length > VALIDATION_CONFIG.maxExampleLength) {
        errors.push(
          `${prefix}: example too long (max ${VALIDATION_CONFIG.maxExampleLength} characters)`
        );
      }

      // Check for quoted speech in example
      if (
        !trimmed.match(/['""].*['""]/) &&
        !trimmed.match(/\(.*\).*['""].*['""]/)
      ) {
        errors.push(
          `${prefix}: example should contain quoted speech or dialogue`
        );
      }

      // Check for generic placeholder text
      if (
        trimmed.match(
          /\b(character says|they say|example|sample|placeholder)\b/i
        )
      ) {
        errors.push(
          `${prefix}: example should contain specific character dialogue, not placeholder text`
        );
      }
    }

    // Validate circumstances (optional)
    if (pattern.circumstances !== null && pattern.circumstances !== undefined) {
      if (typeof pattern.circumstances !== 'string') {
        errors.push(`${prefix}: circumstances must be a string or null`);
      } else if (pattern.circumstances.trim().length > 0) {
        const trimmed = pattern.circumstances.trim();
        if (trimmed.length > VALIDATION_CONFIG.maxCircumstancesLength) {
          errors.push(
            `${prefix}: circumstances too long (max ${VALIDATION_CONFIG.maxCircumstancesLength} characters)`
          );
        }
        if (
          trimmed.length >= 5 &&
          !trimmed.match(/^(When|During|In|While|After|Before|If)\b/)
        ) {
          errors.push(
            `${prefix}: circumstances should start with appropriate temporal/conditional words`
          );
        }
      }
    }
  }

  /**
   * Format validation errors for user display
   *
   * @private
   * @param {Array} errors - Raw validation errors
   * @returns {Array<string>} Formatted error messages
   */
  #formatValidationErrors(errors) {
    return errors.map((error) => {
      if (typeof error === 'string') {
        return error;
      }

      const message = error.message || '';
      const instancePath = error.instancePath || '';
      const schemaPath = error.schemaPath || '';

      // Convert technical schema errors to user-friendly messages
      if (message.includes('minItems')) {
        return `Not enough speech patterns generated (minimum ${VALIDATION_CONFIG.minPatterns} required)`;
      } else if (message.includes('maxItems')) {
        return `Too many speech patterns generated (maximum ${VALIDATION_CONFIG.maxPatterns} allowed)`;
      } else if (
        (message.includes('minLength') || message.includes('minimum length')) &&
        instancePath.includes('pattern')
      ) {
        return 'Some pattern descriptions are too short';
      } else if (
        (message.includes('minLength') || message.includes('minimum length')) &&
        instancePath.includes('example')
      ) {
        return 'Some pattern examples are too short';
      } else if (message.includes('maxLength')) {
        return 'Some content is too long';
      } else if (
        message.includes('required') &&
        instancePath.includes('pattern')
      ) {
        return 'Missing required pattern description';
      } else if (
        message.includes('required') &&
        instancePath.includes('example')
      ) {
        return 'Missing required pattern example';
      } else if (message.includes('format')) {
        return 'Invalid data format in response';
      } else if (
        // Handle 'not' pattern validation for generic patterns
        message.includes('should NOT be valid') &&
        instancePath.includes('pattern')
      ) {
        return 'Pattern descriptions should be more specific and avoid generic terms like "says", "talks", or "speaks"';
      } else if (
        // Handle anyOf failure for quoted speech
        message.includes('should match some schema in "anyOf"') &&
        instancePath.includes('example')
      ) {
        return 'Examples should contain quoted speech or dialogue';
      } else if (
        // Handle circumstances validation (AJV v8 format)
        (message.includes('must match pattern') ||
          message.includes('should match pattern')) &&
        (instancePath.includes('circumstances') ||
          message.includes('When|During|In|While|After|Before|If'))
      ) {
        return 'Circumstances should start with temporal or conditional words like "When", "During", "In", etc.';
      } else if (
        // Handle conditional schema failures for circumstances
        message.includes('must match "then" schema') &&
        instancePath.includes('circumstances')
      ) {
        return 'Circumstances should start with temporal or conditional words like "When", "During", "In", etc.';
      } else if (
        // Additional handling for placeholder text detection
        instancePath.includes('pattern') &&
        schemaPath.includes('not')
      ) {
        return 'Pattern descriptions should be specific, not generic or placeholder text';
      } else if (
        // Additional handling for example placeholder text
        instancePath.includes('example') &&
        (message.includes('anyOf') || message.includes('pattern'))
      ) {
        return 'Examples should contain actual quoted dialogue, not placeholder text';
      } else {
        // Return original error for unhandled cases
        return message || JSON.stringify(error);
      }
    });
  }

  /**
   * Sanitize user input to prevent XSS and security issues
   *
   * @param {*} input - Input to sanitize
   * @returns {*} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove script tags and their content completely
    let sanitized = input.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );

    // Remove iframe tags and their content completely
    sanitized = sanitized.replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      ''
    );

    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove event handlers (onclick, onload, etc.)
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    // Remove data: URLs (can contain executable content)
    sanitized = sanitized.replace(/data:\s*[^,]*,/gi, '');

    // Remove vbscript: protocol
    sanitized = sanitized.replace(/vbscript:/gi, '');

    // Strip HTML tags but preserve their text content
    // This handles most HTML tags like <em>, <strong>, <a>, <div>, etc.
    // while preserving the text inside them
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Clean up excessive whitespace but preserve formatting
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Get schema version and metadata
   *
   * @returns {object} Schema information
   */
  getSchemaInfo() {
    return {
      schemaId: this.#schemaId,
      version: '1.0.0',
      description: 'Speech Patterns Response Validation Schema',
      minPatterns: VALIDATION_CONFIG.minPatterns,
      maxPatterns: VALIDATION_CONFIG.maxPatterns,
      validationConfig: VALIDATION_CONFIG,
    };
  }

  /**
   * Validate and sanitize speech patterns response
   * Combined validation and sanitization for complete processing
   *
   * @param {object} rawResponse - Raw response to process
   * @returns {Promise<object>} Validation result with sanitized data
   */
  async validateAndSanitizeResponse(rawResponse) {
    try {
      // First sanitize the response
      const sanitizedResponse = this.#sanitizeResponse(rawResponse);

      // Then validate
      const validationResult = await this.validateResponse(sanitizedResponse);

      return {
        ...validationResult,
        // Always return sanitized response for inspection, regardless of validation result
        sanitizedResponse: sanitizedResponse,
      };
    } catch (error) {
      this.#logger.error('Error in validateAndSanitizeResponse', error);
      return {
        isValid: false,
        errors: [`Processing error: ${error.message}`],
        sanitizedResponse: null,
      };
    }
  }

  /**
   * Sanitize entire response object
   *
   * @private
   * @param {object} response - Response to sanitize
   * @returns {object} Sanitized response
   */
  #sanitizeResponse(response) {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = { ...response };

    // Sanitize character name
    if (
      sanitized.characterName &&
      typeof sanitized.characterName === 'string'
    ) {
      sanitized.characterName = this.sanitizeInput(sanitized.characterName);
    }

    // Sanitize speech patterns
    if (Array.isArray(sanitized.speechPatterns)) {
      sanitized.speechPatterns = sanitized.speechPatterns.map((pattern) => {
        if (!pattern || typeof pattern !== 'object') {
          return pattern;
        }

        return {
          ...pattern,
          pattern:
            typeof pattern.pattern === 'string'
              ? this.sanitizeInput(pattern.pattern)
              : pattern.pattern,
          example:
            typeof pattern.example === 'string'
              ? this.sanitizeInput(pattern.example)
              : pattern.example,
          circumstances:
            typeof pattern.circumstances === 'string'
              ? this.sanitizeInput(pattern.circumstances)
              : pattern.circumstances,
        };
      });
    }

    return sanitized;
  }
}

export default SpeechPatternsSchemaValidator;
