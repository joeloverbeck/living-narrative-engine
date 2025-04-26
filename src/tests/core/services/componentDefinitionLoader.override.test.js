// src/tests/core/services/componentDefinitionLoader.override.test.js

// --- Imports ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentDefinitionLoader from '../../../core/services/componentDefinitionLoader.js';

// --- Mock Service Factories (Copied for self-containment) ---

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
            if (loadedSchemas.has(schemaId)) {
                console.error(`!!! Mock AddSchema Error: Schema ${schemaId} still exists in mock's loadedSchemas map!`);
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
        getContentTypeSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
        ...overrides,
    };

    mockValidator._getLoadedSchemaData = (schemaId) => loadedSchemas.get(schemaId);
    mockValidator._setSchemaLoaded = (schemaId, schemaData = {}) => {
        if (!loadedSchemas.has(schemaId)) {
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                schemaValidators.set(schemaId, mockValidationFn);
            }
        }
    };
    mockValidator.mockValidatorFunction = (schemaId, implementation) => {
        if (schemaValidators.has(schemaId)) {
            schemaValidators.get(schemaId).mockImplementation(implementation);
        } else {
            const newMockFn = jest.fn(implementation);
            schemaValidators.set(schemaId, newMockFn);
        }
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

describe('ComponentDefinitionLoader (Sub-Ticket 6.3: Override Behavior)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const sharedComponentId = 'shared:position';
    const sharedFilename = 'position.component.json';
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';

    // Core version
    const coreSharedPositionPath = `./data/mods/core/components/${sharedFilename}`;
    const coreSharedPositionDef = createMockComponentDefinition(
        sharedComponentId,
        {
            type: 'object',
            properties: {x: {type: 'integer'}, y: {type: 'integer'}},
            required: ['x', 'y']
        },
        'Core Position Definition'
    );
    const coreManifest = createMockModManifest('core', [sharedFilename]);

    // Foo version (override)
    const fooSharedPositionPath = `./data/mods/foo/components/${sharedFilename}`;
    const fooSharedPositionDef = createMockComponentDefinition(
        sharedComponentId,
        {
            type: 'object',
            properties: {x: {type: 'number'}, y: {type: 'number'}, z: {type: 'number', default: 0}},
            required: ['x', 'y']
        },
        'Foo Position Definition - Overridden'
    );
    const fooManifest = createMockModManifest('foo', [sharedFilename]);

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

        // Ensure the main definition schema validator exists and passes
        mockValidator._setSchemaLoaded(componentDefSchemaId, {});
        mockValidator.mockValidatorFunction(componentDefSchemaId, (data) => ({isValid: true, errors: null}));
    });

    // --- Test Case ---
    it('should override component definition and schema from a later mod', async () => {
        // --- Phase 1: Load Core ---
        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === 'core' && typeName === 'components' && filename === sharedFilename) {
                return coreSharedPositionPath;
            }
            if (modId === 'foo' && typeName === 'components' && filename === sharedFilename) {
                return fooSharedPositionPath;
            }
            return `./data/mods/${modId}/${typeName}/${filename}`;
        });
        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreSharedPositionPath) return JSON.parse(JSON.stringify(coreSharedPositionDef));
            if (path === fooSharedPositionPath) return JSON.parse(JSON.stringify(fooSharedPositionDef));
            throw new Error(`Unexpected fetch call: ${path}`);
        });

        // Action: Load Core
        await loader.loadComponentDefinitions('core', coreManifest);

        // Verify Phase 1 State
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith('component_definitions', sharedComponentId, coreSharedPositionDef);
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(coreSharedPositionDef.dataSchema, sharedComponentId);

        // Clear interaction counts for Phase 2 checks
        mockRegistry.store.mockClear();
        mockRegistry.get.mockClear();
        mockValidator.addSchema.mockClear();
        mockValidator.isSchemaLoaded.mockClear();
        mockValidator.removeSchema.mockClear();
        mockLogger.warn.mockClear();


        // --- Phase 2: Load Foo (Override) ---
        mockRegistry.get.mockReturnValueOnce(coreSharedPositionDef);

        // Action: Load Foo
        const loadPromiseFoo = loader.loadComponentDefinitions('foo', fooManifest);

        // Verify Phase 2
        await expect(loadPromiseFoo).resolves.not.toThrow();
        const count = await loadPromiseFoo;
        expect(count).toBe(1);

        // Verify Registry interactions
        expect(mockRegistry.get).toHaveBeenCalledTimes(1);
        expect(mockRegistry.get).toHaveBeenCalledWith('component_definitions', sharedComponentId);
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith('component_definitions', sharedComponentId, fooSharedPositionDef);

        // Verify Validator interactions
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledTimes(2);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(componentDefSchemaId);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(sharedComponentId);
        expect(mockValidator.removeSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.removeSchema).toHaveBeenCalledWith(sharedComponentId);
        expect(mockValidator.addSchema).toHaveBeenCalledTimes(1);
        expect(mockValidator.addSchema).toHaveBeenCalledWith(fooSharedPositionDef.dataSchema, sharedComponentId);

        // Verify Logger warnings
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        // Check the dataSchema override warning (only has one argument)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Overriding previously registered dataSchema for component ID '${sharedComponentId}'`)
        );
        // Check the registry override warning (has two arguments) - CORRECTED ASSERTION
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`Overwriting existing component definition metadata in registry for ID '${sharedComponentId}'`),
            expect.anything() // Allow any second argument (the metadata object)
        );


        // Final Check: Verify the actual stored data in mocks reflects the override
        expect(mockRegistry._getData('component_definitions', sharedComponentId)).toEqual(fooSharedPositionDef);
        expect(mockValidator._getLoadedSchemaData(sharedComponentId)).toEqual(fooSharedPositionDef.dataSchema);
    });
});