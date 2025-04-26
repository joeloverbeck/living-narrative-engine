// tests/core/services/worldLoader.test.js

// --- JSDoc Imports ---
/** @typedef {import('../../../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../core/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../core/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../core/services/schemaLoader.js').default} SchemaLoader */ // Assuming type
/** @typedef {import('../../../core/services/componentDefinitionLoader.js').default} ComponentDefinitionLoader */ // Assuming type
/** @typedef {import('../../../core/services/ruleLoader.js').default} RuleLoader */ // Assuming type
/** @typedef {import('../../../core/services/gameConfigLoader.js').default} GameConfigLoader */ // Assuming type
/** @typedef {import('../../../core/services/modManifestLoader.js').default} ModManifestLoader */ // Assuming type

// --- Class Under Test ---
import WorldLoader from '../../../core/services/worldLoader.js';
// --- Jest Imports ---
import {beforeEach, describe, expect, jest, test} from '@jest/globals';

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
            expect(mockLogger.info).toHaveBeenCalledWith('WorldLoader: Instance created (with ModManifestLoader).');
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
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader' (needs loadRequestedManifests method).");
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
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader' (needs loadRequestedManifests method).");
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
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");

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
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");
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
            mockGameConfigLoader.loadConfig.mockResolvedValue(['core', 'extra']);
            const loadedManifests = new Map([
                ['core', {id: 'core', name: 'core', content: {actions: ['a1.json']}}],
                ['extra', {id: 'extra', name: 'Extra', content: {items: ['i1.json', 'i2.json']}}],
            ]);
            mockModManifestLoader.loadRequestedManifests.mockResolvedValue(loadedManifests);
            mockRegistry.getAll.mockImplementation((type) => {
                if (type === 'mod_manifests') return Array.from(loadedManifests.values());
                if (type === 'component_definitions') return [{id: 'comp1'}]; // Simulate loaded components
                if (type === 'system-rules') return [{rule_id: 'rule1'}]; // Simulate loaded rules
                // Simulate some content being loaded (assuming future refactor)
                if (type === 'actions') return [{id: 'a1'}];
                if (type === 'items') return [{id: 'i1'}, {id: 'i2'}];
                return [];
            });
            mockRuleLoader._loadedEventCount = 1; // Simulate rule loader state (legacy)

            // Act
            await worldLoader.loadWorld(testWorldName);

            // --- Start Diagnostic ---
            // const infoCalls = mockLogger.info.mock.calls;
            // console.log('Actual mockLogger.info calls:', JSON.stringify(infoCalls, null, 2));
            //
            // const expectedString = `  • Final Mod Load Order: [core, extra]`; // Corrected expectation
            // const foundCall = infoCalls.some(callArgs => callArgs[0] === expectedString);
            // console.log(`Was the expected string found? ${foundCall}`);
            // --- End Diagnostic ---

            // Original Assertions (keep them or comment out while diagnosing)
            expect(mockLogger.info).toHaveBeenCalledWith(`— WorldLoader Load Summary (World Hint: '${testWorldName}') —`);
            // <<< MODIFIED ASSERTION >>>
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Final Mod Load Order: [core, extra]`); // Added space after comma
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Component definitions loaded: 1`); // From mockRegistry.getAll
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Mod Manifests loaded: 2`); // From mockRegistry.getAll
            expect(mockLogger.info).toHaveBeenCalledWith(`  • actions: 1`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • items: 2`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Total Content Items (excluding manifests): 3`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • System rules loaded: 1`); // From mockRegistry.getAll('system-rules')
            expect(mockLogger.info).toHaveBeenCalledWith('———————————————————————————————————————————————');

        });

    });


}); // End describe 'WorldLoader'