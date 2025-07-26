/**
 * @file LLMTestingModule - Test module for AI decision-making and prompt testing
 * @description Provides fluent API for configuring LLM behavior tests including prompts, responses, and strategies
 */

import { createMockFacades } from '../../../facades/testingFacadeRegistrations.js';
import { ITestModule } from '../interfaces/ITestModule.js';
import { TestModuleValidationError } from '../errors/testModuleValidationError.js';
import { TestModuleValidator } from '../validation/testModuleValidator.js';

/**
 * Test module for AI decision-making and prompt testing.
 * Provides a fluent API for testing LLM interactions, prompt generation,
 * response processing, and decision-making logic.
 *
 * @augments ITestModule
 * @example
 * const testEnv = await new LLMTestingModule()
 *   .withStrategy('tool-calling')
 *   .withPromptTemplate('decision', 'You are {{name}}. Choose an action.')
 *   .withMockResponses({
 *     'scenario-1': { actionId: 'core:move', targets: { direction: 'north' } },
 *     'scenario-2': { actionId: 'core:talk', dialogue: 'Hello!' }
 *   })
 *   .withTokenLimits({ input: 2000, output: 500 })
 *   .withValidation(true)
 *   .build();
 */
export class LLMTestingModule extends ITestModule {
  #config = {
    strategy: 'tool-calling',
    promptTemplates: {},
    mockResponses: {},
    actors: [],
    scenarios: [],
    tokenLimits: {
      input: 4000,
      output: 1000,
    },
    parameters: {
      temperature: 1.0,
      topP: 1.0,
    },
    monitoring: {
      promptCapture: true,
      responseCapture: true,
      tokenCounting: true,
      validation: true,
    },
    facades: {},
  };

  #mockFn = null; // Jest mock function creator

  /**
   * Creates a new LLMTestingModule instance
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
      strategy: 'tool-calling',
      promptTemplates: {},
      mockResponses: {},
      actors: [],
      scenarios: [],
      tokenLimits: {
        input: 4000,
        output: 1000,
      },
      parameters: {
        temperature: 1.0,
        topP: 1.0,
      },
      monitoring: {
        promptCapture: true,
        responseCapture: true,
        tokenCounting: true,
        validation: true,
      },
      facades: {},
    };
  }

  /**
   * Configure the LLM strategy
   *
   * @param {string} strategy - LLM strategy ('tool-calling' or 'json-schema')
   * @returns {LLMTestingModule} This instance for chaining
   */
  withStrategy(strategy) {
    this.#config.strategy = strategy;
    return this;
  }

  /**
   * Configure prompt templates
   *
   * @param {string} name - Template name
   * @param {string} template - Template content with {{variables}}
   * @returns {LLMTestingModule} This instance for chaining
   * @example
   * .withPromptTemplate('decision', 'As {{name}}, choose from: {{actions}}')
   * .withPromptTemplate('dialogue', 'Respond as {{character}} to: {{input}}')
   */
  withPromptTemplate(name, template) {
    this.#config.promptTemplates[name] = template;
    return this;
  }

  /**
   * Configure mock LLM responses
   *
   * @param {object} responses - Mock responses by scenario or actor ID
   * @returns {LLMTestingModule} This instance for chaining
   * @example
   * .withMockResponses({
   *   'default': { actionId: 'core:wait' },
   *   'combat': { actionId: 'core:attack', target: 'enemy' },
   *   'actor-123': { actionId: 'core:move', direction: 'north' }
   * })
   */
  withMockResponses(responses = {}) {
    this.#config.mockResponses = {
      ...this.#config.mockResponses,
      ...responses,
    };
    return this;
  }

  /**
   * Configure test actors for LLM decisions
   *
   * @param {Array<object>} actors - Actor configurations
   * @returns {LLMTestingModule} This instance for chaining
   */
  withActors(actors = []) {
    this.#config.actors = actors.map((actor) => ({
      id: actor.id || `actor-${Date.now()}`,
      name: actor.name || 'Test Actor',
      type: actor.type || 'core:actor',
      ...actor,
    }));
    return this;
  }

  /**
   * Configure test scenarios
   *
   * @param {Array<object>} scenarios - Scenario configurations
   * @returns {LLMTestingModule} This instance for chaining
   * @example
   * .withScenarios([
   *   {
   *     name: 'combat-decision',
   *     actor: 'fighter',
   *     context: { inCombat: true, health: 50 },
   *     expectedActions: ['attack', 'defend', 'flee']
   *   }
   * ])
   */
  withScenarios(scenarios = []) {
    this.#config.scenarios = scenarios;
    return this;
  }

  /**
   * Configure token limits
   *
   * @param {object} limits - Token limit configuration
   * @param {number} [limits.input] - Maximum input tokens
   * @param {number} [limits.output] - Maximum output tokens
   * @returns {LLMTestingModule} This instance for chaining
   */
  withTokenLimits(limits = {}) {
    this.#config.tokenLimits = {
      ...this.#config.tokenLimits,
      ...limits,
    };
    return this;
  }

  /**
   * Configure LLM parameters
   *
   * @param {object} parameters - LLM parameters
   * @param {number} [parameters.temperature] - Temperature (0-2)
   * @param {number} [parameters.topP] - Top-p sampling (0-1)
   * @param {number} [parameters.maxTokens] - Maximum tokens to generate
   * @returns {LLMTestingModule} This instance for chaining
   */
  withParameters(parameters = {}) {
    this.#config.parameters = {
      ...this.#config.parameters,
      ...parameters,
    };
    return this;
  }

  /**
   * Configure monitoring options
   *
   * @param {object} options - Monitoring options
   * @param {boolean} [options.promptCapture] - Capture generated prompts
   * @param {boolean} [options.responseCapture] - Capture LLM responses
   * @param {boolean} [options.tokenCounting] - Count tokens
   * @param {boolean} [options.validation] - Validate responses
   * @returns {LLMTestingModule} This instance for chaining
   */
  withMonitoring(options = {}) {
    this.#config.monitoring = {
      ...this.#config.monitoring,
      ...options,
    };
    return this;
  }

  /**
   * Enable or disable response validation
   *
   * @param {boolean} enabled - Whether to validate LLM responses
   * @returns {LLMTestingModule} This instance for chaining
   */
  withValidation(enabled = true) {
    this.#config.monitoring.validation = enabled;
    return this;
  }

  /**
   * Override specific facades with custom implementations
   *
   * @param {object} facades - Custom facade implementations
   * @returns {LLMTestingModule} This instance for chaining
   */
  withCustomFacades(facades = {}) {
    this.#config.facades = facades;
    return this;
  }

  /**
   * Use a standardized LLM configuration from TestConfigurationFactory
   *
   * @param {string} [strategy] - The LLM strategy to use
   * @returns {LLMTestingModule} This instance for chaining
   * @example
   * .withStandardLLM('json-schema')
   */
  withStandardLLM(strategy = 'tool-calling') {
    // Use simplified inline configuration to avoid circular dependencies
    const llmConfig = this.#createStandardLLMConfig(strategy);

    this.#config.strategy =
      llmConfig.jsonOutputStrategy?.method === 'json_schema'
        ? 'json-schema'
        : 'tool-calling';
    this.#config.llmConfig = llmConfig;

    // Update parameters from config
    if (llmConfig.defaultParameters) {
      this.#config.parameters = {
        ...this.#config.parameters,
        ...llmConfig.defaultParameters,
      };
    }

    // Update token limits from config
    if (llmConfig.contextTokenLimit) {
      this.#config.tokenLimits.input = llmConfig.contextTokenLimit;
    }

    return this;
  }

  /**
   * Apply a complete environment preset from TestConfigurationFactory
   *
   * @param {string} presetName - The preset name to apply
   * @returns {LLMTestingModule} This instance for chaining
   * @example
   * .withEnvironmentPreset('promptGeneration')
   */
  withEnvironmentPreset(presetName) {
    // Use simplified inline configuration to avoid circular dependencies
    const config = this.#createEnvironmentPresetConfig(presetName);

    // Apply LLM configuration
    if (config.llm) {
      this.#config.strategy =
        config.llm.jsonOutputStrategy?.method === 'json_schema'
          ? 'json-schema'
          : 'tool-calling';
      this.#config.llmConfig = config.llm;

      // Update parameters from config
      if (config.llm.defaultParameters) {
        this.#config.parameters = {
          ...this.#config.parameters,
          ...config.llm.defaultParameters,
        };
      }

      // Update token limits from config
      if (config.llm.contextTokenLimit) {
        this.#config.tokenLimits.input = config.llm.contextTokenLimit;
      }
    }

    // Apply actors
    if (config.actors) {
      this.#config.actors = config.actors;
    }

    // Apply mock responses if available
    if (
      config.mocks &&
      config.mocks.llmAdapter &&
      config.mocks.llmAdapter.responses
    ) {
      this.#config.mockResponses = {
        ...this.#config.mockResponses,
        default: config.mocks.llmAdapter.responses,
      };
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
      'llmTesting'
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

    // Configure LLM service
    await facades.llmService.configureLLMStrategy(this.#config.strategy, {
      parameters: this.#config.parameters,
      tokenLimits: this.#config.tokenLimits,
    });

    // Set up mock responses
    for (const [key, response] of Object.entries(this.#config.mockResponses)) {
      facades.llmService.setMockResponse(key, response);
    }

    // Create test actors if configured
    const createdActors = {};
    if (this.#config.actors.length > 0) {
      const world = await facades.entityService.createTestWorld({
        name: 'LLM Test World',
      });

      for (const actorDef of this.#config.actors) {
        const actorId = await facades.entityService.createTestActor({
          ...actorDef,
          location: world.mainLocationId,
        });
        createdActors[actorDef.id] = actorId;
      }
    }

    // Set up monitoring
    const monitors = this.#createMonitors(facades);

    // Return enriched test environment
    return {
      strategy: this.#config.strategy,
      actors: createdActors,
      facades,
      config: Object.freeze({ ...this.#config }),

      // Convenience methods
      async getAIDecision(actorId, context = {}) {
        const startTime = Date.now();

        const decision = await facades.llmService.getAIDecision(actorId, {
          ...context,
          _testScenario: context.scenario || 'default',
        });

        if (monitors.responseCapture) {
          monitors.capturedResponses.push({
            actorId,
            context,
            decision,
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          });
        }

        return decision;
      },

      async generatePrompt(actorId, context = {}) {
        const prompt = await facades.llmService.generatePrompt(
          actorId,
          context
        );

        if (monitors.promptCapture) {
          monitors.capturedPrompts.push({
            actorId,
            context,
            prompt,
            timestamp: Date.now(),
          });
        }

        if (monitors.tokenCounting) {
          // This would use a real token counter in production
          monitors.tokenCounts.push({
            actorId,
            prompt,
            tokenCount: prompt.length / 4, // Rough estimate
            timestamp: Date.now(),
          });
        }

        return prompt;
      },

      async runScenario(scenarioName) {
        const scenario = this.#config.scenarios.find(
          (s) => s.name === scenarioName
        );
        if (!scenario) {
          throw new Error(`Scenario not found: ${scenarioName}`);
        }

        const actorId = createdActors[scenario.actor] || scenario.actor;
        return this.getAIDecision(actorId, {
          ...scenario.context,
          scenario: scenarioName,
        });
      },

      async cleanup() {
        // Clear mock responses
        facades.llmService.clearMockResponses();

        // Clean up actors
        if (Object.keys(createdActors).length > 0) {
          await facades.entityService.clearTestData();
        }
      },

      // Monitoring accessors
      getCapturedPrompts: () => [...monitors.capturedPrompts],
      getCapturedResponses: () => [...monitors.capturedResponses],
      getTokenCounts: () => [...monitors.tokenCounts],
      getValidationErrors: () => [...monitors.validationErrors],
      clearMonitors: () => {
        monitors.capturedPrompts.length = 0;
        monitors.capturedResponses.length = 0;
        monitors.tokenCounts.length = 0;
        monitors.validationErrors.length = 0;
      },
    };
  }

  /**
   * Reset module to default configuration
   *
   * @returns {LLMTestingModule} This instance for chaining
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
   * @returns {LLMTestingModule} New instance with same configuration
   */
  clone() {
    const cloned = new LLMTestingModule(this.#mockFn);
    cloned.#config = JSON.parse(JSON.stringify(this.#config));
    return cloned;
  }

  /**
   * Create monitoring utilities
   *
   * @private
   * @param {object} facades - Facade instances
   * @returns {object} Monitoring utilities
   */
  #createMonitors(facades) {
    return {
      promptCapture: this.#config.monitoring.promptCapture,
      responseCapture: this.#config.monitoring.responseCapture,
      tokenCounting: this.#config.monitoring.tokenCounting,
      validation: this.#config.monitoring.validation,
      capturedPrompts: [],
      capturedResponses: [],
      tokenCounts: [],
      validationErrors: [],
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
    // Fallback to inline configurations matching factory patterns
    const presets = {
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
        monitoring: { tokenCounting: true },
        mockResponses: {
          chosenIndex: 0,
          speech: 'Test response from JSON schema strategy.',
          thoughts: 'This is a test thought.',
          notes: [],
        },
      },
      // Legacy support for hyphenated names
      'llm-testing': {
        llm: this.#createStandardLLMConfig('tool-calling'),
        actors: [],
        scenarios: [],
      },
      'prompt-generation': {
        llm: this.#createStandardLLMConfig('json-schema'),
        actors: [],
        monitoring: { tokenCounting: true },
      },
    };

    const config = presets[presetName];
    if (!config) {
      throw new Error(`Unknown environment preset: ${presetName}`);
    }
    return config;
  }
}
