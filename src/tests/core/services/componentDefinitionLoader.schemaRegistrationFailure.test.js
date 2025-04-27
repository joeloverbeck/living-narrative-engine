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

describe('ComponentDefinitionLoader (Sub-Ticket 6.8: Data Schema Registration Failure)', () => {
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
        jest.clearAllMocks(); // Reset mocks completely before each test
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator(); // Uses factory defaults initially
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        loader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // --- Base setup common to both scenarios ---
        // Ensure the main component definition schema ID is configured
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);

        // Ensure validation against the main definition schema itself passes
        // We use mockImplementation here to override the default factory behavior only for this specific schema ID
        mockValidator.validate.mockImplementation((schemaId, data) => {
            if (schemaId === componentDefSchemaId) {
                // Assume the component definition structure itself is valid for these tests
                return {isValid: true, errors: null};
            }
            // Let other validate calls use the factory default (or fail)
            // Be careful: This might need adjustment if other schemas are involved.
            const originalMock = createMockSchemaValidator(); // Get default behaviour reference if needed
            return originalMock.validate(schemaId, data);
            // Or explicitly fail:
            // return { isValid: false, errors: [{ message: `Mock Schema Error: Unexpected schema validation call for '${schemaId}'.` }] };
        });

        // NOTE: We are NOT setting default success/failure for addSchema/removeSchema here.
        // They will be configured specifically within each test case ('it' block).
        // Default behaviors from the factory (like isSchemaLoaded, get, store) remain unless overridden in a test.
    });

    // --- Test Case: Scenario 1 (addSchema Failure) ---
    it('Scenario 1: should handle errors during addSchema', async () => {
        // --- Setup: Scenario 1 ---
        const filename = 'comp_add_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentId = `${modId}:add_fail`;
        const validDef = createMockComponentDefinition(componentId, {
            type: 'object',
            properties: {value: {type: 'string'}}
        });
        const addSchemaError = new Error("Mock Validator Error: Failed to add schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Configure mocks specifically for this scenario:
        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef))); // Fetch succeeds

        // ** Configure addSchema to REJECT for this test **
        mockValidator.addSchema.mockRejectedValue(addSchemaError);

        // Ensure prerequisites for calling addSchema are met (if applicable):
        mockValidator.isSchemaLoaded.mockReturnValue(false); // Simulate schema not loaded initially
        // mockRegistry.get.mockReturnValue(undefined); // No longer needed to mock this, as it won't be called

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        // The loader's public method should catch errors internally and resolve
        await expect(loadPromise).resolves.not.toThrow();
        // The count of successfully loaded items should be 0
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Mock Calls ---
        // Verify expected sequence of calls leading up to the failure point
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, validDef); // Definition structure validated
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId); // Checked schema existence
        expect(mockValidator.removeSchema).not.toHaveBeenCalled(); // Remove should NOT be called if isSchemaLoaded was false

        // ** Verify addSchema was attempted **
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentId);

        // ** Verify subsequent steps were skipped due to error **
        // ***** MODIFICATION START *****
        expect(mockRegistry.get).not.toHaveBeenCalled(); // get should NOT be called because addSchema failed
        // ***** MODIFICATION END *****
        expect(mockRegistry.store).not.toHaveBeenCalled(); // store should NOT be called

        // --- Verify: Error Logs ---
        // Expect 2 error logs: one from the specific catch block, one from the wrapper
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // 1. Inner Log (addSchema catch block in _processFetchedItem)
        const expectedInnerLogMessageAdd = `ComponentDefinitionLoader [${modId}]: Error during addSchema for component '${componentId}' from file '${filename}'.`;
        const expectedInnerDetailsAdd = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            error: addSchemaError // Keep original error in details object check
        });
        // Verify the inner log call - check message, details, and error type/message instead of exact reference
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedInnerLogMessageAdd,
            expectedInnerDetailsAdd,
            expect.objectContaining({ // Check the error object passed as the 3rd arg
                message: addSchemaError.message
            })
            // Alternative: expect.any(Error) if only type matters
            // expect.any(Error)
        );

        // 2. Wrapper Log (_processFileWrapper catch block in BaseManifestItemLoader)
        const expectedWrapperMsgAdd = `Error processing file:`;
        const expectedWrapperDetailsAdd = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            error: addSchemaError.message // Code uses error.message || String(error)
        });
        // Verify the wrapper log call - check message, details, and error type/message
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedWrapperMsgAdd,
            expectedWrapperDetailsAdd,
            expect.objectContaining({ // Check the error object passed as the 3rd arg
                message: addSchemaError.message
            })
            // Alternative: expect.any(Error)
        );


        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No override warnings expected here
    });


    // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
    it('Scenario 2: should handle errors during removeSchema on override', async () => {
        // --- Setup: Scenario 2 ---
        const filename = 'comp_remove_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentId = `${modId}:remove_fail`;
        const overrideDef = createMockComponentDefinition(componentId, {properties: {version: {const: 2}}});
        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Configure mocks specifically for this scenario:
        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef))); // Fetch succeeds

        // Simulate override conditions:
        mockValidator.isSchemaLoaded.mockImplementation((id) => id === componentId); // Schema *is* loaded
        // mockRegistry.get.mockReturnValue({id: componentId, modId: 'someOtherMod'}); // No longer needed to mock this, as it won't be called

        // ** Configure removeSchema to THROW for this test **
        mockValidator.removeSchema.mockImplementation((schemaId) => {
            if (schemaId === componentId) {
                throw removeSchemaError; // Throw the specific error when called for this ID
            }
            throw new Error(`Mock removeSchema Error: Unexpected call for schemaId '${schemaId}'`);
        });

        // Ensure addSchema retains its default behavior (or define if needed, though it shouldn't be called)
        // mockValidator.addSchema.mockResolvedValue(undefined); // Default factory behavior should suffice

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow(); // Loader catches internal errors
        const count = await loadPromise;
        expect(count).toBe(0); // Failed to process the item

        // --- Verify: Mock Calls ---
        // Verify expected sequence leading up to the failure
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, overrideDef); // Definition validated
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId); // Checked schema

        // ** Verify removeSchema was attempted **
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1); // Should be called exactly once
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentId);

        // ** Verify subsequent steps were skipped due to error **
        // ***** MODIFICATION START *****
        expect(mockRegistry.get).not.toHaveBeenCalled(); // get should NOT be called because removeSchema failed
        // ***** MODIFICATION END *****
        expect(mockValidator.addSchema).not.toHaveBeenCalled(); // addSchema should NOT be called
        expect(mockRegistry.store).not.toHaveBeenCalled(); // store should NOT be called

        // --- Verify: Error Logs ---
        // Expect 2 error logs: one from the specific catch block, one from the wrapper
        expect(mockLogger.error).toHaveBeenCalledTimes(2);

        // 1. Inner Log (removeSchema catch block in _processFetchedItem)
        const expectedInnerLogMessageRemove = `ComponentDefinitionLoader [${modId}]: Error during removeSchema for component '${componentId}' from file '${filename}'.`;
        const expectedInnerDetailsRemove = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            error: removeSchemaError // Keep original error in details object check
        });
        // Verify the inner log call - check message, details, and error type/message instead of exact reference
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedInnerLogMessageRemove,
            expectedInnerDetailsRemove,
            expect.objectContaining({ // Check the error object passed as the 3rd arg
                message: removeSchemaError.message
            })
            // Alternative: expect.any(Error)
        );

        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgRemove = `Error processing file:`;
        const expectedWrapperDetailsRemove = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            error: removeSchemaError.message // Code uses error.message || String(error)
        });
        // Verify the wrapper log call - check message, details, and error type/message
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedWrapperMsgRemove,
            expectedWrapperDetailsRemove,
            expect.objectContaining({ // Check the error object passed as the 3rd arg
                message: removeSchemaError.message
            })
            // Alternative: expect.any(Error)
        );


        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);

        // --- Verify: Warnings ---
        // Warnings for override attempt should still be logged *before* the error occurs
        // ***** MODIFICATION START *****
        // The warning related to the registry override check (line 138 in componentDefinitionLoader.js) will NOT fire
        // because the removeSchema error prevents reaching that point.
        // Only the warning for the schema override (line 115) should fire.
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only ONE warning should have fired
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`overwriting an existing data schema for component ID '${componentId}'`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`overwriting existing component definition metadata for ID '${componentId}'`));
        // ***** MODIFICATION END *****

    });
});