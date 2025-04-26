// src/tests/core/services/componentDefinitionLoader.registryStoreFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Copied from existing tests for self-containment) ---
// [Mock factories createMockConfiguration, createMockPathResolver, etc. omitted for brevity]
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
            // Deep clone to prevent tests from modifying the mock response object
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
            // Default: succeed unless overridden
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.9: Registry Storage Failure)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const modId = 'storeFailMod';
    const filename = 'comp_store_fail.component.json';
    const filePath = `./data/mods/${modId}/components/${filename}`;
    const componentId = `${modId}:store_fail`;
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';
    const validDef = createMockComponentDefinition(componentId, {
        type: 'object',
        properties: {status: {type: 'string', enum: ['ok', 'error']}}
    });
    const manifest = createMockModManifest(modId, [filename]);
    const storageError = new Error("Mock Registry Error: Database connection lost");

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
        mockResolver.resolveModContentPath.mockImplementation((mId, type, fName) => (mId === modId && type === 'components' && fName === filename) ? filePath : `unexpected`);
        mockFetcher.fetch.mockImplementation(async (path) => (path === filePath) ? JSON.parse(JSON.stringify(validDef)) : Promise.reject(`Unexpected fetch: ${path}`));
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));
        mockValidator.addSchema.mockResolvedValue(undefined);
        mockValidator.removeSchema.mockReturnValue(false);
        mockRegistry.get.mockReturnValue(undefined);
        mockRegistry.store.mockImplementation((type, id) => { // Configure Store to Fail
            if (type === 'component_definitions' && id === componentId) throw storageError;
        });
    });

    // --- Test Case ---
    it('should handle errors during registry storage', async () => {
        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Pre-Storage Steps Succeeded ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);
        const mainValidatorFn = mockValidator.getValidator(componentDefSchemaId);
        expect(mainValidatorFn).toHaveBeenCalledWith(validDef);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId);
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentId);
        expect(mockRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', componentId);

        // --- Verify: Storage Attempt and Failure ---
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith('component_definitions', componentId, expect.objectContaining(validDef));

        // --- Verify: Error Logs (Order Matters) ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3);

        // 1. Specific storage error log (_processFetchedItem inner catch)
        const expectedInnerErrorMessage = `ComponentDefinitionLoader [${modId}]: CRITICAL: Failed to store component definition metadata for '${componentId}' (from file '${filename}') in registry.`;
        const expectedInnerErrorObject = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            path: filePath,
            error: storageError
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedInnerErrorMessage, expectedInnerErrorObject);

        // 2. Item processing error log (_processFetchedItem outer catch)
        const expectedOuterErrorMessage = `ComponentDefinitionLoader [${modId}]: Error processing component definition file '${filePath}'. Error: CRITICAL: Failed to store component definition metadata for '${componentId}' (from file '${filename}') in registry. Error: ${storageError.message}`;
        const expectedOuterErrorObject = expect.objectContaining({
            modId: modId,
            filename: filename,
            componentId: componentId,
            path: filePath,
            error: expect.objectContaining({
                message: expect.stringContaining(storageError.message),
                reason: 'Registry Storage Error'
            })
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedOuterErrorMessage, expectedOuterErrorObject);

        // 3. Base loader file processing wrapper log (_processFileWrapper catch)
        const expectedWrapperErrorMessage = `Error processing file:`;
        const expectedWrapperErrorObject = expect.objectContaining({
            modId: modId,
            filename: filename,
            path: filePath,
            error: expect.stringContaining(storageError.message)
        });
        const expectedWrapperErrorArg = expect.objectContaining({
            message: expect.stringContaining(storageError.message),
            reason: 'Registry Storage Error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperErrorMessage, expectedWrapperErrorObject, expectedWrapperErrorArg);

        // --- Verify: Final Summary Log ---
        // *CORRECTED: Check INFO log with correct format*
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [${modId}] - Processed 0/1 components items. (1 failed)` // Correct message format
        );
        // *CORRECTED: Ensure WARN was NOT called for the summary*
        expect(mockLogger.warn).not.toHaveBeenCalled();


        // --- Verify: Debug Logs ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing component file: ${filename}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered dataSchema for component ID '${componentId}'`));
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Successfully stored component definition metadata'));
        // Base class debug logs
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Resolved path for ${filename}: ${filePath}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(`[${modId}] Fetched data from ${filePath}`);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(`[${modId}] Successfully processed ${filename}`);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[${modId}] Failed processing ${filename}. Reason:`));

    });
});