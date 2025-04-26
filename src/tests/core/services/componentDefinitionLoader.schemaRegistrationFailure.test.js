// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js';

// --- Mock Service Factories ---
// ***** PASTE FULL, WORKING MOCK FACTORIES HERE *****
// Ensure these are the complete versions from previous examples

/**
 * Creates a mock IConfiguration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getContentBasePath: jest.fn((typeName) => `./data/mods/test-mod/${typeName}`),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'components') {
            return 'http://example.com/schemas/component-definition.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'), // <<< This was missing
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
            if (loadedSchemas.has(schemaId)) throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            loadedSchemas.set(schemaId, schemaData);
            schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
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
            return {isValid: false, errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found.`}]};
        }),
        mockValidatorFunction: (schemaId, implementation) => {
            const fn = schemaValidators.get(schemaId) || jest.fn();
            fn.mockImplementation(implementation);
            schemaValidators.set(schemaId, fn);
        },
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, schemaData);
                if (!schemaValidators.has(schemaId)) {
                    schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
                }
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
    store: jest.fn((type, id, data) => { /* Default success */
    }),
    get: jest.fn((type, id) => undefined), // Default empty
    getAll: jest.fn((type) => []),
    // Add other methods if needed by Base Class validation
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
        jest.clearAllMocks();
        // Instantiate with the *full* factories now
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        // This should no longer throw the TypeError
        loader = new ComponentDefinitionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        // Base setup: Main schema validation passes
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));
        // Default mock behaviors
        mockRegistry.get.mockReturnValue(undefined);
        mockValidator.isSchemaLoaded.mockReturnValue(false);
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

        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef)));
        mockValidator.addSchema.mockRejectedValue(addSchemaError); // Configure addSchema to fail
        mockValidator.isSchemaLoaded.mockReturnValue(false);
        mockRegistry.get.mockReturnValue(undefined);

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        // ***** CORRECTED VALIDATOR CHECK *****
        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, validDef);
        // ***** END CORRECTION *****
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', componentId);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId);
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentId);
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific catch + wrapper catch
        // 1. Specific addSchema failure log
        const expectedInnerLogMessageAdd = `ComponentDefinitionLoader [${modId}]: Failed to add dataSchema for component '${componentId}' from file '${filename}'.`;
        // ... (rest of inner log check)
        expect(mockLogger.error).toHaveBeenCalledWith(expectedInnerLogMessageAdd, expect.any(Object), addSchemaError);
        // 2. Wrapper error
        const expectedWrapperMsgAdd = `Error processing file:`;
        // ... (rest of wrapper log check)
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsgAdd, expect.any(Object), expect.objectContaining({originalError: addSchemaError}));

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);
        expect(mockLogger.warn).not.toHaveBeenCalled();
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

        mockResolver.resolveModContentPath.mockReturnValue(filePath);
        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef)));
        mockValidator.isSchemaLoaded.mockImplementation((id) => id === componentId || id === componentDefSchemaId); // Schema exists
        mockRegistry.get.mockReturnValue({id: componentId, modId: 'someOtherMod'}); // Simulate existing definition found
        mockValidator.removeSchema.mockImplementation((schemaId) => { // removeSchema throws
            if (schemaId === componentId) throw removeSchemaError;
            return false;
        });

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        // ***** CORRECTED VALIDATOR CHECK *****
        expect(mockValidator.validate).toHaveBeenCalledTimes(1);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, overrideDef);
        // ***** END CORRECTION *****
        // ***** CORRECTED REGISTRY.GET CHECK *****
        expect(mockRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', componentId);
        // ***** END CORRECTION *****
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId);
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentId);
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(2); // Specific catch + wrapper catch
        // 1. Specific removeSchema failure log
        const expectedInnerLogMessageRemove = `ComponentDefinitionLoader [${modId}]: Failed to remove existing dataSchema for component '${componentId}' during override attempt from file '${filename}'.`;
        // ... (rest of inner log check)
        expect(mockLogger.error).toHaveBeenCalledWith(expectedInnerLogMessageRemove, expect.any(Object), removeSchemaError);
        // 2. Wrapper error
        const expectedWrapperMsgRemove = `Error processing file:`;
        // ... (rest of wrapper log check)
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsgRemove, expect.any(Object), expect.objectContaining({originalError: removeSchemaError}));

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/1 components items. (1 failed)`);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Overwriting existing component definition with ID '${componentId}'`));
    });
});