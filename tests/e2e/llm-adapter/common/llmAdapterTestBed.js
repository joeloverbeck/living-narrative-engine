/**
 * @file llmAdapterTestBed.js
 * @description Test bed for LLM adapter E2E tests
 *
 * Provides a comprehensive test environment for testing the complete LLM adapter
 * integration flow including configuration loading, HTTP communication mocking,
 * and response processing.
 */

import { jest } from '@jest/globals';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { aiTokens } from '../../../../src/dependencyInjection/tokens/tokens-ai.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { TestConfigurationFactory } from '../../../common/testConfigurationFactory.js';

/**
 * Test bed for LLM adapter integration testing
 *
 * This test bed creates a controlled environment for testing the complete
 * LLM adapter flow with:
 * - Mock HTTP client for API response simulation
 * - Test LLM configurations
 * - API key management
 * - Response processing utilities
 */
export class LLMAdapterTestBed {
  constructor() {
    this.container = null;
    this.llmAdapter = null;
    this.httpClient = null;
    this.logger = null;
    this.eventBus = null;
    this.events = [];
    this.eventSubscription = null;

    // Test configuration
    this.testConfiguration = null;
    this.testConfigurationCleanup = null;

    // Mock HTTP responses
    this.mockResponses = new Map();
  }

  /**
   * Initialize the test bed with all required services
   */
  async initialize() {
    // Create test configuration with isolated paths
    const testConfig = await TestConfigurationFactory.createTestConfiguration();
    this.testConfiguration = testConfig.pathConfiguration;
    this.testConfigurationCleanup = testConfig.cleanup;

    // Create and configure container
    this.container = new AppContainer();

    // Configure container with test UI elements
    configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Override the path configuration with our test configuration
    this.container.register(
      tokens.IPathConfiguration,
      () => this.testConfiguration,
      {
        lifecycle: 'singleton',
      }
    );

    // Create and register mock HTTP client
    this.httpClient = this.createMockHttpClient();
    this.container.register(tokens.IHttpClient, () => this.httpClient, {
      lifecycle: 'singleton',
    });

    // Create and register mock data fetcher
    this.container.register(
      tokens.IDataFetcher,
      () => this.createMockDataFetcher(),
      {
        lifecycle: 'singleton',
      }
    );

    // Resolve core services
    this.eventBus = this.container.resolve(tokens.IEventBus);
    this.logger = this.container.resolve(tokens.ILogger);

    // Set test API keys BEFORE any LLM-related initialization
    process.env.TEST_API_KEY = 'test-api-key-12345';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    // Load schemas FIRST - they are needed for validation
    const schemaLoader = this.container.resolve(tokens.SchemaLoader);
    await schemaLoader.loadAndCompileAllSchemas();

    // Now resolve LLM adapter after schemas are loaded
    this.llmAdapter = this.container.resolve(aiTokens.LLMAdapter);

    // Initialize LLM adapter with config loader
    const llmConfigLoader = this.container.resolve(tokens.LlmConfigLoader);

    try {
      await this.llmAdapter.init({ llmConfigLoader });
    } catch (error) {
      console.error('Failed to initialize LLM adapter:', error);
      throw error;
    }

    // Set up event monitoring
    this.setupEventMonitoring();
  }

  /**
   * Clean up resources after tests
   */
  async cleanup() {
    if (this.eventSubscription) {
      this.eventSubscription();
    }
    this.events = [];
    this.mockResponses.clear();

    // Clean up environment variables
    delete process.env.TEST_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    // Clean up test configuration
    if (this.testConfigurationCleanup) {
      await this.testConfigurationCleanup();
    }

    this.testConfiguration = null;
    this.testConfigurationCleanup = null;
  }

