// src/tests/services/componentLoader.registryStoreFailure.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ComponentLoader from '../../../src/loaders/componentLoader.js'; // Using the correct class name

// --- Mock Service Factories ---
// Assume factories are present and correct as provided before
/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentBasePath: jest.fn(
    (registryKey) => `./data/mods/test-mod/${registryKey}`
  ),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'components') {
      return 'http://example.com/schemas/component.schema.json';
    }
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
  ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
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
    (modId) => `./data/mods/${modId}/mod-manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 *
 * @param {object} [pathToResponse] - Map of path strings to successful response data.
 * @param {string[]} [errorPaths] - List of paths that should trigger a rejection.
 * @returns {import('../../../src/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path)) {
      return Promise.reject(
        new Error(`Mock Fetch Error: Failed to fetch ${path}`)
      );
    }
    if (path in pathToResponse) {
      // Deep clone to prevent tests from modifying the mock response object
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
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();

  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      // Default behavior: succeed unless overridden
      if (loadedSchemas.has(schemaId)) {
        // Simulating Ajv behavior: don't overwrite silently
        // throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
        console.warn(
          `Mock Schema Warning: Schema with ID '${schemaId}' already exists, simulating addSchema failure.`
        );
        throw new Error(
          `Mock Schema Error: Schema with ID '${schemaId}' already exists.`
        );
      }
      loadedSchemas.set(schemaId, schemaData);
      const mockValidationFn = jest.fn((data) => ({
        isValid: true,
        errors: null,
      }));
      schemaValidators.set(schemaId, mockValidationFn);
    }),
    removeSchema: jest.fn((schemaId) => {
      // Default behavior: succeed if schema exists, unless overridden
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
      // Simulate schema validation failure if not found
      // console.warn(`Mock Schema Validator: No validator function found for schema '${schemaId}'. Simulating validation failure.`);
      return {
        isValid: false,
        errors: [
          {
            message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`,
          },
        ],
      };
    }),
    // Helper to configure validator behavior
    mockValidatorFunction: (schemaId, implementation) => {
      if (schemaValidators.has(schemaId)) {
        schemaValidators.get(schemaId).mockImplementation(implementation);
      } else {
        const newMockFn = jest.fn(implementation);
        schemaValidators.set(schemaId, newMockFn);
      }
    },
    // Helper to simulate schema loading for tests
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, schemaData);
        if (!schemaValidators.has(schemaId)) {
          const mockValidationFn = jest.fn((data) => ({
            isValid: true,
            errors: null,
          }));
          schemaValidators.set(schemaId, mockValidationFn);
        }
      }
    },
    // Helper to check internal state
    _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
  const registryData = new Map();
  return {
    store: jest.fn((type, id, data) => {
      // Default: succeed unless overridden
      if (!registryData.has(type)) {
        registryData.set(type, new Map());
      }
      registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
    }),
    get: jest.fn((type, id) => {
      const typeMap = registryData.get(type);
      return typeMap?.has(id)
        ? JSON.parse(JSON.stringify(typeMap.get(id)))
        : undefined;
    }),
    getAll: jest.fn((type) => {
      const typeMap = registryData.get(type);
      return typeMap
        ? Array.from(typeMap.values()).map((d) => JSON.parse(JSON.stringify(d)))
        : [];
    }),
    _getData: (type, id) => registryData.get(type)?.get(id),
    _prepopulate: (type, id, data) => {
      if (!registryData.has(type)) registryData.set(type, new Map());
      registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
    },
    clear: jest.fn(() => registryData.clear()),
    getAllSystemRules: jest.fn().mockReturnValue([]),
    getManifest: jest.fn().mockReturnValue(null),
    setManifest: jest.fn(),
    getEntityDefinition: jest.fn(),
    getItemDefinition: jest.fn(),
    getLocationDefinition: jest.fn(),
    getConnectionDefinition: jest.fn(),
    getBlockerDefinition: jest.fn(),
    getActionDefinition: jest.fn(),
    getEventDefinition: jest.fn(),
    getComponentDefinition: jest.fn(),
    getAllEntityDefinitions: jest.fn().mockReturnValue([]),
    getAllItemDefinitions: jest.fn().mockReturnValue([]),
    getAllLocationDefinitions: jest.fn().mockReturnValue([]),
    getAllConnectionDefinitions: jest.fn().mockReturnValue([]),
    getAllBlockerDefinitions: jest.fn().mockReturnValue([]),
    getAllActionDefinitions: jest.fn().mockReturnValue([]),
    getAllEventDefinitions: jest.fn().mockReturnValue([]),
    getAllComponentDefinitions: jest.fn().mockReturnValue([]),
    getStartingPlayerId: jest.fn().mockReturnValue(null),
    getStartingLocationId: jest.fn().mockReturnValue(null),
    ...overrides,
  };
};

/**
 * Creates a mock ILogger service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger} Mocked logger service.
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
 * @param {string} id
 * @param {object} [dataSchema]
 * @param {string} [description]
 * @returns {object}
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
 * @param {string} modId
 * @param {string[]} [componentFiles]
 * @returns {object}
 */
