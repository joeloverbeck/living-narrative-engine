// tests/unit/services/llmConfigLoader.periods.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';

describe('LlmConfigLoader - Period in Config ID Support', () => {
  let loader;
  let mockLogger;
  let mockSchemaValidator;
  let mockConfiguration;
  let mockSafeEventDispatcher;
  let mockDataFetcher;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock schema validator that accepts periods in config IDs
    mockSchemaValidator = {
      validate: jest.fn(),
    };

    // Create mock configuration
    mockConfiguration = {
      getContentTypeSchemaId: jest
        .fn()
        .mockReturnValue(
          'schema://living-narrative-engine/llm-configs.schema.json'
        ),
    };

    // Create mock event dispatcher
    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Create mock data fetcher
    mockDataFetcher = {
      fetch: jest.fn(),
    };

    // Create LlmConfigLoader instance
    loader = new LlmConfigLoader({
      logger: mockLogger,
      schemaValidator: mockSchemaValidator,
      configuration: mockConfiguration,
      safeEventDispatcher: mockSafeEventDispatcher,
      dataFetcher: mockDataFetcher,
    });
  });

  describe('Config IDs with periods', () => {
    it('should successfully load and validate config with ID containing periods like "claude-sonnet-4.5"', async () => {
      // Arrange - config with periods in ID
      const mockConfigWithPeriods = {
        defaultConfigId: 'claude-sonnet-4.5',
        configs: {
          'claude-sonnet-4.5': {
            configId: 'claude-sonnet-4.5',
            displayName: 'Claude Sonnet 4.5 (OpenRouter - Tool Calling)',
            apiKeyEnvVar: 'OPENROUTER_API_KEY_ENV_VAR',
            apiKeyFileName: 'openrouter_api_key.txt',
            endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
            modelIdentifier: 'anthropic/claude-sonnet-4.5',
            apiType: 'openrouter',
            jsonOutputStrategy: {
              method: 'openrouter_tool_calling',
              toolName: 'function_call',
            },
            defaultParameters: {
              temperature: 1.0,
            },
            providerSpecificHeaders: {
              'HTTP-Referer': 'https://my-text-adventure-game.com',
              'X-Title': 'Living Narrative Engine',
            },
            contextTokenLimit: 1000000,
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockConfigWithPeriods);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await loader.loadConfigs('config/llm-configs.json');

      // Assert
      expect(result).toEqual(mockConfigWithPeriods);
      expect(result.defaultConfigId).toBe('claude-sonnet-4.5');
      expect(result.configs['claude-sonnet-4.5']).toBeDefined();
      expect(result.configs['claude-sonnet-4.5'].configId).toBe(
        'claude-sonnet-4.5'
      );
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/llm-configs.schema.json',
        mockConfigWithPeriods
      );
    });

    it('should handle multiple configs with periods in their IDs', async () => {
      // Arrange - multiple configs with periods
      const mockMultipleConfigs = {
        defaultConfigId: 'gpt-3.5-turbo',
        configs: {
          'gpt-3.5-turbo': {
            configId: 'gpt-3.5-turbo',
            displayName: 'GPT 3.5 Turbo',
            apiKeyEnvVar: 'OPENAI_API_KEY',
            apiKeyFileName: 'openai_api_key.txt',
            endpointUrl: 'https://api.openai.com/v1/chat/completions',
            modelIdentifier: 'gpt-3.5-turbo',
            apiType: 'openai',
            jsonOutputStrategy: {
              method: 'tool_calling',
              toolName: 'function',
            },
          },
          'claude-3.5-sonnet': {
            configId: 'claude-3.5-sonnet',
            displayName: 'Claude 3.5 Sonnet',
            apiKeyEnvVar: 'ANTHROPIC_API_KEY',
            apiKeyFileName: 'anthropic_api_key.txt',
            endpointUrl: 'https://api.anthropic.com/v1/messages',
            modelIdentifier: 'claude-3.5-sonnet-20241022',
            apiType: 'anthropic',
            jsonOutputStrategy: {
              method: 'tool_calling',
              toolName: 'function',
            },
          },
          'deepseek-v3.1': {
            configId: 'deepseek-v3.1',
            displayName: 'DeepSeek v3.1',
            apiKeyEnvVar: 'DEEPSEEK_API_KEY',
            apiKeyFileName: 'deepseek_api_key.txt',
            endpointUrl: 'https://api.deepseek.com/v1/chat/completions',
            modelIdentifier: 'deepseek-chat-v3.1',
            apiType: 'openrouter',
            jsonOutputStrategy: {
              method: 'openrouter_tool_calling',
              toolName: 'function_call',
            },
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockMultipleConfigs);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await loader.loadConfigs('config/llm-configs.json');

      // Assert
      expect(result).toEqual(mockMultipleConfigs);
      expect(result.configs['gpt-3.5-turbo']).toBeDefined();
      expect(result.configs['claude-3.5-sonnet']).toBeDefined();
      expect(result.configs['deepseek-v3.1']).toBeDefined();
    });

    it('should validate that config key matches configId even with periods', async () => {
      // Arrange - config where key and configId both have periods
      const mockConfig = {
        defaultConfigId: 'model-v1.2.3',
        configs: {
          'model-v1.2.3': {
            configId: 'model-v1.2.3',
            displayName: 'Model Version 1.2.3',
            apiKeyEnvVar: 'API_KEY',
            apiKeyFileName: 'api_key.txt',
            endpointUrl: 'https://api.example.com/v1/chat',
            modelIdentifier: 'model-v1.2.3',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'manual_prompting',
            },
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockConfig);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await loader.loadConfigs('config/llm-configs.json');

      // Assert
      expect(result).toEqual(mockConfig);
      expect(result.configs['model-v1.2.3'].configId).toBe('model-v1.2.3');
    });

    it('should handle defaultConfigId with periods correctly', async () => {
      // Arrange
      const mockConfig = {
        defaultConfigId: 'llm-2.0.1-beta',
        configs: {
          'llm-2.0.1-beta': {
            configId: 'llm-2.0.1-beta',
            displayName: 'LLM 2.0.1 Beta',
            apiKeyEnvVar: 'LLM_API_KEY',
            apiKeyFileName: 'llm_api_key.txt',
            endpointUrl: 'https://api.llm.com/v1/chat',
            modelIdentifier: 'llm-2.0.1-beta',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'native_json_mode',
            },
          },
          'llm-1.0.0': {
            configId: 'llm-1.0.0',
            displayName: 'LLM 1.0.0',
            apiKeyEnvVar: 'LLM_API_KEY',
            apiKeyFileName: 'llm_api_key.txt',
            endpointUrl: 'https://api.llm.com/v1/chat',
            modelIdentifier: 'llm-1.0.0',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'native_json_mode',
            },
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockConfig);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await loader.loadConfigs();

      // Assert
      expect(result.defaultConfigId).toBe('llm-2.0.1-beta');
      expect(result.configs[result.defaultConfigId]).toBeDefined();
    });

    it('should not reject config IDs with multiple periods', async () => {
      // Arrange - config with multiple periods
      const mockConfig = {
        defaultConfigId: 'api.v2.3.4.stable',
        configs: {
          'api.v2.3.4.stable': {
            configId: 'api.v2.3.4.stable',
            displayName: 'API v2.3.4 Stable',
            apiKeyEnvVar: 'API_KEY',
            apiKeyFileName: 'api_key.txt',
            endpointUrl: 'https://api.example.com/v2',
            modelIdentifier: 'api.v2.3.4.stable',
            apiType: 'custom',
            jsonOutputStrategy: {
              method: 'manual_prompting',
            },
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockConfig);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      const result = await loader.loadConfigs();

      // Assert
      expect(result.configs['api.v2.3.4.stable']).toBeDefined();
      expect(result.configs['api.v2.3.4.stable'].configId).toBe(
        'api.v2.3.4.stable'
      );
    });
  });

  describe('Schema validation behavior with periods', () => {
    it('should pass schema validation for config IDs with periods', async () => {
      // Arrange
      const mockConfig = {
        defaultConfigId: 'test.config.1.0',
        configs: {
          'test.config.1.0': {
            configId: 'test.config.1.0',
            displayName: 'Test Config 1.0',
            apiKeyEnvVar: 'TEST_KEY',
            apiKeyFileName: 'test_key.txt',
            endpointUrl: 'https://test.api.com/v1',
            modelIdentifier: 'test-model-1.0',
            apiType: 'test',
            jsonOutputStrategy: {
              method: 'manual_prompting',
            },
          },
        },
      };

      mockDataFetcher.fetch.mockResolvedValue(mockConfig);
      mockSchemaValidator.validate.mockReturnValue({ isValid: true });

      // Act
      await loader.loadConfigs();

      // Assert - verify schema validator was called with the config containing periods
      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          defaultConfigId: 'test.config.1.0',
          configs: expect.objectContaining({
            'test.config.1.0': expect.any(Object),
          }),
        })
      );
    });
  });
});
