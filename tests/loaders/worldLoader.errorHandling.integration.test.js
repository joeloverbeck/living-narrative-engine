// Filename: src/tests/loaders/worldLoader.errorHandling.integration.test.js

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
/** @typedef {import('../../interfaces/manifestItems.js').ModManifest} ModManifest */

// Filename: src/tests/integration/worldLoader.errorHandling.integration.test.js

// ... (imports remain the same) ...

describe('WorldLoader Integration Test Suite - Error Handling (TEST-LOADER-7.4)', () => {
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
  /** @type {jest.Mocked<import('../../services/validatedEventDispatcher.js').default>} */
  let mockValidatedEventDispatcher;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockBadModManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const badModId = 'badMod';
  const worldName = 'testWorldContentError';
  const simulatedErrorMessage = 'Simulated validation/parsing failure';

  // --- Mocked Functions (from imports) ---
  const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
  const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
  const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks between tests

    // --- 1. Create Mocks ---
    // Create a mock registry with an internal store
    const internalStore = {};
    mockRegistry = {
      _internalStore: internalStore,
      store: jest.fn((type, id, data) => {
        if (!internalStore[type]) internalStore[type] = {};
        internalStore[type][id] = data;
      }),
      get: jest.fn((type, id) => {
        if (type === 'mod_manifests') {
          if (id === CORE_MOD_ID.toLowerCase()) return mockCoreManifest;
          if (id === badModId.toLowerCase()) return mockBadModManifest;
        }
        return internalStore[type]?.[id];
      }),
      getAll: jest.fn((type) => Object.values(internalStore[type] || {})),
      clear: jest.fn(() => {
        Object.keys(internalStore).forEach((key) => delete internalStore[key]);
      }),
      // Add other methods with basic mocks
      getAllSystemRules: jest.fn(() => []),
      getManifest: jest.fn(() => null),
      setManifest: jest.fn(),
      getEntityDefinition: jest.fn((id) => internalStore['entities']?.[id]),
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
      isSchemaLoaded: jest.fn(), // Will be configured below
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
      getWorldBasePath: jest.fn(() => 'worlds'),
      getGameConfigFilename: jest.fn(() => 'game.json'),
      getModsBasePath: jest.fn(() => 'mods'),
      getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
    };
    mockGameConfigLoader = { loadConfig: jest.fn() };
    mockModManifestLoader = { loadRequestedManifests: jest.fn() };

    // Mock individual content loaders
    mockActionLoader = { loadItemsForMod: jest.fn() };
    mockComponentLoader = { loadItemsForMod: jest.fn() }; // This will throw for badMod
    mockEventLoader = { loadItemsForMod: jest.fn() };
    mockRuleLoader = { loadItemsForMod: jest.fn() };
    mockEntityLoader = { loadItemsForMod: jest.fn() };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // --- 2. Define Mock Data (as per TEST-LOADER-7.4) ---
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      content: { actions: ['core_action.json'] },
    };
    mockBadModManifest = {
      id: badModId,
      version: '1.0.0',
      name: 'Bad Mod',
      gameVersion: '^1.0.0',
      content: { components: ['bad_comp.json'], rules: ['good_rule.json'] },
    };

    mockManifestMap = new Map();
    mockManifestMap.set(CORE_MOD_ID, mockCoreManifest);
    mockManifestMap.set(badModId, mockBadModManifest);

    // --- 3. Configure Mocks ---
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (typeName) => `schema:${typeName}`
    );

    // ******** FIX: Ensure ALL essential schemas are reported as loaded ********
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      // Assume ALL essential schemas checked by WorldLoader ARE loaded
      const essentialSchemaIds = [
        'schema:game',
        'schema:components',
        'schema:mod-manifest',
        'schema:entities',
        'schema:actions', // <-- WAS MISSING
        'schema:events', // <-- WAS MISSING
        'schema:rules', // <-- WAS MISSING
      ];
      // You might want to dynamically get these from mockConfiguration if needed,
      // but hardcoding based on WorldLoader's current `essentials` list is fine for the test.
      const isEssential = essentialSchemaIds.includes(schemaId);
      // console.log(`mockValidator.isSchemaLoaded called for ${schemaId}, returning ${isEssential}`); // Optional debug log
      return isEssential;
    });
    // **************************************************************************

    mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID, badModId]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );

    // Static/Imported Mocks (assume success)
    mockedModDependencyValidator.mockImplementation(() => {
      /* Assume success */
    });
    mockedValidateModEngineVersions.mockImplementation(() => {
      /* Assume success */
    });
    mockedResolveOrder.mockReturnValue([CORE_MOD_ID, badModId]); // Define load order

    // --- Configure Content Loader Mocks (Specific behaviors) ---
    mockActionLoader.loadItemsForMod.mockImplementation(
      async (
        modIdArg,
        manifestArg,
        contentKeyArg,
        contentTypeDirArg,
        typeNameArg
      ) => {
        if (modIdArg === CORE_MOD_ID && typeNameArg === 'actions') {
          const itemId = `${CORE_MOD_ID}:action1`;
          const itemData = { id: itemId, value: 'core_action_data' };
          mockRegistry.store('actions', itemId, itemData);
          mockLogger.debug(
            `Mock ActionLoader: Stored ${itemId} for ${modIdArg}`
          );
          // Return structure matching LoadItemsResult for aggregation
          return { count: 1, overrides: 0, errors: 0 };
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    // ComponentLoader: THROWS for badMod
    mockComponentLoader.loadItemsForMod.mockImplementation(
      async (
        modIdArg,
        manifestArg,
        contentKeyArg,
        contentTypeDirArg,
        typeNameArg
      ) => {
        if (modIdArg === badModId && typeNameArg === 'components') {
          mockLogger.debug(
            `Mock ComponentLoader: Simulating error for ${modIdArg}/${typeNameArg}`
          );
          throw new Error(simulatedErrorMessage); // Simulate the error
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    // RuleLoader: Succeeds for badMod
    mockRuleLoader.loadItemsForMod.mockImplementation(
      async (
        modIdArg,
        manifestArg,
        contentKeyArg,
        contentTypeDirArg,
        typeNameArg
      ) => {
        if (modIdArg === badModId && typeNameArg === 'rules') {
          const itemId = `${badModId}:rule1`;
          const itemData = { id: itemId, value: 'badMod_rule_data' };
          mockRegistry.store('rules', itemId, itemData);
          mockLogger.debug(`Mock RuleLoader: Stored ${itemId} for ${modIdArg}`);
          // Return structure matching LoadItemsResult for aggregation
          return { count: 1, overrides: 0, errors: 0 };
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    // Other loaders are mocked but won't be called based on manifests
    mockEventLoader.loadItemsForMod.mockResolvedValue({
      count: 0,
      overrides: 0,
      errors: 0,
    });
    mockEntityLoader.loadItemsForMod.mockResolvedValue({
      count: 0,
      overrides: 0,
      errors: 0,
    });

    // --- 4. Instantiate SUT ---
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
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  }); // End beforeEach

  // ── Test Case: Content Loading Error Handling ─────────────────────────
  // ── Test Case: Content Loading Error Handling ─────────────────────────
  it('should log error and continue loading other content when a content file fails validation/parsing', async () => {
    // --- Action ---
    await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---

    // Verify loadWorld resolves successfully (covered by expect(...).resolves)

    // Verify logger.error was called with details about the failure
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    // ******** FIX: Update assertion to match actual log call ********
    expect(mockLogger.error).toHaveBeenCalledWith(
      // Match the actual log format from WorldLoader.js
      `WorldLoader [${badModId}]: Error loading content type '${'components'}'. Continuing...`, // <-- Added "content type"
      expect.objectContaining({
        // Check context object structure
        modId: badModId,
        typeName: 'components', // <-- Changed key from contentType to typeName
        error: simulatedErrorMessage,
      }),
      expect.any(Error) // Check the third argument is an Error instance
    );
    // ***************************************************************
    // More detailed check on the error argument if needed (remains the same)
    const errorCallArgs = mockLogger.error.mock.calls[0];
    expect(errorCallArgs[2]).toBeInstanceOf(Error);
    expect(errorCallArgs[2].message).toBe(simulatedErrorMessage);

    expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'actions',
      'actions',
      'actions'
    );
    expect(mockRegistry.get('actions', `${CORE_MOD_ID}:action1`)).toBeDefined();

    // Verify componentLoader.loadItemsForMod (for badMod) was called (and threw internally)
    expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(
      badModId,
      mockBadModManifest,
      'components',
      'components',
      'components'
    );
    expect(mockRegistry.getAll('components')).toEqual([]); // Verify no component was stored

    // Verify ruleLoader.loadItemsForMod (for badMod) was still called and completed successfully AFTER the component loader failed
    expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockRuleLoader.loadItemsForMod).toHaveBeenCalledWith(
      badModId,
      mockBadModManifest,
      'rules',
      'rules',
      'rules'
    );
    expect(mockRegistry.get('rules', `${badModId}:rule1`)).toBeDefined();

    // Verify the registry contains core:action1
    const coreAction = mockRegistry.get('actions', `${CORE_MOD_ID}:action1`);
    expect(coreAction).toEqual({
      id: 'core:action1',
      value: 'core_action_data',
    });

    // Verify the registry contains badMod:rule1
    const badModRule = mockRegistry.get('rules', `${badModId}:rule1`);
    expect(badModRule).toEqual({
      id: 'badMod:rule1',
      value: 'badMod_rule_data',
    });

    // Verify the registry does not contain the component from bad_comp.json (re-check getAll)
    expect(mockRegistry.getAll('components').length).toBe(0);

    // Verify the summary log (logger.info) reflects the counts ONLY for the successfully loaded items and includes errors
    // (Assertions for summary log from previous correction should still be valid as they use totalCounts based on typeName)
    const infoCalls = mockLogger.info.mock.calls;
    const summaryStart = infoCalls.findIndex((call) =>
      call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryStart).toBeGreaterThan(-1);
    const summaryLines = infoCalls.slice(summaryStart).map((call) => call[0]);
    expect(summaryLines).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `WorldLoader Load Summary (World: '${worldName}')`
        ),
        expect.stringContaining(
          `Requested Mods (raw): [${CORE_MOD_ID}, ${badModId}]`
        ),
        expect.stringContaining(
          `Final Load Order    : [${CORE_MOD_ID}, ${badModId}]`
        ),
        expect.stringContaining(`Content Loading Summary (Totals):`),
        expect.stringMatching(/actions\s+: C:1, O:0, E:0/),
        expect.stringMatching(/components\s+: C:0, O:0, E:1/),
        expect.stringMatching(/rules\s+: C:1, O:0, E:0/),
        expect.stringMatching(/TOTAL\s+: C:2, O:0, E:1/),
        expect.stringContaining('———————————————————————————————————————————'),
      ])
    );
    expect(summaryLines.some((line) => /events\s+:/.test(line))).toBe(false); // Ensure others are not present

    // Verify registry.clear was called only once at the beginning
    expect(mockRegistry.clear).toHaveBeenCalledTimes(1);

    // Verify logger.info was called for starting/finishing the load for badMod, despite the error
    // (Assertions for mod start/finish/summary from previous correction should still be valid)
    expect(mockLogger.info).toHaveBeenCalledWith(
      `--- Loading content for mod: ${badModId} ---`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `Mod '${badModId}' loaded in .*ms: rules\\(1\\) -> Overrides\\(0\\), Errors\\(1\\)`
        )
      )
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `--- Finished loading content for mod: ${badModId} ---`
    );

    // ******** FIX: Update assertion for content_load_failed event ********
    expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.objectContaining({
        modId: badModId,
        typeName: 'components', // <-- Changed key from contentType to typeName
        error: simulatedErrorMessage,
      }),
      expect.any(Object)
    );
    // *******************************************************************

    // Ensure failure event was NOT called
    expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalledWith(
      'initialization:world_loader:failed',
      expect.anything(),
      expect.anything()
    );
  }); // End it block
});
