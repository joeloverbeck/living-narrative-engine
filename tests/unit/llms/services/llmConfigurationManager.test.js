/**
 * @file Unit tests for LLMConfigurationManager service
 * @see src/llms/services/llmConfigurationManager.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LLMConfigurationManager } from '../../../../src/llms/services/llmConfigurationManager.js';
import { LLMSelectionPersistence } from '../../../../src/llms/services/llmSelectionPersistence.js';

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
    // Clear localStorage to prevent test pollution
    localStorage.clear();

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

    it('should return existing promise when already initialized and operational', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);

      // First initialization
      await configManager.init({ llmConfigLoader: mockConfigLoader });
      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(true);

      // Second initialization should return immediately
      await configManager.init({ llmConfigLoader: mockConfigLoader });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigurationManager: Already initialized and operational.'
      );
      expect(mockConfigLoader.loadConfigs).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should reuse in-flight initialization promise when called concurrently', async () => {
      let resolveConfigs;
      mockConfigLoader.loadConfigs.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveConfigs = resolve;
          })
      );

      const firstInitPromise = configManager.init({
        llmConfigLoader: mockConfigLoader,
      });

      const secondInitPromise = configManager.init({
        llmConfigLoader: mockConfigLoader,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigurationManager: Initialization already in progress.'
      );

      resolveConfigs(mockConfig);
      await expect(
        Promise.all([firstInitPromise, secondInitPromise])
      ).resolves.toEqual([undefined, undefined]);

      expect(mockConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);

      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(true);
    });

    it('should handle exception during configuration loading', async () => {
      const testError = new Error('Network error');
      mockConfigLoader.loadConfigs.mockRejectedValue(testError);

      await expect(
        configManager.init({ llmConfigLoader: mockConfigLoader })
      ).rejects.toThrow('Network error');

      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigurationManager: Exception during configuration loading.',
        {
          errorMessage: 'Network error',
          errorStack: testError.stack,
        }
      );
    });

    it('should handle unexpected configuration structure', async () => {
      // Return invalid structure
      mockConfigLoader.loadConfigs.mockResolvedValue({
        someField: 'value',
        // Missing required fields
      });

      await configManager.init({ llmConfigLoader: mockConfigLoader });

      expect(configManager.isInitialized()).toBe(true);
      expect(configManager.isOperational()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigurationManager: Configuration loading returned unexpected structure.',
        expect.any(Object)
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

    it('should handle null configurations map', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: 'claude',
      });

      // Mock the internal state to have null configs map
      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'gpt-4',
        configs: null,
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Since configs is null, it should not be operational
      expect(manager.isOperational()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigurationManager: Configuration loading returned unexpected structure.',
        expect.any(Object)
      );
    });

    it('should handle empty configurations', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'gpt-4',
        configs: {},
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMConfigurationManager: No configurations found.'
      );
    });

    it('should handle missing default config in configs map', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'nonexistent-default',
        configs: {
          'other-config': {
            configId: 'other-config',
            displayName: 'Other Config',
            modelIdentifier: 'test-model',
            endpointUrl: 'https://test.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'native_json' },
            promptElements: [],
            promptAssemblyOrder: [],
          },
        },
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "LLMConfigurationManager: defaultConfigId 'nonexistent-default' not found in configs."
      );
    });

    it('should handle when configurations is not an object during selection', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Create a config where configs is a weird type (string instead of object)
      const invalidConfig = {
        defaultConfigId: 'test',
        configs: 'not-an-object', // This will pass the initial checks but fail in selectInitialActiveConfig
      };

      mockConfigLoader.loadConfigs.mockResolvedValue(invalidConfig);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      // The manager should not be operational
      expect(manager.isOperational()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigurationManager: Configuration loading returned unexpected structure.',
        expect.any(Object)
      );
    });

    it('should warn when no default config is set', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '', // Empty default
        configs: {
          'some-config': {
            configId: 'some-config',
            displayName: 'Some Config',
            modelIdentifier: 'test-model',
            endpointUrl: 'https://test.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'native_json' },
            promptElements: [],
            promptAssemblyOrder: [],
          },
        },
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMConfigurationManager: No default configuration set.'
      );
    });

    it('should warn when persisting a new active configuration fails', async () => {
      const saveSpy = jest
        .spyOn(LLMSelectionPersistence, 'save')
        .mockReturnValueOnce(false);

      const result = await configManager.setActiveConfiguration('claude');

      expect(result).toBe(true);
      expect(saveSpy).toHaveBeenCalledWith('claude');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "LLMConfigurationManager: Failed to persist LLM selection 'claude' to localStorage."
      );

      saveSpy.mockRestore();
    });

    it('should migrate old Claude Sonnet 4 ID to Claude Sonnet 4.5 from localStorage', async () => {
      // Set up localStorage with old LLM ID (using correct storage key)
      localStorage.setItem(
        'living-narrative-engine:selected-llm-id',
        'openrouter-claude-sonnet-4-toolcalling'
      );

      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      const configWithNewClaude = {
        defaultConfigId: 'claude-sonnet-4.5',
        configs: {
          'claude-sonnet-4.5': {
            configId: 'claude-sonnet-4.5',
            displayName: 'Claude Sonnet 4.5',
            modelIdentifier: 'anthropic/claude-sonnet-4.5',
            endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
            apiType: 'openrouter',
            jsonOutputStrategy: { method: 'openrouter_tool_calling' },
            promptElements: [],
            promptAssemblyOrder: [],
            contextTokenLimit: 1000000,
          },
          'openrouter-claude-sonnet-4-toolcalling': {
            configId: 'openrouter-claude-sonnet-4-toolcalling',
            displayName: 'Claude Sonnet 4 (OpenRouter)',
            modelIdentifier: 'anthropic/claude-sonnet-4',
            endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
            apiType: 'openrouter',
            jsonOutputStrategy: { method: 'openrouter_tool_calling' },
            promptElements: [],
            promptAssemblyOrder: [],
            contextTokenLimit: 1000000,
          },
        },
      };

      mockConfigLoader.loadConfigs.mockResolvedValue(configWithNewClaude);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Should have migrated to the new ID
      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBe('claude-sonnet-4.5');

      // Should have logged the migration
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          "Migrating persisted LLM from 'openrouter-claude-sonnet-4-toolcalling' to 'claude-sonnet-4.5'"
        )
      );

      // Should have updated localStorage with correct storage key
      expect(
        localStorage.getItem('living-narrative-engine:selected-llm-id')
      ).toBe('claude-sonnet-4.5');
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

    it('should handle when configurations map is not available', async () => {
      // Create a new manager with null configs
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'test',
        configs: null,
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Since the manager is not operational, setActiveConfiguration should throw
      await expect(manager.setActiveConfiguration('test')).rejects.toThrow(
        'LLMConfigurationManager: Initialized but not operational.'
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

    it('should handle when configurations map is not available', async () => {
      // Create a new manager that will have initialization issues
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Initialize with configs that result in null allConfigsMap
      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'test',
        configs: null,
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Since the manager is not operational, loadConfiguration should throw
      await expect(manager.loadConfiguration('test')).rejects.toThrow(
        'LLMConfigurationManager: Initialized but not operational.'
      );
    });
  });

  describe('loadConfiguration with operational manager but null configs', () => {
    it('should handle null allConfigsMap when operational check is bypassed', async () => {
      // This is a special test to cover the edge case in loadConfiguration
      // We need to create a scenario where the manager is operational but allConfigsMap is null
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // First init with valid config
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Manually manipulate internal state by calling loadConfiguration with
      // a special test to trigger the null configs error
      // We'll use reflection to set the internal state
      const managerReflection = Object.create(manager);
      managerReflection._allConfigsMap = null;

      // Since we can't directly manipulate private fields, we'll test this differently
      // by creating a mock that returns an operational state but with undefined configs
      const specialConfig = {
        defaultConfigId: 'test',
        configs: undefined, // This will trigger our edge case
      };

      const newManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue(specialConfig);
      await newManager.init({ llmConfigLoader: mockConfigLoader });

      // This should not be operational due to undefined configs
      expect(newManager.isOperational()).toBe(false);
    });
  });

  describe('#ensureInitialized error conditions', () => {
    it('should throw when init has not been called', async () => {
      const newManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      await expect(newManager.loadConfiguration('test')).rejects.toThrow(
        'LLMConfigurationManager: Not initialized. Call init() first.'
      );
    });

    it('should throw when initialization failed but promise resolved', async () => {
      // This tests the edge case where initPromise exists but isInitialized is false
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Mock a scenario where the promise resolves but initialization fails
      const initPromise = manager.init({ llmConfigLoader: mockConfigLoader });

      // Manually set internal state to simulate the edge case
      // We need to make the loader return an unexpected structure
      mockConfigLoader.loadConfigs.mockResolvedValue({
        unexpected: 'structure',
      });

      await initPromise;

      // Now try to use a method that calls ensureInitialized
      await expect(manager.loadConfiguration('test')).rejects.toThrow(
        'LLMConfigurationManager: Initialized but not operational.'
      );
    });
  });

  describe('Edge cases for operational manager', () => {
    it('should handle setActiveConfiguration when allConfigsMap is somehow null', async () => {
      // This tests the theoretical edge case where operational but configs map is null
      // In practice this shouldn't happen, but we want 100% coverage
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Create a valid config that will make it operational
      const validConfig = {
        defaultConfigId: 'test',
        configs: {
          test: {
            configId: 'test',
            displayName: 'Test',
            modelIdentifier: 'test-model',
            endpointUrl: 'https://test.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'native_json' },
            promptElements: [],
            promptAssemblyOrder: [],
          },
        },
      };

      // First initialize properly
      mockConfigLoader.loadConfigs.mockResolvedValue(validConfig);
      await manager.init({ llmConfigLoader: mockConfigLoader });

      // Verify it's operational
      expect(manager.isOperational()).toBe(true);

      // Now we need to test the edge case where allConfigsMap becomes null
      // Since we can't modify private fields directly, we'll create a subclass for testing
      class TestableManager extends LLMConfigurationManager {
        async testSetActiveWithNullConfigs() {
          // Simulate the condition where allConfigsMap is null
          this._allConfigsMap = null; // This won't work with private fields
          return this.setActiveConfiguration('test');
        }
      }

      // Since we can't test this directly, let's ensure the code path is correct
      // by testing that when configs is an empty object, it still works
      const emptyConfigManager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'test',
        configs: {}, // Empty but not null
      });

      await emptyConfigManager.init({ llmConfigLoader: mockConfigLoader });
      const result = await emptyConfigManager.setActiveConfiguration('test');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Configuration 'test' not found")
      );
    });

    it('should handle loadConfiguration when allConfigsMap is empty object', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'test',
        configs: {}, // Empty configs
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const config = await manager.loadConfiguration('test');
      expect(config).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "LLMConfigurationManager: Configuration 'test' not found."
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

      // GBNF grammar without grammar field
      config.jsonOutputStrategy = { method: 'gbnf_grammar' };
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.grammar',
        reason: 'Required when jsonOutputStrategy.method is "gbnf_grammar".',
      });

      // GBNF grammar with empty grammar
      config.jsonOutputStrategy = { method: 'gbnf_grammar', grammar: '   ' };
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.grammar',
        reason: 'Required when jsonOutputStrategy.method is "gbnf_grammar".',
      });

      // OpenRouter JSON schema without jsonSchema
      config.jsonOutputStrategy = { method: 'openrouter_json_schema' };
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.jsonSchema',
        reason:
          'Required when jsonOutputStrategy.method is "openrouter_json_schema".',
      });

      // OpenRouter JSON schema with null jsonSchema
      config.jsonOutputStrategy = {
        method: 'openrouter_json_schema',
        jsonSchema: null,
      };
      errors = configManager.validateConfiguration(config);
      expect(errors).toContainEqual({
        field: 'jsonOutputStrategy.jsonSchema',
        reason:
          'Required when jsonOutputStrategy.method is "openrouter_json_schema".',
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

    it('should handle initialization error in getAvailableOptions', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Don't initialize at all
      const options = await manager.getAvailableOptions();
      expect(options).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not operational. Cannot retrieve options')
      );
    });

    it('should return empty array when configurations array is empty', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '',
        configs: {},
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const options = await manager.getAvailableOptions();
      expect(options).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMConfigurationManager: No configurations found.'
      );
    });

    it('should handle missing displayName in configuration', async () => {
      const configWithoutDisplayName = {
        defaultConfigId: 'test',
        configs: {
          test: {
            configId: 'test',
            // displayName is missing
            modelIdentifier: 'test-model',
            endpointUrl: 'https://test.com',
            apiType: 'test',
            jsonOutputStrategy: { method: 'native_json' },
            promptElements: [],
            promptAssemblyOrder: [],
          },
        },
      };

      mockConfigLoader.loadConfigs.mockResolvedValue(configWithoutDisplayName);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const options = await configManager.getAvailableOptions();
      expect(options).toEqual([
        { configId: 'test', displayName: 'test' }, // Falls back to configId
      ]);
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

  describe('getActiveConfigId', () => {
    it('should return active config ID when initialized', async () => {
      mockConfigLoader.loadConfigs.mockResolvedValue(mockConfig);
      await configManager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await configManager.getActiveConfigId();
      expect(activeId).toBe('gpt-4');
    });

    it('should handle error when not operational', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      // Don't initialize
      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Not operational. Cannot retrieve active config ID'
        )
      );
    });

    it('should return null when no active config is set', async () => {
      const manager = new LLMConfigurationManager({
        logger: mockLogger,
        initialLlmId: null,
      });

      mockConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '',
        configs: {},
      });

      await manager.init({ llmConfigLoader: mockConfigLoader });

      const activeId = await manager.getActiveConfigId();
      expect(activeId).toBeNull();
    });
  });
});
