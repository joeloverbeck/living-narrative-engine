// Filename: src/tests/core/services/integration/loaderRegistry.integration.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import ActionLoader from '../../core/services/actionLoader.js'; // Adjust path if needed
import ComponentLoader from '../../core/services/componentLoader.js'; // Adjust path if needed
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js'; // Use the real registry

// --- Mock Service Factories (Copied from provided examples) ---

/**
 * Creates a mock IConfiguration service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../../core/interfaces/coreServices.js').IConfiguration} Mocked configuration service.
 */
const createMockConfiguration = (overrides = {}) => ({
    getModsBasePath: jest.fn().mockReturnValue('./data/mods'),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'actions') return 'http://example.com/schemas/action.schema.json';
        if (typeName === 'components') return 'http://example.com/schemas/component-definition.schema.json';
        // Add other types as needed for tests
        return `http://example.com/schemas/${typeName}.schema.json`; // Default fallback
    }),
    getSchemaBasePath: jest.fn().mockReturnValue('./data/schemas'), // Relative to baseDataPath
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'), // Relative to baseDataPath
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getContentBasePath: jest.fn((typeName) => `./data/${typeName}`), // Fallback content base
    getRuleBasePath: jest.fn().mockReturnValue('system-rules'), // Relative to baseDataPath
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/system-rule.schema.json'),
    ...overrides,
});

/**
 * Creates a mock IPathResolver service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../../core/interfaces/coreServices.js').IPathResolver} Mocked path resolver service.
 */
