// Filename: test/integration/worldLoader.override.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../core/services/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader if they are used at module level or constructor indirectly
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


describe('WorldLoader Integration Test Suite - Overrides (TEST-LOADER-7.2)', () => {
    /** @type {WorldLoader} */
    let worldLoader;

    // --- Mock Instances ---
    /** @type {jest.Mocked<IDataRegistry> & { _internalStore: Record<string, Record<string, any>> }} */
    let mockRegistry; // Added internal store for realistic get/getAll
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
    let mockOverrideManifest;
    /** @type {Map<string, ModManifest>} */
    let mockManifestMap;
    const coreModId = 'core';
    const overrideModId = 'overrideMod';
    const worldName = 'testWorldWithOverrides';

    // --- Mocked Functions (from imports) ---
    const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
    const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
    const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks between tests

        // --- 1. Create Mocks ---
        // Create a mock registry with an internal store to simulate data storage and retrieval accurately
        const internalStore = {};
        mockRegistry = {
            _internalStore: internalStore, // Expose for debugging if needed, but use methods
            store: jest.fn((type, id, data) => {
                if (!internalStore[type]) internalStore[type] = {};
                internalStore[type][id] = data; // Store or overwrite data
                // console.log(`MockRegistry STORE: ${type} / ${id}`, data); // Debug log
            }),
            get: jest.fn((type, id) => {
                // Handle manifest lookups first (WorldLoader uses lower-case keys)
                if (type === 'mod_manifests') {
                    if (id === coreModId.toLowerCase()) return mockCoreManifest;
                    if (id === overrideModId.toLowerCase()) return mockOverrideManifest;
                }
                // Handle regular data lookups from the internal store
                const result = internalStore[type]?.[id];
                // console.log(`MockRegistry GET: ${type} / ${id}`, result); // Debug log
                return result;
            }),
            getAll: jest.fn((type) => {
                const items = Object.values(internalStore[type] || {});
                // console.log(`MockRegistry GETALL: ${type}`, items); // Debug log
                return items; // Return the array of items for the given type
            }),
            clear: jest.fn(() => {
                // Clear the internal store
                Object.keys(internalStore).forEach(key => delete internalStore[key]);
                // console.log(`MockRegistry CLEARED`); // Debug log
            }),
            // Add other methods with basic mocks if they might be called
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
            error: jest.fn(),
        };
        mockSchemaLoader = {
            loadAndCompileAllSchemas: jest.fn(),
        };
        mockValidator = {
            isSchemaLoaded: jest.fn(),
            addSchema: jest.fn(),
            removeSchema: jest.fn(),
            getValidator: jest.fn(),
            validate: jest.fn(),
        };
        mockConfiguration = {
            getContentTypeSchemaId: jest.fn(),
            getBaseDataPath: jest.fn(() => './data'),
            getSchemaFiles: jest.fn(() => []),
            getSchemaBasePath: jest.fn(() => 'schemas'),
            getContentBasePath: jest.fn(() => 'content'),
            getWorldBasePath: jest.fn(() => 'worlds'),
            getGameConfigFilename: jest.fn(() => 'game.json'),
            getModsBasePath: jest.fn(() => 'mods'),
            getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
        };
        mockGameConfigLoader = {
            loadConfig: jest.fn(),
        };
        mockModManifestLoader = {
            loadRequestedManifests: jest.fn(),
        };

        // Mock individual content loaders
        mockActionLoader = { loadItemsForMod: jest.fn() };
        mockComponentLoader = { loadItemsForMod: jest.fn() };
        mockEventLoader = { loadItemsForMod: jest.fn() };
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Mock Data ---
        mockCoreManifest = {
            id: coreModId,
            version: '1.0.0',
            name: 'Core Systems',
            gameVersion: '^1.0.0',
            content: {
                // Core defines one action
                actions: ['core/action1.json'],
            },
        };
        mockOverrideManifest = {
            id: overrideModId,
            version: '1.0.0',
            name: 'Override Mod',
            gameVersion: '^1.0.0',
            dependencies: { // Good practice to include dependency
                [coreModId]: '^1.0.0'
            },
            content: {
                // OverrideMod overrides core's action AND adds a new one
                actions: ['core/action1.json', 'override/action2.json'],
                // OverrideMod also adds a component (not defined in core)
                components: ['override/component1.json'],
            },
        };

        mockManifestMap = new Map();
        // Store with original case keys as returned by ModManifestLoader
        mockManifestMap.set(coreModId, mockCoreManifest);
        mockManifestMap.set(overrideModId, mockOverrideManifest);


        // --- 3. Configure Mocks (Default Success Paths) ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Configure IConfiguration to return IDs for essential schemas
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
            switch (typeName) {
                case 'game': return 'schema:game';
                case 'components': return 'schema:components';
                case 'mod-manifest': return 'schema:mod-manifest';
                case 'entities': return 'schema:entities'; // Example, add others if needed
                default: return `schema:${typeName}`;
            }
        });

        // Configure ISchemaValidator for essential schemas
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
        });

        // Configure GameConfigLoader - Request both mods
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, overrideModId]);

        // Configure ModManifestLoader - Return both manifests
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);

        // Configure ModDependencyValidator (static mock)
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });

        // Configure validateModEngineVersions (mocked import)
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });

        // Configure resolveOrder (mocked import) - CRITICAL: Define the load order
        // WorldLoader passes lower-case keys map, resolver returns original case IDs
        mockedResolveOrder.mockReturnValue([coreModId, overrideModId]);

        // --- Configure Content Loader Mocks ---

        // Configure ActionLoader:
        // It needs to simulate storing different data based on which mod is calling
        // and return the number of *files listed in the manifest* for that type.
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'actions') return 0; // Only handle actions

            if (modIdArg === coreModId) {
                // Simulate core loading its action
                const itemId = `${coreModId}:action1`;
                const itemData = { value: 'core_value' }; // Core version
                mockRegistry.store('actions', itemId, itemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${itemId} for ${modIdArg}`, itemData);
                return 1; // core manifest lists 1 action file
            } else if (modIdArg === overrideModId) {
                // Simulate overrideMod loading its actions
                // 1. Override core:action1
                const overrideItemId = `${coreModId}:action1`; // NOTE: Use CORE's ID for override
                const overrideItemData = { value: 'override_value' }; // Override version
                mockRegistry.store('actions', overrideItemId, overrideItemData);
                mockLogger.debug(`Mock ActionLoader: Stored override for ${overrideItemId} by ${modIdArg}`, overrideItemData);

                // 2. Add new action overrideMod:action2
                const newItemId = `${overrideModId}:action2`;
                const newItemData = { value: 'new_value' }; // New item data
                mockRegistry.store('actions', newItemId, newItemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${newItemId} for ${modIdArg}`, newItemData);

                return 2; // overrideMod manifest lists 2 action files
            }
            return 0; // Should not happen in this test
        });

        // Configure ComponentLoader:
        // Only overrideMod defines components
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'components') return 0; // Only handle components

            if (modIdArg === overrideModId) {
                // Simulate overrideMod loading its component
                const itemId = `${overrideModId}:component1`;
                const itemData = { value: 'comp_value' };
                mockRegistry.store('components', itemId, itemData);
                mockLogger.debug(`Mock ComponentLoader: Stored ${itemId} for ${modIdArg}`, itemData);
                return 1; // overrideMod manifest lists 1 component file
            }
            return 0; // Core mod doesn't define components
        });

        // Other loaders are mocked but won't be called based on manifests
        mockEventLoader.loadItemsForMod.mockResolvedValue(0);
        mockRuleLoader.loadItemsForMod.mockResolvedValue(0);
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

    // ── Test Case: Load with Overrides ─────────────────────────────────────
    it('should load core and override mod, applying overrides correctly', async () => {
        // --- Action ---
        await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

        // --- Assertions ---

        // Verify loadWorld resolves successfully (covered by expect(...).resolves)

        // Verify registry.store was called to store meta.final_mod_order
        expect(mockRegistry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [coreModId, overrideModId]);

        // Verify ModManifestLoader called correctly
        expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith([coreModId, overrideModId]);

        // Verify resolveOrder was called correctly
        const expectedValidationMap = new Map();
        expectedValidationMap.set(coreModId.toLowerCase(), mockCoreManifest);
        expectedValidationMap.set(overrideModId.toLowerCase(), mockOverrideManifest);
        expect(mockedResolveOrder).toHaveBeenCalledWith([coreModId, overrideModId], expectedValidationMap, mockLogger);


        // Verify ActionLoader.loadItemsForMod was called for both mods
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(2);
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
            coreModId, // Mod ID
            mockCoreManifest, // Correct Manifest
            'actions', 'actions', 'actions' // Correct params
        );
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
            overrideModId, // Mod ID
            mockOverrideManifest, // Correct Manifest
            'actions', 'actions', 'actions' // Correct params
        );

        // Verify ComponentLoader.loadItemsForMod was called ONLY for overrideMod
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(
            overrideModId, // Mod ID
            mockOverrideManifest, // Correct Manifest
            'components', 'components', 'components' // Correct params
        );

        // Verify other loaders (Event, Rule, Entity) were NOT called
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalled();


        // Verify the final state of the registry for the OVERRIDDEN item
        // Use the mockRegistry's internal store via its mocked 'get' method
        const overriddenAction = mockRegistry.get('actions', 'core:action1');
        expect(overriddenAction).toBeDefined();
        expect(overriddenAction).toEqual({ value: 'override_value' }); // Should have the override value
        expect(overriddenAction?.value).not.toBe('core_value');


        // Verify the final state of the registry for the NEW item from overrideMod
        const newAction = mockRegistry.get('actions', 'overrideMod:action2');
        expect(newAction).toBeDefined();
        expect(newAction).toEqual({ value: 'new_value' });

        // Verify the final state of the registry for the NEW component from overrideMod
        const newComponent = mockRegistry.get('components', 'overrideMod:component1');
        expect(newComponent).toBeDefined();
        expect(newComponent).toEqual({ value: 'comp_value' });

        // Verify the summary log reports the correct *total* loaded item counts
        // The counts are the SUM of what each loader returned for each type
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);

        expect(summaryLines).toEqual(expect.arrayContaining([
            expect.stringContaining(`WorldLoader Load Summary (World: '${worldName}')`),
            expect.stringContaining(`Requested Mods (raw): [${coreModId}, ${overrideModId}]`),
            expect.stringContaining(`Final Load Order    : [${coreModId}, ${overrideModId}]`),
            expect.stringContaining(`Content Loading Summary:`),
            // Counts based on return values of mockLoaders.loadItemsForMod
            // actions: 1 (from core) + 2 (from override) -> REGISTRY has 2 unique items BUT summary logs SUM of returned counts
            // Let's adjust expected sum: core returned 1, override returned 2 => total 3?
            // Re-check mock: core returns 1, override returns 2. Yes, sum is 3.
            // Re-check WorldLoader code: `totalCounts[config.typeName] = (totalCounts[config.typeName] || 0) + count;` - It sums the return values.
            // Okay, let's re-evaluate the mock return values vs manifest content.
            // core manifest lists 1 action -> mock returns 1.
            // override manifest lists 2 actions -> mock returns 2.
            // override manifest lists 1 component -> mock returns 1.
            // Total actions count logged = 1 + 2 = 3.
            // Total components count logged = 0 + 1 = 1.
            expect.stringMatching(/actions\s+: 3 loaded/),      // 1 from core + 2 from overrideMod manifest list
            expect.stringMatching(/components\s+: 1 loaded/),   // 0 from core + 1 from overrideMod manifest list
            expect.stringContaining('———————————————————————————————————————————')
        ]));

        // Ensure types not loaded aren't in the summary counts
        expect(summaryLines.some(line => /events\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /rules\s+:/.test(line))).toBe(false);
        expect(summaryLines.some(line => /entities\s+:/.test(line))).toBe(false);

        // Verify registry.clear was called only once at the beginning
        expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
    });
});