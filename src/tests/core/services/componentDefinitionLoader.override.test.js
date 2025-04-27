// src/tests/core/services/componentDefinitionLoader.override.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentLoader.js'; // Correct import

// --- Mock Service Factories (Assume they are correct as provided) ---
// [Mocks omitted for brevity - use the ones provided in the prompt]
/** Mocks assumed present:
 * createMockConfiguration
 * createMockPathResolver
 * createMockDataFetcher
 * createMockSchemaValidator
 * createMockDataRegistry
 * createMockLogger
 * createMockComponentDefinition
 * createMockModManifest
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'components') {
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        if (typeName === 'game') return 'http://example.com/schemas/game.schema.json';
        if (typeName === 'mod-manifest') return 'http://example.com/schemas/mod.manifest.schema.json';
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'), ...overrides,
});
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`), ...overrides,
});
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
    fetch: jest.fn(async (path) => {
        if (errorPaths.includes(path)) {
            return Promise.reject(new Error(`Mock Fetch Error: Failed to fetch ${path}`));
        }
        if (path in pathToResponse) {
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for ${path}`));
    }),
});
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();
    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            // Simplified mock: Assume adds schema successfully unless it already exists
            if (loadedSchemas.has(schemaId)) {
                // In override test, we might expect removeSchema first, so log maybe?
                console.warn(`Mock AddSchema Warning: Schema ${schemaId} already exists, potential issue if not removed first.`);
                // For test simplicity, let's allow overwriting the schema data map directly
                // but keep the error for the validator function map if not removed
                if (schemaValidators.has(schemaId)) {
                    // throw new Error(`Mock Schema Error: Validator function for '${schemaId}' already exists.`);
                    // Let's allow overwrite for simplicity in this specific test's context
                }
            }
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) { // Only add validator if truly new
                const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                schemaValidators.set(schemaId, mockValidationFn);
            } else {
                // If schema existed and was overwritten, maybe update validator function too?
                // Or assume removeSchema handled clearing the old validator.
                // Let's stick to the logic: validator is added only if schemaId is new.
            }
        }),
        removeSchema: jest.fn((schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                loadedSchemas.delete(schemaId);
                schemaValidators.delete(schemaId); // Ensure validator function is removed too
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
            // Check if the *schema data* exists even if validator doesn't (shouldn't happen with current addSchema logic)
            if (loadedSchemas.has(schemaId)) {
                return {
                    isValid: false,
                    errors: [{message: `Mock Schema Error: Schema data '${schemaId}' loaded but no validator function found.`}]
                };
            }
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }), ...overrides,
    };
    mockValidator._getLoadedSchemaData = (schemaId) => loadedSchemas.get(schemaId);
    mockValidator._setSchemaLoaded = (schemaId, schemaData = {}) => {
        loadedSchemas.set(schemaId, schemaData);
        if (!schemaValidators.has(schemaId)) {
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }
    };
    mockValidator.mockValidatorFunction = (schemaId, implementation) => {
        if (!schemaValidators.has(schemaId)) {
            mockValidator._setSchemaLoaded(schemaId, {});
        }
        // Ensure validator exists before setting implementation
        if (!schemaValidators.has(schemaId)) {
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
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
            console.log(`DEBUG: MockRegistry store called with type='${type}', id='${id}'`); // Added debug log
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data))); // Deep copy
        }),
        get: jest.fn((type, id) => {
            const typeMap = registryData.get(type);
            const data = typeMap?.get(id);
            console.log(`DEBUG: MockRegistry get called with type='${type}', id='${id}'. Found: ${data !== undefined}`); // Added debug log
            return data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined; // Deep copy
        }),
        getAll: jest.fn((type) => {
            const typeMap = registryData.get(type);
            return typeMap ? Array.from(typeMap.values()).map(d => JSON.parse(JSON.stringify(d))) : [];
        }),
        // Expose internal data for direct checking in tests (use carefully)
        _getData: (type, id) => {
            const typeMap = registryData.get(type);
            return typeMap?.get(id); // Return direct reference for checking state
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
        getStartingLocationId: jest.fn().mockReturnValue(null), ...overrides,
    };
};
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(console.log), // Log info to console for debugging
    warn: jest.fn(console.warn), // Log warn to console
    error: jest.fn(console.error), // Log error to console
    debug: jest.fn(console.log), // Log debug to console
    ...overrides,
});
const createMockComponentDefinition = (id, dataSchema = {type: 'object', properties: {}}, description = '') => ({
    id: id,
    dataSchema: dataSchema, ...(description && {description: description}),
});
const createMockModManifest = (modId, componentFiles = []) => ({
    id: modId,
    name: `Mock Mod ${modId}`,
    version: '1.0.0',
    content: {components: componentFiles,},
});


// --- Test Suite ---

describe('ComponentDefinitionLoader (Sub-Ticket 6.3: Override Behavior)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader; // Correct type: ComponentDefinitionLoader

    // --- Shared Test Data ---
    const sharedComponentIdFromFile = 'shared:position'; // ID as read from the file
    const baseComponentId = 'position'; // Base ID used for final registry key prefixing
    const coreModId = 'core';
    const fooModId = 'foo';
    const sharedFilename = 'position.component.json';
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';
    const registryCategory = 'components';

    // --- Qualified IDs (Used as keys in the registry) ---
    const coreQualifiedId = `${coreModId}:${baseComponentId}`; // "core:position"
    const fooQualifiedId = `${fooModId}:${baseComponentId}`;   // "foo:position"

    const coreSharedPositionPath = `./data/mods/core/components/${sharedFilename}`;
    const coreSharedPositionDef = createMockComponentDefinition(sharedComponentIdFromFile, {
        type: 'object',
        properties: {x: {}, y: {}},
        required: ['x', 'y']
    }, 'Core Position Definition');
    const coreManifest = createMockModManifest(coreModId, [sharedFilename]);

    const fooSharedPositionPath = `./data/mods/foo/components/${sharedFilename}`;
    const fooSharedPositionDef = createMockComponentDefinition(sharedComponentIdFromFile, {
        type: 'object',
        properties: {x: {}, y: {}, z: {default: 0}},
        required: ['x', 'y']
    }, 'Foo Position Definition - Overridden');
    const fooManifest = createMockModManifest(fooModId, [sharedFilename]);

    // --- Setup ---
    beforeEach(() => {
        // Clear all mocks, including their implementations and call history
        jest.clearAllMocks();

        // Instantiate fresh mocks for each test using factories
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Creates validator with working internal state
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger(); // Logger now outputs to console
        // Instantiate the correct loader
        loader = new ComponentDefinitionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // --- Base Configuration for Mocks ---
        // Configure config service
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === registryCategory ? componentDefSchemaId : undefined);

        // Pre-load the main component definition schema into the mock validator
        mockValidator._setSchemaLoaded(componentDefSchemaId, {type: 'object' /* Example schema data */});
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));

        // Setup fetcher to return the correct definition based on path
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreSharedPositionPath) return JSON.parse(JSON.stringify(coreSharedPositionDef));
            if (path === fooSharedPositionPath) return JSON.parse(JSON.stringify(fooSharedPositionDef));
            throw new Error(`Mock Fetch Error: Unexpected fetch call for path: ${path}`);
        });

        // Setup resolver to return correct paths
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === coreModId && typeName === registryCategory && filename === sharedFilename) return coreSharedPositionPath;
            if (modId === fooModId && typeName === registryCategory && filename === sharedFilename) return fooSharedPositionPath;
            throw new Error(`Mock PathResolver Error: Unexpected resolveModContentPath call: ${modId}, ${typeName}, ${filename}`);
        });
    });

    // --- Test Case ---
    it('should override component definition and schema from a later mod', async () => {
        // --- Phase 1: Load Core ---
        console.log("--- Starting Phase 1 Load ---");
        // Action: Load the first mod ('core')
        await loader.loadComponentDefinitions(coreModId, coreManifest);
        console.log("--- Finished Phase 1 Load ---");

        // Verification: Check state after Phase 1

        // *** ADDED Check: Ensure store was called correctly during Phase 1 ***
        const expectedStoredCoreObject = {
            ...coreSharedPositionDef,
            id: coreQualifiedId,        // Stored object has qualified ID
            modId: coreModId,           // Ensure correct mod ID is stored
            _sourceFile: sharedFilename // Ensure correct source file is stored
        };
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith(
            registryCategory,
            coreQualifiedId,
            expect.objectContaining(expectedStoredCoreObject)
        );
        // ********************************************************************

        // 1. Check if the *data schema* was loaded using the full ID from the file
        expect(mockValidator.isSchemaLoaded(sharedComponentIdFromFile)).toBe(true);

        // 2. Verify the *definition metadata* stored in the registry uses the QUALIFIED ID
        //    This now checks the state *after* confirming store was called.
        const retrievedCoreData = mockRegistry.get(registryCategory, coreQualifiedId); // <<< USE QUALIFIED ID
        expect(retrievedCoreData).toEqual(expectedStoredCoreObject);

        // 3. Verify the *data schema* stored within the validator matches 'core' schema
        //    Schema is stored under the full ID from the file
        expect(mockValidator._getLoadedSchemaData(sharedComponentIdFromFile)).toEqual(coreSharedPositionDef.dataSchema);

        console.log("--- Finished Phase 1 Verification ---");

        // --- PREPARATION FOR PHASE 2 ---
        // Clear specific mock call histories without resetting state
        // We clear store history here specifically so we can check Phase 2 store calls count from 0
        mockRegistry.store.mockClear();
        // We are spying on 'get' in Phase 2, so clearing its history isn't needed, the spy tracks calls.
        // mockRegistry.get.mockClear(); // Keep this commented
        mockValidator.isSchemaLoaded.mockClear();
        mockValidator.removeSchema.mockClear();
        mockValidator.addSchema.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear(); // Clear info logs from phase 1

        // --- Phase 2: Setup Mocks Specific to Foo Load ---

        // 1. Mock registry 'get' specifically for the check performed by _storeItemInRegistry
        //    before storing the 'foo' version. It checks using the FINAL registry key.
        const getSpy = jest.spyOn(mockRegistry, 'get').mockImplementation((type, id) => {
            console.log(`DEBUG: SPY on mockRegistry.get called with type='${type}', id='${id}'`); // Added debug log
            // Simulate the state *before* foo is stored.
            if (type === registryCategory && id === coreQualifiedId) {
                // Return the data that *was* stored in phase 1 (simulate it's still there)
                return JSON.parse(JSON.stringify(expectedStoredCoreObject));
            }
            if (type === registryCategory && id === fooQualifiedId) {
                // This simulates the check just before storing 'foo': it shouldn't exist yet.
                return undefined;
            }
            // Fallback for any other unexpected get calls by the spy
            return undefined;
        });

        // 2. Schema Validator interactions for the override flow (Spies):
        const removeSchemaSpy = jest.spyOn(mockValidator, 'removeSchema');
        const addSchemaSpy = jest.spyOn(mockValidator, 'addSchema');
        const isSchemaLoadedSpy = jest.spyOn(mockValidator, 'isSchemaLoaded');

        // --- Action: Load Foo (Phase 2) ---
        console.log("--- Starting Phase 2 Load ---");
        const loadPromiseFoo = loader.loadComponentDefinitions(fooModId, fooManifest);

        // --- Verification: Phase 2 Execution ---
        await expect(loadPromiseFoo).resolves.not.toThrow();
        const count = await loadPromiseFoo;
        expect(count).toBe(1); // Should be 1 for the 'foo' mod load
        console.log("--- Finished Phase 2 Load Action ---");

        // --- Verification: Mock Interactions for Phase 2 ---

        // 1. Registry Interactions:
        //    - _storeItemInRegistry calls `get` with the *final key* ('foo:position') before storing.
        //      Check that our spy intercepted this specific call.
        expect(getSpy).toHaveBeenCalledWith(registryCategory, fooQualifiedId); // <<< USE QUALIFIED ID

        //    - Check if `registry.store` was called once *during Phase 2* to store the
        //      overriding definition using the QUALIFIED ID.
        const expectedStoredFooObject = {
            ...fooSharedPositionDef,    // The definition from 'foo' mod
            id: fooQualifiedId,         // ID within the stored object is the qualified one
            modId: fooModId,            // Mod ID updated to 'foo'
            _sourceFile: sharedFilename // Source file remains the same name, but context is 'foo'
        };
        // Since we cleared store history, we expect exactly one call in Phase 2
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith(
            registryCategory,
            fooQualifiedId,             // <<< USE QUALIFIED ID
            expect.objectContaining(expectedStoredFooObject) // Verify the structure of stored data
        );

        // 2. Schema Validator Interactions (using spies):
        //    - Checks/operations use the full ID from the file.
        expect(isSchemaLoadedSpy).toHaveBeenCalledWith(sharedComponentIdFromFile);
        expect(removeSchemaSpy).toHaveBeenCalledTimes(1);
        expect(removeSchemaSpy).toHaveBeenCalledWith(sharedComponentIdFromFile);
        expect(addSchemaSpy).toHaveBeenCalledTimes(1);
        expect(addSchemaSpy).toHaveBeenCalledWith(fooSharedPositionDef.dataSchema, sharedComponentIdFromFile);

        // 3. Logger Interactions: (<<< *** CORRECTED ASSERTIONS *** >>>)
        //    - Warning for SCHEMA overwrite uses the full ID from the file. This SHOULD happen.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`overwriting an existing data schema for component ID '${sharedComponentIdFromFile}'`) // <<< USES FULL ID
        );

        //    - Warning for DEFINITION overwrite SHOULD NOT happen in this specific flow
        //      because 'foo:position' doesn't exist in the registry when _storeItemInRegistry checks.
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
            expect.stringContaining(`Overwriting existing ${registryCategory} definition with key '${fooQualifiedId}'.`) // <<< CHECK IT WASN'T CALLED
        );

        //    - Ensure exactly ONE warning (the schema one) fired during Phase 2
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // <<< ONLY ONE CALL EXPECTED

        //    - Debug log for schema removal uses the full ID.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully removed existing schema '${sharedComponentIdFromFile}' before overwriting.`) // <<< USES FULL ID
        );
        //    - Debug log for schema registration uses the full ID.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Registered dataSchema for component ID '${sharedComponentIdFromFile}' from file '${sharedFilename}'.`) // <<< USES FULL ID
        );
        //    - Debug log for definition storage uses the QUALIFIED ID.
        //    Note: The actual log comes from BaseManifestItemLoader's _storeItemInRegistry
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully stored ${registryCategory} item '${fooQualifiedId}' from file '${sharedFilename}'.`) // <<< USES QUALIFIED ID
        );

        console.log("--- Finished Phase 2 Mock Interaction Verification ---");

        // --- Final State Check (Post Phase 2) ---
        // Although interactions are verified, directly checking the final state adds confidence.

        // 1. Check Registry State:
        //    - Use the internal helper `_getData` with the QUALIFIED ID for 'foo'.
        //      This bypasses the spy and checks the underlying map state directly.
        const finalStoredData = mockRegistry._getData(registryCategory, fooQualifiedId); // <<< USE QUALIFIED ID
        expect(finalStoredData).toBeDefined(); // Ensure something was actually stored
        expect(finalStoredData).toEqual(expect.objectContaining(expectedStoredFooObject));

        //    - Verify that the 'core' entry *still exists* under its qualified ID,
        //      as the override logic doesn't explicitly delete old entries from the map.
        const finalCoreDataCheck = mockRegistry._getData(registryCategory, coreQualifiedId);
        expect(finalCoreDataCheck).toBeDefined();
        expect(finalCoreDataCheck).toEqual(expect.objectContaining(expectedStoredCoreObject));


        // 2. Check Validator State:
        //    - Use the internal helper `_getLoadedSchemaData` with the FULL ID.
        const finalSchemaData = mockValidator._getLoadedSchemaData(sharedComponentIdFromFile); // <<< USES FULL ID
        expect(finalSchemaData).toEqual(fooSharedPositionDef.dataSchema); // Ensure the schema matches 'foo'

        console.log("--- Finished Final State Check ---");
        console.log("--- Test Completed Successfully ---");

        // Restore mocks if using spies extensively
        getSpy.mockRestore();
    });
});