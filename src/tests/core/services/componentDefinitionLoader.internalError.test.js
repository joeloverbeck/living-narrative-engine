// src/tests/core/services/componentDefinitionLoader.internalError.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../../core/services/componentLoader.js';
import {BaseManifestItemLoader} from '../../../core/services/baseManifestItemLoader.js'; // Import base class if needed for type hints or inspection

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
                // Simulate potential real-world behavior - allow override but maybe warn?
                // For testing purposes, just overwrite. If strict checking is needed, throw here.
                // console.warn(`Mock Schema Warning: Overwriting schema with ID '${schemaId}'`);
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
            // Default to invalid if schema isn't specifically mocked/loaded
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
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        loader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === 'components' ? componentDefSchemaId : undefined);
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        // Ensure component def schema validation passes by default for these tests
        mockValidator.mockValidatorFunction(componentDefSchemaId, (data) => ({isValid: true, errors: null}));
        // Common resolver setup
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`);
    });

    // --- Test Case: Scenario 1 (Invalid ID) ---
    it('should handle definitions with invalid "id" (null or empty string)', async () => {
        // --- Setup: Scenario 1 ---
        const filenameNullId = 'invalid_null_id.component.json';
        const filenameEmptyId = 'invalid_empty_id.component.json';
        const filePathNullId = `./data/mods/${modId}/components/${filenameNullId}`;
        const filePathEmptyId = `./data/mods/${modId}/components/${filenameEmptyId}`;
        const invalidDataNullId = {id: null, dataSchema: {}}; // dataSchema is valid obj here
        const invalidDataEmptyId = {id: "", dataSchema: {}}; // dataSchema is valid obj here
        const errorManifest = createMockModManifest(modId, [filenameNullId, filenameEmptyId]);

        // Setup mock fetcher for this scenario
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
        expect(count).toBe(0); // No components should be successfully loaded
        expect(mockRegistry.store).not.toHaveBeenCalled(); // Nothing should be stored
        expect(mockValidator.addSchema).not.toHaveBeenCalled(); // No data schemas registered

        // --- Verify: Error Log Messages ---
        // Expect 4 error logs: 1 specific + 1 wrapper per file
        expect(mockLogger.error).toHaveBeenCalledTimes(4);

        // --- File 1: invalid_null_id.component.json ---
        // 1a. Specific internal error log (_processFetchedItem check for ID)
        const expectedSpecificErrorMsg1 = `ComponentLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filenameNullId}'. Found: ${JSON.stringify(invalidDataNullId.id)}`;
        // ***** CORRECTED DETAILS OBJECT *****
        const expectedSpecificErrorDetails1 = expect.objectContaining({
            resolvedPath: filePathNullId,       // Use resolvedPath
            componentIdValue: invalidDataNullId.id, // Use componentIdValue
            modId: modId,
            filename: filenameNullId,
        });
        // ***** Check for 2 arguments *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificErrorMsg1, expectedSpecificErrorDetails1);

        // 1b. Wrapper error log (_processFileWrapper catch)
        const expectedWrapperMsg = `Error processing file:`;
        const idError1 = expect.objectContaining({ // Error object passed as 3rd arg
            message: `Invalid Component ID in ${filenameNullId}`,
        });
        const expectedWrapperDetails1 = expect.objectContaining({ // Details object passed as 2nd arg
            filename: filenameNullId,
            path: filePathNullId, // Wrapper log uses 'path'
            modId: modId,
            error: `Invalid Component ID in ${filenameNullId}` // Wrapper log passes error message string
        });
        // ***** Check for 3 arguments, matching structure *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails1, idError1);

        // --- File 2: invalid_empty_id.component.json ---
        // 2a. Specific internal error log (_processFetchedItem check for ID)
        const expectedSpecificErrorMsg2 = `ComponentLoader [${modId}]: Missing or invalid 'id' field in component definition file '${filenameEmptyId}'. Found: ${JSON.stringify(invalidDataEmptyId.id)}`;
        // ***** CORRECTED DETAILS OBJECT *****
        const expectedSpecificErrorDetails2 = expect.objectContaining({
            resolvedPath: filePathEmptyId,       // Use resolvedPath
            componentIdValue: invalidDataEmptyId.id, // Use componentIdValue
            modId: modId,
            filename: filenameEmptyId
        });
        // ***** Check for 2 arguments *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificErrorMsg2, expectedSpecificErrorDetails2);

        // 2b. Wrapper error log (_processFileWrapper catch)
        const idError2 = expect.objectContaining({ // Error object passed as 3rd arg
            message: `Invalid Component ID in ${filenameEmptyId}`,
        });
        const expectedWrapperDetails2 = expect.objectContaining({ // Details object passed as 2nd arg
            filename: filenameEmptyId,
            path: filePathEmptyId, // Wrapper log uses 'path'
            modId: modId,
            error: `Invalid Component ID in ${filenameEmptyId}` // Wrapper log passes error message string
        });
        // ***** Check for 3 arguments, matching structure *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails2, idError2);

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/2 components items. (2 failed)`);
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // --- Verify Other Interactions ---
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        // Structure validation happens *before* the ID check
        expect(mockValidator.validate).toHaveBeenCalledTimes(2);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, invalidDataNullId);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, invalidDataEmptyId);
    });

    // --- Test Case: Scenario 2 (Invalid dataSchema) ---
    it('should handle definitions with invalid "dataSchema" (null or not an object)', async () => {
        // --- Setup: Scenario 2 ---
        const filenameNullSchema = 'invalid_null_schema.component.json';
        const filenameStringSchema = 'invalid_string_schema.component.json';
        const filePathNullSchema = `./data/mods/${modId}/components/${filenameNullSchema}`;
        const filePathStringSchema = `./data/mods/${modId}/components/${filenameStringSchema}`;
        const validId = 'valid_id'; // Raw ID from the file
        const invalidDataNullSchema = {id: validId, dataSchema: null};
        const invalidDataStringSchema = {id: validId, dataSchema: "not-an-object"};
        const errorManifest = createMockModManifest(modId, [filenameNullSchema, filenameStringSchema]);

        // Setup mock fetcher for this scenario
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
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();

        // --- Verify: Error Log Messages ---
        // Expect 4 error logs: 1 specific + 1 wrapper per file
        expect(mockLogger.error).toHaveBeenCalledTimes(4);

        // --- File 1: invalid_null_schema.component.json ---
        // 1a. Specific internal error log (_processFetchedItem check for dataSchema type)
        const expectedSpecificErrorMsg1 = `ComponentLoader [${modId}]: Invalid 'dataSchema' found for component '${validId}' in file '${filenameNullSchema}'. Expected an object but received type 'null'.`;
        const schemaTypeError1 = expect.any(Error); // Check it's an error object
        // ***** CORRECTED DETAILS OBJECT *****
        const expectedSpecificErrorDetails1 = expect.objectContaining({
            componentId: validId,
            resolvedPath: filePathNullSchema, // Use resolvedPath
            receivedType: 'null',           // Use receivedType
            modId: modId,
            filename: filenameNullSchema
        });
        // ***** Check for 3 arguments *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificErrorMsg1, expectedSpecificErrorDetails1, schemaTypeError1);

        // 1b. Wrapper error log (_processFileWrapper catch)
        const expectedWrapperMsg = `Error processing file:`;
        const expectedWrapperDetails1 = expect.objectContaining({ // Details object passed as 2nd arg
            filename: filenameNullSchema,
            path: filePathNullSchema, // Wrapper log uses 'path'
            modId: modId,
            error: expect.stringContaining(`Invalid dataSchema type in ${filenameNullSchema} for component ${validId}`) // Wrapper log passes error message string
        });
        // ***** Check for 3 arguments, matching structure *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails1, schemaTypeError1); // The same error object is caught and passed

        // --- File 2: invalid_string_schema.component.json ---
        // 2a. Specific internal error log (_processFetchedItem check for dataSchema type)
        const expectedSpecificErrorMsg2 = `ComponentLoader [${modId}]: Invalid 'dataSchema' found for component '${validId}' in file '${filenameStringSchema}'. Expected an object but received type 'string'.`;
        const schemaTypeError2 = expect.any(Error); // Check it's an error object
        // ***** CORRECTED DETAILS OBJECT *****
        const expectedSpecificErrorDetails2 = expect.objectContaining({
            componentId: validId,
            resolvedPath: filePathStringSchema, // Use resolvedPath
            receivedType: 'string',           // Use receivedType
            modId: modId,
            filename: filenameStringSchema
        });
        // ***** Check for 3 arguments *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedSpecificErrorMsg2, expectedSpecificErrorDetails2, schemaTypeError2);

        // 2b. Wrapper error log (_processFileWrapper catch)
        const expectedWrapperDetails2 = expect.objectContaining({ // Details object passed as 2nd arg
            filename: filenameStringSchema,
            path: filePathStringSchema, // Wrapper log uses 'path'
            modId: modId,
            error: expect.stringContaining(`Invalid dataSchema type in ${filenameStringSchema} for component ${validId}`) // Wrapper log passes error message string
        });
        // ***** Check for 3 arguments, matching structure *****
        expect(mockLogger.error).toHaveBeenCalledWith(expectedWrapperMsg, expectedWrapperDetails2, schemaTypeError2); // The same error object is caught and passed

        // --- Verify: Final Info Log ---
        expect(mockLogger.info).toHaveBeenCalledWith(`Mod [${modId}] - Processed 0/2 components items. (2 failed)`);
        expect(mockLogger.warn).not.toHaveBeenCalled();

        // --- Verify Other Interactions ---
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
        // Structure validation happens *before* dataSchema check
        expect(mockValidator.validate).toHaveBeenCalledTimes(2);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, invalidDataNullSchema);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefSchemaId, invalidDataStringSchema);
    });
});