/**
 * @file Enhanced validation service for speech patterns with multi-layer validation and intelligent feedback
 * @description Provides comprehensive validation with syntax, semantic, and quality layers plus intelligent suggestions
 * @see SpeechPatternsSchemaValidator.js
 */

import { SpeechPatternsSchemaValidator } from './SpeechPatternsSchemaValidator.js';
import { CharacterDefinitionValidator } from './CharacterDefinitionValidator.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {Array<string>} errors - Blocking validation errors
 * @property {Array<string>} warnings - Non-blocking issues that should be addressed
 * @property {Array<string>} suggestions - Improvement recommendations
 * @property {object} quality - Quality assessment metrics
 * @property {object} context - Additional validation context
 */

/**
 * @typedef {object} SemanticValidationRule
 * @property {string} id - Rule identifier
 * @property {string} name - Human-readable rule name
 * @property {Function} validator - Validation function
 * @property {string} category - Rule category (consistency, completeness, etc.)
 * @property {number} priority - Rule priority (1-10, higher = more important)
 */

/**
 * @typedef {object} QualityMetric
 * @property {string} id - Metric identifier
 * @property {string} name - Human-readable metric name
 * @property {Function} assessor - Assessment function
 * @property {number} weight - Metric weight in overall score (0-1)
 * @property {object} thresholds - Quality thresholds (low, medium, high)
 */

/**
 * Enhanced validation service with multi-layer validation and intelligent feedback
 * Extends SpeechPatternsSchemaValidator with advanced capabilities
 * Now delegates character definition validation to CharacterDefinitionValidator
 */
export class EnhancedSpeechPatternsValidator extends SpeechPatternsSchemaValidator {
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {CharacterDefinitionValidator} */
  #characterDefinitionValidator;

  /**
   * Create enhanced validator instance
   *
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    super(dependencies);

    this.#logger = dependencies.logger;

    // Create character definition validator with same dependencies
    this.#characterDefinitionValidator = new CharacterDefinitionValidator({
      logger: dependencies.logger,
      schemaValidator: dependencies.schemaValidator,
    });

    this.#logger.debug('EnhancedSpeechPatternsValidator initialized', {
      characterDefinitionValidator: !!this.#characterDefinitionValidator,
    });
  }

  /**
   * Enhanced multi-layer validation
   *
   * @param {object} input - Input to validate
   * @param {object} options - Validation options
   * @returns {Promise<ValidationResult>} Comprehensive validation result
   */
  async validateInput(input, options = {}) {
    // Delegate to CharacterDefinitionValidator for comprehensive validation
    const validationResult =
      await this.#characterDefinitionValidator.validateCharacterDefinition(
        input,
        options
      );

    // Add speech-patterns-specific context
    if (
      validationResult.quality &&
      validationResult.quality.overallScore < 0.4
    ) {
      if (
        !validationResult.warnings.includes(
          'Character definition may need more detail for optimal speech pattern generation'
        )
      ) {
        validationResult.warnings.push(
          'Character definition may need more detail for optimal speech pattern generation'
        );
      }
    }

    return validationResult;
  }

  /**
   * Extract character name from character definition
   * Delegates to CharacterDefinitionValidator
   *
   * @param {object} characterData - Character definition data
   * @returns {string|null} Character name or null
   */
  extractCharacterName(characterData) {
    return this.#characterDefinitionValidator.extractCharacterName(
      characterData
    );
  }

  /**
   * Clear validation cache
   *
   * @public
   */
  clearCache() {
    this.#characterDefinitionValidator.clearCache();
  }

  /**
   * Get validation statistics
   *
   * @public
   */
  getValidationStats() {
    return this.#characterDefinitionValidator.getValidationStats();
  }
}

export default EnhancedSpeechPatternsValidator;
