/**
 * @file TurnExecutionTestModule - Test module for complete turn execution testing
 * @description Provides fluent API for configuring turn execution tests with LLM, actors, world, and monitoring
 */

import { createMockFacades } from '../../../facades/testingFacadeRegistrations.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';
import { TestModuleValidator } from '../validation/testModuleValidator.js';

/**
 * Test module for complete turn execution testing.
 * Provides a fluent API for configuring all aspects of turn execution including
 * LLM behavior, test actors, world setup, and monitoring capabilities.
 *
 * @augments ITestModule
 * @example
 * const testEnv = await new TurnExecutionTestModule()
 *   .withMockLLM({ strategy: 'tool-calling', temperature: 0.7 })
 *   .withTestActors(['ai-actor', 'player'])
 *   .withWorld({ name: 'Test World', connections: true })
 *   .withPerformanceTracking()
 *   .withEventCapture(['AI_DECISION_MADE', 'ACTION_EXECUTED'])
 *   .build();
 */
export class TurnExecutionTestModule extends ITestModule {
  #config = {
    llm: null,
    actors: [],
    world: null,
    monitoring: {
      performance: false,
      events: [],
    },
    facades: {},
  };

  #mockFn = null; // Jest mock function creator

  /**
   * Creates a new TurnExecutionTestModule instance
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
      llm: {
        strategy: 'tool-calling',
        temperature: 1.0,
        mockResponses: {},
      },
      actors: [],
      world: {
        name: 'Test World',
        createConnections: true,
      },
      monitoring: {
        performance: false,
        events: [],
      },
      facades: {},
    };
  }

  /**
   * Configure mock LLM behavior
   *
   * @param {object} config - LLM configuration options
   * @param {string} [config.strategy] - LLM strategy ('tool-calling' or 'json-schema')
   * @param {number} [config.temperature] - Temperature for LLM responses
   * @param {object} [config.mockResponses] - Mock responses by actor ID
   * @param {boolean} [config.fastMode] - Enable fast mode for performance testing
   * @returns {TurnExecutionTestModule} This instance for chaining
   */
  withMockLLM(config = {}) {
    this.#config.llm = {
      ...this.#config.llm,
      ...config,
    };
    return this;
  }

  /**
   * Add test actors to the environment
   *
   * @param {Array<string|object>} actors - Actor configurations
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * // Simple string IDs
   * .withTestActors(['ai-actor', 'player'])
   * @example
   * // Detailed configurations
   * .withTestActors([
   *   { id: 'ai-actor', type: 'ai', name: 'Test AI' },
   *   { id: 'player', type: 'player', name: 'Test Player' }
   * ])
   */
  withTestActors(actors = []) {
    this.#config.actors = actors.map((actor) =>
      typeof actor === 'string'
        ? { id: actor, type: actor.includes('ai') ? 'ai' : 'player' }
        : actor
    );
    return this;
  }

  /**
   * Configure the test world
   *
   * @param {object} worldConfig - World configuration
   * @param {string} [worldConfig.name] - World name
   * @param {boolean} [worldConfig.createConnections] - Whether to create connected locations
   * @param {string} [worldConfig.size] - World size ('small', 'medium', 'large')
   * @param {boolean} [worldConfig.generateLocations] - Whether to generate locations
   * @returns {TurnExecutionTestModule} This instance for chaining
   */
  withWorld(worldConfig) {
    this.#config.world = {
      ...this.#config.world,
      ...worldConfig,
    };
    return this;
  }

  /**
   * Enable performance tracking
   *
   * @param {object} [options] - Performance tracking options
   * @param {object} [options.thresholds] - Performance thresholds
   * @param {number} [options.thresholds.turnExecution] - Turn execution threshold in ms
   * @param {number} [options.thresholds.actionDiscovery] - Action discovery threshold in ms
   * @param {number} [options.thresholds.eventProcessing] - Event processing threshold in ms
   * @returns {TurnExecutionTestModule} This instance for chaining
   */
  withPerformanceTracking(options = {}) {
    this.#config.monitoring.performance = {
      enabled: true,
      thresholds: {
        turnExecution: 100, // ms
        actionDiscovery: 50, // ms
        eventProcessing: 10, // ms
        ...options.thresholds,
      },
    };
    return this;
  }

  /**
   * Configure event capture
   *
   * @param {Array<string>} eventTypes - Event types to capture
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * .withEventCapture(['AI_DECISION_MADE', 'ACTION_EXECUTED', 'TURN_COMPLETED'])
   */
  withEventCapture(eventTypes = []) {
    this.#config.monitoring.events = eventTypes;
    return this;
  }

  /**
   * Override specific facades with custom implementations
   *
   * @param {object} facades - Custom facade implementations
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * .withCustomFacades({
   *   actionService: {
   *     discoverActions: jest.fn().mockResolvedValue(['attack', 'defend'])
   *   }
   * })
   */
  withCustomFacades(facades = {}) {
    this.#config.facades = facades;
    return this;
  }

  /**
   * Use a standardized LLM configuration from TestConfigurationFactory
   *
   * @param {string} [strategy] - The LLM strategy to use
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * .withStandardLLM('json-schema')
   */
  withStandardLLM(strategy = 'tool-calling') {
    // Import TestConfigurationFactory dynamically to avoid circular dependencies
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
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * .withEnvironmentPreset('turnExecution')
   */
  withEnvironmentPreset(presetName) {
    // Import TestConfigurationFactory dynamically to avoid circular dependencies
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

    // Apply actors
    if (config.actors) {
      this.#config.actors = config.actors;
    }

    // Apply world
    if (config.world) {
      this.#config.world = {
        ...this.#config.world,
        ...config.world,
      };
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
      'turnExecution'
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

    // Initialize test environment using facades
    const testEnvironment =
      await facades.turnExecutionFacade.initializeTestEnvironment({
        llmStrategy: this.#config.llm.strategy,
        llmConfig: this.#config.llm,
        worldConfig: this.#config.world,
        actors: this.#config.actors,
      });

    // Set up mock LLM responses if configured
    if (this.#config.llm.mockResponses) {
      Object.entries(this.#config.llm.mockResponses).forEach(
        ([actorId, response]) => {
          facades.turnExecutionFacade.setupMocks({
            aiResponses: { [actorId]: response },
          });
        }
      );
    }

    // Create performance tracking utilities if enabled
    let performanceTracker = null;
    if (this.#config.monitoring.performance) {
      performanceTracker = this.#createPerformanceTracker();
    }

    // Create event capture utilities if enabled
    let eventCapture = null;
    if (this.#config.monitoring.events.length > 0) {
      eventCapture = this.#createEventCapture(facades);
    }

    // Return enriched test environment
    return {
      ...testEnvironment,
      facades,
      config: Object.freeze({ ...this.#config }), // Frozen copy

      // Convenience methods
      async executeAITurn(actorId) {
        const startTime = performanceTracker ? Date.now() : null;

        const result = await facades.turnExecutionFacade.executeAITurn(
          actorId,
          testEnvironment.context || {}
        );

        if (performanceTracker) {
          performanceTracker.recordTurnExecution(Date.now() - startTime);
        }

        return result;
      },

      async executePlayerTurn(actorId, command) {
        return facades.turnExecutionFacade.executePlayerTurn(actorId, command);
      },

      async cleanup() {
        if (testEnvironment.cleanup) {
          await testEnvironment.cleanup();
        }
        await facades.turnExecutionFacade.clearTestData();

        // Cleanup event capture subscription
        if (eventCapture && eventCapture.cleanup) {
          eventCapture.cleanup();
        }
      },

      // Add performance tracking methods if enabled
      ...(performanceTracker && {
        getPerformanceMetrics: () => performanceTracker.getMetrics(),
        checkPerformanceThresholds: () => performanceTracker.checkThresholds(),
      }),

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
   * @returns {TurnExecutionTestModule} This instance for chaining
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
   * @returns {TurnExecutionTestModule} New instance with same configuration
   */
  clone() {
    const cloned = new TurnExecutionTestModule(this.#mockFn);
    cloned.#config = JSON.parse(JSON.stringify(this.#config));
    return cloned;
  }

  /**
   * Create performance tracking utilities
   *
   * @private
   * @returns {object} Performance tracking utilities
   */
  #createPerformanceTracker() {
    const metrics = {
      turnExecution: [],
      actionDiscovery: [],
      eventProcessing: [],
    };

    const thresholds = this.#config.monitoring.performance.thresholds;

    return {
      recordTurnExecution: (duration) => metrics.turnExecution.push(duration),
      recordActionDiscovery: (duration) =>
        metrics.actionDiscovery.push(duration),
      recordEventProcessing: (duration) =>
        metrics.eventProcessing.push(duration),

      getMetrics: () => ({
        turnExecution: this.#calculateStats(metrics.turnExecution),
        actionDiscovery: this.#calculateStats(metrics.actionDiscovery),
        eventProcessing: this.#calculateStats(metrics.eventProcessing),
      }),

      checkThresholds: () => {
        const violations = [];

        const avgTurnExecution = this.#calculateAverage(metrics.turnExecution);
        if (avgTurnExecution > thresholds.turnExecution) {
          violations.push({
            metric: 'turnExecution',
            threshold: thresholds.turnExecution,
            actual: avgTurnExecution,
          });
        }

        return violations;
      },
    };
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

    // Hook into event bus to capture events
    // Access the event bus from the entity service dependencies
    const eventBus = facades.mockDeps?.entity?.eventBus;
    let unsubscribe = null;

    if (eventBus && typeof eventBus.subscribe === 'function') {
      // Subscribe to all events using wildcard '*'
      unsubscribe = eventBus.subscribe('*', (event) => {
        // Filter and capture events based on allowed types
        if (allowedTypes.has(event.type)) {
          capturedEvents.push({
            ...event,
            timestamp: Date.now(),
          });
        }
      });
    }

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

      // This would be called by event listener
      capture: (event) => {
        if (allowedTypes.has(event.type)) {
          capturedEvents.push({
            ...event,
            timestamp: Date.now(),
          });
        }
      },

      // Cleanup method to unsubscribe from event bus
      cleanup: () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      },
    };
  }

  /**
   * Calculate statistics for an array of numbers
   *
   * @private
   * @param {number[]} values - Array of numeric values
   * @returns {object} Statistics
   */
  #calculateStats(values) {
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0 };
    }

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: this.#calculateAverage(values),
    };
  }

  /**
   * Calculate average of an array of numbers
   *
   * @private
   * @param {number[]} values - Array of numeric values
   * @returns {number} Average value
   */
  #calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
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

    const config = baseConfigs[strategy];
    if (!config) {
      throw new Error(`Unknown LLM strategy: ${strategy}`);
    }
    return config;
  }

  /**
   * Create environment preset configuration
   *
   * @private
   * @param {string} presetName - Preset name
   * @returns {object} Environment configuration
   */
  #createEnvironmentPresetConfig(presetName) {
    // Fallback to inline configurations matching factory patterns
    const presets = {
      turnExecution: {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [
          {
            id: 'ai-actor',
            name: 'Test AI Actor',
            type: 'core:actor',
            components: {
              'core:position': { location: 'test-location' },
              'core:persona': { traits: ['brave', 'curious'] },
            },
          },
          {
            id: 'player-actor',
            name: 'Test Player',
            type: 'core:actor',
            isPlayer: true,
          },
        ],
        world: {
          id: 'test-world',
          name: 'Test World',
          description: 'A world for testing',
          locations: ['test-location', 'test-location-2'],
        },
      },
      actionProcessing: {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [
          {
            id: 'test-actor',
            name: 'Test Actor',
            type: 'core:actor',
          },
        ],
        actions: [
          { id: 'core:move', name: 'Move', requiresTarget: true },
          { id: 'core:look', name: 'Look Around', alwaysAvailable: true },
          { id: 'core:wait', name: 'Wait', alwaysAvailable: true },
        ],
        mocks: {
          actionService: {
            availableActions: [
              { id: 'core:move', name: 'Move', requiresTarget: true },
              { id: 'core:look', name: 'Look Around', alwaysAvailable: true },
              { id: 'core:wait', name: 'Wait', alwaysAvailable: true },
            ],
          },
        },
      },
      promptGeneration: {
        llm: this.#createStandardLLMConfig('json-schema'),
        actors: [
          {
            id: 'prompt-test-actor',
            name: 'Prompt Test Actor',
            type: 'core:actor',
            components: {
              'core:persona': {
                description: 'A character for testing prompt generation',
                traits: ['methodical', 'observant'],
              },
            },
          },
        ],
      },
      // Legacy support for hyphenated names
      'turn-execution': {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [],
        world: { name: 'Test World' },
      },
      'action-processing': {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [],
        actions: [],
      },
    };

    const config = presets[presetName];
    if (!config) {
      throw new Error(`Unknown environment preset: ${presetName}`);
    }
    return config;
  }
}
