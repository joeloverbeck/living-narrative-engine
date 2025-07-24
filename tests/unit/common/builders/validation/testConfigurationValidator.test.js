/**
 * @file testConfigurationValidator.test.js
 * @description Unit tests for TestConfigurationValidator
 */

import { describe, it, expect } from '@jest/globals';
import { TestConfigurationValidator } from '../../../../common/builders/validation/testConfigurationValidator.js';

describe('TestConfigurationValidator', () => {
  describe('validateLLMConfig', () => {
    it('should validate a complete LLM configuration', () => {
      const validConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(validConfig)
      ).not.toThrow();
      expect(TestConfigurationValidator.validateLLMConfig(validConfig)).toBe(
        true
      );
    });

    it('should throw error for missing required fields', () => {
      const incompleteConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        // Missing apiKeyEnvVar, endpointUrl, modelIdentifier
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(incompleteConfig)
      ).toThrow(
        'Missing required LLM config fields: apiKeyEnvVar, endpointUrl, modelIdentifier'
      );
    });

    it('should validate field types', () => {
      const invalidTypeConfig = {
        configId: 123, // Should be string
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidTypeConfig)
      ).toThrow('LLM config configId must be a string');
    });

    it('should validate URL format', () => {
      const invalidUrlConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'not-a-valid-url',
        modelIdentifier: 'test-model',
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidUrlConfig)
      ).toThrow('LLM config endpointUrl is not a valid URL: not-a-valid-url');
    });

    it('should validate context token limit if present', () => {
      const validConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        contextTokenLimit: 8000,
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(validConfig)
      ).not.toThrow();

      const invalidTokenLimit = {
        ...validConfig,
        contextTokenLimit: -100,
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidTokenLimit)
      ).toThrow('LLM config contextTokenLimit must be a positive number');
    });

    it('should validate JSON output strategy', () => {
      const toolCallingConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        jsonOutputStrategy: {
          method: 'openrouter_tool_calling',
          toolName: 'function_call',
        },
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(toolCallingConfig)
      ).not.toThrow();

      // Missing toolName
      const invalidToolCalling = {
        ...toolCallingConfig,
        jsonOutputStrategy: {
          method: 'openrouter_tool_calling',
        },
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidToolCalling)
      ).toThrow('openrouter_tool_calling strategy requires a toolName');

      // Invalid method
      const invalidMethod = {
        ...toolCallingConfig,
        jsonOutputStrategy: {
          method: 'invalid_method',
        },
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidMethod)
      ).toThrow(/Invalid JSON output strategy method: invalid_method/);
    });

    it('should validate prompt elements', () => {
      const validConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        promptElements: [
          { key: 'intro', prefix: 'Hello: ', suffix: '\n' },
          { key: 'content' },
        ],
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(validConfig)
      ).not.toThrow();

      // Invalid prompt elements
      const invalidElements = {
        ...validConfig,
        promptElements: [{ prefix: 'Missing key' }],
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidElements)
      ).toThrow('Prompt element at index 0 missing key');
    });

    it('should validate prompt assembly order', () => {
      const validConfig = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        promptElements: [{ key: 'intro' }, { key: 'content' }],
        promptAssemblyOrder: ['intro', 'content'],
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(validConfig)
      ).not.toThrow();

      // Invalid order key
      const invalidOrder = {
        ...validConfig,
        promptAssemblyOrder: ['intro', 'invalid_key'],
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(invalidOrder)
      ).toThrow(/Invalid key in prompt assembly order: invalid_key/);
    });
  });

  describe('validateTestEnvironment', () => {
    it('should validate turn-execution environment', () => {
      const validEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ id: 'actor1' }],
        world: { name: 'Test World' },
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          validEnv,
          'turn-execution'
        )
      ).not.toThrow();
    });

    it('should validate action-processing environment', () => {
      const validEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ id: 'actor1' }],
        actions: ['move', 'look'],
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          validEnv,
          'action-processing'
        )
      ).not.toThrow();
    });

    it('should validate prompt-generation environment', () => {
      const validEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ id: 'actor1' }],
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          validEnv,
          'prompt-generation'
        )
      ).not.toThrow();
    });

    it('should throw error for unknown environment type', () => {
      expect(() =>
        TestConfigurationValidator.validateTestEnvironment({}, 'invalid-type')
      ).toThrow('Unknown environment type: invalid-type');
    });

    it('should throw error for missing required fields', () => {
      const incompleteEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        // Missing actors, world, mocks
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          incompleteEnv,
          'turn-execution'
        )
      ).toThrow(
        'Missing required environment fields for turn-execution: actors, world, mocks'
      );
    });

    it('should validate actors array', () => {
      const invalidActorsEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: 'not-an-array',
        world: { name: 'Test World' },
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          invalidActorsEnv,
          'turn-execution'
        )
      ).toThrow('Environment actors must be an array');
    });

    it('should validate individual actors', () => {
      const invalidActorEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ name: 'Missing ID' }],
        world: { name: 'Test World' },
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          invalidActorEnv,
          'turn-execution'
        )
      ).toThrow('Actor at index 0 missing id');
    });

    it('should validate world configuration', () => {
      const invalidWorldEnv = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ id: 'actor1' }],
        world: {}, // Missing both id and name
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          invalidWorldEnv,
          'turn-execution'
        )
      ).toThrow('World must have either an id or name');
    });
  });

  describe('validateMockConfiguration', () => {
    it('should validate llm-adapter mock', () => {
      const validMock = {
        responses: { function_call: {} },
        apiKey: 'test-key',
      };

      expect(
        TestConfigurationValidator.validateMockConfiguration(
          validMock,
          'llm-adapter'
        )
      ).toBe(true);

      const invalidMock = {
        apiKey: 'test-key',
        // Missing responses
      };

      expect(() =>
        TestConfigurationValidator.validateMockConfiguration(
          invalidMock,
          'llm-adapter'
        )
      ).toThrow('LLM adapter mock must have responses');
    });

    it('should validate event-bus mock', () => {
      const validMock = {
        captureAll: false,
        eventTypes: ['EVENT1', 'EVENT2'],
      };

      expect(
        TestConfigurationValidator.validateMockConfiguration(
          validMock,
          'event-bus'
        )
      ).toBe(true);

      const invalidMock = {
        captureAll: 'not-boolean',
      };

      expect(() =>
        TestConfigurationValidator.validateMockConfiguration(
          invalidMock,
          'event-bus'
        )
      ).toThrow('Event bus mock captureAll must be a boolean');
    });

    it('should validate entity-manager mock', () => {
      const validMock = {
        entities: [{ id: 'entity1' }, { id: 'entity2' }],
      };

      expect(
        TestConfigurationValidator.validateMockConfiguration(
          validMock,
          'entity-manager'
        )
      ).toBe(true);

      const invalidMock = {
        entities: 'not-an-array',
      };

      expect(() =>
        TestConfigurationValidator.validateMockConfiguration(
          invalidMock,
          'entity-manager'
        )
      ).toThrow('Entity manager mock must have entities array');
    });

    it('should throw error for unknown mock type', () => {
      expect(() =>
        TestConfigurationValidator.validateMockConfiguration({}, 'unknown-type')
      ).toThrow('Unknown mock type: unknown-type');
    });

    it('should throw error for invalid mock configuration object', () => {
      expect(() =>
        TestConfigurationValidator.validateMockConfiguration(
          null,
          'llm-adapter'
        )
      ).toThrow('Mock configuration must be an object');
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays in configuration', () => {
      const config = {
        configId: 'test-llm',
        displayName: 'Test LLM',
        apiKeyEnvVar: 'TEST_KEY',
        endpointUrl: 'https://api.test.com/v1/chat',
        modelIdentifier: 'test-model',
        promptElements: [],
        promptAssemblyOrder: [],
      };

      expect(() =>
        TestConfigurationValidator.validateLLMConfig(config)
      ).not.toThrow();
    });

    it('should validate complex nested actor components', () => {
      const env = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [
          {
            id: 'complex-actor',
            name: 'Complex Actor',
            type: 'core:actor',
            components: {
              position: { x: 0, y: 0 },
              inventory: { items: [] },
            },
          },
        ],
        world: { name: 'Test World' },
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          env,
          'turn-execution'
        )
      ).not.toThrow();
    });

    it('should validate world with locations array', () => {
      const env = {
        llm: {
          configId: 'test-llm',
          displayName: 'Test LLM',
          apiKeyEnvVar: 'TEST_KEY',
          endpointUrl: 'https://api.test.com/v1/chat',
          modelIdentifier: 'test-model',
        },
        actors: [{ id: 'actor1' }],
        world: {
          id: 'world1',
          name: 'Test World',
          description: 'A test world',
          locations: ['loc1', 'loc2', 'loc3'],
        },
        mocks: {},
      };

      expect(() =>
        TestConfigurationValidator.validateTestEnvironment(
          env,
          'turn-execution'
        )
      ).not.toThrow();
    });
  });
});
