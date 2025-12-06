/**
 * @file Service for generating core motivations via LLM
 * @see CharacterBuilderService.js
 */
/* eslint-env node */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildCoreMotivationsGenerationPrompt,
  validateCoreMotivationsGenerationResponse,
  CORE_MOTIVATIONS_RESPONSE_SCHEMA,
  CORE_MOTIVATIONS_LLM_PARAMS,
  PROMPT_VERSION_INFO,
} from '../prompts/coreMotivationsGenerationPrompt.js';
import { CoreMotivation } from '../models/coreMotivation.js';
import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';

/* global process */

/**
 * Retry configuration for core motivations generation
 * Uses minimal delays in test environment to speed up test execution
 * Browser-safe: Defaults to production values when process is undefined
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
      ? 1
      : 1000,
  maxDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
      ? 5
      : 4000,
};

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../models/coreMotivation.js').CoreMotivation} CoreMotivation
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 */

/**
 * Custom error for core motivations generation failures
 */
export class CoreMotivationsGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CoreMotivationsGenerationError';
    this.cause = cause;
  }
}

/**
 * Service for generating character core motivations via LLM
 */
export class CoreMotivationsGenerator {
  #logger;
  #llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;
  #eventBus;
  #tokenEstimator;

  /**
   * Create a new CoreMotivationsGenerator instance
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

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
    this.#tokenEstimator = tokenEstimator;
  }

  /**
   * Generate core motivations for a character concept and thematic direction
   *
   * @param {object} params - Generation parameters
   * @param {object} params.concept - Character concept details
   * @param {object} params.direction - Thematic direction details
   * @param {object} params.clichés - Clichés to avoid (note: French spelling as required by controller)
   * @param {object} [options] - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @returns {Promise<CoreMotivation[]>} Generated core motivations
   * @throws {CoreMotivationsGenerationError} If generation fails
   */
  async generate(params, options = {}) {
    const { concept, direction, clichés } = params;
    // Validate inputs
    if (!concept || typeof concept !== 'object') {
      throw new CoreMotivationsGenerationError(
        'concept must be a valid object'
      );
    }

    if (
      !concept.id ||
      typeof concept.id !== 'string' ||
      concept.id.trim().length === 0
    ) {
      throw new CoreMotivationsGenerationError(
        'concept.id must be a non-empty string'
      );
    }

    if (
      !concept.concept ||
      typeof concept.concept !== 'string' ||
      concept.concept.trim().length === 0
    ) {
      throw new CoreMotivationsGenerationError(
        'concept.concept must be a non-empty string'
      );
    }

    if (!direction || typeof direction !== 'object') {
      throw new CoreMotivationsGenerationError(
        'direction must be a valid object'
      );
    }

    if (
      !direction.id ||
      typeof direction.id !== 'string' ||
      direction.id.trim().length === 0
    ) {
      throw new CoreMotivationsGenerationError(
        'direction.id must be a non-empty string'
      );
    }

    if (!clichés || typeof clichés !== 'object') {
      throw new CoreMotivationsGenerationError(
        'clichés must be a valid object'
      );
    }

    this.#logger.info(
      `CoreMotivationsGenerator: Starting generation for concept ${concept.id}`,
      {
        conceptId: concept.id,
        directionId: direction.id,
        conceptLength: concept.concept.length,
        directionTitle: direction.title,
      }
    );

    const startTime = Date.now();

