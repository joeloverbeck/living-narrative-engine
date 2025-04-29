// Filename: test/integration/worldLoader.partialContent.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../core/loaders/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../core/modding/modDependencyValidator.js';
jest.mock('../../core/modding/modDependencyValidator.js', () => ({
    validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../core/modding/modVersionValidator.js';
jest.mock('../../core/modding/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../core/modding/modLoadOrderResolver.js';
jest.mock('../../core/modding/modLoadOrderResolver.js', () => ({
    resolveOrder: jest.fn(),
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../core/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../core/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../core/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../core/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../core/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../core/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../core/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../core/loaders/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../core/interfaces/manifestItems.js').ModManifest} ModManifest */


describe('WorldLoader Integration Test Suite - Partial/Empty Content (TEST-LOADER-7.3)', () => {
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
    let mockModAManifest;
    /** @type {ModManifest} */
    let mockModBManifest;
    /** @type {Map<string, ModManifest>} */
    let mockManifestMap;
    const coreModId = 'core';
    const modAId = 'modA';
    const modBId = 'modB';
    const worldName = 'testWorldPartialContent';

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
                // console.log(`MockRegistry STORE: ${type} / ${id}`, data); // Debug log
            }),
            get: jest.fn((type, id) => {
                // Handle manifest lookups (lowercase keys used by WorldLoader for get)
                if (type === 'mod_manifests') {
                    if (id === coreModId.toLowerCase()) return mockCoreManifest;
                    if (id === modAId.toLowerCase()) return mockModAManifest;
                    if (id === modBId.toLowerCase()) return mockModBManifest;
                }
                const result = internalStore[type]?.[id];
                // console.log(`MockRegistry GET: ${type} / ${id}`, result); // Debug log
                return result;
            }),
            getAll: jest.fn((type) => {
                const items = Object.values(internalStore[type] || {});
                // console.log(`MockRegistry GETALL: ${type}`, items); // Debug log
                return items;
            }),
            clear: jest.fn(() => {
                Object.keys(internalStore).forEach(key => delete internalStore[key]);
                // console.log(`MockRegistry CLEARED`); // Debug log
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
            debug: jest.fn(), // Spy on debug for skipping messages
            warn: jest.fn(),
            error: jest.fn(),
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
        mockComponentLoader = { loadItemsForMod: jest.fn() };
        mockEventLoader = { loadItemsForMod: jest.fn() }; // Will assert this isn't called
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Mock Data (as per TEST-LOADER-7.3) ---
        mockCoreManifest = {
            id: coreModId, version: '1.0.0', name: 'Core', gameVersion: '^1.0.0',
            content: {
                components: ['core_comp.json'], // Only components
            },
        };
        mockModAManifest = {
            id: modAId, version: '1.0.0', name: 'Mod A', gameVersion: '^1.0.0',
            content: {
                actions: ['modA_action.json'], // Only actions
                events: [], // Explicitly empty events
            },
        };
        mockModBManifest = {
            id: modBId, version: '1.0.0', name: 'Mod B', gameVersion: '^1.0.0',
            content: {
                rules: ['modB_rule.json'], // Only rules
                // No 'events' key at all
            },
        };

        mockManifestMap = new Map();
        // Store with original case keys (as returned by ModManifestLoader)
        mockManifestMap.set(coreModId, mockCoreManifest);
        mockManifestMap.set(modAId, mockModAManifest);
        mockManifestMap.set(modBId, mockModBManifest);


        // --- 3. Configure Mocks ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            // Assume essential schemas are loaded
            return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
        });

        // GameConfigLoader - Request all three mods
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, modAId, modBId]);

        // ModManifestLoader - Return all three manifests
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);

        // Static/Imported Mocks (assume success)
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });
        mockedResolveOrder.mockReturnValue([coreModId, modAId, modBId]); // Define load order

        // --- Configure Content Loader Mocks ---
        // Configure ComponentLoader (only responds to 'core')
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === coreModId && typeNameArg === 'components') {
                const itemId = `${coreModId}:component1`;
                const itemData = { value: 'core_comp_data' };
                mockRegistry.store('components', itemId, itemData);
                mockLogger.debug(`Mock ComponentLoader: Stored ${itemId} for ${modIdArg}`);
                return 1; // Matches manifest list length for core
            }
            return 0; // Other mods don't define components
        });

        // Configure ActionLoader (only responds to 'modA')
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === modAId && typeNameArg === 'actions') {
                const itemId = `${modAId}:action1`;
                const itemData = { value: 'modA_action_data' };
                mockRegistry.store('actions', itemId, itemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${itemId} for ${modIdArg}`);
                return 1; // Matches manifest list length for modA
            }
            return 0; // Other mods don't define actions
        });

        // Configure RuleLoader (only responds to 'modB')
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === modBId && typeNameArg === 'rules') {
                const itemId = `${modBId}:rule1`;
                const itemData = { value: 'modB_rule_data' };
                mockRegistry.store('rules', itemId, itemData);
                mockLogger.debug(`Mock RuleLoader: Stored ${itemId} for ${modIdArg}`);
                return 1; // Matches manifest list length for modB
            }
            return 0; // Other mods don't define rules
        });

        // EventLoader should not be called
        mockEventLoader.loadItemsForMod.mockResolvedValue(0);
        // EntityLoader should not be called (no entity defs in manifests)
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

    // ── Test Case: Load with Partial/Empty Content ─────────────────────────
    it('should correctly load mods with partial or empty content definitions', async () => {
        // --- Action ---
        await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

        // --- Assertions ---

        // Verify loadWorld resolves successfully (covered by expect(...).resolves)

        // Verify load order was stored
        expect(mockRegistry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [coreModId, modAId, modBId]);

        // Verify correct loaders were called for the correct mods
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(coreModId, mockCoreManifest, 'components', 'components', 'components');

        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(modAId, mockModAManifest, 'actions', 'actions', 'actions');

        expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledWith(modBId, mockModBManifest, 'rules', 'rules', 'rules');

        // Verify eventLoader.loadItemsForMod was NOT called for modA (empty list)
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            modAId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
        // Check for the specific debug message for skipping modA's events (empty list)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modAId}]: No 'events' listed in manifest. Skipping loading for type 'events'.`)
        );

        // Verify eventLoader.loadItemsForMod was NOT called for modB (missing key)
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            modBId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
        // Check for the specific debug message for skipping modB's events (missing key)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modBId}]: No 'events' listed in manifest. Skipping loading for type 'events'.`)
        );

        // Verify other loaders not relevant to *any* mod's manifest were not called
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalled();
        // Specifically check EventLoader wasn't called for core either
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            coreModId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );


        // Verify the registry contains the expected items
        const loadedComponent = mockRegistry.get('components', `${coreModId}:component1`);
        expect(loadedComponent).toBeDefined();
        expect(loadedComponent).toEqual({ value: 'core_comp_data' });

        const loadedAction = mockRegistry.get('actions', `${modAId}:action1`);
        expect(loadedAction).toBeDefined();
        expect(loadedAction).toEqual({ value: 'modA_action_data' });

        const loadedRule = mockRegistry.get('rules', `${modBId}:rule1`);
        expect(loadedRule).toBeDefined();
        expect(loadedRule).toEqual({ value: 'modB_rule_data' });

        // Verify no unexpected items were stored (e.g., events)
        expect(mockRegistry.get('events', expect.any(String))).toBeUndefined();
        expect(mockRegistry.get('entities', expect.any(String))).toBeUndefined();

        // Verify the summary log (logger.info) only lists counts for components, actions, and rules
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);

        // Check presence and counts (based on loader mock return values)
        expect(summaryLines).toEqual(expect.arrayContaining([
            expect.stringContaining(`WorldLoader Load Summary (World: '${worldName}')`),
            expect.stringContaining(`Requested Mods (raw): [${coreModId}, ${modAId}, ${modBId}]`),
            expect.stringContaining(`Final Load Order    : [${coreModId}, ${modAId}, ${modBId}]`),
            expect.stringContaining(`Content Loading Summary:`),
            // Counts should match the return values of the mocks (1 for each)
            expect.stringMatching(/actions\s+: 1 loaded/),    // From modA
            expect.stringMatching(/components\s+: 1 loaded/), // From core
            expect.stringMatching(/rules\s+: 1 loaded/),      // From modB
            expect.stringContaining('———————————————————————————————————————————')
        ]));

        // Ensure types NOT loaded (events, entities, etc.) are NOT in the summary counts
        expect(summaryLines.some(line => /events\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /entities\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /blockers\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /items\s+:/.test(line))).toBe(false);
        // ... etc for other types

        // Verify registry.clear was called only once at the beginning
        expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
    });
});