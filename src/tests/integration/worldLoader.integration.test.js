    // Filename: test/integration/worldLoader.integration.test.js

    import { beforeEach, describe, expect, it, jest } from '@jest/globals';

    // --- SUT ---
    import WorldLoader from '../../core/services/worldLoader.js';

    // --- Dependencies to Mock ---
    // Mock static/imported functions BEFORE importing WorldLoader if they are used at module level or constructor indirectly
    // Note: resolveOrder is directly used. ModDependencyValidator.validate and validateModEngineVersions are also used directly.
    import * as ModDependencyValidatorModule from '../../core/services/modDependencyValidator.js';

    jest.mock('../../core/services/modDependencyValidator.js', () => ({
        validate: jest.fn(), // Mock the static validate method
        // Include other exports if needed, potentially mocking them too
    }));

    import * as ModVersionValidatorModule from '../../core/services/modVersionValidator.js';
    jest.mock('../../core/services/modVersionValidator.js', () => jest.fn()); // Mock the default export function

    import * as ModLoadOrderResolverModule from '../../core/services/modLoadOrderResolver.js';
    jest.mock('../../core/services/modLoadOrderResolver.js', () => ({
        resolveOrder: jest.fn(), // Mock the exported resolveOrder function
        // Include other exports if needed
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


    describe('WorldLoader Integration Test Suite (TEST-LOADER-7.1)', () => {
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
        let mockCoreManifest;
        /** @type {Map<string, ModManifest>} */
        let mockManifestMap;
        const coreModId = 'core';
        const worldName = 'testWorldSimple';

        // --- Mocked Functions (from imports) ---
        const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
        const mockedValidateModEngineVersions = ModVersionValidatorModule.default; // Assuming it's the default export
        const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

        beforeEach(() => {
            jest.clearAllMocks(); // Reset mocks between tests

            // --- 1. Create Mocks ---
            mockRegistry = {
                store: jest.fn(),
                get: jest.fn(),
                getAll: jest.fn(() => []), // Default to empty for summary log if needed
                clear: jest.fn(),
                // Add other methods if they happen to be called, even if not expected
                getAllSystemRules: jest.fn(() => []),
                getManifest: jest.fn(() => null),
                setManifest: jest.fn(),
                getEntityDefinition: jest.fn(),
                getItemDefinition: jest.fn(),
                getLocationDefinition: jest.fn(),
                getConnectionDefinition: jest.fn(),
                getBlockerDefinition: jest.fn(),
                getActionDefinition: jest.fn(),
                getEventDefinition: jest.fn(),
                getComponentDefinition: jest.fn(),
                getAllEntityDefinitions: jest.fn(() => []),
                getAllItemDefinitions: jest.fn(() => []),
                getAllLocationDefinitions: jest.fn(() => []),
                getAllConnectionDefinitions: jest.fn(() => []),
                getAllBlockerDefinitions: jest.fn(() => []),
                getAllActionDefinitions: jest.fn(() => []),
                getAllEventDefinitions: jest.fn(() => []),
                getAllComponentDefinitions: jest.fn(() => []),
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
                // Add other methods if needed
                addSchema: jest.fn(),
                removeSchema: jest.fn(),
                getValidator: jest.fn(),
                validate: jest.fn(),
            };
            mockConfiguration = {
                getContentTypeSchemaId: jest.fn(),
                // Add other methods if needed
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
                name: 'Core Game Systems',
                gameVersion: '^1.0.0', // Example
                content: {
                    // List content for types we want to test loading for
                    actions: ['core/action_move.json', 'core/action_look.json'],
                    components: ['core/comp_position.json'],
                    // Intentionally omit some types (e.g., events, rules) to test skipping
                    entities: ['core/entity_player_base.json'],
                },
                // No dependencies or conflicts for this simple case
            };
            mockManifestMap = new Map();
            // Store with lowercase key as WorldLoader does internally for validation map
            mockManifestMap.set(coreModId.toLowerCase(), mockCoreManifest);

            // --- 3. Configure Mocks (Default Success Paths) ---
            mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

            // Configure IConfiguration to return IDs for essential schemas
            mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
                switch (typeName) {
                    case 'game': return 'schema:game';
                    case 'components': return 'schema:components';
                    case 'mod-manifest': return 'schema:mod-manifest';
                    case 'entities': return 'schema:entities';
                    default: return `schema:${typeName}`; // Return something for others if needed
                }
            });

            // Configure ISchemaValidator for essential schemas
            mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
                return ['schema:game', 'schema:components', 'schema:mod-manifest', 'schema:entities'].includes(schemaId);
            });

            // Configure GameConfigLoader
            mockGameConfigLoader.loadConfig.mockResolvedValue([coreModId]); // Only request 'core'

            // Configure ModManifestLoader
            mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);

            // Configure ModDependencyValidator (static mock) - Already mocked via jest.mock
            mockedModDependencyValidator.mockImplementation(() => { /* Assume success */ });

            // Configure validateModEngineVersions (mocked import) - Already mocked via jest.mock
            mockedValidateModEngineVersions.mockImplementation(() => { /* Assume success */ });

            // Configure resolveOrder (mocked import)
            // Important: It receives the lower-cased map from WorldLoader
            mockedResolveOrder.mockReturnValue([coreModId]); // Simplest order

            // Configure Registry.get to return the manifest when looked up during content loading
            // WorldLoader uses lower-case key here
            mockRegistry.get.mockImplementation((type, id) => {
                if (type === 'mod_manifests' && id === coreModId.toLowerCase()) {
                    return mockCoreManifest;
                }
                return undefined;
            });

            // Configure Content Loaders Mocks
            const setupContentLoaderMock = (loaderMock, typeName, count) => {
                loaderMock.loadItemsForMod.mockImplementation(async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
                    // Simulate successful load and storing items in registry
                    if (modIdArg.toLowerCase() === coreModId.toLowerCase() && typeNameArg === typeName) {
                        mockLogger.debug(`Mock ${typeName}Loader: Loading ${count} items for ${modIdArg}`);
                        for (let i = 0; i < count; i++) {
                            const itemId = `${modIdArg}:${typeName}_item_${i}`;
                            const itemData = { id: itemId, data: `mock ${typeName} data ${i}` };
                            mockRegistry.store(typeName, itemId, itemData); // Simulate storage
                        }
                        return count; // Return the count of loaded items
                    }
                    // Should not be called for other mods/types in this test
                    mockLogger.error(`Mock ${typeName}Loader unexpectedly called with:`, { modIdArg, typeNameArg });
                    throw new Error(`Mock ${typeName}Loader unexpectedly called`);
                });
            };

            // Setup mocks for the content types listed in mockCoreManifest
            setupContentLoaderMock(mockActionLoader, 'actions', 2);       // Matches manifest list length
            setupContentLoaderMock(mockComponentLoader, 'components', 1); // Matches manifest list length
            setupContentLoaderMock(mockEntityLoader, 'entities', 1);     // Matches manifest list length
            // Note: EventLoader and RuleLoader mocks exist but won't have loadItemsForMod called
            // because 'events' and 'rules' are not in mockCoreManifest.content

            // --- 4. Instantiate SUT ---
            worldLoader = new WorldLoader(
                mockRegistry,
                mockLogger,
                mockSchemaLoader,
                mockComponentLoader, // componentDefinitionLoader
                mockRuleLoader,
                mockActionLoader,
                mockEventLoader,
                mockEntityLoader,    // entityDefinitionLoader
                mockValidator,
                mockConfiguration,
                mockGameConfigLoader,
                mockModManifestLoader
            );
        });

        // ── Test Case: Basic Successful Load ───────────────────────────────────
        it('should successfully load world with only the "core" mod', async () => {
            // --- Action ---
            await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

            // --- Assertions ---

            // 1. Verify registry.clear was called once at the beginning.
            expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
            // Simple check: ensure it wasn't called again after the first call (more robust checks are complex with async)
            const clearCalls = mockRegistry.clear.mock.calls.length;


            // 2. Verify schemaLoader.loadAndCompileAllSchemas was called.
            expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

            // 3. Verify essential schema checks passed (mockValidator configured)
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:game');
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:components');
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:mod-manifest');
            expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:entities');

            // 4. Verify gameConfigLoader.loadConfig was called.
            expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

            // 5. Verify modManifestLoader.loadRequestedManifests was called with ['core'].
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(1);
            expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith([coreModId]);

            // 6. Verify registry.store was called to store the core manifest (check type, key, value)
            expect(mockRegistry.store).toHaveBeenCalledWith('mod_manifests', coreModId.toLowerCase(), mockCoreManifest);

            // 7. Verify ModDependencyValidator.validate was called with the manifest map.
            expect(mockedModDependencyValidator).toHaveBeenCalledTimes(1);
            // WorldLoader passes a map with lower-case keys to validate
            const expectedValidationMap = new Map();
            expectedValidationMap.set(coreModId.toLowerCase(), mockCoreManifest);
            expect(mockedModDependencyValidator).toHaveBeenCalledWith(expectedValidationMap, mockLogger);

            // 8. Verify validateModEngineVersions was called with the manifest map.
            expect(mockedValidateModEngineVersions).toHaveBeenCalledTimes(1);
            expect(mockedValidateModEngineVersions).toHaveBeenCalledWith(expectedValidationMap, mockLogger); // Uses same map

            // 9. Verify resolveOrder was called with ['core'], the manifest map, and the logger.
            expect(mockedResolveOrder).toHaveBeenCalledTimes(1);
            expect(mockedResolveOrder).toHaveBeenCalledWith([coreModId], expectedValidationMap, mockLogger); // Uses same map

            // 10. Verify registry.store was called to store meta.final_mod_order with the value ['core'].
            expect(mockRegistry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [coreModId]);

            // 11. Verify registry.get was called to retrieve the manifest during content loading
            expect(mockRegistry.get).toHaveBeenCalledWith('mod_manifests', coreModId.toLowerCase());

            // 12. Verify the relevant Content Loader loadItemsForMod methods were called.
            //    Check calls for types listed in the core manifest.
            expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
            expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
                coreModId, // Original case modId
                mockCoreManifest,
                'actions',       // contentKey
                'actions',       // contentTypeDir
                'actions'        // typeName
            );

            expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
            expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(
                coreModId,
                mockCoreManifest,
                'components',
                'components',
                'components'
            );

            expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
            // EntityLoader is called multiple times in config, but only 'entities' has content in manifest
            expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledWith(
                coreModId,
                mockCoreManifest,
                'entities',
                'entities',
                'entities'
            );
            // Check EntityLoader wasn't called for other types it handles but aren't in manifest
            expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
                expect.anything(), expect.anything(), 'blockers', expect.anything(), expect.anything()
            );
            expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
                expect.anything(), expect.anything(), 'connections', expect.anything(), expect.anything()
            );
            // ... etc for items, locations

            // Check loaders for types NOT listed in core manifest were NOT called
            expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
            expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
            // ... add checks for any other loaders if applicable

            // 13. Verify registry.store was called by the content loaders (check simulated calls).
            // Check based on the setupContentLoaderMock simulations
            expect(mockRegistry.store).toHaveBeenCalledWith('actions', 'core:actions_item_0', expect.any(Object));
            expect(mockRegistry.store).toHaveBeenCalledWith('actions', 'core:actions_item_1', expect.any(Object));
            expect(mockRegistry.store).toHaveBeenCalledWith('components', 'core:components_item_0', expect.any(Object));
            expect(mockRegistry.store).toHaveBeenCalledWith('entities', 'core:entities_item_0', expect.any(Object));
            // Ensure store wasn't called for types not loaded
            expect(mockRegistry.store).not.toHaveBeenCalledWith('events', expect.any(String), expect.any(Object));
            expect(mockRegistry.store).not.toHaveBeenCalledWith('rules', expect.any(String), expect.any(Object));

            // 14. Verify logger.info was called with the final load summary message.
            // Check key parts of the summary log
            const infoCalls = mockLogger.info.mock.calls;
            const summaryStart = infoCalls.findIndex(call => call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`));
            expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

            const summaryLines = infoCalls.slice(summaryStart).map(call => call[0]);

            expect(summaryLines).toEqual(expect.arrayContaining([
                expect.stringContaining(`WorldLoader Load Summary (World: '${worldName}')`),
                expect.stringContaining(`Requested Mods (raw): [${coreModId}]`),
                expect.stringContaining(`Final Load Order    : [${coreModId}]`),
                expect.stringContaining(`Content Loading Summary:`),
                // Check counts match mocked loader return values (sorted alphabetically)
                expect.stringMatching(/actions\s+: 2 loaded/),      // From mockActionLoader returning 2
                expect.stringMatching(/components\s+: 1 loaded/),   // From mockComponentLoader returning 1
                expect.stringMatching(/entities\s+: 1 loaded/),     // From mockEntityLoader returning 1
                expect.stringContaining('———————————————————————————————————————————')
            ]));
            // Ensure types not loaded aren't in the summary counts
            expect(summaryLines.some(line => /events\s+:/.test(line))).toBe(false);
            expect(summaryLines.some(line => /rules\s+:/.test(line))).toBe(false);


            // 15. Verify registry.clear was not called again after the initial call.
            expect(mockRegistry.clear).toHaveBeenCalledTimes(clearCalls); // Should still be 1

            // Optional: Check logger calls for specific phases if needed
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldLoader: Starting load sequence (World Hint: '${worldName}') …`);
            expect(mockLogger.info).toHaveBeenCalledWith(`Game config loaded. Requested mods: [${coreModId}]`);
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldLoader: Final mod order resolved: [${coreModId}]`);
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldLoader: Beginning content loading based on final order...`);
            expect(mockLogger.info).toHaveBeenCalledWith(`--- Loading content for mod: ${coreModId} ---`);
            expect(mockLogger.info).toHaveBeenCalledWith(`--- Finished loading content for mod: ${coreModId} ---`);
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldLoader: Completed content loading for all mods.`);
        });
    });