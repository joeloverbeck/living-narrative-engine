// Filename: src/tests/loaders/worldLoader.timingLogs.integration.test.js
// Sub-Ticket 9: Test - Verify Performance Timing Logs

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

describe('WorldLoader Integration Test Suite - Performance Timing Logs (Sub-Ticket 9)', () => {
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
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockFooManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const fooModId = 'foo';
  const worldName = 'timingTestWorld';
  const finalOrder = [CORE_MOD_ID, fooModId];

  // --- Mocked Functions (from imports) ---
  const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
  const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
  const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks(); // Reset mocks between tests

    // --- 1. Create Mocks ---
    // Use a simple object for registry; complex interactions aren't the focus here
    mockRegistry = {
      store: jest.fn(),
      get: jest.fn((type, id) => {
        // Handle manifest lookups required by WorldLoader's loop
        if (type === 'mod_manifests') {
          const lcId = id.toLowerCase();
          if (lcId === CORE_MOD_ID) return mockCoreManifest;
          if (lcId === fooModId) return mockFooManifest;
        }
        return null; // Default get response
      }),
      getAll: jest.fn(() => []),
      clear: jest.fn(),
      // Add other methods with basic mocks if needed by WorldLoader construction/logic
      getAllSystemRules: jest.fn(() => []),
      getManifest: jest.fn(),
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
      info: jest.fn(), // Spy on info calls to check timing logs
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    mockValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true), // Assume all essential schemas are loaded
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

    // Mock individual content loaders to return minimal success results
    // This ensures the timing logic inside WorldLoader runs for each mod/type
    const mockLoadResult = { count: 1, overrides: 0, errors: 0 };
    mockActionLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockComponentLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockEventLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockRuleLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };
    mockEntityLoader = {
      loadItemsForMod: jest.fn().mockResolvedValue(mockLoadResult),
    };

    // --- 2. Define Mock Data ---
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      // Define some content to ensure loaders are called
      content: { components: ['core_comp.json'] },
    };
    mockFooManifest = {
      id: fooModId,
      version: '1.0.0',
      name: 'Foo Mod',
      gameVersion: '^1.0.0',
      // Define some content for foo mod
      content: { items: ['foo_item.json'] },
    };

    mockManifestMap = new Map();
    mockManifestMap.set(CORE_MOD_ID, mockCoreManifest); // Use original case keys
    mockManifestMap.set(fooModId, mockFooManifest);

    // --- 3. Configure Mocks ---
    // GameConfigLoader - Request the two mods
    mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID, fooModId]);

    // ModManifestLoader - Return the manifests
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
    mockedResolveOrder.mockReturnValue(finalOrder); // Return the desired load order

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
  });

  // ── Test Case: Verify Per-Mod Timing Logs ───────────────────────────────
  it('should log per-mod performance timing information at DEBUG level', async () => {
    // --- Action ---
    await expect(worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---
    const debugCalls = mockLogger.debug.mock.calls;
    const infoCalls = mockLogger.info.mock.calls;

    // Verify logs for each mod in the final order
    for (const modId of finalOrder) {
      // Example expected log format: Mod CORE_MOD_ID loaded in 12.34ms: components(1) -> Overrides(0), Errors(0)
      const expectedLogRegex = new RegExp(
        `^Mod '${modId}' loaded in (\\d+\\.\\d{2})ms:`
      ); // Regex to capture duration

      // Find the specific log message for this mod
      const timingLogCall = debugCalls.find((call) =>
        expectedLogRegex.test(call[0])
      );

      // 1. Assert that a log message matching the format was captured for this mod
      expect(timingLogCall).toBeDefined(); // Ensures the log exists
      expect(timingLogCall[0]).toMatch(expectedLogRegex); // Matches the expected pattern

      // 2. Assert that the duration is included and positive
      if (timingLogCall) {
        const match = timingLogCall[0].match(expectedLogRegex);
        expect(match).toBeTruthy(); // Match should be found if timingLogCall exists

        if (match && match[1]) {
          const durationMs = parseFloat(match[1]);
          expect(durationMs).toBeGreaterThan(0); // Duration should be a positive number
          expect(durationMs).toBeLessThan(10000); // Sanity check: duration should be reasonable (e.g., < 10 seconds)
          // Debug log to see the captured duration
          // console.log(`[${modId}] Captured duration: ${durationMs}ms`);
        } else {
          // This should not happen if the regex matched, but acts as a fallback assertion
          throw new Error(
            `Could not extract duration from log message for mod '${modId}': ${timingLogCall[0]}`
          );
        }
      }

      // 3. Assert log level is DEBUG (implicitly checked by searching mockLogger.debug.mock.calls)
      // If the log wasn't found in infoCalls, the expect(timingLogCall).toBeDefined() would fail.
    }

    // Verify loaders were called (sanity check that the timed operation happened)
    // Core mod has components
    expect(mockComponentLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'components',
      'components',
      'components'
    );
    // Foo mod has items (handled by EntityLoader)
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledWith(
      fooModId,
      mockFooManifest,
      'items',
      'items',
      'items'
    );

    // Ensure the final summary block is also logged
    const summaryLogExists = infoCalls.some((call) =>
      call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryLogExists).toBe(true);
  });
});
