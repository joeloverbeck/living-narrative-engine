/**
 * @file Service for generating character traits via LLM
 * @see CharacterBuilderService.js
 * @see ../models/trait.js
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import {
  buildTraitsGenerationPrompt,
  validateTraitsGenerationResponse,
  TRAITS_RESPONSE_SCHEMA,
  TRAITS_GENERATION_LLM_PARAMS,
  PROMPT_VERSION_INFO,
} from '../prompts/traitsGenerationPrompt.js';
import { TraitsGenerationError } from '../errors/TraitsGenerationError.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 * @typedef {import('../../interfaces/IRetryManager.js').IRetryManager} IRetryManager
 */

/**
 * Service for generating comprehensive character traits via LLM
 *
 * This service orchestrates the traits generation workflow from input validation
 * through response processing and event dispatching. Generated traits are NOT
 * stored permanently per storage policy requirements.
 */
export class TraitsGenerator {
  #logger;
  #llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;
  #eventBus;
  #tokenEstimator;
  #retryManager;

  /**
   * Create a new TraitsGenerator instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {ITokenEstimator} [dependencies.tokenEstimator] - Token estimation service (optional)
   * @param {IRetryManager} dependencies.retryManager - Retry manager for exponential backoff
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
    retryManager,
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

    // TokenEstimator is optional - fallback to simple estimation if not provided
    if (tokenEstimator) {
      validateDependency(tokenEstimator, 'ITokenEstimator', null, {
        requiredMethods: ['estimateTokens'],
      });
    }

    validateDependency(retryManager, 'IRetryManager', null, {
      requiredMethods: ['retry'],
    });

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
    this.#tokenEstimator = tokenEstimator;
    this.#retryManager = retryManager;
  }

  /**
   * Generate character traits based on concept, direction, user inputs, and cliches
   *
   * @param {object} params - Generation parameters
   * @param {object} params.concept - Character concept object
   * @param {object} params.direction - Thematic direction object
   * @param {object} params.userInputs - User-provided core motivation, contradiction, question
   * @param {Array} params.cliches - Array of cliche objects to avoid
   * @param {object} [options] - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @param {number} [options.maxRetries] - Maximum retry attempts
   * @returns {Promise<object>} Generated traits data (not stored per policy)
   * @throws {TraitsGenerationError} If generation fails
   */
  async generateTraits(params, options = {}) {
    // Validate all inputs first
    this.#validateInputs(params);

    const { concept, direction, userInputs, cliches } = params;

    this.#logger.info(
      `TraitsGenerator: Starting generation for concept ${concept.id}`,
      {
        conceptId: concept.id,
        directionId: direction.id,
        conceptLength: concept.concept?.length || 0,
        directionTitle: direction.title,
        clichesCount: cliches?.length || 0,
      }
    );

    const startTime = Date.now();

