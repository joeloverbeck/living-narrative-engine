// src/tests/core/services/componentDefinitionLoader.override.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js';

// --- Mock Service Factories ---
// [Mocks omitted for brevity - assume they are the same as provided previously]
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
// --- Mock Service Factories (Copied for self-containment) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../core/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
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
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../core/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`),
    ...overrides,
});

/**
 * Creates a mock IDataFetcher service.
 * @param {object} [pathToResponse={}] - Map of path strings to successful response data.
 * @param {string[]} [errorPaths=[]] - List of paths that should trigger a rejection.
 * @returns {import('../../../core/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
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

/**
 * Creates a mock ISchemaValidator service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../core/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();

    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            // Simulate the base mock behavior of adding to the internal map
            // only if it doesn't exist. If it exists, log error or throw
            // (though the test might override this specific behavior).
            if (loadedSchemas.has(schemaId)) {
                console.error(`!!! Mock AddSchema Error: Schema ${schemaId} already exists in mock's loadedSchemas map!`);
                // In a real test scenario for override, we might expect this,
                // but the base mock aims for initial load behavior.
                // Consider if the test override for addSchema should handle this.
                throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            }
            loadedSchemas.set(schemaId, schemaData);
            // Ensure a validator function exists for it
            if (!schemaValidators.has(schemaId)) {
                const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                schemaValidators.set(schemaId, mockValidationFn);
            }
        }),
        removeSchema: jest.fn((schemaId) => {
            // Base mock behavior: Remove from internal maps if present
            if (loadedSchemas.has(schemaId)) {
                loadedSchemas.delete(schemaId);
                schemaValidators.delete(schemaId);
                return true; // Indicate success
            }
            return false; // Indicate schema not found
        }),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data); // Use the specific validator function
            }
            // Fallback if no validator or schema is found
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }),
        ...overrides, // Apply any test-specific overrides
    };

    // Helper methods for tests to interact with mock state
    // Use these carefully as they expose internal details
    mockValidator._getLoadedSchemaData = (schemaId) => loadedSchemas.get(schemaId); // Get raw schema data
    mockValidator._setSchemaLoaded = (schemaId, schemaData = {}) => {
        // Directly set schema state, bypassing addSchema logic (e.g., for setup)
        loadedSchemas.set(schemaId, schemaData);
        // Ensure a validator function exists
        if (!schemaValidators.has(schemaId)) {
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }
    };
    // Helper to mock the behavior of a specific schema's validator function
    mockValidator.mockValidatorFunction = (schemaId, implementation) => {
        if (!schemaValidators.has(schemaId)) {
            // Ensure the schema is considered "loaded" if we're mocking its validator
            mockValidator._setSchemaLoaded(schemaId, {}); // Add with dummy data if not present
        }
        schemaValidators.get(schemaId).mockImplementation(implementation);
    };

    return mockValidator;
};


/**
 * Creates a mock IDataRegistry service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../core/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
 */