  /**
   * Set up monitoring of all events dispatched through the system
   */
  setupEventMonitoring() {
    this.eventSubscription = this.eventBus.subscribe('*', (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: event.payload,
      });
    });
  }

  /**
   * Create a mock HTTP client that returns predefined responses
   */
  createMockHttpClient() {
    return {
      request: jest.fn().mockImplementation(async (url, options) => {
        const key = `${options?.method || 'POST'}:${url}`;
        const mockResponse = this.mockResponses.get(key);

        if (mockResponse) {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 10));

          // If the mock response is an error, throw it
          if (mockResponse instanceof Error) {
            throw mockResponse;
          }

          return mockResponse;
        }

        // Default response if no mock is set
        throw new Error(
          `No mock response configured for ${options?.method || 'POST'} ${url}`
        );
      }),
    };
  }

  /**
   * Generate a key for storing/retrieving mock responses
   *
   * @param {object} options - HTTP request options
   * @returns {string} Mock key
   */
  generateMockKey(options) {
    return `${options.method || 'POST'}:${options.url}`;
  }

  /**
   * Set a mock response for a specific HTTP request
   *
   * @param {string} url - URL to mock
   * @param {object|Error} response - Response object or error to throw
   * @param {string} [method] - HTTP method
   */
  setMockResponse(url, response, method = 'POST') {
    const key = `${method}:${url}`;
    this.mockResponses.set(key, response);
  }

  /**
   * Create a successful tool calling response
   *
   * @param {object} data - Response data
   * @returns {object} Mock HTTP response
   */
  createToolCallingResponse(data) {
    return {
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'function_call',
                  arguments: JSON.stringify(data),
                },
              },
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 50,
        total_tokens: 1050,
      },
    };
  }

  /**
   * Create a successful JSON content response
   *
   * @param {object} data - Response data
   * @returns {object} Mock HTTP response
   */
  createJsonContentResponse(data) {
    return {
      choices: [
        {
          message: {
            content: JSON.stringify(data),
          },
        },
      ],
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 50,
        total_tokens: 1050,
      },
    };
  }

  /**
   * Create an error response
   *
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   * @returns {Error} Error with response property
   */
  createErrorResponse(status, message) {
    const error = new Error(message);
    error.response = {
      status,
      data: { error: { message } },
    };
    return error;
  }

  /**
   * Get AI decision through the adapter
   *
   * @param {string} prompt - The prompt to send
   * @param {AbortSignal} [abortSignal] - Optional abort signal
   * @returns {Promise<string>} Raw JSON response
   */
  async getAIDecision(prompt, abortSignal) {
    return await this.llmAdapter.getAIDecision(prompt, abortSignal);
  }

  /**
   * Switch to a different LLM configuration
   *
   * @param {string} configId - Configuration ID to switch to
   */
  async switchLLMConfig(configId) {
    await this.llmAdapter.setActiveLlm(configId);
  }

  /**
   * Get the current active LLM configuration
   */
  async getCurrentLLMConfig() {
    const configId = await this.llmAdapter.getCurrentActiveLlmId();
    const config = await this.llmAdapter.getCurrentActiveLlmConfig();
    return { configId, config };
  }

  /**
   * Get all events of a specific type
   *
   * @param {string} eventType
   */
  getEventsByType(eventType) {
    return this.events.filter((e) => e.type === eventType);
  }

  /**
   * Clear recorded events
   */
  clearRecordedEvents() {
    this.events = [];
  }

  /**
   * Create a test prompt
   *
   * @param {number} [length] - Approximate character length
   * @returns {string} Test prompt
   */
  createTestPrompt(length = 1000) {
    const base = `<task_definition>
You are a character in a game. Choose an action.
</task_definition>

<character_persona>
You are Elara the Bard, a cheerful storyteller.
</character_persona>

<indexed_choices>
[1] Wait and observe
[2] Move to Market Square
[3] Perform a song
</indexed_choices>

<final_instructions>
Choose one action by its index number and explain your choice.
</final_instructions>
`;

    // Pad with additional content if needed
    if (length > base.length) {
      const padding = '\n<!-- Additional context... -->\n'.repeat(
        Math.ceil((length - base.length) / 35)
      );
      return base + padding;
    }

    return base;
  }

  /**
   * Create a very long prompt to test token limits
   *
   * @param {number} estimatedTokens - Target token count
   * @returns {string} Long test prompt
   */
  createLongPrompt(estimatedTokens) {
    // Rough estimate: ~4 characters per token
    const targetChars = estimatedTokens * 4;
    const basePrompt = this.createTestPrompt();
    const padding =
      'This is a very long observation that contains many words to increase the token count. '.repeat(
        Math.ceil((targetChars - basePrompt.length) / 85)
      );

    return basePrompt.replace(
      '</character_persona>',
      `</character_persona>\n\n<perception_log>\n${padding}\n</perception_log>`
    );
  }

  /**
   * Create a mock data fetcher that returns test data
   */
  createMockDataFetcher() {
    // Use centralized test configuration factory instead of inline configs
    const mockLlmConfig = {
      defaultConfigId: 'test-llm-toolcalling',
      configs: {
        'test-llm-toolcalling': TestConfigurationFactory.createLLMConfig('tool-calling'),
        'test-llm-jsonschema': TestConfigurationFactory.createLLMConfig('json-schema', {
          // Override to match original method name for compatibility
          jsonOutputStrategy: {
            method: 'openrouter_json_schema',
            jsonSchema: {
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
        }),
        'test-llm-limited': TestConfigurationFactory.createLLMConfig('limited-context'),
      },
    };

    return {
      async fetch(identifier) {
        // Handle llm-configs.json from different paths
        if (
          identifier.includes('llm-configs.json') &&
          !identifier.includes('.schema.json')
        ) {
          return mockLlmConfig;
        } else if (identifier.includes('test_api_key.txt')) {
          return 'test-api-key-12345';
        } else if (identifier.includes('game.json')) {
          return { mods: ['core'] };
        } else if (identifier.includes('.schema.json')) {
          // Return minimal schema for any schema file
          let schemaName = identifier
            .split('/')
            .pop()
            .replace('.schema.json', '');

          // Handle operations subdirectory
          if (identifier.includes('/operations/')) {
            schemaName = identifier
              .split('/operations/')
              .pop()
              .replace('.schema.json', '');

            // Return operation schema with proper $id
            return {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: `schema://living-narrative-engine/operations/${schemaName}.schema.json`,
              type: 'object',
              additionalProperties: true,
            };
          }

          // Special handling for specific schemas
          if (schemaName === 'action') {
            return {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['id', 'name'],
              additionalProperties: true,
            };
          }

          // Special handling for llm-configs schema
          if (schemaName === 'llm-configs') {
            return {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: `schema://living-narrative-engine/llm-configs.schema.json`,
              type: 'object',
              properties: {
                defaultConfigId: { type: 'string' },
                configs: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      configId: { type: 'string' },
                      displayName: { type: 'string' },
                      apiKeyEnvVar: { type: 'string' },
                      endpointUrl: { type: 'string' },
                      modelIdentifier: { type: 'string' },
                      apiType: { type: 'string' },
                      jsonOutputStrategy: { type: 'object' },
                      defaultParameters: { type: 'object' },
                      contextTokenLimit: { type: 'number' },
                    },
                    required: [
                      'configId',
                      'displayName',
                      'apiKeyEnvVar',
                      'endpointUrl',
                      'modelIdentifier',
                    ],
                  },
                },
              },
              required: ['defaultConfigId', 'configs'],
              additionalProperties: false,
            };
          }

          // Common schema is often referenced by other schemas
          if (schemaName === 'common') {
            return {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: `schema://living-narrative-engine/common.schema.json`,
              definitions: {
                contentId: {
                  type: 'string',
                  pattern: '^(none|self|[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)$',
                },
              },
            };
          }

          // Default schema
          return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: `schema://living-narrative-engine/${schemaName}.schema.json`,
            type: 'object',
            additionalProperties: true,
          };
        } else if (identifier.includes('mod-manifest.json')) {
          // Return minimal mod manifest
          return {
            id: 'core',
            version: '1.0.0',
            name: 'Core Mod',
            description: 'Core game content',
            author: 'Test',
            dependencies: [],
          };
        } else if (identifier.includes('llm-prompt-processor-error.json')) {
          // Return empty error file
          return {};
        }

        // Return empty array for directories
        if (
          identifier.includes('/actions/') ||
          identifier.includes('/components/') ||
          identifier.includes('/entities/') ||
          identifier.includes('/rules/')
        ) {
          return [];
        }

        throw new Error(`Mock data fetcher: Unknown identifier ${identifier}`);
      },
    };
  }
}

export default LLMAdapterTestBed;
