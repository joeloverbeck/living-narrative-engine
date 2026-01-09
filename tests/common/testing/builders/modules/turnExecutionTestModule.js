/**
 * @file TurnExecutionTestModule - Test module for complete turn execution testing
 * @description Provides fluent API for configuring turn execution tests with LLM, actors, world, and monitoring
 */

import { createE2ETestEnvironment } from '../../../../e2e/common/e2eTestContainer.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';
import { TestModuleValidator } from '../validation/testModuleValidator.js';
import { getSharedContainer } from '../sharedContainerFactory.js';

// ============================================================================
// Module-level cached configurations (created once, reused across all tests)
// ============================================================================

/** @type {object|null} Cached LLM configurations */
let _cachedLLMConfigs = null;

/** @type {object|null} Cached environment presets */
let _cachedEnvironmentPresets = null;

/**
 * Get cached LLM configurations (created once, frozen for safety)
 *
 * @returns {object} Frozen config objects by strategy
 */
function getCachedLLMConfigs() {
  if (!_cachedLLMConfigs) {
    _cachedLLMConfigs = Object.freeze({
      'tool-calling': Object.freeze({
        configId: 'test-llm-toolcalling',
        displayName: 'Test LLM (Tool Calling)',
        apiKeyEnvVar: 'TEST_API_KEY',
        apiKeyFileName: 'test_api_key.txt',
        endpointUrl: 'https://test-api.com/v1/chat/completions',
        modelIdentifier: 'test-model-toolcalling',
        apiType: 'openrouter',
        jsonOutputStrategy: Object.freeze({
          method: 'openrouter_tool_calling',
          toolName: 'function_call',
        }),
        defaultParameters: Object.freeze({ temperature: 1.0 }),
        contextTokenLimit: 8000,
      }),
      'json-schema': Object.freeze({
        configId: 'test-llm-jsonschema',
        displayName: 'Test LLM (JSON Schema)',
        apiKeyEnvVar: 'TEST_API_KEY',
        apiKeyFileName: 'test_api_key.txt',
        endpointUrl: 'https://test-api.com/v1/chat/completions',
        modelIdentifier: 'test-model-jsonschema',
        apiType: 'openrouter',
        jsonOutputStrategy: Object.freeze({
          method: 'json_schema',
          schema: Object.freeze({
            name: 'turn_action_response',
            schema: Object.freeze({
              type: 'object',
              properties: Object.freeze({
                chosenIndex: Object.freeze({ type: 'number' }),
                speech: Object.freeze({ type: 'string' }),
                thoughts: Object.freeze({ type: 'string' }),
              }),
              required: Object.freeze(['chosenIndex', 'speech', 'thoughts']),
            }),
          }),
        }),
        defaultParameters: Object.freeze({ temperature: 1.0 }),
        contextTokenLimit: 8000,
      }),
      'limited-context': Object.freeze({
        configId: 'test-llm-limited',
        displayName: 'Test LLM (Limited Context)',
        apiKeyEnvVar: 'TEST_API_KEY',
        apiKeyFileName: 'test_api_key.txt',
        endpointUrl: 'https://test-api.com/v1/chat/completions',
        modelIdentifier: 'test-model-limited',
        apiType: 'openrouter',
        jsonOutputStrategy: Object.freeze({
          method: 'openrouter_tool_calling',
          toolName: 'function_call',
        }),
        defaultParameters: Object.freeze({ temperature: 1.0 }),
        contextTokenLimit: 1000,
      }),
    });
  }
  return _cachedLLMConfigs;
}

/**
 * Get cached environment presets (created once, frozen for safety)
 *
 * @returns {object} Frozen preset objects by name
 */
