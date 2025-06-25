// src/tests/services/componentLoader.override.test.js

// --- Imports (remain the same) ---
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ComponentLoader from '../../../src/loaders/componentLoader.js'; // Corrected import name
import { CORE_MOD_ID } from '../../../src/constants/core'; // Added base class import

// --- Mock Service Factories (remain the same) ---
// [Mocks omitted for brevity - use the ones provided]
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentBasePath: jest.fn(
    (registryKey) => `./data/mods/test-mod/${registryKey}`
  ),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'components') {
      return 'http://example.com/schemas/component.schema.json';
    }
    if (registryKey === 'game')
      return 'http://example.com/schemas/game.schema.json';
    if (registryKey === 'mod-manifest')
      return 'http://example.com/schemas/mod-manifest.schema.json';
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getWorldBasePath: jest.fn().mockReturnValue('worlds'),
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
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
    (modId) => `./data/mods/${modId}/mod-manifest.json`
  ),
  resolveGameConfigPath: jest.fn(() => './data/game.json'),
  resolveRulePath: jest.fn((filename) => `./data/system-rules/${filename}`),
  ...overrides,
});
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
const createMockSchemaValidator = (overrides = {}) => {
  const loadedSchemas = new Map();
  const schemaValidators = new Map();
  const mockValidator = {
    addSchema: jest.fn(async (schemaData, schemaId) => {
      if (loadedSchemas.has(schemaId)) {
        // console.warn(`Mock AddSchema Warning: Schema ${schemaId} already exists, potential issue if not removed first.`);
      }
      loadedSchemas.set(schemaId, schemaData);
      if (!schemaValidators.has(schemaId)) {
        const mockValidationFn = jest.fn((data) => ({
          isValid: true,
          errors: null,
        }));
        schemaValidators.set(schemaId, mockValidationFn);
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
      if (loadedSchemas.has(schemaId)) {
        return {
          isValid: false,
          errors: [
            {
              message: `Mock Schema Error: Schema data '${schemaId}' loaded but no validator function found.`,
            },
          ],
        };
      }
      return {
        isValid: false,
        errors: [
          {
            message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`,
          },
        ],
      };
    }),
    ...overrides,
  };
  mockValidator._getLoadedSchemaData = (schemaId) =>
    loadedSchemas.get(schemaId);
  mockValidator._setSchemaLoaded = (schemaId, schemaData = {}) => {
    loadedSchemas.set(schemaId, schemaData);
    if (!schemaValidators.has(schemaId)) {
      const mockValidationFn = jest.fn((data) => ({
        isValid: true,
        errors: null,
      }));
      schemaValidators.set(schemaId, mockValidationFn);
    }
  };
  mockValidator.mockValidatorFunction = (schemaId, implementation) => {
    if (!schemaValidators.has(schemaId)) {
      mockValidator._setSchemaLoaded(schemaId, {});
    }
    if (!schemaValidators.has(schemaId)) {
      const mockValidationFn = jest.fn((data) => ({
        isValid: true,
        errors: null,
      }));
      schemaValidators.set(schemaId, mockValidationFn);
    }
    schemaValidators.get(schemaId).mockImplementation(implementation);
  };
  return mockValidator;
};
const createMockDataRegistry = (overrides = {}) => {
  const registryData = new Map();
  return {
    store: jest.fn((type, id, data) => {
      // console.log(`DEBUG: MockRegistry store called with type='${type}', id='${id}'`); // Added debug log
      if (!registryData.has(type)) {
        registryData.set(type, new Map());
      }
      registryData.get(type).set(id, JSON.parse(JSON.stringify(data))); // Deep copy
    }),
    get: jest.fn((type, id) => {
      const typeMap = registryData.get(type);
      const data = typeMap?.get(id);
      // console.log(`DEBUG: MockRegistry get called with type='${type}', id='${id}'. Found: ${data !== undefined}`); // Added debug log
      return data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined; // Deep copy
    }),
    getAll: jest.fn((type) => {
      const typeMap = registryData.get(type);
      return typeMap
        ? Array.from(typeMap.values()).map((d) => JSON.parse(JSON.stringify(d)))
        : [];
    }),
    _getData: (type, id) => {
      const typeMap = registryData.get(type);
      return typeMap?.get(id);
    },
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
const createMockLogger = (overrides = {}) => ({
  info: jest.fn(console.log),
  warn: jest.fn(console.warn),
  error: jest.fn(console.error),
  debug: jest.fn(console.log),
  ...overrides,
});
const createMockComponentDefinition = (
  id,
  dataSchema = { type: 'object', properties: {} },
  description = ''
) => ({
  id: id,
  dataSchema: dataSchema,
  ...(description && { description: description }),
});
const createMockModManifest = (modId, componentFiles = []) => ({
  id: modId,
  name: `Mock Mod ${modId}`,
  version: '1.0.0',
  content: { components: componentFiles },
});

// --- Test Suite ---

describe('ComponentLoader (Sub-Ticket 6.3: Override Behavior)', () => {
  // --- Declare Mocks & Loader ---
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let loader;

  // --- Shared Test Data ---
  const sharedComponentIdFromFile = 'shared:position';
  const baseComponentId = 'position';
  const fooModId = 'foo';
  const sharedFilename = 'position.component.json';
  const componentDefSchemaId =
    'http://example.com/schemas/component.schema.json';
  const registryCategory = 'components';
  const coreQualifiedId = `${CORE_MOD_ID}:${baseComponentId}`;
  const fooQualifiedId = `${fooModId}:${baseComponentId}`;
  const coreSharedPositionPath = `./data/mods/core/components/${sharedFilename}`;

  // Constants for ComponentLoader specific arguments
  const COMPONENT_CONTENT_KEY = 'components';
  const COMPONENT_CONTENT_DIR = 'components';
  const COMPONENT_TYPE_NAME = 'components';

  const coreSharedPositionDef = createMockComponentDefinition(
    sharedComponentIdFromFile,
    {
      type: 'object',
      properties: { x: {}, y: {} },
      required: ['x', 'y'],
    },
    'Core Position Definition'
  );
  const coreManifest = createMockModManifest(CORE_MOD_ID, [sharedFilename]);
  const fooSharedPositionPath = `./data/mods/foo/components/${sharedFilename}`;
  const fooSharedPositionDefFromFileData = createMockComponentDefinition(
    sharedComponentIdFromFile, // Raw ID from file
    {
      type: 'object',
      properties: { fooX: {}, fooY: {} },
      required: ['fooX', 'fooY'],
    },
    'Foo Position Definition (Override)'
  );
  const fooManifest = createMockModManifest(fooModId, [sharedFilename]);

  // --- Setup ---
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Setup mockRegistry.store to actually store items for this test's override logic
    const internalRegistry = new Map();
    mockRegistry.store.mockImplementation((category, key, data) => {
      if (!internalRegistry.has(category)) {
        internalRegistry.set(category, new Map());
      }
      const didOverride = internalRegistry.get(category).has(key);
      internalRegistry.get(category).set(key, JSON.parse(JSON.stringify(data))); // Store a copy
      return didOverride; // Return true if it overrode, false otherwise
    });
    mockRegistry.get.mockImplementation((category, key) => {
      const catMap = internalRegistry.get(category);
      return catMap ? JSON.parse(JSON.stringify(catMap.get(key))) : undefined;
    });

    loader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // Ensure the primary schema for components is "loaded"
    mockValidator._setSchemaLoaded(componentDefSchemaId, {});
    // Clear mocks that might have been called during instantiation by base classes
    jest.clearAllMocks();

    // Spy on _storeItemInRegistry to verify its arguments precisely
    // jest.spyOn(loader, '_storeItemInRegistry'); // Already a spy via BaseManifestItemLoader tests

    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) =>
      registryKey === registryCategory ? componentDefSchemaId : undefined
    );
    mockValidator._setSchemaLoaded(componentDefSchemaId, { type: 'object' });
    mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({
      isValid: true,
      errors: null,
    }));

    mockFetcher.fetch.mockImplementation(async (path) => {
      if (path === coreSharedPositionPath)
        return JSON.parse(JSON.stringify(coreSharedPositionDef));
      if (path === fooSharedPositionPath)
        return JSON.parse(JSON.stringify(fooSharedPositionDefFromFileData));
      throw new Error(
        `Mock Fetch Error: Unexpected fetch call for path: ${path}`
      );
    });

    mockResolver.resolveModContentPath.mockImplementation(
      (modId, registryKey, filename) => {
        if (
          modId === CORE_MOD_ID &&
          registryKey === registryCategory &&
          filename === sharedFilename
        )
          return coreSharedPositionPath;
        if (
          modId === fooModId &&
          registryKey === registryCategory &&
          filename === sharedFilename
        )
          return fooSharedPositionPath;
        throw new Error(
          `Mock PathResolver Error: Unexpected resolveModContentPath call: ${modId}, ${registryKey}, ${filename}`
        );
      }
    );
  });

  // --- Test Case ---
  it('should override component definition and schema from a later mod', async () => {
    // --- Arrange ---
    // Configure Fetcher for this specific test
    mockFetcher = createMockDataFetcher({
      [coreSharedPositionPath]: coreSharedPositionDef,
      [fooSharedPositionPath]: fooSharedPositionDefFromFileData,
    });
    loader._dataFetcher = mockFetcher; // Inject the configured fetcher

    const coreManifest = createMockModManifest(CORE_MOD_ID, [sharedFilename]);
    const fooManifest = createMockModManifest(fooModId, [sharedFilename]);

    // Expected stored object for the core mod's component
    const expectedStoredCoreObject = {
      id: baseComponentId, // Base ID
      _fullId: coreQualifiedId, // Qualified ID
      _modId: CORE_MOD_ID,
      _sourceFile: sharedFilename,
      dataSchema: coreSharedPositionDef.dataSchema,
      description: coreSharedPositionDef.description,
      // The id 'shared:position' from coreSharedPositionDefFromFileData should NOT be here
    };

    // Expected stored object for the foo mod's component (the override)
    const expectedStoredFooObject = {
      id: baseComponentId, // Base ID
      _fullId: fooQualifiedId, // Qualified ID
      _modId: fooModId,
      _sourceFile: sharedFilename,
      dataSchema: fooSharedPositionDefFromFileData.dataSchema,
      description: fooSharedPositionDefFromFileData.description,
      // The id 'shared:position' from fooSharedPositionDefFromFileData should NOT be here
    };

    // --- Act ---
    // Load core mod's component
    const coreLoadResult = await loader.loadItemsForMod(
      CORE_MOD_ID,
      coreManifest,
      COMPONENT_CONTENT_KEY,
      COMPONENT_CONTENT_DIR,
      COMPONENT_TYPE_NAME
    );

    // --- Assert Core Load ---
    expect(coreLoadResult.count).toBe(1);
    expect(coreLoadResult.errors).toBe(0);
    expect(coreLoadResult.overrides).toBe(0); // First load, no override

    expect(mockRegistry.store).toHaveBeenCalledTimes(1);
    expect(mockRegistry.store).toHaveBeenCalledWith(
      registryCategory,
      coreQualifiedId, // Stored with fully qualified ID as key
      expect.objectContaining(expectedStoredCoreObject)
    );

    // Load foo mod's component (should override)
    const fooLoadResult = await loader.loadItemsForMod(
      fooModId,
      fooManifest,
      COMPONENT_CONTENT_KEY,
      COMPONENT_CONTENT_DIR,
      COMPONENT_TYPE_NAME
    );

    // --- Assert Foo Load (Override) ---
    expect(fooLoadResult.count).toBe(1);
    expect(fooLoadResult.errors).toBe(0);
    // Because 'core:position' and 'foo:position' are different keys, no override occurs.
    expect(fooLoadResult.overrides).toBe(0);

    expect(mockRegistry.store).toHaveBeenCalledTimes(2); // Called again for foo mod
    expect(mockRegistry.store).toHaveBeenLastCalledWith(
      registryCategory,
      fooQualifiedId, // Stored with fully qualified ID as key
      expect.objectContaining(expectedStoredFooObject)
    );

    // After refactor, schema registration logs a warning when an inline schema
    // with the same ID is already loaded.
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Component Definition '${sharedFilename}' in mod '${fooModId}' is overwriting an existing data schema for component ID 'shared:position'.`
    );

    // Verify the final state in the registry (optional, but good for sanity)
    const finalStoredItem = mockRegistry.get(registryCategory, fooQualifiedId); // Foo's item should be there
    expect(finalStoredItem).toBeDefined();
    expect(finalStoredItem.id).toBe(baseComponentId);
    expect(finalStoredItem._fullId).toBe(fooQualifiedId);
    expect(finalStoredItem._modId).toBe(fooModId);
    expect(finalStoredItem.dataSchema).toEqual(
      fooSharedPositionDefFromFileData.dataSchema
    );

    // Since the keys are different, the core item should still exist independently.
    const coreItemShouldStillExist = mockRegistry.get(
      registryCategory,
      coreQualifiedId
    );
    expect(coreItemShouldStillExist).toBeDefined();
    expect(coreItemShouldStillExist._modId).toBe(CORE_MOD_ID);
  });
});
