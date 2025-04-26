// tests/core/services/worldLoader.test.js

import WorldLoader from '../../../core/services/worldLoader.js';
import {beforeEach, describe, expect, jest, test} from '@jest/globals';

// ── Mock dependencies ──────────────────────────────────────────────────
const mockRegistry = {
    clear: jest.fn(),
    setManifest: jest.fn(),
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

const mockManifestLoader = {
    loadAndValidateManifest: jest.fn(),
};

const mockContentLoader = {
    loadContentFiles: jest.fn(),
};

const mockComponentDefinitionLoader = {
    loadComponentDefinitions: jest.fn(),
};

const mockRuleLoader = {
    loadAll: jest.fn().mockResolvedValue(undefined),
    loadedEventCount: 0,
};

const mockValidator = {
    isSchemaLoaded: jest.fn(),
    addSchema: jest.fn(),
    getValidator: jest.fn(),
    validate: jest.fn(),
};

const mockConfiguration = {
    getManifestSchemaId: jest.fn(),
    getContentTypeSchemaId: jest.fn(),
    getBaseDataPath: jest.fn().mockReturnValue('/fake/data'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getSchemaBasePath: jest.fn().mockReturnValue('/fake/data/schemas'),
    getContentBasePath: jest.fn().mockReturnValue('/fake/data/content'),
    getWorldBasePath: jest.fn().mockReturnValue('/fake/data/worlds'),
    // Need game schema ID for WorldLoader internal check
    getContentTypeSchemaId: jest.fn().mockImplementation((type) => {
        if (type === 'game') return 'schema://core/game'; // Provide a dummy schema ID for 'game' type
        return essentialSchemaIds[type];
    }),
};

// <<< ADDED: Mock for GameConfigLoader START >>>
const mockGameConfigLoader = {
    loadConfig: jest.fn(),
};
// <<< ADDED: Mock for GameConfigLoader END >>>


// ── Test constants ─────────────────────────────────────────────────────
const testWorldName = 'test-world';
const defaultModList = ['core']; // Default mod list for successful game config load
const essentialSchemaIds = {
    manifest: 'schema://core/manifest',
    components: 'schema://content/components',
    game: 'schema://core/game', // Add game schema ID used by WorldLoader
    // other schema IDs are included for completeness but are not “essential”
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
    let worldLoader;

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Success-path defaults ---
        mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

        // Mock configuration to return essential schema IDs
        mockConfiguration.getManifestSchemaId.mockReturnValue(
            essentialSchemaIds.manifest,
        );
        mockConfiguration.getContentTypeSchemaId.mockImplementation(
            (type) => essentialSchemaIds[type],
        );

        // Mock validator to report essential schemas as loaded by default
        mockValidator.isSchemaLoaded.mockImplementation((id) => {
            // Assume all essential schemas needed *before* game config load are present
            return id === essentialSchemaIds.game ||
                id === essentialSchemaIds.manifest ||
                id === essentialSchemaIds.components;
        });

        // <<< ADDED: Default success for game config load >>>
        mockGameConfigLoader.loadConfig.mockResolvedValue(defaultModList);

        // Default success for manifest load (legacy)
        mockManifestLoader.loadAndValidateManifest.mockResolvedValue({
            worldName: testWorldName,
            contentFiles: {
                components: ['comp1.component.json'],
                items: ['item1.json'],
            },
        });
        mockRegistry.getManifest.mockReturnValue(null); // Start with no manifest
        mockRegistry.setManifest.mockImplementation((m) =>
            mockRegistry.getManifest.mockReturnValue(m),
        ); // Simulate setting manifest

        // Default success for downstream loaders (legacy)
        mockComponentDefinitionLoader.loadComponentDefinitions.mockResolvedValue(
            undefined,
        );
        mockContentLoader.loadContentFiles.mockResolvedValue(undefined);
        mockRuleLoader.loadAll.mockResolvedValue(undefined);

        // Instantiate SUT with the new dependency
        worldLoader = new WorldLoader(
            mockRegistry,
            mockLogger,
            mockSchemaLoader,
            mockManifestLoader,
            mockContentLoader,
            mockComponentDefinitionLoader,
            mockRuleLoader,
            mockValidator,
            mockConfiguration,
            mockGameConfigLoader // <<< ADDED: Pass mock GameConfigLoader
        );
    });

    // ── Happy path ─────────────────────────────────────────────────────
    describe('loadWorld – essential schema verification & game config load', () => {
        test('AC1 & AC5: proceeds successfully when all essential schemas are loaded and game config loads', async () => {
            // Arrange: Default setup already mocks success for schema loading and game config

            // Act
            await expect(
                worldLoader.loadWorld(testWorldName),
            ).resolves.toBeUndefined();

            // Assert
            // Schema compilation → essential check → game config load → legacy manifest load...
            const orderSchema = mockSchemaLoader.loadAndCompileAllSchemas.mock.invocationCallOrder[0];
            const orderValidatorCheck = mockValidator.isSchemaLoaded.mock.invocationCallOrder[0]; // First call to isSchemaLoaded
            const orderGameConfigLoad = mockGameConfigLoader.loadConfig.mock.invocationCallOrder[0];
            const orderManifestLoad = mockManifestLoader.loadAndValidateManifest.mock.invocationCallOrder[0];

            expect(orderSchema).toBeLessThan(orderValidatorCheck);
            expect(orderValidatorCheck).toBeLessThan(orderGameConfigLoad);
            expect(orderGameConfigLoad).toBeLessThan(orderManifestLoad);


            // Check schema checks happened correctly
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.manifest);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.components);

            // Check game config load happened
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Requested mods (${defaultModList.length}): [${defaultModList.join(', ')}]`));

            // Check legacy downstream loaders were still called
            expect(mockManifestLoader.loadAndValidateManifest).toHaveBeenCalledTimes(1);
            expect(mockRuleLoader.loadAll).toHaveBeenCalledTimes(1);
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).toHaveBeenCalledTimes(1);
            expect(mockContentLoader.loadContentFiles).toHaveBeenCalledWith('items', ['item1.json']);
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalledWith('components', expect.anything());

            // Registry cleared once at start
            expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
            // No error logs
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        // ── Single missing essential schema ────────────────────────────
        test('AC2/3/4: throws and logs when an essential schema (needed before game config) is missing', async () => {
            // Arrange: Make the 'game' schema fail the check
            const missingSchemaId = essentialSchemaIds.game;
            mockValidator.isSchemaLoaded.mockImplementation((id) => id !== missingSchemaId);

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName),
            ).rejects.toThrow(
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): Essential schemas missing – aborting world load.`,
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(missingSchemaId); // It should have checked for the missing one

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(`WorldLoader: Essential schema missing: ${missingSchemaId}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.', // Updated error context
                expect.any(Error),
            );

            // Assert downstream loaders NOT called
            expect(mockGameConfigLoader.loadConfig).not.toHaveBeenCalled(); // Should fail before this
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRuleLoader.loadAll).not.toHaveBeenCalled();
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        // ── Two missing essential schemas ──────────────────────────────
        test('AC2/3/4: throws and logs when multiple essential schemas (needed before game config) are missing', async () => {
            // Arrange: Make 'game' and 'components' schemas fail
            const missingSchemaId1 = essentialSchemaIds.game;
            const missingSchemaId2 = essentialSchemaIds.components;
            const missingSet = new Set([missingSchemaId1, missingSchemaId2]);
            mockValidator.isSchemaLoaded.mockImplementation((id) => !missingSet.has(id));

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName),
            ).rejects.toThrow(
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): Essential schemas missing – aborting world load.`,
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(missingSchemaId1);
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(missingSchemaId2);

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(`WorldLoader: Essential schema missing: ${missingSchemaId1}`);
            expect(mockLogger.error).toHaveBeenCalledWith(`WorldLoader: Essential schema missing: ${missingSchemaId2}`);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.', // Updated error context
                expect.any(Error),
            );

            // Assert downstream loaders NOT called
            expect(mockGameConfigLoader.loadConfig).not.toHaveBeenCalled();
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRuleLoader.loadAll).not.toHaveBeenCalled();
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });

        // ── Call-order verification ────────────────────────────────────
        test('AC4: verification -> game config load -> legacy manifest load -> rules load', async () => {
            // Arrange: Default setup mocks success

            // Act
            await worldLoader.loadWorld(testWorldName);

            // Assert: Check invocation order
            const orderSchema = mockSchemaLoader.loadAndCompileAllSchemas.mock.invocationCallOrder[0];
            const orderValidator = mockValidator.isSchemaLoaded.mock.invocationCallOrder[0]; // First call
            const orderGameConfig = mockGameConfigLoader.loadConfig.mock.invocationCallOrder[0];
            const orderManifest = mockManifestLoader.loadAndValidateManifest.mock.invocationCallOrder[0];
            const orderRules = mockRuleLoader.loadAll.mock.invocationCallOrder[0];

            expect(orderSchema).toBeLessThan(orderValidator);
            expect(orderValidator).toBeLessThan(orderGameConfig); // Essential check before game config
            expect(orderGameConfig).toBeLessThan(orderManifest); // Game config load before legacy manifest
            expect(orderManifest).toBeLessThan(orderRules);     // Legacy manifest before rules
        });

        // <<< ADDED: Test for GameConfigLoader failure START >>>
        test('Throws and logs if GameConfigLoader fails', async () => {
            // Arrange
            const configError = new Error('Game config file is corrupted!');
            mockGameConfigLoader.loadConfig.mockRejectedValue(configError);
            // Ensure essential schemas are loaded so we get past that check
            mockValidator.isSchemaLoaded.mockReturnValue(true);

            // Act & Assert
            await expect(
                worldLoader.loadWorld(testWorldName)
            ).rejects.toThrow(
                `WorldLoader failed data load sequence (World Hint: '${testWorldName}'): ${configError.message}`
            );

            // Assert critical path
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalled();
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(essentialSchemaIds.game);
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

            // Assert logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                expect.any(Error) // Error thrown by GameConfigLoader should be caught here
            );
            // Optional: Check if the original error message is part of the logged error context
            expect(mockLogger.error.mock.calls[0][1].message).toContain(configError.message);


            // Assert downstream loaders NOT called
            expect(mockManifestLoader.loadAndValidateManifest).not.toHaveBeenCalled();
            expect(mockRuleLoader.loadAll).not.toHaveBeenCalled();
            expect(mockComponentDefinitionLoader.loadComponentDefinitions).not.toHaveBeenCalled();
            expect(mockContentLoader.loadContentFiles).not.toHaveBeenCalled();

            // Registry cleared twice (start + catch)
            expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
        });
        // <<< ADDED: Test for GameConfigLoader failure END >>>

    }); // End describe 'loadWorld – essential schema verification & game config load'

}); // End describe 'WorldLoader'
