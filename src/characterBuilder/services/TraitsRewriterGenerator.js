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
  TRAITS_REWRITER_RESPONSE_SCHEMA,
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
   * @param {string} [options.llmConfigId] - Specific LLM configuration ID to use
   * @returns {Promise<object>} Rewritten traits result
   */
  async generateRewrittenTraits(characterDefinition, options = {}) {
    const startTime = Date.now();
    const characterName = this.#extractCharacterName(characterDefinition);

    // If specific LLM config ID provided, temporarily set it as active
    const originalLlmId = options.llmConfigId
      ? await this.#llmConfigManager.getActiveConfigId()
      : null;
    if (options.llmConfigId) {
      await this.#llmConfigManager.setActiveConfiguration(options.llmConfigId);
    }

    this.#logger.info('TraitsRewriterGenerator: Starting generation', {
      characterName,
      options,
      activeLlmId: options.llmConfigId || originalLlmId,
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
        characterName: validatedResult.characterName,
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

      // Restore original LLM configuration if it was temporarily changed
      if (options.llmConfigId && originalLlmId) {
        await this.#llmConfigManager.setActiveConfiguration(originalLlmId);
      }

      return result;
    } catch (error) {
      // Restore original LLM configuration even in case of error
      if (options.llmConfigId && originalLlmId) {
        try {
          await this.#llmConfigManager.setActiveConfiguration(originalLlmId);
        } catch (restoreError) {
          this.#logger.error(
            'Failed to restore original LLM configuration',
            restoreError
          );
        }
      }

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
      // Check for nested structure first (components), then fallback to root level
      const traitData =
        characterDefinition.components?.[traitKey] ||
        characterDefinition[traitKey];

      if (traitData) {
        // Special handling for array-based traits (goals and notes)
        if (traitKey === 'core:goals' && traitData.goals) {
          // Extract array of goal texts
          extractedTraits[traitKey] = traitData.goals.map(
            (goal) => goal.text || goal
          );
        } else if (traitKey === 'core:notes' && traitData.notes) {
          // Extract array of note texts
          extractedTraits[traitKey] = traitData.notes.map(
            (note) => note.text || note
          );
        } else if (typeof traitData === 'string') {
          // Handle simple string traits
          extractedTraits[traitKey] = traitData;
        } else if (traitData.text) {
          // Handle object with text property
          extractedTraits[traitKey] = traitData.text;
        } else if (traitData.description) {
          // Handle object with description property
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
  #createLLMPrompt(characterDefinition, options) {
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
      // Create request options including tool schema for proper LLM response format
      const requestOptions = {
        temperature: TRAITS_REWRITER_LLM_PARAMS.temperature,
        maxTokens: TRAITS_REWRITER_LLM_PARAMS.max_tokens,
        toolSchema: TRAITS_REWRITER_RESPONSE_SCHEMA,
        toolName: 'rewrite_character_traits',
        toolDescription:
          "Rewrite character traits from third-person to first-person perspective using the character's unique voice",
      };

      // Call getAIDecision with correct signature: (prompt, abortSignal, requestOptions)
      const response = await this.#llmStrategyFactory.getAIDecision(
        prompt,
        null, // No abort signal
        requestOptions
      );

      // Handle both string responses and object responses with content property
      const responseContent =
        typeof response === 'string' ? response : response?.content;

      if (!responseContent) {
        throw TraitsRewriterError.forLLMFailure(
          'Empty response received from LLM',
          {
            characterName,
            activeConfig: activeConfig?.name,
          }
        );
      }

      // Parse and repair JSON response
      const parsedResponse =
        this.#llmJsonService.parseAndRepair(responseContent);

      const getSafeKeys = (value) =>
        value && typeof value === 'object' ? Object.keys(value) : [];

      // Debug logging to understand response structure
      this.#logger.debug(
        'TraitsRewriterGenerator: Raw parsed response structure',
        {
          characterName,
          responseKeys: getSafeKeys(parsedResponse),
          hasCharacterName: !!parsedResponse?.characterName,
          hasFunctionCall: !!parsedResponse?.function_call,
          hasNestedCharacterName:
            !!parsedResponse?.function_call?.characterName,
        }
      );

      // Handle tool call wrapper structure
      // The LLM might return the response wrapped in a function_call object
      let actualResponse = parsedResponse;

      const isObjectResponse =
        parsedResponse && typeof parsedResponse === 'object';

      // Check if response is wrapped in function_call or similar structure
      if (
        isObjectResponse &&
        parsedResponse.function_call &&
        typeof parsedResponse.function_call === 'object'
      ) {
        this.#logger.info(
          'TraitsRewriterGenerator: Extracting response from function_call wrapper',
          {
            characterName,
            wrapperKeys: getSafeKeys(parsedResponse.function_call),
          }
        );
        actualResponse = parsedResponse.function_call;
      } else if (
        isObjectResponse &&
        !parsedResponse.characterName &&
        !parsedResponse.rewrittenTraits
      ) {
        // If the expected fields aren't at the root, check for other wrapper properties
        const possibleWrappers = Object.keys(parsedResponse).filter((key) => {
          const value = parsedResponse[key];
          return (
            value &&
            typeof value === 'object' &&
            (value.characterName || value.rewrittenTraits)
          );
        });

        if (possibleWrappers.length > 0) {
          this.#logger.info(
            'TraitsRewriterGenerator: Found response in wrapper property',
            {
              characterName,
              wrapperProperty: possibleWrappers[0],
            }
          );
          actualResponse = parsedResponse[possibleWrappers[0]];
        }
      }

      // Additional debug logging for the extracted response
      this.#logger.debug(
        'TraitsRewriterGenerator: Extracted response for validation',
        {
          characterName,
          extractedKeys: getSafeKeys(actualResponse),
          hasCharacterName: !!actualResponse?.characterName,
          hasRewrittenTraits: !!actualResponse?.rewrittenTraits,
          rewrittenTraitsKeys: actualResponse?.rewrittenTraits
            ? Object.keys(actualResponse.rewrittenTraits)
            : [],
        }
      );

      return actualResponse;
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

    // Log the actual response structure for debugging
    if (!response.characterName) {
      this.#logger.error(
        'TraitsRewriterGenerator: Missing characterName in response',
        {
          characterName,
          responseStructure: JSON.stringify(response, null, 2).substring(
            0,
            500
          ), // First 500 chars for debugging
          responseKeys: Object.keys(response),
          responseType: typeof response,
        }
      );

      throw TraitsRewriterError.forValidationFailure(
        'characterName',
        'Missing character name in response. Response structure: ' +
          JSON.stringify(Object.keys(response)),
        { characterName, actualResponse: response }
      );
    }

    if (
      !response.rewrittenTraits ||
      typeof response.rewrittenTraits !== 'object'
    ) {
      this.#logger.error(
        'TraitsRewriterGenerator: Missing or invalid rewrittenTraits',
        {
          characterName,
          hasRewrittenTraits: !!response.rewrittenTraits,
          rewrittenTraitsType: typeof response.rewrittenTraits,
          responseKeys: Object.keys(response),
        }
      );

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
      this.#logger.warn(
        'TraitsRewriterGenerator: Response contains unsupported trait keys',
        {
          characterName,
          invalidKeys: invalidTraitKeys,
          validKeys: DEFAULT_TRAIT_KEYS,
        }
      );
    }

    this.#logger.debug('TraitsRewriterGenerator: Validation successful', {
      characterName,
      traitCount,
      traits: Object.keys(response.rewrittenTraits),
    });

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
    // Check for nested structure first (components), then fallback to root level
    const nameData =
      characterDefinition.components?.['core:name'] ||
      characterDefinition['core:name'];

    if (nameData) {
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
   * Get the schema used for LLM response validation
   *
   * @returns {object} JSON schema object
   */
  getResponseSchema() {
    return TRAITS_REWRITER_RESPONSE_SCHEMA;
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
