/**
 * @file testConfigurationValidator.js
 * @description Validation utilities for test configurations
 */

/**
 * @class TestConfigurationValidator
 * @description Validates test configurations to ensure they are properly structured
 * and contain all required fields
 */
export class TestConfigurationValidator {
  /**
   * Validates an LLM configuration
   *
   * @param {object} config - The LLM configuration to validate
   * @returns {boolean} True if valid
   * @throws {Error} If configuration is invalid
   */
  static validateLLMConfig(config) {
    // Check required fields
    const required = [
      'configId',
      'displayName',
      'apiKeyEnvVar',
      'endpointUrl',
      'modelIdentifier',
    ];

    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required LLM config fields: ${missing.join(', ')}`
      );
    }

    // Validate specific field types
    if (typeof config.configId !== 'string') {
      throw new Error('LLM config configId must be a string');
    }

    if (typeof config.displayName !== 'string') {
      throw new Error('LLM config displayName must be a string');
    }

    if (typeof config.endpointUrl !== 'string') {
      throw new Error('LLM config endpointUrl must be a string');
    }

    // Validate URL format
    try {
      new URL(config.endpointUrl);
    } catch (error) {
      throw new Error(
        `LLM config endpointUrl is not a valid URL: ${config.endpointUrl}`
      );
    }

    // Validate context token limit if present
    if (
      config.contextTokenLimit !== undefined &&
      (typeof config.contextTokenLimit !== 'number' ||
        config.contextTokenLimit <= 0)
    ) {
      throw new Error('LLM config contextTokenLimit must be a positive number');
    }

    // Validate JSON output strategy if present
    if (config.jsonOutputStrategy) {
      this.#validateJsonOutputStrategy(config.jsonOutputStrategy);
    }

    // Validate prompt elements if present
    if (config.promptElements) {
      this.#validatePromptElements(config.promptElements);
    }

    // Validate prompt assembly order if present
    if (config.promptAssemblyOrder) {
      this.#validatePromptAssemblyOrder(
        config.promptAssemblyOrder,
        config.promptElements
      );
    }

    return true;
  }

  /**
   * Validates a test environment configuration
   *
   * @param {object} env - The environment configuration to validate
   * @param {string} type - The environment type
   * @returns {boolean} True if valid
   * @throws {Error} If configuration is invalid
   */
  static validateTestEnvironment(env, type) {
    // Define required fields for each environment type
    const schemas = {
      'turn-execution': ['llm', 'actors', 'world', 'mocks'],
      'action-processing': ['llm', 'actors', 'actions', 'mocks'],
      'prompt-generation': ['llm', 'actors', 'mocks'],
    };

    const required = schemas[type];
    if (!required) {
      throw new Error(`Unknown environment type: ${type}`);
    }

    // Check for missing required fields
    const missing = required.filter((field) => !env[field]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment fields for ${type}: ${missing.join(', ')}`
      );
    }

    // Validate LLM configuration if present
    if (env.llm) {
      this.validateLLMConfig(env.llm);
    }

    // Validate actors array
    if (env.actors && !Array.isArray(env.actors)) {
      throw new Error('Environment actors must be an array');
    }

    // Validate each actor
    if (env.actors) {
      env.actors.forEach((actor, index) => {
        this.#validateActor(actor, index);
      });
    }

    // Validate world configuration if present
    if (env.world) {
      this.#validateWorld(env.world);
    }

    // Validate actions if present
    if (env.actions && !Array.isArray(env.actions)) {
      throw new Error('Environment actions must be an array');
    }

    return true;
  }

  /**
   * Validates a JSON output strategy
   *
   * @private
   * @param {object} strategy - The JSON output strategy to validate
   * @throws {Error} If strategy is invalid
   */
  static #validateJsonOutputStrategy(strategy) {
    if (!strategy.method) {
      throw new Error('JSON output strategy must have a method');
    }

    const validMethods = [
      'openrouter_tool_calling',
      'json_schema',
      'openrouter_json_schema',
      'structured_output',
      'native_json',
    ];

    if (!validMethods.includes(strategy.method)) {
      throw new Error(
        `Invalid JSON output strategy method: ${
          strategy.method
        }. Valid methods: ${validMethods.join(', ')}`
      );
    }

    // Validate method-specific fields
    if (strategy.method === 'openrouter_tool_calling' && !strategy.toolName) {
      throw new Error('openrouter_tool_calling strategy requires a toolName');
    }

    if (
      (strategy.method === 'json_schema' ||
        strategy.method === 'openrouter_json_schema') &&
      !strategy.schema
    ) {
      throw new Error(`${strategy.method} strategy requires a schema`);
    }
  }

  /**
   * Validates prompt elements
   *
   * @private
   * @param {Array} elements - The prompt elements to validate
   * @throws {Error} If elements are invalid
   */
  static #validatePromptElements(elements) {
    if (!Array.isArray(elements)) {
      throw new Error('Prompt elements must be an array');
    }

    elements.forEach((element, index) => {
      if (!element.key) {
        throw new Error(`Prompt element at index ${index} missing key`);
      }

      if (typeof element.key !== 'string') {
        throw new Error(
          `Prompt element at index ${index} key must be a string`
        );
      }

      // Prefix and suffix are optional but must be strings if present
      if (element.prefix !== undefined && typeof element.prefix !== 'string') {
        throw new Error(
          `Prompt element at index ${index} prefix must be a string`
        );
      }

      if (element.suffix !== undefined && typeof element.suffix !== 'string') {
        throw new Error(
          `Prompt element at index ${index} suffix must be a string`
        );
      }
    });
  }

  /**
   * Validates prompt assembly order
   *
   * @private
   * @param {Array} order - The assembly order
   * @param {Array} elements - The prompt elements
   * @throws {Error} If order is invalid
   */
  static #validatePromptAssemblyOrder(order, elements) {
    if (!Array.isArray(order)) {
      throw new Error('Prompt assembly order must be an array');
    }

    // Create a set of valid keys from elements
    const validKeys = new Set(elements ? elements.map((el) => el.key) : []);

    // Check that all keys in order are valid
    order.forEach((key) => {
      if (!validKeys.has(key)) {
        throw new Error(
          `Invalid key in prompt assembly order: ${key}. Valid keys: ${Array.from(
            validKeys
          ).join(', ')}`
        );
      }
    });
  }

  /**
   * Validates an actor configuration
   *
   * @private
   * @param {object} actor - The actor to validate
   * @param {number} index - The actor's index in the array
   * @throws {Error} If actor is invalid
   */
  static #validateActor(actor, index) {
    if (!actor.id) {
      throw new Error(`Actor at index ${index} missing id`);
    }

    if (typeof actor.id !== 'string') {
      throw new Error(`Actor at index ${index} id must be a string`);
    }

    // Name is optional but must be a string if present
    if (actor.name !== undefined && typeof actor.name !== 'string') {
      throw new Error(`Actor at index ${index} name must be a string`);
    }

    // Type is optional but must be a string if present
    if (actor.type !== undefined && typeof actor.type !== 'string') {
      throw new Error(`Actor at index ${index} type must be a string`);
    }

    // Components must be an object if present
    if (
      actor.components !== undefined &&
      (typeof actor.components !== 'object' || Array.isArray(actor.components))
    ) {
      throw new Error(`Actor at index ${index} components must be an object`);
    }
  }

  /**
   * Validates a world configuration
   *
   * @private
   * @param {object} world - The world to validate
   * @throws {Error} If world is invalid
   */
  static #validateWorld(world) {
    // ID or name is required
    if (!world.id && !world.name) {
      throw new Error('World must have either an id or name');
    }

    // Validate field types
    if (world.id !== undefined && typeof world.id !== 'string') {
      throw new Error('World id must be a string');
    }

    if (world.name !== undefined && typeof world.name !== 'string') {
      throw new Error('World name must be a string');
    }

    if (
      world.description !== undefined &&
      typeof world.description !== 'string'
    ) {
      throw new Error('World description must be a string');
    }

    if (world.locations !== undefined && !Array.isArray(world.locations)) {
      throw new Error('World locations must be an array');
    }
  }

  /**
   * Validates a mock configuration
   *
   * @param {object} mockConfig - The mock configuration to validate
   * @param {string} mockType - The type of mock
   * @returns {boolean} True if valid
   * @throws {Error} If configuration is invalid
   */
  static validateMockConfiguration(mockConfig, mockType) {
    if (!mockConfig || typeof mockConfig !== 'object') {
      throw new Error('Mock configuration must be an object');
    }

    switch (mockType) {
      case 'llm-adapter':
        if (!mockConfig.responses) {
          throw new Error('LLM adapter mock must have responses');
        }
        if (!mockConfig.apiKey) {
          throw new Error('LLM adapter mock must have apiKey');
        }
        break;

      case 'event-bus':
        if (typeof mockConfig.captureAll !== 'boolean') {
          throw new Error('Event bus mock captureAll must be a boolean');
        }
        if (mockConfig.eventTypes && !Array.isArray(mockConfig.eventTypes)) {
          throw new Error('Event bus mock eventTypes must be an array');
        }
        break;

      case 'entity-manager':
        if (!mockConfig.entities || !Array.isArray(mockConfig.entities)) {
          throw new Error('Entity manager mock must have entities array');
        }
        break;

      default:
        throw new Error(`Unknown mock type: ${mockType}`);
    }

    return true;
  }

  /**
   * Validates configuration consistency across multiple configurations
   *
   * @param {Array<object>} configs - Array of configurations to compare
   * @param {string} configType - Type of configurations being compared
   * @throws {Error} If configurations are inconsistent
   * @returns {boolean} True if consistent
   */
  static validateConfigurationConsistency(configs, configType) {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error('configs must be a non-empty array');
    }

    // For LLM configs, ensure they have consistent structure
    if (configType === 'llm') {
      const firstConfig = configs[0];
      const requiredFields = [
        'configId',
        'displayName',
        'apiKeyEnvVar',
        'endpointUrl',
      ];

      for (let i = 1; i < configs.length; i++) {
        const config = configs[i];

        // Check that all configs have the same required fields
        for (const field of requiredFields) {
          if (
            (firstConfig[field] === undefined) !==
            (config[field] === undefined)
          ) {
            throw new Error(
              `Configuration inconsistency: field '${field}' present in some configs but not others`
            );
          }
        }

        // Check API type consistency
        if (firstConfig.apiType !== config.apiType) {
          console.warn(
            `Warning: API type inconsistency between configs: ${firstConfig.apiType} vs ${config.apiType}`
          );
        }
      }
    }

    return true;
  }

  /**
   * Validates that a migrated configuration produces the same functional result
   * as the original inline configuration
   *
   * @param {object} originalConfig - The original inline configuration
   * @param {object} migratedConfig - The configuration from factory
   * @param {string} configId - The configuration ID being compared
   * @throws {Error} If configurations are functionally different
   * @returns {boolean} True if functionally equivalent
   */
  static validateMigrationEquivalence(
    originalConfig,
    migratedConfig,
    configId
  ) {
    if (!originalConfig || !migratedConfig) {
      throw new Error('Both original and migrated configs must be provided');
    }

    // Key fields that must match exactly for functional equivalence
    const criticalFields = [
      'configId',
      'displayName',
      'apiKeyEnvVar',
      'endpointUrl',
      'modelIdentifier',
      'contextTokenLimit',
    ];

    for (const field of criticalFields) {
      if (originalConfig[field] !== migratedConfig[field]) {
        throw new Error(
          `Migration validation failed for ${configId}: ${field} differs. ` +
            `Original: ${originalConfig[field]}, Migrated: ${migratedConfig[field]}`
        );
      }
    }

    // Validate JSON output strategy structure
    if (
      originalConfig.jsonOutputStrategy &&
      migratedConfig.jsonOutputStrategy
    ) {
      const origStrategy = originalConfig.jsonOutputStrategy;
      const migStrategy = migratedConfig.jsonOutputStrategy;

      if (origStrategy.method !== migStrategy.method) {
        throw new Error(
          `Migration validation failed for ${configId}: jsonOutputStrategy.method differs. ` +
            `Original: ${origStrategy.method}, Migrated: ${migStrategy.method}`
        );
      }

      if (origStrategy.toolName !== migStrategy.toolName) {
        throw new Error(
          `Migration validation failed for ${configId}: jsonOutputStrategy.toolName differs. ` +
            `Original: ${origStrategy.toolName}, Migrated: ${migStrategy.toolName}`
        );
      }
    }

    // Validate prompt elements length (structure can differ slightly)
    if (originalConfig.promptElements && migratedConfig.promptElements) {
      if (
        originalConfig.promptElements.length !==
        migratedConfig.promptElements.length
      ) {
        throw new Error(
          `Migration validation failed for ${configId}: promptElements length differs. ` +
            `Original: ${originalConfig.promptElements.length}, Migrated: ${migratedConfig.promptElements.length}`
        );
      }
    }

    return true;
  }
}
