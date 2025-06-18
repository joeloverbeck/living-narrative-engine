// Filename: tests/loaders/worldLoader.preLoopErrors.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Dependencies to Mock/Import ---
import ModDependencyError from '../../src/errors/modDependencyError.js';
import WorldLoaderError from '../../src/errors/worldLoaderError.js';

// --- Mock Modules BEFORE they are potentially imported by SUT or other imports ---
jest.mock('../../src/modding/modDependencyValidator.js', () => ({
  validate: jest.fn(),
}));
import * as ModDependencyValidatorModule from '../../src/modding/modDependencyValidator.js';

jest.mock('../../src/modding/modVersionValidator.js', () => jest.fn());
import mockValidateModEngineVersions from '../../src/modding/modVersionValidator.js';

jest.mock('../../src/modding/modLoadOrderResolver.js', () => ({
  resolveOrder: jest.fn(),
}));
import * as ModLoadOrderResolverModule from '../../src/modding/modLoadOrderResolver.js';
import { CORE_MOD_ID } from '../../src/constants/core';

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
/** @typedef {import('../../src/loaders/entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('../../src/loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../src/events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

describe('WorldLoader Integration Test Suite - Error Handling: Manifest Schema, Cycles, Missing Essentials (TEST-LOADER-7.6)', () => {
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
  /** @type {jest.Mocked<ConditionLoader>} */
  let mockConditionLoader;
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
  let coreManifest;
  /** @type {ModManifest} */
  let modAManifest;
  /** @type {ModManifest} */
  let modBManifest;
  /** @type {Map<string, ModManifest>} */
  let mockManifestMap;
  const modAId = 'modA';
  const modBId = 'modB';
  const worldName = 'testWorldPreLoopError';
  const gameSchemaId = 'schema:game';
  const componentSchemaId = 'schema:components';
  const manifestSchemaId = 'schema:mod-manifest';
  const entitySchemaId = 'schema:entityDefinitions';
  const actionsSchemaId = 'schema:actions'; // Added for consistency
  const eventsSchemaId = 'schema:events'; // Added for consistency
  const rulesSchemaId = 'schema:rules'; // Added for consistency
  const entityInstancesSchemaId = 'schema:entityInstances';

  // --- Mocked Functions References ---
  const mockDependencyValidate = ModDependencyValidatorModule.validate;
  const mockEngineVersionValidate = mockValidateModEngineVersions;
  const mockResolveOrder = ModLoadOrderResolverModule.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks();

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
    mockActionLoader = { loadItemsForMod: jest.fn() };
    mockComponentLoader = { loadItemsForMod: jest.fn() };
    mockConditionLoader = { loadItemsForMod: jest.fn() };
    mockEventLoader = { loadItemsForMod: jest.fn() };
    mockRuleLoader = { loadItemsForMod: jest.fn() };
    mockEntityLoader = { loadItemsForMod: jest.fn() };
    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    // --- 2. Define Base Mock Data ---
    coreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '1.0.0',
      content: {},
    };
    modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      gameVersion: '1.0.0',
      content: {},
    };
    modBManifest = {
      id: modBId,
      version: '1.0.0',
      name: 'Mod B',
      gameVersion: '1.0.0',
      content: {},
    };

    // --- 3. Configure Mocks ---
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);

    mockConfiguration.getContentTypeSchemaId.mockImplementation((typeName) => {
      switch (typeName) {
        case 'game':
          return gameSchemaId;
        case 'components':
          return componentSchemaId;
        case 'mod-manifest':
          return manifestSchemaId;
        case 'entities':
          return entitySchemaId;
        case 'actions':
          return actionsSchemaId;
        case 'events':
          return eventsSchemaId;
        case 'rules':
          return rulesSchemaId;
        default:
          return `schema:${typeName}`; // Fallback for other potential types
      }
    });
    mockValidator.isSchemaLoaded.mockReturnValue(true); // Default to true

    mockDependencyValidate.mockImplementation(() => {
      /* Default: No validation errors */
    });
    mockEngineVersionValidate.mockImplementation(() => {
      /* Default: No version errors */
    });
    mockResolveOrder.mockReturnValue([]);

    mockGameConfigLoader.loadConfig.mockResolvedValue([CORE_MOD_ID]);
    const defaultMap = new Map();
    defaultMap.set(CORE_MOD_ID.toLowerCase(), coreManifest);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(defaultMap);

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
      entityLoader: mockEntityLoader,
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  // ── Test Case: Mod Manifest Schema Validation Failure ───────────────────
  it('should throw error if a mod manifest fails schema validation (simulated via loader)', async () => {
    // Setup
    const simulatedError = new Error(
      'Simulated manifest schema validation failure in loader'
    );
    mockModManifestLoader.loadRequestedManifests.mockRejectedValue(
      simulatedError
    );
    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);

    // Action & Assertions
    let manifestErr;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      manifestErr = e;
    }
    expect(manifestErr).toBeInstanceOf(WorldLoaderError);
    expect(manifestErr.cause).toBe(simulatedError);

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    // Only the CRITICAL log in the catch block should happen here
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({ error: simulatedError })
    );
  });

  // ── Test Case: Dependency Cycle ─────────────────────────────────────────
  it('should throw ModDependencyError if a dependency cycle is detected', async () => {
    // Setup
    modAManifest.dependencies = [{ id: modBId, version: '^1.0.0' }];
    modBManifest.dependencies = [{ id: modAId, version: '^1.0.0' }];
    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId, modBId]);

    const cycleManifestMap = new Map();
    cycleManifestMap.set(modAId.toLowerCase(), modAManifest);
    cycleManifestMap.set(modBId.toLowerCase(), modBManifest);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      cycleManifestMap
    );

    const cycleErrorMessage = `DEPENDENCY_CYCLE: Cyclic dependency detected among mods: ${modAId}, ${modBId}`; // Adjust if order differs
    const expectedError = new ModDependencyError(cycleErrorMessage);

    const validationMap = new Map();
    validationMap.set(modAId.toLowerCase(), modAManifest);
    validationMap.set(modBId.toLowerCase(), modBManifest);

    // Update mockResolveOrder to throw when called with the cyclic manifests
    mockResolveOrder.mockImplementation((requestedIds, manifests, logger) => {
      if (
        requestedIds.includes(modAId) &&
        requestedIds.includes(modBId) &&
        manifests.has(modAId.toLowerCase()) &&
        manifests.has(modBId.toLowerCase())
      ) {
        throw expectedError;
      }
      console.error('mockResolveOrder unexpected call or state:', {
        requestedIds,
        manifests: [...manifests.entries()],
      });
      throw new Error(
        'mockResolveOrder called with unexpected arguments or map state for cycle test'
      );
    });

    // Action & Assertions - Use expect().rejects syntax
    // Use try/catch to ensure loadWorld is only called once for verification purposes
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      expect(e).toBeInstanceOf(ModDependencyError);
      expect(e.message).toMatch(/DEPENDENCY_CYCLE: Cyclic dependency detected/);
    }

    // --- Verify side effects ---
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    // Only the CRITICAL log in the catch block should happen here for ModDependencyError
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({ error: expectedError }) // Check the specific error object was logged
    );
    expect(mockResolveOrder).toHaveBeenCalledTimes(1); // Should only be called once now
    const expectedMapArg = new Map(validationMap); // Clone map for comparison
    expect(mockResolveOrder).toHaveBeenCalledWith(
      [modAId, modBId],
      expectedMapArg,
      mockLogger
    );
  });

  // ── Test Case: Missing Essential Schema (game) ──────────────────────────
  it('should throw Error if an essential schema (e.g., game) is missing', async () => {
    // Setup
    mockValidator.isSchemaLoaded.mockImplementation(
      (id) => id !== gameSchemaId
    ); // Fails only for game schema

    const essentialCheckErrorMessage = `WorldLoader: Essential schema missing or not configured: ${gameSchemaId}`;
    const expectedInternalErrorMessage = `Essential schema check failed for: ${gameSchemaId}`;
    const expectedFinalErrorMessage = `WorldLoader failed: Essential schema '${gameSchemaId}' missing or check failed – aborting world load. Original error: ${expectedInternalErrorMessage}`;

    // Action & Assertions
    let thrown;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(WorldLoaderError);
    expect(thrown.message).toBe(expectedFinalErrorMessage);

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch

    // Check for the specific log messages based on the implementation's catch block
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(essentialCheckErrorMessage);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedInternalErrorMessage,
        }), // Check internal message
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage, // Check the final message is logged
      expect.objectContaining({ message: expectedInternalErrorMessage }) // And the original error is passed as the second arg
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(3);

    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId);
  });

  // ── Test Case: Missing Essential Schema (mod-manifest) ──────────────────
  it('should throw Error if an essential schema (e.g., mod-manifest) is missing', async () => {
    // Setup
    const essentialSchemas = [
      gameSchemaId,
      componentSchemaId,
      manifestSchemaId,
      entitySchemaId,
      actionsSchemaId,
      eventsSchemaId,
      rulesSchemaId,
      entityInstancesSchemaId,
    ];
    mockValidator.isSchemaLoaded.mockImplementation((id) => {
      const exists = essentialSchemas.includes(id) && id !== manifestSchemaId;
      return exists;
    });

    const essentialCheckErrorMessage = `WorldLoader: Essential schema missing or not configured: ${manifestSchemaId}`;
    const expectedInternalErrorMessage = `Essential schema check failed for: ${manifestSchemaId}`;
    const expectedFinalErrorMessage = `WorldLoader failed: Essential schema '${manifestSchemaId}' missing or check failed – aborting world load. Original error: ${expectedInternalErrorMessage}`;

    // Action & Assertions
    let thrown2;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown2 = e;
    }
    expect(thrown2).toBeInstanceOf(WorldLoaderError);
    expect(thrown2.message).toBe(expectedFinalErrorMessage);

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch

    // Check for the specific log messages
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(essentialCheckErrorMessage);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedInternalErrorMessage,
        }),
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage,
      expect.objectContaining({ message: expectedInternalErrorMessage })
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(3);

    // Check which schemas were checked (up to the point of failure)
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId); // Pass
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      componentSchemaId
    ); // Pass
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(manifestSchemaId); // Fail
    expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(
      entitySchemaId
    );
    expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(
      actionsSchemaId
    );
  });

  // ── Test Case: Missing Essential Schema (entities) ──────────────────────
  it('should throw Error if an essential schema (e.g., entities) is missing', async () => {
    // Setup
    const essentialSchemas = [
      gameSchemaId,
      componentSchemaId,
      manifestSchemaId,
      entitySchemaId,
      actionsSchemaId,
      eventsSchemaId,
      rulesSchemaId,
      entityInstancesSchemaId,
    ];
    mockValidator.isSchemaLoaded.mockImplementation((id) => {
      const exists = essentialSchemas.includes(id) && id !== entitySchemaId;
      return exists;
    });

    const essentialCheckErrorMessage = `WorldLoader: Essential schema missing or not configured: ${entitySchemaId}`;
    const expectedInternalErrorMessage = `Essential schema check failed for: ${entitySchemaId}`;
    const expectedFinalErrorMessage = `WorldLoader failed: Essential schema '${entitySchemaId}' missing or check failed – aborting world load. Original error: ${expectedInternalErrorMessage}`;

    // Action & Assertions
    let thrown3;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown3 = e;
    }
    expect(thrown3).toBeInstanceOf(WorldLoaderError);
    expect(thrown3.message).toBe(expectedFinalErrorMessage);

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch

    // Check for the specific log messages
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(essentialCheckErrorMessage);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedInternalErrorMessage,
        }),
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage,
      expect.objectContaining({ message: expectedInternalErrorMessage })
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(3);

    // Check which schemas were checked
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId); // Pass
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
      componentSchemaId
    ); // Pass
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(manifestSchemaId); // Pass
    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(entitySchemaId); // Fail
    expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(
      actionsSchemaId
    );
    expect(mockValidator.isSchemaLoaded).not.toHaveBeenCalledWith(
      eventsSchemaId
    );
  });
});