const createMockPathResolver = (overrides = {}) => ({
    // Resolve assuming mocks are relative to a conceptual root
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
 * @returns {import('../../../../core/interfaces/coreServices.js').IDataFetcher} Mocked data fetcher service.
 */
const createMockDataFetcher = (pathToResponse = {}, errorPaths = []) => ({
    fetch: jest.fn(async (path) => {
        // console.log(`Mock Fetcher: Fetching ${path}`); // Debug log
        if (errorPaths.includes(path)) {
            // console.log(`Mock Fetcher: Returning error for ${path}`); // Debug log
            return Promise.reject(new Error(`Mock Fetch Error: Failed to fetch ${path}`));
        }
        if (path in pathToResponse) {
            // console.log(`Mock Fetcher: Returning data for ${path}`); // Debug log
            // Return a deep copy to prevent state bleeding between reads
            return Promise.resolve(JSON.parse(JSON.stringify(pathToResponse[path])));
        }
        // console.log(`Mock Fetcher: 404 for ${path}`); // Debug log
        return Promise.reject(new Error(`Mock Fetch Error: 404 Not Found for ${path}`));
    }),
});


/**
 * Creates a mock ISchemaValidator service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../../core/interfaces/coreServices.js').ISchemaValidator} Mocked schema validator service.
 */
const createMockSchemaValidator = (overrides = {}) => {
    const loadedSchemas = new Map();
    const schemaValidators = new Map();

    const mockValidator = {
        // Default to valid for any schema unless configured otherwise
        validate: jest.fn((schemaId, data) => {
            // console.log(`Mock Validator: Validating data against schema ${schemaId}`); // Debug log
            const validatorFn = schemaValidators.get(schemaId);
            if (validatorFn) {
                return validatorFn(data);
            }
            // Default to valid if no specific validator is set but schema might be "loaded"
            // This simplifies setup for integration tests not focused on schema errors
            // console.log(`Mock Validator: No specific validator for ${schemaId}, returning default valid.`); // Debug log
            return {isValid: true, errors: null};
        }),
        getValidator: jest.fn((schemaId) => {
            // console.log(`Mock Validator: Getting validator for ${schemaId}`); // Debug log
            return schemaValidators.get(schemaId) || (() => ({isValid: true, errors: null})); // Return a default valid function
        }),
        addSchema: jest.fn(async (schemaData, schemaId) => {
            // console.log(`Mock Validator: Adding schema ${schemaId}`); // Debug log
            loadedSchemas.set(schemaId, schemaData);
            // Add a default validator function if one doesn't exist
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        }),
        removeSchema: jest.fn((schemaId) => {
            // console.log(`Mock Validator: Removing schema ${schemaId}`); // Debug log
            const deletedData = loadedSchemas.delete(schemaId);
            const deletedValidator = schemaValidators.delete(schemaId);
            return deletedData || deletedValidator; // Return true if either was present
        }),
        isSchemaLoaded: jest.fn((schemaId) => {
            // console.log(`Mock Validator: Checking if schema ${schemaId} is loaded: ${loadedSchemas.has(schemaId)}`); // Debug log
            return loadedSchemas.has(schemaId);
        }),
        // Helper to configure specific validator behavior
        mockValidatorFunction: (schemaId, implementation) => {
            // console.log(`Mock Validator: Setting mock implementation for ${schemaId}`); // Debug log
            if (!schemaValidators.has(schemaId)) {
                // Ensure schema is considered 'loaded' if we define a validator
                loadedSchemas.set(schemaId, {}); // Add dummy schema data
            }
            schemaValidators.set(schemaId, jest.fn(implementation));
        },
        // Helper to simulate schema loading state for tests
        _setSchemaLoaded: (schemaId, schemaData = {}) => {
            // console.log(`Mock Validator: Force setting schema ${schemaId} as loaded`); // Debug log
            loadedSchemas.set(schemaId, schemaData);
            if (!schemaValidators.has(schemaId)) {
                schemaValidators.set(schemaId, jest.fn(() => ({isValid: true, errors: null})));
            }
        },
        // Helper to check internal state
        _isSchemaActuallyLoaded: (schemaId) => loadedSchemas.has(schemaId),
        _getLoadedSchemaData: (schemaId) => loadedSchemas.get(schemaId),
        ...overrides,
    };
    return mockValidator;
};

/**
 * Creates a mock ILogger service.
 * @param {object} [overrides={}] - Optional overrides for mock methods.
 * @returns {import('../../../../core/interfaces/coreServices.js').ILogger} Mocked logger service.
 */
const createMockLogger = (overrides = {}) => ({
    // Set default mocks using jest.fn()
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    // Allow overriding specific methods or adding new ones
    ...overrides,
});

// --- Test Suite ---

describe('Integration: Loaders, Registry State, and Overrides (REFACTOR-8.6)', () => {
    let mockConfig;
    let mockResolver;
    let mockFetcher; // Will be configured per test scenario, but initialized here
    let mockValidator;
    let mockLogger;
    let dataRegistry; // Use real InMemoryDataRegistry
    let actionLoader;
    let componentLoader;

    // --- Content Data ---
    const actionFilename = 'cool_action.json';
    const componentFilename = 'cool_component.json';

    // Base IDs (used in file content)
    const coolActionBaseId = 'cool_action'; // ID in file is just the base
    const coolComponentBaseId = 'cool_component'; // ID in file is just the base

    // Mod A data
    const modAId = 'modA';
    const modAPath = `./data/mods/${modAId}`;
    const modAActionPath = `${modAPath}/actions/${actionFilename}`;
    const modAComponentPath = `${modAPath}/components/${componentFilename}`;
    const modAActionData = {
        id: coolActionBaseId, // Use BASE ID
        commandVerb: "do_a",
        target_domain: "none",
        template: "Doing A",
        description: "From Mod A"
    };
    const modAComponentData = {
        id: coolComponentBaseId, // Use BASE ID
        dataSchema: {type: 'object', properties: {propA: {}}},
        description: "From Mod A"
    };
    const modAManifest = {
        id: modAId,
        name: 'Mod A',
        version: '1.0',
        content: {actions: [actionFilename], components: [componentFilename]}
    };

    // Mod B data
    const modBId = 'modB';
    const modBPath = `./data/mods/${modBId}`;
    const modBActionPath = `${modBPath}/actions/${actionFilename}`; // Same filename
    const modBComponentPath = `${modBPath}/components/${componentFilename}`; // Same filename
    const modBActionData = {
        id: coolActionBaseId, // Use BASE ID
        commandVerb: "do_b",
        target_domain: "self",
        template: "Doing B",
        description: "From Mod B"
    }; // Same base ID
    const modBComponentData = {
        id: coolComponentBaseId, // Use BASE ID
        dataSchema: {type: 'object', properties: {propB: {}}},
        description: "From Mod B"
    }; // Same base ID
    const modBManifest = {
        id: modBId,
        name: 'Mod B',
        version: '1.0',
        content: {actions: [actionFilename], components: [componentFilename]}
    };

    // Core Mod data (for override test)
    // Not used in current failing tests, but kept for reference

    // Mod X data (overrides core)
    // Not used in current failing tests, but kept for reference


    // --- Setup ---
    beforeEach(() => {
        mockConfig = createMockConfiguration();
        mockResolver = createMockPathResolver();
        mockFetcher = createMockDataFetcher(); // Initialize with default
        mockValidator = createMockSchemaValidator();
        mockLogger = createMockLogger();
        dataRegistry = new InMemoryDataRegistry(mockLogger);

        jest.spyOn(dataRegistry, 'store');
        jest.spyOn(dataRegistry, 'get');
        jest.spyOn(dataRegistry, 'getAll');

        actionLoader = new ActionLoader(mockConfig, mockResolver, mockFetcher, mockValidator, dataRegistry, mockLogger);
        componentLoader = new ComponentLoader(mockConfig, mockResolver, mockFetcher, mockValidator, dataRegistry, mockLogger);

        mockValidator._setSchemaLoaded('http://example.com/schemas/action.schema.json', {});
        mockValidator._setSchemaLoaded('http://example.com/schemas/component-definition.schema.json', {});
    });

    // --- Scenario 1: Non-Conflicting Base IDs ---
    describe('Scenario 1: Non-Conflicting Base IDs', () => {
        beforeEach(() => {
            const fetcherConfig = {
                [modAActionPath]: modAActionData,
                [modAComponentPath]: modAComponentData,
                [modBActionPath]: modBActionData,
                [modBComponentPath]: modBComponentData,
            };
            mockFetcher = createMockDataFetcher(fetcherConfig);
            actionLoader._dataFetcher = mockFetcher;
            componentLoader._dataFetcher = mockFetcher;
        });

        it('should store items from different mods with the same base ID under unique keys without warnings', async () => {
            // --- Act ---
            // Keep logs for now to confirm intermediate states if needed
            console.log(`Debug: Scenario 1 - Initial actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 1 - Loading Mod A Actions...');
            await actionLoader.loadActionsForMod(modAId, modAManifest);
            console.log(`Debug: Scenario 1 - After Mod A Actions - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 1 - Loading Mod A Components...');
            await componentLoader.loadComponentDefinitions(modAId, modAManifest);
            console.log(`Debug: Scenario 1 - After Mod A Components - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 1 - Loading Mod B Actions...');
            await actionLoader.loadActionsForMod(modBId, modBManifest);
            console.log(`Debug: Scenario 1 - After Mod B Actions - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 1 - Loading Mod B Components...');
            await componentLoader.loadComponentDefinitions(modBId, modBManifest);
            console.log(`Debug: Scenario 1 - After Mod B Components - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 1 - Loading Complete.');

            // --- Assert ---
            expect(dataRegistry.store).toHaveBeenCalledTimes(4); // Assert store count

            const actionA = dataRegistry.get('actions', 'modA:cool_action');
            const componentA = dataRegistry.get('components', 'modA:cool_component');
            const actionB = dataRegistry.get('actions', 'modB:cool_action');
            const componentB = dataRegistry.get('components', 'modB:cool_component');

            // **** FIX: Remove .withContext(...) ****
            expect(actionA).toBeDefined();
            expect(componentA).toBeDefined();
            expect(actionB).toBeDefined();
            expect(componentB).toBeDefined();
            // ****************************************

            // Verify Content and Metadata Augmentation
            expect(actionA).toEqual({
                ...modAActionData,
                id: 'modA:cool_action',
                modId: modAId,
                _sourceFile: actionFilename,
            });
            expect(componentA).toEqual({
                ...modAComponentData,
                id: 'modA:cool_component',
                modId: modAId,
                _sourceFile: componentFilename,
            });
            expect(actionB).toEqual({
                ...modBActionData,
                id: 'modB:cool_action',
                modId: modBId,
                _sourceFile: actionFilename,
            });
            expect(componentB).toEqual({
                ...modBComponentData,
                id: 'modB:cool_component',
                modId: modBId,
                _sourceFile: componentFilename,
            });

            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringMatching(/Overwriting existing/),
                expect.anything(),
                expect.anything()
            );
            mockLogger.warn.mock.calls.forEach(callArgs => {
                expect(callArgs[0]).not.toContain(`Overwriting existing actions definition with key 'modB:${coolActionBaseId}'`);
                expect(callArgs[0]).not.toContain(`Overwriting existing components definition with key 'modB:${coolComponentBaseId}'`);
            });

            expect(dataRegistry.get).toHaveBeenCalledWith('actions', 'modA:cool_action');
            expect(dataRegistry.get).toHaveBeenCalledWith('components', 'modA:cool_component');
            expect(dataRegistry.get).toHaveBeenCalledWith('actions', 'modB:cool_action');
            expect(dataRegistry.get).toHaveBeenCalledWith('components', 'modB:cool_component');
        });
    });

    // --- Scenario 2: True Key Override (Simulated via Re-loading) ---
    describe('Scenario 2: True Key Override (Warning Check)', () => {

        const overrideModId = 'overrideMod';
        const overrideActionFileV1 = 'action_v1.json';
        const overrideActionFileV2 = 'action_v2.json';
        const overrideActionIdInFile = 'core:special_action'; // Namespaced ID
        const overrideBaseId = 'special_action'; // Extracted base ID
        const overrideFinalKey = `${overrideModId}:${overrideBaseId}`; // Key: overrideMod:special_action

        const overrideActionDataV1 = {
            id: overrideActionIdInFile,
            commandVerb: "do_v1",
            target_domain: "none",
            template: "V1",
            description: "Version 1"
        };
        const overrideActionDataV2 = {
            id: overrideActionIdInFile,
            commandVerb: "do_v2",
            target_domain: "self",
            template: "V2",
            description: "Version 2"
        };

        const overrideActionPathV1 = `./data/mods/${overrideModId}/actions/${overrideActionFileV1}`;
        const overrideActionPathV2 = `./data/mods/${overrideModId}/actions/${overrideActionFileV2}`;

        beforeEach(() => {
            const fetcherConfig = {
                [overrideActionPathV1]: overrideActionDataV1,
                [overrideActionPathV2]: overrideActionDataV2,
            };
            mockFetcher = createMockDataFetcher(fetcherConfig);
            actionLoader._dataFetcher = mockFetcher;
        });

        it('should log a warning when an item is stored with the same final key as an existing item', async () => {
            actionLoader._processFetchedItem = ActionLoader.prototype._processFetchedItem.bind(actionLoader);

            console.log('Debug: Scenario 2 - Processing V1...');
            await actionLoader._processFetchedItem(
                overrideModId,
                overrideActionFileV1,
                overrideActionPathV1,
                overrideActionDataV1,
                'actions'
            );
            console.log(`Debug: Scenario 2 - After V1 - actions: ${dataRegistry.getAll('actions').length}`);

            const itemV1 = dataRegistry.get('actions', overrideFinalKey);
            // **** FIX: Remove .withContext(...) ****
            expect(itemV1).toBeDefined();
            // ****************************************
            expect(itemV1.description).toBe("Version 1");
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(dataRegistry.store).toHaveBeenCalledTimes(1);
            expect(dataRegistry.get).toHaveBeenCalledWith('actions', overrideFinalKey);

            mockLogger.warn.mockClear();
            dataRegistry.get.mockClear();
            dataRegistry.store.mockClear();

            console.log('Debug: Scenario 2 - Processing V2...');
            await actionLoader._processFetchedItem(
                overrideModId,
                overrideActionFileV2,
                overrideActionPathV2,
                overrideActionDataV2,
                'actions'
            );
            console.log(`Debug: Scenario 2 - After V2 - actions: ${dataRegistry.getAll('actions').length}`); // Should still be 1

            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            const expectedWarnMsg = `${ActionLoader.name} [${overrideModId}]: Overwriting existing actions definition with key '${overrideFinalKey}'. New Source: ${overrideActionFileV2}. Previous Source: ${overrideActionFileV1} from mod '${overrideModId}.'`;
            expect(mockLogger.warn).toHaveBeenCalledWith(expectedWarnMsg);

            expect(dataRegistry.get).toHaveBeenCalledWith('actions', overrideFinalKey);
            expect(dataRegistry.store).toHaveBeenCalledTimes(1);
            expect(dataRegistry.store).toHaveBeenCalledWith(
                'actions',
                overrideFinalKey,
                expect.objectContaining({description: "Version 2"})
            );

            const finalItem = dataRegistry.get('actions', overrideFinalKey);
            expect(finalItem).toBeDefined();
            expect(finalItem.description).toBe("Version 2");
            expect(finalItem.id).toBe(overrideFinalKey);
            expect(finalItem.modId).toBe(overrideModId);
            expect(finalItem._sourceFile).toBe(overrideActionFileV2);

            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });


    // --- Scenario 3: Registry State Verification ---
    describe('Scenario 3: Registry State Verification', () => {

        const diverseActionFilename = 'diverse_action.json';
        const diverseComponentFilename = 'diverse_component.json';

        const modCId = 'modC';
        const modCPath = `./data/mods/${modCId}`;
        const modCComponentPath = `${modCPath}/components/${diverseComponentFilename}`;
        const modCComponentData = {id: 'unique_comp', dataSchema: {type: 'string'}, description: "From Mod C"}; // Base ID only
        const modCManifest = {
            id: modCId,
            name: 'Mod C',
            version: '1.0',
            content: {components: [diverseComponentFilename]}
        };

        const modDId = 'modD';
        const modDPath = `./data/mods/${modDId}`;
        const modDActionPath = `${modDPath}/actions/${diverseActionFilename}`;
        const modDActionData = {
            id: 'unique_action', // Base ID only
            commandVerb: "do_d",
            target_domain: "inventory",
            template: "Doing D",
            description: "From Mod D"
        };
        const modDManifest = {id: modDId, name: 'Mod D', version: '1.0', content: {actions: [diverseActionFilename]}};


        beforeEach(() => {
            const fetcherConfig = {
                [modAActionPath]: modAActionData, // id: cool_action
                [modAComponentPath]: modAComponentData, // id: cool_component
                [modBActionPath]: modBActionData, // id: cool_action
                [modBComponentPath]: modBComponentData, // id: cool_component
                [modCComponentPath]: modCComponentData, // id: unique_comp
                [modDActionPath]: modDActionData, // id: unique_action
            };
            mockFetcher = createMockDataFetcher(fetcherConfig);
            actionLoader._dataFetcher = mockFetcher;
            componentLoader._dataFetcher = mockFetcher;
        });

        it('should store items with correct keys and augmented metadata', async () => {
            // --- Act ---
            console.log(`Debug: Scenario 3 - Initial actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod A Actions...');
            await actionLoader.loadActionsForMod(modAId, modAManifest);
            console.log(`Debug: Scenario 3 - After Mod A Actions - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod A Components...');
            await componentLoader.loadComponentDefinitions(modAId, modAManifest);
            console.log(`Debug: Scenario 3 - After Mod A Components - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod B Actions...');
            await actionLoader.loadActionsForMod(modBId, modBManifest);
            console.log(`Debug: Scenario 3 - After Mod B Actions - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod B Components...');
            await componentLoader.loadComponentDefinitions(modBId, modBManifest);
            console.log(`Debug: Scenario 3 - After Mod B Components - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod C Components...');
            await componentLoader.loadComponentDefinitions(modCId, modCManifest);
            console.log(`Debug: Scenario 3 - After Mod C Components - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Mod D Actions...');
            await actionLoader.loadActionsForMod(modDId, modDManifest);
            console.log(`Debug: Scenario 3 - After Mod D Actions - actions: ${dataRegistry.getAll('actions').length}, components: ${dataRegistry.getAll('components').length}`);
            console.log('Debug: Scenario 3 - Loading Complete.');


            // --- Assert ---
            const expectedItems = [
                {
                    type: 'actions',
                    key: 'modA:cool_action',
                    sourceFile: actionFilename,
                    modId: modAId,
                    originalData: modAActionData
                },
                {
                    type: 'components',
                    key: 'modA:cool_component',
                    sourceFile: componentFilename,
                    modId: modAId,
                    originalData: modAComponentData
                },
                {
                    type: 'actions',
                    key: 'modB:cool_action',
                    sourceFile: actionFilename,
                    modId: modBId,
                    originalData: modBActionData
                },
                {
                    type: 'components',
                    key: 'modB:cool_component',
                    sourceFile: componentFilename,
                    modId: modBId,
                    originalData: modBComponentData
                },
                {
                    type: 'components',
                    key: 'modC:unique_comp',
                    sourceFile: diverseComponentFilename,
                    modId: modCId,
                    originalData: modCComponentData
                }, // Base ID extracted correctly
                {
                    type: 'actions',
                    key: 'modD:unique_action',
                    sourceFile: diverseActionFilename,
                    modId: modDId,
                    originalData: modDActionData
                }, // Base ID extracted correctly
            ];

            expect(dataRegistry.store).toHaveBeenCalledTimes(expectedItems.length); // Expect 6 calls

            for (const expected of expectedItems) {
                const retrievedItem = dataRegistry.get(expected.type, expected.key);

                // **** FIX: Remove .withContext(...) ****
                expect(retrievedItem).toBeDefined();
                expect(retrievedItem.id).toBe(expected.key);
                expect(retrievedItem.modId).toBe(expected.modId);
                expect(retrievedItem._sourceFile).toBe(expected.sourceFile);
                // ****************************************

                const {id: originalId, ...restOfOriginalData} = expected.originalData;
                const {
                    id: retrievedId,
                    modId: retrievedModId,
                    _sourceFile: retrievedSourceFile,
                    ...restOfRetrievedData
                } = retrievedItem;

                // **** FIX: Remove .withContext(...) ****
                expect(restOfRetrievedData).toEqual(restOfOriginalData);
                // ****************************************
            }

            expect(dataRegistry.getAll('actions').length).toBe(3);
            expect(dataRegistry.getAll('components').length).toBe(3);

            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringMatching(/Overwriting existing/),
                expect.anything(),
                expect.anything()
            );
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });
});