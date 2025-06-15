// src/tests/services/componentDefinitionLoader.ioErrors.test.js

// --- Imports ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ComponentLoader from '../../src/loaders/componentLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Keep as they are) ---
// ... (createMockConfiguration, createMockPathResolver, etc. - NO CHANGES NEEDED HERE based on provided errors) ...

/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../src/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'components') {
      return 'http://example.com/schemas/component-definition.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'), // Already added from previous fix
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
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../src/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, typeName, filename) =>
      `./data/mods/${modId}/${typeName}/${filename}`
  ),
  resolveContentPath: jest.fn(
    (typeName, filename) => `./data/${typeName}/${filename}`
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
 * @param {object} [pathToResponse] - Map of path strings to successful response data.
 * @param {string[]} [errorPaths] - List of paths that should trigger a rejection.
 * @returns {import('../../src/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
  fetch: jest.fn(async (path) => {
    if (errorPaths.includes(path)) {
      // Throw error to simulate real fetch failure
      throw new Error(`Mock Fetch Error: Failed to fetch ${path}`);
    }
    if (path in pathToResponse) {
      // Deep clone to prevent tests from modifying the mock response object
      return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
    }
    // Simulate file not found by throwing an error
    throw new Error(`Mock Fetch Error: 404 Not Found for ${path}`);
  }),
});

/**
 * Creates a mock ISchemaValidator service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../src/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();

  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      loadedSchemas.set(schemaId, schemaData);
      // Ensure a mock validator function exists, default to valid
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn((data) => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      const deletedSchemas = loadedSchemas.delete(schemaId);
      const deletedValidators = schemaValidators.delete(schemaId);
      return deletedSchemas || deletedValidators; // Return true if either was present
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (validatorFn) return validatorFn(data);
      return {
        isValid: false,
        errors: [
          { message: `Mock Schema Error: Schema '${schemaId}' not found.` },
        ],
      };
    }),
    // Helper to simulate schema loading for tests
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, schemaData);
        if (!schemaValidators.has(schemaId)) {
          // Ensure a validator function exists, default to valid
          const mockValidationFn = jest.fn((data) => ({
            isValid: true,
            errors: null,
          }));
          schemaValidators.set(schemaId, mockValidationFn);
        }
      }
    },
    // Helper to allow tests to customize validator behavior
    mockValidatorFunction: (schemaId, implementation) => {
      if (!schemaValidators.has(schemaId)) {
        // If schema wasn't explicitly loaded, add it now
        loadedSchemas.set(schemaId, {}); // Add placeholder data
      }
      const mockFn = jest.fn(implementation);
      schemaValidators.set(schemaId, mockFn); // Overwrite or set the mock function
    },
    ...overrides,
  };
  return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../src/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
  const registryData = new Map();
  return {
    store: jest.fn((type, id, data) => {
      if (!registryData.has(type)) registryData.set(type, new Map());
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
 * @returns {import('../../src/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.7: Path/Fetch Errors)', () => {
  // --- Declare Mocks & Loader ---
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let loader;

  // --- Shared Test Data ---
  const modId = 'ioErrorMod';
  const filename = 'file.component.json';
  const errorManifest = createMockModManifest(modId, [filename]); // Manifest with one file
  const componentDefinitionSchemaId =
    'http://example.com/schemas/component-definition.schema.json';

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    // Instantiate mocks
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Instantiate loader
    loader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Common setup - Ensure component definition schema ID is known
    mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
      if (typeName === 'components') {
        return componentDefinitionSchemaId; // Use defined constant
      }
      return undefined;
    });

    // Simulate the main schema being loaded and validator available
    mockValidator._setSchemaLoaded(componentDefinitionSchemaId, {});
    mockValidator.mockValidatorFunction(
      componentDefinitionSchemaId,
      (data) => ({ isValid: true, errors: null })
    );
  });

  // --- Test Case: Scenario 1 (Path Resolution Failure) ---
  it('should handle errors during path resolution', async () => {
    // --- Setup: Scenario 1 ---
    const pathError = new Error(
      `Mock Path Error: Could not resolve path for ${filename}`
    );
    mockResolver.resolveModContentPath.mockImplementation(
      (mId, type, fName) => {
        if (mId === modId && type === 'components' && fName === filename) {
          throw pathError;
        }
        return `./data/mods/${mId}/${type}/${fName}`; // Fallback
      }
    );

    // --- Action ---
    const loadPromise = loader.loadItemsForMod(
      modId, // modId
      errorManifest, // modManifest
      'components', // contentKey
      'components', // contentTypeDir
      'components' // typeName
    );

    // --- Verify: Promise Resolves & Result Object ---
    await expect(loadPromise).resolves.not.toThrow();
    const result = await loadPromise;
    expect(result).toEqual({ count: 0, errors: 1, overrides: 0 });

    // --- Verify: No Fetch/Store/Schema Add ---
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockValidator.addSchema).not.toHaveBeenCalled();

    // --- Verify: Error Logs ---
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        modId: modId,
        filename: filename,
        path: 'Path not resolved',
        typeName: 'components',
        error: pathError.message,
      }),
      pathError
    );

    // --- Verify: Final Summary Log ---
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and summary
    expect(mockLogger.info).toHaveBeenCalledWith(
      `ComponentLoader: Loading components definitions for mod '${modId}'.` // Initial log
    );
    // <<< CORRECTION: Match the actual received log format >>>
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // --- Verify Other Interactions ---
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      'components',
      filename
    );
    expect(mockValidator.validate).not.toHaveBeenCalled();
  });

  // --- Test Case: Scenario 2 (Fetch Failure) ---
  it('should handle errors during data fetching', async () => {
    // --- Setup: Scenario 2 ---
    const filePath = `./data/mods/${modId}/components/${filename}`;
    const fetchError = new Error(
      `Mock Fetch Error: Failed to fetch ${filePath}`
    );

    // Path resolution succeeds
    mockResolver.resolveModContentPath.mockImplementation(
      (mId, type, fName) => {
        if (mId === modId && type === 'components' && fName === filename) {
          return filePath;
        }
        return `./data/mods/${mId}/${type}/${fName}`;
      }
    );

    // Fetching fails (throws error)
    mockFetcher.fetch.mockImplementation(async (path) => {
      if (path === filePath) {
        throw fetchError;
      }
      throw new Error(`Unexpected fetch call: ${path}`); // Fallback
    });

    // --- Action ---
    const loadPromise = loader.loadItemsForMod(
      modId, // modId
      errorManifest, // modManifest
      'components', // contentKey
      'components', // contentTypeDir
      'components' // typeName
    );

    // --- Verify: Promise Resolves & Result Object ---
    await expect(loadPromise).resolves.not.toThrow();
    const result = await loadPromise;
    expect(result).toEqual({ count: 0, errors: 1, overrides: 0 });

    // --- Verify: No Store/Schema Add ---
    expect(mockRegistry.store).not.toHaveBeenCalled();
    expect(mockValidator.addSchema).not.toHaveBeenCalled();

    // --- Verify: Error Logs ---
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error processing file:',
      expect.objectContaining({
        modId: modId,
        filename: filename,
        path: filePath,
        typeName: 'components',
        error: fetchError.message,
      }),
      fetchError
    );

    // --- Verify: Final Summary Log ---
    expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and summary
    expect(mockLogger.info).toHaveBeenCalledWith(
      `ComponentLoader: Loading components definitions for mod '${modId}'.` // Initial log
    );
    // <<< CORRECTION: Match the actual received log format >>>
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // --- Verify Other Interactions ---
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
    expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(
      modId,
      'components',
      filename
    );
    expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
    expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
    expect(mockValidator.validate).not.toHaveBeenCalled();
  });
});
