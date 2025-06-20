// Filename: src/tests/loaders/entityLoader.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import EntityDefinitionLoader from '../../../src/loaders/entityDefinitionLoader.js'; // Adjust path as needed
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js'; // Base class

// --- Mock Service Factories (Simplified and Corrected) ---
// Assume these factories (createMockConfiguration, etc.) are defined as provided in the original prompt

/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../../src/interfaces/coreServices.js').ValidationResult} ValidationResult */
// Assume these factories (createMockConfiguration, createMockPathResolver, etc.) are defined as before...

// --- Constants ---
const ENTITY_DEFINITION_SCHEMA_ID =
  'http://example.com/schemas/entity-definition.schema.json';
const TEST_MOD_ID = 'test-entity-mod';
const GENERIC_CONTENT_KEY = 'items'; // Example key in manifest.content
const GENERIC_CONTENT_DIR = 'items'; // Example directory name
const GENERIC_TYPE_NAME = 'items'; // Example type name passed to process/store
const COMPONENT_POSITION_ID = 'core:position';
const COMPONENT_HEALTH_ID = 'core:health';
const COMPONENT_SCHEMA_POSITION =
  'http://example.com/schemas/components/position.schema.json';
const COMPONENT_SCHEMA_HEALTH =
  'http://example.com/schemas/components/health.schema.json';

// ** SIMPLIFIED Mock Factory **
const createMockConfiguration = (overrides = {}) => {
  const config = {
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    // MODIFICATION: Ensure this mock handles 'entityDefinitions' (camelCase)
    getContentTypeSchemaId: jest.fn((typeName) => {
      // MODIFICATION: Changed from 'entity_definitions' to 'entityDefinitions'
      if (typeName === 'entityDefinitions') return ENTITY_DEFINITION_SCHEMA_ID;
      if (typeName === 'components') {
        // Example for component loading if needed
        if (overrides.componentSchemaId) return overrides.componentSchemaId;
        return `http://example.com/schemas/component.schema.json`; // Default component schema ID
      }
      // Allow specific overrides for other types if needed
      if (overrides.schemaIdMap && overrides.schemaIdMap[typeName]) {
        return overrides.schemaIdMap[typeName];
      }
      // Fallback for other types
      return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn((typeName) => `./data/${typeName}`),
  };
  // Apply overrides directly
  for (const key in overrides) {
    if (config.hasOwnProperty(key) && typeof config[key] === 'function') {
      if (typeof overrides[key] === 'function') {
        config[key] = overrides[key];
      } else {
        config[key].mockReturnValue(overrides[key]);
      }
    } else {
      config[key] = overrides[key];
    }
  }
  return config;
};

/**
 * Creates a mock IPathResolver service.
 *
 * @param overrides
 */
const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest
    .fn()
    .mockImplementation(
      (modId, typeName, filename) =>
        `./data/mods/${modId}/${typeName}/${filename}`
    ),
  resolveContentPath: jest
    .fn()
    .mockImplementation(
      (typeName, filename) => `./data/${typeName}/${filename}`
    ),
  resolveSchemaPath: jest
    .fn()
    .mockImplementation((filename) => `./data/schemas/${filename}`),
  resolveModManifestPath: jest
    .fn()
    .mockImplementation((modId) => `./data/mods/${modId}/mod.manifest.json`),
  resolveGameConfigPath: jest.fn().mockImplementation(() => './data/game.json'),
  resolveRulePath: jest
    .fn()
    .mockImplementation((filename) => `./data/system-rules/${filename}`),
  resolveManifestPath: jest
    .fn()
    .mockImplementation((worldName) => `./data/worlds/${worldName}.world.json`),
  ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 *
 * @param overrides
 */
const createMockDataFetcher = (overrides = {}) => ({
  fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
  ...overrides,
});

/**
 * Creates a mock ISchemaValidator service.
 *
 * @param overrides
 */
const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }), // Default to valid
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  // --- [LOADER-REFACTOR-04 Test Change]: Ensure components can be marked as loaded ---
  isSchemaLoaded: jest.fn().mockImplementation((schemaId) => {
    if (
      schemaId === ENTITY_DEFINITION_SCHEMA_ID ||
      schemaId === COMPONENT_POSITION_ID ||
      schemaId === COMPONENT_HEALTH_ID
    ) {
      return true;
    }
    // Allow overrides for specific schema IDs
    if (
      overrides.loadedSchemas &&
      overrides.loadedSchemas[schemaId] !== undefined
    ) {
      return overrides.loadedSchemas[schemaId];
    }
    return false; // Default to not loaded
  }),
  ...overrides,
});

