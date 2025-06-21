// src/tests/services/componentLoader.happyPath.core.test.js

import ComponentLoader from '../../../src/loaders/componentLoader.js'; // Corrected path based on project structure
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { CORE_MOD_ID } from '../../../src/constants/core'; // Import Jest utilities

/**
 * @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../../src/interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('../../../src/interfaces/coreServices.js').ModManifest} ModManifest
 */

// --- Mock Service Factories (Keep these as they are, they are utility functions) ---

/**
 * Creates a mock IConfiguration service.
 *
 * @param {object} [overrides] - Optional overrides for mock methods.
 * @returns {import('../../../src/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentBasePath: jest.fn((registryKey) => `./data/mods/test-mod/${registryKey}`),
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
  resolveSchemaPath: jest.fn(),
  resolveRulePath: jest.fn(),
  resolveGameConfigPath: jest.fn(),
  resolveModManifestPath: jest.fn(),
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
      // Ensure a deep copy to prevent tests modifying shared mock data
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
      loadedSchemas.set(schemaId, schemaData);
      // Ensure a mock validator function exists if not already present
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
      }
    }),
    removeSchema: jest.fn((schemaId) => {
      const deletedValidator = schemaValidators.delete(schemaId);
      const deletedSchema = loadedSchemas.delete(schemaId);
      return deletedValidator && deletedSchema; // Return true only if both were present and deleted
    }),
    isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
    getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
    validate: jest.fn((schemaId, data) => {
      const validatorFn = schemaValidators.get(schemaId);
      if (validatorFn) {
        // Use the specifically mocked function if available
        return validatorFn(data);
      }
      // Default behavior if schema exists but no specific mock function: pass validation
      if (loadedSchemas.has(schemaId)) {
        return { isValid: true, errors: null };
      }
      // If schema genuinely not found/loaded
      return {
        isValid: false,
        errors: [
          { message: `Mock Schema Error: Schema '${schemaId}' not found.` },
        ],
      };
    }),
    // Helper to configure specific validator function behavior
    mockValidatorFunction: (schemaId, implementation) => {
      const mockFn = jest.fn(implementation);
      schemaValidators.set(schemaId, mockFn);
      // Mark schema as loaded if mocking its function
      if (!loadedSchemas.has(schemaId)) {
        loadedSchemas.set(schemaId, {});
      }
    },
    // Helper to simulate schema loading for tests
    _setSchemaLoaded: (schemaId, schemaData = {}) => {
      loadedSchemas.set(schemaId, schemaData);
      // Ensure a default validator function exists if setting as loaded
      if (!schemaValidators.has(schemaId)) {
        schemaValidators.set(
          schemaId,
          jest.fn(() => ({ isValid: true, errors: null }))
        );
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
      if (!registryData.has(type)) registryData.set(type, new Map());
      registryData.get(type).set(id, JSON.parse(JSON.stringify(data))); // Store deep copy
    }),
    get: jest.fn((type, id) => {
      const typeMap = registryData.get(type);
      return typeMap?.has(id)
        ? JSON.parse(JSON.stringify(typeMap.get(id)))
        : undefined; // Return deep copy
    }),
    getAll: jest.fn((type) => {
      const typeMap = registryData.get(type);
      return typeMap
        ? Array.from(typeMap.values()).map((d) => JSON.parse(JSON.stringify(d)))
        : []; // Return deep copies
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
    getComponentDefinition: jest.fn(), // Keep this generic one for testing get
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

// Describe block using the correct path
describe('ComponentLoader (Happy Path - Core Mod)', () => {
  // --- Declare variables for mocks and loader ---
  let mockConfig;
  let mockResolver;
  let mockFetcher;
  let mockValidator;
  let mockRegistry;
  let mockLogger;
  let componentLoader; // Changed variable name for clarity

  // --- Define mock component data ---
  const coreHealthFilename = 'core_health.component.json';
  const corePositionFilename = 'core_position.component.json';
  // Paths derived from mockResolver implementation
  const coreHealthPath =
    './data/mods/core/components/core_health.component.json';
  const corePositionPath =
    './data/mods/core/components/core_position.component.json';

  // IDs as they appear *in the file*
  const coreHealthIdFromFile = 'core:health';
  const corePositionIdFromFile = 'core:position';

  // Base IDs (extracted)
  const coreHealthBaseId = 'health';
  const corePositionBaseId = 'position';

  // Final, correctly prefixed IDs for registry storage/retrieval
  const coreHealthFinalId = 'core:health';
  const corePositionFinalId = 'core:position';

  const coreHealthDef = {
    id: coreHealthIdFromFile, // Use ID from file
    description: 'Manages the health points of an entity.',
    dataSchema: {
      type: 'object',
      properties: { current: { type: 'integer' }, max: { type: 'integer' } },
      required: ['current', 'max'],
    },
  };
  const corePositionDef = {
    id: corePositionIdFromFile, // Use ID from file
    description: 'Tracks the location of an entity in 3D space.',
    dataSchema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        z: { type: 'number' },
      },
      required: ['x', 'y', 'z'],
    },
  };

  // --- Define the CORE_MOD_ID mod manifest ---
  const mockCoreManifest = {
    id: CORE_MOD_ID,
    name: 'Core Content',
    version: '1.0.0',
    content: { components: [coreHealthFilename, corePositionFilename] },
  };

  // --- Define schema IDs ---
  const componentDefinitionSchemaId =
    'http://example.com/schemas/component.schema.json';

  beforeEach(() => {
    // --- Setup: Instantiate Mocks ---
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    // Configure mockFetcher with the paths and data
    mockFetcher = createMockDataFetcher({
      [coreHealthPath]: coreHealthDef,
      [corePositionPath]: corePositionDef,
    });
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // --- Setup: Configure Mock Implementations ---

    // Config: Ensure it returns the correct schema ID for 'components'
    mockConfig.getContentTypeSchemaId.mockImplementation((registryKey) => {
      if (registryKey === 'components') return componentDefinitionSchemaId;
      return `http://example.com/schemas/${registryKey}.schema.json`;
    });

    // Resolver: Ensure it returns the expected paths (already done by default mock, but explicit is ok too)
    mockResolver.resolveModContentPath.mockImplementation(
      (modId, diskFolder, filename) => {
        if (modId === CORE_MOD_ID && diskFolder === 'components') {
          if (filename === coreHealthFilename) return coreHealthPath;
          if (filename === corePositionFilename) return corePositionPath;
        }
        // Fallback for unexpected calls, helps debugging
        return `./data/mods/${modId}/${diskFolder}/${filename}`;
      }
    );

    // Fetcher: Already configured via createMockDataFetcher above.

    // Validator: Ensure the *primary* component definition schema is marked as loaded
    // This allows the base class's _validatePrimarySchema to succeed.
    mockValidator._setSchemaLoaded(componentDefinitionSchemaId);

    // Registry: The default mock registry starts empty, which is correct.
    // We will spy on the `store` method later.

    // --- Setup: Instantiate Loader ---
    componentLoader = new ComponentLoader(
      mockConfig,
      mockResolver,
      mockFetcher,
      mockValidator,
      mockRegistry,
      mockLogger
    );

    // --- Setup: Spy on methods for verification ---
    // Spy on the internal storage helper (part of the base class, accessed via instance)
    // We mock its implementation *here* to verify it's called correctly by _processFetchedItem
    // and to simulate the effect on the actual mockRegistry.
    jest
      .spyOn(componentLoader, '_storeItemInRegistry')
      .mockImplementation((category, modId, baseId, data, filename) => {
        const finalId = `${modId}:${baseId}`;
        const storedData = {
          ...data,
          id: finalId,
          modId: modId,
          _sourceFile: filename,
        };
        mockRegistry.store(category, finalId, storedData);
        return { qualifiedId: finalId, didOverride: false };
      });

    // Spy on the base validation method. We *expect* this to be called by the base wrapper.
    jest.spyOn(componentLoader, '_validatePrimarySchema');

    // Spy on the actual registry store method to verify the final data stored by the mock _storeItemInRegistry
    jest.spyOn(mockRegistry, 'store');

    // Spy on schema validator methods to check interactions
    jest.spyOn(mockValidator, 'addSchema');
    jest.spyOn(mockValidator, 'removeSchema');
    jest.spyOn(mockValidator, 'isSchemaLoaded');
    jest.spyOn(mockValidator, 'validate'); // Spy on the actual validate method
  });

  test('should successfully load and register component definitions from the core mod', async () => {
    // --- Action ---
    // Call loadItemsForMod with all required arguments
    const promise = componentLoader.loadItemsForMod(
      CORE_MOD_ID, // modId
      mockCoreManifest, // modManifest
      'components', // contentKey
      'components', // diskFolder
      'components' // registryKey
    );

    // --- Verify: Promise Resolves & Result Object --- // <<< MODIFIED SECTION START
    await expect(promise).resolves.not.toThrow();
    const result = await promise; // Get the result object
    expect(result).toBeDefined();
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('overrides');
    expect(result.count).toBe(2); // Check the 'count' property
    expect(result.errors).toBe(0); // Explicitly check errors
    expect(result.overrides).toBe(0); // Explicitly check overrides (based on received value)
    // <<< MODIFIED SECTION END

    // --- Verify: Mock Calls ---

    // ** Verify _storeItemInRegistry (Base Helper) Call **
    // Check that _processFetchedItem correctly delegated storage to the base helper
    expect(componentLoader._storeItemInRegistry).toHaveBeenCalledTimes(2);
    expect(componentLoader._storeItemInRegistry).toHaveBeenCalledWith(
      'components',
      CORE_MOD_ID,
      coreHealthBaseId,
      coreHealthDef,
      coreHealthFilename
    );
    expect(componentLoader._storeItemInRegistry).toHaveBeenCalledWith(
      'components',
      CORE_MOD_ID,
      corePositionBaseId,
      corePositionDef,
      corePositionFilename
    );

    // ** Verify Registry Store (via mock _storeItemInRegistry's implementation) **
    // Check that the *actual* registry store was called by our spied/mocked _storeItemInRegistry
    expect(mockRegistry.store).toHaveBeenCalledTimes(2);
    // Data stored should have the FINAL correctly prefixed ID and metadata
    const expectedStoredHealth = {
      ...coreHealthDef,
      id: coreHealthFinalId,
      modId: CORE_MOD_ID,
      _sourceFile: coreHealthFilename,
    };
    const expectedStoredPosition = {
      ...corePositionDef,
      id: corePositionFinalId,
      modId: CORE_MOD_ID,
      _sourceFile: corePositionFilename,
    };
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'components',
      coreHealthFinalId,
      expectedStoredHealth
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'components',
      corePositionFinalId,
      expectedStoredPosition
    );

    // ** Verify Schema Validator addSchema **
    // Check that _processFetchedItem correctly registered the component's *dataSchema*
    expect(mockValidator.addSchema).toHaveBeenCalledTimes(2);
    // It should use the FULL ID from the file (e.g., "core:health") as the schema ID
    expect(mockValidator.addSchema).toHaveBeenCalledWith(
      coreHealthDef.dataSchema,
      coreHealthIdFromFile
    );
    expect(mockValidator.addSchema).toHaveBeenCalledWith(
      corePositionDef.dataSchema,
      corePositionIdFromFile
    );

    // --- Verify: Primary Schema Validation Check ---
    // Check that the base class wrapper (_processFileWrapper) *did* call the _validatePrimarySchema helper.
    // This confirms the primary validation step occurred as expected in the base class logic.
    expect(componentLoader._validatePrimarySchema).toHaveBeenCalledTimes(2); // <<< Keep assertion as is (it was likely correct)
    // Optionally, verify the arguments it was called with:
    expect(componentLoader._validatePrimarySchema).toHaveBeenCalledWith(
      coreHealthDef,
      coreHealthFilename,
      CORE_MOD_ID,
      coreHealthPath
    );
    expect(componentLoader._validatePrimarySchema).toHaveBeenCalledWith(
      corePositionDef,
      corePositionFilename,
      CORE_MOD_ID,
      corePositionPath
    );

    // --- Verify Other Interactions ---
    // Check that the *actual* schema validator's `validate` method WAS called (indirectly, via _validatePrimarySchema)
    // for the primary component definition schema.
    expect(mockValidator.validate).toHaveBeenCalledTimes(2);
    expect(mockValidator.validate).toHaveBeenCalledWith(
      componentDefinitionSchemaId,
      coreHealthDef
    );
    expect(mockValidator.validate).toHaveBeenCalledWith(
      componentDefinitionSchemaId,
      corePositionDef
    );

    // Check that removeSchema wasn't called (no overrides in this test)
    expect(mockValidator.removeSchema).not.toHaveBeenCalled();
    // Check isSchemaLoaded was called (by _processFetchedItem for override check, and by base _validatePrimarySchema)
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalled();
    // Check it was called for the primary schema (by _validatePrimarySchema in base class)
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      componentDefinitionSchemaId
    );
    // Check it was called for the data schema IDs (by _processFetchedItem in subclass)
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      coreHealthIdFromFile
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      corePositionIdFromFile
    );

    // --- Verify: ILogger Calls ---
    // Check standard logging flow
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(`Loading components definitions for mod 'core'.`)
    ); // Start log from loadItemsForMod
    const expectedSuccessCount = 2; // Use the count from the result object for consistency
    expect(mockLogger.info).toHaveBeenCalledWith(
      // Use the result.count from the actual execution
      expect.stringContaining(
        `Mod [core] - Processed ${result.count}/${expectedSuccessCount} components items.`
      ) // Summary log from _loadItemsInternal
    );

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
