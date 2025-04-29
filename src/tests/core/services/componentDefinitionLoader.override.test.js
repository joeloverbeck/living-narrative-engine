// src/tests/core/services/componentDefinitionLoader.override.test.js

// --- Imports (remain the same) ---
import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ComponentLoader from '../../../core/loaders/componentLoader.js'; // Corrected import name
import {BaseManifestItemLoader} from '../../../core/loaders/baseManifestItemLoader.js'; // Added base class import

// --- Mock Service Factories (remain the same) ---
// [Mocks omitted for brevity - use the ones provided]
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
    getRuleBasePath: jest.fn().mockReturnValue('rules'),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'), ...overrides,
});
const createMockPathResolver = (overrides = {}) => ({
    resolveModContentPath: jest.fn((modId, typeName, filename) => `./data/mods/${modId}/${typeName}/${filename}`),
    resolveContentPath: jest.fn((typeName, filename) => `./data/${typeName}/${filename}`),
    resolveSchemaPath: jest.fn(filename => `./data/schemas/${filename}`),
    resolveModManifestPath: jest.fn(modId => `./data/mods/${modId}/mod.manifest.json`),
    resolveGameConfigPath: jest.fn(() => './data/game.json'),
    resolveRulePath: jest.fn(filename => `./data/system-rules/${filename}`),
    resolveManifestPath: jest.fn(worldName => `./data/worlds/${worldName}.world.json`), ...overrides,
});
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
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();
    const mockValidator = {
        addSchema: jest.fn(async (schemaData, schemaId) => {
            if (loadedSchemas.has(schemaId)) {
                // console.warn(`Mock AddSchema Warning: Schema ${schemaId} already exists, potential issue if not removed first.`);
            }
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
                schemaValidators.set(schemaId, mockValidationFn);
            }
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
            if (loadedSchemas.has(schemaId)) {
                return {
                    isValid: false,
                    errors: [{message: `Mock Schema Error: Schema data '${schemaId}' loaded but no validator function found.`}]
                };
            }
            return {
                isValid: false,
                errors: [{message: `Mock Schema Error: Schema '${schemaId}' not found for validation.`}]
            };
        }), ...overrides,
    };
    mockValidator._getLoadedSchemaData = (schemaId) => loadedSchemas.get(schemaId);
    mockValidator._setSchemaLoaded = (schemaId, schemaData = {}) => {
        loadedSchemas.set(schemaId, schemaData);
        if (!schemaValidators.has(schemaId)) {
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }
    };
    mockValidator.mockValidatorFunction = (schemaId, implementation) => {
        if (!schemaValidators.has(schemaId)) {
            mockValidator._setSchemaLoaded(schemaId, {});
        }
        if (!schemaValidators.has(schemaId)) {
            const mockValidationFn = jest.fn((data) => ({isValid: true, errors: null}));
            schemaValidators.set(schemaId, mockValidationFn);
        }
        schemaValidators.get(schemaId).mockImplementation(implementation);
    };
    return mockValidator;
};
const createMockDataRegistry = (overrides = {}) => {
    const registryData = new Map();
    return {
        store: jest.fn((type, id, data) => {
            // console.log(`DEBUG: MockRegistry store called with type='${type}', id='${id}'`); // Added debug log
            if (!registryData.has(type)) {
                registryData.set(type, new Map());
            }
            registryData.get(type).set(id, JSON.parse(JSON.stringify(data))); // Deep copy
        }),
        get: jest.fn((type, id) => {
            const typeMap = registryData.get(type);
            const data = typeMap?.get(id);
            // console.log(`DEBUG: MockRegistry get called with type='${type}', id='${id}'. Found: ${data !== undefined}`); // Added debug log
            return data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined; // Deep copy
        }),
        getAll: jest.fn((type) => {
            const typeMap = registryData.get(type);
            return typeMap ? Array.from(typeMap.values()).map(d => JSON.parse(JSON.stringify(d))) : [];
        }),
        _getData: (type, id) => {
            const typeMap = registryData.get(type);
            return typeMap?.get(id);
        },
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
        getStartingLocationId: jest.fn().mockReturnValue(null), ...overrides,
    };
};
const createMockLogger = (overrides = {}) => ({
    info: jest.fn(console.log),
    warn: jest.fn(console.warn),
    error: jest.fn(console.error),
    debug: jest.fn(console.log),
    ...overrides,
});
const createMockComponentDefinition = (id, dataSchema = {type: 'object', properties: {}}, description = '') => ({
    id: id,
    dataSchema: dataSchema, ...(description && {description: description}),
});
const createMockModManifest = (modId, componentFiles = []) => ({
    id: modId,
    name: `Mock Mod ${modId}`,
    version: '1.0.0',
    content: {components: componentFiles,},
});


