/**
 * @file Factory functions for core service mocks used in tests.
 * @see tests/common/mockFactories/coreServices.js
 */

import { jest } from '@jest/globals';
import { MockDataFetcher } from './dataFetcherMock.js';

/**
 * Creates a simple mock object with jest.fn methods.
 *
 * @description Utility to generate mock implementations for a list of method names.
 * @param {string[]} methodNames - Names of the methods to mock.
 * @param {Record<string, any>} [defaults] - Optional default implementations.
 * @returns {Record<string, jest.Mock>} Object containing mocked methods.
 */
export function createSimpleMock(methodNames, defaults = {}) {
  const mock = {};
  for (const name of methodNames) {
    mock[name] = Object.prototype.hasOwnProperty.call(defaults, name)
      ? defaults[name]
      : jest.fn();
  }
  return mock;
}

/**
 * Generates simple mock factory functions based on a specification map.
 *
 * @param {Record<string, string[] | {methods: string[], defaults?: object}>} specMap
 *  Mapping of factory names to method arrays or spec objects.
 * @returns {Record<string, () => object>} Generated factory functions.
 */
export function generateFactories(specMap) {
  const factories = {};
  for (const [name, spec] of Object.entries(specMap)) {
    const { methods, defaults = {} } = Array.isArray(spec)
      ? { methods: spec, defaults: {} }
      : spec;
    factories[name] = () => createSimpleMock(methods, defaults);
  }
  return factories;
}

