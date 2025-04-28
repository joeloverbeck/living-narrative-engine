// Filename: test/integration/worldLoader.errorHandling.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../core/services/modDependencyValidator.js';
jest.mock('../../core/services/modDependencyValidator.js', () => ({
    validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../core/services/modVersionValidator.js';
jest.mock('../../core/services/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../core/services/modLoadOrderResolver.js';
jest.mock('../../core/services/modLoadOrderResolver.js', () => ({
    resolveOrder: jest.fn(),
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../core/services/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../core/services/eventLoader.js').default} EventLoader */
/** @typedef {import('../../core/services/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../core/services/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../core/services/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../core/services/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../core/services/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../core/services/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../core/interfaces/manifestItems.js').ModManifest} ModManifest */


describe('WorldLoader Integration Test Suite - Error Handling (TEST-LOADER-7.4)', () => {
    /** @type {WorldLoader} */
    let worldLoader;

    // --- Mock Instances ---
    /** @type {jest.Mocked<IDataRegistry> & { _internalStore: Record<string, Record<string, any>> }} */
    let mockRegistry;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<SchemaLoader>} */
    let mockSchemaLoader;
    /** @type {jest.Mocked<ComponentLoader>} */
    let mockComponentLoader;
    /** @type {jest.Mocked<RuleLoader>} */
    let mockRuleLoader;
    /** @type {jest.Mocked<ActionLoader>} */
    let mockActionLoader;
    /** @type {jest.Mocked<EventLoader>} */
    let mockEventLoader;
    /** @type {jest.Mocked<EntityLoader>} */
    let mockEntityLoader;
    /** @type {jest.Mocked<ISchemaValidator>} */
    let mockValidator;
    /** @type {jest.Mocked<IConfiguration>} */
    let mockConfiguration;
    /** @type {jest.Mocked<GameConfigLoader>} */
    let mockGameConfigLoader;
    /** @type {jest.Mocked<ModManifestLoader>} */
    let mockModManifestLoader;

    // --- Mock Data ---
    /** @type {ModManifest} */
    let mockCoreManifest;
    /** @type {ModManifest} */
    let mockBadModManifest;
    /** @type {Map<string, ModManifest>} */
    let mockManifestMap;
    const coreModId = 'core';
    const badModId = 'badMod';
    const worldName = 'testWorldContentError';
    const simulatedErrorMessage = 'Simulated validation/parsing failure';

    // --- Mocked Functions (from imports) ---
    const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
    const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
    const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks between tests

        // --- 1. Create Mocks ---
        // Create a mock registry with an internal store
        const internalStore = {};
        mockRegistry = {
            _internalStore: internalStore,
            store: jest.fn((type, id, data) => {
                if (!internalStore[type]) internalStore[type] = {};
                internalStore[type][id] = data;
                // console.log(`MockRegistry STORE: ${type} / ${id}`, data);
            }),
            get: jest.fn((type, id) => {
                // Handle manifest lookups (lowercase keys used by WorldLoader for get)
                if (type === 'mod_manifests') {
                    if (id === coreModId.toLowerCase()) return mockCoreManifest;
                    if (id === badModId.toLowerCase()) return mockBadModManifest;
                }
                const result = internalStore[type]?.[id];
                // console.log(`MockRegistry GET: ${type} / ${id}`, result);
                return result;
            }),
            getAll: jest.fn((type) => {
                const items = Object.values(internalStore[type] || {});
                // console.log(`MockRegistry GETALL: ${type}`, items);
                return items;
            }),
            clear: jest.fn(() => {
                Object.keys(internalStore).forEach(key => delete internalStore[key]);
                // console.log(`MockRegistry CLEARED`);
            }),
            // Add other methods with basic mocks
            getAllSystemRules: jest.fn(() => []),
            getManifest: jest.fn(() => null),
            setManifest: jest.fn(),
            getEntityDefinition: jest.fn((id) => internalStore['entities']?.[id]),
            getItemDefinition: jest.fn((id) => internalStore['items']?.[id]),
            getLocationDefinition: jest.fn((id) => internalStore['locations']?.[id]),
            getConnectionDefinition: jest.fn((id) => internalStore['connections']?.[id]),
            getBlockerDefinition: jest.fn((id) => internalStore['blockers']?.[id]),
            getActionDefinition: jest.fn((id) => internalStore['actions']?.[id]),
            getEventDefinition: jest.fn((id) => internalStore['events']?.[id]),
            getComponentDefinition: jest.fn((id) => internalStore['components']?.[id]),
            getAllEntityDefinitions: jest.fn(() => Object.values(internalStore['entities'] || {})),
            getAllItemDefinitions: jest.fn(() => Object.values(internalStore['items'] || {})),
            getAllLocationDefinitions: jest.fn(() => Object.values(internalStore['locations'] || {})),
            getAllConnectionDefinitions: jest.fn(() => Object.values(internalStore['connections'] || {})),
            getAllBlockerDefinitions: jest.fn(() => Object.values(internalStore['blockers'] || {})),
            getAllActionDefinitions: jest.fn(() => Object.values(internalStore['actions'] || {})),
            getAllEventDefinitions: jest.fn(() => Object.values(internalStore['events'] || {})),
            getAllComponentDefinitions: jest.fn(() => Object.values(internalStore['components'] || {})),
            getStartingPlayerId: jest.fn(() => null),
            getStartingLocationId: jest.fn(() => null),
        };

        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(), // Spy on error
        };
        mockSchemaLoader = { loadAndCompileAllSchemas: jest.fn() };
        mockValidator = {
            isSchemaLoaded: jest.fn(),
            addSchema: jest.fn(), removeSchema: jest.fn(), getValidator: jest.fn(), validate: jest.fn(),
        };
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(() => './data'), getSchemaFiles: jest.fn(() => []),
            getSchemaBasePath: jest.fn(() => 'schemas'), getContentBasePath: jest.fn(() => 'content'),
            getWorldBasePath: jest.fn(() => 'worlds'), getGameConfigFilename: jest.fn(() => 'game.json'),
            getModsBasePath: jest.fn(() => 'mods'), getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
        };
        mockGameConfigLoader = { loadConfig: jest.fn() };
        mockModManifestLoader = { loadRequestedManifests: jest.fn() };

        // Mock individual content loaders
        mockActionLoader = { loadItemsForMod: jest.fn() };
        mockComponentLoader = { loadItemsForMod: jest.fn() }; // This will throw
        mockEventLoader = { loadItemsForMod: jest.fn() };
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Mock Data (as per TEST-LOADER-7.4) ---
        mockCoreManifest = {
            id: coreModId, version: '1.0.0', name: 'Core', gameVersion: '^1.0.0',
            content: {
                actions: ['core_action.json'], // Core has one valid action
            },
        };
        mockBadModManifest = {
            id: badModId, version: '1.0.0', name: 'Bad Mod', gameVersion: '^1.0.0',
            content: {
                components: ['bad_comp.json'], // This type will cause an error
                rules: ['good_rule.json'],    // This type should still load
            },
        };

        mockManifestMap = new Map();
        // Store with original case keys (as returned by ModManifestLoader)
        mockManifestMap.set(coreModId, mockCoreManifest);
        mockManifestMap.set(badModId, mockBadModManifest);


        // --- 3. Configure Mocks ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            // Assume essential schemas are loaded
            return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
        });

        // GameConfigLoader - Request both mods
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, badModId]);

        // ModManifestLoader - Return both manifests
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);

        // Static/Imported Mocks (assume success)
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });
        mockedResolveOrder.mockReturnValue([coreModId, badModId]); // Define load order

        // --- Configure Content Loader Mocks (Specific behaviors) ---

        // ActionLoader: Succeeds for core
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === coreModId && typeNameArg === 'actions') {
                const itemId = `${coreModId}:action1`;
                const itemData = { id: itemId, value: 'core_action_data' };
                mockRegistry.store('actions', itemId, itemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${itemId} for ${modIdArg}`);
                return 1; // Matches manifest list length for core actions
            }
            return 0;
        });

        // ComponentLoader: THROWS for badMod
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === badModId && typeNameArg === 'components') {
                mockLogger.debug(`Mock ComponentLoader: Simulating error for ${modIdArg}/${typeNameArg}`);
                throw new Error(simulatedErrorMessage); // Simulate the error
            }
            return 0;
        });

        // RuleLoader: Succeeds for badMod
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === badModId && typeNameArg === 'rules') {
                const itemId = `${badModId}:rule1`;
                const itemData = { id: itemId, value: 'badMod_rule_data' };
                mockRegistry.store('rules', itemId, itemData);
                mockLogger.debug(`Mock RuleLoader: Stored ${itemId} for ${modIdArg}`);
                return 1; // Matches manifest list length for badMod rules
            }
            return 0;
        });

        // Other loaders are mocked but won't be called based on manifests
        mockEventLoader.loadItemsForMod.mockResolvedValue(0);
        mockEntityLoader.loadItemsForMod.mockResolvedValue(0);


        // --- 4. Instantiate SUT ---
        worldLoader = new WorldLoader(
            mockRegistry,
            mockLogger,
            mockSchemaLoader,
            mockComponentLoader,
            mockRuleLoader,
            mockActionLoader,
            mockEventLoader,
            mockEntityLoader,
            mockValidator,
            mockConfiguration,
            mockGameConfigLoader,
            mockModManifestLoader
        );
    });

    // ── Test Case: Content Loading Error Handling ─────────────────────────
    it('should log error and continue loading other content when a content file fails validation/parsing', async () => {
        // --- Action ---
        await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

        // --- Assertions ---

        // Verify loadWorld resolves successfully (covered by expect(...).resolves)

        // Verify logger.error was called with details about the failure
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${badModId}]: Error loading content type 'components'`), // Check main message part
            expect.objectContaining({ // Check context object
                modId: badModId,
                contentType: 'components',
                error: simulatedErrorMessage,
            }),
            expect.any(Error) // Check the third argument is an Error instance
        );
        // More detailed check on the error argument if needed
        const errorCallArgs = mockLogger.error.mock.calls[0];
        expect(errorCallArgs[2]).toBeInstanceOf(Error);
        expect(errorCallArgs[2].message).toBe(simulatedErrorMessage);


        // Verify actionLoader.loadItemsForMod (for core) completed successfully
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(coreModId, mockCoreManifest, 'actions', 'actions', 'actions');
        // Check that the item was actually stored by the mock
        expect(mockRegistry.get('actions', `${coreModId}:action1`)).toBeDefined();

        // Verify componentLoader.loadItemsForMod (for badMod) was called (and threw internally)
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(badModId, mockBadModManifest, 'components', 'components', 'components');
        // Verify no component was stored for badMod
        expect(mockRegistry.getAll('components')).toEqual([]);
        expect(mockRegistry.get('components', `${badModId}:component1`)).toBeUndefined();


        // Verify ruleLoader.loadItemsForMod (for badMod) was still called and completed successfully AFTER the component loader failed
        expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledWith(badModId, mockBadModManifest, 'rules', 'rules', 'rules');
        // Check that the item was actually stored by the mock
        expect(mockRegistry.get('rules', `${badModId}:rule1`)).toBeDefined();


        // Verify the registry contains core:action1
        const coreAction = mockRegistry.get('actions', `${coreModId}:action1`);
        expect(coreAction).toBeDefined();
        expect(coreAction).toEqual({ id: 'core:action1', value: 'core_action_data' });

        // Verify the registry contains badMod:rule1
        const badModRule = mockRegistry.get('rules', `${badModId}:rule1`);
        expect(badModRule).toBeDefined();
        expect(badModRule).toEqual({ id: 'badMod:rule1', value: 'badMod_rule_data' });

        // Verify the registry does not contain the component from bad_comp.json (re-check getAll)
        expect(mockRegistry.getAll('components').length).toBe(0);


        // Verify the summary log (logger.info) reflects the counts ONLY for the successfully loaded items
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);

        // Check presence and counts (based on SUCCESSFUL loader mock return values)
        expect(summaryLines).toEqual(expect.arrayContaining([
            expect.stringContaining(`WorldLoader Load Summary (World: '${worldName}')`),
            expect.stringContaining(`Requested Mods (raw): [${coreModId}, ${badModId}]`),
            expect.stringContaining(`Final Load Order    : [${coreModId}, ${badModId}]`),
            expect.stringContaining(`Content Loading Summary:`),
            // Counts should match the return values of the successful mocks
            expect.stringMatching(/actions\s+: 1 loaded/),    // From core mod
            expect.stringMatching(/rules\s+: 1 loaded/),      // From badMod
            expect.stringContaining('———————————————————————————————————————————')
        ]));

        // Ensure types that failed (components) or were not present (events, etc.) are NOT in the summary counts
        expect(summaryLines.some(line => /components\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /events\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /entities\s+:/.test(line))).toBe(false);

        // Verify registry.clear was called only once at the beginning
        expect(mockRegistry.clear).toHaveBeenCalledTimes(1);

        // Verify logger.info was called for starting/finishing the load for badMod, despite the error
        expect(mockLogger.info).toHaveBeenCalledWith(`--- Loading content for mod: ${badModId} ---`);
        expect(mockLogger.info).toHaveBeenCalledWith(`--- Finished loading content for mod: ${badModId} ---`);

    });
});