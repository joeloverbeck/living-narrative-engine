# CLIGEN-003: ClicheGenerator Service Implementation

## Summary

Create a dedicated service for generating clichés via LLM integration. This service handles prompt construction, LLM communication, response parsing, and error recovery. It serves as the bridge between the character builder system and the LLM proxy server.

## Status

- **Type**: Implementation
- **Priority**: High
- **Complexity**: High
- **Estimated Time**: 6 hours
- **Dependencies**: CLIGEN-001 (Model), CLIGEN-002 (Service Extension)

## Objectives

### Primary Goals

1. **Create ClicheGenerator Service** - Dedicated service for cliché generation
2. **LLM Integration** - Connect to existing LLM proxy server
3. **Response Parsing** - Convert LLM responses to structured data
4. **Error Recovery** - Retry logic and fallback strategies
5. **Performance Tracking** - Monitor generation metrics
6. **Prompt Optimization** - Ensure high-quality responses

### Success Criteria

- [ ] Service generates comprehensive clichés (11 categories + tropes)
- [ ] LLM responses parsed correctly 95%+ of the time
- [ ] Retry logic handles transient failures
- [ ] Generation completes in < 10 seconds
- [ ] Response validation catches malformed data
- [ ] Metrics tracked for analysis
- [ ] 90% test coverage achieved

## Technical Specification

### 1. ClicheGenerator Service

#### File: `src/characterBuilder/services/ClicheGenerator.js`

````javascript
/**
 * @file Service for generating clichés via LLM
 * @see CharacterBuilderService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildClicheGenerationPrompt,
  validateClicheGenerationResponse,
  CLICHE_GENERATION_RESPONSE_SCHEMA,
  createClicheGenerationLlmConfig,
  CHARACTER_BUILDER_LLM_PARAMS,
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
   * @returns {Promise<Cliche[]>} Generated clichés
   * @throws {ClicheGenerationError} If generation fails
   */
  async generateCliches(conceptId, conceptText, direction, options = {}) {
    if (
      !conceptId ||
      typeof conceptId !== 'string' ||
      conceptId.trim().length === 0
    ) {
      throw new ClicheGenerationError(
        'conceptId must be a non-empty string'
      );
    }

    if (
      !conceptText ||
      typeof conceptText !== 'string' ||
      conceptText.trim().length === 0
    ) {
      throw new ClicheGenerationError(
        'conceptText must be a non-empty string'
      );
    }

    if (!direction || typeof direction !== 'object') {
      throw new ClicheGenerationError(
        'direction must be a valid object'
      );
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
      // Build the prompt
      const prompt = buildClicheGenerationPrompt(conceptText, direction);
      this.#logger.debug('ClicheGenerator: Built prompt', {
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

      const cliches = createClichesFromLLMResponse(
        conceptId,
        parsedResponse.categories,
        parsedResponse.tropesAndStereotypes,
        llmMetadata
      );

      this.#logger.info(
        'ClicheGenerator: Successfully generated clichés',
        {
          conceptId,
          clicheCount: cliches.length,
          processingTime,
        }
      );

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

      this.#logger.debug(
        'ClicheGenerator: Successfully parsed LLM response'
      );
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
}

export default ClicheGenerator;
````

### 2. Dependency Injection Registration

Update `src/dependencyInjection/registrations/characterBuilderRegistrations.js`:

````javascript
// Import the new service
import { ClicheGenerator } from '../../characterBuilder/services/ClicheGenerator.js';

// Add to registerCharacterBuilderServices function
function registerCharacterBuilderServices(registrar, logger) {
  // ... existing ThematicDirectionGenerator registration ...

  registrar.singletonFactory(tokens.ClicheGenerator, (c) => {
    return new ClicheGenerator({
      logger: c.resolve(tokens.ILogger),
      llmJsonService: c.resolve(tokens.LlmJsonService),
      llmStrategyFactory: c.resolve(tokens.LLMAdapter), // Use the ConfigurableLLMAdapter
      llmConfigManager: c.resolve(tokens.ILLMConfigurationManager),
    });
  });
  logger.debug(
    `Character Builder Registration: Registered ${tokens.ClicheGenerator}.`
  );

  // Update CharacterBuilderService registration to include clicheGenerator
  registrar.singletonFactory(tokens.CharacterBuilderService, (c) => {
    return new CharacterBuilderService({
      logger: c.resolve(tokens.ILogger),
      storageService: c.resolve(tokens.CharacterStorageService),
      directionGenerator: c.resolve(tokens.ThematicDirectionGenerator),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
      database: c.resolve(tokens.CharacterDatabase),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
      clicheGenerator: c.resolve(tokens.ClicheGenerator), // Replace null with actual service
    });
  });
  logger.debug(
    `Character Builder Registration: Updated ${tokens.CharacterBuilderService} with ClicheGenerator.`
  );
}
````

### 3. Token Definition

Add to `src/dependencyInjection/tokens/tokens-core.js`:

````javascript
// Add to character builder tokens section
ClicheGenerator: Symbol('ClicheGenerator'),
````
