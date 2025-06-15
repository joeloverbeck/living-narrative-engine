// Filename: tests/loaders/worldLoader.overrides.integration.test.js
// Sub-Ticket 8: Integration Test - Mod Overrides and Load Order

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../src/modding/modDependencyValidator.js';
jest.mock('../../src/modding/modDependencyValidator.js', () => ({
  validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../src/modding/modVersionValidator.js';
jest.mock('../../src/modding/modVersionValidator.js', () => jest.fn()); // Mock the default export function

import * as ModLoadOrderResolverModule from '../../src/modding/modLoadOrderResolver.js';
import { CORE_MOD_ID } from '../../src/constants/core';
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
/** @typedef {import('../../src/loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../src/loaders/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

describe('WorldLoader Integration Test Suite - Mod Overrides and Load Order (Sub-Ticket 8)', () => {
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
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockFooManifest;
  /** @type {ModManifest} */
  let mockBarManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const fooModId = 'foo';
  const barModId = 'bar';
  const worldName = 'overrideTestWorld';
  const finalOrder = [CORE_MOD_ID, fooModId, barModId];
  const baseItemId = 'potion'; // The base ID used in the JSON files

  // --- Mocked Functions (from imports) ---
  const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
  const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
  const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks between tests

    // --- 1. Create Mocks ---
    // Create a mock registry with an internal store to track stored items
    const internalStore = {};
    mockRegistry = {
      _internalStore: internalStore,
      store: jest.fn((type, id, data) => {
        if (!internalStore[type]) internalStore[type] = {};
        internalStore[type][id] = JSON.parse(JSON.stringify(data)); // Store a copy
        // console.log(`MockRegistry STORE: ${type} / ${id}`, data); // Debug log
      }),
      get: jest.fn((type, id) => {
        // Handle manifest lookups (lowercase keys used by WorldLoader for get)
        if (type === 'mod_manifests') {
          const lcId = id.toLowerCase(); // Ensure lookup is case-insensitive
          if (lcId === CORE_MOD_ID) return mockCoreManifest;
          if (lcId === fooModId) return mockFooManifest;
          if (lcId === barModId) return mockBarManifest;
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
        // console.log(`MockRegistry CLEARED`); // Debug log
      }),
      // Add other methods with basic mocks
      getAllSystemRules: jest.fn(() => []),
      getManifest: jest.fn((id) => {
        // Make getManifest use the internal store for consistency
        const lcId = id.toLowerCase();
        if (lcId === CORE_MOD_ID) return mockCoreManifest;
        if (lcId === fooModId) return mockFooManifest;
        if (lcId === barModId) return mockBarManifest;
        return null;
      }),
      setManifest: jest.fn((id, manifest) => {
        // Make setManifest consistent
        if (!internalStore['mod_manifests'])
          internalStore['mod_manifests'] = {};
        internalStore['mod_manifests'][id.toLowerCase()] = manifest;
      }),
      getEntityDefinition: jest.fn((id) => internalStore['entities']?.[id]), // Used for asserting final state
      getItemDefinition: jest.fn((id) => internalStore['items']?.[id]),
      getLocationDefinition: jest.fn((id) => internalStore['locations']?.[id]),
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
      ),
      getAllLocationDefinitions: jest.fn(() =>
        Object.values(internalStore['locations'] || {})
      ),
      getAllConnectionDefinitions: jest.fn(() =>
        Object.values(internalStore['connections'] || {})
      ),
      getAllBlockerDefinitions: jest.fn(() =>
        Object.values(internalStore['blockers'] || {})
      ),
      getAllActionDefinitions: jest.fn(() =>
        Object.values(internalStore['actions'] || {})
      ),
      getAllEventDefinitions: jest.fn(() =>
        Object.values(internalStore['events'] || {})
      ),
      getAllComponentDefinitions: jest.fn(() =>
        Object.values(internalStore['components'] || {})
      ),
      getStartingPlayerId: jest.fn(() => null),
      getStartingLocationId: jest.fn(() => null),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockSchemaLoader = { loadAndCompileAllSchemas: jest.fn() };
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
    mockGameConfigLoader = { loadConfig: jest.fn() };
    mockModManifestLoader = { loadRequestedManifests: jest.fn() };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock individual content loaders (only EntityLoader is relevant here)
    mockActionLoader = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    mockComponentLoader = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    mockEventLoader = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    mockRuleLoader = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    };
    mockEntityLoader = { loadItemsForMod: jest.fn() }; // Configured below

    // --- 2. Define Mock Data ---
    const itemFilename = 'items/potion.json';
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      content: { items: [itemFilename] },
    };
    mockFooManifest = {
      id: fooModId,
      version: '1.0.0',
      name: 'Foo Mod',
      gameVersion: '^1.0.0',
      content: { items: [itemFilename] },
    };
    mockBarManifest = {
      id: barModId,
      version: '1.0.0',
      name: 'Bar Mod',
      gameVersion: '^1.0.0',
      content: { items: [itemFilename] },
    };

    mockManifestMap = new Map();
    // Store with original case keys (as returned by ModManifestLoader)
    mockManifestMap.set(CORE_MOD_ID, mockCoreManifest);
    mockManifestMap.set(fooModId, mockFooManifest);
    mockManifestMap.set(barModId, mockBarManifest);

    // --- 3. Configure Mocks ---
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (typeName) => `schema:${typeName}`
    );
    // Assume essential schemas are loaded
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      const essentials = [
        'schema:game',
        'schema:components',
        'schema:mod-manifest',
        'schema:entities',
        'schema:actions',
        'schema:events',
        'schema:rules',
      ];
      return essentials.includes(schemaId);
    });

    // GameConfigLoader - Request all three mods
    mockGameConfigLoader.loadConfig.mockResolvedValue([
      CORE_MOD_ID,
      fooModId,
      barModId,
    ]);

    // ModManifestLoader - Return all three manifests
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );

    // Static/Imported Mocks (assume success, define load order)
    mockedModDependencyValidator.mockImplementation(() => {
      /* Assume success */
    });
    mockedValidateModEngineVersions.mockImplementation(() => {
      /* Assume success */
    });
    mockedResolveOrder.mockReturnValue(finalOrder); // IMPORTANT: Return the desired load order

    // Configure EntityLoader mock to simulate storage behavior
    // It should call registry.store with the correct prefixed ID and data based on the mod being processed.
    mockEntityLoader.loadItemsForMod.mockImplementation(
      async (
        modIdArg,
        manifestArg,
        contentKeyArg,
        contentTypeDirArg,
        typeNameArg
      ) => {
        if (typeNameArg === 'items' && contentKeyArg === 'items') {
          // Determine which data to "load" and store based on the modId
          let itemData;
          if (modIdArg === CORE_MOD_ID) {
            itemData = {
              id: `${CORE_MOD_ID}:${baseItemId}`,
              description: 'Core potion effect',
              value: 10,
            };
          } else if (modIdArg === fooModId) {
            itemData = {
              id: `${fooModId}:${baseItemId}`,
              description: 'Foo potion effect (override)',
              value: 20,
            };
          } else if (modIdArg === barModId) {
            itemData = {
              id: `${barModId}:${baseItemId}`,
              description: 'Bar potion effect (final override)',
              value: 30,
            };
          } else {
            // Should not happen in this test
            return { count: 0, overrides: 0, errors: 0 };
          }

          // Simulate the BaseManifestItemLoader's _storeItemInRegistry call
          const finalRegistryKey = `${modIdArg}:${baseItemId}`;
          const dataToStore = {
            ...itemData, // Spread the mock data
            id: finalRegistryKey, // Ensure the stored ID is the prefixed one
            modId: modIdArg,
            _sourceFile: itemFilename, // Add source file meta
          };
          mockRegistry.store('entities', finalRegistryKey, dataToStore);
          // Assume no overwrites within the same loader call for this test
          return { count: 1, overrides: 0, errors: 0 };
        }
        // If called for other types (locations, etc.), return 0
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    // --- 4. Instantiate SUT ---
    worldLoader = new WorldLoader({
      registry: mockRegistry,
      logger: mockLogger,
      schemaLoader: mockSchemaLoader,
      componentLoader: mockComponentLoader,
      ruleLoader: mockRuleLoader,
      actionLoader: mockActionLoader,
      eventLoader: mockEventLoader,
      entityLoader: mockEntityLoader, // Pass the mocked EntityLoader
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  // ── Test Case: Mod Overrides and Load Order ────────────────────────────
  it('should load content respecting finalOrder and handle overrides correctly', async () => {
    // --- Action ---
    await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---

    // 1. Verify correct finalOrder was determined and stored
    expect(mockedResolveOrder).toHaveBeenCalled();
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      finalOrder
    );

    // 2. Verify EntityLoader.loadItemsForMod was called sequentially for each mod in finalOrder
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(3);
    // Check calls with correct arguments in the expected order
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(
      1,
      CORE_MOD_ID,
      mockCoreManifest,
      'items',
      'items',
      'items'
    );
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(
      2,
      fooModId,
      mockFooManifest,
      'items',
      'items',
      'items'
    );
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(
      3,
      barModId,
      mockBarManifest,
      'items',
      'items',
      'items'
    );

    // 3. Verify Registry Storage - check that store was called with the correct prefixed keys and data
    // Core's Potion
    const corePotionStoredData = {
      id: `${CORE_MOD_ID}:${baseItemId}`,
      description: 'Core potion effect',
      value: 10,
      modId: CORE_MOD_ID,
      _sourceFile: 'items/potion.json',
    };
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'entities',
      `${CORE_MOD_ID}:${baseItemId}`,
      corePotionStoredData
    );

    // Foo's Potion
    const fooPotionStoredData = {
      id: `${fooModId}:${baseItemId}`,
      description: 'Foo potion effect (override)',
      value: 20,
      modId: fooModId,
      _sourceFile: 'items/potion.json',
    };
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'entities',
      `${fooModId}:${baseItemId}`,
      fooPotionStoredData
    );

    // Bar's Potion
    const barPotionStoredData = {
      id: `${barModId}:${baseItemId}`,
      description: 'Bar potion effect (final override)',
      value: 30,
      modId: barModId,
      _sourceFile: 'items/potion.json',
    };
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'entities',
      `${barModId}:${baseItemId}`,
      barPotionStoredData
    );

    // 4. Verify Final Registry State - check that get returns the correct data for each prefixed ID
    // Core Potion
    const corePotionFinal = mockRegistry.get(
      'entities',
      `${CORE_MOD_ID}:${baseItemId}`
    );
    expect(corePotionFinal).toBeDefined();
    expect(corePotionFinal).toEqual(corePotionStoredData); // Compare with the data that should have been stored

    // Foo Potion
    const fooPotionFinal = mockRegistry.get(
      'entities',
      `${fooModId}:${baseItemId}`
    );
    expect(fooPotionFinal).toBeDefined();
    expect(fooPotionFinal).toEqual(fooPotionStoredData);

    // Bar Potion
    const barPotionFinal = mockRegistry.get(
      'entities',
      `${barModId}:${baseItemId}`
    );
    expect(barPotionFinal).toBeDefined();
    expect(barPotionFinal).toEqual(barPotionStoredData);

    // 5. (Optional/Clarification) Verify effective definition selection
    // This test focuses on the loader ensuring all versions are *loaded* correctly.
    // A higher-level system would be responsible for resolving "potion" to "bar:potion".
    // This test confirms the necessary data (`bar:potion`'s definition) is present.
    // We can simulate this by checking if the last loaded item (`bar:potion`) exists.
    expect(barPotionFinal).toBeDefined();
    expect(barPotionFinal.description).toContain('Bar potion effect');

    // 6. Verify Summary Log reflects loading items (EntityLoader covers 'items')
    const infoCalls = mockLogger.info.mock.calls;
    const summaryStart = infoCalls.findIndex((call) =>
      call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryStart).toBeGreaterThan(-1); // Summary block should exist

    const summaryLines = infoCalls.slice(summaryStart).map((call) => call[0]);
    expect(summaryLines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/items\s+: C:3, O:0, E:0/), // 3 items loaded (1 per mod)
        expect.stringMatching(/TOTAL\s+: C:3, O:0, E:0/), // Grand Total
      ])
    );

    // 7. Verify Event Dispatcher calls
    expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.anything(),
      expect.anything()
    );
  });
});
