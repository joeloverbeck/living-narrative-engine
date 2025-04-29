// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../../core/loaders/componentLoader.js';
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Import base class if needed

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
    getRuleBasePath: jest.fn().mockReturnValue('rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
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
            // Base mock behavior: simply add or overwrite
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
            // Use specific validator function if mocked
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data);
            }
            // If no specific function, check if schema is considered loaded
            if(loadedSchemas.has(schemaId)){
                // Default pass if loaded but no specific mock function
                return {isValid: true, errors: null};
            }
            // Default: fail validation if schema unknown
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Base mock cannot validate unknown schema '${schemaId}'.`}]
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
        // Create the validator BUT don't apply overrides here that might conflict with specific tests
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        loader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // --- Base setup common ---
        // Ensure config returns the primary schema ID
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);
        // Mark the primary schema as loaded using the internal helper of the mock.
        // This sets the internal state without overriding the mock function itself.
        mockValidator._setSchemaLoaded(componentDefSchemaId);
        // Make the default validate behavior pass for the primary schema ID
        mockValidator.validate.mockImplementation((schemaId, data) => {
            if (schemaId === componentDefSchemaId) {
                return {isValid: true, errors: null};
            }
            // Fallback for other schema validations (calls original mock logic)
            const originalMockLogic = createMockSchemaValidator().validate;
            return originalMockLogic(schemaId, data);
        });
        // DO NOT mock isSchemaLoaded globally here, let each test handle it.
    });

    // --- Test Case: Scenario 1 (addSchema Failure) ---
    it('Scenario 1: should handle errors during addSchema', async () => {
        // --- Setup: Scenario 1 ---
        const filename = 'comp_add_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentIdFromFile = 'add_fail'; // Use ID from file
        const validDef = createMockComponentDefinition(componentIdFromFile, {
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
            // Default pass for other calls if any
        });

        // *** CORRECTED MOCK for isSchemaLoaded ***
        // It needs to return true for the primary schema, false for the component schema
        mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
            if (schemaId === componentDefSchemaId) {
                return true; // Primary schema IS loaded
            }
            if (schemaId === componentIdFromFile) {
                return false; // Component data schema is NOT loaded initially
            }
            return false; // Default fallback
        });

        // --- Action ---
        const loadPromise = loader.loadItemsForMod(
            modId, manifest, 'components', 'components', 'components'
        );

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);

        // *** Verify validate WAS called (now that isSchemaLoaded is correct) ***
        expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Called once by _validatePrimarySchema
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, validDef);

        // Check isSchemaLoaded calls
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefSchemaId); // Checked by _validatePrimarySchema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile); // Checked by _processFetchedItem

        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // Verify addSchema was attempted
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
            modId: modId, filename: filename, componentId: componentIdFromFile, error: addSchemaError
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, expectedInnerLogMessageAdd, expectedInnerDetailsAdd, addSchemaError);

        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgAdd = `Error processing file:`;
        const expectedWrapperDetailsAdd = expect.objectContaining({
            modId: modId, filename: filename, path: filePath, typeName: 'components', error: addSchemaError.message
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(2, expectedWrapperMsgAdd, expectedWrapperDetailsAdd, addSchemaError);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(`ComponentLoader: Loading components definitions for mod '${modId}'.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });


    // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
    it('Scenario 2: should handle errors during removeSchema on override', async () => {
        // --- Setup: Scenario 2 ---
        const filename = 'comp_remove_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentIdFromFile = 'remove_fail'; // Use ID from file
        const overrideDef = createMockComponentDefinition(componentIdFromFile, {properties: {version: {const: 2}}});
        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Configure mocks specifically for this scenario:
        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef)));

        // *** CORRECTED MOCK for isSchemaLoaded ***
        // Simulate override: BOTH primary and component schema are loaded initially
        mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
            if (schemaId === componentDefSchemaId) {
                return true; // Primary schema IS loaded
            }
            if (schemaId === componentIdFromFile) {
                return true; // Component data schema IS loaded (for override)
            }
            return false; // Default fallback
        });

        // Configure removeSchema to THROW for the component ID from the file
        mockValidator.removeSchema.mockImplementation((schemaId) => {
            if (schemaId === componentIdFromFile) {
                throw removeSchemaError;
            }
            // Keep default factory behavior for other calls if any
            const originalMock = createMockSchemaValidator();
            return originalMock.removeSchema(schemaId);
        });

        // --- Action ---
        const loadPromise = loader.loadItemsForMod(
            modId, manifest, 'components', 'components', 'components'
        );

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);

        // *** Verify validate WAS called (now that isSchemaLoaded is correct) ***
        expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Called once by _validatePrimarySchema
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, overrideDef);

        // Check isSchemaLoaded calls
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefSchemaId); // Checked by _validatePrimarySchema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile); // Checked by _processFetchedItem

        // Verify removeSchema was attempted
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentIdFromFile);

        // Verify subsequent steps skipped
        expect(mockRegistry.get).not.toHaveBeenCalled();
        // addSchema should not be called again because removeSchema threw
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific + Wrapper

        // 1. Inner Log (_processFetchedItem removeSchema catch block)
        const expectedInnerLogMessageRemove = `ComponentLoader [${modId}]: Error during removeSchema for component '${componentIdFromFile}' from file '${filename}'.`;
        const expectedInnerDetailsRemove = expect.objectContaining({
            modId: modId, filename: filename, componentId: componentIdFromFile, error: removeSchemaError
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, expectedInnerLogMessageRemove, expectedInnerDetailsRemove, removeSchemaError);

        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgRemove = `Error processing file:`;
        const expectedWrapperDetailsRemove = expect.objectContaining({
            modId: modId, filename: filename, path: filePath, typeName: 'components', error: removeSchemaError.message
        });
        expect(mockLogger.error).toHaveBeenNthCalledWith(2, expectedWrapperMsgRemove, expectedWrapperDetailsRemove, removeSchemaError);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(`ComponentLoader: Loading components definitions for mod '${modId}'.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);

        // --- Verify: Warnings ---
        // The schema override warning should still fire *before* removeSchema fails
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`overwriting an existing data schema for component ID '${componentIdFromFile}'`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`overwriting existing component definition metadata`)); // Skipped
    });
});