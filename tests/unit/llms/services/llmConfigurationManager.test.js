/**
 * @file Unit tests for LLMConfigurationManager service
 * @see src/llms/services/llmConfigurationManager.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LLMConfigurationManager } from '../../../../src/llms/services/llmConfigurationManager.js';

describe('LLMConfigurationManager', () => {
  let configManager;
  let mockLogger;
  let mockConfigLoader;

  const mockConfig = {
    defaultConfigId: 'gpt-4',
    configs: {
      'gpt-4': {
        configId: 'gpt-4',
        displayName: 'GPT-4',
        modelIdentifier: 'gpt-4',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
        jsonOutputStrategy: { method: 'native_json' },
        promptElements: [],
        promptAssemblyOrder: [],
        contextTokenLimit: 8192,
      },
      claude: {
        configId: 'claude',
        displayName: 'Claude 3',
        modelIdentifier: 'claude-3-opus',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        apiType: 'anthropic',
        jsonOutputStrategy: { method: 'native_json' },
        promptElements: [],
        promptAssemblyOrder: [],
        contextTokenLimit: 200000,
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfigLoader = {
      loadConfigs: jest.fn(),
    };

    configManager = new LLMConfigurationManager({
      logger: mockLogger,
      initialLlmId: null,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(configManager).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Instance created')
      );
    });

    it('should handle initial LLM ID', () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: 'claude',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Initial LLM ID: 'claude'")
      );
    });

    it('should handle invalid initial LLM ID types', () => {
      new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: 123,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid initialLlmId type')
      );
    });

    it('should handle empty initial LLM ID', () => {
      new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: '   ',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Empty string for initialLlmId')
      );
    });

    it('should throw error with invalid logger', () => {
      expect(() => new LLMConfigurationManager({ logger: null })).toThrow(
        'ILogger'
      );
    });
  });

  describe('init', () => {
    it('should initialize successfully with valid config', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);

      await configManager.init({ llmConfigLoader: mockConfigLoader });

      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Initialization complete and operational')
      );
    });

    it('should handle config loading errors', async () => {
      const errorResult = {
        error: true,
        message: 'Failed to load',
        stage: 'loading',
        path: '/config/llm.json',
      };
      mockConfigLoader.loadConfigs.mockResolvedValue(errorResult);

      await configManager.init({ llmConfigLoader: mockConfigLoader });

      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Critical error loading configurations'),
        expect.any(Object)
      );
    });

    it('should prevent re-initialization after failure', async () => {
      const errorResult = { error: true };
      mockConfigLoader.loadConfigs.mockResolvedValue(errorResult);

      await configManager.init({ llmConfigLoader: mockConfigLoader });

      await expect(
        configManager.init({ llmConfigLoader: mockConfigLoader })
      ).rejects.toThrow(
        'Cannot re-initialize after critical configuration loading failure'
      );
    });

    it('should handle multiple concurrent init calls', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);

      const init1 = configManager.init({ llmConfigLoader: mockConfigLoader });
      const init2 = configManager.init({ llmConfigLoader: mockConfigLoader });

      await Promise.all([init1, init2]);

      expect(mockConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Initialization already in progress')
      );
    });

    it('should validate config loader', async () => {
      await expect(
        configManager.init({ llmConfigLoader: null })
      ).rejects.toThrow(
        'Initialization requires valid LlmConfigLoader instance'
      );

      const newManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });
      await expect(newManager.init({ llmConfigLoader: {} })).rejects.toThrow(
        'Initialization requires valid LlmConfigLoader instance'
      );
    });
  });

  describe('config selection', () => {
    beforeEach(async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });
    });

    it('should select default config on init', async () => {
      const activeId = await configManager.getActiveConfigId();
      expect(activeId).toBe('gpt-4');
    });

    it('should prioritize initialLlmId over default', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: 'claude',
      });
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBe('claude');
    });

    it('should fall back to default if initialLlmId not found', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: 'nonexistent',
      });
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBe('gpt-4');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("initialLlmId 'nonexistent' not found")
      );
    });
  });

  describe('getActiveConfiguration', () => {
    it('should return active configuration', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const config = await configManager.getActiveConfiguration();
      expect(config).toEqual(mockConfig.configs['gpt-4']);
    });

    it('should return null when no active config', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '',
        configs: {
          'test-config': {
            configId: 'test-config',
            displayName: 'Test Config',
            modelIdentifier: 'test-model',
            endpointUrl: 'https://test.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'native_json' },
            promptElements: [],
            promptAssemblyOrder: [],
          },
        },
      });
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const config = await configManager.getActiveConfiguration();
      expect(config).toBeNull();
    });

    it('should throw when not initialized', async () => {
      await expect(configManager.getActiveConfiguration()).rejects.toThrow(
        'Not initialized'
      );
    });
  });

  describe('setActiveConfiguration', () => {
    beforeEach(async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });
    });

    it('should set active configuration successfully', async () => {
      const result = await configManager.setActiveConfiguration('claude');
      expect(result).toBe(true);

      const activeId = await configManager.getActiveConfigId();
      expect(activeId).toBe('claude');
    });

    it('should reject invalid config IDs', async () => {
      const result = await configManager.setActiveConfiguration('nonexistent');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Configuration 'nonexistent' not found")
      );
    });

    it('should reject empty config IDs', async () => {
      const result = await configManager.setActiveConfiguration('');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid configId')
      );
    });
  });

  describe('loadConfiguration', () => {
    beforeEach(async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });
    });

    it('should load existing configuration', async () => {
      const config = await configManager.loadConfiguration('claude');
      expect(config).toEqual(mockConfig.configs['claude']);
    });

    it('should return null for non-existent config', async () => {
      const config = await configManager.loadConfiguration('nonexistent');
      expect(config).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Configuration 'nonexistent' not found")
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', () => {
      const errors = configManager.validateConfiguration(
        mockConfig.configs['gpt-4']
      );
      expect(errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const invalidConfig = {
        configId: '',
        endpointUrl: null,
        modelIdentifier: '   ',
        apiType: undefined,
      };

      const errors = configManager.validateConfiguration(invalidConfig);
      expect(errors).toContainEqual({
        field: 'configId',
        reason: 'Missing or invalid',
      });
      expect(errors).toContainEqual({
        field: 'endpointUrl',
        reason: 'Missing or invalid',
      });
      expect(errors).toContainEqual({
        field: 'modelIdentifier',
        reason: 'Missing or invalid',
      });
      expect(errors).toContainEqual({
        field: 'apiType',
        reason: 'Missing or invalid',
      });
    });

    it('should validate jsonOutputStrategy', () => {
      const config = { ...mockConfig.configs['gpt-4'] };

      // Missing strategy
      config.jsonOutputStrategy = null;
      let errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy',
        reason: 'Is required and must be an object.',
      });

      // Missing method
      config.jsonOutputStrategy = {};
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.method',
        reason: 'Is required and must be a non-empty string.',
      });

      // Tool calling without toolName
      config.jsonOutputStrategy = { method: 'tool_calling' };
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.toolName',
        reason: 'Required when jsonOutputStrategy.method is "tool_calling".',
      });
    });
  });

  describe('getAvailableOptions', () => {
    it('should return available LLM options', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const options = await configManager.getAvailableOptions();
      expect(options).toEqual([
        { configId: 'gpt-4', displayName: 'GPT-4' },
        { configId: 'claude', displayName: 'Claude 3' },
      ]);
    });

    it('should return empty array when not operational', async () => {
      const options = await configManager.getAvailableOptions();
      expect(options).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not operational')
      );
    });
  });

  describe('getAllConfigurations', () => {
    it('should return all configurations', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const allConfigs = await configManager.getAllConfigurations();
      expect(allConfigs).toEqual(mockConfig);
    });

    it('should return null when not initialized', async () => {
      const newManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      await expect(newManager.getAllConfigurations()).rejects.toThrow(
        'Not initialized'
      );
    });
  });
});