    // Dispatch generation started event
    this.#eventBus.dispatch('core:traits_generation_started', {
      conceptId: concept.id,
      directionId: direction.id,
      timestamp: new Date().toISOString(),
      metadata: {
        conceptLength: concept.concept?.length || 0,
        clichesCount: cliches?.length || 0,
        promptVersion: PROMPT_VERSION_INFO.version,
      },
    });

    try {
      // Use retry mechanism with configurable retry count
      const maxRetries =
        options.maxRetries !== undefined ? options.maxRetries : 2;
      const retryParams = {
        concept,
        direction,
        userInputs,
        cliches,
        llmConfigId: options.llmConfigId,
      };

      const parsedResponse = await this.#generateWithRetry(
        retryParams,
        maxRetries
      );
      const processingTime = Date.now() - startTime;

      // Get active config for metadata
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();

      // Create enhanced metadata with token tracking
      const prompt = buildTraitsGenerationPrompt(
        concept.concept,
        direction,
        userInputs,
        cliches
      );
      const promptTokens = await this.#estimateTokens(
        prompt,
        activeConfig?.configId
      );
      const responseTokens = await this.#estimateTokens(
        JSON.stringify(parsedResponse),
        activeConfig?.configId
      );

      const metadata = {
        model: activeConfig?.configId || 'unknown',
        promptTokens,
        responseTokens,
        totalTokens: promptTokens + responseTokens,
        responseTime: processingTime,
        retryAttempts: maxRetries,
        promptVersion: PROMPT_VERSION_INFO.version,
        qualityChecks: ['structure', 'quality', 'length', 'format'],
        generationPrompt: prompt.substring(0, 500) + '...', // Truncated for storage
      };

      this.#logger.info('TraitsGenerator: Successfully generated traits', {
        conceptId: concept.id,
        directionId: direction.id,
        processingTime,
        totalTokens: metadata.totalTokens,
      });

      // Dispatch completion event
      this.#eventBus.dispatch('core:traits_generation_completed', {
        conceptId: concept.id,
        directionId: direction.id,
        generationTime: processingTime,
        timestamp: new Date().toISOString(),
        metadata,
      });

      // Return traits data with metadata (NOT stored per storage policy)
      return {
        ...parsedResponse,
        metadata,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const failureStage = this.#determineFailureStage(error);

      this.#logger.error('TraitsGenerator: Generation failed', {
        conceptId: concept.id,
        directionId: direction.id,
        error: error.message,
        processingTime,
        failureStage,
      });

      // Dispatch failure event
      this.#eventBus.dispatch('core:traits_generation_failed', {
        conceptId: concept.id,
        directionId: direction.id,
        error: error.message,
        processingTime,
        failureStage,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof TraitsGenerationError) {
        throw error;
      }

      throw new TraitsGenerationError(
        `Failed to generate traits for concept ${concept.id}: ${error.message}`,
        {
          conceptId: concept.id,
          directionId: direction.id,
          stage: failureStage,
        },
        error
      );
    }
  }

  /**
   * Validate all input parameters for traits generation
   *
   * @param {object} params - Parameters to validate
   * @private
   * @throws {TraitsGenerationError} If validation fails
   */
  #validateInputs(params) {
    assertPresent(params, 'Generation parameters are required');

    const { concept, direction, userInputs, cliches } = params;

    // Validate concept object
    if (!concept || typeof concept !== 'object') {
      throw TraitsGenerationError.forValidation(
        'concept',
        'must be a valid object'
      );
    }

    if (
      !concept.id ||
      typeof concept.id !== 'string' ||
      concept.id.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'concept.id',
        'must be a non-empty string'
      );
    }

    if (
      !concept.concept ||
      typeof concept.concept !== 'string' ||
      concept.concept.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'concept.concept',
        'must be a non-empty string'
      );
    }

    // Validate direction object
    if (!direction || typeof direction !== 'object') {
      throw TraitsGenerationError.forValidation(
        'direction',
        'must be a valid object'
      );
    }

    if (
      !direction.id ||
      typeof direction.id !== 'string' ||
      direction.id.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'direction.id',
        'must be a non-empty string'
      );
    }

    if (
      !direction.title ||
      typeof direction.title !== 'string' ||
      direction.title.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'direction.title',
        'must be a non-empty string'
      );
    }

    if (
      !direction.description ||
      typeof direction.description !== 'string' ||
      direction.description.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'direction.description',
        'must be a non-empty string'
      );
    }

    if (
      !direction.coreTension ||
      typeof direction.coreTension !== 'string' ||
      direction.coreTension.trim().length === 0
    ) {
      throw TraitsGenerationError.forValidation(
        'direction.coreTension',
        'must be a non-empty string'
      );
    }

    // Validate user inputs
    if (!userInputs || typeof userInputs !== 'object') {
      throw TraitsGenerationError.forValidation(
        'userInputs',
        'must be a valid object'
      );
    }

    assertNonBlankString(
      userInputs.coreMotivation,
      'coreMotivation',
      'TraitsGenerator.generateTraits',
      this.#logger
    );
    assertNonBlankString(
      userInputs.internalContradiction,
      'internalContradiction',
      'TraitsGenerator.generateTraits',
      this.#logger
    );
    assertNonBlankString(
      userInputs.centralQuestion,
      'centralQuestion',
      'TraitsGenerator.generateTraits',
      this.#logger
    );

    // Validate cliches (must be object with categories or tropesAndStereotypes)
    if (cliches !== null && cliches !== undefined) {
      if (typeof cliches !== 'object') {
        throw TraitsGenerationError.forValidation(
          'cliches',
          'must be an object or null'
        );
      }

      // Ensure cliches have at least some content
      const hasCategories =
        cliches.categories && Object.keys(cliches.categories).length > 0;
      const hasTropes =
        cliches.tropesAndStereotypes && cliches.tropesAndStereotypes.length > 0;

      if (!hasCategories && !hasTropes) {
        this.#logger.warn('TraitsGenerator: Clichés object is empty', {
          conceptId: concept.id,
          directionId: direction.id,
        });
      }
    }
  }

  /**
   * Generate traits with retry logic for transient failures
   *
   * @param {object} params - Generation parameters
   * @param {number} [maxRetries] - Maximum number of retry attempts
   * @returns {Promise<object>} Parsed and validated response
   * @throws {TraitsGenerationError} If all attempts fail
   * @private
   */
  async #generateWithRetry(params, maxRetries = 2) {
    let attemptCount = 0;

    const operation = async () => {
      attemptCount++;

      try {
        // Build the prompt
        const prompt = buildTraitsGenerationPrompt(
          params.concept.concept,
          params.direction,
          params.userInputs,
          params.cliches
        );

        this.#logger.debug('TraitsGenerator: Built prompt', {
          promptLength: prompt.length,
          conceptId: params.concept.id,
          directionId: params.direction.id,
          attempt: attemptCount,
          maxRetries,
        });

        // Get LLM response
        const llmResponse = await this.#callLLM(prompt, params.llmConfigId);

        // Parse and validate response
        const parsedResponse = await this.#parseResponse(llmResponse);
        this.#validateResponseStructure(parsedResponse);
        this.#validateResponseQuality(parsedResponse);

        this.#logger.debug('TraitsGenerator: Generation succeeded', {
          conceptId: params.concept.id,
          directionId: params.direction.id,
          attempt: attemptCount,
        });

        return parsedResponse;
      } catch (error) {
        this.#logger.warn(`TraitsGenerator: Attempt ${attemptCount} failed`, {
          error: error.message,
          attempt: attemptCount,
          maxRetries,
          conceptId: params.concept.id,
          directionId: params.direction.id,
        });
        throw error; // Let RetryManager handle retry logic
      }
    };

    try {
      // Delegate retry logic to injected RetryManager
      return await this.#retryManager.retry(operation, {
        maxAttempts: maxRetries + 1,
        delay: 1000,
        exponentialBackoff: true,
        maxDelay: 30000,
      });
    } catch (error) {
      this.#logger.error('TraitsGenerator: All retry attempts exhausted', {
        totalAttempts: attemptCount,
        maxRetries,
        conceptId: params.concept.id,
        directionId: params.direction.id,
        finalError: error.message,
      });

      // All attempts failed, throw the last error
      if (error instanceof TraitsGenerationError) {
        // Add retry context to existing error
        throw new TraitsGenerationError(
          `${error.message} (after ${attemptCount} attempts)`,
          {
            ...error.context,
            totalAttempts: attemptCount,
            maxRetries,
          },
          error.cause
        );
      }

      throw new TraitsGenerationError(
        `Generation failed after ${attemptCount} attempts: ${error.message}`,
        {
          conceptId: params.concept.id,
          directionId: params.direction.id,
          totalAttempts: attemptCount,
          maxRetries,
          stage: 'retry_exhausted',
        },
        error
      );
    }
  }

  /**
   * Call the LLM with the generated prompt
   *
   * @param {string} prompt - Formatted prompt
   * @param {string} [llmConfigId] - Specific LLM config to use
   * @returns {Promise<string>} Raw LLM response
   * @throws {TraitsGenerationError} If LLM call fails
   * @private
   */
  async #callLLM(prompt, llmConfigId) {
    try {
      // Set active LLM configuration if specified
      if (llmConfigId) {
        const success =
          await this.#llmConfigManager.setActiveConfiguration(llmConfigId);
        if (!success) {
          const config =
            await this.#llmConfigManager.loadConfiguration(llmConfigId);
          if (!config) {
            throw TraitsGenerationError.forLLMFailure(
              `LLM configuration not found: ${llmConfigId}`,
              { llmConfigId }
            );
          }
        }
      }

      // Get the current active configuration
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();
      if (!activeConfig) {
        throw TraitsGenerationError.forLLMFailure(
          'No active LLM configuration found',
          {}
        );
      }

      // Prepare request options with custom schema
      const requestOptions = {
        toolSchema: TRAITS_RESPONSE_SCHEMA,
        toolName: 'generate_character_traits',
        toolDescription:
          'Generate comprehensive character traits based on concept, thematic direction, user inputs, and cliché avoidance guidelines',
      };

      // Use the ConfigurableLLMAdapter with request options
      const response = await this.#llmStrategyFactory.getAIDecision(
        prompt,
        null, // no abort signal
        requestOptions
      );

      this.#logger.debug('TraitsGenerator: Received LLM response', {
        responseLength: response.length,
        modelId: activeConfig.configId,
      });

      return response;
    } catch (error) {
      if (error instanceof TraitsGenerationError) {
        throw error;
      }
      throw TraitsGenerationError.forLLMFailure(error.message, {}, error);
    }
  }

  /**
   * Parse and clean LLM response
   *
   * @param {string} rawResponse - Raw LLM response
   * @returns {Promise<object>} Parsed response object
   * @throws {TraitsGenerationError} If parsing fails
   * @private
   */
  async #parseResponse(rawResponse) {
    try {
      const cleanedResponse = this.#llmJsonService.clean(rawResponse);
      const parsedResponse = await this.#llmJsonService.parseAndRepair(
        cleanedResponse,
        {
          logger: this.#logger,
        }
      );

      this.#logger.debug('TraitsGenerator: Successfully parsed LLM response');
      return parsedResponse;
    } catch (error) {
      if (error instanceof TraitsGenerationError) {
        throw error;
      }
      throw TraitsGenerationError.forParsingFailure(error.message, {}, error);
    }
  }

  /**
   * Validate response structure against schema
   *
   * @param {object} response - Parsed response
   * @throws {TraitsGenerationError} If validation fails
   * @private
   */
  #validateResponseStructure(response) {
    try {
      validateTraitsGenerationResponse(response);
      this.#logger.debug(
        'TraitsGenerator: Response structure validated successfully'
      );
    } catch (error) {
      if (error instanceof TraitsGenerationError) {
        throw error;
      }
      throw new TraitsGenerationError(
        `Invalid response structure: ${error.message}`,
        { stage: 'structure_validation' },
        error
      );
    }
  }

  /**
   * Validate response quality beyond structural validation
   *
   * @param {object} response - Parsed response
   * @throws {TraitsGenerationError} If quality issues are found
   * @private
   */
  #validateResponseQuality(response) {
    const issues = [];

    // Validate physical description length
    if (
      response.physicalDescription &&
      response.physicalDescription.length < 100
    ) {
      issues.push('Physical description too brief (minimum 100 characters)');
    }

    // Validate profile length
    if (response.profile && response.profile.length < 200) {
      issues.push('Profile too brief (minimum 200 characters)');
    }

    // Validate names have justifications
    if (response.names && Array.isArray(response.names)) {
      response.names.forEach((nameItem, index) => {
        if (!nameItem.justification || nameItem.justification.length < 20) {
          issues.push(
            `Name ${index + 1}: Justification too brief (minimum 20 characters)`
          );
        }
      });
    }

    // Validate personality explanations
    if (response.personality && Array.isArray(response.personality)) {
      response.personality.forEach((personalityItem, index) => {
        if (
          !personalityItem.explanation ||
          personalityItem.explanation.length < 30
        ) {
          issues.push(
            `Personality trait ${index + 1}: Explanation too brief (minimum 30 characters)`
          );
        }
      });
    }

    // Validate central question in goals context (if applicable)
    if (
      response.goals &&
      response.goals.longTerm &&
      !response.goals.longTerm.includes('?')
    ) {
      // This is just a basic check - not all long-term goals need to be questions
      // but they should be substantial
      if (response.goals.longTerm.length < 20) {
        issues.push('Long-term goal too brief (minimum 20 characters)');
      }
    }

    if (issues.length > 0) {
      this.#logger.warn('TraitsGenerator: Response quality issues detected', {
        issueCount: issues.length,
        issues: issues.slice(0, 5), // Log first 5 issues to avoid spam
      });

      throw TraitsGenerationError.forQualityFailure(issues.join('; '));
    }

    this.#logger.debug(
      'TraitsGenerator: Response quality validated successfully'
    );
  }

  /**
   * Estimate token count for text using TokenEstimator or fallback
   *
   * @param {string} text - Text to estimate
   * @param {string} [model] - Model to estimate tokens for
   * @returns {Promise<number>} Estimated token count
   * @private
   */
  async #estimateTokens(text, model = 'gpt-3.5-turbo') {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    try {
      if (this.#tokenEstimator) {
        // Use proper TokenEstimator service when available
        const tokens = await this.#tokenEstimator.estimateTokens(text, model);
        this.#logger.debug(
          'TraitsGenerator: Token estimation (TokenEstimator)',
          {
            model,
            textLength: text.length,
            estimatedTokens: tokens,
            method: 'TokenEstimator',
          }
        );
        return tokens;
      } else {
        // Fallback to simple estimation
        const tokens = Math.ceil(text.length / 4);
        this.#logger.debug('TraitsGenerator: Token estimation (fallback)', {
          textLength: text.length,
          estimatedTokens: tokens,
          method: 'fallback',
        });
        return tokens;
      }
    } catch (error) {
      this.#logger.warn(
        'TraitsGenerator: Token estimation failed, using fallback',
        {
          error: error.message,
          textLength: text.length,
        }
      );

      // Fallback estimation if TokenEstimator fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Determine the stage at which generation failed for better error reporting
   *
   * @param {Error} error - The error that occurred
   * @returns {string} The failure stage
   * @private
   */
  #determineFailureStage(error) {
    if (!error || !error.message) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();

    if (error instanceof TraitsGenerationError && error.context?.stage) {
      return error.context.stage;
    }

    if (
      message.includes('llm request failed') ||
      message.includes('network') ||
      message.includes('timeout')
    ) {
      return 'llm_request';
    }

    if (
      message.includes('failed to parse') ||
      message.includes('invalid json') ||
      message.includes('parsing')
    ) {
      return 'response_parsing';
    }

    if (
      message.includes('invalid response structure') ||
      message.includes('schema validation')
    ) {
      return 'structure_validation';
    }

    if (
      message.includes('response quality') ||
      message.includes('too brief') ||
      message.includes('lacks depth')
    ) {
      return 'quality_validation';
    }

    if (
      message.includes('configuration') ||
      message.includes('no active llm')
    ) {
      return 'configuration';
    }

    if (message.includes('validation failed') || message.includes('must be')) {
      return 'validation';
    }

    return 'processing';
  }

  /**
   * Get the response schema used for LLM validation
   *
   * @returns {object} JSON schema object
   */
  getResponseSchema() {
    return TRAITS_RESPONSE_SCHEMA;
  }

  /**
   * Get LLM parameters used for traits generation
   *
   * @returns {object} LLM parameters
   */
  getLLMParameters() {
    return { ...TRAITS_GENERATION_LLM_PARAMS };
  }

  /**
   * Get current prompt version information
   *
   * @returns {object} Version information
   */
  getPromptVersionInfo() {
    return PROMPT_VERSION_INFO;
  }
}

export default TraitsGenerator;
