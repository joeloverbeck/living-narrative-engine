// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

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
// --- Mock Service Factories (Copied from existing tests for self-containment) ---

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
            // Default behavior: succeed unless overridden
            if (loadedSchemas.has(schemaId)) {
                throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            }
            loadedSchemas.set(schemaId, schemaData);
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }),
        removeSchema: jest.fn((schemaId) => {
            // Default behavior: succeed if schema exists, unless overridden
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
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }),
        // Helper to configure validator behavior
        mockValidatorFunction: (schemaId, implementation) => {
            if (schemaValidators.has(schemaId)) {
                schemaValidators.get(schemaId).mockImplementation(implementation);
            } else {
                const newMockFn = jest.fn(implementation);
                schemaValidators.set(schemaId, newMockFn);
            }
        },
        // Helper to simulate schema loading for tests
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, schemaData);
                if (!schemaValidators.has(schemaId)) {
                    const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                    schemaValidators.set(schemaId, mockValidationFn);
                }
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
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        loader = new ComponentDefinitionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));
        mockRegistry.get.mockReturnValue(undefined); // Default: registry is empty
        mockValidator.isSchemaLoaded.mockReturnValue(false); // Default: schema not loaded
    });

    // --- Test Case: Scenario 1 (addSchema Failure) ---
    // [Scenario 1 test code omitted for brevity - assume it's correct from previous step]
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

        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(validDef)));
        mockValidator.addSchema.mockRejectedValue(addSchemaError); // Configure addSchema to fail

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Calls ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);
        const mainValidatorFn = mockValidator.getValidator(componentDefSchemaId);
        expect(mainValidatorFn).toHaveBeenCalledWith(validDef);

        // --- Verify: addSchema was called and failed ---
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentId);

        // --- Verify: store/removeSchema NOT called ---
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3); // Inner catch + outer catch + wrapper catch

        // 1. Specific addSchema failure log (_processFetchedItem inner registration catch)
        const expectedInnerLogMessage = `ComponentDefinitionLoader [${modId}]: Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'.`;
        const expectedInnerLogDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            error: addSchemaError, // The original error object
            resolvedPath: filePath,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedInnerLogMessage, expectedInnerLogDetails);

        // 2. Outer catch error (_processFetchedItem outer catch)
        const expectedOuterCatchMsg = `ComponentDefinitionLoader [${modId}]: Error processing component definition file '${filePath}'. Error: Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'. Error: ${addSchemaError.message}`;
        const expectedOuterCatchDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId, // ID was valid before registration failure
            path: filePath,
            error: expect.objectContaining({ // The wrapped error object
                message: expect.stringContaining(`Failed during dataSchema registration steps for component '${componentId}'`),
                reason: 'Schema Registration Error',
                resolvedPath: filePath
            }),
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterCatchMsg, expectedOuterCatchDetails);

        // 3. Wrapper error (_processFileWrapper catch) - *CORRECTED CHECK*
        const expectedWrapperMsg = `Error processing file:`;
        const expectedWrapperDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            error: expect.stringContaining(`Failed during dataSchema registration steps for component '${componentId}'`),
        });
        const expectedWrapperErrorArg = expect.objectContaining({ // The actual error object
            message: expect.stringContaining(`Failed during dataSchema registration steps for component '${componentId}'`),
            reason: 'Schema Registration Error',
            resolvedPath: filePath
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails, expectedWrapperErrorArg);

        // --- Verify: Final Info Log ---
        // *Correction:* Use INFO log for summary
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
        );
        expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings expected
    });


    // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
    it('Scenario 2: should handle errors during removeSchema on override', async () => {
        // --- Setup: Scenario 2 ---
        const filename = 'comp_remove_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentId = `${modId}:remove_fail`;

        const originalDef = createMockComponentDefinition(componentId, {
            type: 'object',
            properties: {version: {const: 1}}
        });
        const overrideDef = createMockComponentDefinition(componentId, {
            type: 'object',
            properties: {version: {const: 2}}
        });
        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Simulate original schema exists, but definition might not be in registry yet (or we don't care for this test)
        mockValidator.isSchemaLoaded.mockImplementation((id) => id === componentId); // Schema exists

        mockFetcher.fetch.mockResolvedValue(JSON.parse(JSON.stringify(overrideDef)));
        mockValidator.removeSchema.mockImplementation((schemaId) => { // removeSchema throws
            if (schemaId === componentId) throw removeSchemaError;
            return true;
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
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);
        const mainValidatorFn = mockValidator.getValidator(componentDefSchemaId);
        expect(mainValidatorFn).toHaveBeenCalledWith(overrideDef);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId); // Check override detection

        // --- Verify: removeSchema was called and failed ---
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentId);

        // --- Verify: Methods NOT called after failure ---
        expect(mockValidator.addSchema).not.toHaveBeenCalled(); // addSchema is skipped
        expect(mockRegistry.store).not.toHaveBeenCalled(); // store is skipped
        // *CORRECTED:* Registry 'get' should NOT be called as error happened before that check
        expect(mockRegistry.get).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3);

        // 1. Specific removeSchema failure log (_processFetchedItem inner registration catch)
        const expectedInnerLogMessage = `ComponentDefinitionLoader [${modId}]: Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}.`;
        const expectedInnerLogDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            path: filePath,
            error: removeSchemaError,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedInnerLogMessage, expectedInnerLogDetails);

        // 2. Outer catch error (_processFetchedItem outer catch)
        const expectedOuterCatchMsg = `ComponentDefinitionLoader [${modId}]: Error processing component definition file '${filePath}'. Error: Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}. Error: ${removeSchemaError.message}`;
        const expectedOuterCatchDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            path: filePath,
            error: expect.objectContaining({
                message: expect.stringContaining(`Error during removeSchema for component '${componentId}'`),
                reason: 'Schema Registration Error',
                resolvedPath: filePath
            }),
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterCatchMsg, expectedOuterCatchDetails);

        // 3. Wrapper error (_processFileWrapper catch)
        const expectedWrapperMsg = `Error processing file:`;
        const expectedWrapperDetails = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            error: expect.stringContaining(`Error during removeSchema for component '${componentId}'`),
        });
        const expectedWrapperErrorArg = expect.objectContaining({
            message: expect.stringContaining(`Error during removeSchema for component '${componentId}'`),
            reason: 'Schema Registration Error',
            resolvedPath: filePath
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails, expectedWrapperErrorArg);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${modId}] - Processed 0/1 components items. (1 failed)`
        );

        // --- Verify State: Original schema should still be 'loaded' according to mock ---
        expect(mockValidator.isSchemaLoaded(componentId)).toBe(true);
    });
});