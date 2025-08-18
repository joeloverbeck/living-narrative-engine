/**
 * @file Service for generating core motivations via LLM
 * @see CharacterBuilderService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildCoreMotivationsGenerationPrompt,
  validateCoreMotivationsGenerationResponse,
  CORE_MOTIVATIONS_RESPONSE_SCHEMA,
  CORE_MOTIVATIONS_LLM_PARAMS,
  PROMPT_VERSION_INFO,
} from '../prompts/coreMotivationsGenerationPrompt.js';
import { CoreMotivation } from '../models/coreMotivation.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../models/coreMotivation.js').CoreMotivation} CoreMotivation
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

  /**
   * Create a new CoreMotivationsGenerator instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter (provides strategy factory functionality)
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
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

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
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
    this.#eventBus.dispatch({
      type: 'CORE_MOTIVATIONS_GENERATION_STARTED',
      payload: {
        conceptId: concept.id,
        directionId: direction.id,
      },
    });

    try {
      // Build the prompt
      const prompt = buildCoreMotivationsGenerationPrompt(
        concept.concept,
        direction,
        clichés
      );

      this.#logger.debug('CoreMotivationsGenerator: Built prompt', {
        promptLength: prompt.length,
        conceptId: concept.id,
        directionId: direction.id,
      });

      // Get LLM response
      const llmResponse = await this.#callLLM(prompt, options.llmConfigId);
      const processingTime = Date.now() - startTime;

      // Parse and validate response
      const parsedResponse = await this.#parseResponse(llmResponse);
      this.#validateMotivations(parsedResponse);

      // Get active config for metadata
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();

      // Create metadata
      const promptTokens = this.#estimateTokens(prompt);
      const responseTokens = this.#estimateTokens(
        JSON.stringify(parsedResponse)
      );

      const llmMetadata = {
        model: activeConfig?.configId || 'unknown',
        tokens: promptTokens + responseTokens,
        responseTime: processingTime,
        promptVersion: PROMPT_VERSION_INFO.version,
        clicheIds: this.#extractClicheIds(clichés),
        generationPrompt: prompt.substring(0, 500) + '...', // Truncated for storage
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
      this.#eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_GENERATION_COMPLETED',
        payload: {
          conceptId: concept.id,
          directionId: direction.id,
          motivationIds: coreMotivations.map((m) => m.id),
          totalCount: coreMotivations.length,
        },
      });

      return coreMotivations;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.#logger.error('CoreMotivationsGenerator: Generation failed', {
        conceptId: concept.id,
        directionId: direction.id,
        error: error.message,
        processingTime,
      });

      // Dispatch failure event
      this.#eventBus.dispatch({
        type: 'CORE_MOTIVATIONS_GENERATION_FAILED',
        payload: {
          conceptId: concept.id,
          directionId: direction.id,
          error: error.message,
        },
      });

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
   * Estimate token count for a text string
   *
   * @private
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  #estimateTokens(text) {
    // Simple estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
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