const createMockModManifest = (modId, componentFiles = []) => ({
  id: modId,
  name: `Mock Mod ${modId}`,
  version: '1.0.0',
  content: {
    components: componentFiles,
  },
});

// --- Test Suite ---

describe('ComponentLoader (Sub-Ticket 6.9: Registry Storage Failure)', () => {
  // --- Declare Mocks & Loader ---
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let loader; // Correct type: ComponentLoader

  // --- Shared Test Data ---
  const modId = 'storeFailMod';
  const filename = 'comp_store_fail.component.json';
  const filePath = `./data/mods/${modId}/components/${filename}`;

  // ***** CORRECTED ID HANDLING *****
  // ID as it appears *in the file* (assuming convention modId:baseId)
  const componentIdFromFile = `${modId}:store_fail`;
  // Extracted Base ID
  const baseComponentId = 'store_fail';
  // Final registry key (modId:baseId)
  const finalRegistryKey = `${modId}:${baseComponentId}`; // = "storeFailMod:store_fail"

  const componentDefSchemaId =
    'http://example.com/schemas/component.schema.json';
  // Use ID from file when creating the mock definition data
  const validDef = createMockComponentDefinition(componentIdFromFile, {
    type: 'object',
    properties: { status: { type: 'string', enum: ['ok', 'error'] } },
  });
  const manifest = createMockModManifest(modId, [filename]);
  const storageError = new Error(
    'Mock Registry Error: Database connection lost'
  );

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    // Instantiate the correct loader
    loader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Configure Mocks
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === 'components' ? componentDefSchemaId : undefined
    );
    mockResolver.resolveModContentPath.mockImplementation((mId, type, fName) =>
      mId === modId && type === 'components' && fName === filename
        ? filePath
        : `unexpected`
    );
    // Fetch returns the definition with the ID from the file
    mockFetcher.fetch.mockImplementation(async (path) =>
      path === filePath
        ? JSON.parse(JSON.stringify(validDef))
        : Promise.reject(`Unexpected fetch: ${path}`)
    );

    // Validator mocks
    mockValidator._setSchemaLoaded(componentDefSchemaId, {});
    mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({
      isValid: true,
      errors: null,
    }));
    // Schema check/add use the ID *from the file*
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) =>
      schemaId === componentIdFromFile ? false : true
    );
    mockValidator.addSchema.mockImplementation(async (schema, schemaId) => {
      if (schemaId === componentIdFromFile) return undefined;
      throw new Error(`Unexpected addSchema call: ${schemaId}`);
    });
    mockValidator.removeSchema.mockReturnValue(false); // Assume schema doesn't exist to be removed (not relevant here)

    // Configure Store to Fail using the *final registry key*
    mockRegistry.store.mockImplementation((type, id) => {
      if (type === 'components' && id === finalRegistryKey) {
        throw storageError;
      }
    });
  });

  // --- Test Case ---
  it('should handle errors during registry storage', async () => {
    // --- Action ---
    const loadPromise = loader.loadItemsForMod(
      modId, // 'storeFailMod'
      manifest, // The mock manifest
      'components', // contentKey
      'components', // diskFolder
      'components' // registryKey
    );

    // --- Verify: Promise Resolves & Result Object --- <<<< CORRECTED VERIFICATION
    await expect(loadPromise).resolves.not.toThrow();
    const result = await loadPromise; // Get the result object

    // Check the structure and values of the result object
    expect(result).toEqual({
      count: 0, // 0 items successfully processed
      errors: 1, // 1 error occurred (storage failed)
      overrides: 0, // 0 overrides occurred
    });

    // --- Verify: Pre-Storage Steps Succeeded ---
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      'components',
      filename
    );
    expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      componentDefSchemaId,
      validDef
    );
    // Schema check/add use ID from file
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      componentIdFromFile
    );
    expect(mockValidator.addSchema).toHaveBeenCalledWith(
      validDef.dataSchema,
      componentIdFromFile
    );

    // --- Verify: Storage Attempt and Failure ---
    // Store uses final key
    const expectedStoredObject = {
      ...validDef,
      id: baseComponentId, // ID in stored object is the base ID
      modId: modId,
      _sourceFile: filename,
      _fullId: finalRegistryKey,
    };
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'components',
      finalRegistryKey,
      expectedStoredObject
    );

    // --- Verify: Error Logs ---
    // With the refactor, the error from storage is caught and logged by the wrapper
    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    // Verify the error logged by _processFileWrapper
    const expectedWrapperErrorMessage = `Error processing file:`;
    const expectedWrapperDetailsObject = expect.objectContaining({
      modId: modId,
      filename: filename,
      path: filePath,
      registryKey: 'components',
      error: storageError.message,
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedWrapperErrorMessage,
      expectedWrapperDetailsObject,
      storageError // Passes original error object
    );

    // --- Verify: Final Summary Log ---
    // The log message correctly reflects the counts from the returned object
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