    // Dispatch generation started event
    await this.#eventBus.dispatch(
      CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_STARTED,
      {
        conceptId: concept.id,
        directionId: direction.id,
      }
    );

    try {
      // Use retry mechanism with configurable retry count
      const maxRetries =
        options.maxRetries !== undefined
          ? options.maxRetries
          : RETRY_CONFIG.maxRetries;
      const retryParams = {
        concept,
        direction,
        clichés,
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

      // Create enhanced metadata with better token tracking
      const promptTokens = await this.#estimateTokens(
        buildCoreMotivationsGenerationPrompt(
          concept.concept,
          direction,
          clichés
        ),
        activeConfig?.configId
      );
      const responseTokens = await this.#estimateTokens(
        JSON.stringify(parsedResponse),
        activeConfig?.configId
      );

      const llmMetadata = {
        model: activeConfig?.configId || 'unknown',
        promptTokens,
        responseTokens,
        totalTokens: promptTokens + responseTokens,
        responseTime: processingTime,
        retryAttempts: maxRetries,
        promptVersion: PROMPT_VERSION_INFO.version,
        clicheIds: this.#extractClicheIds(clichés),
        qualityChecks: ['structure', 'quality', 'length', 'format'],
        generationPrompt:
          buildCoreMotivationsGenerationPrompt(
            concept.concept,
            direction,
            clichés
          ).substring(0, 500) + '...', // Truncated for storage
      };

      // Convert to CoreMotivation instances
      const coreMotivations = parsedResponse.motivations.map((rawMotivation) =>
        CoreMotivation.fromLLMResponse({
          directionId: direction.id,
          conceptId: concept.id,
          rawMotivation,
          metadata: llmMetadata,
        })
      );

      this.#logger.info(
        'CoreMotivationsGenerator: Successfully generated core motivations',
        {
          conceptId: concept.id,
          directionId: direction.id,
          motivationsCount: coreMotivations.length,
          processingTime,
        }
      );

      // Dispatch completion event
      await this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED,
        {
          conceptId: concept.id,
          directionId: direction.id,
          motivationIds: coreMotivations.map((m) => m.id),
          totalCount: coreMotivations.length,
        }
      );

      return coreMotivations;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const failureStage = this.#determineFailureStage(error);

      this.#logger.error('CoreMotivationsGenerator: Generation failed', {
        conceptId: concept.id,
        directionId: direction.id,
        error: error.message,
        processingTime,
        failureStage,
      });

      // Dispatch failure event with enhanced details
      await this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_FAILED,
        {
          conceptId: concept.id,
          directionId: direction.id,
          error: error.message,
          processingTime,
          failureStage,
        }
      );

      if (error instanceof CoreMotivationsGenerationError) {
        throw error;
      }

      throw new CoreMotivationsGenerationError(
        `Failed to generate core motivations for concept ${concept.id}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Call the LLM with the generated prompt
   *
   * @private
   * @param {string} prompt - Formatted prompt
   * @param {string} [llmConfigId] - Specific LLM config to use
   * @returns {Promise<string>} Raw LLM response
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
            throw new Error(`LLM configuration not found: ${llmConfigId}`);
          }
        }
      }

      // Get the current active configuration
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();
      if (!activeConfig) {
        throw new Error('No active LLM configuration found.');
      }

      // Prepare request options with custom schema
      const requestOptions = {
        toolSchema: CORE_MOTIVATIONS_RESPONSE_SCHEMA,
        toolName: 'generate_core_motivations',
        toolDescription:
          'Generate core motivations for character development based on the provided concept, thematic direction, and clichés to avoid',
      };

      // Use the ConfigurableLLMAdapter with request options
      const response = await this.#llmStrategyFactory.getAIDecision(
        prompt,
        null, // no abort signal
        requestOptions
      );

      this.#logger.debug('CoreMotivationsGenerator: Received LLM response', {
        responseLength: response.length,
        modelId: activeConfig.configId,
      });

      return response;
    } catch (error) {
      if (error instanceof CoreMotivationsGenerationError) {
        throw error;
      }
      throw new CoreMotivationsGenerationError(
        `LLM request failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * Parse and clean LLM response
   *
   * @private
   * @param {string} rawResponse - Raw LLM response
   * @returns {Promise<object>} Parsed response object
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

      this.#logger.debug(
        'CoreMotivationsGenerator: Successfully parsed LLM response'
      );
      return parsedResponse;
    } catch (error) {
      if (error instanceof CoreMotivationsGenerationError) {
        throw error;
      }
      throw new CoreMotivationsGenerationError(
        `Failed to parse LLM response: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate the structure and content of core motivations
   *
   * @private
   * @param {object} response - Parsed response
   * @throws {CoreMotivationsGenerationError} If validation fails
   */
  #validateMotivations(response) {
    try {
      validateCoreMotivationsGenerationResponse(response);
      this.#logger.debug(
        'CoreMotivationsGenerator: Response structure validated successfully'
      );
    } catch (error) {
      if (error instanceof CoreMotivationsGenerationError) {
        throw error;
      }
      throw new CoreMotivationsGenerationError(
        `Invalid response structure: ${error.message}`,
        error
      );
    }
  }

  /**
   * Generate core motivations with retry logic for transient failures
   *
   * @private
   * @param {object} params - Generation parameters
   * @param {number} [maxRetries] - Maximum number of retry attempts
   * @returns {Promise<object>} Parsed and validated response
   * @throws {CoreMotivationsGenerationError} If all attempts fail
   */
  async #generateWithRetry(params, maxRetries = RETRY_CONFIG.maxRetries) {
    let lastError;
    let attemptCount = 0;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      attemptCount = attempt;

      try {
        // Build the prompt
        const prompt = buildCoreMotivationsGenerationPrompt(
          params.concept.concept,
          params.direction,
          params.clichés
        );

        this.#logger.debug('CoreMotivationsGenerator: Built prompt', {
          promptLength: prompt.length,
          conceptId: params.concept.id,
          directionId: params.direction.id,
          attempt,
          maxRetries,
        });

        // Get LLM response
        const llmResponse = await this.#callLLM(prompt, params.llmConfigId);

        // Parse and validate response
        const parsedResponse = await this.#parseResponse(llmResponse);
        this.#validateMotivations(parsedResponse);
        this.#validateResponseQuality(parsedResponse);

        this.#logger.debug('CoreMotivationsGenerator: Generation succeeded', {
          conceptId: params.concept.id,
          directionId: params.direction.id,
          attempt,
          motivationsCount: parsedResponse.motivations?.length || 0,
        });

        return parsedResponse;
      } catch (error) {
        lastError = error;

        if (attempt <= maxRetries) {
          // Calculate exponential backoff delay using config
          const delayMs = Math.min(
            RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelayMs
          );

          this.#logger.warn(
            `CoreMotivationsGenerator: Attempt ${attempt} failed, retrying in ${delayMs}ms`,
            {
              error: error.message,
              attempt,
              maxRetries,
              conceptId: params.concept.id,
              directionId: params.direction.id,
              delayMs,
            }
          );

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          this.#logger.error(
            'CoreMotivationsGenerator: All retry attempts exhausted',
            {
              totalAttempts: attempt,
              maxRetries,
              conceptId: params.concept.id,
              directionId: params.direction.id,
              finalError: error.message,
            }
          );
        }
      }
    }

    // All attempts failed, throw the last error
    if (lastError instanceof CoreMotivationsGenerationError) {
      // Add retry context to existing error
      throw new CoreMotivationsGenerationError(
        `${lastError.message} (after ${attemptCount} attempts)`,
        lastError.cause
      );
    }

    throw new CoreMotivationsGenerationError(
      `Generation failed after ${attemptCount} attempts: ${lastError.message}`,
      lastError
    );
  }

  /**
   * Validate response quality beyond structural validation
   *
   * @private
   * @param {object} response - Parsed response
   * @throws {CoreMotivationsGenerationError} If quality issues are found
   */
  #validateResponseQuality(response) {
    const issues = [];

    if (!response.motivations || !Array.isArray(response.motivations)) {
      throw new CoreMotivationsGenerationError(
        'Response quality validation failed: motivations must be an array'
      );
    }

    response.motivations.forEach((motivation, index) => {
      // Check minimum content length for core desire
      if (
        !motivation.coreDesire ||
        typeof motivation.coreDesire !== 'string' ||
        motivation.coreDesire.trim().length < 20
      ) {
        issues.push(
          `Motivation ${index + 1}: Core desire too brief (minimum 20 characters)`
        );
      }

      // Check minimum content length for internal contradiction
      if (
        !motivation.internalContradiction ||
        typeof motivation.internalContradiction !== 'string' ||
        motivation.internalContradiction.trim().length < 30
      ) {
        issues.push(
          `Motivation ${index + 1}: Internal contradiction too brief (minimum 30 characters)`
        );
      }

      // Check for question mark in central question
      if (
        !motivation.centralQuestion ||
        typeof motivation.centralQuestion !== 'string'
      ) {
        issues.push(
          `Motivation ${index + 1}: Central question missing or invalid`
        );
      } else if (!motivation.centralQuestion.includes('?')) {
        issues.push(
          `Motivation ${index + 1}: Central question missing question mark`
        );
      }

      // Check for content depth (basic word count check)
      if (motivation.coreDesire && typeof motivation.coreDesire === 'string') {
        const words = motivation.coreDesire.trim().split(/\s+/).filter(Boolean);
        if (words.length < 5) {
          issues.push(
            `Motivation ${index + 1}: Core desire lacks depth (minimum 5 words)`
          );
        }
      }

      // Check for repetitive content (very basic check for duplicate words)
      if (motivation.coreDesire && typeof motivation.coreDesire === 'string') {
        const words = motivation.coreDesire
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        const uniqueWords = new Set(words);
        if (words.length > 0 && uniqueWords.size / words.length < 0.5) {
          issues.push(
            `Motivation ${index + 1}: Core desire appears repetitive`
          );
        }
      }
    });

    if (issues.length > 0) {
      this.#logger.warn(
        'CoreMotivationsGenerator: Response quality issues detected',
        {
          issueCount: issues.length,
          issues: issues.slice(0, 5), // Log first 5 issues to avoid spam
        }
      );

      throw new CoreMotivationsGenerationError(
        `Response quality issues: ${issues.join('; ')}`,
        { qualityIssues: issues }
      );
    }

    this.#logger.debug(
      'CoreMotivationsGenerator: Response quality validated successfully'
    );
  }

  /**
   * Estimate token count for a text string using TokenEstimator or fallback method
   *
   * @private
   * @param {string} text - Text to estimate
   * @param {string} [model] - Model to estimate tokens for
   * @returns {Promise<number>} Estimated token count
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
          'CoreMotivationsGenerator: Token estimation (TokenEstimator)',
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
        this.#logger.debug(
          'CoreMotivationsGenerator: Token estimation (fallback)',
          {
            textLength: text.length,
            estimatedTokens: tokens,
            method: 'fallback',
          }
        );
        return tokens;
      }
    } catch (error) {
      this.#logger.warn(
        'CoreMotivationsGenerator: Token estimation failed, using fallback',
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
   * Extract cliché IDs from clichés object for metadata
   *
   * @private
   * @param {object} clichés - Clichés object
   * @returns {string[]} Array of cliché identifiers
   */
  #extractClicheIds(clichés) {
    const ids = [];

    if (clichés.categories && typeof clichés.categories === 'object') {
      Object.keys(clichés.categories).forEach((category) => {
        if (Array.isArray(clichés.categories[category])) {
          clichés.categories[category].forEach((item, index) => {
            ids.push(`${category}_${index}`);
          });
        }
      });
    }

    if (
      clichés.tropesAndStereotypes &&
      Array.isArray(clichés.tropesAndStereotypes)
    ) {
      clichés.tropesAndStereotypes.forEach((item, index) => {
        ids.push(`trope_${index}`);
      });
    }

    return ids;
  }

  /**
   * Determine the stage at which generation failed for better error reporting
   *
   * @private
   * @param {Error} error - The error that occurred
   * @returns {string} The failure stage
   */
  #determineFailureStage(error) {
    if (!error || !error.message) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();

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

    if (error instanceof CoreMotivationsGenerationError && error.cause) {
      return this.#determineFailureStage(error.cause);
    }

    return 'processing';
  }

  /**
   * Validate core motivations generation response against schema
   *
   * @param {object} response - LLM response to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateResponse(response) {
    return validateCoreMotivationsGenerationResponse(response);
  }

  /**
   * Get the schema used for LLM response validation
   *
   * @returns {object} JSON schema object
   */
  getResponseSchema() {
    return CORE_MOTIVATIONS_RESPONSE_SCHEMA;
  }

  /**
   * Get LLM parameters used for core motivations generation
   *
   * @returns {object} LLM parameters
   */
  getLLMParameters() {
    return { ...CORE_MOTIVATIONS_LLM_PARAMS };
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

export default CoreMotivationsGenerator;
