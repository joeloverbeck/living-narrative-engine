/**
 * @file Service for generating speech patterns via LLM
 * @description Main service for speech patterns generation following established pattern
 * @see CharacterBuilderService.js
 * @see CoreMotivationsGenerator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildSpeechPatternsGenerationPrompt,
  SPEECH_PATTERNS_RESPONSE_SCHEMA,
  SPEECH_PATTERNS_LLM_PARAMS,
  PROMPT_VERSION_INFO,
} from '../prompts/speechPatternsPrompts.js';
import { 
  SpeechPatternsGenerationError,
  SpeechPatternsResponseProcessingError,
  SpeechPatternsValidationError 
} from '../errors/SpeechPatternsGenerationError.js';
import { SpeechPatternsResponseProcessor } from './SpeechPatternsResponseProcessor.js';
import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 * @typedef {import('../../interfaces/ISchemaValidator.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {object} SpeechPatternsGenerationResult
 * @property {string} characterName - Character name
 * @property {Array<object>} speechPatterns - Generated speech patterns
 * @property {string} generatedAt - Generation timestamp
 * @property {object} metadata - Generation metadata
 */

/**
 * Service for generating character speech patterns via LLM
 * Following the established three-service pattern used by other character builder services
 */
export class SpeechPatternsGenerator {
  #logger;
  #llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;
  #eventBus;
  #tokenEstimator;
  #responseProcessor;

