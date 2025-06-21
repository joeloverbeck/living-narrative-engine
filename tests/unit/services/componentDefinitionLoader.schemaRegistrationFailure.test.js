// src/tests/services/componentLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ComponentLoader from '../../../src/loaders/componentLoader.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Import base class if needed

// --- Mock Service Factories ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param overrides
 */
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentBasePath: jest.fn((registryKey) => `./data/mods/test-mod/${registryKey}`),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'components') {
      return 'http://example.com/schemas/component.schema.json';
    }
    if (registryKey === 'mod-manifest') {
      return 'http://example.com/schemas/mod-manifest.schema.json';
    }
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 *
 * @param overrides
 */
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, registryKey, filename) =>
      `./data/mods/${modId}/${registryKey}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (registryKey, filename) => `./data/${registryKey}/${filename}`
  ),
  resolveSchemaPath: jest.fn((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest.fn(
    (modId) => `./data/mods/${modId}/mod.manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 *
 * @param pathToResponse
 * @param errorPaths
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path)) {
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    }
    if (path in pathToResponse) {
      return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
    }
    return Promise.reject(
      new Error(`Mock Fetch Error: 404 Not Found for ${path}`)
    );
  }),
});

/**
 * Creates a mock ISchemaValidator service.
 *
 * @param overrides
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();
  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      if (loadedSchemas.has(schemaId)) {
        loadedSchemas.delete(schemaId);
        schemaValidators.delete(schemaId);
        return true;
      }
      return false;
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (validatorFn) {
        return validatorFn(data);
      }
      if (loadedSchemas.has(schemaId)) {
        return { isValid: true, errors: null };
      }
      return {
        isValid: false,
        errors: [
          {
            message: `Mock Schema Error: Base mock cannot validate unknown schema '${schemaId}'.`,
          },
        ],
      };
    }),
    mockValidatorFunction: (schemaId, implementation) => {
      const fn = schemaValidators.get(schemaId) || jest.fn();
      fn.mockImplementation(implementation);
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {});
      }
      schemaValidators.set(schemaId, fn);
    },
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    },
    _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 *
 * @param overrides
 */
const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn((type, id, data) => {}),
  get: jest.fn((type, id) => undefined),
  getAll: jest.fn((type) => []),
  clear: jest.fn(),
  ...overrides,
});

/**
 * Creates a mock ILogger service.
 *
 * @param overrides
 */
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

/**
 * Creates a basic valid mock component definition object.
 *
 * @param id
 * @param dataSchema
 * @param description
 */
const createMockComponentDefinition = (
  id,
  dataSchema = { type: 'object', properties: {} },
  description = ''
) => ({
  id: id,
  dataSchema: dataSchema,
  ...(description && { description: description }),
});

/**
 * Creates a basic mock Mod Manifest object.
 *
 * @param modId
 * @param componentFiles
 */
const createMockModManifest = (modId, componentFiles = []) => ({
  id: modId,
  name: `Mock Mod ${modId}`,
  version: '1.0.0',
  content: { components: componentFiles },
});
// ***** END MOCK FACTORIES *****

// --- Test Suite ---

