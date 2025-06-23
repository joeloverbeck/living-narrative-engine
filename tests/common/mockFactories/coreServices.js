/**
 * @file Factory functions for core service mocks used in tests.
 * @see tests/common/mockFactories/coreServices.js
 */

import { jest } from '@jest/globals';
import { deepClone } from '../../../src/utils/cloneUtils.js';

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
export const createMockDataFetcher = ({
  fromDisk = false,
  pathToResponse = {},
  errorPaths = [],
  overrides = {},
} = {}) => {
  if (fromDisk) {
    // eslint-disable-next-line no-undef
    const fs = require('fs');
    return {
      fetch: jest.fn().mockImplementation(async (identifier) => {
        if (identifier.endsWith('.json')) {
          const filePath = identifier.replace(/^\.\//, '');
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        throw new Error('Unsupported identifier: ' + identifier);
      }),
      fetchJson: jest.fn(),
      fetchText: jest.fn(),
      ...overrides,
    };
  }

  let fetchErrorMessage = '';
  const mockFetcher = {
    fetch: jest.fn(),
    fetchJson: jest.fn(),
    fetchText: jest.fn(),
    mockSuccess: function (path, responseData) {
      pathToResponse[path] = deepClone(responseData);
      if (errorPaths.includes(path)) {
        errorPaths = errorPaths.filter((p) => p !== path);
      }
      setFetchImplementation();
    },
    mockFailure: function (
      path,
      errorMessage = `Mock Fetch Error: Failed to fetch ${path}`
    ) {
      if (!errorPaths.includes(path)) {
        errorPaths.push(path);
      }
      if (Object.prototype.hasOwnProperty.call(pathToResponse, path)) {
        delete pathToResponse[path];
      }
      fetchErrorMessage = errorMessage;
      setFetchImplementation();
    },
    ...overrides,
  };

  /**
   * Updates the fetch mock implementation based on configured paths.
   *
   * @returns {void}
   */
  function setFetchImplementation() {
    mockFetcher.fetch.mockImplementation(async (p) => {
      if (errorPaths.includes(p)) {
        const message =
          fetchErrorMessage || `Mock Fetch Error: Failed to fetch ${p}`;
        return Promise.reject(new Error(message));
      }
      if (Object.prototype.hasOwnProperty.call(pathToResponse, p)) {
        try {
          return Promise.resolve(deepClone(pathToResponse[p]));
        } catch (e) {
          return Promise.reject(
            new Error(
              `Mock Fetcher Error: Could not clone mock data for path ${p}. Is it valid JSON?`
            )
          );
        }
      }
      if (overrides.defaultValue !== undefined) {
        return Promise.resolve(deepClone(overrides.defaultValue));
      }
      return Promise.reject(
        new Error(`Mock Fetch Error: 404 Not Found for path ${p}`)
      );
    });
  }

  setFetchImplementation();

  return mockFetcher;
};
