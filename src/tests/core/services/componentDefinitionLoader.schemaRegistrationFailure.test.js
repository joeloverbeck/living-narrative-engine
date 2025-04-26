// src/tests/core/services/componentDefinitionLoader.schemaRegistrationFailure.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js'; // Adjust path if necessary

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

        // Common mock setup
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') return componentDefSchemaId;
            return undefined;
        });

        // Ensure the main definition schema validator exists and passes by default
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        mockValidator.mockValidatorFunction(componentDefSchemaId, (data) => ({isValid: true, errors: null}));
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

        // Configure fetcher
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePath) return JSON.parse(JSON.stringify(validDef));
            throw new Error(`Unexpected fetch: ${path}`);
        });

        // Configure addSchema to fail
        mockValidator.addSchema.mockImplementation(async (schemaData, schemaId) => {
            if (schemaId === componentId) {
                throw addSchemaError;
            }
            // Default success for other schemas (shouldn't be called here)
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
        // Ensure the main validator was called (should pass based on setup)
        const mainValidatorFn = mockValidator.getValidator(componentDefSchemaId);
        expect(mainValidatorFn).toHaveBeenCalledWith(validDef);

        // --- Verify: addSchema was called and failed ---
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(validDef.dataSchema, componentId);

        // --- Verify: store was NOT called ---
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: removeSchema was NOT called ---
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3); // Inner catch + outer catch + rejection reason

        // 1. Inner catch block error (most specific) - **CORRECTED ASSERTION**
        // Verify the core message string and the context object separately
        const expectedInnerLogMessage = `ComponentDefinitionLoader [${modId}]: Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'.`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedInnerLogMessage, // Check the exact message string
            expect.objectContaining({ // Check context object
                modId: modId,
                filename: filename,
                resolvedPath: filePath,
                componentId: componentId,
                error: addSchemaError, // Original error
            })
        );

        // 2. AllSettled rejection reason log - **CORRECTED ASSERTION**
        // Check the rejection reason message string (which includes the error message)
        const expectedRejectionReasonMsg = `Failed during dataSchema registration steps for component '${componentId}' from file '${filename}'. Error: ${addSchemaError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filename}. Reason: ${expectedRejectionReasonMsg}`),
            expect.objectContaining({
                modId: modId,
                filename: filename,
                resolvedPath: filePath,
                error: expect.objectContaining({
                    message: expect.stringContaining(expectedRejectionReasonMsg), // Check the wrapped error message
                    reason: 'Schema Registration Error' // Check the reason property
                }),
            })
        );

        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 1 failures for component files. Check previous error logs for details.`
        );
    });

    // --- Test Case: Scenario 2 (removeSchema Failure during Override) ---
    it('Scenario 2: should handle errors during removeSchema on override', async () => {
        // --- Setup: Scenario 2 ---
        const filename = 'comp_remove_fail.component.json';
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const componentId = `${modId}:remove_fail`; // Same ID for original and override

        // Original definition (simulated as already loaded)
        const originalDef = createMockComponentDefinition(componentId, {
            type: 'object',
            properties: {version: {const: 1}}
        });
        const originalSchema = originalDef.dataSchema;

        // Overriding definition
        const overrideDef = createMockComponentDefinition(componentId, {
            type: 'object',
            properties: {version: {const: 2}}
        });

        const removeSchemaError = new Error("Mock Validator Error: Failed to remove schema");
        const manifest = createMockModManifest(modId, [filename]);

        // Simulate original definition/schema exists
        mockRegistry._prepopulate('component_definitions', componentId, originalDef);
        mockValidator._setSchemaLoaded(componentId, originalSchema); // Pre-load the schema to be removed

        // Configure fetcher for the override file
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePath) return JSON.parse(JSON.stringify(overrideDef));
            throw new Error(`Unexpected fetch: ${path}`);
        });

        // Configure removeSchema to fail
        mockValidator.removeSchema.mockImplementation((schemaId) => {
            if (schemaId === componentId) {
                throw removeSchemaError; // Throw the error
            }
            return true; // Default success
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
        // Ensure the main validator was called (should pass based on setup)
        const mainValidatorFn = mockValidator.getValidator(componentDefSchemaId);
        expect(mainValidatorFn).toHaveBeenCalledWith(overrideDef);
        // Check for override detection *before* the error
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentId);

        // --- Verify: removeSchema was called and failed ---
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(componentId);

        // --- Verify: get was NOT called ---
        expect(mockRegistry.get).not.toHaveBeenCalled();

        // --- Verify: addSchema (for override) was NOT called ---
        expect(mockValidator.addSchema).not.toHaveBeenCalled();

        // --- Verify: store (for override) was NOT called ---
        expect(mockRegistry.store).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        expect(mockLogger.error).toHaveBeenCalledTimes(3); // Inner catch + outer catch + rejection reason

        // 1. Inner catch block error (most specific) - **CORRECTED ASSERTION**
        // Verify the core message string and the context object separately
        const expectedInnerLogMessage = `ComponentDefinitionLoader [${modId}]: Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}.`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expectedInnerLogMessage, // Check exact message string
            expect.objectContaining({ // Check context object
                modId: modId,
                filename: filename,
                componentId: componentId,
                path: filePath,
                error: removeSchemaError, // Original error
            })
        );

        // 2. AllSettled rejection reason log - **CORRECTED ASSERTION**
        // Check the rejection reason message string (which includes the error message)
        const expectedRejectionReasonMsg = `Error during removeSchema for component '${componentId}'. Mod: ${modId}, File: ${filename}. Error: ${removeSchemaError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filename}. Reason: ${expectedRejectionReasonMsg}`),
            expect.objectContaining({
                modId: modId,
                filename: filename,
                resolvedPath: filePath,
                error: expect.objectContaining({
                    message: expect.stringContaining(expectedRejectionReasonMsg), // Check the wrapped error message
                    reason: 'Schema Registration Error' // Check the reason property
                }),
            })
        );

        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 1 failures for component files. Check previous error logs for details.`
        );

        // --- Verify State: Original schema should still be 'loaded' in mock ---
        // (because removeSchema failed)
        expect(mockValidator._isSchemaActuallyLoaded(componentId)).toBe(true);
    });
});