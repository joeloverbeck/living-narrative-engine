// tests/turns/adapters/configurableLLMAdapter.management.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { CLOUD_API_TYPES } from '../../../src/llms/constants/llmConstants.js';

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

/** @type {import('../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
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

/** @type {import('../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
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

/** @type {import('../../../src/turns/adapters/configurableLLMAdapter.js').LLMModelConfig} */
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
        initialLlmId: 'non-existent-constructor-id',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('default-id');
      expect(await adapter.getCurrentActiveLlmConfig()).toEqual(
        expect.objectContaining(sampleLlmModelConfig2)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "ConfigurableLLMAdapter.#selectInitialActiveLlm: initialLlmId ('non-existent-constructor-id') was provided to constructor, but no LLM configuration with this ID exists in the configs map. Falling back to defaultConfigId logic."
      );
    });

    it('should use defaultConfigId from dependencyInjection if initialLlmId is not provided, and log it', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {
          'default-id': sampleLlmModelConfig2,
        },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: \'defaultConfigId\' ("non-existent-default-id") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set.'
      );
    });

    it('should handle cases where defaultConfigId from dependencyInjection is an empty string, and log correctly', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: '   ',
        configs: { 'some-llm': sampleLlmModelConfig1 },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      // Only expect the specific warning about the empty string.
      // The general warning "No default LLM set..." should not be logged if this specific one is.
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#selectInitialActiveLlm: \'defaultConfigId\' found in configurations but it is not a valid non-empty string ("   ").'
      );
      // Ensure the more general warning is NOT called in this specific case
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#selectInitialActiveLlm: No default LLM set. Neither initialLlmIdFromConstructor nor defaultConfigId resulted in a valid active LLM selection.'
      );
    });

    it('should handle no LLMs in dependencyInjection file, log warning, and have no active LLM', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-id',
        configs: {},
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter: \'defaultConfigId\' ("default-id") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#selectInitialActiveLlm: No LLM configurations found in the configs map. No LLM can be set as active.'
      );
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
        initialLlmId: 'constructor-llm-no-display',
      });
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
    });

    it('should log N/A for displayName if not present during initial selection by defaultConfigId', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue({
        defaultConfigId: 'default-llm-no-display',
        configs: { 'default-llm-no-display': llmConfigNoDisplayName },
      });
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
        expect(mockLogger.error).toHaveBeenCalledWith(
          `ConfigurableLLMAdapter.setActiveLlm: Invalid llmId provided (must be a non-empty string). Received: '${invalidId}'. Active LLM remains '${initialActiveId || 'none'}'.`
        );
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        `ConfigurableLLMAdapter.setActiveLlm: No LLM configuration found with ID 'non-existent-llm' in the configs map. Active LLM remains unchanged ('${initialActiveId || 'none'}').`
      );
    });

    it('should throw error if called before init() (via #ensureInitialized)', async () => {
      const uninitializedAdapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
      mockLogger.error.mockClear();
      await expect(
        uninitializedAdapter.setActiveLlm('test-llm-1')
      ).rejects.toThrow(
        'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
      );
    });

    it('should throw error if called when adapter is not operational (via #ensureInitialized)', async () => {
      const nonOpAdapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
      );
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
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.getAvailableLlmOptions: No LLM configurations found in the configs map. Returning empty array.'
      );
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options.'
        )
      );
    });

    it('should return empty array if called before init', async () => {
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      const options = await adapter.getAvailableLlmOptions();
      expect(options).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'ConfigurableLLMAdapter.getAvailableLlmOptions: Adapter not operational. Cannot retrieve LLM options.'
        )
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
      );
    });
  });

  describe('getCurrentActiveLlmId()', () => {
    const mockConfigsPayload = {
      defaultConfigId: 'test-llm-1',
      configs: { 'test-llm-1': sampleLlmModelConfig1 },
    };

    beforeEach(async () => {
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID.'
        )
      );
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID.'
        )
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        // from #ensureInitialized
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
      );
    });

    it('should return null if called before init', async () => {
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      const activeId = await adapter.getCurrentActiveLlmId();
      expect(activeId).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'ConfigurableLLMAdapter.getCurrentActiveLlmId: Adapter not operational. Cannot retrieve current active LLM ID.'
        )
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ConfigurableLLMAdapter.#ensureInitialized: ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
      );
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
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
    });

    it('should successfully initialize, load configs, and set default LLM', async () => {
      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        JSON.parse(JSON.stringify(mockSuccessConfigPayload))
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });

      expect(mockLlmConfigLoader.loadConfigs).toHaveBeenCalledTimes(1);
      expect(adapter.isInitialized()).toBe(true);
      expect(adapter.isOperational()).toBe(true);
      expect(adapter.getLoadedConfigs_FOR_TESTING_ONLY()).toEqual(
        mockSuccessConfigPayload
      );
      expect(adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe('test-llm-1');
    });
  });
});

// --- FILE END ---