/**
 * Creates a mock IDataRegistry service.
 *
 * @param overrides
 */
const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn().mockReturnValue(undefined), // Default to not finding existing items
  getAll: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  getAllSystemRules: jest.fn().mockReturnValue([]),
  getManifest: jest.fn().mockReturnValue(null),
  setManifest: jest.fn(),
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

// --- Shared Mocks Instance for Tests ---
/** @type {IConfiguration} */
let mockConfig;
/** @type {IPathResolver} */
let mockResolver;
/** @type {IDataFetcher} */
let mockFetcher;
/** @type {ISchemaValidator} */
let mockValidator;
/** @type {IDataRegistry} */
let mockRegistry;
/** @type {ILogger} */
let mockLogger;
/** @type {EntityDefinitionLoader} */
let entityLoader;

beforeEach(() => {
  // Create fresh mocks BEFORE instantiation
  mockConfig = createMockConfiguration();
  mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  mockValidator = createMockSchemaValidator();
  mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  // Instantiate the EntityDefinitionLoader WITH the fresh mocks
  // The constructor signature itself hasn't changed, but its internal super() call has.
  entityLoader = new EntityDefinitionLoader(
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );

  // Clear mocks *after* instantiation and initial calls (like getContentTypeSchemaId in constructor)
  jest.clearAllMocks();

  // --- [LOADER-REFACTOR-04 Test Change]: Explicitly set up mock for getContentTypeSchemaId for EntityDefinitionLoader constructor call tracking ---
  // This ensures that when the constructor of EntityDefinitionLoader (or its base) calls
  // this.config.getContentTypeSchemaId('entityDefinitions'), it gets the expected ID.
  // This mock will be specific to the constructor call.
  // For other calls within test methods, mocks can be set up specifically for those tests.
  mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
    // MODIFICATION: Changed from 'entity_definitions' to 'entityDefinitions'
    if (typeName === 'entityDefinitions') {
      return ENTITY_DEFINITION_SCHEMA_ID;
    }
    // Fallback for other types that might be requested by other parts of the loader or base classes
    return `http://example.com/schemas/${typeName}.schema.json`;
  });
  // --- End [LOADER-REFACTOR-04 Test Change] ---

  // Re-assign mocks to the instance's protected fields for tracking calls made *after* construction
  entityLoader._config = mockConfig;
  entityLoader._pathResolver = mockResolver;
  entityLoader._dataFetcher = mockFetcher;
  entityLoader._schemaValidator = mockValidator;
  entityLoader._dataRegistry = mockRegistry;
  entityLoader._logger = mockLogger;

  // Spy on methods we want to track calls to AFTER instantiation
  jest.spyOn(entityLoader, '_loadItemsInternal');
  // Spy on base class methods IF needed and accessible, e.g., _validatePrimarySchema, _storeItemInRegistry
  jest.spyOn(entityLoader, '_validatePrimarySchema'); // Spy on the inherited method
  jest.spyOn(entityLoader, '_storeItemInRegistry'); // Spy on the inherited method

  // Bind the actual _processFetchedItem method if needed for deep testing, but often testing via the wrapper is sufficient.
  // The current tests seem to call _processFetchedItem directly, so binding it ensures we use the real implementation.
  if (EntityDefinitionLoader.prototype._processFetchedItem) {
    entityLoader._processFetchedItem =
      EntityDefinitionLoader.prototype._processFetchedItem.bind(entityLoader);
  }
  // Also bind the component validation method if called directly in tests (it is)
  // --- Correction: Remove binding for private method ---
  // if (EntityDefinitionLoader.prototype['_validateEntityComponents']) { // Access private method for testing
  //     entityLoader['_validateEntityComponents'] = EntityDefinitionLoader.prototype['_validateEntityComponents'].bind(entityLoader);
  // }

  // Ensure calls to _storeItemInRegistry invoke the real implementation so the
  // returned object includes the calculated qualifiedId.
  entityLoader._storeItemInRegistry.mockImplementation((...args) =>
    EntityDefinitionLoader.prototype._storeItemInRegistry.apply(
      entityLoader,
      args
    )
  );
});

