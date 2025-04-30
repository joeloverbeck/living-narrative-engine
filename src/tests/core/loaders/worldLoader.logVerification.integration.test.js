// Filename: src/tests/core/loaders/worldLoader.logVerification.integration.test.js

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
/** @typedef {import('../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */


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
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;

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
    // Updated to return the expected structure with 0 counts
    const defaultReturnZero = async () => ({ count: 0, overrides: 0, errors: 0 });

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
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined) // Mock the method used
        };

        // Mock individual content loaders - Ensure they return the expected { count, overrides, errors } structure
        mockActionLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) };
        mockComponentLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) };
        mockEventLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) };
        mockRuleLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) };
        mockEntityLoader = { loadItemsForMod: jest.fn().mockResolvedValue({ count: 0, overrides: 0, errors: 0 }) };

        // --- 2. Define Base Mock Data (can be overridden in tests) ---
        coreManifest = { id: coreModId, version: '1.0.0', name: 'Core', gameVersion: '1.0.0', content: {} };
        overrideManifest = { id: overrideModId, version: '1.0.0', name: 'Override', gameVersion: '1.0.0', content: {} };
        modAManifest = { id: modAId, version: '1.0.0', name: 'Mod A', gameVersion: '1.0.0', content: {} };
        modBManifest = { id: modBId, version: '1.0.0', name: 'Mod B', gameVersion: '1.0.0', content: {} };
        mockManifestMap = new Map();

        // --- 3. Configure Mocks (Default Success Paths) ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => `schema:${typeName}`);

        // Assume ALL essential schemas checked by WorldLoader are loaded for these tests
        mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
            return [
                'schema:game',
                'schema:components',
                'schema:mod-manifest',
                'schema:entities',
                'schema:actions', // Essential schema
                'schema:events',  // Essential schema
                'schema:rules'    // Essential schema
            ].includes(schemaId);
        });

        // Default mocks for validation/resolution - configure per test
        mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });
        mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });
        mockedResolveOrder.mockReturnValue([]); // Configure per test

        // --- 4. Instantiate SUT ---
        // Pass dependencies as a single object
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
            if (type === 'mod_manifests' && id === coreModId.toLowerCase()) {
                return coreManifest;
            }
            return undefined;
        });

        // Configure content loaders to return expected counts for this test
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'actions') ? { count: coreActionCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'components') ? { count: coreComponentCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'rules') ? { count: coreRuleCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        // Explicitly set others to return 0 using the helper
        mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
        mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero); // Covers blockers, connections, entities, items, locations

        // Action
        await worldLoader.loadWorld(worldName);

        // Assertions
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);
        // console.log("Test 1 Log Calls:", JSON.stringify(infoCalls, null, 2)); // DEBUGGING LINE

        // Find specific lines within the summary block
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary (Totals):`);

        // Check for specific counts and alphabetical order
        const actionLine = summaryLines.find(line => line.startsWith('    - actions')); // Check untrimmed line
        const componentLine = summaryLines.find(line => line.startsWith('    - components')); // Check untrimmed line
        const ruleLine = summaryLines.find(line => line.startsWith('    - rules')); // Check untrimmed line

        expect(actionLine).toBeDefined();
        expect(componentLine).toBeDefined();
        expect(ruleLine).toBeDefined();

        expect(actionLine).toMatch(/actions\s+: C:2, O:0, E:0/);
        expect(componentLine).toMatch(/components\s+: C:1, O:0, E:0/);
        expect(ruleLine).toMatch(/rules\s+: C:3, O:0, E:0/);

        // ---- VVV THIS IS THE FIX VVV ----
        // Verify alphabetical sorting (actions, components, rules) - Filter UNTRIMMED lines
        const countLines = summaryLines.filter(line => line.startsWith('    - ') && !line.includes('------') && !line.includes('TOTAL'));
        // ---- ^^^ THIS IS THE FIX ^^^ ----
        expect(countLines).toHaveLength(3);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');
        expect(countLines[2]).toContain('rules');

        // Verify other types are not present
        expect(summaryBlock).not.toMatch(/    - blockers\s+:/);
        expect(summaryBlock).not.toMatch(/    - characters\s+:/);
        expect(summaryBlock).not.toMatch(/    - connections\s+:/);
        expect(summaryBlock).not.toMatch(/    - events\s+:/);
        expect(summaryBlock).not.toMatch(/    - items\s+:/);
        expect(summaryBlock).not.toMatch(/    - locations\s+:/);

        // Check total line
        expect(summaryBlock).toContain('TOTAL'.padEnd(20, ' ') + ': C:6, O:0, E:0');

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

        // Configure ALL content loaders explicitly for this test
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'actions') return { count: 0, overrides: 0, errors: 0 };
            if (modIdArg === coreModId) return { count: coreActionCount, overrides: 0, errors: 0 };
            if (modIdArg === overrideModId) return { count: overrideActionCount, overrides: 0, errors: 0 }; // Assuming override count applies elsewhere or is tracked internally
            return { count: 0, overrides: 0, errors: 0 };
        });
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
            if (typeNameArg !== 'components') return { count: 0, overrides: 0, errors: 0 };
            if (modIdArg === overrideModId) return { count: overrideComponentCount, overrides: 0, errors: 0 }; // Only overrideMod defines components
            return { count: 0, overrides: 0, errors: 0 };
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
        // console.log("Test 2 Log Calls:", JSON.stringify(infoCalls, null, 2)); // DEBUGGING LINE
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}, ${overrideModId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}, ${overrideModId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary (Totals):`);

        // Check aggregated counts and alphabetical order
        const actionLine = summaryLines.find(line => line.startsWith('    - actions')); // Check untrimmed line
        const componentLine = summaryLines.find(line => line.startsWith('    - components')); // Check untrimmed line

        expect(actionLine).toBeDefined();
        expect(componentLine).toBeDefined();

        // Total count = sum of returned counts from loaders FOR THE SPECIFIED TYPE
        const expectedTotalActions = coreActionCount + overrideActionCount; // 1 + 2 = 3
        const expectedTotalComponents = overrideComponentCount; // 0 + 1 = 1

        expect(actionLine).toMatch(new RegExp(`actions\\s+: C:${expectedTotalActions}, O:0, E:0`));
        expect(componentLine).toMatch(new RegExp(`components\\s+: C:${expectedTotalComponents}, O:0, E:0`));

        // ---- VVV THIS IS THE FIX VVV ----
        // Verify alphabetical sorting (actions, components) - Filter UNTRIMMED lines
        const countLines = summaryLines.filter(line => line.startsWith('    - ') && !line.includes('------') && !line.includes('TOTAL'));
        // ---- ^^^ THIS IS THE FIX ^^^ ----
        expect(countLines).toHaveLength(2);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');

        // Verify other types are not present
        expect(summaryBlock).not.toMatch(/    - rules\s+:/);
        expect(summaryBlock).not.toMatch(/    - events\s+:/);

        // Check total line
        const expectedTotalCount = expectedTotalActions + expectedTotalComponents;
        expect(summaryBlock).toContain('TOTAL'.padEnd(20, ' ') + `: C:${expectedTotalCount}, O:0, E:0`);

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

        // Configure ALL content loaders explicitly for this test
        mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === coreModId && typeNameArg === 'components') ? { count: coreCompCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === modAId && typeNameArg === 'actions') ? { count: modAActionCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) =>
            (modIdArg === modBId && typeNameArg === 'rules') ? { count: modBRuleCount, overrides: 0, errors: 0 } : { count: 0, overrides: 0, errors: 0 }
        );
        // Explicitly set others to return 0
        // Event loader won't be called for modA or modB due to WorldLoader's internal check
        mockEventLoader.loadItemsForMod.mockImplementation(defaultReturnZero);
        mockEntityLoader.loadItemsForMod.mockImplementation(defaultReturnZero);

        // Action
        await worldLoader.loadWorld(worldName);

        // Assertions
        const infoCalls = mockLogger.info.mock.calls;
        const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
        expect(summaryStart).toBeGreaterThan(-1);

        const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);
        // console.log("Test 3 Info Calls:", JSON.stringify(mockLogger.info.mock.calls, null, 2)); // DEBUGGING LINE INFO
        // console.log("Test 3 Debug Calls:", JSON.stringify(mockLogger.debug.mock.calls, null, 2)); // DEBUGGING LINE DEBUG
        const summaryBlock = summaryLines.join('\n');

        expect(summaryBlock).toContain(`• Requested Mods (raw): [${coreModId}, ${modAId}, ${modBId}]`);
        expect(summaryBlock).toContain(`• Final Load Order    : [${coreModId}, ${modAId}, ${modBId}]`);
        expect(summaryBlock).toContain(`• Content Loading Summary (Totals):`);

        // Check counts ONLY for loaded types (actions, components, rules)
        const actionLine = summaryLines.find(line => line.startsWith('    - actions')); // Check untrimmed line
        const componentLine = summaryLines.find(line => line.startsWith('    - components')); // Check untrimmed line
        const ruleLine = summaryLines.find(line => line.startsWith('    - rules')); // Check untrimmed line

        expect(actionLine).toBeDefined();
        expect(componentLine).toBeDefined();
        expect(ruleLine).toBeDefined();

        expect(actionLine).toMatch(/actions\s+: C:1, O:0, E:0/);    // Only from modA
        expect(componentLine).toMatch(/components\s+: C:1, O:0, E:0/); // Only from core
        expect(ruleLine).toMatch(/rules\s+: C:1, O:0, E:0/);      // Only from modB

        // ---- VVV THIS IS THE FIX VVV ----
        // Verify alphabetical sorting (actions, components, rules) - Filter UNTRIMMED lines
        const countLines = summaryLines.filter(line => line.startsWith('    - ') && !line.includes('------') && !line.includes('TOTAL'));
        // ---- ^^^ THIS IS THE FIX ^^^ ----
        expect(countLines).toHaveLength(3);
        expect(countLines[0]).toContain('actions');
        expect(countLines[1]).toContain('components');
        expect(countLines[2]).toContain('rules');

        // Verify 'events' and other unloaded types are NOT present in the counts
        expect(summaryBlock).not.toMatch(/    - events\s+:/);
        expect(summaryBlock).not.toMatch(/    - entities\s+:/); // Generic check
        expect(summaryBlock).not.toMatch(/    - blockers\s+:/);
        expect(summaryBlock).not.toMatch(/    - characters\s+:/);
        expect(summaryBlock).not.toMatch(/    - connections\s+:/);
        expect(summaryBlock).not.toMatch(/    - items\s+:/);
        expect(summaryBlock).not.toMatch(/    - locations\s+:/);

        // Check total line
        const expectedTotalCount = coreCompCount + modAActionCount + modBRuleCount; // 1 + 1 + 1 = 3
        expect(summaryBlock).toContain('TOTAL'.padEnd(20, ' ') + `: C:${expectedTotalCount}, O:0, E:0`);

        expect(summaryLines[summaryLines.length - 1]).toContain('———————————————————————————————————————————');

        // Check debug logs for skipping events based on WorldLoader logic
        // WorldLoader checks: if (!manifest.content || !Array.isArray(manifest.content[contentKey]) || manifest.content[contentKey].length === 0)
        // Debug message: `WorldLoader [${modId}]: Skipping content type '${typeName}' (key: '${contentKey}') as it's not defined or empty in the manifest.`

        // For ModA, content.events exists but length is 0
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modAId}]: Skipping content type 'events' (key: 'events')`)
        );
        // For ModB, content.events key doesn't exist
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${modBId}]: Skipping content type 'events' (key: 'events')`)
        );
        // Core mod also doesn't have 'events'
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`WorldLoader [${coreModId}]: Skipping content type 'events' (key: 'events')`)
        );
    });

});