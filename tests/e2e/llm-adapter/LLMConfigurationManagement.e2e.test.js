/**
 * @file End-to-end test for LLM Configuration Management
 * @see reports/llm-prompt-workflow-analysis.md
 *
 * This test suite covers the configuration loading and switching functionality:
 * - Loading initial configurations from llm-configs.json
 * - Switching between different LLM configurations
 * - Verifying configuration properties are correctly applied
 * - Testing different JSON output strategies
 * - Testing token limit changes
 * - Error handling for invalid configurations
 * - Configuration persistence across operations
 *
 * Performance Optimization:
 * - Uses lightweight mode (skips temp directory creation)
 * - Skips schema loading (uses mocked data fetcher)
 * - Reuses test bed instance with reset() between tests where possible
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
} from '@jest/globals';
import { LLMAdapterTestBed } from './common/llmAdapterTestBed.js';

/**
 * E2E test suite for LLM Configuration Management
 * Tests the complete configuration loading and switching workflow
 *
 * Optimized for performance by:
 * 1. Using lightweight mode (no file system temp directories)
 * 2. Reusing single test bed instance with reset() between tests
 *
 * Note: Schema loading cannot be skipped because LlmConfigLoader requires
 * schema validation. However, schemas are mocked so loading is fast.
 */
describe('E2E: LLM Configuration Management', () => {
  let testBed;

  // Initialize once for all tests - significantly faster than per-test initialization
  beforeAll(async () => {
    testBed = new LLMAdapterTestBed({
      lightweight: true, // Skip temp directory creation
      // Note: skipSchemaLoading cannot be used - LlmConfigLoader requires schema validation
    });
    await testBed.initialize();
  });

  afterAll(async () => {
    // Clean up test bed after all tests complete
    await testBed.cleanup();
  });

  beforeEach(async () => {
    // Reset state between tests (much faster than full re-initialization)
    await testBed.reset();
    testBed.clearRecordedEvents();
  });

  /**
   * Test: Load initial configurations and verify default
   * Verifies that configurations are loaded correctly on initialization
   */
  test('should load configs and use default LLM on initialization', async () => {
    // Arrange - Get initial state
    const { configId, config } = await testBed.getCurrentLLMConfig();

    // Assert - Default config should be loaded
    expect(configId).toBe('test-llm-toolcalling');
    expect(config).toBeDefined();
    expect(config.configId).toBe('test-llm-toolcalling');
    expect(config.displayName).toBe('Test LLM (Tool Calling)');
    expect(config.apiType).toBe('openrouter');
    expect(config.jsonOutputStrategy.method).toBe('openrouter_tool_calling');
    expect(config.contextTokenLimit).toBe(8000);
  });

  /**
   * Test: Switch between LLM configurations
   * Verifies adapter can switch between different LLM configurations
   */
  test('should switch between LLMs and update active configuration', async () => {
    // Arrange - Verify initial config
    const initialConfig = await testBed.getCurrentLLMConfig();
    expect(initialConfig.configId).toBe('test-llm-toolcalling');

    // Act - Switch to JSON schema config
    await testBed.switchLLMConfig('test-llm-jsonschema');

    // Assert - Config should be updated
    const newConfig = await testBed.getCurrentLLMConfig();
    expect(newConfig.configId).toBe('test-llm-jsonschema');
    expect(newConfig.config.displayName).toBe('Test LLM (JSON Schema)');
    expect(newConfig.config.jsonOutputStrategy.method).toBe(
      'openrouter_json_schema'
    );

    // Act - Switch to limited context config
    await testBed.switchLLMConfig('test-llm-limited');

    // Assert - Config should be updated again
    const limitedConfig = await testBed.getCurrentLLMConfig();
    expect(limitedConfig.configId).toBe('test-llm-limited');
    expect(limitedConfig.config.contextTokenLimit).toBe(1000); // Lower limit
  });

  /**
   * Test: Configuration properties are correctly applied
   * Verifies that all configuration properties are properly loaded and accessible
   */
  test('should correctly load all configuration properties', async () => {
    // Arrange - Ensure we're testing the default configuration
    // Previous tests may have switched to a different configuration
    await testBed.switchLLMConfig('test-llm-toolcalling');

    // Act - Get current config
    const { config } = await testBed.getCurrentLLMConfig();

    // Assert - All required properties should be present
    expect(config.configId).toBeDefined();
    expect(config.displayName).toBeDefined();
    expect(config.modelIdentifier).toBeDefined();
    expect(config.endpointUrl).toBeDefined();
    expect(config.apiType).toBeDefined();
    expect(config.jsonOutputStrategy).toBeDefined();
    expect(config.defaultParameters).toBeDefined();
    expect(config.contextTokenLimit).toBeDefined();

    // Assert - API configuration
    expect(config.apiKeyEnvVar).toBe('TEST_API_KEY');
    expect(config.endpointUrl).toBe('https://test-api.com/v1/chat/completions');
    expect(config.modelIdentifier).toBe('test-model-toolcalling');

    // Assert - Default parameters
    expect(config.defaultParameters.temperature).toBe(1.0);
  });

  /**
   * Test: Different JSON output strategies
   * Verifies that different configurations use different JSON output strategies
   */
  test('should support different JSON output strategies across configs', async () => {
    // Test tool calling strategy
    const toolCallingConfig = await testBed.getCurrentLLMConfig();
    expect(toolCallingConfig.config.jsonOutputStrategy).toEqual({
      method: 'openrouter_tool_calling',
      toolName: 'function_call',
    });

    // Switch to JSON schema strategy
    await testBed.switchLLMConfig('test-llm-jsonschema');
    const jsonSchemaConfig = await testBed.getCurrentLLMConfig();
    expect(jsonSchemaConfig.config.jsonOutputStrategy).toMatchObject({
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
    });
  });

  /**
   * Test: Token limit changes when switching
   * Verifies that token limits are correctly updated when switching configs
   */
  test('should update token limits when switching configurations', async () => {
    // Arrange - Get initial token limit
    const initialConfig = await testBed.getCurrentLLMConfig();
    const initialLimit = initialConfig.config.contextTokenLimit;
    expect(initialLimit).toBe(8000);

    // Act - Switch to limited config
    await testBed.switchLLMConfig('test-llm-limited');

    // Assert - Token limit should be lower
    const limitedConfig = await testBed.getCurrentLLMConfig();
    expect(limitedConfig.config.contextTokenLimit).toBe(1000);

    // Act - Switch back to original
    await testBed.switchLLMConfig('test-llm-toolcalling');

    // Assert - Token limit should be restored
    const restoredConfig = await testBed.getCurrentLLMConfig();
    expect(restoredConfig.config.contextTokenLimit).toBe(8000);
  });

  /**
   * Test: Invalid configuration handling
   * Verifies error handling when switching to non-existent configurations
   */
  test('should handle switching to non-existent configuration', async () => {
    // Arrange - Get initial config
    const initialConfig = await testBed.getCurrentLLMConfig();
    expect(initialConfig.configId).toBe('test-llm-toolcalling');

    // Act - Try to switch to non-existent config
    // The implementation returns false rather than throwing, so we verify
    // the config remains unchanged regardless of the error handling approach
    await testBed.switchLLMConfig('non-existent-llm');

    // Assert - Config should remain unchanged (switch failed gracefully)
    const currentConfig = await testBed.getCurrentLLMConfig();
    expect(currentConfig.configId).toBe('test-llm-toolcalling');
  });

  /**
   * Test: Configuration affects prompt processing
   * Verifies that configuration changes affect how prompts are processed
   */
  test('should use active configuration for prompt processing', async () => {
    // Arrange
    const testPrompt = testBed.createTestPrompt();

    // Test with tool calling config
    const toolCallingResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Response from tool calling',
      thoughts: 'Tool calling thoughts',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      toolCallingResponse
    );

    // Act - Process with tool calling
    const response1 = await testBed.getAIDecision(testPrompt);
    const parsed1 = JSON.parse(response1);

    // Assert - Response processed correctly
    expect(parsed1.speech).toBe('Response from tool calling');

    // Switch to JSON schema config
    await testBed.switchLLMConfig('test-llm-jsonschema');

    const jsonSchemaResponse = testBed.createJsonContentResponse({
      chosenIndex: 2,
      speech: 'Response from JSON schema',
      thoughts: 'JSON schema thoughts',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      jsonSchemaResponse
    );

    // Act - Process with JSON schema
    const response2 = await testBed.getAIDecision(testPrompt);
    const parsed2 = JSON.parse(response2);

    // Assert - Different response with different config
    expect(parsed2.speech).toBe('Response from JSON schema');

    // Verify requests used different strategies
    const requests = testBed.httpClient.request.mock.calls;
    expect(requests[0][1].body).toContain('tools'); // First request uses tools
    expect(requests[0][1].body).toContain('tool_choice'); // First request has tool_choice
    expect(requests[1][1].body).toContain('response_format'); // Second request uses response_format
  });

  /**
   * Test: Configuration persistence
   * Verifies that configuration selection persists across multiple operations
   */
  test('should persist configuration selection across operations', async () => {
    // Arrange - Switch to a non-default config
    await testBed.switchLLMConfig('test-llm-jsonschema');

    // Act - Perform multiple operations
    const testPrompt = testBed.createTestPrompt();
    const mockResponse = testBed.createJsonContentResponse({
      chosenIndex: 1,
      speech: 'Test response',
      thoughts: 'Test thoughts',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Make multiple requests
    for (let i = 0; i < 3; i++) {
      await testBed.getAIDecision(testPrompt);
    }

    // Assert - Config should still be JSON schema
    const currentConfig = await testBed.getCurrentLLMConfig();
    expect(currentConfig.configId).toBe('test-llm-jsonschema');

    // All requests should use JSON schema strategy
    const requests = testBed.httpClient.request.mock.calls;
    requests.forEach((call) => {
      expect(call[1].body).toContain('json_schema');
    });
  });

  /**
   * Test: Configuration validation
   * Verifies that configurations are validated when loaded
   */
  test('should validate configuration structure on load', async () => {
    // The test bed should have already loaded and validated configs
    // We can verify by checking that the loaded config has all required fields

    const { config } = await testBed.getCurrentLLMConfig();

    // Assert - Required fields are present and valid
    expect(config.configId).toMatch(/^[a-zA-Z0-9-_]+$/);
    expect(config.displayName.length).toBeGreaterThan(0);
    expect(config.endpointUrl).toMatch(/^https?:\/\//);
    expect(['openrouter', 'openai', 'anthropic']).toContain(config.apiType);
    expect(config.contextTokenLimit).toBeGreaterThan(0);

    // JSON output strategy validation
    const validMethods = [
      'openrouter_tool_calling',
      'openrouter_json_schema',
      'gbnf_grammar',
    ];
    expect(validMethods).toContain(config.jsonOutputStrategy.method);

    // Validate method-specific properties using type guard pattern
    // (avoids conditional expects while still validating structure)
    const isToolCalling =
      config.jsonOutputStrategy.method === 'openrouter_tool_calling';
    const isJsonSchema =
      config.jsonOutputStrategy.method === 'openrouter_json_schema';

    // At least one strategy must be valid with its required properties
    const hasValidToolCallingConfig =
      isToolCalling && config.jsonOutputStrategy.toolName !== undefined;
    const hasValidJsonSchemaConfig =
      isJsonSchema && config.jsonOutputStrategy.jsonSchema !== undefined;
    const hasOtherValidConfig = !isToolCalling && !isJsonSchema;

    expect(
      hasValidToolCallingConfig ||
        hasValidJsonSchemaConfig ||
        hasOtherValidConfig
    ).toBe(true);
  });

  /**
   * Test: Multiple rapid configuration switches
   * Verifies that rapid configuration switching works correctly
   */
  test('should handle rapid configuration switching', async () => {
    // Arrange
    const configs = [
      'test-llm-toolcalling',
      'test-llm-jsonschema',
      'test-llm-limited',
    ];

    // Act - Rapidly switch between all configs
    for (let i = 0; i < 10; i++) {
      const targetConfig = configs[i % configs.length];
      await testBed.switchLLMConfig(targetConfig);

      // Verify switch was successful
      const { configId } = await testBed.getCurrentLLMConfig();
      expect(configId).toBe(targetConfig);
    }

    // Assert - Final config should be as expected
    const finalConfig = await testBed.getCurrentLLMConfig();
    expect(finalConfig.configId).toBe('test-llm-toolcalling'); // 10 % 3 = 1, so second config
  });

  /**
   * Test: Configuration affects API endpoint selection
   * Verifies that different configurations can use different endpoints
   */
  test('should use configuration-specific endpoints and parameters', async () => {
    // Arrange
    const testPrompt = testBed.createTestPrompt();
    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Test',
      thoughts: 'Test',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Act - Make request with current config
    await testBed.getAIDecision(testPrompt);

    // Assert - Request should include model identifier from config
    const requestBody = JSON.parse(
      testBed.httpClient.request.mock.calls[0][1].body
    );
    expect(requestBody.targetPayload.model).toBe('test-model-toolcalling');
    expect(requestBody.llmId).toBe('test-llm-toolcalling');

    // Switch config and test again
    await testBed.switchLLMConfig('test-llm-jsonschema');
    testBed.httpClient.request.mockClear();

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      testBed.createJsonContentResponse({
        chosenIndex: 1,
        speech: 'Test',
        thoughts: 'Test',
      })
    );

    await testBed.getAIDecision(testPrompt);

    // Assert - Different model identifier
    const requestBody2 = JSON.parse(
      testBed.httpClient.request.mock.calls[0][1].body
    );
    expect(requestBody2.targetPayload.model).toBe('test-model-jsonschema');
    expect(requestBody2.llmId).toBe('test-llm-jsonschema');
  });
});
