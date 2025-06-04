// src/services/LLMConfigService.test.js
// --- FILE START ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { LLMConfigService } from '../../src/services/llmConfigService.js'; // Adjust path as needed
import { createMockLogger } from '../testUtils.js'; // Adjust path as needed

// Mock IConfigurationProvider
const mockConfigurationProvider = {
  fetchData: jest.fn(),
};

// Sample valid LLMConfig objects for testing
const sampleConfig1 = {
  configId: 'cfg_model_a_v1',
  modelIdentifier: 'provider/model-a-v1',
  promptElements: [{ key: 'system_prompt', content: 'system' }],
  promptAssemblyOrder: ['system_prompt'],
  displayName: 'Model A v1 Config',
};
const sampleConfig2 = {
  configId: 'cfg_model_b_v1',
  modelIdentifier: 'provider/model-b-v1',
  promptElements: [{ key: 'user_query', content: 'user' }],
  promptAssemblyOrder: ['user_query'],
};
const sampleWildcardConfig = {
  configId: 'cfg_provider_wildcard',
  modelIdentifier: 'provider/*',
  promptElements: [{ key: 'context', content: 'context' }],
  promptAssemblyOrder: ['context'],
};
const sampleLongerWildcardConfig = {
  configId: 'cfg_provider_model_wildcard',
  modelIdentifier: 'provider/model*',
  promptElements: [{ key: 'context_ext', content: 'context_ext' }],
  promptAssemblyOrder: ['context_ext'],
};