const simpleFactories = {
  createMockGamePersistenceService: [
    'saveGame',
    'loadAndRestoreGame',
    'isSavingAllowed',
  ],
  createMockPlaytimeTracker: {
    methods: [
      'reset',
      'startSession',
      'endSessionAndAccumulate',
      'getTotalPlaytime',
      'setAccumulatedPlaytime',
    ],
    defaults: { getTotalPlaytime: jest.fn().mockReturnValue(0) },
  },
  createMockInitializationService: ['runInitializationSequence'],
  createMockLLMAdapter: ['getAIDecision', 'getCurrentActiveLlmId'],
  createMockAIGameStateProvider: ['buildGameState'],
  createMockAIPromptContentProvider: ['getPromptData'],
  createMockPromptBuilder: ['build'],
  createMockAIPromptPipeline: ['generatePrompt'],
  createMockTurnActionChoicePipeline: ['buildChoices'],
  createMockEntityDisplayDataProvider: ['getEntityName'],
  createMockLLMConfigurationManager: {
    methods: [
      'loadConfiguration',
      'getActiveConfiguration',
      'setActiveConfiguration',
      'getAllConfigurations',
      'hasConfiguration',
      'clearActiveConfiguration',
      'init',
      'validateConfiguration',
      'getAvailableOptions',
      'getActiveConfigId',
      'isOperational',
    ],
    defaults: {
      init: jest.fn().mockImplementation(async function ({
        llmConfigLoader,
        initialLlmId = null,
      }) {
        if (
          llmConfigLoader &&
          typeof llmConfigLoader.loadConfigs === 'function'
        ) {
          const configResult = await llmConfigLoader.loadConfigs();

          // Check if result indicates an error
          if (configResult && configResult.error === true) {
            this.isOperational.mockReturnValue(false);
            return configResult;
          }

          // Store the configuration for later use
          if (
            configResult &&
            configResult.configs &&
            configResult.defaultConfigId
          ) {
            this._configs = configResult.configs;
            this._defaultConfigId = configResult.defaultConfigId;

            // Check if initialLlmId was provided and exists in configs
            if (
              initialLlmId &&
              typeof initialLlmId === 'string' &&
              configResult.configs[initialLlmId]
            ) {
              this._activeConfigId = initialLlmId;
              this._activeConfig = configResult.configs[initialLlmId];
            } else if (initialLlmId && typeof initialLlmId === 'string') {
              // initialLlmId provided but not found - log warning and fall back
              console.warn(
                `ConfigurableLLMAdapter.#selectInitialActiveLlm: initialLlmId ('${initialLlmId}') was provided to constructor, but no LLM configuration with this ID exists in the configs map. Falling back to defaultConfigId logic.`
              );
              if (configResult.configs[configResult.defaultConfigId]) {
                this._activeConfigId = configResult.defaultConfigId;
                this._activeConfig =
                  configResult.configs[configResult.defaultConfigId];
              } else {
                this._activeConfigId = null;
                this._activeConfig = null;
                console.warn(
                  `ConfigurableLLMAdapter: 'defaultConfigId' ("${configResult.defaultConfigId}") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set.`
                );
              }
            } else if (configResult.configs[configResult.defaultConfigId]) {
              // Fall back to default config if it exists
              this._activeConfigId = configResult.defaultConfigId;
              this._activeConfig =
                configResult.configs[configResult.defaultConfigId];
            } else {
              // No valid config found
              this._activeConfigId = null;
              this._activeConfig = null;

              // Check if defaultConfigId is an empty/invalid string
              if (
                typeof configResult.defaultConfigId === 'string' &&
                configResult.defaultConfigId.trim() === ''
              ) {
                console.warn(
                  `ConfigurableLLMAdapter.#selectInitialActiveLlm: 'defaultConfigId' found in configurations but it is not a valid non-empty string ("${configResult.defaultConfigId}").`
                );
              } else {
                console.warn(
                  `ConfigurableLLMAdapter: 'defaultConfigId' ("${configResult.defaultConfigId}") is specified in configurations, but no LLM configuration with this ID exists in the configs map. No default LLM set.`
                );
              }
            }

            // Update other methods to return stored data
            this.getActiveConfiguration.mockResolvedValue(this._activeConfig);
            this.getActiveConfigId.mockResolvedValue(this._activeConfigId);
            this.getActiveConfigId.mockImplementation(
              () => this._activeConfigId
            ); // Also set sync return
            this.hasConfiguration.mockImplementation((id) =>
              Boolean(this._configs && this._configs[id])
            );
            this.setActiveConfiguration.mockImplementation(async (id) => {
              if (this._configs && this._configs[id]) {
                this._activeConfigId = id;
                this._activeConfig = this._configs[id];
                this.getActiveConfiguration.mockResolvedValue(
                  this._activeConfig
                );
                this.getActiveConfigId.mockResolvedValue(this._activeConfigId);
                this.getActiveConfigId.mockImplementation(
                  () => this._activeConfigId
                ); // Also set sync return
                return true;
              }
              return false;
            });
            this.getAllConfigurations.mockResolvedValue(configResult);

            // Update getAvailableOptions to return proper format
            const options = Object.keys(this._configs).map((configId) => ({
              configId,
              displayName: this._configs[configId].displayName || configId,
            }));
            this.getAvailableOptions.mockResolvedValue(options);

            this.isOperational.mockReturnValue(true);
          } else {
            // Invalid configuration structure
            this.isOperational.mockReturnValue(false);
            this.getActiveConfiguration.mockResolvedValue(null);
            this.getActiveConfigId.mockResolvedValue(null);
            this.getActiveConfigId.mockImplementation(() => null); // Also set sync return
          }

          return configResult;
        }
      }),
      getActiveConfiguration: jest.fn().mockResolvedValue(null),
      getAllConfigurations: jest.fn().mockResolvedValue(null),
      hasConfiguration: jest.fn().mockReturnValue(false),
      isOperational: jest.fn().mockReturnValue(true),
      getAvailableOptions: jest.fn().mockResolvedValue([]),
      validateConfiguration: jest.fn().mockImplementation((config) => {
        const errors = [];
        if (!config) return [{ field: 'config', reason: 'Missing or invalid' }];

        if (
          !config.configId ||
          typeof config.configId !== 'string' ||
          config.configId.trim() === ''
        ) {
          errors.push({ field: 'configId', reason: 'Missing or invalid' });
        }
        if (
          !config.endpointUrl ||
          typeof config.endpointUrl !== 'string' ||
          config.endpointUrl.trim() === ''
        ) {
          errors.push({ field: 'endpointUrl', reason: 'Missing or invalid' });
        }
        if (
          !config.modelIdentifier ||
          typeof config.modelIdentifier !== 'string' ||
          config.modelIdentifier.trim() === ''
        ) {
          errors.push({
            field: 'modelIdentifier',
            reason: 'Missing or invalid',
          });
        }
        if (
          !config.apiType ||
          typeof config.apiType !== 'string' ||
          config.apiType.trim() === ''
        ) {
          errors.push({ field: 'apiType', reason: 'Missing or invalid' });
        }
        if (
          config.jsonOutputStrategy &&
          typeof config.jsonOutputStrategy !== 'object'
        ) {
          errors.push({
            field: 'jsonOutputStrategy',
            reason: 'Is required and must be an object.',
          });
        }
        if (
          config.jsonOutputStrategy &&
          (!config.jsonOutputStrategy.method ||
            typeof config.jsonOutputStrategy.method !== 'string' ||
            config.jsonOutputStrategy.method.trim() === '')
        ) {
          errors.push({
            field: 'jsonOutputStrategy.method',
            reason: 'Is required and must be a non-empty string.',
          });
        }

        return errors;
      }),
      getActiveConfigId: jest.fn().mockImplementation(() => null), // Return sync null by default
      setActiveConfiguration: jest.fn().mockResolvedValue(false),
    },
  },
  createMockLLMRequestExecutor: {
    methods: ['executeRequest', 'executeWithRetry', 'handleAbortSignal'],
    defaults: {
      executeRequest: jest.fn().mockResolvedValue('{"result": "success"}'),
    },
  },
  createMockLLMErrorMapper: {
    methods: [
      'mapHttpError',
      'mapResponseError',
      'isRetryableError',
      'getErrorSeverity',
      'logError',
    ],
    defaults: {
      mapHttpError: jest.fn((error) => error),
      isRetryableError: jest.fn().mockReturnValue(false),
      logError: jest.fn(),
    },
  },
  createMockTokenEstimator: {
    methods: [
      'estimateTokens',
      'estimatePromptTokens',
      'estimateResponseTokens',
      'getModelTokenLimit',
      'getTokenBudget',
      'validateTokenLimit',
    ],
    defaults: {
      estimateTokens: jest.fn().mockReturnValue(100),
      getModelTokenLimit: jest.fn().mockReturnValue(4096),
      getTokenBudget: jest.fn().mockReturnValue(4096),
      validateTokenLimit: jest
        .fn()
        .mockReturnValue({ isValid: true, used: 100, limit: 4096 }),
    },
  },
};

