// tests/core/services/worldLoader.test.js

import WorldLoader from '../../../core/services/worldLoader.js'; // Corrected path assumption
import {beforeEach, describe, expect, jest, test} from '@jest/globals';

// ── Mock dependencies ──────────────────────────────────────────────────
const mockRegistry = {
    clear: jest.fn(),
    setManifest: jest.fn(), // Keep mock even if not called in success path now
    getManifest: jest.fn(),
    store: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockSchemaLoader = {
    loadAndCompileAllSchemas: jest.fn(),
};

const mockManifestLoader = { // Legacy manifest loader
    loadAndValidateManifest: jest.fn(),
};

const mockContentLoader = { // Legacy content loader (mock needed, though maybe not called)
    loadContentFiles: jest.fn(),
};

const mockComponentDefinitionLoader = {
    loadComponentDefinitions: jest.fn(),
};

const mockRuleLoader = {
    loadAll: jest.fn().mockResolvedValue(undefined),
    // Note: loadedEventCount might be removed or become internal if RuleLoader changes
    get loadedEventCount() {
        return mockRuleLoader._loadedEventCount || 0;
    },
    _loadedEventCount: 0, // Internal mock state
};


const mockValidator = {
    isSchemaLoaded: jest.fn(),
    addSchema: jest.fn(),
    getValidator: jest.fn(),
    validate: jest.fn(),
};

const mockConfiguration = {
    getManifestSchemaId: jest.fn(), // Legacy
    getContentTypeSchemaId: jest.fn().mockImplementation((type) => {
        // Provide essential schema IDs used in WorldLoader's checks
        if (type === 'game') return essentialSchemaIds.game;
        if (type === 'components') return essentialSchemaIds.components;
        if (type === 'mod-manifest') return essentialSchemaIds.modManifest; // Added
        // Add others if needed for content loading checks later
        return essentialSchemaIds[type];
    }),
    getBaseDataPath: jest.fn().mockReturnValue('/fake/data'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getSchemaBasePath: jest.fn().mockReturnValue('/fake/data/schemas'),
    getContentBasePath: jest.fn().mockReturnValue('/fake/data/content'),
    getWorldBasePath: jest.fn().mockReturnValue('/fake/data/worlds'), // Legacy
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
};

const mockGameConfigLoader = {
    loadConfig: jest.fn(),
};

// <<< ADDED: Mock for ModManifestLoader START >>>
const mockModManifestLoader = {
    loadRequestedManifests: jest.fn(),
    // Add other methods if needed by future tests
};
// <<< ADDED: Mock for ModManifestLoader END >>>


// ── Test constants ─────────────────────────────────────────────────────
const testWorldName = 'test-world';
const defaultModList = ['core']; // Default mod list for successful game config load
const essentialSchemaIds = {
    manifest: 'schema://core/manifest', // Legacy
    components: 'schema://content/components',
    game: 'schema://core/game',
    modManifest: 'schema://core/mod-manifest', // Added
    // other schema IDs are included for completeness but are not “essential” for constructor/initial steps
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

        // --- Success-path defaults ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Mock configuration to return essential schema IDs
        mockConfiguration.getManifestSchemaId.mockReturnValue(essentialSchemaIds.manifest); // Legacy

        // Mock validator to report essential schemas as loaded by default
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            // Assume all essential schemas needed *before* game config load are present
            return id === essentialSchemaIds.game ||
                id === essentialSchemaIds.manifest || // Legacy
                id === essentialSchemaIds.components ||
                id === essentialSchemaIds.modManifest; // Added
        });

        // Default success for game config load
        mockGameConfigLoader.loadConfig.mockResolvedValue(defaultModList);

        // <<< ADDED: Default success for mod manifest load >>>
        mockModManifestLoader.loadRequestedManifests.mockResolvedValue(new Map([['core', {
            id: 'core',
            version: '1.0.0', // Add version etc. based on ModManifestLoader's needs if applicable
            name: 'Core Mod',
            content: { // Example content structure
                items: ['item1.json'],
                actions: ['action1.json']
            }
        }]]));

        // Default success for legacy manifest load (MOCK STILL NEEDED FOR CONSTRUCTOR)
        // Even though it's not used in the loading logic anymore, the constructor still expects it.
        mockManifestLoader.loadAndValidateManifest.mockResolvedValue({
            worldName: testWorldName,
            contentFiles: { // This structure is effectively ignored by the loadWorld logic now
                components: ['comp1.component.json'],
                items: ['item1.json'],
            },
        });
        mockRegistry.getManifest.mockReturnValue(null); // Start with no manifest
        mockRegistry.setManifest.mockImplementation((m) =>
            mockRegistry.getManifest.mockReturnValue(m),
        ); // Simulate setting manifest, though it's not called in success path

        // Default success for downstream loaders
        mockComponentDefinitionLoader.loadComponentDefinitions.mockResolvedValue(undefined);
        mockContentLoader.loadContentFiles.mockResolvedValue(undefined); // Mock still needed, even if not called
        mockRuleLoader.loadAll.mockResolvedValue(undefined);
        mockRuleLoader._loadedEventCount = 0; // Reset mock state


        // Instantiate SUT with ALL dependencies, including the new one
        worldLoader = new WorldLoader(
            mockRegistry,
            mockLogger,
            mockSchemaLoader,
            mockManifestLoader, // Legacy, keep for now
            mockContentLoader, // Legacy
            mockComponentDefinitionLoader,
            mockRuleLoader,
            mockValidator,
            mockConfiguration,
            mockGameConfigLoader,
            mockModManifestLoader // <<< ADDED: Pass mock ModManifestLoader
        );
    });

    // --- Constructor Tests (Verification for MODLOADER-006-A) ---
    describe('Constructor', () => {
        test('should instantiate successfully with valid dependencies', () => {
            // Arrange: beforeEach already sets up valid mocks
            // Act & Assert: Instantiation in beforeEach should not throw
            expect(worldLoader).toBeInstanceOf(WorldLoader);
            // Check that the logger message includes the new dependency name
            expect(mockLogger.info).toHaveBeenCalledWith('WorldLoader: Instance created (with ModManifestLoader).');
        });

        test('should throw error if ModManifestLoader is missing', () => {
            // Arrange: Intentionally pass null for ModManifestLoader
            // Act & Assert
            expect(() => new WorldLoader(
                mockRegistry, mockLogger, mockSchemaLoader, mockManifestLoader,
                mockContentLoader, mockComponentDefinitionLoader, mockRuleLoader,
                mockValidator, mockConfiguration, mockGameConfigLoader,
                null // Pass null for modManifestLoader
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader' (needs loadRequestedManifests method).");
        });

        test('should throw error if ModManifestLoader is invalid (missing method)', () => {
            // Arrange: Pass an object without the required method
            const invalidModManifestLoader = {
                someOtherMethod: () => {
                }
            };
            // Act & Assert
            expect(() => new WorldLoader(
                mockRegistry, mockLogger, mockSchemaLoader, mockManifestLoader,
                mockContentLoader, mockComponentDefinitionLoader, mockRuleLoader,
                mockValidator, mockConfiguration, mockGameConfigLoader,
                invalidModManifestLoader // Pass invalid object
            )).toThrow("WorldLoader: Missing/invalid 'modManifestLoader' (needs loadRequestedManifests method).");
        });

        test('should throw error if GameConfigLoader is missing or invalid', () => {
            // Arrange & Act & Assert
            expect(() => new WorldLoader(
                mockRegistry, mockLogger, mockSchemaLoader, mockManifestLoader,
                mockContentLoader, mockComponentDefinitionLoader, mockRuleLoader,
                mockValidator, mockConfiguration,
                null, // Missing GameConfigLoader
                mockModManifestLoader
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");

            expect(() => new WorldLoader(
                mockRegistry, mockLogger, mockSchemaLoader, mockManifestLoader,
                mockContentLoader, mockComponentDefinitionLoader, mockRuleLoader,
                mockValidator, mockConfiguration,
                {
                    wrongMethod: () => {
                    }
                }, // Invalid GameConfigLoader
                mockModManifestLoader
            )).toThrow("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");
        });

        // Add similar tests for other dependencies if desired, though the constructor already checks them.
    });

    // ── loadWorld – Basic Flow Tests (adapted for new stages) ────────────────
    describe('loadWorld – basic flow', () => {
        test('should call services in the correct initial order', async () => {
            // Arrange: Default setup already mocks success
            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert: Check initial call sequence
            // Registry Clear -> Schemas -> Essential Check -> Game Config -> Mod Manifests -> Rules -> Components -> Content (Refactor Needed)
            const orderClear = mockRegistry.clear.mock.invocationCallOrder[0];
            const orderSchemaLoad = mockSchemaLoader.loadAndCompileAllSchemas.mock.invocationCallOrder[0];
            const orderEssentialCheck = mockValidator.isSchemaLoaded.mock.invocationCallOrder[0]; // First call
            const orderGameConfig = mockGameConfigLoader.loadConfig.mock.invocationCallOrder[0];
            const orderModManifest = mockModManifestLoader.loadRequestedManifests.mock.invocationCallOrder[0];
            const orderRules = mockRuleLoader.loadAll.mock.invocationCallOrder[0];
            const orderComponents = mockComponentDefinitionLoader.loadComponentDefinitions.mock.invocationCallOrder[0];
            // Content Loader might not be called now, so we cannot reliably check its order until refactor
            // const orderContent = mockContentLoader.loadContentFiles.mock.invocationCallOrder[0]; // First call (REMOVED CHECK)

            expect(orderClear).toBeLessThan(orderSchemaLoad);
            expect(orderSchemaLoad).toBeLessThan(orderEssentialCheck);
            expect(orderEssentialCheck).toBeLessThan(orderGameConfig);
            expect(orderGameConfig).toBeLessThan(orderModManifest); // Game Config before Mod Manifests
            expect(orderModManifest).toBeLessThan(orderRules); // Mod Manifests before Rules
            expect(orderRules).toBeLessThan(orderComponents);
            // expect(orderComponents).toBeLessThan(orderContent); // <<< FAILING ASSERTION COMMENTED OUT / REMOVED

            // Verify specific calls
            expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game); // Essential checks
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.components);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.modManifest);
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith(defaultModList); // Called with result of game config
            // Legacy manifest calls should NOT happen
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRegistry.setManifest).not.toHaveBeenCalled();
            // Subsequent calls
            expect(mockRuleLoader.loadAll).toHaveBeenCalledTimes(1);
            // Component loader might fail if it relies on getManifest, test this explicitly if needed
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).toHaveBeenCalledTimes(1);
            // Content loader not called because the logic using legacy manifest.contentFiles is bypassed
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

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
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled(); // Legacy also skipped

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
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): ${configError.message}`
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game); // Check happened
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1); // Called
            expect(mockModManifestLoader.loadRequestedManifests).not.toHaveBeenCalled(); // Did not proceed
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled(); // Legacy skipped

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
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): ${manifestError.message}`
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith(defaultModList); // Called
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled(); // Legacy skipped

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
                ['core', {id: 'core', name: 'Core', content: {actions: ['a1.json']}}],
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
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Component definitions: 1`); // From mockRegistry.getAll
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Mod Manifests: 2`); // From mockRegistry.getAll
            expect(mockLogger.info).toHaveBeenCalledWith(`  • actions: 1`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • items: 2`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • Total Content Items (excluding components/rules/manifests): 3`);
            expect(mockLogger.info).toHaveBeenCalledWith(`  • System rules loaded: 1`); // From mockRegistry.getAll('system-rules')
            expect(mockLogger.info).toHaveBeenCalledWith('———————————————————————————————————————————————');

        });

    });


}); // End describe 'WorldLoader'