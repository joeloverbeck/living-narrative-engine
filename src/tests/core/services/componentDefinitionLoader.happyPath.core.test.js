// src/tests/core/services/componentDefinitionLoader.happyPath.core.test.js

import ComponentLoader from '../../../core/services/componentLoader.js'; // The class under test
import {beforeEach, describe, expect, jest, test} from '@jest/globals'; // Import Jest utilities if needed, like jest.fn()

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('../interfaces/coreServices.js').ModManifest} ModManifest
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


describe('ComponentDefinitionLoader (Sub-Ticket 6.2: Happy Path - Core Mod)', () => {
    // --- Declare variables for mocks and loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let componentDefinitionLoader;

    // --- Define mock component data ---
    const coreHealthFilename = 'core_health.component.json';
    const corePositionFilename = 'core_position.component.json';
    const coreHealthPath = './data/mods/core/components/core_health.component.json';
    const corePositionPath = './data/mods/core/components/core_position.component.json';

    // IDs as they appear *in the file*
    const coreHealthIdFromFile = 'core:health';
    const corePositionIdFromFile = 'core:position';

    // Base IDs (extracted)
    const coreHealthBaseId = 'health';
    const corePositionBaseId = 'position';

    // Final, correctly prefixed IDs for registry storage/retrieval
    const coreHealthFinalId = 'core:health';
    const corePositionFinalId = 'core:position';

    const coreHealthDef = {
        id: coreHealthIdFromFile, // Use ID from file
        description: '...',
        dataSchema: {type: 'object', properties: {current: {}, max: {}}, required: ['current', 'max']}
    };
    const corePositionDef = {
        id: corePositionIdFromFile, // Use ID from file
        description: '...',
        dataSchema: {type: 'object', properties: {x: {}, y: {}, z: {}}, required: ['x', 'y', 'z']}
    };

    // --- Define the 'core' mod manifest ---
    const mockCoreManifest = {
        id: 'core',
        name: '...',
        version: '1.0.0',
        content: {components: [coreHealthFilename, corePositionFilename]}
    };

    // --- Define schema IDs ---
    const componentDefinitionSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    beforeEach(() => {
        // --- Setup: Instantiate Mocks ---
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();

        // --- Setup: Configure Mock Implementations ---
        // Config: Return component definition schema ID
        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => {
            if (typeName === 'components') return componentDefinitionSchemaId;
            return undefined;
        });
        // Resolver: Return correct paths
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === 'core' && typeName === 'components') {
                if (filename === coreHealthFilename) return coreHealthPath;
                if (filename === corePositionFilename) return corePositionPath;
            }
            // Throw if unexpected path requested in this test
            throw new Error(`Unexpected resolveModContentPath call: ${modId}, ${typeName}, ${filename}`);
        });
        // Fetcher: Return the defined component data for the correct paths
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreHealthPath) return Promise.resolve(JSON.parse(JSON.stringify(coreHealthDef)));
            if (path === corePositionPath) return Promise.resolve(JSON.parse(JSON.stringify(corePositionDef)));
            throw new Error(`Unexpected fetch call for path: ${path}`);
        });

        // Validator: Ensure main definition schema validates successfully
        mockValidator._setSchemaLoaded(componentDefinitionSchemaId);
        mockValidator.mockValidatorFunction(componentDefinitionSchemaId, () => ({isValid: true, errors: null}));
        // Use default addSchema/isSchemaLoaded behavior for the component data schemas

        // Registry: Simulate components not existing initially
        mockRegistry.get.mockImplementation((type, id) => {
            if (type === 'components') return undefined;
            // Add fallback if other types were used
            return undefined;
        });

        // --- Setup: Instantiate Loader ---
        componentDefinitionLoader = new ComponentLoader(
            mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger
        );
    });

    test('should successfully load and register component definitions from the core mod', async () => {
        // --- Action ---
        const promise = componentDefinitionLoader.loadComponentDefinitions('core', mockCoreManifest);

        // --- Verify: Promise Resolves & Count ---
        await expect(promise).resolves.not.toThrow();
        const count = await promise;
        expect(count).toBe(2); // Correct number of items

        // --- Verify: Mock Calls ---

        // ** Verify Registry Store **
        expect(mockRegistry.store).toHaveBeenCalledTimes(2);
        // Data stored should have the FINAL correctly prefixed ID inside
        const expectedStoredHealth = {
            ...coreHealthDef,
            id: coreHealthFinalId,
            modId: 'core',
            _sourceFile: coreHealthFilename
        };
        const expectedStoredPosition = {
            ...corePositionDef,
            id: corePositionFinalId,
            modId: 'core',
            _sourceFile: corePositionFilename
        };
        // Expect store with category, FINAL ID as key, and augmented data
        expect(mockRegistry.store).toHaveBeenCalledWith('components', coreHealthFinalId, expectedStoredHealth);
        expect(mockRegistry.store).toHaveBeenCalledWith('components', corePositionFinalId, expectedStoredPosition);

        // ** Verify Schema Validator addSchema **
        // Expect addSchema called with the dataSchema and the FULL ID from the file
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(2);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(coreHealthDef.dataSchema, coreHealthIdFromFile); // e.g., "core:health"
        expect(mockValidator.addSchema).toHaveBeenCalledWith(corePositionDef.dataSchema, corePositionIdFromFile); // e.g., "core:position"

        // --- Verify: Primary Schema Validation Check ---
        // Check that the overall definition structure was validated
        expect(mockValidator.validate).toHaveBeenCalledTimes(2);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefinitionSchemaId, coreHealthDef);
        expect(mockValidator.validate).toHaveBeenCalledWith(componentDefinitionSchemaId, corePositionDef);

        // --- Verify Other Interactions ---
        expect(mockValidator.removeSchema).not.toHaveBeenCalled();
        expect(mockRegistry.get).toHaveBeenCalledTimes(2); // Checks for overrides before storing

        // Expect get called with category and FINAL ID (which storeItemInRegistry uses)
        expect(mockRegistry.get).toHaveBeenCalledWith('components', coreHealthFinalId); // "core:health"
        expect(mockRegistry.get).toHaveBeenCalledWith('components', corePositionFinalId); // "core:position"

        // --- Verify: ILogger Calls ---
        expect(mockLogger.info).toHaveBeenCalledTimes(2);
        expect(mockLogger.info).toHaveBeenCalledWith("ComponentLoader: Loading component definitions for mod 'core'."); // Match exact message
        const expectedSuccessCount = 2;
        expect(mockLogger.info).toHaveBeenCalledWith(
            `Mod [core] - Processed ${expectedSuccessCount}/${expectedSuccessCount} components items.` // Match exact message
        );

        // Optional: Verify specific debug logs if crucial
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`ComponentLoader [core]: Registered dataSchema for component ID '${coreHealthIdFromFile}'`));
        // (Similar checks for position component)

        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});