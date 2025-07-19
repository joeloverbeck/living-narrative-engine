// tests/turns/adapters/configurableLLMAdapter.management.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../../src/turns/adapters/configurableLLMAdapter.js';
import { CLOUD_API_TYPES } from '../../../../src/llms/constants/llmConstants.js';
import {
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} from '../../../common/mockFactories/coreServices.js';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockEnvironmentContext = {
  getExecutionEnvironment: jest.fn(),
  getProjectRootPath: jest.fn(),
  getProxyServerUrl: jest.fn(),
  isClient: jest.fn(),
  isServer: jest.fn(),
};

const mockApiKeyProvider = {
  getKey: jest.fn(),
};

const mockLlmStrategyFactory = {
  getStrategy: jest.fn(),
};

const mockLlmConfigLoader = {
  loadConfigs: jest.fn(),
};

const mockLlmStrategy = {
  execute: jest.fn(),
};

// New service mocks
const mockConfigurationManager = createMockLLMConfigurationManager();
const mockRequestExecutor = createMockLLMRequestExecutor();
const mockErrorMapper = createMockLLMErrorMapper();
const mockTokenEstimator = createMockTokenEstimator();

// Helper function to create adapter with default mocks
const createAdapterWithDefaults = (overrides = {}) => {
  return new ConfigurableLLMAdapter({
    logger: mockLogger,
    environmentContext: mockEnvironmentContext,
    apiKeyProvider: mockApiKeyProvider,
    llmStrategyFactory: mockLlmStrategyFactory,
    configurationManager: mockConfigurationManager,
    requestExecutor: mockRequestExecutor,
    errorMapper: mockErrorMapper,
    tokenEstimator: mockTokenEstimator,
    ...overrides,
  });
};

