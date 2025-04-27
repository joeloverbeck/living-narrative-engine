// tests/core/services/worldLoader.test.js

// --- JSDoc Imports ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/services/schemaLoader.js').default} SchemaLoader */ // Assuming type
/** @typedef {import('../../../core/services/componentLoader.js').default} ComponentDefinitionLoader */ // Assuming type
/** @typedef {import('../../../core/services/ruleLoader.js').default} RuleLoader */ // Assuming type
/** @typedef {import('../../../core/services/gameConfigLoader.js').default} GameConfigLoader */ // Assuming type
/** @typedef {import('../../../core/services/modManifestLoader.js').default} ModManifestLoader */ // Assuming type

// --- Class Under Test ---
import WorldLoader from '../../../core/services/worldLoader.js';
// --- Jest Imports ---
import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import ModDependencyError from "../../../core/errors/modDependencyError.js";

// ── Mock dependencies ──────────────────────────────────────────────────
/** @type {jest.Mocked<IDataRegistry>} */
const mockRegistry = {
    clear: jest.fn(),
    setManifest: jest.fn(), // Keep mock even if not called in success path now
    getManifest: jest.fn(),
    store: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    // Add other methods if needed by IDataRegistry interface
};

/** @type {jest.Mocked<ILogger>} */
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

/** @type {jest.Mocked<SchemaLoader>} */
const mockSchemaLoader = {
    loadAndCompileAllSchemas: jest.fn(),
};

// NOTE: mockContentLoader is no longer passed to the constructor,
// but keep the mock definition if loadWorld might use it later or if other tests need it.
/** @type {jest.Mocked<any>} */ // Use 'any' or a specific interface if available
const mockContentLoader = {
    loadContentFiles: jest.fn(),
};

/** @type {jest.Mocked<ComponentDefinitionLoader>} */
const mockComponentDefinitionLoader = {
    loadComponentDefinitions: jest.fn(),
};

/** @type {jest.Mocked<RuleLoader> & { _loadedEventCount: number }} */
const mockRuleLoader = {
    loadAll: jest.fn().mockResolvedValue(undefined),
    get loadedEventCount() {
        return mockRuleLoader._loadedEventCount || 0;
    },
    _loadedEventCount: 0,
};

/** @type {jest.Mocked<ISchemaValidator>} */
const mockValidator = {
    isSchemaLoaded: jest.fn(),
    addSchema: jest.fn(),
    getValidator: jest.fn(),
    validate: jest.fn(),
};