function getCachedEnvironmentPresets() {
  if (!_cachedEnvironmentPresets) {
    const llmConfigs = getCachedLLMConfigs();

    _cachedEnvironmentPresets = Object.freeze({
      turnExecution: Object.freeze({
        llm: llmConfigs['tool-calling'],
        actors: Object.freeze([
          Object.freeze({
            id: 'ai-actor',
            name: 'Test AI Actor',
            type: 'core:actor',
            components: Object.freeze({
              'core:position': Object.freeze({ location: 'test-location' }),
              'core:persona': Object.freeze({
                traits: Object.freeze(['brave', 'curious']),
              }),
            }),
          }),
          Object.freeze({
            id: 'player-actor',
            name: 'Test Player',
            type: 'core:actor',
            isPlayer: true,
          }),
        ]),
        world: Object.freeze({
          id: 'test-world',
          name: 'Test World',
          description: 'A world for testing',
          locations: Object.freeze(['test-location', 'test-location-2']),
        }),
      }),
      actionProcessing: Object.freeze({
        llm: llmConfigs['tool-calling'],
        actors: Object.freeze([
          Object.freeze({
            id: 'test-actor',
            name: 'Test Actor',
            type: 'core:actor',
          }),
        ]),
        actions: Object.freeze([
          Object.freeze({
            id: 'core:move',
            name: 'Move',
            requiresTarget: true,
          }),
          Object.freeze({
            id: 'core:look',
            name: 'Look Around',
            alwaysAvailable: true,
          }),
          Object.freeze({
            id: 'core:wait',
            name: 'Wait',
            alwaysAvailable: true,
          }),
        ]),
        mocks: Object.freeze({
          actionService: Object.freeze({
            availableActions: Object.freeze([
              Object.freeze({
                id: 'core:move',
                name: 'Move',
                requiresTarget: true,
              }),
              Object.freeze({
                id: 'core:look',
                name: 'Look Around',
                alwaysAvailable: true,
              }),
              Object.freeze({
                id: 'core:wait',
                name: 'Wait',
                alwaysAvailable: true,
              }),
            ]),
          }),
        }),
      }),
      promptGeneration: Object.freeze({
        llm: llmConfigs['json-schema'],
        actors: Object.freeze([
          Object.freeze({
            id: 'prompt-test-actor',
            name: 'Prompt Test Actor',
            type: 'core:actor',
            components: Object.freeze({
              'core:persona': Object.freeze({
                description: 'A character for testing prompt generation',
                traits: Object.freeze(['methodical', 'observant']),
              }),
            }),
          }),
        ]),
      }),
      // Legacy support for hyphenated names
      'turn-execution': Object.freeze({
        llm: llmConfigs['tool-calling'],
        actors: Object.freeze([]),
        world: Object.freeze({ name: 'Test World' }),
      }),
      'action-processing': Object.freeze({
        llm: llmConfigs['tool-calling'],
        actors: Object.freeze([]),
        actions: Object.freeze([]),
      }),
    });
  }
  return _cachedEnvironmentPresets;
}

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

  #sharedContainerKey = null; // Key for shared container reuse

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
   * Configure this module to use a shared container for improved test performance.
   * When a shared container key is set, the build() method will reuse an existing
   * container instead of creating a new one, significantly reducing test setup time.
   *
   * @param {string} key - Unique identifier for the shared container group
   * @returns {TurnExecutionTestModule} This instance for chaining
   * @example
   * // In beforeAll, create shared container
   * await getSharedContainer('turn-execution-tests', { stubLLM: true });
   *
   * // In each test, use shared container
   * const env = await TurnExecutionTestModule.create()
   *   .withSharedContainer('turn-execution-tests')
   *   .withStandardLLM()
   *   .build();
   */
  withSharedContainer(key) {
    this.#sharedContainerKey = key;
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

    // Create container-based environment (use shared container if configured)
    const containerOptions = {
      stubLLM: true,
      loadMods: false,
      mods: ['core'],
    };

    const env = this.#sharedContainerKey
      ? await getSharedContainer(this.#sharedContainerKey, containerOptions)
      : await createE2ETestEnvironment(containerOptions);

    // Track mock data for backward compatibility
    const mockData = {
      aiResponses: new Map(),
      actionResults: new Map(),
      validationResults: new Map(),
    };

    // Create backward-compatible turn execution facade interface
    const turnExecutionFacade = {
      initializeTestEnvironment: async (config) => {
        // Create actors based on configuration
        const actors = {};
        const configActors = config?.actors || this.#config.actors || [];
        
        for (const actor of configActors) {
          const actorId = await env.helpers.createTestActor({
            name: actor.name || 'Test Actor',
            location: actor.location || 'test:location',
            components: actor.components || {},
          });
          actors[actor.id || 'aiActorId'] = actorId;
        }

        // Create a default AI actor if none specified
        if (Object.keys(actors).length === 0) {
          const aiActorId = await env.helpers.createTestActor({
            name: 'AI Actor',
            location: 'test:location',
          });
          actors.aiActorId = aiActorId;
        }

        return {
          actors,
          world: config?.worldConfig || this.#config.world,
          context: {},
        };
      },
      setupMocks: (mocks) => {
        if (mocks.aiResponses) {
          Object.entries(mocks.aiResponses).forEach(([actorId, response]) => {
            mockData.aiResponses.set(actorId, response);
          });
        }
        if (mocks.actionResults) {
          Object.entries(mocks.actionResults).forEach(([actorId, results]) => {
            mockData.actionResults.set(actorId, results);
          });
        }
        if (mocks.validationResults) {
          Object.entries(mocks.validationResults).forEach(([key, result]) => {
            mockData.validationResults.set(key, result);
          });
        }
      },
      executeAITurn: async (actorId, _context) => {
        const startTime = Date.now();

        // Get available actions for this actor
        const actions = mockData.actionResults.get(actorId) || [];

        // Check for no available actions
        if (actions.length === 0) {
          return {
            success: false,
            error: 'No available actions for actor',
            actorId,
            duration: Date.now() - startTime,
          };
        }

        // Get mock decision for this actor
        const decision = mockData.aiResponses.get(actorId) || {
          actionId: 'core:wait',
          targets: {},
        };

        // Check for invalid decision (missing actionId)
        if (!decision.actionId) {
          return {
            success: false,
            error: 'AI did not specify a valid action',
            actorId,
            duration: Date.now() - startTime,
          };
        }

        // Get mock validation result
        const validationKey = `${actorId}:${decision.actionId}`;
        const validationResult = mockData.validationResults.get(validationKey) || {
          success: true,
          validatedAction: {
            actionId: decision.actionId,
            actorId,
            targets: decision.targets || {},
          },
        };

        const duration = Date.now() - startTime;

        // Check validation failure
        if (!validationResult.success) {
          return {
            success: false,
            error: 'Action validation failed',
            actorId,
            aiDecision: decision,
            availableActionCount: actions.length,
            duration,
            validation: validationResult,
          };
        }

        // Success case
        return {
          success: true,
          actorId,
          aiDecision: decision,
          availableActionCount: actions.length,
          duration,
          validation: validationResult,
        };
      },
      executePlayerTurn: async (actorId, command) => {
        return {
          success: true,
          command,
          actorId,
        };
      },
      clearTestData: async () => {
        mockData.aiResponses.clear();
        mockData.actionResults.clear();
        mockData.validationResults.clear();
      },
      dispose: async () => {
        await env.cleanup();
      },
      getDispatchedEvents: () => {
        // Return empty array for mock facade - tests just verify it's callable
        return [];
      },
    };

    // Create actionService facade for tests that need action discovery
    const actionServiceMockData = new Map();
    const actionService = {
      setMockActions(actorId, actions) {
        actionServiceMockData.set(actorId, actions);
      },

      async discoverActions(actorId) {
        return actionServiceMockData.get(actorId) || [];
      },

      clearMockData() {
        actionServiceMockData.clear();
      },
    };

    const facades = {
      turnExecutionFacade,
      actionService,
    };

    // Initialize test environment using facade interface
    const testEnvironment =
      await turnExecutionFacade.initializeTestEnvironment({
        llmStrategy: this.#config.llm.strategy,
        llmConfig: this.#config.llm,
        worldConfig: this.#config.world,
        actors: this.#config.actors,
      });

    // Set up mock LLM responses if configured
    if (this.#config.llm.mockResponses) {
      Object.entries(this.#config.llm.mockResponses).forEach(
        ([actorId, response]) => {
          turnExecutionFacade.setupMocks({
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
      eventCapture = this.#createEventCapture(env.services.eventBus);
    }

    // Return enriched test environment
    return {
      ...testEnvironment,
      facades,
      container: env.container,
      services: env.services,
      config: Object.freeze({ ...this.#config }), // Frozen copy

      // Convenience methods
      async executeAITurn(actorId) {
        const startTime = performanceTracker ? Date.now() : null;

        const result = await turnExecutionFacade.executeAITurn(
          actorId,
          testEnvironment.context || {}
        );

        if (performanceTracker) {
          performanceTracker.recordTurnExecution(Date.now() - startTime);
        }

        return result;
      },

      async executePlayerTurn(actorId, command) {
        return turnExecutionFacade.executePlayerTurn(actorId, command);
      },

      async cleanup() {
        if (testEnvironment.cleanup) {
          await testEnvironment.cleanup();
        }
        await turnExecutionFacade.clearTestData();
        await env.cleanup();

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
   * @param {object} eventBus - Event bus instance from container
   * @returns {object} Event capture utilities
   */
  #createEventCapture(eventBus) {
    const capturedEvents = [];
    const allowedTypes = new Set(this.#config.monitoring.events);

    // Hook into event bus to capture events
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
   * Create standard LLM configuration (uses cached configs for performance)
   *
   * @private
   * @param {string} strategy - LLM strategy
   * @returns {object} LLM configuration (frozen)
   */
  #createStandardLLMConfig(strategy) {
    const configs = getCachedLLMConfigs();
    const config = configs[strategy];
    if (!config) {
      throw new Error(`Unknown LLM strategy: ${strategy}`);
    }
    return config;
  }

  /**
   * Create environment preset configuration (uses cached presets for performance)
   *
   * @private
   * @param {string} presetName - Preset name
   * @returns {object} Environment configuration (frozen)
   */
  #createEnvironmentPresetConfig(presetName) {
    const presets = getCachedEnvironmentPresets();
    const config = presets[presetName];
    if (!config) {
      throw new Error(`Unknown environment preset: ${presetName}`);
    }
    return config;
  }
}