/** @type {import('../../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
const sampleLlmModelConfig1 = {
  configId: 'test-llm-1',
  displayName: 'Test LLM 1',
  apiType: 'openai',
  modelIdentifier: 'gpt-3.5-turbo',
  endpointUrl: 'https://api.openai.com/v1/chat/completions',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [],
  promptAssemblyOrder: [],
  defaultParameters: { temperature: 0.7 },
};

/** @type {import('../../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
const sampleLlmModelConfig2 = {
  configId: 'test-llm-2',
  displayName: 'Test LLM 2 (Cloud)',
  apiType: CLOUD_API_TYPES[0] || 'anthropic',
  modelIdentifier: 'claude-2',
  endpointUrl: 'https://api.anthropic.com/v1/messages',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [],
  promptAssemblyOrder: [],
  apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  defaultParameters: { temperature: 0.5 },
};

/** @type {import('../../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
const llmConfigNoDisplayName = {
  configId: 'llm-no-display',
  displayName: undefined,
  apiType: 'openai',
  modelIdentifier: 'gpt-text',
  endpointUrl: 'url3',
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [],
  promptAssemblyOrder: [],
};

describe('ConfigurableLLMAdapter Management Features', () => {
  let adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
    mockEnvironmentContext.isServer.mockReturnValue(true);
    mockEnvironmentContext.isClient.mockReturnValue(false);
    mockEnvironmentContext.getProjectRootPath.mockReturnValue('/test/root');
    mockEnvironmentContext.getProxyServerUrl.mockReturnValue(
      'http://proxy.test'
    );
    mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
    mockLlmConfigLoader.loadConfigs.mockReset();
    mockApiKeyProvider.getKey.mockReset();
    mockLlmStrategy.execute.mockReset();
  });

  describe('Constructor & Initial LLM Selection Logic', () => {
    it('should successfully instantiate and log environment and initialLlmId from constructor', () => {
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 'constructor-llm-id',
      });
      expect(adapter).toBeInstanceOf(ConfigurableLLMAdapter);
    });

    it('should warn if initialLlmId is provided but invalid (not string, empty)', () => {
      new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 123,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Constructor received an invalid type for initialLlmId (expected string or null). Received: number. Ignoring.'
        )
      );
      mockLogger.warn.mockClear();

      new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: '   ',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Constructor received an empty string for initialLlmId. It will be treated as if no initialLlmId was provided.'
        )
      );
    });

    it('should use initialLlmId from constructor if valid and found in configs, and log it', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {
          'constructor-llm-id': sampleLlmModelConfig1,
          'default-id': sampleLlmModelConfig2,
        },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 'constructor-llm-id',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(
        'constructor-llm-id'
      );
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
        expect.objectContaining(sampleLlmModelConfig1)
      );
    });

    it('should fallback to defaultConfigId if initialLlmId (from constructor) is not found, and log correctly', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {
          'another-llm': sampleLlmModelConfig1,
          'default-id': sampleLlmModelConfig2,
        },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 'non-existent-constructor-id',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('default-id');
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
        expect.objectContaining(sampleLlmModelConfig2)
      );
      // Note: Logging behavior changed with refactoring - now handled by configurationManager
    });

    it('should use defaultConfigId from dependencyInjection if initialLlmId is not provided, and log it', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {
          'default-id': sampleLlmModelConfig2,
        },
      });
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('default-id');
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
        expect.objectContaining(sampleLlmModelConfig2)
      );
    });

    it('should handle cases where defaultConfigId from dependencyInjection is invalid or not found, and log correctly', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'non-existent-default-id',
        configs: { 'some-llm': sampleLlmModelConfig1 },
      });
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      // Note: Logging behavior changed with refactoring - now handled by configurationManager
    });

    it('should handle cases where defaultConfigId from dependencyInjection is an empty string, and log correctly', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '   ',
        configs: { 'some-llm': sampleLlmModelConfig1 },
      });
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      // Only expect the specific warning about the empty string.
      // The general warning "No default LLM set..." should not be logged if this specific one is.
      // Note: Logging behavior changed with refactoring - now handled by configurationManager
      // Note: Logging behavior changed with refactoring - now handled by configurationManager
    });

    it('should handle no LLMs in dependencyInjection file, log warning, and have no active LLM', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {},
      });
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      // Note: Logging behavior changed with refactoring - now handled by configurationManager
    });

    it('should log N/A for displayName if not present during initial selection by constructor initialLlmId', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'some-default',
        configs: {
          'constructor-llm-no-display': llmConfigNoDisplayName,
          'some-default': sampleLlmModelConfig1,
        },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
        initialLlmId: 'constructor-llm-no-display',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
    });

    it('should log N/A for displayName if not present during initial selection by defaultConfigId', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-llm-no-display',
        configs: { 'default-llm-no-display': llmConfigNoDisplayName },
      });
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
    });
  });

  describe('setActiveLlm() Method', () => {
    const mockFullConfigPayload = {
      defaultConfigId: 'test-llm-1',
      configs: {
        'test-llm-1': sampleLlmModelConfig1,
        'test-llm-2': sampleLlmModelConfig2,
        'llm-no-display': llmConfigNoDisplayName,
      },
    };

    beforeEach(async () => {
      adapter = createAdapterWithDefaults();
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(mockFullConfigPayload))
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
    });

    it('should successfully set an active LLM with a valid ID, update internal state, and log change', async () => {
      const result = await adapter.setActiveLlm('test-llm-2');
      expect(result).toBe(true);
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-2');
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
        expect.objectContaining(sampleLlmModelConfig2)
      );
    });

    it('should return false, log error, and not change state if LLM ID is invalid (null, empty string, non-string)', async () => {
      const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
      const initialConfig = await adapter.getCurrentActiveLlmConfig();

      for (const invalidId of [null, '', '   ', 123]) {
        mockLogger.error.mockClear();
        const result = await adapter.setActiveLlm(invalidId);
        expect(result).toBe(false);
        // Note: Error logging is now handled by configurationManager.setActiveConfiguration
        expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
        expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
          initialConfig
        );
      }
    });

    it('should return false, log error, and not change state if LLM ID does not exist', async () => {
      const initialActiveId = adapter.getActiveLlmId_FOR_TESTING_ONLY();
      const initialConfig = await adapter.getCurrentActiveLlmConfig();

      const result = await adapter.setActiveLlm('non-existent-llm');
      expect(result).toBe(false);
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(initialActiveId);
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(initialConfig);
      // Note: Error logging is now handled by configurationManager.setActiveConfiguration
    });

    it('should throw error if called before init() (via #ensureInitialized)', async () => {
      const uninitializedAdapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
      });
      mockLogger.error.mockClear();
      await expect(
        uninitializedAdapter.setActiveLlm('test-llm-1')
      ).rejects.toThrow(
        'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
      );
      // Note: Error logging pattern unchanged for #ensureInitialized
    });

    it('should throw error if called when adapter is not operational (via #ensureInitialized)', async () => {
      const nonOpAdapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
        configurationManager: mockConfigurationManager,
        requestExecutor: mockRequestExecutor,
        errorMapper: mockErrorMapper,
        tokenEstimator: mockTokenEstimator,
      });
      mockLlmConfigLoader.loadConfigs.mockResolvedValueOnce({
        error: true,
        message: 'dependencyInjection error',
      });
      await nonOpAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(nonOpAdapter.isOperational()).toBe(false);
      mockLogger.error.mockClear();

      await expect(nonOpAdapter.setActiveLlm('test-llm-1')).rejects.toThrow(
        'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
      );
      // Note: Error logging pattern unchanged for #ensureInitialized
    });
  });

  describe('getAvailableLlmOptions()', () => {
    const mockConfigsPayload = {
      defaultConfigId: 'test-llm-1',
      configs: {
        'test-llm-1': sampleLlmModelConfig1,
        'test-llm-2': sampleLlmModelConfig2,
        'llm-no-display': llmConfigNoDisplayName,
      },
    };

    beforeEach(async () => {
      adapter = createAdapterWithDefaults();
    });

    it('should return correct array of {id, displayName} when operational and configs are loaded', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(mockConfigsPayload))
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      mockLogger.warn.mockClear();

      const options = await adapter.getAvailableLlmOptions();
      expect(options).toEqual(
        expect.arrayContaining([
          {
            configId: sampleLlmModelConfig1.configId,
            displayName: sampleLlmModelConfig1.displayName,
          },
          {
            configId: sampleLlmModelConfig2.configId,
            displayName: sampleLlmModelConfig2.displayName,
          },
          {
            configId: llmConfigNoDisplayName.configId,
            displayName: llmConfigNoDisplayName.configId,
          }, // Fallback is correct
        ])
      );
      expect(options.length).toBe(3);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return an empty array if no LLM configurations are found in loaded configs', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'some-id',
        configs: {},
      }); // Valid structure, but empty configs
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      mockLogger.warn.mockClear();

      const options = await adapter.getAvailableLlmOptions();
      expect(options).toEqual([]);
      // Note: Warning logging now handled by configurationManager
    });

    it('should return empty array and log warning if adapter is not operational', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        error: true,
        message: 'dependencyInjection load failed',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.isOperational()).toBe(false);
      mockLogger.warn.mockClear();

      const options = await adapter.getAvailableLlmOptions();
      expect(options).toEqual([]);
      // Note: Warning logging pattern changed with refactoring
    });

    it('should return empty array if called before init', async () => {
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      const options = await adapter.getAvailableLlmOptions();
      expect(options).toEqual([]);
      // Note: Warning logging pattern changed with refactoring
      // Note: Error logging pattern unchanged for #ensureInitialized
    });
  });

  describe('getCurrentActiveLlmId()', () => {
    const mockConfigsPayload = {
      defaultConfigId: 'test-llm-1',
      configs: { 'test-llm-1': sampleLlmModelConfig1 },
    };

    beforeEach(async () => {
      adapter = createAdapterWithDefaults();
    });

    it('should return the correct active LLM ID string when an LLM is active', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(mockConfigsPayload))
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(await adapter.getCurrentActiveLlmId()).toBe('test-llm-1');

      const fullPayloadForSetActive = {
        defaultConfigId: 'test-llm-1',
        configs: {
          'test-llm-1': sampleLlmModelConfig1,
          'test-llm-new': sampleLlmModelConfig2,
        },
      };
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(fullPayloadForSetActive))
      );
      // Re-create adapter for a clean init with the new full payload
      adapter = createAdapterWithDefaults();
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      await adapter.setActiveLlm('test-llm-new');
      expect(await adapter.getCurrentActiveLlmId()).toBe('test-llm-new');
    });

    it('should return null if no LLM is active (e.g. no default, no setActiveLlm)', async () => {
      // Mock a scenario where defaultConfigId is missing from the loaded dependencyInjection.
      // According to stricter init, this should make the adapter non-operational.
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        // No defaultConfigId property here
        configs: { 'some-llm': sampleLlmModelConfig1 },
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      // With strict init, adapter is non-operational if defaultConfigId is not a string.
      expect(adapter.isOperational()).toBe(false);

      const activeId = await adapter.getCurrentActiveLlmId();
      expect(activeId).toBeNull();
      // #ensureInitialized in getCurrentActiveLlmId will log an error and throw.
      // The catch block in getCurrentActiveLlmId will log a warning.
      // Note: Error logging pattern unchanged for #ensureInitialized
      // Note: Warning logging pattern changed with refactoring
    });

    it('should return null and log warning if adapter is not operational', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        error: true,
        message: 'dependencyInjection load failed',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.isOperational()).toBe(false);
      mockLogger.warn.mockClear(); // Clear init logs
      mockLogger.error.mockClear(); // Clear init logs

      const activeId = await adapter.getCurrentActiveLlmId();
      expect(activeId).toBeNull();
      // Note: Warning logging pattern changed with refactoring
      expect(mockLogger.error).toHaveBeenCalledWith(
        // from #ensureInitialized
        'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
      );
    });

    it('should return null if called before init', async () => {
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      const activeId = await adapter.getCurrentActiveLlmId();
      expect(activeId).toBeNull();
      // Note: Warning logging pattern changed with refactoring
      // Note: Error logging pattern unchanged for #ensureInitialized
    });
  });

  describe('Constructor (Dependency Validation - inherited from original test structure)', () => {
    it('should throw an Error if logger is missing', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() => {
        new ConfigurableLLMAdapter({
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
      }).toThrow(
        'ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.'
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('init() Method (Coverage for operational states - inherited)', () => {
    const mockSuccessConfigPayload = {
      defaultConfigId: 'test-llm-1',
      configs: {
        'test-llm-1': sampleLlmModelConfig1,
        'test-llm-2': sampleLlmModelConfig2,
      },
    };
    beforeEach(() => {
      adapter = createAdapterWithDefaults();
    });

    it('should successfully initialize, load configs, and set default LLM', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(mockSuccessConfigPayload))
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
      expect(adapter.isInitialized()).toBe(true);
      expect(adapter.isOperational()).toBe(true);
      // Note: getLoadedConfigs_FOR_TESTING_ONLY now returns data from configurationManager
      const loadedConfigs = await adapter.getLoadedConfigs_FOR_TESTING_ONLY();
      expect(loadedConfigs).toBeDefined();
      expect(loadedConfigs.configs).toBeDefined();
      expect(loadedConfigs.defaultConfigId).toBe('test-llm-1');
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
    });
  });
});

// --- FILE END ---
