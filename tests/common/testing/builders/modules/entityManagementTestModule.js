/**
 * @file EntityManagementTestModule - Test module for entity lifecycle and state management
 * @description Provides fluent API for configuring entity management tests with creation, updates, and queries
 */

import { createMockFacades } from '../../../../../src/testing/facades/testingFacadeRegistrations.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';
import { TestModuleValidator } from '../validation/testModuleValidator.js';

/**
 * Test module for entity lifecycle and state management testing.
 * Provides a fluent API for configuring tests that involve entity creation,
 * component updates, queries, and relationships.
 *
 * @augments ITestModule
 * @example
 * const testEnv = await new EntityManagementTestModule()
 *   .withEntities([
 *     { type: 'core:actor', id: 'test-actor' },
 *     { type: 'core:item', id: 'test-item' }
 *   ])
 *   .withComponents({
 *     'test-actor': { 'core:inventory': { items: [] } }
 *   })
 *   .withRelationships([
 *     { from: 'test-actor', to: 'test-item', type: 'holds' }
 *   ])
 *   .withEventTracking(['ENTITY_CREATED', 'COMPONENT_UPDATED'])
 *   .build();
 */
export class EntityManagementTestModule extends ITestModule {
  #config = {
    entities: [],
    components: {},
    relationships: [],
    world: null,
    queries: [],
    monitoring: {
      events: [],
      validation: true,
    },
    facades: {},
  };

  #mockFn = null; // Jest mock function creator

  /**
   * Creates a new EntityManagementTestModule instance
   *
   * @param {Function} [mockFn] - Mock function creator (typically jest.fn)
   */
  constructor(mockFn = null) {
    super();
    this.#mockFn = mockFn;
    this.#applyDefaults();
  }

  /**
   * Apply default configuration values
   *
   * @private
   */
  #applyDefaults() {
    this.#config = {
      entities: [],
      components: {},
      relationships: [],
      world: {
        name: 'Test World',
        createLocations: true,
      },
      queries: [],
      monitoring: {
        events: [],
        validation: true,
      },
      facades: {},
    };
  }

  /**
   * Configure entities to create during setup
   *
   * @param {Array<object>} entities - Entity configurations
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withEntities([
   *   { type: 'core:actor', id: 'npc-1', name: 'Test NPC' },
   *   { type: 'core:item', id: 'sword-1', name: 'Iron Sword' }
   * ])
   */
  withEntities(entities = []) {
    this.#config.entities = entities.map((entity) => ({
      type: entity.type || 'core:actor',
      id: entity.id || `entity-${Date.now()}-${Math.random()}`,
      name: entity.name || 'Test Entity',
      ...entity,
    }));
    return this;
  }

  /**
   * Configure initial component data for entities
   *
   * @param {object} components - Component data by entity ID
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withComponents({
   *   'npc-1': {
   *     'core:health': { current: 100, max: 100 },
   *     'core:inventory': { items: ['sword-1'] }
   *   }
   * })
   */
  withComponents(components = {}) {
    this.#config.components = { ...this.#config.components, ...components };
    return this;
  }

  /**
   * Configure entity relationships
   *
   * @param {Array<object>} relationships - Relationship definitions
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withRelationships([
   *   { from: 'npc-1', to: 'sword-1', type: 'holds' },
   *   { from: 'room-1', to: 'npc-1', type: 'contains' }
   * ])
   */
  withRelationships(relationships = []) {
    this.#config.relationships = relationships;
    return this;
  }

  /**
   * Configure the test world
   *
   * @param {object} worldConfig - World configuration
   * @returns {EntityManagementTestModule} This instance for chaining
   */
  withWorld(worldConfig) {
    this.#config.world = {
      ...this.#config.world,
      ...worldConfig,
    };
    return this;
  }

  /**
   * Configure predefined queries to test
   *
   * @param {Array<object>} queries - Query configurations
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withQueries([
   *   { name: 'actorsInLocation', scope: 'core:actor', filter: { location: 'room-1' } },
   *   { name: 'itemsByType', scope: 'core:item', groupBy: 'type' }
   * ])
   */
  withQueries(queries = []) {
    this.#config.queries = queries;
    return this;
  }

  /**
   * Configure event tracking
   *
   * @param {Array<string>} eventTypes - Event types to capture
   * @returns {EntityManagementTestModule} This instance for chaining
   */
  withEventTracking(eventTypes = []) {
    this.#config.monitoring.events = eventTypes;
    return this;
  }

  /**
   * Enable or disable validation during operations
   *
   * @param {boolean} enabled - Whether to enable validation
   * @returns {EntityManagementTestModule} This instance for chaining
   */
  withValidation(enabled = true) {
    this.#config.monitoring.validation = enabled;
    return this;
  }

  /**
   * Override specific facades with custom implementations
   *
   * @param {object} facades - Custom facade implementations
   * @returns {EntityManagementTestModule} This instance for chaining
   */
  withCustomFacades(facades = {}) {
    this.#config.facades = facades;
    return this;
  }

  /**
   * Use a standardized LLM configuration from TestConfigurationFactory
   *
   * @param {string} [strategy] - The LLM strategy to use
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withStandardLLM('json-schema')
   */
  withStandardLLM(strategy = 'tool-calling') {
    // Use simplified inline configuration to avoid circular dependencies
    const llmConfig = this.#createStandardLLMConfig(strategy);

    this.#config.llm = {
      ...this.#config.llm,
      strategy:
        llmConfig.jsonOutputStrategy?.method === 'json_schema'
          ? 'json-schema'
          : 'tool-calling',
      llmConfig: llmConfig,
    };

    return this;
  }

  /**
   * Apply a complete environment preset from TestConfigurationFactory
   *
   * @param {string} presetName - The preset name to apply
   * @returns {EntityManagementTestModule} This instance for chaining
   * @example
   * .withEnvironmentPreset('entityManagement')
   */
  withEnvironmentPreset(presetName) {
    // Use simplified inline configuration to avoid circular dependencies
    const config = this.#createEnvironmentPresetConfig(presetName);

    // Apply LLM configuration
    if (config.llm) {
      this.#config.llm = {
        ...this.#config.llm,
        strategy:
          config.llm.jsonOutputStrategy?.method === 'json_schema'
            ? 'json-schema'
            : 'tool-calling',
        llmConfig: config.llm,
      };
    }

    // Apply entities
    if (config.entities) {
      this.#config.entities = config.entities;
    }

    // Apply world
    if (config.world) {
      this.#config.world = {
        ...this.#config.world,
        ...config.world,
      };
    }

    // Apply relationships
    if (config.relationships) {
      this.#config.relationships = config.relationships;
    }

    // Apply mocks
    if (config.mocks) {
      this.#config.mocks = config.mocks;
    }

    return this;
  }

  /**
   * Validate configuration before building
   *
   * @returns {import('../validation/testModuleValidator.js').ValidationResult}
   */
  validate() {
    return TestModuleValidator.validateConfiguration(
      this.#config,
      'entityManagement'
    );
  }

  /**
   * Build the test environment
   *
   * @returns {Promise<import('../interfaces/ITestModule.js').TestEnvironment>}
   * @throws {TestModuleValidationError} If configuration is invalid
   */
  async build() {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new TestModuleValidationError(
        'Invalid test module configuration',
        validation.errors
      );
    }

    // Create facades with configuration
    const facades = createMockFacades(
      this.#config.facades,
      this.#mockFn || (() => () => {})
    );

    // Initialize world if configured
    let world = null;
    if (this.#config.world && this.#config.world.createLocations) {
      world = await facades.entityService.createTestWorld(this.#config.world);
    }

    // Create configured entities
    const createdEntities = {};
    for (const entityDef of this.#config.entities) {
      const entityId = await facades.entityService.createEntity({
        type: entityDef.type,
        id: entityDef.id,
        initialData: {
          ...entityDef,
          ...(this.#config.components[entityDef.id] || {}),
        },
      });
      createdEntities[entityDef.id] = entityId;
    }

    // Apply component updates
    for (const [entityId, components] of Object.entries(
      this.#config.components
    )) {
      if (createdEntities[entityId]) {
        for (const [componentId, data] of Object.entries(components)) {
          await facades.entityService.updateComponent(
            createdEntities[entityId],
            componentId,
            data
          );
        }
      }
    }

    // Create relationships
    for (const rel of this.#config.relationships) {
      // This would need implementation in the entity service
      // For now, we'll store them as metadata
      if (createdEntities[rel.from] && createdEntities[rel.to]) {
        await facades.entityService.updateComponent(
          createdEntities[rel.from],
          'core:relationships',
          {
            [rel.type]: [
              ...((
                await facades.entityService.getComponent(
                  createdEntities[rel.from],
                  'core:relationships'
                )
              )?.[rel.type] || []),
              createdEntities[rel.to],
            ],
          }
        );
      }
    }

    // Set up event capture if configured
    let eventCapture = null;
    if (this.#config.monitoring.events.length > 0) {
      eventCapture = this.#createEventCapture(facades);
    }

    // Return enriched test environment
    return {
      entities: createdEntities,
      world,
      facades,
      config: Object.freeze({ ...this.#config }),

      // Convenience methods
      async createEntity(definition) {
        return facades.entityService.createEntity(definition);
      },

      async updateComponent(entityId, componentId, data) {
        return facades.entityService.updateComponent(
          entityId,
          componentId,
          data
        );
      },

      async getEntity(entityId) {
        return facades.entityService.getEntity(entityId);
      },

      async queryEntities(scope, filter) {
        return facades.entityService.queryEntities(scope, filter);
      },

      async deleteEntity(entityId) {
        return facades.entityService.deleteEntity(entityId);
      },

      async cleanup() {
        // Clean up all created entities
        for (const entityId of Object.values(createdEntities)) {
          try {
            await facades.entityService.deleteEntity(entityId);
          } catch (error) {
            // Ignore cleanup errors
          }
        }

        if (world) {
          await facades.entityService.clearTestData();
        }
      },

      // Add event capture methods if enabled
      ...(eventCapture && {
        getCapturedEvents: (eventType) => eventCapture.getEvents(eventType),
        clearCapturedEvents: () => eventCapture.clear(),
      }),
    };
  }

  /**
   * Reset module to default configuration
   *
   * @returns {EntityManagementTestModule} This instance for chaining
   */
  reset() {
    this.#applyDefaults();
    return this;
  }

  /**
   * Get a frozen copy of the current configuration
   *
   * @returns {object} Current configuration
   */
  getConfiguration() {
    return Object.freeze(JSON.parse(JSON.stringify(this.#config)));
  }

  /**
   * Clone this module with its current configuration
   *
   * @returns {EntityManagementTestModule} New instance with same configuration
   */
  clone() {
    const cloned = new EntityManagementTestModule(this.#mockFn);
    cloned.#config = JSON.parse(JSON.stringify(this.#config));
    return cloned;
  }

  /**
   * Create event capture utilities
   *
   * @private
   * @param {object} facades - Facade instances
   * @returns {object} Event capture utilities
   */
  #createEventCapture(facades) {
    const capturedEvents = [];
    const allowedTypes = new Set(this.#config.monitoring.events);

    return {
      getEvents: (eventType) => {
        if (eventType) {
          return capturedEvents.filter((e) => e.type === eventType);
        }
        return [...capturedEvents];
      },

      clear: () => {
        capturedEvents.length = 0;
      },

      capture: (event) => {
        if (allowedTypes.has(event.type)) {
          capturedEvents.push({
            ...event,
            timestamp: Date.now(),
          });
        }
      },
    };
  }

  /**
   * Create standard LLM configuration
   *
   * @private
   * @param {string} strategy - LLM strategy
   * @returns {object} LLM configuration
   */
  #createStandardLLMConfig(strategy) {
    // Fallback to inline configuration matching TestConfigurationFactory output
    const baseConfigs = {
        'tool-calling': {
          configId: 'test-llm-toolcalling',
          displayName: 'Test LLM (Tool Calling)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-toolcalling',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_tool_calling',
            toolName: 'function_call',
          },
          defaultParameters: { temperature: 1.0 },
          contextTokenLimit: 8000,
        },
        'json-schema': {
          configId: 'test-llm-jsonschema',
          displayName: 'Test LLM (JSON Schema)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-jsonschema',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'json_schema',
            schema: {
              name: 'turn_action_response',
              schema: {
                type: 'object',
                properties: {
                  chosenIndex: { type: 'number' },
                  speech: { type: 'string' },
                  thoughts: { type: 'string' },
                },
                required: ['chosenIndex', 'speech', 'thoughts'],
              },
            },
          },
          defaultParameters: { temperature: 1.0 },
          contextTokenLimit: 8000,
        },
        'limited-context': {
          configId: 'test-llm-limited',
          displayName: 'Test LLM (Limited Context)',
          apiKeyEnvVar: 'TEST_API_KEY',
          apiKeyFileName: 'test_api_key.txt',
          endpointUrl: 'https://test-api.com/v1/chat/completions',
          modelIdentifier: 'test-model-limited',
          apiType: 'openrouter',
          jsonOutputStrategy: {
            method: 'openrouter_tool_calling',
            toolName: 'function_call',
          },
          defaultParameters: { temperature: 1.0 },
          contextTokenLimit: 1000,
        },
      };
    return baseConfigs[strategy] || baseConfigs['tool-calling'];
  }

  /**
   * Create environment preset configuration
   *
   * @private
   * @param {string} presetName - Preset name
   * @returns {object} Environment configuration
   */
  #createEnvironmentPresetConfig(presetName) {
    // Simplified inline configurations to avoid circular dependency
    const presets = {
      'entity-management': {
        llm: this.#createStandardLLMConfig('tool-calling'),
        entities: [],
        components: {},
      },
      'turn-execution': {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [],
        world: { name: 'Test World' },
      },
    };

    const config = presets[presetName];
    if (!config) {
      throw new Error(`Unknown environment preset: ${presetName}`);
    }
    return config;
  }
}
