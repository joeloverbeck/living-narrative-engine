// Filename: src/tests/core/loaders/worldLoader.partialContent.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../../core/loaders/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../../core/modding/modDependencyValidator.js';
jest.mock('../../../core/modding/modDependencyValidator.js', () => ({
    validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../../core/modding/modVersionValidator.js';
jest.mock('../../../core/modding/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../../core/modding/modLoadOrderResolver.js';
jest.mock('../../../core/modding/modLoadOrderResolver.js', () => ({
    resolveOrder: jest.fn(),
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../../core/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../../core/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../../core/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../../core/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../../core/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../../core/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../../core/loaders/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../core/interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Added missing import


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
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */ // Added missing mock type
    let mockValidatedEventDispatcher;

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
                    const lcId = id.toLowerCase(); // Ensure lookup is case-insensitive
                    if (lcId === coreModId) return mockCoreManifest;
                    if (lcId === modAId) return mockModAManifest;
                    if (lcId === modBId) return mockModBManifest;
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
            getManifest: jest.fn((id) => { // Make getManifest use the internal store for consistency
                const lcId = id.toLowerCase();
                if (lcId === coreModId) return mockCoreManifest;
                if (lcId === modAId) return mockModAManifest;
                if (lcId === modBId) return mockModBManifest;
                return null;
            }),
            setManifest: jest.fn((id, manifest) => { // Make setManifest consistent
                if (!internalStore['mod_manifests']) internalStore['mod_manifests'] = {};
                internalStore['mod_manifests'][id.toLowerCase()] = manifest;
            }),
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
            isSchemaLoaded: jest.fn(), // Will be configured below
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

        // *** ADDED: Mock for ValidatedEventDispatcher ***
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Mock the method used
        };

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
        // Mock configuration to return predictable schema IDs
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);

        // *** CORRECTED: Configure mockValidator.isSchemaLoaded to return true for ALL essentials ***
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            const loadedSchemas = [
                'schema:game',
                'schema:components',
                'schema:mod-manifest',
                'schema:entities',
                'schema:actions',   // <-- Added
                'schema:events',    // <-- Added
                'schema:rules'      // <-- Added
            ];
            return loadedSchemas.includes(schemaId);
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
                return { count: 1, overrides: 0, errors: 0 }; // Return expected structure
            }
            return { count: 0, overrides: 0, errors: 0 }; // Other mods don't define components
        });

        // Configure ActionLoader (only responds to 'modA')
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === modAId && typeNameArg === 'actions') {
                const itemId = `${modAId}:action1`;
                const itemData = { value: 'modA_action_data' };
                mockRegistry.store('actions', itemId, itemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${itemId} for ${modIdArg}`);
                return { count: 1, overrides: 0, errors: 0 }; // Return expected structure
            }
            return { count: 0, overrides: 0, errors: 0 }; // Other mods don't define actions
        });

        // Configure RuleLoader (only responds to 'modB')
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (modIdArg === modBId && typeNameArg === 'rules') {
                const itemId = `${modBId}:rule1`;
                const itemData = { value: 'modB_rule_data' };
                mockRegistry.store('rules', itemId, itemData);
                mockLogger.debug(`Mock RuleLoader: Stored ${itemId} for ${modIdArg}`);
                return { count: 1, overrides: 0, errors: 0 }; // Return expected structure
            }
            return { count: 0, overrides: 0, errors: 0 }; // Other mods don't define rules
        });

        // EventLoader should not be called (and return 0 if it were)
        mockEventLoader.loadItemsForMod.mockResolvedValue({ count: 0, overrides: 0, errors: 0 });
        // EntityLoader should not be called (no entity defs in manifests)
        mockEntityLoader.loadItemsForMod.mockResolvedValue({ count: 0, overrides: 0, errors: 0 });


        // --- 4. Instantiate SUT ---
        // *** CORRECTED: Pass a single object with named properties ***
        worldLoader = new WorldLoader({
            registry: mockRegistry,
            logger: mockLogger,
            schemaLoader: mockSchemaLoader,
            componentLoader: mockComponentLoader,
            ruleLoader: mockRuleLoader,
            actionLoader: mockActionLoader,
            eventLoader: mockEventLoader,
            entityLoader: mockEntityLoader,
            validator: mockValidator,
            configuration: mockConfiguration,
            gameConfigLoader: mockGameConfigLoader,
            modManifestLoader: mockModManifestLoader,
            validatedEventDispatcher: mockValidatedEventDispatcher // Pass the added mock
        });
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
        // Note: The check for skipping happens *before* the loader is called. We assert the loader wasn't called *with modA args*.
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            modAId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
        // Check for the specific debug message for skipping modA's events (empty list)
        // WorldLoader checks `manifest.content[contentKey]` before calling the loader
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(/WorldLoader \[modA\]: Skipping content type 'events' \(key: 'events'\)/)
            // `WorldLoader [${modId}]: Skipping content type '${typeName}' (key: '${contentKey}') as it's not defined or empty in the manifest.`
        );

        // Verify eventLoader.loadItemsForMod was NOT called for modB (missing key)
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            modBId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
        // Check for the specific debug message for skipping modB's events (missing key)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(/WorldLoader \[modB\]: Skipping content type 'events' \(key: 'events'\)/)
        );

        // Verify other loaders not relevant to *any* mod's manifest were not called
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalled();
        // Specifically check EventLoader wasn't called for core either
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(
            coreModId, expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringMatching(/WorldLoader \[core\]: Skipping content type 'events' \(key: 'events'\)/)
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
        expect(mockRegistry.getAll('events')).toEqual([]); // Check the specific type isn't populated
        expect(mockRegistry.getAll('entities')).toEqual([]); // Check the specific type isn't populated

        // Verify the summary log (logger.info) only lists counts for components, actions, and rules
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);

        // Check presence and counts (based on loader mock return values)
        // Use regex for flexibility with spacing and counts
        expect(summaryLines).toEqual(expect.arrayContaining([
            expect.stringContaining(`WorldLoader Load Summary (World: '${worldName}')`),
            expect.stringContaining(`Requested Mods (raw): [${coreModId}, ${modAId}, ${modBId}]`),
            expect.stringContaining(`Final Load Order    : [${coreModId}, ${modAId}, ${modBId}]`),
            expect.stringContaining(`Content Loading Summary (Totals):`),
            // Counts should match the return values of the mocks (C:1, O:0, E:0 for each)
            expect.stringMatching(/actions\s+: C:1, O:0, E:0/),    // From modA
            expect.stringMatching(/components\s+: C:1, O:0, E:0/), // From core
            expect.stringMatching(/rules\s+: C:1, O:0, E:0/),      // From modB
            expect.stringMatching(/TOTAL\s+: C:3, O:0, E:0/),      // Grand Total
            expect.stringContaining('———————————————————————————————————————————')
        ]));

        // Ensure types NOT loaded (events, entities, etc.) are NOT in the summary counts
        expect(summaryLines.some(line => /events\s+: C:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /entities\s+: C:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /blockers\s+: C:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /items\s+: C:/.test(line))).toBe(false);
        // ... etc for other types

        // Verify registry.clear was called only once at the beginning
        expect(mockRegistry.clear).toHaveBeenCalledTimes(1);

        // Verify event dispatcher calls (optional but good practice)
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:world_loader:started',
            expect.objectContaining({ worldName }),
            expect.objectContaining({ allowSchemaNotFound: true }) // Check options too
        );
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'initialization:world_loader:completed',
            expect.objectContaining({
                worldName,
                modsLoaded: [coreModId, modAId, modBId],
                // Compare against the expected TotalResultsSummary structure
                counts: {
                    components: { count: 1, overrides: 0, errors: 0 },
                    actions: { count: 1, overrides: 0, errors: 0 },
                    rules: { count: 1, overrides: 0, errors: 0 }
                }
            }),
            expect.objectContaining({ allowSchemaNotFound: true })
        );
        expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            expect.stringContaining('failed'), // Ensure no failure events were dispatched
            expect.anything(),
            expect.anything()
        );

    });
});
