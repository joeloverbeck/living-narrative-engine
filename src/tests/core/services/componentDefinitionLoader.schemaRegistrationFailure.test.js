// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../../core/services/componentLoader.js';
import {BaseManifestItemLoader} from '../../../core/services/baseManifestItemLoader.js'; // Import base class if needed

// --- Mock Service Factories ---

/**
 * Creates a mock IConfiguration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'components') {
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        // --- MODIFICATION: Explicitly handle mod-manifest ---
        if (typeName === 'mod-manifest') {
            return 'http://example.com/schemas/mod.manifest.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'), // Ensure this exists
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    ...overrides,
});

/**
 * Creates a mock IPathResolver service.
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
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
    fetch: jest.fn(async (path) => {
        if (errorPaths.includes(path)) {
            return Promise.reject(new Error(`Mock Fetch Error: Failed to fetch ${path}`));
        }
        if (path in pathToResponse) {
            // Ensure deep copy to prevent mutation issues
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        // Default behavior: reject if path not found
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for ${path}`));
    }),
});

/**
 * Creates a mock ISchemaValidator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();
    const mockValidator = {
        // Default addSchema implementation (can be overridden per test)
        addSchema: jest.fn(async (schemaData, schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                console.warn(`Mock Schema Warning: Schema ID '${schemaId}' already exists.`);
                // Simulate potential conflict or just overwrite silently depending on desired base behavior
                // loadedSchemas.set(schemaId, schemaData); // Option: Overwrite
                throw new Error(`Mock Schema Error: Base mock detected Schema ID '${schemaId}' already exists.`); // Option: Throw
            }
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        }),
        // Default removeSchema implementation (can be overridden per test)
        removeSchema: jest.fn((schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                loadedSchemas.delete(schemaId);
                schemaValidators.delete(schemaId);
                return true; // Success
            }
            return false; // Not found
        }),
        // Default isSchemaLoaded implementation
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        // Default getValidator implementation
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
        // Default validate implementation (can be overridden per test)
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data); // Use registered validator if exists
            }
            // Default: fail validation if schema unknown
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }),
        // Helper to mock a specific schema's validator function
        mockValidatorFunction: (schemaId, implementation) => {
            const fn = schemaValidators.get(schemaId) || jest.fn();
            fn.mockImplementation(implementation);
            if (!loadedSchemas.has(schemaId)) { // Ensure schema is considered loaded if validator is mocked
                loadedSchemas.set(schemaId, {});
            }
            schemaValidators.set(schemaId, fn);
        },
        // Helper to directly set schema loaded state for test setup
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        },
        // Helper to check internal state (use with caution)
        _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
        // Apply any overrides provided when creating the mock
        ...overrides,
    };
    return mockValidator;
};


/**
 * Creates a mock IDataRegistry service.
 */
const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn((type, id, data) => { /* Default success: do nothing */
    }),
    get: jest.fn((type, id) => undefined), // Default: not found
    getAll: jest.fn((type) => []), // Default: empty
    clear: jest.fn(),
    // Add other methods if needed by Base Class validation or other tests
    ...overrides,
});

/**
 * Creates a mock ILogger service.
 */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    ...overrides,
});

/**
 * Creates a basic valid mock component definition object.
 */
const createMockComponentDefinition = (id, dataSchema = {type: 'object', properties: {}}, description = '') => ({
    id: id, dataSchema: dataSchema, ...(description && {description: description}),
});

/**
 * Creates a basic mock Mod Manifest object.
 */