/** @type {jest.Mocked<IConfiguration>} */
const mockConfiguration = {
    getContentTypeSchemaId: jest.fn().mockImplementation((type) => {
        if (type === 'game') return essentialSchemaIds.game;
        if (type === 'components') return essentialSchemaIds.components;
        if (type === 'mod-manifest') return essentialSchemaIds.modManifest;
        return essentialSchemaIds[type];
    }),
    getBaseDataPath: jest.fn().mockReturnValue('/fake/data'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getSchemaBasePath: jest.fn().mockReturnValue('/fake/data/schemas'),
    getContentBasePath: jest.fn().mockReturnValue('/fake/data/content'),
    getWorldBasePath: jest.fn().mockReturnValue('/fake/data/worlds'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
};

/** @type {jest.Mocked<GameConfigLoader>} */
const mockGameConfigLoader = {
    loadConfig: jest.fn(),
};

/** @type {jest.Mocked<ModManifestLoader>} */
const mockModManifestLoader = {
    loadRequestedManifests: jest.fn(),
};


// ── Test constants ─────────────────────────────────────────────────────
const testWorldName = 'test-world';
const defaultModList = ['core'];
const essentialSchemaIds = {
    // manifest: 'schema://core/manifest', // Legacy - Removed
    components: 'schema://content/components',
    game: 'schema://core/game',
    modManifest: 'schema://core/mod-manifest',
    events: 'schema://content/events',
    actions: 'schema://content/actions',
    entities: 'schema://content/entities',
    items: 'schema://content/items',
    locations: 'schema://content/locations',
    connections: 'schema://content/connections',
    triggers: 'schema://content/triggers',
};


// ── Suite ──────────────────────────────────────────────────────────────
describe('WorldLoader', () => {
    let worldLoader; // Will be instantiated in beforeEach

    beforeEach(() => {
        jest.clearAllMocks();

        // Success-path defaults
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            return id === essentialSchemaIds.game ||
                id === essentialSchemaIds.components ||
                id === essentialSchemaIds.modManifest;
        });
        mockGameConfigLoader.loadConfig.mockResolvedValue(defaultModList);
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([['core', {
            id: 'core', version: '1.0.0', name: 'Core Mod', content: {items: ['item1.json'], actions: ['action1.json']}
        }]]));
        mockComponentDefinitionLoader.loadComponentDefinitions.mockResolvedValue(undefined);
        mockRuleLoader.loadAll.mockResolvedValue(undefined);
        mockRuleLoader._loadedEventCount = 0;
        // mockContentLoader.loadContentFiles.mockResolvedValue(undefined); // No need to setup mock result if not called


        // Instantiate SUT with the CORRECT 9 dependencies in the CORRECT order
        worldLoader = new WorldLoader(
            mockRegistry,                 // 1
            mockLogger,                   // 2
            mockSchemaLoader,             // 3
            mockComponentDefinitionLoader,// 4
            mockRuleLoader,               // 5
            mockValidator,                // 6
            mockConfiguration,            // 7
            mockGameConfigLoader,         // 8
            mockModManifestLoader         // 9
        );
    });

    // --- Constructor Tests (Verification for MODLOADER-006-A) ---
    describe('Constructor', () => {
        test('should instantiate successfully with valid dependencies', () => {
            // Arrange: beforeEach already sets up valid mocks and CORRECTLY instantiates
            // Act & Assert: Instantiation in beforeEach should not throw
            expect(worldLoader).toBeInstanceOf(WorldLoader);
            expect(mockLogger.info).toHaveBeenCalledWith('WorldLoader: Instance created (with ModManifestLoader & order‑resolver).');
        });

        test('should throw error if ModManifestLoader is missing', () => {
            // Arrange: Intentionally pass null for ModManifestLoader at the correct position (9th arg)
            // Act & Assert
            expect(() => new WorldLoader(
                mockRegistry,                 // 1
                mockLogger,                   // 2
                mockSchemaLoader,             // 3
                mockComponentDefinitionLoader,// 4
                mockRuleLoader,               // 5
                mockValidator,                // 6
                mockConfiguration,            // 7
                mockGameConfigLoader,         // 8
                null                          // 9 <<< Pass null for modManifestLoader
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader'.");
        });

        test('should throw error if ModManifestLoader is invalid (missing method)', () => {
            // Arrange: Pass an object without the required method at the correct position (9th arg)
            const invalidModManifestLoader = {
                someOtherMethod: () => {
                }
            };
            // Act & Assert
            expect(() => new WorldLoader(
                mockRegistry,                 // 1
                mockLogger,                   // 2
                mockSchemaLoader,             // 3
                mockComponentDefinitionLoader,// 4
                mockRuleLoader,               // 5
                mockValidator,                // 6
                mockConfiguration,            // 7
                mockGameConfigLoader,         // 8
                invalidModManifestLoader      // 9 <<< Pass invalid object
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader'.");
        });

        test('should throw error if GameConfigLoader is missing or invalid', () => {
            // Arrange & Act & Assert
            expect(() => new WorldLoader(
                mockRegistry,                 // 1
                mockLogger,                   // 2
                mockSchemaLoader,             // 3
                mockComponentDefinitionLoader,// 4
                mockRuleLoader,               // 5
                mockValidator,                // 6
                mockConfiguration,            // 7
                null,                         // 8 <<< Missing GameConfigLoader
                mockModManifestLoader         // 9
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader'.");

            expect(() => new WorldLoader(
                mockRegistry,                 // 1
                mockLogger,                   // 2
                mockSchemaLoader,             // 3
                mockComponentDefinitionLoader,// 4
                mockRuleLoader,               // 5
                mockValidator,                // 6
                mockConfiguration,            // 7
                {
                    wrongMethod: () => {
                    }
                },    // 8 <<< Invalid GameConfigLoader
                mockModManifestLoader         // 9
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader'.");
        });

        // Add similar tests for other dependencies if desired, though the constructor already checks them.
    });

    // ── loadWorld – Basic Flow Tests (adapted for new stages) ────────────────
    describe('loadWorld – basic flow', () => {
        test('should call services in the correct initial order', async () => {
            // Arrange: Default setup in beforeEach
            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert: Check call sequence
            const orderClear = mockRegistry.clear.mock.invocationCallOrder[0];
            const orderSchemaLoad = mockSchemaLoader.loadAndCompileAllSchemas.mock.invocationCallOrder[0];
            const orderEssentialCheck = mockValidator.isSchemaLoaded.mock.invocationCallOrder[0];
            const orderGameConfig = mockGameConfigLoader.loadConfig.mock.invocationCallOrder[0];
            const orderModManifest = mockModManifestLoader.loadRequestedManifests.mock.invocationCallOrder[0];
            const orderRules = mockRuleLoader.loadAll.mock.invocationCallOrder[0];
            const orderComponents = mockComponentDefinitionLoader.loadComponentDefinitions.mock.invocationCallOrder[0];
            // Content Loader is not called directly by this version of loadWorld constructor/initial steps
            // const orderContent = mockContentLoader.loadContentFiles.mock.invocationCallOrder[0]; // REMOVED CHECK

            expect(orderClear).toBeLessThan(orderSchemaLoad);
            expect(orderSchemaLoad).toBeLessThan(orderEssentialCheck);
            // Note: isSchemaLoaded gets called multiple times for essential checks, ensure order relative to first call
            expect(orderEssentialCheck).toBeLessThan(orderGameConfig);
            expect(orderGameConfig).toBeLessThan(orderModManifest);
            expect(orderModManifest).toBeLessThan(orderRules);
            expect(orderRules).toBeLessThan(orderComponents);
            // expect(orderComponents).toBeLessThan(orderContent); // REMOVED CHECK

            // Verify specific calls
            expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.components);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.modManifest);
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith(defaultModList);
            expect(mockRuleLoader.loadAll).toHaveBeenCalledTimes(1);
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).toHaveBeenCalledTimes(1);
            // Verify legacy loaders/methods not called
            expect(mockRegistry.setManifest).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled(); // Should not be called

            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('should throw and clear registry if an essential schema is missing', async () => {
            // Arrange: Make the 'mod-manifest' schema fail the check
            const missingSchemaId = essentialSchemaIds.modManifest;
            mockValidator.isSchemaLoaded.mockImplementation((id) => id !== missingSchemaId);

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName),
            ).rejects.toThrow(
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): Essential schemas missing – aborting world load.`,
            );

            // Assert critical path stops early
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(missingSchemaId); // It should have checked for the missing one
            expect(mockGameConfigLoader.loadConfig).not.toHaveBeenCalled(); // Should fail before game config
            expect(mockModManifestLoader.loadRequestedManifests).not.toHaveBeenCalled();

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(`WorldLoader: Essential schema missing: ${missingSchemaId}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                expect.any(Error),
            );

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        test('should throw and clear registry if GameConfigLoader fails', async () => {
            // Arrange
            const configError = new Error('Game config file is corrupted!');
            mockGameConfigLoader.loadConfig.mockRejectedValue(configError);
            // Ensure essential schemas are loaded so we get past that check
            mockValidator.isSchemaLoaded.mockReturnValue(true); // Assume all essential schemas pass

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName)
            ).rejects.toThrow(
                // The error message includes the original error's message
                `${configError.message}`
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game); // Check happened
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1); // Called
            expect(mockModManifestLoader.loadRequestedManifests).not.toHaveBeenCalled(); // Did not proceed

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                expect.any(Error) // Error thrown by GameConfigLoader should be caught here
            );
            // Check if the original error message is part of the logged error context
            expect(mockLogger.error.mock.calls[0][1].message).toContain(configError.message);

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        test('should throw and clear registry if ModManifestLoader fails', async () => {
            // Arrange
            const manifestError = new Error('Mod manifest network error!');
            mockModManifestLoader.loadRequestedManifests.mockRejectedValue(manifestError);
            // Ensure preceding steps succeed
            mockValidator.isSchemaLoaded.mockReturnValue(true);
            mockGameConfigLoader.loadConfig.mockResolvedValue(defaultModList);

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName)
            ).rejects.toThrow(
                `${manifestError.message}`
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith(defaultModList); // Called

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                expect.any(Error)
            );
            expect(mockLogger.error.mock.calls[0][1].message).toContain(manifestError.message);

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        // Add tests for failures in RuleLoader, ComponentDefinitionLoader etc.
        // These might need adjustment based on how they are refactored to use mod manifests.
        // For example, ComponentDefinitionLoader might now fail if it strictly requires getManifest(),
        // or it might succeed but load nothing.

        test('should correctly pass mod list from GameConfigLoader to ModManifestLoader', async () => {
            // Arrange
            const specificModList = ['core', 'expansionA', 'uiTweaks'];
            mockGameConfigLoader.loadConfig.mockResolvedValue(specificModList);
            mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map()); // Just needs to resolve

            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith(specificModList); // Verify the list was passed correctly
            expect(mockLogger.error).not.toHaveBeenCalled();
        });


    }); // End describe 'loadWorld – basic flow'

    // --- Tests for Post-Manifest Loading Stages (Need Refactoring) ---
    describe('loadWorld - post-manifest stages (Refactor Pending)', () => {
        // These tests need careful review and likely updates once Steps 6, 7, 8 are refactored.

        test('should call RuleLoader.loadAll', async () => {
            // Arrange: Basic success path setup in beforeEach
            // Act
            await worldLoader.loadWorld(testWorldName);
            // Assert
            expect(mockRuleLoader.loadAll).toHaveBeenCalledTimes(1);
        });

        test('should call ComponentDefinitionLoader.loadComponentDefinitions', async () => {
            // Arrange: Basic success path setup in beforeEach
            // Act
            await worldLoader.loadWorld(testWorldName);
            // Assert
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).toHaveBeenCalledTimes(1);
            // Add checks here if ComponentDefinitionLoader now interacts differently,
            // e.g., maybe it uses registry.getAll('mod_manifests') instead of getManifest()
        });

        test('should NOT call GenericContentLoader.loadContentFiles (until refactored)', async () => {
            // Arrange: Basic success path setup in beforeEach
            // Act
            await worldLoader.loadWorld(testWorldName);
            // Assert
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();
        });

        // Test failure scenarios for RuleLoader, ComponentDefLoader etc. once refactored.
        test('should log summary with mod order and counts', async () => {
            // Arrange
            const requestedMods = ['core', 'extra'];
            const finalResolvedOrder = ['core', 'extra']; // Assuming simple case for this test
            mockGameConfigLoader.loadConfig.mockResolvedValue(requestedMods);
            const loadedManifests = new Map([
                ['core', {id: 'core', version: '1.0.0', name: 'core', content: {actions: ['a1.json']}}], // Added version for consistency
                ['extra', {id: 'extra', version: '1.0.0', name: 'Extra', content: {items: ['i1.json', 'i2.json']}}], // Added version for consistency
            ]);
            mockModManifestLoader.loadRequestedManifests.mockResolvedValue(loadedManifests);
            // Mock registry state *after* loading (simulate what should be there for summary)
            mockRegistry.getAll.mockImplementation((type) => {
                if (type === 'mod_manifests') return Array.from(loadedManifests.values()); // Used internally by summary potentially
                if (type === 'component_definitions') return [{id: 'comp1'}]; // Simulate 1 loaded component def
                if (type === 'system-rules') return [{rule_id: 'rule1'}];      // Simulate 1 loaded rule
                // Simulate content counts (assuming future refactor would populate these)
                if (type === 'actions') return [{id: 'a1'}];
                if (type === 'items') return [{id: 'i1'}, {id: 'i2'}];
                return []; // Default empty for other types
            });
            // Mock registry to return the final order stored by WorldLoader
            // Simulate storage of the final order resolved by the resolver
            mockRegistry.store.mockImplementation((type, key, value) => {
                if (type === 'meta' && key === 'final_mod_order') {
                    // In a real scenario, this would store the actual resolved order.
                    // For this test, finalResolvedOrder is predefined.
                }
            });
            // Mock the resolver log call separately if needed, but the summary log is the target here
            // Assuming resolveOrder logs its own message as seen in its code.

            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert Summary Log content (using the correct strings from #logLoadSummary)
            expect(mockLogger.info).toHaveBeenCalledWith(`— WorldLoader Load Summary (World: '${testWorldName}') —`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Requested Mods (raw): [${requestedMods.join(', ')}]`);
            // --- CORRECTED ASSERTION ---
            // This assertion targets the summary log, which uses bracket/comma format.
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Final Load Order    : [${finalResolvedOrder.join(', ')}]`);
            // --- END CORRECTED ASSERTION ---
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Component definitions loaded: 1`); // Based on mockRegistry.getAll('component_definitions')
            expect(mockLogger.info).toHaveBeenCalledWith(`  • System rules loaded         : 1`); // Based on mockRegistry.getAll('system-rules')
            expect(mockLogger.info).toHaveBeenCalledWith('———————————————————————————————————————————');

            // Verify counts based on registry mocks
            expect(mockRegistry.getAll).toHaveBeenCalledWith('component_definitions');
            expect(mockRegistry.getAll).toHaveBeenCalledWith('system-rules');

            // Optional: Verify the separate resolver log if necessary
            // This depends on whether you *also* want to assert the resolver's specific log output
            // expect(mockLogger.info).toHaveBeenCalledWith(`modLoadOrderResolver: Resolved load order (${finalResolvedOrder.length} mods): ${finalResolvedOrder.join(' → ')}`);

        });
    });

    // --- Tests for Mod Dependency Handling ---
    describe('loadWorld - dependency resolution', () => {
        // ... (Keep any existing dependency validation tests) ...

        // --- TICKET CHANGE TEST ---
        test('should throw error starting with DEPENDENCY_CYCLE: on cyclic dependency', async () => {
            // Arrange: Create a cyclic dependency (A -> B, B -> A)
            const cyclicMods = ['modA', 'modB'];
            mockGameConfigLoader.loadConfig.mockResolvedValue(cyclicMods);
            // --- CORRECTED MANIFESTS: Added version property to dependencies ---
            const cyclicManifests = new Map([
                ['moda', {id: 'modA', version: '1.0.0', name: 'Mod A', dependencies: [{id: 'modB', version: '1.0.0'}]}], // Added version:'1.0.0'
                ['modb', {id: 'modB', version: '1.0.0', name: 'Mod B', dependencies: [{id: 'modA', version: '1.0.0'}]}], // Added version:'1.0.0'
            ]);
            // --- END CORRECTION ---
            mockModManifestLoader.loadRequestedManifests.mockResolvedValue(cyclicManifests);
            // Ensure essential schemas are loaded
            mockValidator.isSchemaLoaded.mockReturnValue(true);

            // Act & Assert
            // Use separate awaits for rejects.toThrow checks as chaining them might mask the first error
            await expect(worldLoader.loadWorld('cycle-world')).rejects.toThrow(ModDependencyError);
            await expect(worldLoader.loadWorld('cycle-world')).rejects.toThrow(/^DEPENDENCY_CYCLE:/);

            // Also verify logging and cleanup
            // Get the calls AFTER the second rejection attempt (or check total count increases as expected)
            // Note: The number of calls to error/clear might be doubled because we call loadWorld twice in the assertions.
            // It might be cleaner to wrap the call in a function and test that function.
            let capturedError = null;
            try {
                await worldLoader.loadWorld('cycle-world-log-check'); // Use different world name if needed
            } catch (e) {
                capturedError = e;
            }

            // Verify based on the captured error from a single call
            expect(capturedError).toBeInstanceOf(ModDependencyError);
            expect(capturedError.message).toMatch(/^DEPENDENCY_CYCLE:/);

            // Check logs based on that single failing run
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                expect.objectContaining({ // Check the error instance passed to logger
                    message: expect.stringMatching(/^DEPENDENCY_CYCLE:/),
                    name: 'ModDependencyError'
                })
            );

            // Registry cleared twice per failing run (start + catch)
            // Check the total count reflects multiple runs or adjust test structure
            expect(mockRegistry.clear).toHaveBeenCalled(); // At least once per run start
            // Can't easily assert exact times(2) without knowing prior state due to multiple awaits running the method.
            // A better test structure would call loadWorld once inside a try/catch and assert on the caught error and mocks.
            // Example of better structure:
            // let error;
            // try { await worldLoader.loadWorld('cycle-world'); } catch (e) { error = e; }
            // expect(error).toBeInstanceOf(ModDependencyError);
            // expect(error.message).toMatch(/^DEPENDENCY_CYCLE:/);
            // Check mocks based on this single run...
            // expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Once at start, once in catch

        });
        // --- END TICKET CHANGE TEST ---
    });


}); // End describe 'WorldLoader'