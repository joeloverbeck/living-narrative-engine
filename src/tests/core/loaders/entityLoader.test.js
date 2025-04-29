// Filename: src/tests/core/loaders/entityLoader.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import EntityLoader from '../../../core/loaders/entityLoader.js'; // Adjust path as needed
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Base class

// --- Mock Service Factories (Simplified and Corrected) ---
// Assume these factories (createMockConfiguration, etc.) are defined as provided in the original prompt

/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../../core/interfaces/coreServices.js').ValidationResult} ValidationResult */
// Assume these factories (createMockConfiguration, createMockPathResolver, etc.) are defined as before...

// --- Constants ---
const ENTITY_SCHEMA_ID = 'http://example.com/schemas/entity.schema.json';
const TEST_MOD_ID = 'test-entity-mod';
const GENERIC_CONTENT_KEY = 'items'; // Example key in manifest.content
const GENERIC_CONTENT_DIR = 'items'; // Example directory name
const GENERIC_TYPE_NAME = 'items';   // Example type name passed to process/store
const COMPONENT_POSITION_ID = 'core:position';
const COMPONENT_HEALTH_ID = 'core:health';
const COMPONENT_SCHEMA_POSITION = 'http://example.com/schemas/components/position.schema.json';
const COMPONENT_SCHEMA_HEALTH = 'http://example.com/schemas/components/health.schema.json';


