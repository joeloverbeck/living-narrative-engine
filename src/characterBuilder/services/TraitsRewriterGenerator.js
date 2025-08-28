/**
 * @file Service for rewriting character traits via LLM
 * @description Main service for traits rewriting generation following established pattern
 * @see SpeechPatternsGenerator.js
 * @see TraitsGenerator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  createTraitsRewriterPrompt,
  DEFAULT_TRAIT_KEYS,
  TRAITS_REWRITER_LLM_PARAMS,
} from '../prompts/traitsRewriterPrompts.js';
import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';
import { TraitsRewriterError } from '../errors/TraitsRewriterError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 */

/**
 * Service for rewriting character traits via LLM
 * Following the established three-service pattern used by other character builder services
 * Orchestrates trait extraction, LLM integration, and response processing
 */
export class TraitsRewriterGenerator {
  /** @private @type {ILogger} */
  #logger;

  /** @private @type {LlmJsonService} */
  #llmJsonService;

  /** @private @type {ConfigurableLLMAdapter} */
  #llmStrategyFactory;

  /** @private @type {ILLMConfigurationManager} */
  #llmConfigManager;

  /** @private @type {ISafeEventDispatcher} */
  #eventBus;

  /** @private @type {ITokenEstimator} */
  #tokenEstimator;