// --- Test Suite ---

describe('EntityLoader', () => {
  // --- Constructor Tests ---
  describe('Constructor', () => {
    // --- [LOADER-REFACTOR-04 Test Change]: Adjusted test to reflect correct super call and schema ID logging ---
    it('should instantiate successfully, call super with "entityDefinitions", and set _primarySchemaId', () => {
      // This test relies on the constructor correctly calling the base class
      // which in turn calls this.config.getContentTypeSchemaId.

      // Temporarily use a fresh mock for config just for this constructor test
      // to isolate the getContentTypeSchemaId call made during instantiation.
      const tempConfig = createMockConfiguration(); // This will use 'entityDefinitions' internally now

      const loader = new EntityDefinitionLoader(
        tempConfig, // Use the fresh config mock
        createMockPathResolver(),
        createMockDataFetcher(),
        createMockSchemaValidator(),
        createMockDataRegistry(),
        createMockLogger()
      );

      // Verify super() was called correctly by checking dependencyInjection interaction and result
      expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
      // MODIFICATION: Expect call with 'entityDefinitions' (camelCase)
      expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledWith(
        'entityDefinitions'
      );
      expect(loader._primarySchemaId).toBe(ENTITY_DEFINITION_SCHEMA_ID); // Check protected base class field

      // Check logger debug for schema ID found (from BaseManifestItemLoader)
      // MODIFICATION: Use toHaveBeenCalledWith(expect.stringContaining(...)) for a more robust check
      expect(loader._logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Primary schema ID for content type 'entityDefinitions' found: '" +
            ENTITY_DEFINITION_SCHEMA_ID +
            "'"
        )
      );
      // Ensure no warning was logged for missing schema ID during construction
      expect(loader._logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Primary schema ID for content type 'entityDefinitions' not found"
        )
      );
    });
    // --- End [LOADER-REFACTOR-04 Test Change] ---

    // --- [LOADER-REFACTOR-04 Test Change]: Adjusted test for warning when schema ID is missing ---
    it('should log ONE warning (from base class) if entity schema ID is not found during construction', () => {
      const warnLogger = createMockLogger(); // Fresh logger for this test
      const configMissingSchema = createMockConfiguration({
        getContentTypeSchemaId: jest.fn((typeName) => {
          // MODIFICATION: Check for camelCase and return undefined
          if (typeName === 'entityDefinitions') return undefined; // Simulate missing
          return `http://example.com/schemas/${typeName}.schema.json`;
        }),
      });

      // eslint-disable-next-line no-new
      new EntityDefinitionLoader(
        configMissingSchema,
        createMockPathResolver(),
        createMockDataFetcher(),
        createMockSchemaValidator(),
        createMockDataRegistry(),
        warnLogger // Use the logger that will capture the warning
      );

      // MODIFICATION: Expected warning message uses camelCase
      const expectedBaseWarning =
        "EntityDefinitionLoader: Primary schema ID for content type 'entityDefinitions' not found in configuration. Primary validation might be skipped.";

      // Expect only ONE warning call total (from the base class)
      expect(warnLogger.warn).toHaveBeenCalledTimes(1);
      expect(warnLogger.warn).toHaveBeenCalledWith(expectedBaseWarning); // Check against the corrected explicit message

      // Ensure the EntityDefinitionLoader-specific warning is NOT logged
      // (This was part of an old test structure, might not be relevant if the base class handles it)
      // expect(warnLogger.warn).not.toHaveBeenCalledWith(
      //   expect.stringMatching(/^EntityDefinitionLoader: Primary schema not found/)
      // );
    });
  });

  // --- loadItemsForMod Tests (Using base class method) ---
  // These tests remain the same as they test the inherited public method
  describe('loadItemsForMod (for Entity Types)', () => {
    const mockManifest = {
      id: TEST_MOD_ID,
      name: 'Test Entity Mod',
      version: '1.0.0',
      content: {
        [GENERIC_CONTENT_KEY]: ['item1.json', 'item2.json'],
      },
    };
    // --- TEST CORRECTION: Expect LoadItemsResult object ---
    const expectedLoadResult = { count: 2, overrides: 0, errors: 0 };

    it('should call _loadItemsInternal via base loadItemsForMod with correct entity-related parameters', async () => {
      // We spy on _loadItemsInternal in beforeEach
      // --- TEST CORRECTION: Mock return value to be LoadItemsResult object ---
      entityLoader._loadItemsInternal.mockResolvedValue(expectedLoadResult);

      await entityLoader.loadItemsForMod(
        TEST_MOD_ID,
        mockManifest,
        GENERIC_CONTENT_KEY,
        GENERIC_CONTENT_DIR,
        GENERIC_TYPE_NAME // Pass 'items' here, loader handles storage category internally
      );
      expect(entityLoader._loadItemsInternal).toHaveBeenCalledTimes(1);
      expect(entityLoader._loadItemsInternal).toHaveBeenCalledWith(
        TEST_MOD_ID,
        mockManifest,
        GENERIC_CONTENT_KEY,
        GENERIC_CONTENT_DIR,
        GENERIC_TYPE_NAME // Check that original type name is still passed down
      );
    });

    it('should return the LoadItemsResult object from _loadItemsInternal', async () => {
      // --- TEST CORRECTION: Mock return value to be LoadItemsResult object ---
      entityLoader._loadItemsInternal.mockResolvedValue(expectedLoadResult);
      const result = await entityLoader.loadItemsForMod(
        TEST_MOD_ID,
        mockManifest,
        GENERIC_CONTENT_KEY,
        GENERIC_CONTENT_DIR,
        GENERIC_TYPE_NAME
      );
      // --- TEST CORRECTION: Expect the full LoadItemsResult object ---
      expect(result).toEqual(expectedLoadResult);
    });

    it('should handle errors from _loadItemsInternal by propagating them', async () => {
      const loadError = new Error('Internal base loading failed for entities');
      entityLoader._loadItemsInternal.mockRejectedValue(loadError);

      await expect(
        entityLoader.loadItemsForMod(
          TEST_MOD_ID,
          mockManifest,
          GENERIC_CONTENT_KEY,
          GENERIC_CONTENT_DIR,
          GENERIC_TYPE_NAME
        )
      ).rejects.toThrow(loadError);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `EntityDefinitionLoader: Loading ${GENERIC_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
      );
      // Error should be logged by _loadItemsInternal or its callees, check base class logging if needed
    });
  });

  // --- _processFetchedItem Tests (Core EntityDefinitionLoader Logic AFTER base validation) ---
  describe('_processFetchedItem', () => {
    const filename = 'test_entity.json';
    const resolvedPath = `./data/mods/${TEST_MOD_ID}/${GENERIC_CONTENT_DIR}/${filename}`;
    const entityType = 'items'; // The typeName passed in, e.g., from the manifest key

    const baseEntityDataNoComponents = {
      id: 'core:test_entity_simple',
      name: 'Simple Test Entity',
    };
    const fullIdSimple = baseEntityDataNoComponents.id;
    const baseIdSimple = 'test_entity_simple';
    const finalKeySimple = `${TEST_MOD_ID}:${baseIdSimple}`;

    const baseEntityDataWithComponents = {
      id: 'mod:test_entity_complex',
      name: 'Complex Test Entity',
      components: {
        [COMPONENT_POSITION_ID]: { x: 10, y: 20, z: 0 },
        [COMPONENT_HEALTH_ID]: { current: 50, max: 100 },
      },
    };
    const fullIdComplex = baseEntityDataWithComponents.id;
    const baseIdComplex = 'test_entity_complex';
    const finalKeyComplex = `${TEST_MOD_ID}:${baseIdComplex}`;

    beforeEach(() => {
      // Clear mocks specific to _processFetchedItem tests
      mockValidator.validate.mockClear();
      // Default mock: primary and component validations pass
      mockValidator.validate.mockImplementation((schemaId, data) => {
        if (
          schemaId === ENTITY_DEFINITION_SCHEMA_ID ||
          schemaId === COMPONENT_POSITION_ID ||
          schemaId === COMPONENT_HEALTH_ID
        ) {
          return { isValid: true, errors: null };
        }
        // Fail any unexpected validation call
        return {
          isValid: false,
          errors: [
            { message: `Unexpected validation call for schema ${schemaId}` },
          ],
        };
      });
      // Default mock for isSchemaLoaded
      mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return (
          schemaId === ENTITY_DEFINITION_SCHEMA_ID ||
          schemaId === COMPONENT_POSITION_ID ||
          schemaId === COMPONENT_HEALTH_ID
        );
      });
      mockRegistry.get.mockClear();
      mockRegistry.get.mockReturnValue(undefined); // No existing item by default
      mockRegistry.store.mockClear();
      mockLogger.debug.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();

      // --- [LOADER-REFACTOR-04 Test Change]: Mock base class methods called within/around _processFetchedItem ---
      entityLoader._storeItemInRegistry.mockClear(); // Clear spy calls from beforeEach
      entityLoader._storeItemInRegistry.mockImplementation((...args) =>
        EntityDefinitionLoader.prototype._storeItemInRegistry.apply(
          entityLoader,
          args
        )
      );
    });

    // --- Adjusted success paths ---
    it('Success Path (No Components): should extract ID, skip component validation, delegate storage under "entities", log, and return result object', async () => {
      const fetchedData = JSON.parse(
        JSON.stringify(baseEntityDataNoComponents)
      );

      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );

      // --- Assertions ---
      // 1. ID Extraction logs
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID '${fullIdSimple}' and derived base ID '${baseIdSimple}'`
        )
      );

      // 2. Component Validation Skipped (Check logs)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${fullIdSimple}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`
        )
      );
      expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(
        expect.stringContaining('core:')
      );
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        expect.stringContaining('core:'),
        expect.anything()
      );

      // 3. Storage Delegation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Delegating storage for original type '${entityType}' with base ID '${baseIdSimple}' to base helper for file ${filename}. Storing under 'entityDefinitions' category.`
        )
      );
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
      const expectedStoredData = { ...fetchedData };
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseIdSimple,
        expectedStoredData,
        filename
      );

      // 4. Return Value (Check Object)
      // --- TEST CORRECTION: Expect object and check its properties ---
      expect(result).toBeDefined();
      expect(result.qualifiedId).toEqual(finalKeySimple);
      expect(result.didOverride).toBe(false); // Expect no override
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully processed ${entityType} file '${filename}'. Returning final registry key: ${finalKeySimple}, Overwrite: false`
        )
      );

      // 5. No Errors/Warnings
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('Success Path (With Valid Components): should extract ID, validate components, delegate storage under "entities", log, and return result object', async () => {
      const fetchedData = JSON.parse(
        JSON.stringify(baseEntityDataWithComponents)
      );

      // Mock component schema validation calls made by #validateEntityComponents
      mockValidator.validate.mockImplementation((schemaId, data) => {
        if (schemaId === COMPONENT_POSITION_ID)
          return { isValid: true, errors: null };
        if (schemaId === COMPONENT_HEALTH_ID)
          return { isValid: true, errors: null };
        return {
          isValid: false,
          errors: [
            { message: `Unexpected schema validation call: ${schemaId}` },
          ],
        };
      });
      // Mock isSchemaLoaded for components
      mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return (
          schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID
        );
      });

      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );

      // --- Assertions ---
      // 1. ID Extraction
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID '${fullIdComplex}' and derived base ID '${baseIdComplex}'`
        )
      );

      // 2. Component Validation Called and Succeeded (Check logs and mock calls)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Validating 2 components for entity '${fullIdComplex}'`
        )
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        COMPONENT_POSITION_ID
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        COMPONENT_HEALTH_ID
      );
      expect(mockValidator.validate).toHaveBeenCalledWith(
        COMPONENT_POSITION_ID,
        fetchedData.components[COMPONENT_POSITION_ID]
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Component '${COMPONENT_POSITION_ID}' in entity '${fullIdComplex}' passed runtime validation.`
        )
      );
      expect(mockValidator.validate).toHaveBeenCalledWith(
        COMPONENT_HEALTH_ID,
        fetchedData.components[COMPONENT_HEALTH_ID]
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Component '${COMPONENT_HEALTH_ID}' in entity '${fullIdComplex}' passed runtime validation.`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `All runtime component validations passed for entity '${fullIdComplex}'`
        )
      );
      expect(mockValidator.validate).toHaveBeenCalledTimes(2); // Only component validations called within this method

      // 3. Storage Delegation
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
      const expectedStoredData = { ...fetchedData };
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseIdComplex,
        expectedStoredData,
        filename
      );

      // 4. Return Value (Check Object)
      // --- TEST CORRECTION: Expect object and check its properties ---
      expect(result).toBeDefined();
      expect(result.qualifiedId).toEqual(finalKeyComplex);
      expect(result.didOverride).toBe(false); // Expect no override
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully processed ${entityType} file '${filename}'. Returning final registry key: ${finalKeyComplex}, Overwrite: false`
        )
      );

      // 5. No Errors/Warnings
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // --- Failure Scenarios ---

    it('Failure: Missing `id` field', async () => {
      const fetchedData = { name: 'Entity without ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Invalid or missing 'id' in file '${filename}'.`,
        expect.objectContaining({ receivedId: undefined })
      );
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        COMPONENT_POSITION_ID,
        expect.anything()
      ); // Should not reach component validation
    });

    it('Failure: Invalid `id` field type (number)', async () => {
      const fetchedData = { id: 123, name: 'Entity with numeric ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Invalid or missing 'id' in file '${filename}'`
        ),
        expect.objectContaining({ receivedId: 123 })
      );
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
    });

    it('Failure: Invalid `id` field (empty string)', async () => {
      const fetchedData = { id: '   ', name: 'Entity with empty ID' };
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(
        `Invalid or missing 'id' in ${filename} for mod '${TEST_MOD_ID}'.`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Invalid or missing 'id' in file '${filename}'`
        ),
        expect.objectContaining({ receivedId: '   ' })
      );
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
    });

    it('Failure: Cannot extract base ID (e.g., ID is just "core:") - *Test adjusted for current behavior*', async () => {
      const fetchedData = { id: 'core:', name: 'Entity with bad ID format' };
      const expectedFullId = 'core:';
      const expectedBaseId = 'core:'; // Current behavior uses full ID as base ID here
      const expectedFinalKey = `${TEST_MOD_ID}:${expectedBaseId}`;

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(expectedFinalKey);
      expect(result.didOverride).toBe(false); // Assume no prior item

      // Check logs and storage call
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not extract base ID from 'core:' in file '${filename}'. Falling back to full ID.`
        ),
        expect.objectContaining({ modId: TEST_MOD_ID })
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Could not derive base ID')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID '${expectedFullId}' and derived base ID '${expectedBaseId}'`
        )
      );
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        expectedBaseId,
        fetchedData,
        filename
      );
    });

    it('Failure: Runtime component validation fails', async () => {
      const fetchedData = JSON.parse(
        JSON.stringify(baseEntityDataWithComponents)
      );
      const componentErrors = [
        {
          message: 'Health must be positive',
          instancePath: '/current',
          schemaPath: '#/properties/current/minimum',
          keyword: 'minimum',
          params: { comparison: '>=', limit: 0 },
        },
      ];
      mockValidator.validate.mockImplementation((schemaId, data) => {
        if (schemaId === COMPONENT_POSITION_ID)
          return { isValid: true, errors: null };
        if (schemaId === COMPONENT_HEALTH_ID)
          return { isValid: false, errors: componentErrors };
        return {
          isValid: false,
          errors: [
            { message: `Unexpected schema validation call: ${schemaId}` },
          ],
        };
      });
      mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        return (
          schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID
        );
      });
      const expectedErrorMsg = `Runtime component validation failed for entity '${fullIdComplex}' in file '${filename}' (mod: ${TEST_MOD_ID}). Invalid components: [${COMPONENT_HEALTH_ID}]. See previous logs for details.`;
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(expectedErrorMsg);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Runtime validation failed for component '${COMPONENT_HEALTH_ID}' in entity '${fullIdComplex}'`
        ),
        expect.objectContaining({
          componentId: COMPONENT_HEALTH_ID,
          errors: componentErrors,
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expectedErrorMsg,
        expect.objectContaining({
          modId: TEST_MOD_ID,
          filename: filename,
          entityId: fullIdComplex,
          failedComponentIds: COMPONENT_HEALTH_ID,
        })
      );
      expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
      expect(mockValidator.validate).toHaveBeenCalledWith(
        COMPONENT_POSITION_ID,
        expect.any(Object)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Component '${COMPONENT_POSITION_ID}' in entity '${fullIdComplex}' passed`
        )
      );
      expect(mockValidator.validate).toHaveBeenCalledWith(
        COMPONENT_HEALTH_ID,
        expect.any(Object)
      );
    });

    it('Failure: Storage fails (error from registry.store via base helper)', async () => {
      const storeError = new Error('Database locked');
      // --- TEST CORRECTION: Mock the *implementation* of the spied method ---
      entityLoader._storeItemInRegistry.mockImplementation(() => {
        throw storeError;
      });
      const fetchedData = JSON.parse(
        JSON.stringify(baseEntityDataNoComponents)
      );
      await expect(
        entityLoader._processFetchedItem(
          TEST_MOD_ID,
          filename,
          resolvedPath,
          fetchedData,
          entityType
        )
      ).rejects.toThrow(storeError); // Error should propagate
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Extracted full ID '${fullIdSimple}'`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Delegating storage for original type '${entityType}' with base ID '${baseIdSimple}'`
        )
      );
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseIdSimple,
        fetchedData,
        filename
      );
      // The success log should NOT have been called
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining(
          `Successfully processed ${entityType} file '${filename}'. Returning final registry key:`
        )
      );
      // Error logging is handled within _storeItemInRegistry, check its logs if needed
    });

    // --- Edge Cases ---
    it('Edge Case: ID without namespace', async () => {
      const fetchedData = { id: 'my_item', name: 'Item without namespace' };
      const baseId = 'my_item'; // Base ID derived correctly
      const finalKey = `${TEST_MOD_ID}:${baseId}`;

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(finalKey);
      expect(result.didOverride).toBe(false);

      // Check logs and storage
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Falling back to full ID')
      ); // No warning for this case
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID 'my_item' and derived base ID '${baseId}'`
        )
      );
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseId,
        fetchedData,
        filename
      );
    });

    it('Edge Case: ID with multiple colons', async () => {
      const fetchedData = {
        id: 'mod:category:complex_item',
        name: 'Item with multiple colons',
      };
      const baseId = 'category:complex_item'; // Base ID is part after first colon
      const finalKey = `${TEST_MOD_ID}:${baseId}`;

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(finalKey);
      expect(result.didOverride).toBe(false);

      // Check logs and storage
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Falling back to full ID')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Extracted full ID 'mod:category:complex_item' and derived base ID '${baseId}'`
        )
      );
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseId,
        fetchedData,
        filename
      );
    });

    it('Edge Case: Empty `components` object', async () => {
      const fetchedData = {
        id: 'core:entity_empty_components',
        name: 'Entity With Empty Components Obj',
        components: {},
      };
      const fullId = fetchedData.id;
      const baseId = 'entity_empty_components';
      const finalKey = `${TEST_MOD_ID}:${baseId}`;

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(finalKey);
      expect(result.didOverride).toBe(false);

      // Check logs, validation skip, and storage
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${fullId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`
        )
      );
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        expect.stringContaining('core:'),
        expect.anything()
      ); // No component validation calls
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseId,
        fetchedData,
        filename
      );
    });

    it('Edge Case: `components` field is null', async () => {
      const fetchedData = {
        id: 'core:entity_null_components',
        name: 'Entity With Null Components',
        components: null,
      };
      const fullId = fetchedData.id;
      const baseId = 'entity_null_components';
      const finalKey = `${TEST_MOD_ID}:${baseId}`;

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(finalKey);
      expect(result.didOverride).toBe(false);

      // Check logs, validation skip, and storage
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Entity '${fullId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`
        )
      );
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        expect.stringContaining('core:'),
        expect.anything()
      ); // No component validation calls
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseId,
        fetchedData,
        filename
      );
    });

    it('Edge Case: Component schema not loaded', async () => {
      const fetchedData = JSON.parse(
        JSON.stringify(baseEntityDataWithComponents)
      );
      const fullId = fetchedData.id;
      const baseId = baseIdComplex;
      const finalKey = finalKeyComplex;

      mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        if (schemaId === COMPONENT_POSITION_ID) return true;
        if (schemaId === COMPONENT_HEALTH_ID) return false; // Health schema is NOT loaded
        return false;
      });
      mockValidator.validate.mockImplementation((schemaId, data) => {
        if (schemaId === COMPONENT_POSITION_ID)
          return { isValid: true, errors: null };
        // Validate should NOT be called for health, as its schema isn't loaded
        return {
          isValid: false,
          errors: [
            { message: `Unexpected validation call for schema ${schemaId}` },
          ],
        };
      });

      // --- TEST CORRECTION: Expect object and check its properties ---
      const result = await entityLoader._processFetchedItem(
        TEST_MOD_ID,
        filename,
        resolvedPath,
        fetchedData,
        entityType
      );
      expect(result.qualifiedId).toEqual(finalKey);
      expect(result.didOverride).toBe(false);

      // Check logs and validation calls
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Validating 2 components for entity '${fullId}'`
        )
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        COMPONENT_POSITION_ID
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
        COMPONENT_HEALTH_ID
      );

      const expectedWarning = `EntityLoader [${TEST_MOD_ID}]: Skipping validation for component '${COMPONENT_HEALTH_ID}' in entity '${fullId}' (file: ${filename}). Schema not loaded.`;
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarning);

      expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Only called for position
      expect(mockValidator.validate).toHaveBeenCalledWith(
        COMPONENT_POSITION_ID,
        fetchedData.components[COMPONENT_POSITION_ID]
      );
      expect(mockValidator.validate).not.toHaveBeenCalledWith(
        COMPONENT_HEALTH_ID,
        expect.anything()
      ); // Ensure health validation was skipped

      // Storage should still succeed because skipping validation isn't an error
      expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith(
        'entityDefinitions',
        TEST_MOD_ID,
        baseId,
        fetchedData,
        filename
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});
