/**
 * @file Service for generating clichés via LLM
 * @see CharacterBuilderService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildClicheGenerationPrompt,
  buildEnhancedClicheGenerationPrompt,
  validateClicheGenerationResponse,
  validateClicheGenerationResponseEnhanced,
  CLICHE_GENERATION_RESPONSE_SCHEMA,
  DEFAULT_ENHANCEMENT_OPTIONS,
  PROMPT_VERSION_INFO,
} from '../prompts/clicheGenerationPrompt.js';
import { createClichesFromLLMResponse } from '../models/cliche.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../models/cliche.js').Cliche} Cliche
 */

/**
 * @typedef {object} ClicheGenerationResult
 * @property {object} categories - Categorized clichés
 * @property {string[]} tropesAndStereotypes - Overall tropes
 * @property {object} metadata - Generation metadata
 */

/**
 * Custom error for cliche generation failures
 */
export class ClicheGenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ClicheGenerationError';
    this.cause = cause;
  }
}

/**
 * Service for generating character clichés via LLM
 */
export class ClicheGenerator {
  #logger;
  #llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;

  /**
   * Create a new ClicheGenerator instance
   *
   * @param {object} dependencies - Service dependencies
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

    this.#logger = logger;
    this.#llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
  }

  /**
   * Generate clichés for a character concept and thematic direction
   *
   * @param {string} conceptId - Character concept ID for association
   * @param {string} conceptText - Character concept description
   * @param {object} direction - Thematic direction details
   * @param {string} direction.title - Direction title
   * @param {string} direction.description - Direction description
   * @param {string} direction.coreTension - Core tension/conflict
   * @param {object} [options] - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @param {boolean} [options.useEnhancedPrompt] - Use enhanced prompt features
   * @param {object} [options.enhancementOptions] - Enhancement options for prompt
   * @returns {Promise<Cliche[]>} Generated clichés
   * @throws {ClicheGenerationError} If generation fails
   */
  async generateCliches(conceptId, conceptText, direction, options = {}) {
    if (
      !conceptId ||
      typeof conceptId !== 'string' ||
      conceptId.trim().length === 0
    ) {
      throw new ClicheGenerationError('conceptId must be a non-empty string');
    }

    if (
      !conceptText ||
      typeof conceptText !== 'string' ||
      conceptText.trim().length === 0
    ) {
      throw new ClicheGenerationError('conceptText must be a non-empty string');
    }

    if (!direction || typeof direction !== 'object') {
      throw new ClicheGenerationError('direction must be a valid object');
    }

    this.#logger.info(
      `ClicheGenerator: Starting generation for concept ${conceptId}`,
      {
        conceptId,
        conceptLength: conceptText.length,
        direction: direction.title,
      }
    );

    const startTime = Date.now();

