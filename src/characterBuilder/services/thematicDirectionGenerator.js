/**
 * @file Generates thematic directions using LLM integration
 * @see ../prompts/thematicDirectionsPrompt.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildThematicDirectionsPrompt,
  validateThematicDirectionsResponse,
  THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
  createThematicDirectionsLlmConfig,
  CHARACTER_BUILDER_LLM_PARAMS,
} from '../prompts/thematicDirectionsPrompt.js';
import { createThematicDirectionsFromLLMResponse } from '../models/thematicDirection.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * Custom error for thematic direction generation failures
 */
export class ThematicDirectionGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ThematicDirectionGenerationError';
    this.cause = cause;
  }
}

/**
 * Service for generating thematic directions using LLM integration
 */
export class ThematicDirectionGenerator {
  #logger;
  #llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter (provides strategy factory functionality)
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(llmJsonService, 'LlmJsonService', logger, {
      requiredMethods: ['clean', 'parseAndRepair'],
    });
    validateDependency(llmStrategyFactory, 'ConfigurableLLMAdapter', logger, {
      requiredMethods: ['getAIDecision'],
    });
    validateDependency(llmConfigManager, 'ILLMConfigurationManager', logger, {
      requiredMethods: [
        'loadConfiguration',
        'getActiveConfiguration',
        'setActiveConfiguration',
      ],
    });

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
  }

  /**
   * Generate thematic directions for a character concept
   *
   * @param {string} conceptId - Character concept ID for association
   * @param {string} characterConcept - Character concept text
   * @param {object} [options] - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @returns {Promise<ThematicDirection[]>} Generated thematic directions
   * @throws {ThematicDirectionGenerationError} If generation fails
   */
  async generateDirections(conceptId, characterConcept, options = {}) {
    if (
      !conceptId ||
      typeof conceptId !== 'string' ||
      conceptId.trim().length === 0
    ) {
      throw new ThematicDirectionGenerationError(
        'conceptId must be a non-empty string'
      );
    }

    if (
      !characterConcept ||
      typeof characterConcept !== 'string' ||
      characterConcept.trim().length === 0
    ) {
      throw new ThematicDirectionGenerationError(
        'characterConcept must be a non-empty string'
      );
    }

    this.#logger.info(
      `ThematicDirectionGenerator: Starting generation for concept ${conceptId}`,
      {
        conceptId,
        conceptLength: characterConcept.length,
      }
    );

    const startTime = Date.now();

    try {
      // Build the prompt
      const prompt = buildThematicDirectionsPrompt(characterConcept);
      this.#logger.debug('ThematicDirectionGenerator: Built prompt', {
        promptLength: prompt.length,
        conceptId,
      });

      // Get LLM response
      const llmResponse = await this.#callLLM(prompt, options.llmConfigId);
      const processingTime = Date.now() - startTime;

      // Parse and validate response
      const parsedResponse = await this.#parseResponse(llmResponse);
      this.#validateResponseStructure(parsedResponse);

      // Get active config for metadata
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();
      const llmMetadata = {
        modelId: activeConfig?.configId || 'unknown',
        promptTokens: this.#estimateTokens(prompt),
        responseTokens: this.#estimateTokens(JSON.stringify(parsedResponse)),
        processingTime,
      };

      const thematicDirections = createThematicDirectionsFromLLMResponse(
        conceptId,
        parsedResponse.thematicDirections,
        llmMetadata
      );

      this.#logger.info(
        'ThematicDirectionGenerator: Successfully generated thematic directions',
        {
          conceptId,
          directionCount: thematicDirections.length,
          processingTime,
        }
      );

      return thematicDirections;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.#logger.error('ThematicDirectionGenerator: Generation failed', {
        conceptId,
        error: error.message,
        processingTime,
      });

      if (error instanceof ThematicDirectionGenerationError) {
        throw error;
      }

      throw new ThematicDirectionGenerationError(
        `Failed to generate thematic directions for concept ${conceptId}: ${error.message}`,
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
        toolSchema: THEMATIC_DIRECTIONS_RESPONSE_SCHEMA,
        toolName: 'generate_thematic_directions',
        toolDescription:
          'Generate thematic directions for character development based on the provided concept',
      };

      // Use the ConfigurableLLMAdapter with request options
      const response = await this.#llmStrategyFactory.getAIDecision(
        prompt,
        null, // no abort signal
        requestOptions
      );

      this.#logger.debug('ThematicDirectionGenerator: Received LLM response', {
        responseLength: response.length,
        modelId: activeConfig.configId,
      });

      return response;
    } catch (error) {
      throw new ThematicDirectionGenerationError(
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
        'ThematicDirectionGenerator: Successfully parsed LLM response'
      );
      return parsedResponse;
    } catch (error) {
      throw new ThematicDirectionGenerationError(
        `Failed to parse LLM response: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate the structure of the parsed response
   *
   * @private
   * @param {object} response - Parsed response
   * @throws {ThematicDirectionGenerationError} If validation fails
   */
  #validateResponseStructure(response) {
    try {
      validateThematicDirectionsResponse(response);
      this.#logger.debug(
        'ThematicDirectionGenerator: Response structure validated successfully'
      );
    } catch (error) {
      throw new ThematicDirectionGenerationError(
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
   * Validate LLM response against schema
   *
   * @param {object} response - LLM response to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateResponse(response) {
    return validateThematicDirectionsResponse(response);
  }

  /**
   * Get the schema used for LLM response validation
   *
   * @returns {object} JSON schema object
   */
  getResponseSchema() {
    return THEMATIC_DIRECTIONS_RESPONSE_SCHEMA;
  }
}