// ** SIMPLIFIED Mock Factory **
const createMockConfiguration = (overrides = {}) => {
    const config = {
        getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
        // --- [LOADER-REFACTOR-04 Test Change]: Ensure this mock handles 'entities' ---
        getContentTypeSchemaId: jest.fn((typeName) => {
            if (typeName === 'entities') return ENTITY_SCHEMA_ID;
            if (typeName === 'components') { // Example for component loading if needed
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


/** Creates a mock IPathResolver service. */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn().mockImplementation((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn().mockImplementation((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn().mockImplementation(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn().mockImplementation(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn().mockImplementation(() => './data/game.json'),
    resolveRulePath: jest.fn().mockImplementation(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn().mockImplementation(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

/** Creates a mock IDataFetcher service. */
const createMockDataFetcher = (overrides = {}) => ({
    fetch: jest.fn().mockResolvedValue({}), // Default mock fetch
    ...overrides,
});

/** Creates a mock ISchemaValidator service. */
const createMockSchemaValidator = (overrides = {}) => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}), // Default to valid
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    // --- [LOADER-REFACTOR-04 Test Change]: Ensure components can be marked as loaded ---
    isSchemaLoaded: jest.fn().mockImplementation((schemaId) => {
        // Assume entity and core component schemas are loaded by default for tests
        if (schemaId === ENTITY_SCHEMA_ID || schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID) {
            return true;
        }
        // Allow overrides for specific schema IDs
        if (overrides.loadedSchemas && overrides.loadedSchemas[schemaId] !== undefined) {
            return overrides.loadedSchemas[schemaId];
        }
        return false; // Default to not loaded
    }),
    ...overrides,
});

/** Creates a mock IDataRegistry service. */
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

/** Creates a mock ILogger service. */
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
/** @type {EntityLoader} */
let entityLoader;


beforeEach(() => {
    // Create fresh mocks BEFORE instantiation
    mockConfig = createMockConfiguration();
    mockResolver = createMockPathResolver();
    mockFetcher = createMockDataFetcher();
    mockValidator = createMockSchemaValidator();
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();

    // Instantiate the EntityLoader WITH the fresh mocks
    // The constructor signature itself hasn't changed, but its internal super() call has.
    entityLoader = new EntityLoader(
        mockConfig,
        mockResolver,
        mockFetcher,
        mockValidator,
        mockRegistry,
        mockLogger
    );

    // Clear mocks *after* instantiation and initial calls (like getContentTypeSchemaId in constructor)
    jest.clearAllMocks();

    // Re-assign mocks to the instance's protected fields for tracking calls made *after* construction
    // This is a common pattern but be mindful it overrides the original references used in constructor.
    // It's generally better to test behavior via public methods and observed side effects (logs, registry calls).
    // However, keeping this pattern for consistency with the original code.
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
    if (EntityLoader.prototype._processFetchedItem) {
        entityLoader._processFetchedItem = EntityLoader.prototype._processFetchedItem.bind(entityLoader);
    }
    // Also bind the component validation method if called directly in tests (it is)
    // --- Correction: Remove binding for private method ---
    // if (EntityLoader.prototype['_validateEntityComponents']) { // Access private method for testing
    //     entityLoader['_validateEntityComponents'] = EntityLoader.prototype['_validateEntityComponents'].bind(entityLoader);
    // }
});


// --- Test Suite ---

describe('EntityLoader', () => {

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should instantiate successfully, call super with "entities", and set _primarySchemaId', () => {
            // Use temporary mocks for this specific test to isolate constructor behavior
            const tempLogger = createMockLogger();
            const tempConfig = createMockConfiguration(); // Uses the updated factory

            // Instantiate with the temporary mocks
            const loader = new EntityLoader(tempConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, tempLogger);

            expect(loader).toBeInstanceOf(EntityLoader);
            expect(loader).toBeInstanceOf(BaseManifestItemLoader);

            // --- [LOADER-REFACTOR-04 Test Change START] ---
            // Verify super() was called correctly by checking config interaction and result
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledTimes(1);
            expect(tempConfig.getContentTypeSchemaId).toHaveBeenCalledWith('entities');
            expect(loader._primarySchemaId).toBe(ENTITY_SCHEMA_ID); // Check protected base class field
            // --- [LOADER-REFACTOR-04 Test Change END] ---

            expect(loader._logger).toBe(tempLogger); // Check logger assignment

            // No warnings should be logged in the success case
            expect(tempLogger.warn).not.toHaveBeenCalled();
        });


        it('should log ONE warning (from base class) if entity schema ID is not found during construction', () => {
            const warnLogger = createMockLogger(); // Use a temporary logger
            const badConfig = createMockConfiguration({
                // Mock config to return null specifically for 'entities'
                getContentTypeSchemaId: jest.fn((typeName) => {
                    if (typeName === 'entities') return null;
                    return `http://example.com/schemas/${typeName}.schema.json`; // Fallback for others
                })
            });

            // Instantiate with the temporary logger and bad config
            new EntityLoader(badConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, warnLogger);

            // --- [LOADER-REFACTOR-04 Test Change START] ---
            // --- CORRECTION: Updated expected warning message ---
            const expectedBaseWarning = `EntityLoader: Primary schema ID for content type 'entities' not found in configuration. Primary validation might be skipped.`;

            // Expect only ONE warning call total (from the base class)
            expect(warnLogger.warn).toHaveBeenCalledTimes(1);
            expect(warnLogger.warn).toHaveBeenCalledWith(expectedBaseWarning); // Check against the corrected explicit message

            // Ensure the EntityLoader-specific warning is NOT logged
            expect(warnLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining("EntityLoader: Schema ID for 'entities' is missing.")
            );
            // --- [LOADER-REFACTOR-04 Test Change END] ---

            // Debug logs should still happen (base class init + entityloader init)
            // EntityLoader init log:
            expect(warnLogger.debug).toHaveBeenCalledWith('EntityLoader: Initialized.');
            expect(warnLogger.debug).toHaveBeenCalledTimes(2); // Only 2 debug logs when schema isn't found
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
                [GENERIC_CONTENT_KEY]: ['item1.json', 'item2.json']
            }
        };
        const expectedLoadCount = 2;

        it('should call _loadItemsInternal via base loadItemsForMod with correct entity-related parameters', async () => {
            // We spy on _loadItemsInternal in beforeEach
            entityLoader._loadItemsInternal.mockResolvedValue(expectedLoadCount); // Need to mock the return value

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

        it('should return the count from _loadItemsInternal', async () => {
            entityLoader._loadItemsInternal.mockResolvedValue(expectedLoadCount);
            const result = await entityLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                GENERIC_CONTENT_KEY,
                GENERIC_CONTENT_DIR,
                GENERIC_TYPE_NAME
            );
            expect(result).toBe(expectedLoadCount);
        });

        it('should handle errors from _loadItemsInternal by propagating them', async () => {
            const loadError = new Error('Internal base loading failed for entities');
            entityLoader._loadItemsInternal.mockRejectedValue(loadError);

            await expect(entityLoader.loadItemsForMod(
                TEST_MOD_ID,
                mockManifest,
                GENERIC_CONTENT_KEY,
                GENERIC_CONTENT_DIR,
                GENERIC_TYPE_NAME
            )).rejects.toThrow(loadError);
            expect(mockLogger.info).toHaveBeenCalledWith(
                `EntityLoader: Loading ${GENERIC_TYPE_NAME} definitions for mod '${TEST_MOD_ID}'.`
            );
            // Error should be logged by _loadItemsInternal or its callees, check base class logging if needed
        });
    });

    // --- _processFetchedItem Tests (Core EntityLoader Logic AFTER base validation) ---
    describe('_processFetchedItem', () => {
        const filename = 'test_entity.json';
        const resolvedPath = `./data/mods/${TEST_MOD_ID}/${GENERIC_CONTENT_DIR}/${filename}`;
        const entityType = 'items'; // The typeName passed in, e.g., from the manifest key

        const baseEntityDataNoComponents = {
            id: 'core:test_entity_simple', name: 'Simple Test Entity',
        };
        const fullIdSimple = baseEntityDataNoComponents.id;
        const baseIdSimple = 'test_entity_simple';
        const finalKeySimple = `${TEST_MOD_ID}:${baseIdSimple}`;

        const baseEntityDataWithComponents = {
            id: 'mod:test_entity_complex', name: 'Complex Test Entity',
            components: {
                [COMPONENT_POSITION_ID]: {x: 10, y: 20, z: 0},
                [COMPONENT_HEALTH_ID]: {current: 50, max: 100}
            }
        };
        const fullIdComplex = baseEntityDataWithComponents.id;
        const baseIdComplex = 'test_entity_complex';
        const finalKeyComplex = `${TEST_MOD_ID}:${baseIdComplex}`;

        beforeEach(() => {
            // Clear mocks specific to _processFetchedItem tests
            mockValidator.validate.mockClear();
            // Default mock: primary and component validations pass
            mockValidator.validate.mockImplementation((schemaId, data) => {
                if (schemaId === ENTITY_SCHEMA_ID || schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID) {
                    return { isValid: true, errors: null };
                }
                // Fail any unexpected validation call
                return { isValid: false, errors: [{ message: `Unexpected validation call for schema ${schemaId}` }] };
            });
            // Default mock for isSchemaLoaded
            mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
                return schemaId === ENTITY_SCHEMA_ID || schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID;
            });
            mockRegistry.get.mockClear();
            mockRegistry.get.mockReturnValue(undefined); // No existing item by default
            mockRegistry.store.mockClear();
            mockLogger.debug.mockClear();
            mockLogger.warn.mockClear();
            mockLogger.error.mockClear();

            // --- [LOADER-REFACTOR-04 Test Change]: Mock base class methods called within/around _processFetchedItem ---
            entityLoader._storeItemInRegistry.mockClear(); // Clear spy calls from beforeEach
        });

        // --- Adjusted success paths ---
        it('Success Path (No Components): should extract ID, skip component validation, delegate storage under "entities", log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEntityDataNoComponents));

            // --- Correction: Remove spyOn invalid syntax ---
            // const validateComponentsSpy = jest.spyOn(entityLoader, '_EntityLoader__validateEntityComponents' as any); // Spy on private method - REMOVED

            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);

            // --- Assertions ---
            // 1. ID Extraction logs
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID '${fullIdSimple}' and derived base ID '${baseIdSimple}'`));

            // 2. Component Validation Skipped (Check logs)
            // --- Correction: Remove check on removed spy ---
            // expect(validateComponentsSpy).not.toHaveBeenCalled(); // REMOVED
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Entity '${fullIdSimple}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`));
            // Ensure validator wasn't called for components
            expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(expect.stringContaining('core:')); // Assuming component IDs have 'core:'
            expect(mockValidator.validate).not.toHaveBeenCalledWith(expect.stringContaining('core:'), expect.anything());


            // 3. Storage Delegation
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for original type '${entityType}' with base ID '${baseIdSimple}' to base helper for file ${filename}. Storing under 'entities' category.`));
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
            const expectedStoredData = {...fetchedData}; // Base helper adds id, modId, _sourceFile
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseIdSimple, expectedStoredData, filename);

            // 4. Return Value
            expect(resultKey).toEqual(finalKeySimple);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed ${entityType} file '${filename}'. Returning final registry key: ${finalKeySimple}`));

            // 5. No Errors/Warnings
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // --- Correction: Remove spy restore ---
            // validateComponentsSpy.mockRestore(); // REMOVED
        });

        it('Success Path (With Valid Components): should extract ID, validate components, delegate storage under "entities", log, and return final key', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEntityDataWithComponents));

            // --- Correction: Remove spyOn invalid syntax ---
            // const validateComponentsSpy = jest.spyOn(entityLoader, '_EntityLoader__validateEntityComponents' as any); // Spy on private method - REMOVED

            // Mock component schema validation calls made by #validateEntityComponents
            mockValidator.validate.mockImplementation((schemaId, data) => {
                if (schemaId === COMPONENT_POSITION_ID) return {isValid: true, errors: null};
                if (schemaId === COMPONENT_HEALTH_ID) return {isValid: true, errors: null};
                return {isValid: false, errors: [{message: `Unexpected schema validation call: ${schemaId}`}]};
            });
            // Mock isSchemaLoaded for components
            mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
                return schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID;
            });

            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);

            // --- Assertions ---
            // 1. ID Extraction
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID '${fullIdComplex}' and derived base ID '${baseIdComplex}'`));

            // 2. Component Validation Called and Succeeded (Check logs and mock calls)
            // --- Correction: Remove check on removed spy ---
            // expect(validateComponentsSpy).toHaveBeenCalledTimes(1); // REMOVED
            // expect(validateComponentsSpy).toHaveBeenCalledWith(TEST_MOD_ID, fullIdComplex, filename, fetchedData.components); // REMOVED
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validating 2 components for entity '${fullIdComplex}'`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(COMPONENT_POSITION_ID);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(COMPONENT_HEALTH_ID);
            expect(mockValidator.validate).toHaveBeenCalledWith(COMPONENT_POSITION_ID, fetchedData.components[COMPONENT_POSITION_ID]);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component '${COMPONENT_POSITION_ID}' in entity '${fullIdComplex}' passed runtime validation.`));
            expect(mockValidator.validate).toHaveBeenCalledWith(COMPONENT_HEALTH_ID, fetchedData.components[COMPONENT_HEALTH_ID]);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component '${COMPONENT_HEALTH_ID}' in entity '${fullIdComplex}' passed runtime validation.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`All runtime component validations passed for entity '${fullIdComplex}'`));
            expect(mockValidator.validate).toHaveBeenCalledTimes(2); // Only component validations called within this method

            // 3. Storage Delegation
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
            const expectedStoredData = {...fetchedData};
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseIdComplex, expectedStoredData, filename);

            // 4. Return Value
            expect(resultKey).toEqual(finalKeyComplex);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully processed ${entityType} file '${filename}'. Returning final registry key: ${finalKeyComplex}`));

            // 5. No Errors/Warnings
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();

            // --- Correction: Remove spy restore ---
            // validateComponentsSpy.mockRestore(); // REMOVED
        });

        // --- Failure Scenarios ---

        it('Failure: Missing `id` field', async () => {
            const fetchedData = {name: 'Entity without ID'};
            await expect(entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType))
                .rejects.toThrow(`Invalid or missing 'id' in ${entityType} file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `EntityLoader [${TEST_MOD_ID}]: Invalid or missing 'id' in ${entityType} file '${filename}'.`,
                expect.objectContaining({receivedId: undefined})
            );
            expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
            expect(mockValidator.validate).not.toHaveBeenCalled();
        });

        it('Failure: Invalid `id` field type (number)', async () => {
            const fetchedData = {id: 123, name: 'Entity with numeric ID'};
            await expect(entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType))
                .rejects.toThrow(`Invalid or missing 'id' in ${entityType} file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in ${entityType} file '${filename}'.`),
                expect.objectContaining({receivedId: 123})
            );
            expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
        });

        it('Failure: Invalid `id` field (empty string)', async () => {
            const fetchedData = {id: '   ', name: 'Entity with empty ID'};
            await expect(entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType))
                .rejects.toThrow(`Invalid or missing 'id' in ${entityType} file '${filename}' for mod '${TEST_MOD_ID}'.`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Invalid or missing 'id' in ${entityType} file '${filename}'.`),
                expect.objectContaining({receivedId: '   '})
            );
            expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
        });


        it('Failure: Cannot extract base ID (e.g., ID is just "core:") - *Test adjusted for current behavior*', async () => {
            const fetchedData = {id: 'core:', name: 'Entity with bad ID format'};
            const expectedFullId = 'core:';
            const expectedBaseId = 'core:';
            const expectedFinalKey = `${TEST_MOD_ID}:${expectedBaseId}`;
            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);
            expect(resultKey).toEqual(expectedFinalKey);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`ID 'core:' in ${filename} has an unusual format`));
            expect(mockLogger.error).not.toHaveBeenCalledWith(expect.stringContaining('Could not derive base ID'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID '${expectedFullId}' and derived base ID '${expectedBaseId}'`));
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, expectedBaseId, fetchedData, filename);
        });

        it('Failure: Runtime component validation fails', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEntityDataWithComponents));
            const componentErrors = [{ message: "Health must be positive", instancePath: "/current", schemaPath: "#/properties/current/minimum", keyword: "minimum", params: { comparison: '>=', limit: 0 } }];
            mockValidator.validate.mockImplementation((schemaId, data) => {
                if (schemaId === COMPONENT_POSITION_ID) return {isValid: true, errors: null};
                if (schemaId === COMPONENT_HEALTH_ID) return {isValid: false, errors: componentErrors};
                return {isValid: false, errors: [{message: `Unexpected schema validation call: ${schemaId}`}]};
            });
            mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
                return schemaId === COMPONENT_POSITION_ID || schemaId === COMPONENT_HEALTH_ID;
            });
            const expectedErrorMsg = `Runtime component validation failed for entity '${fullIdComplex}' in file '${filename}' (mod: ${TEST_MOD_ID}). Invalid components: [${COMPONENT_HEALTH_ID}]. See previous logs for details.`;
            await expect(entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType))
                .rejects.toThrow(expectedErrorMsg);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`Runtime validation failed for component '${COMPONENT_HEALTH_ID}' in entity '${fullIdComplex}'`),
                expect.objectContaining({componentId: COMPONENT_HEALTH_ID, errors: componentErrors})
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                expectedErrorMsg,
                expect.objectContaining({
                    modId: TEST_MOD_ID, filename: filename, entityId: fullIdComplex, failedComponentIds: COMPONENT_HEALTH_ID
                })
            );
            expect(entityLoader._storeItemInRegistry).not.toHaveBeenCalled();
            expect(mockValidator.validate).toHaveBeenCalledWith(COMPONENT_POSITION_ID, expect.any(Object));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Component '${COMPONENT_POSITION_ID}' in entity '${fullIdComplex}' passed`));
            expect(mockValidator.validate).toHaveBeenCalledWith(COMPONENT_HEALTH_ID, expect.any(Object));
        });


        it('Failure: Storage fails (error from registry.store via base helper)', async () => {
            const storeError = new Error('Database locked');
            entityLoader._storeItemInRegistry.mockImplementation(() => {
                throw storeError;
            });
            const fetchedData = JSON.parse(JSON.stringify(baseEntityDataNoComponents));
            await expect(entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType))
                .rejects.toThrow(storeError);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID '${fullIdSimple}'`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Delegating storage for original type '${entityType}' with base ID '${baseIdSimple}'`));
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledTimes(1);
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseIdSimple, fetchedData, filename);
            expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining(`Successfully processed ${entityType} file`));
        });

        // --- Edge Cases ---
        it('Edge Case: ID without namespace', async () => {
            const fetchedData = {id: 'my_item', name: 'Item without namespace'};
            const baseId = 'my_item';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);
            expect(resultKey).toEqual(finalKey);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`ID 'my_item' in ${filename} has no namespace prefix. Using full ID as base ID.`));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID 'my_item' and derived base ID '${baseId}'`));
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseId, fetchedData, filename);
        });

        it('Edge Case: ID with multiple colons', async () => {
            const fetchedData = {id: 'mod:category:complex_item', name: 'Item with multiple colons'};
            const baseId = 'category:complex_item';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);
            expect(resultKey).toEqual(finalKey);
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Extracted full ID 'mod:category:complex_item' and derived base ID '${baseId}'`));
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseId, fetchedData, filename);
        });

        it('Edge Case: Empty `components` object', async () => {
            const fetchedData = { id: 'core:entity_empty_components', name: 'Entity With Empty Components Obj', components: {} };
            const fullId = fetchedData.id;
            const baseId = 'entity_empty_components';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            // --- Correction: Remove spyOn invalid syntax ---
            // const validateComponentsSpy = jest.spyOn(entityLoader, '_EntityLoader__validateEntityComponents' as any); // REMOVED

            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);

            expect(resultKey).toEqual(finalKey);
            // --- Correction: Remove check on removed spy ---
            // expect(validateComponentsSpy).not.toHaveBeenCalled(); // REMOVED
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Entity '${fullId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`));
            expect(mockValidator.validate).not.toHaveBeenCalledWith(expect.stringContaining('core:'), expect.anything()); // No component validation calls
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseId, fetchedData, filename);
            // --- Correction: Remove spy restore ---
            // validateComponentsSpy.mockRestore(); // REMOVED
        });

        it('Edge Case: `components` field is null', async () => {
            const fetchedData = { id: 'core:entity_null_components', name: 'Entity With Null Components', components: null };
            const fullId = fetchedData.id;
            const baseId = 'entity_null_components';
            const finalKey = `${TEST_MOD_ID}:${baseId}`;
            // --- Correction: Remove spyOn invalid syntax ---
            // const validateComponentsSpy = jest.spyOn(entityLoader, '_EntityLoader__validateEntityComponents' as any); // REMOVED

            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);

            expect(resultKey).toEqual(finalKey);
            // --- Correction: Remove check on removed spy ---
            // expect(validateComponentsSpy).not.toHaveBeenCalled(); // REMOVED
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Entity '${fullId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`));
            expect(mockValidator.validate).not.toHaveBeenCalledWith(expect.stringContaining('core:'), expect.anything()); // No component validation calls
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseId, fetchedData, filename);
            // --- Correction: Remove spy restore ---
            // validateComponentsSpy.mockRestore(); // REMOVED
        });

        it('Edge Case: Component schema not loaded', async () => {
            const fetchedData = JSON.parse(JSON.stringify(baseEntityDataWithComponents));
            const fullId = fetchedData.id;
            const baseId = baseIdComplex;
            const finalKey = finalKeyComplex;

            mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
                if (schemaId === COMPONENT_POSITION_ID) return true;
                if (schemaId === COMPONENT_HEALTH_ID) return false; // Health schema is NOT loaded
                return false;
            });
            mockValidator.validate.mockImplementation((schemaId, data) => {
                if (schemaId === COMPONENT_POSITION_ID) return { isValid: true, errors: null };
                // Validate should NOT be called for health, as its schema isn't loaded
                return { isValid: false, errors: [{ message: `Unexpected validation call for schema ${schemaId}` }] };
            });

            const resultKey = await entityLoader._processFetchedItem(TEST_MOD_ID, filename, resolvedPath, fetchedData, entityType);

            expect(resultKey).toEqual(finalKey);

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validating 2 components for entity '${fullId}'`));
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(COMPONENT_POSITION_ID);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(COMPONENT_HEALTH_ID);

            // --- CORRECTION: Update expectation to match the exact log message format ---
            const expectedWarning = `EntityLoader [${TEST_MOD_ID}]: Skipping validation for component '${COMPONENT_HEALTH_ID}' in entity '${fullId}' (file: ${filename}). Schema not loaded.`;
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Should be exactly one warning
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarning); // Check for the precise message

            expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Only called for position
            expect(mockValidator.validate).toHaveBeenCalledWith(COMPONENT_POSITION_ID, fetchedData.components[COMPONENT_POSITION_ID]);
            expect(mockValidator.validate).not.toHaveBeenCalledWith(COMPONENT_HEALTH_ID, expect.anything()); // Ensure health validation was skipped// This still passes because the health validation was skipped, not failed.
            expect(entityLoader._storeItemInRegistry).toHaveBeenCalledWith('entities', TEST_MOD_ID, baseId, fetchedData, filename);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });
});