const generatedFactories = generateFactories(simpleFactories);

export const {
  createMockGamePersistenceService,
  createMockPlaytimeTracker,
  createMockInitializationService,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockTurnActionChoicePipeline,
  createMockEntityDisplayDataProvider,
  createMockLLMConfigurationManager,
  createMockLLMRequestExecutor,
  createMockLLMErrorMapper,
  createMockTokenEstimator,
} = generatedFactories;

const baseCreateMockAIPromptPipeline =
  generatedFactories.createMockAIPromptPipeline;

export const createMockAIPromptPipeline = (defaultPrompt) => {
  const pipeline = baseCreateMockAIPromptPipeline();
  if (typeof defaultPrompt === 'string') {
    pipeline.generatePrompt = jest.fn().mockResolvedValue(defaultPrompt);
  }
  return pipeline;
};

/**
 * Creates a mock AJV schema validator service.
 *
 * @param {object} [defaultValidationResult] - Default result.
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {{ validate: jest.Mock, getValidator: jest.Mock }} Mock validator
 */
export const createMockSchemaValidator = (
  defaultValidationResult = { isValid: true },
  overrides = {}
) => ({
  validate: jest.fn(() => defaultValidationResult),
  isSchemaLoaded: jest.fn(),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  getValidator: jest.fn(() => jest.fn(() => defaultValidationResult)),
  ...overrides,
});

/**
 * Creates a mock configuration provider.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {object} Mock configuration
 */
export const createMockConfiguration = (overrides = {}) => ({
  getContentTypeSchemaId: jest.fn((type) => `schema:${type}`),
  getBaseDataPath: jest.fn(() => './data'),
  getSchemaFiles: jest.fn(() => []),
  getSchemaBasePath: jest.fn(() => 'schemas'),
  getContentBasePath: jest.fn((type) => `./data/${type}`),
  getGameConfigFilename: jest.fn(() => 'game.json'),
  getModsBasePath: jest.fn(() => './data/mods'),
  getModManifestFilename: jest.fn(() => 'mod-manifest.json'),
  getWorldBasePath: jest.fn(() => 'worlds'),
  getContentTypeDirectory: jest.fn(),
  get: jest.fn(),
  ...overrides,
});

/**
 * Creates a mock IPathResolver.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {object} Mock path resolver
 */
export const createMockPathResolver = (overrides = {}) => ({
  resolvePath: jest.fn((path) => path),
  resolveModPath: jest.fn((modId) => `mods/${modId}`),
  resolveModContentPath: jest.fn(
    (modId, diskFolder, filename) => `mods/${modId}/${diskFolder}/${filename}`
  ),
  resolveModManifestPath: jest.fn((modId) => `mods/${modId}/mod-manifest.json`),
  getModDirectory: jest.fn((modId) => `mods/${modId}`),
  getManifestName: jest.fn(),
  resolveContentPath: jest.fn(
    (registryKey, filename) => `/path/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `/schemas/${filename}`),
  resolveGameConfigPath: jest.fn(() => '/game.json'),
  resolveRulePath: jest.fn((filename) => `/system-rules/${filename}`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher. Can operate purely in-memory or read JSON files
 * from disk when `fromDisk` is true.
 *
 * @param {object} [options]
 * @param {boolean} [options.fromDisk] - Read data from disk instead of using in-memory mappings.
 * @param {object} [options.pathToResponse] - Map of path strings to successful response data.
 * @param {string[]} [options.errorPaths] - List of paths that should trigger a rejection.
 * @param {object} [options.overrides] - Optional overrides for mock methods.
 * @returns {object} Mock data fetcher with helper methods
 */
export const createMockDataFetcher = (options = {}) =>
  new MockDataFetcher(options);

/**
 * Creates a mock IScopeEngine.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {object} Mock scope engine
 */
export const createMockScopeEngine = (overrides = {}) => ({
  resolve: jest.fn().mockReturnValue(new Set()),
  setMaxDepth: jest.fn(),
  ...overrides,
});

/**
 * Creates a mock EventDispatchService.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {object} Mock event dispatch service
 */
export const createMockEventDispatchService = (overrides = {}) => ({
  dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
  dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
  safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});
