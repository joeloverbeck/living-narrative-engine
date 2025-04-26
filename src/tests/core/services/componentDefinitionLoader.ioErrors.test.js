// src/tests/core/services/componentDefinitionLoader.ioErrors.test.js

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
            // Deep clone to prevent tests from modifying the mock response object
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        // Default behavior if not an error path or specific response path
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
            loadedSchemas.set(schemaId, schemaData);
            // Ensure a mock validator function exists, default to valid
            schemaValidators.set(schemaId, jest.fn((data) => ({isValid: true, errors: null})));
        }),
        removeSchema: jest.fn((schemaId) => {
            const deletedSchemas = loadedSchemas.delete(schemaId);
            const deletedValidators = schemaValidators.delete(schemaId);
            return deletedSchemas && deletedValidators; // Return true only if both were present
        }),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) return validatorFn(data);
            return {isValid: false, errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found.`}]};
        }),
        // *** FIX START: Add _setSchemaLoaded helper ***
        // Helper to simulate schema loading for tests
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            if (!loadedSchemas.has(schemaId)) {
                loadedSchemas.set(schemaId, schemaData);
                if (!schemaValidators.has(schemaId)) {
                    // Ensure a validator function exists, default to valid
                    const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                    schemaValidators.set(schemaId, mockValidationFn);
                }
            }
        },
        // Helper to allow tests to customize validator behavior
        mockValidatorFunction: (schemaId, implementation) => {
            if (schemaValidators.has(schemaId)) {
                schemaValidators.get(schemaId).mockImplementation(implementation);
            } else {
                const newMockFn = jest.fn(implementation);
                schemaValidators.set(schemaId, newMockFn);
                // Also mark schema as 'loaded' if we're defining its function
                if (!loadedSchemas.has(schemaId)) {
                    loadedSchemas.set(schemaId, {}); // Add placeholder data
                }
            }
        },
        // *** FIX END ***
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
            if (!registryData.has(type)) registryData.set(type, new Map());
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.7: Path/Fetch Errors)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const modId = 'ioErrorMod';
    const filename = 'file.component.json';
    const errorManifest = createMockModManifest(modId, [filename]);
    // *** FIX: Define schema ID used in setup ***
    const componentDefinitionSchemaId = 'http://example.com/schemas/component-definition.schema.json';

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

        // Common setup - Ensure component definition schema ID is known
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') {
                return componentDefinitionSchemaId; // Use defined constant
            }
            return undefined;
        });

        // *** FIX START: Simulate the main schema being loaded ***
        mockValidator._setSchemaLoaded(componentDefinitionSchemaId, {});
        // Simulate that the validator function for the main schema exists and passes by default
        // (it's only the *existence* of the schema we need for this test, not its specific validation logic)
        mockValidator.mockValidatorFunction(componentDefinitionSchemaId, (data) => ({isValid: true, errors: null}));
        // *** FIX END ***
    });

    // --- Test Case: Scenario 1 (Path Resolution Failure) ---
    it('should handle errors during path resolution', async () => {
        // --- Setup: Scenario 1 ---
        const pathError = new Error(`Mock Path Error: Could not resolve path for ${filename}`);
        mockResolver.resolveModContentPath.mockImplementation((mId, type, fName) => {
            if (mId === modId && type === 'components' && fName === filename) {
                throw pathError;
            }
            // Fallback for potential other calls (though none expected)
            return `./data/mods/${mId}/${type}/${fName}`;
        });

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, errorManifest);

        // --- Verify: Promise Resolves & Count ---
        // The loadComponentDefinitions method itself should still resolve even if individual files fail
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0); // No files were successfully loaded

        // --- Verify: No Fetch/Store/Schema Add ---
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        // The inner try...catch logs the path resolution error directly.
        // The allSettled handler logs the rejection reason.
        expect(mockLogger.error).toHaveBeenCalledTimes(3);

        // 1. Inner catch block error (Original Path Resolution Failure)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to resolve path for component file '${filename}'. Error: Mock Path Error: Could not resolve path for ${filename}`), // Check specific error message
            expect.objectContaining({
                modId: modId,
                filename: filename,
                error: pathError, // The original error should be logged
            })
        );


        // 2. AllSettled rejection reason log
        // The actual logged message in the code uses `reason?.message || reason`
        const expectedRejectionReason = `Path Resolution Error: Failed to resolve path for component ${filename} in mod ${modId}: ${pathError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filename}. Reason: ${expectedRejectionReason}`), // Check specific error message from rejection
            expect.objectContaining({
                modId: modId,
                filename: filename, // From loop context
                error: expect.objectContaining({ // Check the wrapped error structure
                    message: expectedRejectionReason, // Check the message on the wrapped error
                    // cause property might not be automatically added unless the error is wrapped explicitly with {cause: ...}
                }),
            })
        );


        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 1 failures for component files. Check previous error logs for details.`
        );

        // --- Verify Other Interactions ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        // Validator should be checked at the start, but not for individual file validation
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefinitionSchemaId);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefinitionSchemaId);

    });


    // --- Test Case: Scenario 2 (Fetch Failure) ---
    it('should handle errors during data fetching', async () => {
        // --- Setup: Scenario 2 ---
        const filePath = `./data/mods/${modId}/components/${filename}`;
        const fetchError = new Error(`Mock Fetch Error: Failed to fetch ${filePath}`);

        // Path resolution succeeds
        mockResolver.resolveModContentPath.mockImplementation((mId, type, fName) => {
            if (mId === modId && type === 'components' && fName === filename) {
                return filePath;
            }
            return `./data/mods/${mId}/${type}/${fName}`;
        });

        // Fetching fails for the resolved path
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === filePath) {
                throw fetchError;
            }
            // Fallback for potential other calls
            throw new Error(`Unexpected fetch call: ${path}`);
        });

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, errorManifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: No Store/Schema Add ---
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();

        // --- Verify: Error Logs ---
        // The inner try...catch logs the fetch failure.
        // The allSettled handler logs the rejection reason.
        expect(mockLogger.error).toHaveBeenCalledTimes(3);

        // 1. Inner catch block error (Original Fetch/Parse Failure)
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Failed to fetch or parse component definition from '${filePath}'. Mod: ${modId}, File: ${filename}. Error: ${fetchError.message}`), // Check specific message
            expect.objectContaining({
                modId: modId,
                filename: filename,
                path: filePath,
                error: fetchError, // The original error should be logged
            })
        );


        // 2. AllSettled rejection reason log
        const expectedRejectionReason = `Workspace/Parse Error: Failed to fetch or parse component ${filename} from ${filePath} in mod ${modId}: ${fetchError.message}`;
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Processing failed for component file: ${filename}. Reason: ${expectedRejectionReason}`), // Check specific message from rejection
            expect.objectContaining({
                modId: modId,
                filename: filename, // From loop context
                resolvedPath: filePath, // Added to error object in the catch block
                error: expect.objectContaining({ // Check the wrapped error structure
                    message: expectedRejectionReason,
                }),
            })
        );

        // --- Verify: Final Warning ---
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `ComponentDefinitionLoader [${modId}]: Processing encountered 1 failures for component files. Check previous error logs for details.`
        );

        // --- Verify Other Interactions ---
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledTimes(1);
        expect(mockResolver.resolveModContentPath).toHaveBeenCalledWith(modId, 'components', filename);
        expect(mockFetcher.fetch).toHaveBeenCalledTimes(1);
        expect(mockFetcher.fetch).toHaveBeenCalledWith(filePath);
        // Validator should be checked at the start, but not for individual file validation
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefinitionSchemaId);
        expect(mockValidator.getValidator).toHaveBeenCalledWith(componentDefinitionSchemaId);
    });
});