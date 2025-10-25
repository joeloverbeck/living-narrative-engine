/**
 * @file LLM response processing for traits rewriting
 * @description Processes and validates LLM responses for traits rewriting generation
 * @see SpeechPatternsResponseProcessor.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import {
  TRAITS_REWRITER_RESPONSE_SCHEMA,
  DEFAULT_TRAIT_KEYS,
} from '../prompts/traitsRewriterPrompts.js';
import {
  TraitsRewriterError,
  TRAITS_REWRITER_ERROR_CODES,
} from '../errors/TraitsRewriterError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * Service for processing LLM responses for traits rewriting
 *
 * Handles parsing, validation, and sanitization of LLM responses for trait rewriting.
 * Ensures response quality, validates against schemas, and provides error recovery.
 */
export class TraitsRewriterResponseProcessor {
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {LlmJsonService} */
  #llmJsonService;

  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  constructor(dependencies) {
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(dependencies.llmJsonService, 'LlmJsonService', null, {
      requiredMethods: ['clean', 'parseAndRepair'],
    });

    // Schema validator is optional
    if (dependencies.schemaValidator) {
      validateDependency(
        dependencies.schemaValidator,
        'ISchemaValidator',
        null,
        {
          requiredMethods: ['validateAgainstSchema'],
        }
      );
    }

    this.#logger = dependencies.logger;
    this.#llmJsonService = dependencies.llmJsonService;
    this.#schemaValidator = dependencies.schemaValidator;

    this.#logger.debug(
      'TraitsRewriterResponseProcessor initialized successfully'
    );
  }

  /**
   * Process raw LLM response into structured rewritten traits
   *
   * @param {string} rawResponse - Raw LLM response text
   * @param {object} originalCharacterData - Original character definition for verification
   * @param {object} [options] - Processing options
   * @returns {Promise<object>} Processed traits data
   * @throws {TraitsRewriterError} When processing fails
   */
  async processResponse(rawResponse, originalCharacterData, options = {}) {
    assertNonBlankString(
      rawResponse,
      'Raw response',
      'processResponse',
      this.#logger
    );

    if (!originalCharacterData || typeof originalCharacterData !== 'object') {
      throw TraitsRewriterError.forInvalidCharacterDefinition(
        'Original character data is required for verification'
      );
    }

    const characterName =
      originalCharacterData['core:name']?.text ||
      originalCharacterData['core:name']?.name ||
      'Unknown Character';

    try {
      this.#logger.debug('Starting traits rewriter response processing', {
        characterName,
        responseLength: rawResponse.length,
      });

      // Step 1: Parse JSON response safely
      const parsedResponse = await this.#parseJsonResponse(rawResponse);

      // Step 2: Validate against schema
      const validatedResponse = this.#validateResponseSchema(parsedResponse);

      // Step 3: Verify trait completeness
      const verifiedResponse = this.#verifyTraitCompleteness(
        validatedResponse,
        originalCharacterData
      );

      // Step 4: Sanitize content
      const sanitizedResponse = this.#sanitizeTraitContent(verifiedResponse);

      this.#logger.info('Successfully processed traits rewriter response', {
        characterName,
        traitsCount: Object.keys(sanitizedResponse.rewrittenTraits || {})
          .length,
      });

      return sanitizedResponse;
    } catch (error) {
      return this.#handleProcessingErrors(error, {
        characterName,
        rawResponseLength: rawResponse.length,
        stage: 'processResponse',
      });
    }
  }

  /**
   * Parse JSON response safely with fallback error handling
   *
   * @private
   * @param {string} rawResponse - Raw LLM response text
   * @returns {Promise<object>} Parsed JSON object
   * @throws {TraitsRewriterError} When parsing fails completely
   */
  async #parseJsonResponse(rawResponse) {
    try {
      // Use llmJsonService for robust parsing with repair capabilities
      const parsedResponse = await this.#llmJsonService.parseAndRepair(
        rawResponse,
        {
          logger: this.#logger,
        }
      );

      this.#logger.debug('Successfully parsed LLM response JSON', {
        hasCharacterName: !!parsedResponse.characterName,
        hasRewrittenTraits: !!parsedResponse.rewrittenTraits,
        traitCount: parsedResponse.rewrittenTraits
          ? Object.keys(parsedResponse.rewrittenTraits).length
          : 0,
      });

      return parsedResponse;
    } catch (error) {
      this.#logger.error('Failed to parse LLM response as JSON', {
        error: error.message,
        rawResponseLength: rawResponse.length,
        rawResponsePreview: rawResponse.substring(0, 200) + '...',
      });

      throw TraitsRewriterError.forParsingFailure(
        'Could not parse LLM response as valid JSON',
        { rawResponseLength: rawResponse.length },
        error
      );
    }
  }

  /**
   * Validate response against expected schema
   *
   * @private
   * @param {object} parsedResponse - Parsed JSON response
   * @returns {object} Validated response
   * @throws {TraitsRewriterError} When validation fails
   */
  #validateResponseSchema(parsedResponse) {
    if (!this.#schemaValidator) {
      this.#logger.warn('Schema validator not available, skipping validation');
      return parsedResponse;
    }

    try {
      const validationResult = this.#schemaValidator.validateAgainstSchema(
        parsedResponse,
        TRAITS_REWRITER_RESPONSE_SCHEMA
      );

      if (!validationResult.isValid) {
        const errors = validationResult.errors || ['Unknown validation error'];
        this.#logger.error('Response failed schema validation', {
          errors,
          characterName: parsedResponse.characterName,
        });

        throw TraitsRewriterError.forValidationFailure(
          'response schema',
          `Schema validation failed: ${errors.join(', ')}`,
          { validationErrors: errors }
        );
      }

      this.#logger.debug('Response passed schema validation', {
        characterName: parsedResponse.characterName,
      });

      return parsedResponse;
    } catch (error) {
      if (error instanceof TraitsRewriterError) {
        throw error;
      }

      this.#logger.error('Schema validation process failed', {
        error: error.message,
        characterName: parsedResponse.characterName,
      });

      throw TraitsRewriterError.forValidationFailure(
        'validation process',
        'Schema validation process encountered an error',
        { originalError: error.message },
        error
      );
    }
  }

  /**
   * Verify trait completeness against original character data
   *
   * @private
   * @param {object} response - Validated response
   * @param {object} originalCharacterData - Original character definition
   * @returns {object} Verified response
   * @throws {TraitsRewriterError} When traits are incomplete
   */
  #verifyTraitCompleteness(response, originalCharacterData) {
    const originalTraits = this.#extractOriginalTraits(originalCharacterData);
    const rewrittenTraits = response.rewrittenTraits || {};

    // Check if we have any traits at all
    if (Object.keys(rewrittenTraits).length === 0) {
      throw TraitsRewriterError.forMissingTraits(
        response.characterName || 'Unknown Character',
        { originalTraitCount: Object.keys(originalTraits).length }
      );
    }

    // Verify that essential traits are present and non-empty
    const missingTraits = [];
    const emptyTraits = [];

    Object.keys(originalTraits).forEach((traitKey) => {
      if (!rewrittenTraits[traitKey]) {
        missingTraits.push(traitKey);
      } else if (
        typeof rewrittenTraits[traitKey] !== 'string' ||
        rewrittenTraits[traitKey].trim().length === 0
      ) {
        emptyTraits.push(traitKey);
      }
    });

    if (missingTraits.length > 0) {
      this.#logger.warn('Some traits are missing from response', {
        missingTraits,
        characterName: response.characterName,
      });
    }

    if (emptyTraits.length > 0) {
      this.#logger.warn('Some traits are empty in response', {
        emptyTraits,
        characterName: response.characterName,
      });
    }

    // Only throw error if critical traits are missing or empty
    const criticalIssues = [...missingTraits, ...emptyTraits];
    if (criticalIssues.length > Object.keys(originalTraits).length / 2) {
      throw TraitsRewriterError.forQualityFailure(
        `Too many missing or empty traits: ${criticalIssues.join(', ')}`,
        {
          missingTraits,
          emptyTraits,
          originalTraitCount: Object.keys(originalTraits).length,
        }
      );
    }

    this.#logger.debug('Trait completeness verification passed', {
      characterName: response.characterName,
      totalTraits: Object.keys(rewrittenTraits).length,
      missingCount: missingTraits.length,
      emptyCount: emptyTraits.length,
    });

    return response;
  }

  /**
   * Sanitize trait content for safe display
   *
   * @private
   * @param {object} response - Verified response
   * @returns {object} Sanitized response
   */
  #sanitizeTraitContent(response) {
    const sanitizedTraits = {};

    Object.entries(response.rewrittenTraits).forEach(
      ([traitKey, traitValue]) => {
        if (typeof traitValue === 'string') {
          sanitizedTraits[traitKey] = this.#escapeHtmlContent(
            traitValue.trim()
          );
        } else {
          sanitizedTraits[traitKey] = traitValue;
        }
      }
    );

    this.#logger.debug('Content sanitization completed', {
      characterName: response.characterName,
      sanitizedTraitsCount: Object.keys(sanitizedTraits).length,
    });

    return {
      ...response,
      rewrittenTraits: sanitizedTraits,
    };
  }

  /**
   * Handle processing errors with context and recovery options
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @throws {TraitsRewriterError} Processed error with context
   */
  #handleProcessingErrors(error, context) {
    if (error instanceof TraitsRewriterError) {
      // Re-throw with additional context
      error.context = { ...error.context, ...context };
      this.#logger.error('Traits rewriter processing failed', {
        error: error.message,
        context: error.context,
      });
      throw error;
    }

    // Wrap other errors
    this.#logger.error('Unexpected error during traits rewriter processing', {
      error: error.message,
      context,
    });

    throw TraitsRewriterError.forGenerationFailure(
      'Unexpected processing error occurred',
      context,
      error
    );
  }

  /**
   * Extract original traits from character data
   *
   * @private
   * @param {object} characterData - Original character definition
   * @returns {object} Extracted traits
   */
  #extractOriginalTraits(characterData) {
    const traits = {};

    DEFAULT_TRAIT_KEYS.forEach((traitKey) => {
      if (characterData[traitKey] && characterData[traitKey].text) {
        traits[traitKey] = characterData[traitKey].text;
      }
    });

    return traits;
  }

  /**
   * Escape HTML content for safe display
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} HTML-escaped text
   */
  #escapeHtmlContent(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate rewritten traits structure
   *
   * @param {object} traits - Traits object to validate
   * @returns {object} Validation result with errors if any
   */
  validateStructure(traits) {
    if (!traits || typeof traits !== 'object') {
      return {
        isValid: false,
        errors: ['Traits must be a valid object'],
      };
    }

    const errors = [];

    // Validate each trait has string content
    Object.entries(traits).forEach(([traitKey, traitValue]) => {
      if (typeof traitValue !== 'string') {
        errors.push(`Trait ${traitKey} must be a string`);
      } else if (traitValue.trim().length === 0) {
        errors.push(`Trait ${traitKey} cannot be empty`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clean and repair malformed JSON response
   *
   * @param {string} response - Raw response to clean
   * @returns {string} Cleaned response
   */
  cleanResponse(response) {
    assertNonBlankString(
      response,
      'Response to clean',
      'cleanResponse',
      this.#logger
    );

    // Use llmJsonService for basic cleaning even in stub mode
    return this.#llmJsonService.clean(response);
  }

  /**
   * Get service information
   *
   * @returns {object} Service metadata
   */
  getServiceInfo() {
    return {
      name: 'TraitsRewriterResponseProcessor',
      version: '1.0.0',
      status: 'active',
      features: [
        'JSON parsing with repair',
        'Schema validation',
        'Content sanitization',
        'Error recovery',
        'Trait completeness verification',
      ],
    };
  }
}

export default TraitsRewriterResponseProcessor;