    try {
      // Build the prompt (enhanced or standard)
      const prompt = options.useEnhancedPrompt
        ? buildEnhancedClicheGenerationPrompt(
            conceptText,
            direction,
            options.enhancementOptions
          )
        : buildClicheGenerationPrompt(conceptText, direction);

      this.#logger.debug('ClicheGenerator: Built prompt', {
        promptLength: prompt.length,
        conceptId,
        enhanced: !!options.useEnhancedPrompt,
        enhancementOptions: options.enhancementOptions || null,
      });

      // Get LLM response
      const llmResponse = await this.#callLLM(prompt, options.llmConfigId);
      const processingTime = Date.now() - startTime;

      // Parse and validate response
      const parsedResponse = await this.#parseResponse(llmResponse);

      let validationResult = null;
      let qualityMetrics = null;

      if (
        options.useEnhancedPrompt &&
        options.enhancementOptions?.enableAdvancedValidation !== false
      ) {
        validationResult = this.#validateResponseEnhanced(parsedResponse);
        qualityMetrics = validationResult.qualityMetrics;
      } else {
        this.#validateResponseStructure(parsedResponse);
      }

      // Get active config for metadata
      const activeConfig =
        await this.#llmConfigManager.getActiveConfiguration();
      const llmMetadata = {
        modelId: activeConfig?.configId || 'unknown',
        promptTokens: this.#estimateTokens(prompt),
        responseTokens: this.#estimateTokens(JSON.stringify(parsedResponse)),
        processingTime,
        promptVersion: options.useEnhancedPrompt
          ? PROMPT_VERSION_INFO.version
          : '1.0.0',
        enhanced: !!options.useEnhancedPrompt,
        qualityMetrics: qualityMetrics || null,
        validationWarnings: validationResult?.warnings || [],
        recommendations: validationResult?.recommendations || [],
      };

      const cliches = createClichesFromLLMResponse(
        conceptId,
        parsedResponse.categories,
        parsedResponse.tropesAndStereotypes,
        llmMetadata
      );

      this.#logger.info('ClicheGenerator: Successfully generated clichés', {
        conceptId,
        clicheCount: cliches.length,
        processingTime,
      });

      return cliches;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.#logger.error('ClicheGenerator: Generation failed', {
        conceptId,
        error: error.message,
        processingTime,
      });

      if (error instanceof ClicheGenerationError) {
        throw error;
      }

      throw new ClicheGenerationError(
        `Failed to generate clichés for concept ${conceptId}: ${error.message}`,
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
        toolSchema: CLICHE_GENERATION_RESPONSE_SCHEMA,
        toolName: 'generate_character_cliches',
        toolDescription:
          'Generate cliché warnings for character development based on the provided concept and thematic direction',
      };

      // Use the ConfigurableLLMAdapter with request options
      const response = await this.#llmStrategyFactory.getAIDecision(
        prompt,
        null, // no abort signal
        requestOptions
      );

      this.#logger.debug('ClicheGenerator: Received LLM response', {
        responseLength: response.length,
        modelId: activeConfig.configId,
      });

      return response;
    } catch (error) {
      throw new ClicheGenerationError(
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

      this.#logger.debug('ClicheGenerator: Successfully parsed LLM response');
      return parsedResponse;
    } catch (error) {
      throw new ClicheGenerationError(
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
   * @throws {ClicheGenerationError} If validation fails
   */
  #validateResponseStructure(response) {
    try {
      validateClicheGenerationResponse(response);
      this.#logger.debug(
        'ClicheGenerator: Response structure validated successfully'
      );
    } catch (error) {
      throw new ClicheGenerationError(
        `Invalid response structure: ${error.message}`,
        error
      );
    }
  }

  /**
   * Enhanced validation with statistics and quality metrics
   *
   * @private
   * @param {object} response - Parsed response
   * @returns {object} Enhanced validation result
   * @throws {ClicheGenerationError} If validation fails
   */
  #validateResponseEnhanced(response) {
    try {
      const result = validateClicheGenerationResponseEnhanced(response);
      this.#logger.debug('ClicheGenerator: Enhanced validation completed', {
        warnings: result.warnings.length,
        qualityScore: result.qualityMetrics.overallScore,
        recommendations: result.recommendations.length,
      });

      // Log warnings if any exist
      if (result.warnings.length > 0) {
        this.#logger.warn('ClicheGenerator: Quality warnings detected', {
          warnings: result.warnings,
        });
      }

      return result;
    } catch (error) {
      throw new ClicheGenerationError(
        `Enhanced validation failed: ${error.message}`,
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
    return validateClicheGenerationResponse(response);
  }

  /**
   * Get the schema used for LLM response validation
   *
   * @returns {object} JSON schema object
   */
  getResponseSchema() {
    return CLICHE_GENERATION_RESPONSE_SCHEMA;
  }

  /**
   * Generate clichés with enhanced features enabled by default
   *
   * @param {string} conceptId - Character concept ID for association
   * @param {string} conceptText - Character concept description
   * @param {object} direction - Thematic direction details
   * @param {object} [enhancementOptions] - Enhancement options
   * @param {object} [additionalOptions] - Additional generation options
   * @returns {Promise<Cliche[]>} Generated clichés with enhanced features
   * @throws {ClicheGenerationError} If generation fails
   */
  async generateEnhancedCliches(
    conceptId,
    conceptText,
    direction,
    enhancementOptions = {},
    additionalOptions = {}
  ) {
    const options = {
      ...additionalOptions,
      useEnhancedPrompt: true,
      enhancementOptions: {
        ...DEFAULT_ENHANCEMENT_OPTIONS,
        ...enhancementOptions,
      },
    };

    return this.generateCliches(conceptId, conceptText, direction, options);
  }

  /**
   * Get current prompt version information
   *
   * @returns {object} Version information
   */
  getPromptVersionInfo() {
    return PROMPT_VERSION_INFO;
  }

  /**
   * Get default enhancement options
   *
   * @returns {object} Default options
   */
  getDefaultEnhancementOptions() {
    return { ...DEFAULT_ENHANCEMENT_OPTIONS };
  }
}

export default ClicheGenerator;
