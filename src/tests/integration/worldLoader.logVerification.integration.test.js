// Filename: test/integration/worldLoader.logVerification.integration.test.js

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


describe('WorldLoader Integration Test Suite - Log Verification (TEST-LOADER-7.7)', () => {
    /** @type {WorldLoader} */
    let worldLoader;

    // --- Mock Instances ---
    /** @type {jest.Mocked<IDataRegistry>} */
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
    let coreManifest;
    /** @type {ModManifest} */
    let overrideManifest;
    /** @type {ModManifest} */
    let modAManifest;
    /** @type {ModManifest} */
    let modBManifest;
    /** @type {Map<string, ModManifest>} */
    let mockManifestMap;
    const coreModId = 'core';
    const overrideModId = 'overrideMod';
    const modAId = 'modA';
    const modBId = 'modB';
    const worldName = 'testWorldLogVerify';

    // --- Mocked Functions (from imports) ---
    const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
    const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
    const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

    // Helper function for mocks that should return 0
    const defaultReturnZero = async () => 0;

    beforeEach(() => {
        jest.clearAllMocks(); // Reset mocks between tests

        // --- 1. Create Mocks ---
        mockRegistry = {
            store: jest.fn(),
            get: jest.fn(), // Needs careful configuration per test
            getAll: jest.fn(() => []), // Default to empty array
            clear: jest.fn(),
            // Add other methods with basic mocks
            getAllSystemRules: jest.fn(() => []), getManifest: jest.fn(() => null), setManifest: jest.fn(), getEntityDefinition: jest.fn(),
            getItemDefinition: jest.fn(), getLocationDefinition: jest.fn(), getConnectionDefinition: jest.fn(), getBlockerDefinition: jest.fn(),
            getActionDefinition: jest.fn(), getEventDefinition: jest.fn(), getComponentDefinition: jest.fn(), getAllEntityDefinitions: jest.fn(() => []),
            getAllItemDefinitions: jest.fn(() => []), getAllLocationDefinitions: jest.fn(() => []), getAllConnectionDefinitions: jest.fn(() => []),
            getAllBlockerDefinitions: jest.fn(() => []), getAllActionDefinitions: jest.fn(() => []), getAllEventDefinitions: jest.fn(() => []),
            getAllComponentDefinitions: jest.fn(() => []), getStartingPlayerId: jest.fn(() => null), getStartingLocationId: jest.fn(() => null),
        };
        mockLogger = {
            // Spy on info, mock others
            info: jest.fn(),
            debug: jest.fn(),
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

        // Mock individual content loaders - *** REMOVE default mockResolvedValue ***
        mockActionLoader = { loadItemsForMod: jest.fn() };
        mockComponentLoader = { loadItemsForMod: jest.fn() };
        mockEventLoader = { loadItemsForMod: jest.fn() };
        mockRuleLoader = { loadItemsForMod: jest.fn() };
        mockEntityLoader = { loadItemsForMod: jest.fn() };

        // --- 2. Define Base Mock Data (can be overridden in tests) ---
        coreManifest = { id: coreModId, version: '1.0.0', name: 'Core', gameVersion: '1.0.0', content: {} };
        overrideManifest = { id: overrideModId, version: '1.0.0', name: 'Override', gameVersion: '1.0.0', content: {} };
        modAManifest = { id: modAId, version: '1.0.0', name: 'Mod A', gameVersion: '1.0.0', content: {} };
        modBManifest = { id: modBId, version: '1.0.0', name: 'Mod B', gameVersion: '1.0.0', content: {} };
        mockManifestMap = new Map();

        // --- 3. Configure Mocks (Default Success Paths) ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            // Assume essential schemas are loaded
            return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
        });

        // Default mocks for validation/resolution - configure per test
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });
        mockedResolveOrder.mockReturnValue([]); // Configure per test

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

    // ── Test Case: Basic 'Core' Load Summary (like 7.1) ────────────────────
    it('should log the correct summary for a basic \'core\' mod load', async () => {
        // Setup: Core mod defines 2 actions, 1 component, 3 rules.
        const coreActionCount = 2;
        const coreComponentCount = 1;
        const coreRuleCount = 3;
        coreManifest.content = {
            actions: Array(coreActionCount).fill('dummy.json'),
            components: Array(coreComponentCount).fill('dummy.json'),
            rules: Array(coreRuleCount).fill('dummy.json'),
        };
        mockManifestMap.set(coreModId, coreManifest);

        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        mockedResolveOrder.mockReturnValue([coreModId]);

        // Configure registry.get to return the manifest
        mockRegistry.get.mockImplementation((type, id) => {
            if (type === 'mod_manifests' && id === coreModId.toLowerCase()) return coreManifest;
            return undefined;
        });

        // *** Configure ALL content loaders explicitly for this test ***
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'actions') ? coreActionCount : 0
        );
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'components') ? coreComponentCount : 0
        );
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'rules') ? coreRuleCount : 0
        );
        // Explicitly set others to return 0 for this test case
        mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
        mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero); // Covers blockers, connections, entities, items, locations

        // Action
        await worldLoader.loadWorld(worldName);

        // Assertions
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);
        // console.log("Test 1 Log Calls:", JSON.stringify(infoCalls, null, 2)); // <<< DEBUGGING LINE

        // Find specific lines within the summary block
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary:`);

        // Check for specific counts and alphabetical order
        // ---- VVV CHANGE VVV ----
        const actionLine = summaryLines.find(line => line.trim().startsWith('- actions'));
        const componentLine = summaryLines.find(line => line.trim().startsWith('- components'));
        const ruleLine = summaryLines.find(line => line.trim().startsWith('- rules'));
        // ---- ^^^ CHANGE ^^^ ----

        expect(actionLine).toBeDefined();    // Line 237 (original failure point)
        expect(componentLine).toBeDefined();
        expect(ruleLine).toBeDefined();

        expect(actionLine).toMatch(/actions\s+: 2 loaded/);
        expect(componentLine).toMatch(/components\s+: 1 loaded/);
        expect(ruleLine).toMatch(/rules\s+: 3 loaded/);

        // Verify alphabetical sorting (actions, components, rules)
        const countLines = summaryLines.filter(line => line.trim().startsWith('-'));
        expect(countLines).toHaveLength(3);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');
        expect(countLines[2]).toContain('rules');

        // Verify other types are not present
        expect(summaryBlock).not.toMatch(/events\s+:/);
        expect(summaryBlock).not.toMatch(/entities\s+:/); // Check one specific entity type

        expect(summaryLines[summaryLines.length - 1]).toContain('———————————————————————————————————————————');
    });

    // ── Test Case: Summary with Overrides (like 7.2) ───────────────────────
    it('should log the correct summary reflecting overrides and multiple mods', async () => {
        // Setup: Core (1 action), OverrideMod (2 actions, 1 component)
        const coreActionCount = 1;
        const overrideActionCount = 2;
        const overrideComponentCount = 1;
        coreManifest.content = { actions: Array(coreActionCount).fill('dummy.json') };
        overrideManifest.content = {
            actions: Array(overrideActionCount).fill('dummy.json'),
            components: Array(overrideComponentCount).fill('dummy.json'),
        };
        mockManifestMap.set(coreModId, coreManifest);
        mockManifestMap.set(overrideModId, overrideManifest);

        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, overrideModId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        mockedResolveOrder.mockReturnValue([coreModId, overrideModId]);

        // Configure registry.get to return manifests
        mockRegistry.get.mockImplementation((type, id) => {
            if (type === 'mod_manifests') {
                if (id === coreModId.toLowerCase()) return coreManifest;
                if (id === overrideModId.toLowerCase()) return overrideManifest;
            }
            return undefined;
        });

        // *** Configure ALL content loaders explicitly for this test ***
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'actions') return 0;
            if (modIdArg === coreModId) return coreActionCount;
            if (modIdArg === overrideModId) return overrideActionCount;
            return 0;
        });
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'components') return 0;
            if (modIdArg === overrideModId) return overrideComponentCount;
            // Note: coreMod doesn't list components, so WorldLoader won't call this for coreMod + components
            return 0;
        });
        // Explicitly set others to return 0
        mockRuleLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
        mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
        mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero);

        // Action
        await worldLoader.loadWorld(worldName);

        // Assertions
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1);

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);
        // console.log("Test 2 Log Calls:", JSON.stringify(infoCalls, null, 2)); // <<< DEBUGGING LINE
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}, ${overrideModId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}, ${overrideModId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary:`);

        // Check aggregated counts and alphabetical order
        // ---- VVV CHANGE VVV ----
        const actionLine = summaryLines.find(line => line.trim().startsWith('- actions'));
        const componentLine = summaryLines.find(line => line.trim().startsWith('- components'));
        // ---- ^^^ CHANGE ^^^ ----

        expect(actionLine).toBeDefined();    // Line 324 (original failure point)
        expect(componentLine).toBeDefined();

        // Total count = sum of returned counts from loaders
        const expectedTotalActions = coreActionCount + overrideActionCount; // 1 + 2 = 3
        const expectedTotalComponents = overrideComponentCount; // 0 + 1 = 1

        expect(actionLine).toMatch(new RegExp(`actions\\s+: ${expectedTotalActions} loaded`));
        expect(componentLine).toMatch(new RegExp(`components\\s+: ${expectedTotalComponents} loaded`));

        // Verify alphabetical sorting (actions, components)
        const countLines = summaryLines.filter(line => line.trim().startsWith('-'));
        expect(countLines).toHaveLength(2);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');

        // Verify other types are not present
        expect(summaryBlock).not.toMatch(/rules\s+:/);
        expect(summaryBlock).not.toMatch(/events\s+:/);

        expect(summaryLines[summaryLines.length - 1]).toContain('———————————————————————————————————————————');
    });

    // ── Test Case: Summary with Partial/Empty Content (like 7.3) ───────────
    it('should log the correct summary when some content types are empty or missing', async () => {
        // Setup: Core (1 component), ModA (1 action, events: []), ModB (1 rule, no events key)
        const coreCompCount = 1;
        const modAActionCount = 1;
        const modBRuleCount = 1;
        coreManifest.content = { components: Array(coreCompCount).fill('dummy.json') };
        modAManifest.content = {
            actions: Array(modAActionCount).fill('dummy.json'),
            events: [], // Empty list
        };
        modBManifest.content = {
            rules: Array(modBRuleCount).fill('dummy.json'),
            // 'events' key missing entirely
        };
        mockManifestMap.set(coreModId, coreManifest);
        mockManifestMap.set(modAId, modAManifest);
        mockManifestMap.set(modBId, modBManifest);

        mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId, modAId, modBId]);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
        mockedResolveOrder.mockReturnValue([coreModId, modAId, modBId]);

        // Configure registry.get to return manifests
        mockRegistry.get.mockImplementation((type, id) => {
            if (type === 'mod_manifests') {
                if (id === coreModId.toLowerCase()) return coreManifest;
                if (id === modAId.toLowerCase()) return modAManifest;
                if (id === modBId.toLowerCase()) return modBManifest;
            }
            return undefined;
        });

        // *** Configure ALL content loaders explicitly for this test ***
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'components') ? coreCompCount : 0
        );
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === modAId && typeNameArg === 'actions') ? modAActionCount : 0
        );
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === modBId && typeNameArg === 'rules') ? modBRuleCount : 0
        );
        // Explicitly set others to return 0
        mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero); // Will be skipped by WorldLoader logic anyway
        mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero);

        // Action
        await worldLoader.loadWorld(worldName);

        // Assertions
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1);

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);
        // console.log("Test 3 Log Calls:", JSON.stringify(infoCalls, null, 2)); // <<< DEBUGGING LINE
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}, ${modAId}, ${modBId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}, ${modAId}, ${modBId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary:`);

        // Check counts ONLY for loaded types (actions, components, rules)
        // ---- VVV CHANGE VVV ----
        const actionLine = summaryLines.find(line => line.trim().startsWith('- actions'));
        const componentLine = summaryLines.find(line => line.trim().startsWith('- components'));
        const ruleLine = summaryLines.find(line => line.trim().startsWith('- rules'));
        // ---- ^^^ CHANGE ^^^ ----

        expect(actionLine).toBeDefined();    // Line 415 (original failure point)
        expect(componentLine).toBeDefined();
        expect(ruleLine).toBeDefined();

        expect(actionLine).toMatch(/actions\s+: 1 loaded/);
        expect(componentLine).toMatch(/components\s+: 1 loaded/);
        expect(ruleLine).toMatch(/rules\s+: 1 loaded/);

        // Verify alphabetical sorting (actions, components, rules)
        const countLines = summaryLines.filter(line => line.trim().startsWith('-'));
        expect(countLines).toHaveLength(3);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');
        expect(countLines[2]).toContain('rules');

        // Verify 'events' and other unloaded types are NOT present in the counts
        expect(summaryBlock).not.toMatch(/events\s+:/);
        expect(summaryBlock).not.toMatch(/entities\s+:/);
        expect(summaryBlock).not.toMatch(/blockers\s+:/);

        expect(summaryLines[summaryLines.length - 1]).toContain('———————————————————————————————————————————');

        // Optional: Check debug logs for skipping events
        // Note: The actual debug log checks if manifest.content[config.contentKey] exists and has length > 0
        // For ModA, events exists but is empty (length 0)
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modAId}]: No 'events' listed in manifest. Skipping loading for type 'events'.`) // Corrected expected message
        );
        // For ModB, events key doesn't exist
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modBId}]: No 'events' listed in manifest. Skipping loading for type 'events'.`) // Corrected expected message
        );
    });

});