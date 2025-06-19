// Filename: tests/loaders/worldLoader.preLoopErrors.integration.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Dependencies to Mock/Import ---
import ModDependencyError from '../../src/errors/modDependencyError.js';
import WorldLoaderError from '../../src/errors/worldLoaderError.js';
import MissingSchemaError from '../../src/errors/missingSchemaError.js';

// --- Mock Modules BEFORE they are potentially imported by SUT or other imports ---
// Mocks will be injected via constructor
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
  const mockModDependencyValidator = { validate: jest.fn() };
  const mockModVersionValidator = jest.fn();
  const mockModLoadOrderResolver = { resolveOrder: jest.fn() };

  const mockDependencyValidate = mockModDependencyValidator.validate;
  const mockEngineVersionValidate = mockModVersionValidator;
  const mockResolveOrder = mockModLoadOrderResolver.resolveOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModDependencyValidator.validate.mockReset();
    mockModVersionValidator.mockReset();
    mockModLoadOrderResolver.resolveOrder.mockReset();

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
        case 'entity_definitions':
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
      modDependencyValidator: mockModDependencyValidator,
      modVersionValidator: mockModVersionValidator,
      modLoadOrderResolver: mockModLoadOrderResolver,
      contentLoadersConfig: null,
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
    mockValidator.isSchemaLoaded.mockImplementation((id) => id !== gameSchemaId);
    const expectedLoggedErrorMessage = `WorldLoader: Essential schema '${gameSchemaId}' (type: 'game') is configured but not loaded.`;
    const expectedMissingSchemaErrorMsg = `Essential schema '${gameSchemaId}' (type: 'game') is configured but not loaded.`;
    const expectedFinalErrorMessage = `WorldLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg}`;

    let thrown = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(WorldLoaderError);
    expect(thrown.message).toBe(expectedFinalErrorMessage);
    expect(thrown.cause).toBeInstanceOf(MissingSchemaError);
    expect(thrown.cause.message).toBe(expectedMissingSchemaErrorMsg);
    expect(thrown.cause.schemaId).toBe(gameSchemaId);
    expect(thrown.cause.contentType).toBe('game');

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    // Check for the specific log messages based on the implementation's catch block
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedMissingSchemaErrorMsg,
        }),
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage,
      expect.objectContaining({ message: expectedMissingSchemaErrorMsg })
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(3);

    expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(gameSchemaId);
  });

  // ── Test Case: Missing Essential Schema (mod-manifest) ──────────────────
  it('should throw Error if an essential schema (e.g., mod-manifest) is missing', async () => {
    // Test with mod-manifest schema
    mockValidator.isSchemaLoaded.mockImplementation(
      (id) => id !== manifestSchemaId
    );
    const expectedLoggedErrorMessage2 = `WorldLoader: Essential schema '${manifestSchemaId}' (type: 'mod-manifest') is configured but not loaded.`;
    const expectedMissingSchemaErrorMsg2 = `Essential schema '${manifestSchemaId}' (type: 'mod-manifest') is configured but not loaded.`;
    const expectedFinalErrorMessage2 = `WorldLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg2}`;

    let thrown2 = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown2 = e;
    }
    expect(thrown2).toBeInstanceOf(WorldLoaderError);
    expect(thrown2.message).toBe(expectedFinalErrorMessage2);
    expect(thrown2.cause).toBeInstanceOf(MissingSchemaError);
    expect(thrown2.cause.message).toBe(expectedMissingSchemaErrorMsg2);
    expect(thrown2.cause.schemaId).toBe(manifestSchemaId);
    expect(thrown2.cause.contentType).toBe('mod-manifest');

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    // Check for the specific log messages
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage2);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedMissingSchemaErrorMsg2,
        }),
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage2,
      expect.objectContaining({ message: expectedMissingSchemaErrorMsg2 })
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
    // Test with entityDefinitions schema
    mockValidator.isSchemaLoaded.mockImplementation(
      (id) => id !== entitySchemaId // entitySchemaId is 'schema:entityDefinitions'
    );
    // Note: WorldLoader uses ESSENTIAL_SCHEMA_TYPES which has 'entityDefinitions' (camelCase)
    const expectedLoggedErrorMessage3 = `WorldLoader: Essential schema '${entitySchemaId}' (type: 'entityDefinitions') is configured but not loaded.`;
    const expectedMissingSchemaErrorMsg3 = `Essential schema '${entitySchemaId}' (type: 'entityDefinitions') is configured but not loaded.`;
    const expectedFinalErrorMessage3 = `WorldLoader failed during essential schema check – aborting world load. Original error: ${expectedMissingSchemaErrorMsg3}`;

    let thrown3 = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (e) {
      thrown3 = e;
    }
    expect(thrown3).toBeInstanceOf(WorldLoaderError);
    expect(thrown3.message).toBe(expectedFinalErrorMessage3);
    expect(thrown3.cause).toBeInstanceOf(MissingSchemaError);
    expect(thrown3.cause.message).toBe(expectedMissingSchemaErrorMsg3);
    expect(thrown3.cause.schemaId).toBe(entitySchemaId);
    expect(thrown3.cause.contentType).toBe('entityDefinitions');

    // Verify side effects
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    // Check for the specific log messages
    // 1. Logged inside the try block when check fails
    expect(mockLogger.error).toHaveBeenCalledWith(expectedLoggedErrorMessage3);
    // 2. The 'CRITICAL' log in the catch block
    expect(mockLogger.error).toHaveBeenCalledWith(
      'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
      expect.objectContaining({
        error: expect.objectContaining({
          message: expectedMissingSchemaErrorMsg3,
        }),
      })
    );
    // 3. The log made just before throwing the final error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expectedFinalErrorMessage3,
      expect.objectContaining({ message: expectedMissingSchemaErrorMsg3 })
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
