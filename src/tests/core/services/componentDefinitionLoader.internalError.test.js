// src/tests/core/services/componentDefinitionLoader.internalError.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // Adjust path if necessary

// --- Mock Service Factories (Copied from previous test files for self-containment) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
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
 * @returns {import('../../../src/core/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
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
 * @returns {import('../../../src/core/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
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
 * @returns {import('../../../src/core/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();

    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                throw new Error(`Mock Schema Error: Schema with ID '${schemaId}' already exists.`);
            }
            loadedSchemas.set(schemaId, schemaData);
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
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
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)), // Use default implementation
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
        mockValidatorFunction: (schemaId, implementation) => {
            if (schemaValidators.has(schemaId)) {
                schemaValidators.get(schemaId).mockImplementation(implementation);
            } else {
                const newMockFn = jest.fn(implementation);
                schemaValidators.set(schemaId, newMockFn);
            }
        },
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, schemaData);
                if (!schemaValidators.has(schemaId)) {
                    const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                    schemaValidators.set(schemaId, mockValidationFn);
                }
            }
        },
        getAddedSchema: (schemaId) => loadedSchemas.get(schemaId),
        ...overrides,
    };
    return mockValidator;
};

/**
 * Creates a mock IDataRegistry service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../src/core/interfaces/coreServices.js').IDataRegistry} Mocked data registry service.
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
 * @returns {import('../../../src/core/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides,
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.5: Internal Definition Errors)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const modId = 'internalErrorMod';
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();

        // Instantiate mocks
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // Instantiate loader
        loader = new ComponentDefinitionLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );

        // --- Configure Common Mocks ---

        // IConfiguration: Return the main schema ID for components
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') return componentDefSchemaId;
            return undefined;
        });

        // ISchemaValidator: Simulate the main component definition schema is loaded AND *passes* validation
        mockValidator._setSchemaLoaded(componentDefSchemaId, { /* mock schema data */});
        mockValidator.mockValidatorFunction(componentDefSchemaId, (dataToValidate) => {
            // For these tests, the primary schema validation always passes
            // The errors are caught *after* this step by internal checks
            return {isValid: true, errors: null};
        });

        // IPathResolver: Default implementation is usually sufficient
        // mockResolver.resolveModContentPath is already mocked by the factory

        // IDataRegistry: Default implementation (empty) is usually sufficient
        // mockRegistry.store and get are already mocked by the factory
    });

    // --- Test Case: Scenario 1 (Invalid ID) ---
    // --- Test Case: Scenario 1 (Invalid ID) ---
    it('should handle definitions with invalid "id" (null or empty string)', async () => {
        // --- Setup: Scenario 1 ---
        const filenameNullId = 'invalid_null_id.component.json';
        const filenameEmptyId = 'invalid_empty_id.component.json';
        const filePathNullId = `./data/mods/${modId}/components/${filenameNullId}`;
        const filePathEmptyId = `./data/mods/${modId}/components/${filenameEmptyId}`;

        const invalidDataNullId = {id: null, dataSchema: {}};
        const invalidDataEmptyId = {id: "", dataSchema: {}};

        const errorManifest = createMockModManifest(modId, [filenameNullId, filenameEmptyId]);

        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePathNullId) return Promise.resolve(JSON.parse(JSON.stringify(invalidDataNullId)));
            if (path === filePathEmptyId) return Promise.resolve(JSON.parse(JSON.stringify(invalidDataEmptyId)));
            throw new Error(`Unexpected fetch call: ${path}`);
        });

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, errorManifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: No Schema/Registry ---
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Log Messages ---
        // Two files failed, so 3 logs per file = 6 total error logs expected
        expect(mockLogger.error).toHaveBeenCalledTimes(6); // *** UPDATED EXPECTATION (Back to 6) ***

        // 1. Specific internal errors (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Component definition in file '${filenameNullId}' from mod '${modId}' is missing a valid string 'id'. Found: null. Skipping.`),
            expect.objectContaining({modId: modId, resolvedPath: filePathNullId, definition: invalidDataNullId})
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Component definition in file '${filenameEmptyId}' from mod '${modId}' is missing a valid string 'id'. Found: \"\". Skipping.`),
            expect.objectContaining({modId: modId, resolvedPath: filePathEmptyId, definition: invalidDataEmptyId})
        );

        // 2. Generic catch block errors (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Use resolvedPath in the expected message now
            expect.stringContaining(`Error processing component definition file '${filePathNullId}'. Error: Definition ID Error:`),
            expect.objectContaining({ // Check the context object structure
                modId: modId,
                filename: filenameNullId,
                path: filePathNullId,
                error: expect.objectContaining({reason: 'Definition ID Error'}) // Check the error object
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error processing component definition file '${filePathEmptyId}'. Error: Definition ID Error:`),
            expect.objectContaining({
                modId: modId,
                filename: filenameEmptyId,
                path: filePathEmptyId,
                error: expect.objectContaining({reason: 'Definition ID Error'})
            })
        );


        // 3. allSettled rejection reason messages (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filenameNullId}. Reason: Definition ID Error:`), // Updated message format
            expect.objectContaining({
                modId: modId,
                filename: filenameNullId, // From the loop context
                resolvedPath: filePathNullId, // From the error object
                error: expect.objectContaining({reason: 'Definition ID Error'}) // Check the rejection reason
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filenameEmptyId}. Reason: Definition ID Error:`), // Updated message format
            expect.objectContaining({
                modId: modId,
                filename: filenameEmptyId, // From the loop context
                resolvedPath: filePathEmptyId, // From the error object
                error: expect.objectContaining({reason: 'Definition ID Error'}) // Check the rejection reason
            })
        );

        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 2 failures for component files. Check previous error logs for details.`
        );

        // --- Verify Other Interactions ---
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);
    });

    // --- Test Case: Scenario 2 (Invalid dataSchema) ---
    it('should handle definitions with invalid "dataSchema" (null or not an object)', async () => {
        // --- Setup: Scenario 2 ---
        const filenameNullSchema = 'invalid_null_schema.component.json';
        const filenameStringSchema = 'invalid_string_schema.component.json';
        const filePathNullSchema = `./data/mods/${modId}/components/${filenameNullSchema}`;
        const filePathStringSchema = `./data/mods/${modId}/components/${filenameStringSchema}`;
        const validId = `${modId}:valid_id`;

        const invalidDataNullSchema = {id: validId, dataSchema: null};
        const invalidDataStringSchema = {id: validId, dataSchema: "not-an-object"};

        const errorManifest = createMockModManifest(modId, [filenameNullSchema, filenameStringSchema]);

        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePathNullSchema) return Promise.resolve(JSON.parse(JSON.stringify(invalidDataNullSchema)));
            if (path === filePathStringSchema) return Promise.resolve(JSON.parse(JSON.stringify(invalidDataStringSchema)));
            throw new Error(`Unexpected fetch call: ${path}`);
        });

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, errorManifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: No Schema/Registry ---
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Log Messages ---
        expect(mockLogger.error).toHaveBeenCalledTimes(6); // *** UPDATED EXPECTATION (Back to 6) ***

        // 1. Specific internal errors (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Updated expectation with colon
            expect.stringContaining(`Component definition ID '${validId}' in file '${filenameNullSchema}' from mod '${modId}' is missing a valid object 'dataSchema'. Found: null. Skipping.`),
            expect.objectContaining({modId: modId, resolvedPath: filePathNullSchema, definition: invalidDataNullSchema})
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Component definition ID '${validId}' in file '${filenameStringSchema}' from mod '${modId}' is missing a valid object 'dataSchema'. Found: type: string. Skipping.`),
            expect.objectContaining({
                modId: modId,
                resolvedPath: filePathStringSchema,
                definition: invalidDataStringSchema
            })
        );

        // 2. Generic catch block errors (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            // Use resolvedPath in the expected message now
            expect.stringContaining(`Error processing component definition file '${filePathNullSchema}'. Error: Definition Schema Error:`),
            expect.objectContaining({ // Check the context object structure
                modId: modId,
                filename: filenameNullSchema,
                path: filePathNullSchema,
                error: expect.objectContaining({reason: 'Definition Schema Error'}) // Check the error object
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Error processing component definition file '${filePathStringSchema}'. Error: Definition Schema Error:`),
            expect.objectContaining({
                modId: modId,
                filename: filenameStringSchema,
                path: filePathStringSchema,
                error: expect.objectContaining({reason: 'Definition Schema Error'})
            })
        );

        // 3. allSettled rejection reason messages (should appear twice)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filenameNullSchema}. Reason: Definition Schema Error:`), // Updated message format
            expect.objectContaining({
                modId: modId,
                filename: filenameNullSchema, // From the loop context
                resolvedPath: filePathNullSchema, // From the error object
                error: expect.objectContaining({reason: 'Definition Schema Error'}) // Check the rejection reason
            })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filenameStringSchema}. Reason: Definition Schema Error:`), // Updated message format
            expect.objectContaining({
                modId: modId,
                filename: filenameStringSchema, // From the loop context
                resolvedPath: filePathStringSchema, // From the error object
                error: expect.objectContaining({reason: 'Definition Schema Error'}) // Check the rejection reason
            })
        );

        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 2 failures for component files. Check previous error logs for details.`
        );

        // --- Verify Other Interactions ---
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefSchemaId);
    });
});