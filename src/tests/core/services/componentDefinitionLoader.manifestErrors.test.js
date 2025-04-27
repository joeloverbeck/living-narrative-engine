// src/tests/core/services/componentDefinitionLoader.manifestErrors.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../../core/services/componentLoader.js';

// --- Mock Service Factories ---
// [Mocks omitted for brevity - assume they are the same as provided in the question]
/** Mocks assumed present:
 * createMockConfiguration
 * createMockPathResolver
 * createMockDataFetcher
 * createMockSchemaValidator
 * createMockDataRegistry
 * createMockLogger
 */

// --- Mock Service Factories (Copied from previous test files for self-containment) ---

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
        if (typeName === 'game') return 'http://example.com/schemas/game.schema.json';
        if (typeName === 'mod-manifest') return 'http://example.com/schemas/mod.manifest.schema.json';
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
        // This shouldn't be hit in these tests, as fetch should not be called
        return Promise.reject(new Error(`Mock Fetch Error: Unexpected fetch for ${path}`));
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
            schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
        }),
        removeSchema: jest.fn((schemaId) => loadedSchemas.delete(schemaId) && schemaValidators.delete(schemaId)),
        isSchemaLoaded: jest.fn((schemaId) => loadedSchemas.has(schemaId)),
        getValidator: jest.fn((schemaId) => schemaValidators.get(schemaId)),
        validate: jest.fn((schemaId, data) => {
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) return validatorFn(data);
            return {isValid: false, errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found.`}]};
        }),
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


// --- Test Suite ---

describe('ComponentDefinitionLoader (Sub-Ticket 6.6: Manifest Handling Errors)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const modId = 'manifestErrorMod';

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
        loader = new ComponentLoader(
            mockConfig,
            mockResolver,
            mockFetcher,
            mockValidator,
            mockRegistry,
            mockLogger
        );
    });

    // --- Test Case: Scenario 1 (Section Missing) ---
    it('should handle manifests where content.components is missing', async () => {
        // --- Setup: Scenario 1 ---
        const manifestMissingComponents = {
            id: modId,
            name: 'Test Mod - Missing Components',
            version: '1.0.0',
            content: {actions: []}
        };

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifestMissingComponents);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Log Messages ---
        // *CORRECTED: Check for specific DEBUG message*
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key 'components' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Start message from loadComponentDefinitions
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading component definitions for mod '${modId}'`));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();

        // --- Verify: No Processing ---
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockValidator.getValidator).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    });

    // --- Test Case: Scenario 2 (Section Null) ---
    it('should handle manifests where content.components is null', async () => {
        // --- Setup: Scenario 2 ---
        const manifestNullComponents = {
            id: modId,
            name: 'Test Mod - Null Components',
            version: '1.0.0',
            content: {components: null, actions: []}
        };

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifestNullComponents);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Log Messages ---
        // *CORRECTED: Check for specific DEBUG message*
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Mod '${modId}': Content key 'components' not found or is null/undefined in manifest. Skipping.`
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Start message
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading component definitions for mod '${modId}'`));
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();

        // --- Verify: No Processing ---
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockValidator.getValidator).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    });

    // --- Test Case: Scenario 3 (Section Not Array - Object) ---
    it('should handle manifests where content.components is not an array (object)', async () => {
        // --- Setup: Scenario 3a (Object) ---
        const manifestObjectComponents = {
            id: modId,
            name: 'Test Mod - Object Components',
            version: '1.0.0',
            content: {components: {file: 'some_component.json'}, actions: []}
        };

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifestObjectComponents);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Log Messages ---
        // *CORRECTED: Check for specific WARN message*
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // From _extractValidFilenames
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Expected an array for content key 'components' but found type 'object'. Skipping.`
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Start message
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading component definitions for mod '${modId}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();

        // --- Verify: No Processing ---
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockValidator.getValidator).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    });

    // --- Test Case: Scenario 4 (Section Not Array - String) ---
    it('should handle manifests where content.components is not an array (string)', async () => {
        // --- Setup: Scenario 3b (String) ---
        const manifestStringComponents = {
            id: modId,
            name: 'Test Mod - String Components',
            version: '1.0.0',
            content: {components: "file.json", actions: []}
        };

        // --- Action ---
        const loadPromise = loader.loadComponentDefinitions(modId, manifestStringComponents);

        // --- Verify: Promise Resolves & Count ---
        await expect(loadPromise).resolves.not.toThrow();
        const count = await loadPromise;
        expect(count).toBe(0);

        // --- Verify: Log Messages ---
        // *CORRECTED: Check for specific WARN message*
        expect(mockLogger.warn).toHaveBeenCalledTimes(1); // From _extractValidFilenames
        expect(mockLogger.warn).toHaveBeenCalledWith(
            `Mod '${modId}': Expected an array for content key 'components' but found type 'string'. Skipping.`
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Start message
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Loading component definitions for mod '${modId}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();

        // --- Verify: No Processing ---
        expect(mockFetcher.fetch).not.toHaveBeenCalled();
        expect(mockValidator.getValidator).not.toHaveBeenCalled();
        expect(mockRegistry.store).not.toHaveBeenCalled();
        expect(mockValidator.addSchema).not.toHaveBeenCalled();
        expect(mockResolver.resolveModContentPath).not.toHaveBeenCalled();
    });
});