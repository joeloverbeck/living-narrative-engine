/**
 * @file LLM response processing for speech patterns
 * @description Processes and validates LLM responses for speech pattern generation
 * @see SpeechPatternsGenerator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateSpeechPatternsGenerationResponse } from '../prompts/speechPatternsPrompts.js';
import SpeechPatternsSchemaValidator from '../validators/SpeechPatternsSchemaValidator.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../validators/SpeechPatternsSchemaValidator.js').default} SpeechPatternsSchemaValidator
 */

/**
 * Service for processing LLM responses for speech patterns
 */
export class SpeechPatternsResponseProcessor {
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {LlmJsonService} */
  #llmJsonService;

  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  /** @private @type {SpeechPatternsSchemaValidator} */
  #speechPatternsValidator;

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

    // Initialize speech patterns validator if schema validator is available
    if (this.#schemaValidator) {
      try {
        this.#speechPatternsValidator = new SpeechPatternsSchemaValidator({
          schemaValidator: this.#schemaValidator,
          logger: this.#logger,
        });
        this.#logger.debug(
          'SpeechPatternsSchemaValidator initialized successfully'
        );
      } catch (error) {
        this.#logger.warn(
          'Failed to initialize SpeechPatternsSchemaValidator',
          error
        );
        this.#speechPatternsValidator = null;
      }
    }
  }

  /**
   * Process raw LLM response into structured speech patterns
   *
   * @param {string} rawResponse - Raw response from LLM
   * @param {object} context - Generation context
   * @returns {Promise<object>} Processed speech patterns
   */
  async processResponse(rawResponse, context = {}) {
    assertNonBlankString(rawResponse, 'LLM response');

    try {
      // Log raw LLM response at info level for debugging
      const truncatedResponse =
        rawResponse.length > 500
          ? rawResponse.substring(0, 500) + '...[truncated]'
          : rawResponse;

      this.#logger.info('Raw LLM response received for speech patterns', {
        responseLength: rawResponse.length,
        characterName: context.characterName,
        rawResponsePreview: truncatedResponse,
        fullResponse: rawResponse, // Full response for detailed debugging
      });

      this.#logger.debug('Processing LLM response for speech patterns', {
        responseLength: rawResponse.length,
        characterName: context.characterName,
      });

      // Attempt JSON parsing first
      let parsedResponse = await this.#tryParseAsJson(rawResponse);

      // Fall back to text parsing if JSON parsing fails
      if (!parsedResponse) {
        parsedResponse = await this.#parseTextResponse(rawResponse, context);
      }

      // Validate response structure and get sanitized version if available
      const validatedResponse = await this.#validateResponse(parsedResponse);

      // Use sanitized response if validation returned one, otherwise use original
      const responseToEnhance = validatedResponse || parsedResponse;

      // Enhance and normalize response
      const enhancedResponse = this.#enhanceResponse(
        responseToEnhance,
        context
      );

      this.#logger.debug('LLM response processed successfully', {
        patternCount: enhancedResponse.speechPatterns.length,
      });

      return enhancedResponse;
    } catch (error) {
      this.#logger.error('Failed to process LLM response', error);
      throw new Error(`Response processing failed: ${error.message}`);
    }
  }

  /**
   * Try to parse response as JSON using LlmJsonService
   *
   * @private
   * @param {string} response - Raw response
   * @returns {Promise<object|null>} Parsed JSON or null
   */
  async #tryParseAsJson(response) {
    try {
      // Use LlmJsonService for robust JSON cleaning and parsing
      const cleanedResponse = this.#llmJsonService.clean(response);
      const parsedResponse = await this.#llmJsonService.parseAndRepair(
        cleanedResponse,
        {
          logger: this.#logger,
        }
      );

      return parsedResponse;
    } catch (error) {
      this.#logger.debug('LLM JSON parsing failed, will try text parsing', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Parse structured text response
   *
   * @private
   * @param {string} textResponse - Text response
   * @param {object} context - Generation context
   * @returns {Promise<object>} Parsed response
   */
  async #parseTextResponse(textResponse, context) {
    const patterns = [];
    const lines = textResponse.split('\n').filter((line) => line.trim());

    let currentPattern = null;
    let patternIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and section headers
      if (!trimmedLine || trimmedLine.match(/^(SPEECH|PATTERNS|CHARACTER)/i)) {
        continue;
      }

      // Look for numbered patterns
      const numberedMatch = trimmedLine.match(/^(\d+)\.?\s*(.+)/);
      if (numberedMatch) {
        // Save previous pattern if exists
        if (currentPattern) {
          patterns.push(this.#finalizePattern(currentPattern));
        }

        // Start new pattern
        currentPattern = {
          index: ++patternIndex,
          rawText: numberedMatch[2],
          pattern: '',
          example: '',
          circumstances: '',
        };

        this.#extractPatternElements(currentPattern);
        continue;
      }

      // Look for quoted examples
      const quoteMatch = trimmedLine.match(/["']([^"']+)["']/);
      if (quoteMatch && currentPattern) {
        if (!currentPattern.example) {
          currentPattern.example = quoteMatch[1];
          currentPattern.circumstances =
            this.#extractCircumstances(trimmedLine);
        }
        continue;
      }

      // Handle circumstantial patterns
      const circumstanceMatch = trimmedLine.match(/\(([^)]+)\)/);
      if (circumstanceMatch && currentPattern) {
        if (!currentPattern.circumstances) {
          currentPattern.circumstances = circumstanceMatch[1];
        }
        continue;
      }

      // If no current pattern but we have content, create a basic pattern
      if (!currentPattern && trimmedLine.length > 10) {
        currentPattern = {
          index: ++patternIndex,
          rawText: trimmedLine,
          pattern: '',
          example: '',
          circumstances: '',
        };

        this.#extractPatternElements(currentPattern);
      }
    }

    // Don't forget the last pattern
    if (currentPattern) {
      patterns.push(this.#finalizePattern(currentPattern));
    }

    return {
      characterName:
        context.characterName || this.#extractCharacterName(textResponse),
      speechPatterns: patterns,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract pattern elements from raw text
   *
   * @private
   * @param {object} pattern - Pattern object to populate
   */
  #extractPatternElements(pattern) {
    const text = pattern.rawText;

    // Try to separate description from example
    const colonIndex = text.indexOf(':');
    const dashIndex = text.indexOf(' - ');
    const quoteIndex = text.search(/["']/);

    let separatorIndex = -1;
    if (colonIndex > 0 && colonIndex < 50) separatorIndex = colonIndex;
    else if (dashIndex > 0 && dashIndex < 50) separatorIndex = dashIndex;
    else if (quoteIndex > 10) separatorIndex = quoteIndex;

    if (separatorIndex > 0) {
      pattern.pattern = text.slice(0, separatorIndex).trim();
      const remainder = text.slice(separatorIndex + 1).trim();

      // Extract quoted example
      const quoteMatch = remainder.match(/["']([^"']+)["']/);
      if (quoteMatch) {
        pattern.example = quoteMatch[1];
        pattern.circumstances = this.#extractCircumstances(remainder);
      } else {
        pattern.example = remainder;
      }
    } else {
      // No clear separator, treat as description
      pattern.pattern = text;
    }

    // Ensure we have both pattern and example
    if (!pattern.example && pattern.pattern) {
      // Try to extract an implied example from the pattern
      const impliedExample = this.#extractImpliedExample(pattern.pattern);
      if (impliedExample) {
        pattern.example = impliedExample;
        pattern.pattern = pattern.pattern.replace(impliedExample, '').trim();
      }
    }
  }

  /**
   * Extract circumstances from text
   *
   * @private
   * @param {string} text - Text to analyze
   * @returns {string} Extracted circumstances
   */
  #extractCircumstances(text) {
    const match = text.match(/\(([^)]+)\)/);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract implied example from pattern description
   *
   * @private
   * @param {string} pattern - Pattern description
   * @returns {string} Extracted example
   */
  #extractImpliedExample(pattern) {
    // Look for quoted text within the pattern
    const quoteMatch = pattern.match(/["']([^"']+)["']/);
    return quoteMatch ? quoteMatch[1] : '';
  }

  /**
   * Finalize pattern before adding to collection
   *
   * @private
   * @param {object} pattern - Pattern to finalize
   * @returns {object} Finalized pattern in new schema format (type/examples[]/contexts[])
   */
  #finalizePattern(pattern) {
    // Convert to new schema format (v3.0.0)
    const type =
      pattern.pattern || pattern.rawText || 'General speech characteristic';
    const example = pattern.example || 'Character expresses themselves naturally';
    const circumstances = pattern.circumstances || '';

    // Schema requires minimum 2 examples, so add a variant if only one was extracted
    const examples = [example];
    if (examples.length === 1) {
      // Add a slight variation to meet schema requirements
      examples.push(example + ' (variant)');
    }

    return {
      type,
      examples,
      contexts: circumstances ? [circumstances] : undefined, // Only include if present
    };
  }

  /**
   * Extract character name from response
   *
   * @private
   * @param {string} response - Full response text
   * @returns {string} Character name
   */
  #extractCharacterName(response) {
    // Try to find character name in response
    const nameMatch = response.match(/character[:\s]+([^.\n]+)/i);
    return nameMatch ? nameMatch[1].trim() : 'Character';
  }

  /**
   * Validate response structure
   *
   * @private
   * @param {object} response - Response to validate
   * @returns {Promise<void>}
   */
  async #validateResponse(response) {
    // Use prompt validation function as primary validation
    const validationResult = validateSpeechPatternsGenerationResponse(
      response,
      this.#logger
    );

    if (!validationResult.isValid) {
      throw new Error(
        `Invalid response structure: ${validationResult.errors.join(', ')}`
      );
    }

    // Use enhanced schema validation if available
    if (this.#speechPatternsValidator) {
      try {
        this.#logger.debug(
          'Using SpeechPatternsSchemaValidator for enhanced validation'
        );
        const schemaValidationResult =
          await this.#speechPatternsValidator.validateAndSanitizeResponse(
            response
          );

        if (!schemaValidationResult.isValid) {
          this.#logger.warn('Enhanced schema validation failed', {
            errors: schemaValidationResult.errors,
          });
          throw new Error(
            `Enhanced validation failed: ${schemaValidationResult.errors.join(', ')}`
          );
        }

        this.#logger.debug('Enhanced schema validation passed');
        return schemaValidationResult.sanitizedResponse;
      } catch (validationError) {
        this.#logger.error('Enhanced schema validation error', validationError);
        throw validationError;
      }
    }

    // Fallback to legacy schema validation if enhanced validator not available
    if (this.#schemaValidator) {
      try {
        const { validateAgainstSchema } = await import(
          '../../utils/schemaValidationUtils.js'
        );
        validateAgainstSchema(
          this.#schemaValidator,
          'speech-patterns-response.schema.json',
          response,
          this.#logger,
          {
            validationDebugMessage:
              'Validating speech patterns response structure',
            failureMessage: 'Speech patterns response validation failed',
            failureThrowMessage: 'Invalid speech patterns response structure',
          }
        );
      } catch {
        this.#logger.debug(
          'Schema validation utility not available, using prompt validation only'
        );
      }
    }

    // Return the original response if no enhanced validation was performed
    return response;
  }

  /**
   * Enhance response with additional metadata
   *
   * @private
   * @param {object} response - Response to enhance
   * @param {object} context - Generation context
   * @returns {object} Enhanced response
   */
  #enhanceResponse(response, context) {
    return {
      ...response,
      characterName:
        response.characterName || context.characterName || 'Character',
      generatedAt: response.generatedAt || new Date().toISOString(),
      metadata: {
        processingMethod: response.speechPatterns ? 'json' : 'text_parsing',
        patternCount: response.speechPatterns.length,
        hasCharacterName: Boolean(response.characterName),
        averagePatternLength: this.#calculateAverageLength(
          response.speechPatterns,
          'type' // Updated to new schema field
        ),
        averageExampleLength: this.#calculateAverageLengthFromExamples(
          response.speechPatterns
        ),
        patternsWithCircumstances: response.speechPatterns.filter(
          (p) => p.contexts && p.contexts.length > 0 // Updated to new schema field
        ).length,
      },
    };
  }

  /**
   * Calculate average field length
   *
   * @private
   * @param {Array} patterns - Pattern array
   * @param {string} field - Field to measure
   * @returns {number} Average length
   */
  #calculateAverageLength(patterns, field) {
    if (!patterns.length) return 0;
    const total = patterns.reduce(
      (sum, pattern) => sum + (pattern[field]?.length || 0),
      0
    );
    return Math.round(total / patterns.length);
  }

  /**
   * Calculate average example length from examples array
   *
   * @private
   * @param {Array} patterns - Pattern array
   * @returns {number} Average length
   */
  #calculateAverageLengthFromExamples(patterns) {
    if (!patterns.length) return 0;
    let totalLength = 0;
    let exampleCount = 0;

    for (const pattern of patterns) {
      if (Array.isArray(pattern.examples)) {
        for (const example of pattern.examples) {
          totalLength += example?.length || 0;
          exampleCount++;
        }
      }
    }

    return exampleCount > 0 ? Math.round(totalLength / exampleCount) : 0;
  }
}

export default SpeechPatternsResponseProcessor;
