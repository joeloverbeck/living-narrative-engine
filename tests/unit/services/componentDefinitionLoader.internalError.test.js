// src/tests/services/componentDefinitionLoader.internalError.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ComponentLoader from '../../../src/loaders/componentLoader.js'; // Adjusted path

// --- Mock Service Factories ---
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn((registryKey) => `./data/mods/test-mod/${registryKey}`),
  getContentTypeSchemaId: jest.fn((registryKey) =>
    registryKey === 'components'
      ? 'http://example.com/schemas/component.schema.json'
      : `http://example.com/schemas/${registryKey}.schema.json`
  ),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'),
  getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});
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
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path))
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    if (path in pathToResponse)
      return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
    return Promise.reject(
      new Error(`Mock Fetch Error: 404 Not Found for ${path}`)
    );
  }),
});
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
      if (validatorFn) return validatorFn(data);
      if (loadedSchemas.has(schemaId)) return { isValid: true, errors: null };
      return {
        isValid: false,
        errors: [
          {
            message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`,
          },
        ],
      };
    }),
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, schemaData);
        if (!schemaValidators.has(schemaId)) {
          schemaValidators.set(
            schemaId,
            jest.fn(() => ({ isValid: true, errors: null }))
          );
        }
      }
    },
    ...overrides,
  };
  return mockValidator;
};
const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(() => []),
  clear: jest.fn(),
  ...overrides,
});
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});
const createMockModManifest = (modId, componentFiles = []) => ({
  id: modId,
  name: `Mock Mod ${modId}`,
  version: '1.0.0',
  content: { components: componentFiles },
});

// --- Test Suite ---
describe('ComponentLoader (Internal Definition Errors)', () => {
  let mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger,
    loader;
  const modId = 'internalErrorMod';
  const componentDefSchemaId =
    'http://example.com/schemas/component.schema.json';

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
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === 'components' ? componentDefSchemaId : undefined
    );
    mockValidator._setSchemaLoaded(componentDefSchemaId, {});
    mockResolver.resolveModContentPath.mockImplementation(
      (modId, registryKey, filename) =>
        `./data/mods/${modId}/${registryKey}/${filename}`
    );
    jest.spyOn(loader, '_storeItemInRegistry');
  });

  it('should handle definitions with invalid "id" (null or empty string)', async () => {
    const filenameNullId = 'invalid_null_id.component.json';
    const filenameEmptyId = 'invalid_empty_id.component.json';
    const filePathNullId = `./data/mods/${modId}/components/${filenameNullId}`;
    const filePathEmptyId = `./data/mods/${modId}/components/${filenameEmptyId}`;
    const invalidDataNullId = { id: null, dataSchema: { type: 'object' } };
    const invalidDataEmptyId = { id: '', dataSchema: { type: 'object' } };
    const errorManifest = createMockModManifest(modId, [
      filenameNullId,
      filenameEmptyId,
    ]);
    mockFetcher.fetch.mockImplementation(async (path) => {
      if (path === filePathNullId)
        return Promise.resolve(JSON.parse(JSON.stringify(invalidDataNullId)));
      if (path === filePathEmptyId)
        return Promise.resolve(JSON.parse(JSON.stringify(invalidDataEmptyId)));
      throw new Error(`Unexpected fetch call: ${path}`);
    });

    const result = await loader.loadItemsForMod(
      modId,
      errorManifest,
      'components',
      'components',
      'components'
    );

    expect(result).toEqual({ count: 0, errors: 2, overrides: 0 });
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockValidator.addSchema).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledTimes(2);

    // Verify the two errors logged by the wrapper
    const expectedErrorMsg1 = `Invalid or missing 'id' in ${filenameNullId} for mod '${modId}'.`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        filename: filenameNullId,
        error: expectedErrorMsg1,
      }),
      expect.any(Error)
    );

    const expectedErrorMsg2 = `Invalid or missing 'id' in ${filenameEmptyId} for mod '${modId}'.`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        filename: filenameEmptyId,
        error: expectedErrorMsg2,
      }),
      expect.any(Error)
    );
  });

  it('should handle definitions with invalid "dataSchema" (null or not an object)', async () => {
    const filenameNullSchema = 'invalid_null_schema.component.json';
    const filenameStringSchema = 'invalid_string_schema.component.json';
    const filePathNullSchema = `./data/mods/${modId}/components/${filenameNullSchema}`;
    const filePathStringSchema = `./data/mods/${modId}/components/${filenameStringSchema}`;
    const validId = 'valid_id';
    const invalidDataNullSchema = { id: validId, dataSchema: null };
    const invalidDataStringSchema = {
      id: validId,
      dataSchema: 'not-an-object',
    };
    const errorManifest = createMockModManifest(modId, [
      filenameNullSchema,
      filenameStringSchema,
    ]);
    mockFetcher.fetch.mockImplementation(async (path) => {
      if (path === filePathNullSchema)
        return Promise.resolve(
          JSON.parse(JSON.stringify(invalidDataNullSchema))
        );
      if (path === filePathStringSchema)
        return Promise.resolve(
          JSON.parse(JSON.stringify(invalidDataStringSchema))
        );
      throw new Error(`Unexpected fetch call: ${path}`);
    });

    const result = await loader.loadItemsForMod(
      modId,
      errorManifest,
      'components',
      'components',
      'components'
    );

    expect(result).toEqual({ count: 0, errors: 2, overrides: 0 });
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockValidator.addSchema).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledTimes(2);

    // Verify the error for the null dataSchema
    const expectedErrorMsg1 = `Invalid 'dataSchema' for component '${validId}' in '${filenameNullSchema}'. Expected object, received null.`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        filename: filenameNullSchema,
        error: expectedErrorMsg1,
      }),
      expect.any(Error)
    );

    // Verify the error for the string dataSchema
    const expectedErrorMsg2 = `Invalid 'dataSchema' for component '${validId}' in '${filenameStringSchema}'. Expected object, received string.`;
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        filename: filenameStringSchema,
        error: expectedErrorMsg2,
      }),
      expect.any(Error)
    );
  });
});
