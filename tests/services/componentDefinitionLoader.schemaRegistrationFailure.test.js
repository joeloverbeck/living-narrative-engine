// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../src/loaders/componentLoader.js';
import {BaseManifestItemLoader} from '../../src/loaders/baseManifestItemLoader.js'; // Import base class if needed

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
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
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
        addSchema: jest.fn(async (schemaData, schemaId) => {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
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
            if (validatorFn) {
                return validatorFn(data);
            }
            if(loadedSchemas.has(schemaId)){
                return {isValid: true, errors: null};
            }
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Base mock cannot validate unknown schema '${schemaId}'.`}]
            };
        }),
        mockValidatorFunction: (schemaId, implementation) => {
            const fn = schemaValidators.get(schemaId) || jest.fn();
            fn.mockImplementation(implementation);
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, {});
            }
            schemaValidators.set(schemaId, fn);
        },
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        },
        _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
        ...overrides,
    };
    return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 */
const createMockDataRegistry = (overrides = {}) => ({
    store: jest.fn((type, id, data) => {}),
    get: jest.fn((type, id) => undefined),
    getAll: jest.fn((type) => []),
    clear: jest.fn(),
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
        mockValidator._setSchemaLoaded(componentDefSchemaId);
        mockValidator.validate.mockImplementation((schemaId, data) => {
            if (schemaId === componentDefSchemaId) {
                return {isValid: true, errors: null};
            }
            const originalMockLogic = createMockSchemaValidator().validate;
            return originalMockLogic(schemaId, data);
        });
    });

    // --- Test Case: Scenario 1 (addSchema Failure) ---
    it('Scenario 1: should handle errors during addSchema', async () => {
        // --- Setup: Scenario 1 ---
        const filename = 'comp_add_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentIdFromFile = 'add_fail';
        const validDef = createMockComponentDefinition(componentIdFromFile, {
            type: 'object', properties: {value: {type: 'string'}}
        });
        const addSchemaError = new Error("Mock Validator Error: Failed to add schema");
        const manifest = createMockModManifest(modId, [filename]);

        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef)));
        mockValidator.addSchema.mockImplementation(async (schema, schemaId) => {
            if (schemaId === componentIdFromFile) { throw addSchemaError; }
        });
        mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
            return schemaId === componentDefSchemaId || schemaId === 'some_other_schema_id'; // Primary is loaded, component is not
        });

        // --- Action ---
        const loadPromise = loader.loadItemsForMod(
            modId, manifest, 'components', 'components', 'components'
        );

        // --- Verify: Promise Resolves & Result Object --- // <<< MODIFIED Verification
        await expect(loadPromise).resolves.not.toThrow();
        const result = await loadPromise; // <<< CAPTURE result object
        // Assert the entire result object structure
        expect(result).toEqual({ count: 0, errors: 1, overrides: 0 }); // <<< CHECK Full Result

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Called by _validatePrimarySchema
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, validDef);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefSchemaId); // Checked by _validatePrimarySchema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile); // Checked by _processFetchedItem
        expect(mockValidator.removeSchema).not.toHaveBeenCalled(); // addSchema fails before removeSchema is relevant here
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentIdFromFile);
        expect(mockRegistry.get).not.toHaveBeenCalled(); // Skipped due to addSchema error
        expect(mockRegistry.store).not.toHaveBeenCalled(); // Skipped due to addSchema error

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific + Wrapper
        // 1. Inner Log (_processFetchedItem addSchema catch block)
        const expectedInnerLogMessageAdd = `ComponentLoader [${modId}]: Error during addSchema for component '${componentIdFromFile}' from file '${filename}'.`;
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, expectedInnerLogMessageAdd, expect.objectContaining({ componentId: componentIdFromFile, error: addSchemaError }), addSchemaError);
        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgAdd = `Error processing file:`;
        expect(mockLogger.error).toHaveBeenNthCalledWith(2, expectedWrapperMsgAdd, expect.objectContaining({ filename: filename, path: filePath, error: addSchemaError.message }), addSchemaError);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(`ComponentLoader: Loading components definitions for mod '${modId}'.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`); // Correct summary expected
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });


    // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
    it('Scenario 2: should handle errors during removeSchema on override', async () => {
        // --- Setup: Scenario 2 ---
        const filename = 'comp_remove_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentIdFromFile = 'remove_fail';
        const overrideDef = createMockComponentDefinition(componentIdFromFile, {properties: {version: {const: 2}}});
        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef)));
        // Simulate override: BOTH primary and component schema are loaded initially
        mockValidator.isSchemaLoaded.mockImplementation(schemaId => {
            return schemaId === componentDefSchemaId || schemaId === componentIdFromFile;
        });
        // Configure removeSchema to THROW
        mockValidator.removeSchema.mockImplementation((schemaId) => {
            if (schemaId === componentIdFromFile) { throw removeSchemaError; }
            const originalMock = createMockSchemaValidator(); // Keep default behavior for others
            return originalMock.removeSchema(schemaId);
        });

        // --- Action ---
        const loadPromise = loader.loadItemsForMod(
            modId, manifest, 'components', 'components', 'components'
        );

        // --- Verify: Promise Resolves & Result Object --- // <<< MODIFIED Verification
        await expect(loadPromise).resolves.not.toThrow();
        const result = await loadPromise; // <<< CAPTURE result object
        // Assert the entire result object structure - should be 0 success, 1 error
        expect(result).toEqual({ count: 0, errors: 1, overrides: 0 }); // <<< CHECK Full Result

        // --- Verify: Mock Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.validate).toHaveBeenCalledTimes(1); // Called by _validatePrimarySchema
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, overrideDef);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefSchemaId); // Checked by _validatePrimarySchema
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentIdFromFile); // Checked by _processFetchedItem override check
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1); // removeSchema WAS attempted
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentIdFromFile);
        // Subsequent steps skipped due to re-thrown removeSchema error
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockRegistry.get).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific + Wrapper
        // 1. Inner Log (_processFetchedItem removeSchema catch block - NOW re-throws)
        const expectedInnerLogMessageRemove = `ComponentLoader [${modId}]: Error during removeSchema for component '${componentIdFromFile}' from file '${filename}'.`;
        expect(mockLogger.error).toHaveBeenNthCalledWith(1, expectedInnerLogMessageRemove, expect.objectContaining({ componentId: componentIdFromFile, error: removeSchemaError }), removeSchemaError);
        // 2. Wrapper Log (_processFileWrapper catch block)
        const expectedWrapperMsgRemove = `Error processing file:`;
        expect(mockLogger.error).toHaveBeenNthCalledWith(2, expectedWrapperMsgRemove, expect.objectContaining({ filename: filename, path: filePath, error: removeSchemaError.message }), removeSchemaError);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith(`ComponentLoader: Loading components definitions for mod '${modId}'.`);
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`); // Correct summary expected

        // --- Verify: Warnings ---
        // The schema override warning should still fire *before* removeSchema is called and fails
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`overwriting an existing data schema for component ID '${componentIdFromFile}'`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`overwriting existing component definition metadata`)); // Skipped
    });
});