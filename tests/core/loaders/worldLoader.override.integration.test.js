// Filename: src/tests/core/loaders/worldLoader.override.integration.test.js

import {beforeEach, describe, expect, it, jest} from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../../src/loaders/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader if they are used at module level or constructor indirectly
import * as ModDependencyValidatorModule from '../../../src/modding/modDependencyValidator.js';

jest.mock('../../../src/modding/modDependencyValidator.js', () => ({
    validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../../src/modding/modVersionValidator.js';

jest.mock('../../../src/modding/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../../src/modding/modLoadOrderResolver.js';

jest.mock('../../../src/modding/modLoadOrderResolver.js', () => ({
    resolveOrder: jest.fn(),
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../../src/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../../src/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../../src/loaders/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../core/interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Added for the new dependency


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
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */ // Added mock type for the new dependency
    let mockValidatedEventDispatcher;

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
                    const lowerId = id.toLowerCase(); // Ensure lookup is case-insensitive
                    if (lowerId === coreModId.toLowerCase()) return mockCoreManifest;
                    if (lowerId === overrideModId.toLowerCase()) return mockOverrideManifest;
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
            getManifest: jest.fn((id) => { // Simulate case-insensitive manifest retrieval
                if (id.toLowerCase() === coreModId.toLowerCase()) return mockCoreManifest;
                if (id.toLowerCase() === overrideModId.toLowerCase()) return mockOverrideManifest;
                return null;
            }),
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
        mockActionLoader = {loadItemsForMod: jest.fn()};
        mockComponentLoader = {loadItemsForMod: jest.fn()};
        mockEventLoader = {loadItemsForMod: jest.fn()};
        mockRuleLoader = {loadItemsForMod: jest.fn()};
        mockEntityLoader = {loadItemsForMod: jest.fn()};

        // --- Added mock for ValidatedEventDispatcher ---
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Mock the method used by WorldLoader
        };

        // --- 2. Define Mock Data ---
        mockCoreManifest = {
            id: coreModId,
            version: '1.0.0',
            name: 'Core Systems',
            gameVersion: '^1.0.0',
            content: {
                // Core defines one action
                actions: ['core/action1.json'],
                // NO events, rules, entities etc. defined here
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
                // NO events, rules, entities etc. defined here
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
            // This implementation should match what WorldLoader expects for its essential checks
            switch (typeName) {
                case 'game':
                    return 'schema:game';
                case 'components':
                    return 'schema:components';
                case 'mod-manifest':
                    return 'schema:mod-manifest';
                case 'entities':
                    return 'schema:entities';
                case 'actions':
                    return 'schema:actions';
                case 'events':
                    return 'schema:events';
                case 'rules':
                    return 'schema:rules';
                default:
                    return `schema:${typeName}`; // Default fallback
            }
        });

        // Configure ISchemaValidator for ALL essential schemas checked by WorldLoader
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            const essentialSchemas = [
                'schema:game',
                'schema:components',
                'schema:mod-manifest',
                'schema:entities',
                'schema:actions',
                'schema:events',
                'schema:rules'
            ];
            return essentialSchemas.includes(schemaId);
        });

        // Configure GameConfigLoader - Request both mods
        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, overrideModId]);

        // Configure ModManifestLoader - Return both manifests
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);

        // Configure ModDependencyValidator (static mock)
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */
        });

        // Configure validateModEngineVersions (mocked import)
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */
        });

        // Configure resolveOrder (mocked import) - CRITICAL: Define the load order
        // WorldLoader passes lower-case keys map, resolver returns original case IDs
        mockedResolveOrder.mockReturnValue([coreModId, overrideModId]);

        // --- Configure Content Loader Mocks ---

        // Configure ActionLoader:
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            // This *SHOULD* be called because 'actions' exists in manifests
            if (typeNameArg !== 'actions') return {count: 0, overrides: 0, errors: 0};

            let count = 0;
            let overrides = 0;

            if (modIdArg === coreModId) {
                const itemId = `${coreModId}:action1`;
                const itemData = {value: 'core_value'};
                mockRegistry.store('actions', itemId, itemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${itemId} for ${modIdArg}`, itemData);
                count = 1; // Assumes 1 file maps to 1 item for simplicity in mock
            } else if (modIdArg === overrideModId) {
                const overrideItemId = `${coreModId}:action1`;
                const overrideItemData = {value: 'override_value'};
                if (mockRegistry.get('actions', overrideItemId)) {
                    overrides++;
                }
                mockRegistry.store('actions', overrideItemId, overrideItemData);
                mockLogger.debug(`Mock ActionLoader: Stored override for ${overrideItemId} by ${modIdArg}`, overrideItemData);

                const newItemId = `${overrideModId}:action2`;
                const newItemData = {value: 'new_value'};
                mockRegistry.store('actions', newItemId, newItemData);
                mockLogger.debug(`Mock ActionLoader: Stored ${newItemId} for ${modIdArg}`, newItemData);

                // Count based on number of successful operations if mock were more complex,
                // here simplified to match number of files listed in manifest.
                count = 2;
            }
            return {count, overrides, errors: 0};
        });

        // Configure ComponentLoader:
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            // This *SHOULD* be called for overrideMod because 'components' exists in its manifest
            if (typeNameArg !== 'components') return {count: 0, overrides: 0, errors: 0};

            let count = 0;
            let overrides = 0;

            if (modIdArg === overrideModId) {
                const itemId = `${overrideModId}:component1`;
                const itemData = {value: 'comp_value'};
                mockRegistry.store('components', itemId, itemData);
                mockLogger.debug(`Mock ComponentLoader: Stored ${itemId} for ${modIdArg}`, itemData);
                count = 1; // Assumes 1 file maps to 1 item
            }
            // It will be called for coreMod too, but the manifest check inside WorldLoader prevents it
            // unless coreMod's manifest ALSO had components listed. Since it doesn't,
            // the internal logic of this mock won't run for coreMod.
            return {count, overrides, errors: 0};
        });

        // Other loaders: Mock to return default structure, but expect them NOT to be called
        // with specific content processing logic *if* the manifests don't list their content types.
        // WorldLoader's internal `hasContent` check prevents the call.
        mockEventLoader.loadItemsForMod.mockResolvedValue({count: 0, overrides: 0, errors: 0});
        mockRuleLoader.loadItemsForMod.mockResolvedValue({count: 0, overrides: 0, errors: 0});
        mockEntityLoader.loadItemsForMod.mockResolvedValue({count: 0, overrides: 0, errors: 0});


        // --- 4. Instantiate SUT ---
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
            validatedEventDispatcher: mockValidatedEventDispatcher
        });
    });

    // ── Test Case: Load with Overrides ─────────────────────────────────────
    it('should load core and override mod, applying overrides correctly', async () => {
        // --- Action ---
        await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

        // --- Assertions ---

        // Verify registry.store was called to store meta.final_mod_order
        expect(mockRegistry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [coreModId, overrideModId]);

        // Verify ModManifestLoader called correctly
        expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith([coreModId, overrideModId]);

        // Verify resolveOrder was called correctly
        const expectedValidationMap = new Map();
        expectedValidationMap.set(coreModId.toLowerCase(), mockCoreManifest);
        expectedValidationMap.set(overrideModId.toLowerCase(), mockOverrideManifest);
        expect(mockedResolveOrder).toHaveBeenCalledWith([coreModId, overrideModId], expectedValidationMap, mockLogger);


        // --- Assert Loader Calls ---

        // ActionLoader: Called for core (1 action listed) and overrideMod (2 actions listed)
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(2);
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(coreModId, mockCoreManifest, 'actions', 'actions', 'actions');
        expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(overrideModId, mockOverrideManifest, 'actions', 'actions', 'actions');

        // ComponentLoader: Called ONLY for overrideMod (1 component listed)
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
        // Verify it was called with overrideMod's details
        expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(overrideModId, mockOverrideManifest, 'components', 'components', 'components');
        // Verify it was NOT called trying to process 'components' for coreMod (since core manifest doesn't list them)
        expect(mockComponentLoader.loadItemsForMod).not.toHaveBeenCalledWith(coreModId, mockCoreManifest, 'components', 'components', 'components');

        // EventLoader: SHOULD NOT be called because NEITHER manifest lists 'events'
        expect(mockEventLoader.loadItemsForMod).toHaveBeenCalledTimes(0);
        // These subsequent checks are now redundant if calledTimes is 0, but harmless
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(coreModId, mockCoreManifest, 'events', 'events', 'events');
        expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalledWith(overrideModId, mockOverrideManifest, 'events', 'events', 'events');

        // RuleLoader: SHOULD NOT be called because NEITHER manifest lists 'rules'
        expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledTimes(0);
        // Redundant but harmless checks:
        expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalledWith(coreModId, mockCoreManifest, 'rules', 'rules', 'rules');
        expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalledWith(overrideModId, mockOverrideManifest, 'rules', 'rules', 'rules');

        // EntityLoader: SHOULD NOT be called because NEITHER manifest lists any entity types
        expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(0);
        // Spot check one type (redundant but harmless):
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(coreModId, mockCoreManifest, 'items', 'items', 'items');
        expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(overrideModId, mockOverrideManifest, 'items', 'items', 'items');
        // --- End Loader Call Assertions ---


        // --- Assert Registry State ---
        const overriddenAction = mockRegistry.get('actions', 'core:action1');
        expect(overriddenAction).toBeDefined();
        expect(overriddenAction).toEqual({value: 'override_value'});
        expect(overriddenAction?.value).not.toBe('core_value');

        const newAction = mockRegistry.get('actions', 'overrideMod:action2');
        expect(newAction).toBeDefined();
        expect(newAction).toEqual({value: 'new_value'});

        const newComponent = mockRegistry.get('components', 'overrideMod:component1');
        expect(newComponent).toBeDefined();
        expect(newComponent).toEqual({value: 'comp_value'});
        // --- End Registry State Assertions ---


        // --- Assert Summary Logging ---
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStartIndex = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStartIndex).toBeGreaterThan(-1);

        const summaryLines = infoCalls.slice(summaryStartIndex).map(call => call[0]);

        // Basic structure - Match the exact formatting from WorldLoader's #logLoadSummary
        expect(summaryLines).toEqual(expect.arrayContaining([
            // Use stringContaining to be slightly flexible, but include formatting elements
            expect.stringContaining(`— WorldLoader Load Summary (World: '${worldName}') —`),
            expect.stringContaining(`• Requested Mods (raw): [${coreModId}, ${overrideModId}]`), // Added bullet, space, brackets
            expect.stringContaining(`• Final Load Order    : [${coreModId}, ${overrideModId}]`), // Added bullet, space, brackets
            expect.stringContaining(`• Content Loading Summary (Totals):`), // Added bullet, space
            expect.stringContaining('———————————————————————————————————————————') // Separator line
        ]));

        // Specific counts based on mock return values - Use regex for flexibility with padding
        // Actions: C:3, O:1, E:0
        expect(summaryLines.some(line => /actions\s+: C:3, O:1, E:0/.test(line))).toBe(true);
        // Components: C:1, O:0, E:0
        expect(summaryLines.some(line => /components\s+: C:1, O:0, E:0/.test(line))).toBe(true);

        // Grand totals: C:4, O:1, E:0 - Use regex for flexibility with padding
        expect(summaryLines.some(line => /TOTAL\s+: C:4, O:1, E:0/.test(line))).toBe(true);

        // Ensure types NOT processed aren't in summary counts > 0 (regex allows for C:0)
        expect(summaryLines.some(line => /events\s+: C:[1-9]/.test(line))).toBe(false);
        expect(summaryLines.some(line => /rules\s+: C:[1-9]/.test(line))).toBe(false);
        expect(summaryLines.some(line => /items\s+: C:[1-9]/.test(line))).toBe(false);
        // --- End Summary Logging Assertions ---


        // Verify registry.clear was called only once at the beginning
        expect(mockRegistry.clear).toHaveBeenCalledTimes(1);

        // --- End Event Dispatching Assertions ---
    });
});