describe('LLMConfigService', () => {
  let mockLogger;
  let service;

  beforeEach(() => {
    mockLogger = createMockLogger();
    // Reset mocks for fetchData before each test
    mockConfigurationProvider.fetchData.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should throw an error if configurationProvider is missing', () => {
      expect(
        () =>
          new LLMConfigService({
            logger: mockLogger,
            configurationProvider: undefined,
          })
      ).toThrow(
        'LLMConfigService: configurationProvider and logger are required options.'
      );
    });

    it('should throw an error if logger is missing', () => {
      expect(
        () =>
          new LLMConfigService({
            configurationProvider: mockConfigurationProvider,
            logger: undefined,
          })
      ).toThrow(
        'LLMConfigService: configurationProvider and logger are required options.'
      );
    });

    it('should initialize with a configSourceIdentifier', () => {
      const sourceId = 'path/to/configs.json';
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      expect(service).toBeInstanceOf(LLMConfigService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Configuration source identifier set to: ${sourceId}`
        )
      );
    });

    it('should initialize with valid initialConfigs and mark configsLoadedOrAttempted as true', () => {
      const initialConfigs = [{ ...sampleConfig1 }];
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs,
      });
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(
        service.getLlmConfigsCacheForTest().get(sampleConfig1.configId)
      ).toEqual(sampleConfig1);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Successfully loaded 1 initial configurations into cache.'
        )
      );
    });

    it('should handle empty initialConfigs array', () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [],
      });
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false); // No valid configs loaded, so flag remains false until source load or programmatic add
      expect(mockLogger.info).toHaveBeenCalledWith(
        'LLMConfigService: Empty array provided for initialConfigs. No initial configurations loaded.'
      );
    });

    it('should warn if initialConfigs is not an array', () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        // @ts-ignore
        initialConfigs: 'not-an-array',
      });
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMConfigService: initialConfigs was provided but is not an array. Ignoring.'
      );
    });

    it('should filter out invalid initialConfigs and log warnings', () => {
      const invalidConfig = { modelIdentifier: 'bad' }; // missing configId, promptElements, etc.
      const initialConfigs = [{ ...sampleConfig1 }, invalidConfig];
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs,
      });
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(
        service.getLlmConfigsCacheForTest().has(sampleConfig1.configId)
      ).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid configuration object.'),
        { configAttempted: invalidConfig }
      );
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true); // Attempted, and one was good
    });

    it('should log if no source identifier and no initial configs loaded', () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'No configuration source identifier provided and no initial configs loaded.'
        )
      );
    });
  });

  describe('#isValidConfig (indirectly tested via addOrUpdateConfigs and loading)', () => {
    beforeEach(() => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
    });

    const baseValidConfig = {
      configId: 'valid',
      modelIdentifier: 'valid/model',
      promptElements: [{ key: 'test' }],
      promptAssemblyOrder: ['test'],
    };

    it('should consider a config invalid if configId is missing or empty', () => {
      service.addOrUpdateConfigs([{ ...baseValidConfig, configId: '' }]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      service.addOrUpdateConfigs([{ ...baseValidConfig, configId: null }]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      const { configId, ...rest } = baseValidConfig;
      service.addOrUpdateConfigs([rest]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: Missing or empty configId.',
        expect.any(Object)
      );
    });

    it('should consider a config invalid if modelIdentifier is missing or empty', () => {
      service.addOrUpdateConfigs([{ ...baseValidConfig, modelIdentifier: '' }]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: Missing or empty modelIdentifier.',
        expect.any(Object)
      );
    });

    it('should consider a config invalid if promptElements is not an array', () => {
      // @ts-ignore
      service.addOrUpdateConfigs([
        { ...baseValidConfig, promptElements: 'not-an-array' },
      ]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: promptElements is not an array.',
        expect.any(Object)
      );
    });
    it('should consider a config invalid if promptElements contains invalid items', () => {
      service.addOrUpdateConfigs([
        { ...baseValidConfig, promptElements: [{ noKey: 'bad' }] },
      ]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: One or more promptElements are invalid (not an object or missing key).',
        expect.any(Object)
      );
    });

    it('should consider a config invalid if promptAssemblyOrder is not an array', () => {
      // @ts-ignore
      service.addOrUpdateConfigs([
        { ...baseValidConfig, promptAssemblyOrder: 'not-an-array' },
      ]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: promptAssemblyOrder is not an array.',
        expect.any(Object)
      );
    });
    it('should consider a config invalid if promptAssemblyOrder contains non-string keys', () => {
      // @ts-ignore
      service.addOrUpdateConfigs([
        { ...baseValidConfig, promptAssemblyOrder: [123] },
      ]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMConfigService.#isValidConfig: One or more keys in promptAssemblyOrder are not strings.',
        expect.any(Object)
      );
    });
  });

  describe('addOrUpdateConfigs', () => {
    beforeEach(() => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
    });

    it('should add valid configurations to the cache', () => {
      const configs = [{ ...sampleConfig1 }, { ...sampleConfig2 }];
      service.addOrUpdateConfigs(configs);
      expect(service.getLlmConfigsCacheForTest().size).toBe(2);
      expect(
        service.getLlmConfigsCacheForTest().get(sampleConfig1.configId)
      ).toEqual(sampleConfig1);
      expect(
        service.getLlmConfigsCacheForTest().get(sampleConfig2.configId)
      ).toEqual(sampleConfig2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Processed 2 configs: 2 added, 0 updated, 0 skipped.'
        )
      );
    });

    it('should update existing configurations in the cache', () => {
      service.addOrUpdateConfigs([{ ...sampleConfig1 }]);
      const updatedConfig1 = {
        ...sampleConfig1,
        displayName: 'Model A v1 Updated',
      };
      service.addOrUpdateConfigs([updatedConfig1]);
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(
        service.getLlmConfigsCacheForTest().get(sampleConfig1.configId)
      ).toEqual(updatedConfig1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Processed 1 configs: 0 added, 1 updated, 0 skipped.'
        )
      );
    });

    it('should skip invalid configurations and log warnings', () => {
      const invalidConfig = { configId: 'invalid' }; // Missing other required fields
      const configs = [{ ...sampleConfig1 }, invalidConfig];
      service.addOrUpdateConfigs(configs);
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(
        service.getLlmConfigsCacheForTest().has(sampleConfig1.configId)
      ).toBe(true);
      expect(service.getLlmConfigsCacheForTest().has('invalid')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid configuration object.'),
        { configAttempted: invalidConfig }
      );
    });

    it('should log an error if input is not an array', () => {
      // @ts-ignore
      service.addOrUpdateConfigs('not-an-array');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigService.addOrUpdateConfigs: Input must be an array of LLMConfig objects.'
      );
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
    });

    it('should set configsLoadedOrAttempted to true if configs are added and it was false', () => {
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);
      service.addOrUpdateConfigs([{ ...sampleConfig1 }]);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configurations added programmatically. Marking cache as "loaded/attempted"'
        )
      );
    });
  });

  describe('#loadAndCacheConfigurationsFromSource (via getConfig and resetCache)', () => {
    const sourceId = 'test-source';

    it('should load and cache configurations from provider if sourceId is set and cache is empty', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      const fetchedData = {
        defaultConfigId: sampleConfig1.configId,
        configs: {
          [sampleConfig1.configId]: { ...sampleConfig1 },
          [sampleConfig2.configId]: { ...sampleConfig2 },
        },
      };
      mockConfigurationProvider.fetchData.mockResolvedValue(fetchedData);

      await service.getConfig(sampleConfig1.configId); // Triggers load

      expect(mockConfigurationProvider.fetchData).toHaveBeenCalledWith(
        sourceId
      );
      expect(service.getLlmConfigsCacheForTest().size).toBe(2);
      expect(
        service.getLlmConfigsCacheForTest().get(sampleConfig1.configId)
      ).toEqual(sampleConfig1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully loaded and cached 2 configurations from ${sourceId}`
        )
      );
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
    });

    it('should not load from source if configSourceIdentifier is not set', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
      await service.getConfig('any_id');
      expect(mockConfigurationProvider.fetchData).not.toHaveBeenCalled();
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true); // Marked as attempted
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'No configSourceIdentifier set and no initial configurations were loaded.'
        )
      );
    });

    it('should handle errors from configurationProvider.fetchData', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      const fetchError = new Error('Fetch failed');
      mockConfigurationProvider.fetchData.mockRejectedValue(fetchError);

      await service.getConfig('any_id');

      expect(mockConfigurationProvider.fetchData).toHaveBeenCalledWith(
        sourceId
      );
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error loading or parsing configurations from ${sourceId}. Detail: Fetch failed`
        ),
        { error: fetchError }
      );
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
    });

    it('should handle invalid data structure from provider (e.g. missing "configs" map)', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      const invalidFetchedData = { defaultConfigId: 'test' }; // Missing 'configs'
      mockConfigurationProvider.fetchData.mockResolvedValue(invalidFetchedData);

      await service.getConfig('any_id');
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigService.#loadAndCacheConfigurationsFromSource: Fetched data is not in the expected RootLLMConfigsFile format or "configs" map is missing/invalid.',
        expect.objectContaining({
          source: sourceId,
          receivedData: invalidFetchedData,
        })
      );
    });

    it('should skip invalid configs within fetched data and log them', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      const invalidConfigInSource = { modelIdentifier: 'bad' };
      const fetchedData = {
        defaultConfigId: sampleConfig1.configId,
        configs: {
          [sampleConfig1.configId]: { ...sampleConfig1 },
          invalidKey: invalidConfigInSource,
        },
      };
      mockConfigurationProvider.fetchData.mockResolvedValue(fetchedData);

      await service.getConfig(sampleConfig1.configId);
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(
        service.getLlmConfigsCacheForTest().has(sampleConfig1.configId)
      ).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMConfigService.#loadAndCacheConfigurationsFromSource: Skipping invalid or incomplete configuration object during source load.',
        expect.objectContaining({
          source: sourceId,
          configKey: 'invalidKey',
          configData: invalidConfigInSource,
        })
      );
    });

    it('should warn if configId in fetched object does not match its key in the map', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      const mismatchedConfig = {
        ...sampleConfig1,
        configId: 'actual_id_is_different',
      };
      const fetchedData = {
        defaultConfigId: 'key_in_map',
        configs: { key_in_map: mismatchedConfig },
      };
      mockConfigurationProvider.fetchData.mockResolvedValue(fetchedData);

      await service.getConfig('actual_id_is_different');
      expect(
        service.getLlmConfigsCacheForTest().has('actual_id_is_different')
      ).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Config object's internal configId ("actual_id_is_different") does not match its key in the 'configs' map ("key_in_map")`
        ),
        expect.any(Object)
      );
    });

    it('should not reload from source if configs already loaded and cache populated', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
        initialConfigs: [{ ...sampleConfig1 }],
      });
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true); // from initialConfigs
      mockConfigurationProvider.fetchData.mockClear(); // Clear calls from potential constructor load if any

      await service.getConfig(sampleConfig1.configId);
      expect(mockConfigurationProvider.fetchData).not.toHaveBeenCalled();
    });

    it('should not reload from source if load was attempted from source and failed (cache empty)', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        configSourceIdentifier: sourceId,
      });
      mockConfigurationProvider.fetchData.mockRejectedValueOnce(
        new Error('First fail')
      );
      await service.getConfig('any_id'); // First attempt, fails
      expect(mockConfigurationProvider.fetchData).toHaveBeenCalledTimes(1);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
      expect(service.getLlmConfigsCacheForTest().size).toBe(0);

      // Second attempt
      await service.getConfig('another_id');
      // Should not call fetchData again because #configsLoadedOrAttempted is true and cache is empty (implying previous failure)
      expect(mockConfigurationProvider.fetchData).toHaveBeenCalledTimes(1); // Still 1
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Load previously attempted from source, but cache is empty'
        )
      );
    });
  });

  describe('getConfig', () => {
    it('should return undefined and log error if llmId is not a non-empty string', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
      expect(await service.getConfig('')).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigService.getConfig: llmId must be a non-empty string.',
        { llmIdAttempted: '' }
      );
      // @ts-ignore
      expect(await service.getConfig(null)).toBeUndefined();
      // @ts-ignore
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMConfigService.getConfig: llmId must be a non-empty string.',
        { llmIdAttempted: null }
      );
    });

    it('should return undefined if cache is empty and no source can provide configs', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
      // No initial configs, no source ID, or source load fails and leaves cache empty
      mockConfigurationProvider.fetchData.mockResolvedValue({ configs: {} }); // Ensure ensureConfigsLoaded runs but finds nothing
      expect(await service.getConfig('non_existent_id')).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cache is empty. Cannot find configuration for "non_existent_id".'
        )
      );
    });

    it('should return config by direct configId match', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }],
      });
      const config = await service.getConfig(sampleConfig1.configId);
      expect(config).toEqual(sampleConfig1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Found configuration by direct configId match for "${sampleConfig1.configId}"`
        )
      );
    });

    it('should return a copy of the config, not the cached instance', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }],
      });
      const config = await service.getConfig(sampleConfig1.configId);
      expect(config).toEqual(sampleConfig1);
      config.displayName = 'Modified'; // Modify the copy
      const originalCachedConfig = service
        .getLlmConfigsCacheForTest()
        .get(sampleConfig1.configId);
      expect(originalCachedConfig.displayName).toBe('Model A v1 Config'); // Original should be unchanged
    });

    it('should return config by exact modelIdentifier match if configId fails', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }],
      });
      const config = await service.getConfig(sampleConfig1.modelIdentifier);
      expect(config).toEqual(sampleConfig1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Selected configuration by exact modelIdentifier match for "${sampleConfig1.modelIdentifier}"`
        )
      );
    });

    it('should return config by wildcard modelIdentifier match (longest prefix wins)', async () => {
      const initialConfigs = [
        { ...sampleWildcardConfig },
        { ...sampleLongerWildcardConfig },
        { ...sampleConfig1 },
      ];
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs,
      });

      // This ID should match the longer wildcard
      const targetModelId1 = 'provider/model-x-v3';
      let config = await service.getConfig(targetModelId1);
      expect(config.configId).toBe(sampleLongerWildcardConfig.configId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Selected configuration by wildcard modelIdentifier match for "${targetModelId1}". Pattern: "${sampleLongerWildcardConfig.modelIdentifier}"`
        )
      );

      // This ID should match the shorter wildcard as it's not covered by the longer one
      const targetModelId2 = 'provider/another-model';
      config = await service.getConfig(targetModelId2);
      expect(config.configId).toBe(sampleWildcardConfig.configId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Selected configuration by wildcard modelIdentifier match for "${targetModelId2}". Pattern: "${sampleWildcardConfig.modelIdentifier}"`
        )
      );
    });

    it('should prioritize direct configId over modelIdentifier matches', async () => {
      // sampleConfig1 has modelIdentifier "provider/model-a-v1"
      // sampleLongerWildcardConfig has modelIdentifier "provider/model*"
      // If we search for "provider/model-a-v1" which is also a configId of another config
      const conflictingConfig = {
        configId: 'provider/model-a-v1', // This configId is same as sampleConfig1's modelIdentifier
        modelIdentifier: 'some/other-model',
        promptElements: [{ key: 'k' }],
        promptAssemblyOrder: ['k'],
      };
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }, conflictingConfig],
      });

      const config = await service.getConfig('provider/model-a-v1'); // This is a configId
      expect(config.configId).toBe(conflictingConfig.configId); // Should find by configId first
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Found configuration by direct configId match for "provider/model-a-v1"`
        )
      );
    });

    it('should prioritize exact modelIdentifier over wildcard modelIdentifier', async () => {
      const exactMatchConfig = {
        configId: 'exact_model_x',
        modelIdentifier: 'provider/model-x', // Exact match
        promptElements: [{ key: 'k' }],
        promptAssemblyOrder: ['k'],
      };
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleWildcardConfig }, exactMatchConfig],
      });

      const config = await service.getConfig('provider/model-x');
      expect(config.configId).toBe(exactMatchConfig.configId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Selected configuration by exact modelIdentifier match for "provider/model-x"`
        )
      );
    });

    it('should return undefined if no match is found after all checks', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }],
      });
      const config = await service.getConfig('non_existent_identifier_123');
      expect(config).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'No configuration found for identifier "non_existent_identifier_123"'
        )
      );
    });
  });

  describe('resetCache', () => {
    const sourceId = 'test-source-for-reset';
    it('should clear the cache and reset configsLoadedOrAttempted flag', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }],
        configSourceIdentifier: sourceId,
      });
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);

      service.resetCache();

      expect(service.getLlmConfigsCacheForTest().size).toBe(0);
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'LLMConfigService: Cache cleared and loaded state reset. Configurations will be reloaded from source on next request if source is configured.'
      );
    });

    it('should force a reload from source on next getConfig call if source is configured', async () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs: [{ ...sampleConfig1 }], // Load initially
        configSourceIdentifier: sourceId,
      });
      await service.getConfig(sampleConfig1.configId); // ensures initial load if not from constructor
      mockConfigurationProvider.fetchData.mockClear(); // Clear any calls from initial load

      service.resetCache();

      const fetchedData = {
        configs: { [sampleConfig2.configId]: { ...sampleConfig2 } },
      };
      mockConfigurationProvider.fetchData.mockResolvedValue(fetchedData);

      const newConfig = await service.getConfig(sampleConfig2.configId);
      expect(mockConfigurationProvider.fetchData).toHaveBeenCalledWith(
        sourceId
      );
      expect(newConfig).toEqual(sampleConfig2);
      expect(service.getLlmConfigsCacheForTest().size).toBe(1);
    });
  });

  describe('Test Utility Methods', () => {
    it('getLlmConfigsCacheForTest should return the internal cache', () => {
      const initialConfigs = [{ ...sampleConfig1 }];
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
        initialConfigs,
      });
      const cache = service.getLlmConfigsCacheForTest();
      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(1);
      expect(cache.get(sampleConfig1.configId)).toEqual(sampleConfig1);
    });

    it('getConfigsLoadedOrAttemptedFlagForTest should return the internal flag state', () => {
      service = new LLMConfigService({
        logger: mockLogger,
        configurationProvider: mockConfigurationProvider,
      });
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(false);
      service.addOrUpdateConfigs([{ ...sampleConfig1 }]); // This will set the flag to true
      expect(service.getConfigsLoadedOrAttemptedFlagForTest()).toBe(true);
    });
  });
});
// --- FILE END ---
