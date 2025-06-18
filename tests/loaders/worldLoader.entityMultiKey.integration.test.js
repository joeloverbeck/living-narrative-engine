// Filename: src/tests/loaders/worldLoader.entityMultiKey.integration.test.js
// Sub-Ticket 11: Test - Verify EntityDefinitionLoader Multi-Key Handling

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
// Mocks will be injected via constructor

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../src/loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../src/loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../src/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../src/loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../src/loaders/entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('../../src/loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../../core/interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../../core/services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

describe('WorldLoader Integration Test Suite - EntityDefinitionLoader Multi-Key Handling (Sub-Ticket 11)', () => {
  /** @type {WorldLoader} */
  let worldLoader;

  // --- Mock Instances ---
  /** @type {jest.Mocked<IDataRegistry> & { _internalStore: Record<string, Record<string, any>> }} */
  let mockRegistry;
  /** @type {jest.Mocked<ILogger>} */
  let mockLogger;
  /** @type {jest.Mocked<SchemaLoader>} */
  let mockSchemaLoader;
  /** @type {jest.Mocked<ComponentLoader>} */
  let mockComponentLoader;
  /** @type {jest.Mocked<ConditionLoader>} */
  let mockConditionLoader;
  /** @type {jest.Mocked<RuleLoader>} */
  let mockRuleLoader;
  /** @type {jest.Mocked<ActionLoader>} */
  let mockActionLoader;
  /** @type {jest.Mocked<EventLoader>} */
  let mockEventLoader;
  /** @type {jest.Mocked<EntityLoader>} */
  let mockEntityLoader; // The primary focus of this test
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
  let mockTestManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const testModId = 'testMod';
  const worldName = 'entityTestWorld';
  const finalOrder = [testModId]; // Only one mod in this test

  // Mock content file data
  const locationData = {
    id: 'testMod:start_area',
    description: 'A grassy field.',
  };
  const itemData = { id: 'testMod:sword', damage: 10, type: 'weapon' };
  const characterData = {
    id: 'testMod:guard',
    health: 50,
    faction: 'town_guard',
  };

  // --- Mocked helper implementations ---
  const mockModDependencyValidator = { validate: jest.fn() };
  const mockModVersionValidator = jest.fn();
  const mockModLoadOrderResolver = { resolveOrder: jest.fn() };

  const mockedModDependencyValidator = mockModDependencyValidator.validate;
  const mockedValidateModEngineVersions = mockModVersionValidator;
  const mockedResolveOrder = mockModLoadOrderResolver.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks between tests
    mockModDependencyValidator.validate.mockReset();
    mockModVersionValidator.mockReset();
    mockModLoadOrderResolver.resolveOrder.mockReset();

    // --- 1. Create Mocks ---
    const internalStore = {}; // Internal store for registry simulation
    mockRegistry = {
      _internalStore: internalStore,
      store: jest.fn((type, id, data) => {
        if (!internalStore[type]) internalStore[type] = {};
        internalStore[type][id] = data;
        // console.log(`MockRegistry STORE: ${type} / ${id}`, data); // Debug log
      }),
      get: jest.fn((type, id) => {
        if (
          type === 'mod_manifests' &&
          id.toLowerCase() === testModId.toLowerCase()
        ) {
          return mockTestManifest;
        }
        const result = internalStore[type]?.[id];
        // console.log(`MockRegistry GET: ${type} / ${id}`, result); // Debug log
        return result;
      }),
      getAll: jest.fn((type) => {
        const items = Object.values(internalStore[type] || {});
        // console.log(`MockRegistry GETALL: ${type}`, items); // Debug log
        return items;
      }),
      clear: jest.fn(() => {
        Object.keys(internalStore).forEach((key) => delete internalStore[key]);
      }),
      // Add other methods with basic mocks
      getAllSystemRules: jest.fn(() => []),
      getManifest: jest.fn(),
      setManifest: jest.fn(),
      getEntityDefinition: jest.fn((id) => internalStore['entities']?.[id]),
      getItemDefinition: jest.fn((id) => internalStore['items']?.[id]), // Expected not to be used
      getLocationDefinition: jest.fn((id) => internalStore['locations']?.[id]), // Expected not to be used
      getConnectionDefinition: jest.fn(
        (id) => internalStore['connections']?.[id]
      ),
      getBlockerDefinition: jest.fn((id) => internalStore['blockers']?.[id]),
      getActionDefinition: jest.fn((id) => internalStore['actions']?.[id]),
      getEventDefinition: jest.fn((id) => internalStore['events']?.[id]),
      getComponentDefinition: jest.fn(
        (id) => internalStore['components']?.[id]
      ),
      getAllEntityDefinitions: jest.fn(() =>
        Object.values(internalStore['entities'] || {})
      ),
      getAllItemDefinitions: jest.fn(() =>
        Object.values(internalStore['items'] || {})
      ), // Expected empty
      getAllLocationDefinitions: jest.fn(() =>
        Object.values(internalStore['locations'] || {})
      ), // Expected empty
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
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    mockValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume essential schemas are loaded
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
      getValidator: jest.fn(),
      validate: jest.fn(),
    };
    mockConfiguration = {
      getContentTypeSchemaId: jest
        .fn()
        .mockImplementation((typeName) => `schema:${typeName}`),
      getBaseDataPath: jest.fn(() => './data'),
      getSchemaFiles: jest.fn(() => []),
      getSchemaBasePath: jest.fn(() => 'schemas'),
      getContentBasePath: jest.fn(() => 'content'),
      getGameConfigFilename: jest.fn(() => 'game.json'),
      getModsBasePath: jest.fn(() => 'mods'),
      getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
    };
    mockGameConfigLoader = { loadConfig: jest.fn() };
    mockModManifestLoader = { loadRequestedManifests: jest.fn() };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock irrelevant content loaders to return minimal success
    const mockLoadResult = { count: 0, overrides: 0, errors: 0 };
    mockActionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockComponentLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockConditionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockEventLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockRuleLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };

    // --- Mock EntityDefinitionLoader ---
    // This is the key mock. It simulates the behavior of EntityDefinitionLoader.
    // It needs to:
    // 1. Be called with the correct arguments from WorldLoader.
    // 2. Simulate storing the data under the 'entities' category in the mockRegistry.
    // 3. Return the expected LoadItemsResult structure.
    mockEntityLoader = {
      loadItemsForMod: jest
        .fn()
        .mockImplementation(
          async (
            modIdArg,
            manifestArg,
            contentKeyArg,
            contentTypeDirArg,
            typeNameArg
          ) => {
            if (
              typeNameArg === 'entityDefinitions' &&
              contentKeyArg === 'entityDefinitions'
            ) {
              const files = manifestArg.content.entityDefinitions;
              for (const file of files) {
                let dataToStore;
                if (file.includes('start_area')) {
                  dataToStore = locationData;
                } else if (file.includes('sword')) {
                  dataToStore = itemData;
                } else if (file.includes('guard')) {
                  dataToStore = characterData;
                } else {
                  continue;
                }
                const baseId = dataToStore.id.split(':')[1];
                const finalRegistryKey = `${modIdArg}:${baseId}`;
                const finalData = {
                  ...dataToStore,
                  id: finalRegistryKey,
                  modId: modIdArg,
                  _sourceFile: file,
                };
                mockRegistry.store('entities', finalRegistryKey, finalData);
                mockLogger.debug(
                  `Mock EntityLoader: Stored ${finalRegistryKey} for ${modIdArg}`
                );
              }
              return { count: files.length, overrides: 0, errors: 0 };
            }
            return { count: 0, overrides: 0, errors: 0 };
          }
        ),
    };

    // --- 2. Define Mock Data (Test Mod Manifest) ---
    mockTestManifest = {
      id: testModId,
      version: '1.0.0',
      name: 'Entity Multi-Key Test Mod',
      gameVersion: '^1.0.0',
      content: {
        entityDefinitions: [
          'locations/start_area.json',
          'items/sword.json',
          'characters/guard.json',
        ],
        // No other content types defined
      },
    };

    mockManifestMap = new Map();
    mockManifestMap.set(testModId, mockTestManifest); // Use original case key

    // --- 3. Configure Mocks ---
    mockGameConfigLoader.loadConfig.mockResolvedValue([testModId]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );
    mockedModDependencyValidator.mockImplementation(() => {
      /* Assume success */
    });
    mockedValidateModEngineVersions.mockImplementation(() => {
      /* Assume success */
    });
    mockedResolveOrder.mockReturnValue(finalOrder); // Return the single mod order

    // Ensure essential schemas are reported as loaded by the mock validator
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      const essentialSchemas = [
        'schema:game',
        'schema:components',
        'schema:mod-manifest',
        'schema:entityDefinitions', // Primary schema for EntityDefinitionLoader
        'schema:actions',
        'schema:events',
        'schema:rules',
        'schema:entityInstances',
        'schema:items', // Although stored under entities, check if WorldLoader looks for these
        'schema:locations',
        'schema:characters',
      ];
      // Also check for the types EntityDefinitionLoader handles if WorldLoader checks them individually (unlikely but safe)
      return (
        essentialSchemas.includes(schemaId) || schemaId.startsWith('schema:')
      ); // Allow any schema prefixed ID
    });

    // --- 4. Instantiate SUT ---
    worldLoader = new WorldLoader({
      registry: mockRegistry,
      logger: mockLogger,
      schemaLoader: mockSchemaLoader,
      componentLoader: mockComponentLoader,
      conditionLoader: mockConditionLoader,
      ruleLoader: mockRuleLoader,
      actionLoader: mockActionLoader,
      eventLoader: mockEventLoader,
      entityLoader: mockEntityLoader, // Pass the specific mock
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      modDependencyValidator: mockModDependencyValidator,
      modVersionValidator: mockModVersionValidator,
      modLoadOrderResolver: mockModLoadOrderResolver,
      contentLoadersConfig: null,
    });
  });

  // ── Test Case: Verify EntityDefinitionLoader Calls for Different Content Keys ──────
  it('should invoke EntityDefinitionLoader for locations, items, and characters and store results under entities', async () => {
    // --- Action ---
    await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---

    // 1. Verify EntityDefinitionLoader.loadItemsForMod invocation count
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(1);

    // 2. Verify EntityDefinitionLoader.loadItemsForMod arguments
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledWith(
      testModId,
      mockTestManifest,
      'entityDefinitions',
      'entities/definitions',
      'entityDefinitions'
    );

    // 3. Verify data is stored correctly in the 'entities' category
    const storedLocation = mockRegistry.get('entities', 'testMod:start_area');
    expect(storedLocation).toBeDefined();
    expect(storedLocation).toEqual({
      ...locationData,
      id: 'testMod:start_area', // Ensure final ID is stored
      modId: testModId,
      _sourceFile: 'locations/start_area.json',
    });

    const storedItem = mockRegistry.get('entities', 'testMod:sword');
    expect(storedItem).toBeDefined();
    expect(storedItem).toEqual({
      ...itemData,
      id: 'testMod:sword', // Ensure final ID is stored
      modId: testModId,
      _sourceFile: 'items/sword.json',
    });

    const storedCharacter = mockRegistry.get('entities', 'testMod:guard');
    expect(storedCharacter).toBeDefined();
    expect(storedCharacter).toEqual({
      ...characterData,
      id: 'testMod:guard', // Ensure final ID is stored
      modId: testModId,
      _sourceFile: 'characters/guard.json',
    });

    // 4. Verify other potential categories are empty (or don't exist in internal store)
    expect(mockRegistry.getAll('locations')).toEqual([]);
    expect(mockRegistry.getAll('items')).toEqual([]);
    expect(mockRegistry.getAll('characters')).toEqual([]);

    // 5. Verify other loaders were not called for this mod (since manifest only had entity types)
    expect(mockComponentLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockActionLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();

    // 6. Verify summary log includes entities counts (optional but good)
    const infoCalls = mockLogger.info.mock.calls;
    const summaryLine = infoCalls.find((call) =>
      call[0].includes('Content Loading Summary')
    );
    expect(summaryLine).toBeDefined();

    // Expect a line for entityDefinitions in the summary
    expect(
      infoCalls.some((call) =>
        /entityDefinitions\s+: C:3, O:0, E:0/.test(call[0])
      )
    ).toBe(true);
    // Verify the total count reflects the sum of these
    expect(
      infoCalls.some((call) => /TOTAL\s+: C:3, O:0, E:0/.test(call[0]))
    ).toBe(true);
  });
});