const createMockDataRegistry = (overrides = {}) => {
    const registryData = new Map();
    return {
        store: jest.fn((type, id, data) => {
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data)));
        }),
        get: jest.fn((type, id) => {
            const typeMap = registryData.get(type);
            return typeMap?.has(id) ? JSON.parse(JSON.stringify(typeMap.get(id))) : undefined;
        }),
        getAll: jest.fn((type) => {
            const typeMap = registryData.get(type);
            return typeMap ? Array.from(typeMap.values()).map(d => JSON.parse(JSON.stringify(d))) : [];
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
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../core/interfaces/coreServices.js').ILogger} Mocked logger service.
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
 * @param {string} id
 * @param {object} [dataSchema={ type: 'object', properties: {} }]
 * @param {string} [description='']
 * @returns {object}
 */
const createMockComponentDefinition = (id, dataSchema = {type: 'object', properties: {}}, description = '') => ({
    id: id,
    dataSchema: dataSchema,
    ...(description && {description: description}),
});

/**
 * Creates a basic mock Mod Manifest object.
 * @param {string} modId
 * @param {string[]} [componentFiles=[]]
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.3: Override Behavior)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const sharedComponentId = 'shared:position';
    const sharedFilename = 'position.component.json';
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    const coreSharedPositionPath = `./data/mods/core/components/${sharedFilename}`;
    const coreSharedPositionDef = createMockComponentDefinition(sharedComponentId, {
        type: 'object',
        properties: {x: {}, y: {}},
        required: ['x', 'y']
    }, 'Core Position Definition');
    const coreManifest = createMockModManifest('core', [sharedFilename]);

    const fooSharedPositionPath = `./data/mods/foo/components/${sharedFilename}`;
    const fooSharedPositionDef = createMockComponentDefinition(sharedComponentId, {
        type: 'object',
        properties: {x: {}, y: {}, z: {default: 0}},
        required: ['x', 'y']
    }, 'Foo Position Definition - Overridden');
    const fooManifest = createMockModManifest('foo', [sharedFilename]);

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
        mockLogger = createMockLogger();
        loader = new ComponentDefinitionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // --- Base Configuration for Mocks ---
        // Configure config service
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);

        // Pre-load the main component definition schema into the mock validator
        // Use the helper methods provided by the mock factory for reliable state setup
        mockValidator._setSchemaLoaded(componentDefSchemaId, {type: 'object' /* Example schema data */});
        // Ensure validation against the main schema passes by default
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));

        // Setup fetcher to return the correct definition based on path
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreSharedPositionPath) return JSON.parse(JSON.stringify(coreSharedPositionDef));
            if (path === fooSharedPositionPath) return JSON.parse(JSON.stringify(fooSharedPositionDef));
            // Throw for any unexpected paths to catch errors early
            throw new Error(`Mock Fetch Error: Unexpected fetch call for path: ${path}`);
        });

        // Setup resolver to return correct paths
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === 'core' && typeName === 'components' && filename === sharedFilename) return coreSharedPositionPath;
            if (modId === 'foo' && typeName === 'components' && filename === sharedFilename) return fooSharedPositionPath;
            // Provide a fallback or throw if unexpected resolution is attempted
            // return `./data/mods/${modId}/${typeName}/${filename}`; // Generic fallback
            throw new Error(`Mock PathResolver Error: Unexpected resolveModContentPath call: ${modId}, ${typeName}, ${filename}`);
        });
    });

    // --- Test Case ---
    it('should override component definition and schema from a later mod', async () => {
        // --- Phase 1: Load Core ---
        // Action: Load the first mod ('core')
        await loader.loadComponentDefinitions('core', coreManifest);

        // Verification: Check state after Phase 1
        // 1. Check if the specific component schema was loaded using the validator's state check
        expect(mockValidator.isSchemaLoaded(sharedComponentId)).toBe(true);
        // 2. Verify the data stored in the registry matches the 'core' definition
        expect(mockRegistry.get('component_definitions', sharedComponentId)).toEqual({
            ...coreSharedPositionDef,
            modId: 'core', // Ensure correct mod ID is stored
            _sourceFile: sharedFilename // Ensure correct source file is stored
        });
        // 3. Verify the schema data stored within the validator matches 'core' schema
        //    Use the mock's helper method to access the internal state safely
        expect(mockValidator._getLoadedSchemaData(sharedComponentId)).toEqual(coreSharedPositionDef.dataSchema);

        // --- PREPARATION FOR PHASE 2 ---
        // Clear mock call history *without* resetting internal state (like loaded schemas/registry data)
        // This allows us to verify Phase 2 interactions specifically.
        jest.clearAllMocks(); // Clears call counts, arguments, etc.

        // --- Phase 2: Setup Mocks Specific to Foo Load ---

        // Re-configure necessary mock behaviors for the *override* scenario.
        // Some mocks might need to reflect the state left by Phase 1.

        // 1. Mock registry 'get' to simulate finding the existing 'core' definition
        //    when the loader checks before storing the 'foo' version.
        mockRegistry.get.mockImplementation((type, id) => {
            if (type === 'component_definitions' && id === sharedComponentId) {
                // Return a deep copy of the *expected* existing data from Phase 1
                return JSON.parse(JSON.stringify({
                    ...coreSharedPositionDef,
                    modId: 'core',
                    _sourceFile: sharedFilename
                }));
            }
            return undefined; // Return undefined for any other registry get calls
        });

        // 2. Mock Schema Validator interactions for the override flow:
        //    - isSchemaLoaded: Should return true because 'core' loaded it.
        //    - removeSchema: Should be called and succeed for the specific ID.
        //    - addSchema: Should be called with the new schema data.

        //    Let's rely on the *base* mock implementation from createMockSchemaValidator
        //    for isSchemaLoaded, removeSchema, and addSchema where possible, as it handles
        //    the internal state (`loadedSchemas` map). We only override if needed.

        //    Ensure `isSchemaLoaded` uses the mock's internal state.
        //    The base mock already does this, but we can be explicit if needed:
        //    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
        //        return mockValidator._getLoadedSchemaData(schemaId) !== undefined;
        //    });

        //    ***** CORRECTED MOCK IMPLEMENTATION FOR removeSchema *****
        //    We need `removeSchema` to be *called* and ideally succeed (return true).
        //    The base mock should handle removing from its internal map.
        //    We *don't* need a custom implementation here unless the base mock is flawed.
        //    Let's *spy* on the base mock's removeSchema instead of completely replacing it,
        //    so we can verify it's called while letting it manage internal state.
        const removeSchemaSpy = jest.spyOn(mockValidator, 'removeSchema');

        //    ***** CORRECTED MOCK IMPLEMENTATION FOR addSchema *****
        //    Similarly, let's spy on the base mock's `addSchema` to ensure it's called
        //    with the correct *new* schema data ('foo' version). The base mock
        //    should handle adding it to the internal map.
        const addSchemaSpy = jest.spyOn(mockValidator, 'addSchema');
        //    If the base addSchema throws on duplicate (which it might), we *would* need
        //    to override it for the test:
        //    mockValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
        //        if (schemaId === sharedComponentId) {
        //            mockValidator._setSchemaLoaded(schemaId, schemaData); // Use helper to force state update
        //            return Promise.resolve();
        //        }
        //        throw new Error(`Unexpected addSchema call in Phase 2 mock for ${schemaId}`);
        //    });
        //    However, since removeSchema should run first, the base addSchema should *not* see a duplicate.

        // --- Action: Load Foo (Phase 2) ---
        console.log("--- Starting Phase 2 Load ---");
        const loadPromiseFoo = loader.loadComponentDefinitions('foo', fooManifest);

        // --- Verification: Phase 2 Execution ---
        // Ensure the loading process completed without throwing an error.
        await expect(loadPromiseFoo).resolves.not.toThrow();
        // Get the result (count of loaded items)
        const count = await loadPromiseFoo;
        // Verify that exactly one item was loaded successfully.
        expect(count).toBe(1); // <<<<<< This assertion should now pass

        // --- Verification: Mock Interactions for Phase 2 ---

        // 1. Registry Interactions:
        //    - Check if `registry.get` was called once to detect the existing definition.
        expect(mockRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', sharedComponentId);
        //    - Check if `registry.store` was called once to store the *overriding* definition.
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        const expectedStoredObject = {
            ...fooSharedPositionDef, // The definition from 'foo' mod
            modId: 'foo',            // Mod ID updated to 'foo'
            _sourceFile: sharedFilename // Source file remains the same name, but context is 'foo'
        };
        expect(mockRegistry.store).toHaveBeenCalledWith(
            'component_definitions',
            sharedComponentId,
            // Use objectContaining to be flexible if extra properties are added later
            expect.objectContaining(expectedStoredObject)
        );

        // 2. Schema Validator Interactions (using spies):
        //    - isSchemaLoaded should have been called before removal attempt.
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(sharedComponentId);
        //    - removeSchema should have been called once with the correct ID.
        expect(removeSchemaSpy).toHaveBeenCalledTimes(1);
        expect(removeSchemaSpy).toHaveBeenCalledWith(sharedComponentId);
        //    - addSchema should have been called once with the *new* schema data.
        expect(addSchemaSpy).toHaveBeenCalledTimes(1);
        expect(addSchemaSpy).toHaveBeenCalledWith(fooSharedPositionDef.dataSchema, sharedComponentId);

        // 3. Logger Interactions:
        //    - Verify the expected warning messages for overwriting were logged.
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`overwriting an existing data schema for component ID '${sharedComponentId}'`)
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`overwriting existing component definition metadata for ID '${sharedComponentId}'`)
        );
        //    - Verify the debug log confirming successful removal of the old schema.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully removed existing schema '${sharedComponentId}' before overwriting.`)
        );
        //    - Verify the debug log confirming successful registration of the new schema.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Registered dataSchema for component ID '${sharedComponentId}' from file '${sharedFilename}'.`)
        );
        //    - Verify the debug log confirming successful storage of the new definition.
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully stored component definition metadata for '${sharedComponentId}' from file '${sharedFilename}'.`)
        );

        // --- Final State Check (Post Phase 2) ---
        // Although interactions are verified, directly checking the final state adds confidence.

        // 1. Check Registry State:
        //    Use the internal helper `_getData` for direct access without invoking mocks.
        const finalStoredData = mockRegistry._getData('component_definitions', sharedComponentId);
        expect(finalStoredData).toEqual(expect.objectContaining(expectedStoredObject));

        // 2. Check Validator State:
        //    Use the internal helper `_getLoadedSchemaData`.
        const finalSchemaData = mockValidator._getLoadedSchemaData(sharedComponentId);
        // Ensure the schema stored now matches the overriding mod's ('foo') schema.
        expect(finalSchemaData).toEqual(fooSharedPositionDef.dataSchema);

        console.log("--- Test Completed Successfully ---");
    });
});