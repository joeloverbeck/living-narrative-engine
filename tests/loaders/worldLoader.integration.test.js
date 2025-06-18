// Filename: src/tests/loaders/worldLoader.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Dependencies to Mock ---
import ModDependencyValidator from '../../src/modding/modDependencyValidator.js';
import validateModEngineVersions from '../../src/modding/modVersionValidator.js';
import * as ModLoadOrderResolver from '../../src/modding/modLoadOrderResolver.js';
import { CORE_MOD_ID } from '../../src/constants/core';

jest.mock('../../src/modding/modDependencyValidator.js', () => ({
  validate: jest.fn(),
}));
jest.mock('../../src/modding/modVersionValidator.js', () => jest.fn());
jest.mock('../../src/modding/modLoadOrderResolver.js', () => ({
  resolveOrder: jest.fn(),
}));

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../src/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../src/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../src/loaders/macroLoader.js').default} MacroLoader */
/** @typedef {import('../../src/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../src/loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../src/loaders/entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

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
  /** @type {jest.Mocked<ConditionLoader>} */
  let mockConditionLoader;
  /** @type {jest.Mocked<ActionLoader>} */
  let mockActionLoader;
  /** @type {jest.Mocked<EventLoader>} */
  let mockEventLoader;
  /** @type {jest.Mocked<MacroLoader>} */
  let mockMacroLoader;
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
  let mockCoreManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const worldName = 'testWorldSimple';

  // --- Mocked Functions (from imports) ---
  const mockedModDependencyValidator = ModDependencyValidator.validate;
  const mockedValidateModEngineVersions = validateModEngineVersions;
  const mockedResolveOrder = ModLoadOrderResolver.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks between tests

    // --- 1. Create Mocks ---
    mockRegistry = {
      store: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(() => []),
      clear: jest.fn(),
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

    mockActionLoader = { loadItemsForMod: jest.fn() };
    mockComponentLoader = { loadItemsForMod: jest.fn() };
    mockEventLoader = { loadItemsForMod: jest.fn() };
    mockMacroLoader = { loadItemsForMod: jest.fn() };
    mockRuleLoader = { loadItemsForMod: jest.fn() };
    mockConditionLoader = { loadItemsForMod: jest.fn() };
    mockEntityLoader = { loadItemsForMod: jest.fn() };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // --- 2. Define Mock Data ---
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core Game Systems',
      gameVersion: '^1.0.0',
      content: {
        actions: ['core/action_move.json', 'core/action_look.json'],
        components: ['core/comp_position.json'],
        entityDefinitions: ['characters/core/entity_player_base.json'],
        macros: ['core/logSuccess.macro.json'],
      },
    };
    mockManifestMap = new Map();
    mockManifestMap.set(CORE_MOD_ID.toLowerCase(), mockCoreManifest);

    // --- 3. Configure Mocks (Default Success Paths) ---
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

    // Configure IConfiguration to return IDs for essential schemas
    mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
      // This mock correctly generates the IDs like 'schema:actions' via default
      switch (typeName) {
        case 'game':
          return 'schema:game';
        case 'components':
          return 'schema:components';
        case 'mod-manifest':
          return 'schema:mod-manifest';
        case 'entities':
          return 'schema:entityDefinitions';
        // Let others fall through to default
        default:
          return `schema:${typeName}`;
      }
    });

    // *** FIX: Configure ISchemaValidator to return TRUE for ALL essential schemas checked by WorldLoader ***
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      const essentialSchemas = [
        'schema:game',
        'schema:components',
        'schema:mod-manifest',
        'schema:entityDefinitions',
        'schema:actions', // <<< Required by WorldLoader
        'schema:events', // <<< Required by WorldLoader
        'schema:rules', // <<< Required by WorldLoader
        'schema:conditions', // <<< Newly required by WorldLoader
        'schema:entityInstances',
      ];
      const isLoaded = essentialSchemas.includes(schemaId);
      // Optional: Add logging here to see exactly which schemas are being checked
      // console.log(`mockValidator.isSchemaLoaded called with: ${schemaId}, returning: ${isLoaded}`);
      return isLoaded;
    });

    // Configure GameConfigLoader
    mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID]);

    // Configure ModManifestLoader
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );

    // Configure ModDependencyValidator
    mockedModDependencyValidator.mockImplementation(() => {});

    // Configure validateModEngineVersions
    mockedValidateModEngineVersions.mockImplementation(() => {});

    // Configure resolveOrder
    mockedResolveOrder.mockReturnValue([CORE_MOD_ID]);

    // Configure Registry.get for manifest lookup
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests' && id === CORE_MOD_ID.toLowerCase()) {
        return mockCoreManifest;
      }
      return undefined;
    });

    // Configure Content Loaders Mocks
    const setupContentLoaderMock = (loaderMock, typeName, count) => {
      loaderMock.loadItemsForMod.mockImplementation(
        async (
          modIdArg,
          manifestArg,
          contentKeyArg,
          contentTypeDirArg,
          typeNameArg
        ) => {
          if (
            modIdArg.toLowerCase() === CORE_MOD_ID.toLowerCase() &&
            typeNameArg === typeName
          ) {
            mockLogger.debug(
              `Mock ${typeName}Loader: Loading ${count} items for ${modIdArg}`
            );
            for (let i = 0; i < count; i++) {
              const itemId = `${modIdArg}:${typeName}_item_${i}`;
              const itemData = {
                id: itemId,
                data: `mock ${typeName} data ${i}`,
              };
              const storeType =
                typeName === 'entityDefinitions' ? 'entities' : typeName;
              mockRegistry.store(storeType, itemId, itemData);
            }
            // Simulate the expected return structure {count, overrides, errors}
            return { count: count, overrides: 0, errors: 0 };
          }
          mockLogger.error(`Mock ${typeName}Loader unexpectedly called with:`, {
            modIdArg,
            typeNameArg,
          });
          throw new Error(`Mock ${typeName}Loader unexpectedly called`);
        }
      );
    };

    setupContentLoaderMock(mockActionLoader, 'actions', 2);
    setupContentLoaderMock(mockComponentLoader, 'components', 1);
    setupContentLoaderMock(mockMacroLoader, 'macros', 2);
    setupContentLoaderMock(mockEntityLoader, 'entityDefinitions', 1);

    // --- 4. Instantiate SUT ---
    worldLoader = new WorldLoader({
      registry: mockRegistry,
      logger: mockLogger,
      schemaLoader: mockSchemaLoader,
      componentLoader: mockComponentLoader,
      conditionLoader: mockConditionLoader,
      macroLoader: mockMacroLoader,
      ruleLoader: mockRuleLoader,
      actionLoader: mockActionLoader,
      eventLoader: mockEventLoader,
      entityLoader: mockEntityLoader,
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      contentLoadersConfig: null,
    });
  });

  // ── Test Case: Basic Successful Load ───────────────────────────────────
  it('should successfully load world with only the core mod', async () => {
    // --- Action ---
    await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---

    // 1. Verify registry.clear was called once.
    expect(mockRegistry.clear).toHaveBeenCalledTimes(1);
    const clearCalls = mockRegistry.clear.mock.calls.length; // Store count for later check

    // 2. Verify schemaLoader.loadAndCompileAllSchemas was called.
    expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);

    // 3. *** FIX: Verify essential schema checks passed for ALL required schemas ***
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:game');
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:components'
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:mod-manifest'
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:entityDefinitions'
    );
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:actions'); // <<< Added check
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:events'); // <<< Added check
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith('schema:rules'); // <<< Added check
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:conditions'
    ); // <<< Added check
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      'schema:entityInstances'
    );

    // 4. Verify gameConfigLoader.loadConfig was called.
    expect(mockGameConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

    // 5. Verify modManifestLoader.loadRequestedManifests was called.
    expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(
      1
    );
    expect(mockModManifestLoader.loadRequestedManifests).toHaveBeenCalledWith([
      CORE_MOD_ID,
    ]);

    // 6. Verify registry.store was called for the core manifest.
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'mod_manifests',
      CORE_MOD_ID.toLowerCase(),
      mockCoreManifest
    );

    // 7. Verify ModDependencyValidator.validate was called.
    expect(mockedModDependencyValidator).toHaveBeenCalledTimes(1);
    const expectedValidationMap = new Map();
    expectedValidationMap.set(CORE_MOD_ID.toLowerCase(), mockCoreManifest);
    expect(mockedModDependencyValidator).toHaveBeenCalledWith(
      expectedValidationMap,
      mockLogger
    );

    // 8. Verify validateModEngineVersions was called.
    expect(mockedValidateModEngineVersions).toHaveBeenCalledTimes(1);
    expect(mockedValidateModEngineVersions).toHaveBeenCalledWith(
      expectedValidationMap,
      mockLogger,
      mockValidatedEventDispatcher
    );

    // 9. Verify resolveOrder was called.
    expect(mockedResolveOrder).toHaveBeenCalledTimes(1);
    expect(mockedResolveOrder).toHaveBeenCalledWith(
      [CORE_MOD_ID],
      expectedValidationMap,
      mockLogger
    );

    // 10. Verify registry.store was called for final mod order.
    expect(mockRegistry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [
      CORE_MOD_ID,
    ]);

    // 11. Verify Content Loader calls.
    expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'actions',
      'actions',
      'actions'
    );

    expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'components',
      'components',
      'components'
    );

    expect(mockMacroLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockMacroLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'macros',
      'macros',
      'macros'
    );

    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'entityDefinitions',
      'entities/definitions',
      'entityDefinitions'
    );

    // Check loaders for types NOT in manifest were NOT called
    expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockConditionLoader.loadItemsForMod).not.toHaveBeenCalled();
    // Check EntityDefinitionLoader wasn't called for other keys it handles but aren't in manifest
    expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'blockers',
      expect.anything(),
      expect.anything()
    );
    expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'connections',
      expect.anything(),
      expect.anything()
    );
    expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'items',
      expect.anything(),
      expect.anything()
    );
    expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'locations',
      expect.anything(),
      expect.anything()
    );

    // 13. Verify registry.store calls from content loaders.
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'actions',
      'core:actions_item_0',
      expect.any(Object)
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'actions',
      'core:actions_item_1',
      expect.any(Object)
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'components',
      'core:components_item_0',
      expect.any(Object)
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'entities',
      'core:entityDefinitions_item_0',
      expect.any(Object)
    );
    // Ensure store wasn't called for types not loaded
    expect(mockRegistry.store).not.toHaveBeenCalledWith(
      'events',
      expect.any(String),
      expect.any(Object)
    );
    expect(mockRegistry.store).not.toHaveBeenCalledWith(
      'rules',
      expect.any(String),
      expect.any(Object)
    );
    expect(mockRegistry.store).not.toHaveBeenCalledWith(
      'conditions',
      expect.any(String),
      expect.any(Object)
    );

    // 14. Verify final load summary log.
    const infoCalls = mockLogger.info.mock.calls;
    const summaryStart = infoCalls.findIndex((call) =>
      call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryStart).toBeGreaterThan(-1);

    const summaryLines = infoCalls.slice(summaryStart).map((call) => call[0]);

    // Verify key summary lines are present
    expect(
      summaryLines.some((l) =>
        l.includes(`WorldLoader Load Summary (World: '${worldName}')`)
      )
    ).toBe(true);
    expect(
      summaryLines.some((l) =>
        l.includes(`Requested Mods (raw): [${CORE_MOD_ID}]`)
      )
    ).toBe(true);
    expect(
      summaryLines.some((l) =>
        l.includes(`Final Load Order     : [${CORE_MOD_ID}]`)
      )
    ).toBe(true);
    expect(
      summaryLines.some((l) => l.includes(`Content Loading Summary (Totals):`))
    ).toBe(true);
    expect(summaryLines.some((l) => /actions\s+: C:2, O:0, E:0/.test(l))).toBe(
      true
    );
    expect(
      summaryLines.some((l) => /entityDefinitions\s+: C:1, O:0, E:0/.test(l))
    ).toBe(true);
    expect(
      summaryLines.some((l) => /components\s+: C:1, O:0, E:0/.test(l))
    ).toBe(true);
    expect(summaryLines.some((l) => /macros\s+: C:2, O:0, E:0/.test(l))).toBe(
      true
    );
    expect(
      summaryLines.some((l) =>
        l.includes('———————————————————————————————————————————')
      )
    ).toBe(true);
    // Ensure types not loaded aren't in the summary counts
    expect(summaryLines.some((line) => /events\s+:/.test(line))).toBe(false);
    expect(summaryLines.some((line) => /rules\s+:/.test(line))).toBe(false);
    expect(summaryLines.some((line) => /conditions\s+:/.test(line))).toBe(
      false
    );
    expect(summaryLines.some((line) => /entities\s+:/.test(line))).toBe(false); // old key should not be present

    // 15. Verify registry.clear was not called again.
    expect(mockRegistry.clear).toHaveBeenCalledTimes(clearCalls); // Still 1

    // Ensure failure events were not called
    expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:failed',
      expect.anything(),
      expect.anything()
    );
    expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:mod_load_failed',
      expect.anything(),
      expect.anything()
    );
    expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.anything(),
      expect.anything()
    );
  });
});