// --- Test Suite ---

describe('ComponentLoader (Sub-Ticket 6.3: Override Behavior)', () => {
    // --- Declare Mocks & Loader ---
    let mockConfig;
    let mockResolver;
    let mockFetcher;
    let mockValidator;
    let mockRegistry;
    let mockLogger;
    let loader;

    // --- Shared Test Data ---
    const sharedComponentIdFromFile = 'shared:position';
    const baseComponentId = 'position';
    const coreModId = 'core';
    const fooModId = 'foo';
    const sharedFilename = 'position.component.json';
    const componentDefSchemaId = 'http://example.com/schemas/component-definition.schema.json';
    const registryCategory = 'components';
    const coreQualifiedId = `${coreModId}:${baseComponentId}`;
    const fooQualifiedId = `${fooModId}:${baseComponentId}`;
    const coreSharedPositionPath = `./data/mods/core/components/${sharedFilename}`;
    const coreSharedPositionDef = createMockComponentDefinition(sharedComponentIdFromFile, {
        type: 'object',
        properties: {x: {}, y: {}},
        required: ['x', 'y']
    }, 'Core Position Definition');
    const coreManifest = createMockModManifest(coreModId, [sharedFilename]);
    const fooSharedPositionPath = `./data/mods/foo/components/${sharedFilename}`;
    const fooSharedPositionDef = createMockComponentDefinition(sharedComponentIdFromFile, {
        type: 'object',
        properties: {x: {}, y: {}, z: {default: 0}},
        required: ['x', 'y']
    }, 'Foo Position Definition - Overridden');
    const fooManifest = createMockModManifest(fooModId, [sharedFilename]);

    // --- Setup ---
    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher();
        mockValidator = createMockSchemaValidator();
        mockRegistry = createMockDataRegistry();
        mockLogger = createMockLogger();
        // Use ComponentLoader (corrected class name)
        loader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, mockRegistry, mockLogger);

        mockConfig.getContentTypeSchemaId.mockImplementation((typeName) => typeName === registryCategory ? componentDefSchemaId : undefined);
        mockValidator._setSchemaLoaded(componentDefSchemaId, {type: 'object'});
        mockValidator.mockValidatorFunction(componentDefSchemaId, () => ({isValid: true, errors: null}));

        mockFetcher.fetch.mockImplementation(async (path) => {
            if (path === coreSharedPositionPath) return JSON.parse(JSON.stringify(coreSharedPositionDef));
            if (path === fooSharedPositionPath) return JSON.parse(JSON.stringify(fooSharedPositionDef));
            throw new Error(`Mock Fetch Error: Unexpected fetch call for path: ${path}`);
        });

        mockResolver.resolveModContentPath.mockImplementation((modId, typeName, filename) => {
            if (modId === coreModId && typeName === registryCategory && filename === sharedFilename) return coreSharedPositionPath;
            if (modId === fooModId && typeName === registryCategory && filename === sharedFilename) return fooSharedPositionPath;
            throw new Error(`Mock PathResolver Error: Unexpected resolveModContentPath call: ${modId}, ${typeName}, ${filename}`);
        });
    });

    // --- Test Case ---
    it('should override component definition and schema from a later mod', async () => {
        // --- Phase 1: Load Core ---
        console.log("--- Starting Phase 1 Load ---");
        await loader.loadItemsForMod(coreModId, coreManifest, 'components', 'components', 'components');
        console.log("--- Finished Phase 1 Load ---");

        // Verification: Phase 1 (Mostly unchanged, just ensuring setup is correct)
        const expectedStoredCoreObject = {
            ...coreSharedPositionDef,
            id: coreQualifiedId,
            modId: coreModId,
            _sourceFile: sharedFilename
        };
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith(registryCategory, coreQualifiedId, expect.objectContaining(expectedStoredCoreObject));
        expect(mockValidator.isSchemaLoaded(sharedComponentIdFromFile)).toBe(true);
        const retrievedCoreData = mockRegistry.get(registryCategory, coreQualifiedId);
        expect(retrievedCoreData).toEqual(expectedStoredCoreObject);
        expect(mockValidator._getLoadedSchemaData(sharedComponentIdFromFile)).toEqual(coreSharedPositionDef.dataSchema);
        console.log("--- Finished Phase 1 Verification ---");

        // --- PREPARATION FOR PHASE 2 ---
        mockRegistry.store.mockClear();
        const getSpy = jest.spyOn(mockRegistry, 'get').mockImplementation((type, id) => {
            if (type === registryCategory && id === coreQualifiedId) return JSON.parse(JSON.stringify(expectedStoredCoreObject));
            if (type === registryCategory && id === fooQualifiedId) return undefined; // foo:position doesn't exist yet
            return undefined;
        });
        const removeSchemaSpy = jest.spyOn(mockValidator, 'removeSchema');
        const addSchemaSpy = jest.spyOn(mockValidator, 'addSchema');
        const isSchemaLoadedSpy = jest.spyOn(mockValidator, 'isSchemaLoaded');
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();

        // --- Action: Load Foo (Phase 2) ---
        console.log("--- Starting Phase 2 Load ---");
        addSchemaSpy.mockClear();
        const loadPromiseFoo = loader.loadItemsForMod(fooModId, fooManifest, 'components', 'components', 'components');

        // --- Verification: Phase 2 Execution ---
        await expect(loadPromiseFoo).resolves.not.toThrow();
        const count = await loadPromiseFoo;
        expect(count).toBe(1);
        console.log("--- Finished Phase 2 Load Action ---");

        // --- Verification: Mock Interactions for Phase 2 ---
        // 1. Registry Interactions:
        expect(getSpy).toHaveBeenCalledWith(registryCategory, fooQualifiedId);
        const expectedStoredFooObject = {
            ...fooSharedPositionDef,
            id: fooQualifiedId,
            modId: fooModId,
            _sourceFile: sharedFilename
        };
        expect(mockRegistry.store).toHaveBeenCalledTimes(1);
        expect(mockRegistry.store).toHaveBeenCalledWith(registryCategory, fooQualifiedId, expect.objectContaining(expectedStoredFooObject));

        // 2. Schema Validator Interactions:
        expect(isSchemaLoadedSpy).toHaveBeenCalledWith(sharedComponentIdFromFile);
        expect(removeSchemaSpy).toHaveBeenCalledTimes(1);
        expect(removeSchemaSpy).toHaveBeenCalledWith(sharedComponentIdFromFile);

        // <<< ***** THE FIX IS HERE ***** >>>
        // addSchema IS called again during the override process in Phase 2
        expect(addSchemaSpy).toHaveBeenCalledTimes(1); // Check it was called *during Phase 2*
        // <<< *************************** >>>

        expect(addSchemaSpy).toHaveBeenCalledWith(fooSharedPositionDef.dataSchema, sharedComponentIdFromFile);

        // 3. Logger Interactions: (Unchanged from previous correct version)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`overwriting an existing data schema for component ID '${sharedComponentIdFromFile}'`));
        expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining(`Overwriting existing ${registryCategory} definition with key`));
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully removed existing schema '${sharedComponentIdFromFile}'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered dataSchema for component ID '${sharedComponentIdFromFile}'`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Successfully stored ${registryCategory} item '${fooQualifiedId}'`));

        console.log("--- Finished Phase 2 Mock Interaction Verification ---");

        // --- Final State Check (Post Phase 2) (Unchanged) ---
        const finalStoredFooData = mockRegistry._getData(registryCategory, fooQualifiedId);
        expect(finalStoredFooData).toEqual(expect.objectContaining(expectedStoredFooObject));
        const finalStoredCoreData = mockRegistry._getData(registryCategory, coreQualifiedId);
        expect(finalStoredCoreData).toEqual(expect.objectContaining(expectedStoredCoreObject));
        const finalSchemaData = mockValidator._getLoadedSchemaData(sharedComponentIdFromFile);
        expect(finalSchemaData).toEqual(fooSharedPositionDef.dataSchema);

        console.log("--- Finished Final State Check ---");
        console.log("--- Test Completed Successfully ---");

        getSpy.mockRestore();
    });
});