const createMockModManifest = (modId, componentFiles = []) => ({
    id: modId, name: `Mock Mod ${modId}`, version: '1.0.0', content: {components: componentFiles},
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
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        loader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // --- Base setup common ---
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);
        mockValidator._setSchemaLoaded(componentDefSchemaId); // Ensure main schema is loaded
        mockValidator.validate.mockImplementation((schemaId, data) => {
            if (schemaId === componentDefSchemaId) {
                // Assume the overall component definition structure is valid for these tests
                return {isValid: true, errors: null};
            }
            // Fallback for other schema validations (though not expected here)
            const originalMock = createMockSchemaValidator();
            return originalMock.validate(schemaId, data);
        });
    });

    // --- Test Case: Scenario 1 (addSchema Failure) ---
    it('Scenario 1: should handle errors during addSchema', async () => {
        // --- Setup: Scenario 1 ---
        const filename = 'comp_add_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        // ID in the file is expected to be the base ID for component schema registration logic in the loader
        const componentIdFromFile = 'add_fail';
        const validDef = createMockComponentDefinition(componentIdFromFile, { // Use ID from file
            type: 'object',
            properties: {value: {type: 'string'}}
        });
        const addSchemaError = new Error("Mock Validator Error: Failed to add schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Configure mocks specifically for this scenario:
        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef)));

        // Configure addSchema to fail for the component ID from the file
        mockValidator.addSchema.mockImplementation(async (schema, schemaId) => {
            if (schemaId === componentIdFromFile) {
                throw addSchemaError;
            }
        });
        mockValidator.isSchemaLoaded.mockReturnValue(false); // Simulate schema not loaded initially

        // --- Action ---
        // <<< CORRECTION: Use loadItemsForMod >>>
        const loadPromise = loader.loadItemsForMod(
            modId,           // modId
            manifest,        // modManifest
            'components',    // contentKey
            'components',    // contentTypeDir
            'components'     // typeName
        );

        // --- Verify: Promise Resolves & Count ---
        // Promise should resolve because _loadItemsInternal uses Promise.allSettled
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0); // Check count is 0 due to failure

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, validDef);
        // Check isSchemaLoaded with ID from file
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile);
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // Verify addSchema was attempted with ID from file
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentIdFromFile);

        // Verify subsequent steps skipped
        expect(mockRegistry.get).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific + Wrapper

        // 1. Inner Log (_processFetchedItem addSchema catch block)
        const expectedInnerLogMessageAdd = `ComponentLoader [${modId}]: Error during addSchema for component '${componentIdFromFile}' from file '${filename}'.`;
        const expectedInnerDetailsAdd = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentIdFromFile,
            error: addSchemaError // Pass the error object itself
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(1,
            expectedInnerLogMessageAdd,
            expectedInnerDetailsAdd,
            addSchemaError // Third argument is the error object
        );

        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgAdd = `Error processing file:`;
        const expectedWrapperDetailsAdd = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            typeName: 'components',
            error: addSchemaError.message // Wrapper logs error message string
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(2,
            expectedWrapperMsgAdd,
            expectedWrapperDetailsAdd,
            addSchemaError // Third argument is the error object
        );

        // --- Verify: Final Info Log ---
        // <<< MODIFIED EXPECTATION: Check for the new log messages >>>
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and summary logs
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
        // ID in the file is expected to be the base ID for component schema registration logic
        const componentIdFromFile = 'remove_fail';
        const overrideDef = createMockComponentDefinition(componentIdFromFile, {properties: {version: {const: 2}}});
        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Configure mocks specifically for this scenario:
        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef)));

        // Simulate override conditions: Schema *is* loaded (use ID from file)
        mockValidator.isSchemaLoaded.mockImplementation((id) => id === componentIdFromFile);

        // Configure removeSchema to THROW for the component ID from the file
        mockValidator.removeSchema.mockImplementation((schemaId) => {
            if (schemaId === componentIdFromFile) {
                throw removeSchemaError;
            }
            // Keep default factory behavior for other calls if any (though none expected)
            const originalMock = createMockSchemaValidator();
            return originalMock.removeSchema(schemaId);
        });

        // --- Action ---
        // <<< CORRECTION: Use loadItemsForMod >>>
        const loadPromise = loader.loadItemsForMod(
            modId,           // modId
            manifest,        // modManifest
            'components',    // contentKey
            'components',    // contentTypeDir
            'components'     // typeName
        );

        // --- Verify: Promise Resolves & Count ---
        // Promise should resolve because _loadItemsInternal uses Promise.allSettled
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0); // Check count is 0 due to failure

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, overrideDef);
        // Check isSchemaLoaded with ID from file
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile);

        // Verify removeSchema was attempted with ID from file
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentIdFromFile);

        // Verify subsequent steps skipped
        expect(mockRegistry.get).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled(); // Fails before addSchema is called again
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific + Wrapper

        // 1. Inner Log (_processFetchedItem removeSchema catch block)
        const expectedInnerLogMessageRemove = `ComponentLoader [${modId}]: Error during removeSchema for component '${componentIdFromFile}' from file '${filename}'.`;
        const expectedInnerDetailsRemove = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentIdFromFile,
            error: removeSchemaError // Pass the error object itself
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(1,
            expectedInnerLogMessageRemove,
            expectedInnerDetailsRemove,
            removeSchemaError // Third argument is the error object
        );

        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgRemove = `Error processing file:`;
        const expectedWrapperDetailsRemove = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            typeName: 'components',
            error: removeSchemaError.message // Wrapper logs error message string
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(2,
            expectedWrapperMsgRemove,
            expectedWrapperDetailsRemove,
            removeSchemaError // Third argument is the error object
        );

        // --- Verify: Final Info Log ---
        // <<< MODIFIED EXPECTATION: Check for the new log messages >>>
        expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and summary logs
        expect(mockLogger.info).toHaveBeenCalledWith(
            `ComponentLoader: Loading components definitions for mod '${modId}'.`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
        );

        // --- Verify: Warnings ---
        // The schema override warning (inside _processFetchedItem) should still fire *before* removeSchema fails
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`overwriting an existing data schema for component ID '${componentIdFromFile}'`));
        // The registry override warning is skipped because the error occurs before the registry check
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`overwriting existing component definition metadata`));
    });
});