describe('ComponentLoader (Sub-Ticket 6.8: Data Schema Registration Failure)', () => {
  // --- Declare Mocks & Loader ---
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let loader;

  // --- Shared Test Data ---
  const modId = 'regFailMod';
  const componentDefSchemaId =
    'http://example.com/schemas/component.schema.json';

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    loader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // --- Base setup common ---
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === 'components' ? componentDefSchemaId : undefined
    );
    mockValidator._setSchemaLoaded(componentDefSchemaId);
    mockValidator.validate.mockImplementation((schemaId, data) => {
      if (schemaId === componentDefSchemaId) {
        return { isValid: true, errors: null };
      }
      const originalMockLogic = createMockSchemaValidator().validate;
      return originalMockLogic(schemaId, data);
    });
  });

  // --- Test Case: Scenario 1 (addSchema Failure) ---
  it('Scenario 1: should handle errors during addSchema', async () => {
    // --- Setup: Scenario 1 ---
    const filename = 'comp_add_fail.component.json';
    const filePath = `./data/mods/${modId}/components/${filename}`;
    const componentBaseId = 'add_fail';
    const qualifiedSchemaId = `${modId}:${componentBaseId}`;
    const validDef = createMockComponentDefinition(componentBaseId, {
      type: 'object',
      properties: { value: { type: 'string' } },
    });
    const addSchemaError = new Error(
      'Mock Validator Error: Failed to add schema'
    );
    const manifest = createMockModManifest(modId, [filename]);

    mockResolver.resolveModContentPath.mockReturnValue(filePath);
    mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef)));
    mockValidator.addSchema.mockImplementation(async (schema, schemaId) => {
      if (schemaId === qualifiedSchemaId) {
        throw addSchemaError;
      }
    });
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      return schemaId === componentDefSchemaId;
    });

    // --- Action ---
    const loadPromise = loader.loadItemsForMod(
      modId,
      manifest,
      'components',
      'components',
      'components'
    );

    // --- Verify: Promise Resolves & Result Object ---
    await expect(loadPromise).resolves.not.toThrow();
    const result = await loadPromise;
    expect(result).toEqual({ count: 0, errors: 1, overrides: 0 });

    // --- Verify: Mock Calls ---
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      'components',
      filename
    );
    expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      componentDefSchemaId,
      validDef
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      componentDefSchemaId
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      qualifiedSchemaId
    );
    expect(mockValidator.removeSchema).not.toHaveBeenCalled();
    expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
    expect(mockValidator.addSchema).toHaveBeenCalledWith(
      validDef.dataSchema,
      qualifiedSchemaId
    );
    expect(mockRegistry.store).not.toHaveBeenCalled();

    // --- Verify: Error Logs ---
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    // Only the outer wrapper should log, as the inner utility's error is re-thrown
    const expectedWrapperMsgAdd = `Error processing file:`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedWrapperMsgAdd,
      expect.objectContaining({
        filename: filename,
        path: filePath,
        error: addSchemaError.message,
      }),
      addSchemaError
    );

    // --- Verify: Final Info Log ---
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `ComponentLoader: Loading components definitions for mod '${modId}'.`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
  it('Scenario 2: should handle errors during removeSchema on override', async () => {
    // --- Setup: Scenario 2 ---
    const filename = 'comp_remove_fail.component.json';
    const filePath = `./data/mods/${modId}/components/${filename}`;
    const componentBaseId = 'remove_fail';
    const qualifiedSchemaId = `${modId}:${componentBaseId}`;
    const overrideDef = createMockComponentDefinition(componentBaseId, {
      properties: { version: { const: 2 } },
    });
    const removeSchemaError = new Error(
      'Mock Validator Error: Failed to remove schema'
    );
    const manifest = createMockModManifest(modId, [filename]);

    mockResolver.resolveModContentPath.mockReturnValue(filePath);
    mockFetcher.fetch.mockResolvedValue(
      JSON.parse(JSON.stringify(overrideDef))
    );
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      return (
        schemaId === componentDefSchemaId || schemaId === qualifiedSchemaId
      );
    });
    mockValidator.removeSchema.mockImplementation((schemaId) => {
      if (schemaId === qualifiedSchemaId) {
        throw removeSchemaError;
      }
      return true;
    });

    // --- Action ---
    const loadPromise = loader.loadItemsForMod(
      modId,
      manifest,
      'components',
      'components',
      'components'
    );

    // --- Verify: Promise Resolves & Result Object ---
    await expect(loadPromise).resolves.not.toThrow();
    const result = await loadPromise;
    expect(result).toEqual({ count: 0, errors: 1, overrides: 0 });

    // --- Verify: Mock Calls ---
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      'components',
      filename
    );
    expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
    expect(mockValidator.validate).toHaveBeenCalledTimes(1);
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      qualifiedSchemaId
    );
    expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
    expect(mockValidator.removeSchema).toHaveBeenCalledWith(qualifiedSchemaId);
    expect(mockValidator.addSchema).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();

    // --- Verify: Error Logs ---
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const expectedWrapperMsgRemove = `Error processing file:`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedWrapperMsgRemove,
      expect.objectContaining({
        filename: filename,
        path: filePath,
        error: removeSchemaError.message,
      }),
      removeSchemaError
    );

    // --- Verify: Final Info Log ---
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
    );

    // --- Verify: Warnings ---
    const warnMsg = `Component Definition '${filename}' in mod '${modId}' is overwriting an existing data schema for component ID '${qualifiedSchemaId}'.`;
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(warnMsg);
  });
});