  /**
   * Create a new SpeechPatternsGenerator instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter (provides strategy factory functionality)
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {ITokenEstimator} [dependencies.tokenEstimator] - Token estimation service (optional)
   * @param {ISchemaValidator} [dependencies.schemaValidator] - Schema validation service (optional)
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
    schemaValidator,
  }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(llmJsonService, 'LlmJsonService', null, {
      requiredMethods: ['clean', 'parseAndRepair'],
    });
    validateDependency(llmStrategyFactory, 'ConfigurableLLMAdapter', null, {
      requiredMethods: ['getAIDecision'],
    });
    validateDependency(llmConfigManager, 'ILLMConfigurationManager', null, {
      requiredMethods: [
        'loadConfiguration',
        'getActiveConfiguration',
        'setActiveConfiguration',
      ],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', null, {
      requiredMethods: ['dispatch'],
    });

    // Optional dependencies
    if (tokenEstimator) {
      validateDependency(tokenEstimator, 'ITokenEstimator', null, {
        requiredMethods: ['estimateTokens'],
      });
    }

    if (schemaValidator) {
      validateDependency(schemaValidator, 'ISchemaValidator', null, {
        requiredMethods: ['validateAgainstSchema'],
      });
    }

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
    this.#tokenEstimator = tokenEstimator;

    // Create response processor
    this.#responseProcessor = new SpeechPatternsResponseProcessor({
      logger,
      llmJsonService,
      schemaValidator,
    });

    this.#logger.debug('SpeechPatternsGenerator initialized', {
      promptVersion: PROMPT_VERSION_INFO.version,
    });
  }

  /**
   * Generate speech patterns using established LLM integration pattern
   *
   * @param {object} characterData - Character definition data
   * @param {object} options - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM configuration ID
   * @param {string} [options.focusType] - Focus area (EMOTIONAL_FOCUS, SOCIAL_FOCUS, etc.)
   * @param {number} [options.patternCount] - Number of patterns to generate
   * @param {AbortSignal} [options.abortSignal] - Abort signal for cancellation
   * @returns {Promise<SpeechPatternsGenerationResult>} Generated speech patterns
   */
  async generateSpeechPatterns(characterData, options = {}) {
    const startTime = Date.now();

    try {
      this.#logger.info(
        'SpeechPatternsGenerator: Starting generation',
        {
          characterDataSize: JSON.stringify(characterData).length,
          focusType: options.focusType,
          patternCount: options.patternCount,
        }
      );

      // Dispatch start event
      this.#eventBus.dispatch({
        type: CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED,
        payload: {
          characterData: characterData,
          options: options,
          timestamp: new Date().toISOString(),
        },
      });

      // Validate input
      this.#validateCharacterData(characterData);

      // Build prompt
      const prompt = this.#buildPrompt(characterData, options);

      // Estimate tokens if service available
      if (this.#tokenEstimator) {
        const estimatedTokens = this.#tokenEstimator.estimateTokens(prompt);
        this.#logger.debug('Prompt token estimation', { estimatedTokens });
      }

      // Call LLM
      const rawResponse = await this.#callLLM(prompt, options);

      // Process response
      const parsedResponse = await this.#parseResponse(rawResponse, {
        characterName: this.#extractCharacterName(characterData),
      });

      // Validate and enhance
      const result = this.#validateAndEnhance(parsedResponse, options);

      // Dispatch success event
      this.#eventBus.dispatch({
        type: CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED,
        payload: {
          result: result,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      });

      this.#logger.info('SpeechPatternsGenerator: Successfully generated speech patterns', {
        patternCount: result.speechPatterns.length,
        processingTime: Date.now() - startTime,
        characterName: result.characterName,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.#logger.error('SpeechPatternsGenerator: Generation failed', {
        error: error.message,
        processingTime,
      });

      // Dispatch error event
      this.#eventBus.dispatch({
        type: CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED,
        payload: {
          error: error.message,
          processingTime,
          timestamp: new Date().toISOString(),
        },
      });

      if (error instanceof SpeechPatternsGenerationError) {
        throw error;
      }

      throw new SpeechPatternsGenerationError(
        `Failed to generate speech patterns: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate character data input
   *
   * @private
   * @param {object} characterData - Character data to validate
   */
  #validateCharacterData(characterData) {
    if (!characterData || typeof characterData !== 'object') {
      throw new SpeechPatternsValidationError(
        'Character data is required and must be an object'
      );
    }

    // Check for basic character components
    const hasCharacterComponents = Object.keys(characterData).some(
      key => key.includes(':')
    );

    if (!hasCharacterComponents) {
      throw new SpeechPatternsValidationError(
        'Character data must contain at least one character component (format: "component:field")'
      );
    }

    // Check for reasonable content depth
    const contentLength = JSON.stringify(characterData).length;
    if (contentLength < 50) {
      throw new SpeechPatternsValidationError(
        'Character data appears insufficient for speech pattern generation'
      );
    }
  }

  /**
   * Build LLM prompt using prompt service
   *
   * @private
   * @param {object} characterData - Character data
   * @param {object} options - Generation options
   * @returns {string} Built prompt
   */
  #buildPrompt(characterData, options) {
    try {
      return buildSpeechPatternsGenerationPrompt(characterData, options);
    } catch (error) {
      throw new SpeechPatternsGenerationError(
        `Failed to build prompt: ${error.message}`,
        error
      );
    }
  }

  /**
   * Call LLM service with prepared prompt
   *
   * @private
   * @param {string} prompt - Prepared prompt
   * @param {object} options - Generation options
   * @returns {Promise<string>} LLM response
   */
  async #callLLM(prompt, options) {
    try {
      // Set active configuration if specified
      if (options.llmConfigId) {
        await this.#llmConfigManager.setActiveConfiguration(options.llmConfigId);
      }

      const requestOptions = {
        toolSchema: SPEECH_PATTERNS_RESPONSE_SCHEMA,
        toolName: 'generate_speech_patterns',
        toolDescription: 'Generate speech patterns for character development',
        ...SPEECH_PATTERNS_LLM_PARAMS,
      };

      this.#logger.debug('Calling LLM for speech patterns generation', {
        promptLength: prompt.length,
        requestOptions,
      });

      return await this.#llmStrategyFactory.getAIDecision(
        prompt,
        options.abortSignal || null,
        requestOptions
      );
    } catch (error) {
      throw new SpeechPatternsGenerationError(
        `LLM request failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Parse LLM response using response processor
   *
   * @private
   * @param {string} rawResponse - Raw LLM response
   * @param {object} context - Generation context
   * @returns {Promise<object>} Parsed response
   */
  async #parseResponse(rawResponse, context) {
    try {
      return await this.#responseProcessor.processResponse(rawResponse, context);
    } catch (error) {
      throw new SpeechPatternsResponseProcessingError(
        `Failed to parse LLM response: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate and enhance final response
   *
   * @private
   * @param {object} parsedResponse - Parsed response
   * @param {object} options - Generation options
   * @returns {object} Validated and enhanced result
   */
  #validateAndEnhance(parsedResponse, options) {
    try {
      // Additional business logic validation
      this.#validateBusinessRules(parsedResponse, options);

      // Enhance with additional metadata
      return {
        ...parsedResponse,
        metadata: {
          ...parsedResponse.metadata,
          generatorVersion: PROMPT_VERSION_INFO.version,
          generationOptions: options,
          qualityScore: this.#calculateQualityScore(parsedResponse),
        },
      };
    } catch (error) {
      throw new SpeechPatternsValidationError(
        `Response validation failed: ${error.message}`,
        [],
        error
      );
    }
  }

  /**
   * Validate business rules for generated patterns
   *
   * @private
   * @param {object} response - Parsed response
   * @param {object} options - Generation options
   */
  #validateBusinessRules(response, options) {
    const patterns = response.speechPatterns;

    // Check minimum pattern count
    const minPatterns = options.patternCount ? Math.max(3, Math.floor(options.patternCount * 0.7)) : 3;
    if (patterns.length < minPatterns) {
      throw new Error(`Insufficient patterns generated: ${patterns.length} < ${minPatterns}`);
    }

    // Check for duplicate patterns
    const uniquePatterns = new Set(patterns.map(p => p.pattern.toLowerCase()));
    if (uniquePatterns.size < patterns.length * 0.8) {
      throw new Error('Too many similar patterns detected');
    }

    // Check pattern quality
    const lowQualityPatterns = patterns.filter(p => 
      p.pattern.length < 5 || p.example.length < 3
    );
    if (lowQualityPatterns.length > patterns.length * 0.2) {
      throw new Error('Too many low-quality patterns detected');
    }
  }

  /**
   * Calculate quality score for generated patterns
   *
   * @private
   * @param {object} response - Parsed response
   * @returns {number} Quality score (0-1)
   */
  #calculateQualityScore(response) {
    const patterns = response.speechPatterns;
    let score = 0;

    // Pattern count score (25%)
    const countScore = Math.min(patterns.length / 20, 1) * 0.25;
    score += countScore;

    // Pattern quality score (50%)
    const avgPatternLength = patterns.reduce((sum, p) => sum + p.pattern.length, 0) / patterns.length;
    const avgExampleLength = patterns.reduce((sum, p) => sum + p.example.length, 0) / patterns.length;
    const qualityScore = ((avgPatternLength / 50) + (avgExampleLength / 30)) / 2 * 0.5;
    score += Math.min(qualityScore, 0.5);

    // Diversity score (15%)
    const uniqueFirstWords = new Set(patterns.map(p => p.pattern.split(' ')[0].toLowerCase()));
    const diversityScore = (uniqueFirstWords.size / patterns.length) * 0.15;
    score += diversityScore;

    // Circumstances coverage score (10%)
    const patternsWithCircumstances = patterns.filter(p => p.circumstances && p.circumstances.trim());
    const circumstancesScore = (patternsWithCircumstances.length / patterns.length) * 0.1;
    score += circumstancesScore;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Extract character name from character data
   *
   * @private
   * @param {object} characterData - Character data
   * @returns {string} Character name
   */
  #extractCharacterName(characterData) {
    // Try to find name in various component formats
    const nameComponent = characterData['core:name'];
    if (nameComponent && nameComponent.name) {
      return nameComponent.name;
    }

    // Try other possible name fields
    for (const [key, value] of Object.entries(characterData)) {
      if (key.includes('name') && value && typeof value === 'object' && value.name) {
        return value.name;
      }
    }

    return 'Character';
  }

  /**
   * Get service information and capabilities
   *
   * @returns {object} Service info
   */
  getServiceInfo() {
    return {
      name: 'SpeechPatternsGenerator',
      version: PROMPT_VERSION_INFO.version,
      capabilities: [
        'NC-21 content generation',
        'Multiple focus types',
        'Flexible pattern counts',
        'Quality scoring',
        'Response validation',
      ],
      supportedFocusTypes: [
        'EMOTIONAL_FOCUS',
        'SOCIAL_FOCUS', 
        'PSYCHOLOGICAL_FOCUS',
        'RELATIONSHIP_FOCUS',
      ],
      llmParameters: SPEECH_PATTERNS_LLM_PARAMS,
    };
  }
}

export default SpeechPatternsGenerator;