  /**
   * Create a new TraitsRewriterGenerator instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter (provides strategy factory functionality)
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {ITokenEstimator} [dependencies.tokenEstimator] - Token estimation service (optional)
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
  }) {
    this.#validateDependencies({
      logger,
      llmJsonService,
      llmStrategyFactory,
      llmConfigManager,
      eventBus,
      tokenEstimator,
    });

    // Store dependencies
    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
    this.#tokenEstimator = tokenEstimator;

    this.#logger.info('TraitsRewriterGenerator: Initialized successfully');
  }

  /**
   * Main entry point for trait rewriting workflow
   *
   * @param {object} characterDefinition - Complete character definition
   * @param {object} options - Generation options
   * @returns {Promise<object>} Rewritten traits result
   */
  async generateRewrittenTraits(characterDefinition, options = {}) {
    const startTime = Date.now();
    const characterName = this.#extractCharacterName(characterDefinition);

    this.#logger.info('TraitsRewriterGenerator: Starting generation', {
      characterName,
      options,
    });

    try {
      // Dispatch generation started event
      this.#dispatchGenerationEvents(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
        {
          characterName,
          timestamp: new Date().toISOString(),
        }
      );

      // Step 1: Validate and extract relevant traits
      const relevantTraits = this.#extractRelevantTraits(characterDefinition);

      if (!relevantTraits || Object.keys(relevantTraits).length === 0) {
        throw TraitsRewriterError.forMissingTraits(characterName, {
          characterName,
          availableTraits: Object.keys(characterDefinition),
        });
      }

      // Step 2: Create LLM prompt
      const prompt = this.#createLLMPrompt(characterDefinition, options);

      // Step 3: Estimate token usage if estimator available
      if (this.#tokenEstimator) {
        const tokenCount = this.#tokenEstimator.estimateTokens(prompt);
        this.#logger.debug('TraitsRewriterGenerator: Token estimation', {
          characterName,
          estimatedTokens: tokenCount,
        });
      }

      // Step 4: Execute LLM generation
      const generationResult = await this.#executeGeneration(
        prompt,
        characterName
      );

      // Step 5: Validate generation result
      const validatedResult = this.#validateGenerationResult(
        generationResult,
        characterName
      );

      // Step 6: Prepare final result
      const result = {
        characterName: validatedResult.characterName || characterName,
        rewrittenTraits: validatedResult.rewrittenTraits,
        generatedAt: validatedResult.generatedAt || new Date().toISOString(),
        processingTime: Date.now() - startTime,
        originalTraitCount: Object.keys(relevantTraits).length,
        rewrittenTraitCount: Object.keys(validatedResult.rewrittenTraits)
          .length,
      };

      // Dispatch generation completed event
      this.#dispatchGenerationEvents(
        CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        {
          characterName,
          result,
          processingTime: result.processingTime,
          timestamp: new Date().toISOString(),
        }
      );

      this.#logger.info(
        'TraitsRewriterGenerator: Generation completed successfully',
        {
          characterName,
          processingTime: result.processingTime,
          traitCount: result.rewrittenTraitCount,
        }
      );

      return result;
    } catch (error) {
      return this.#handleGenerationErrors(error, {
        characterName,
        processingTime: Date.now() - startTime,
        options,
      });
    }
  }

  /**
   * Extract relevant traits from character definition
   *
   * @private
   * @param {object} characterDefinition - Character definition
   * @returns {object} Extracted traits
   */
  #extractRelevantTraits(characterDefinition) {
    const extractedTraits = {};

    for (const traitKey of DEFAULT_TRAIT_KEYS) {
      const traitData = characterDefinition[traitKey];

      if (traitData) {
        // Handle different trait data formats
        if (typeof traitData === 'string') {
          extractedTraits[traitKey] = traitData;
        } else if (traitData.text) {
          extractedTraits[traitKey] = traitData.text;
        } else if (traitData.description) {
          extractedTraits[traitKey] = traitData.description;
        }
      }
    }

    this.#logger.debug('TraitsRewriterGenerator: Extracted traits', {
      traitKeys: Object.keys(extractedTraits),
      traitCount: Object.keys(extractedTraits).length,
    });

    return extractedTraits;
  }

  /**
   * Create LLM prompt with character data
   *
   * @private
   * @param {object} characterDefinition - Character definition
   * @param {object} options - Generation options
   * @returns {string} Formatted prompt
   */
  #createLLMPrompt(characterDefinition, options = {}) {
    try {
      return createTraitsRewriterPrompt(characterDefinition, options);
    } catch (error) {
      throw TraitsRewriterError.forGenerationFailure(
        'Failed to create LLM prompt',
        { options },
        error
      );
    }
  }

  /**
   * Execute LLM generation with proper error handling
   *
   * @private
   * @param {string} prompt - LLM prompt
   * @param {string} characterName - Character name for context
   * @returns {Promise<object>} Generation result
   */
  async #executeGeneration(prompt, characterName) {
    try {
      // Get active LLM configuration
      const activeConfig = this.#llmConfigManager.getActiveConfiguration();

      // Generate content with proper parameters using ConfigurableLLMAdapter
      const response = await this.#llmStrategyFactory.getAIDecision({
        prompt: prompt,
        temperature: TRAITS_REWRITER_LLM_PARAMS.temperature,
        maxTokens: TRAITS_REWRITER_LLM_PARAMS.max_tokens,
        stream: false, // Ensure we get complete response
      });

      if (!response || !response.content) {
        throw TraitsRewriterError.forLLMFailure(
          'Empty response received from LLM',
          {
            characterName,
            activeConfig: activeConfig?.name,
          }
        );
      }

      // Parse and repair JSON response
      const parsedResponse = this.#llmJsonService.parseAndRepair(
        response.content
      );

      return parsedResponse;
    } catch (error) {
      if (error instanceof TraitsRewriterError) {
        throw error;
      }

      throw TraitsRewriterError.forLLMFailure(
        `LLM generation failed: ${error.message}`,
        { characterName },
        error
      );
    }
  }

  /**
   * Validate generation result against expected schema
   *
   * @private
   * @param {object} response - LLM response
   * @param {string} characterName - Character name for context
   * @returns {object} Validated response
   */
  #validateGenerationResult(response, characterName) {
    if (!response) {
      throw TraitsRewriterError.forValidationFailure(
        'response',
        'Null or undefined response',
        { characterName }
      );
    }

    if (!response.characterName) {
      throw TraitsRewriterError.forValidationFailure(
        'characterName',
        'Missing character name in response',
        { characterName }
      );
    }

    if (
      !response.rewrittenTraits ||
      typeof response.rewrittenTraits !== 'object'
    ) {
      throw TraitsRewriterError.forValidationFailure(
        'rewrittenTraits',
        'Missing or invalid rewritten traits object',
        { characterName }
      );
    }

    // Validate that we have at least one rewritten trait
    const traitCount = Object.keys(response.rewrittenTraits).length;
    if (traitCount === 0) {
      throw TraitsRewriterError.forValidationFailure(
        'rewrittenTraits',
        'No traits were rewritten',
        { characterName }
      );
    }

    // Validate trait keys are supported
    const invalidTraitKeys = Object.keys(response.rewrittenTraits).filter(
      (key) => !DEFAULT_TRAIT_KEYS.includes(key)
    );

    if (invalidTraitKeys.length > 0) {
      this.#logger.warn('TraitsRewriterGenerator: Invalid trait keys found', {
        characterName,
        invalidKeys: invalidTraitKeys,
        validKeys: DEFAULT_TRAIT_KEYS,
      });
    }

    return response;
  }

  /**
   * Handle generation errors comprehensively
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @throws {TraitsRewriterError} Always throws
   */
  #handleGenerationErrors(error, context) {
    const errorContext = {
      ...context,
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name,
      errorMessage: error.message,
    };

    // Log the error with context
    this.#logger.error('TraitsRewriterGenerator: Generation failed', {
      error: error.message,
      stack: error.stack,
      ...errorContext,
    });

    // Dispatch error event
    this.#dispatchGenerationEvents(
      CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED,
      {
        error: error.message,
        ...errorContext,
      }
    );

    // Re-throw as TraitsRewriterError if not already
    if (error instanceof TraitsRewriterError) {
      throw error;
    }

    throw TraitsRewriterError.forGenerationFailure(
      error.message,
      errorContext,
      error
    );
  }

  /**
   * Dispatch generation events
   *
   * @private
   * @param {string} eventType - Event type
   * @param {object} payload - Event payload
   */
  #dispatchGenerationEvents(eventType, payload) {
    try {
      this.#eventBus.dispatch(eventType, payload);
    } catch (error) {
      this.#logger.error('TraitsRewriterGenerator: Event dispatch failed', {
        eventType,
        error: error.message,
      });
    }
  }

  /**
   * Extract character name from definition
   *
   * @private
   * @param {object} characterDefinition - Character definition
   * @returns {string} Character name
   */
  #extractCharacterName(characterDefinition) {
    if (characterDefinition['core:name']) {
      const nameData = characterDefinition['core:name'];

      if (typeof nameData === 'string') {
        return nameData;
      }

      if (nameData.text) {
        return nameData.text;
      }

      if (nameData.name) {
        return nameData.name;
      }
    }

    return 'Unknown Character';
  }

  /**
   * Validate all constructor dependencies
   *
   * @private
   * @param {object} dependencies - Dependencies to validate
   */
  #validateDependencies(dependencies) {
    const {
      logger,
      llmJsonService,
      llmStrategyFactory,
      llmConfigManager,
      eventBus,
      tokenEstimator,
    } = dependencies;

    // Validate required dependencies
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(llmJsonService, 'LlmJsonService', logger, {
      requiredMethods: ['clean', 'parseAndRepair'],
    });
    validateDependency(llmStrategyFactory, 'ConfigurableLLMAdapter', logger, {
      requiredMethods: ['getAIDecision'],
    });
    validateDependency(llmConfigManager, 'ILLMConfigurationManager', logger, {
      requiredMethods: ['getActiveConfiguration'],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    // Optional dependency
    if (tokenEstimator) {
      validateDependency(tokenEstimator, 'ITokenEstimator', logger, {
        requiredMethods: ['estimateTokens'],
      });
    }
  }

  /**
   * Get service information
   *
   * @returns {object} Service metadata
   */
  getServiceInfo() {
    return {
      name: 'TraitsRewriterGenerator',
      version: '1.0.0',
      status: 'active',
      supportedTraitTypes: DEFAULT_TRAIT_KEYS,
      implementationStatus: 'completed',
    };
  }
}

export default TraitsRewriterGenerator;
