// Filename: src/tests/loaders/worldLoader.dependencyError.integration.test.js
// NOTE: Ensure this file is actually at this path in your project.

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- SUT ---
import WorldLoader from '../../src/loaders/worldLoader.js';

// --- Custom Error Type ---
import ModDependencyError from '../../src/errors/modDependencyError.js';

// --- Dependencies to Mock ---
// Mock static/imported functions BEFORE importing WorldLoader
import * as ModDependencyValidatorModule from '../../src/modding/modDependencyValidator.js';
jest.mock('../../src/modding/modDependencyValidator.js', () => ({
  validate: jest.fn(),
}));

import * as ModVersionValidatorModule from '../../src/modding/modVersionValidator.js';
// Mock the default export function
jest.mock('../../src/modding/modVersionValidator.js', () => jest.fn());

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
/** @typedef {import('../../src/loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../src/loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../src/loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../src/loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../src/modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../src/loaders/entityLoader.js').default} EntityLoader */
/** @typedef {import('../../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Placeholder for actual engine version (replace if needed, or retrieve from dependencyInjection) ---
const ENGINE_VERSION = '1.0.0'; // Example engine version

describe('WorldLoader Integration Test Suite - Error Handling: Dependency and Version Errors (TEST-LOADER-7.5)', () => {
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
  /** @type {jest.Mocked<ConditionLoader>} */
  let mockConditionLoader;
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

  // --- Mocked Functions (from imports) ---
  const mockedModDependencyValidator = ModDependencyValidatorModule.validate;
  const mockedValidateModEngineVersions = ModVersionValidatorModule.default;
  const mockedResolveOrder = ModLoadOrderResolverModule.resolveOrder;

  // --- Mock Data ---
  const worldName = 'testWorldDependencyErrors';
  const modAId = 'modA';
  const modBId = 'modB';

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

    // Mock individual content loaders
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
    mockConditionLoader = {
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
    mockEntityLoader = {
      loadItemsForMod: jest
        .fn()
        .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
    }; // Covers items, locations, etc.

    // --- 3. Configure Mocks (Default Success Paths) ---
    mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
    mockConfiguration.getContentTypeSchemaId.mockImplementation(
      (typeName) => `schema:${typeName}`
    );
    // Assume essential schemas are loaded by default
    mockValidator.isSchemaLoaded.mockImplementation((schemaId) => {
      const essentials = [
        'schema:game',
        'schema:components',
        'schema:mod-manifest',
        'schema:entities',
        'schema:actions',
        'schema:events',
        'schema:rules',
        'schema:conditions',
        'schema:entityInstances',
      ];
      return essentials.includes(schemaId);
    });

    // Default mocks for validation/resolution - NO ERRORS BY DEFAULT
    mockedModDependencyValidator.mockImplementation(() => {
      /* Assume success */
    });
    mockedValidateModEngineVersions.mockImplementation(() => {
      /* Assume success */
    });
    mockedResolveOrder.mockImplementation((reqIds) => reqIds); // Simple echo for default

    // Default mock for registry.get (can be overridden in tests)
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests') {
        // This needs to be configured per test based on loadedManifestsMap
        return undefined;
      }
      return undefined;
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
      entityLoader: mockEntityLoader,
      validator: mockValidator,
      configuration: mockConfiguration,
      gameConfigLoader: mockGameConfigLoader,
      promptTextLoader: { loadPromptText: jest.fn() },
      modManifestLoader: mockModManifestLoader,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  // ── Test Case: Missing Required Dependency ──────────────────────────────
  it('should throw ModDependencyError if a required dependency is missing', async () => {
    // Arrange
    const missingDepId = CORE_MOD_ID;
    const expectedErrorMessage = `Mod '${modAId}' requires missing dependency '${missingDepId}'.`;

    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);
    const modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      dependencies: [{ id: missingDepId, version: '^1.0.0', required: true }],
      content: {},
    };
    const loadedManifestsMap = new Map([[modAId.toLowerCase(), modAManifest]]); // Only modA loaded
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      loadedManifestsMap
    );

    // Configure registry.get to return only modA's manifest
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests' && id === modAId.toLowerCase())
        return modAManifest;
      return undefined;
    });

    // *** FIX: Mock the dependency validator to throw the specific error ***
    mockedModDependencyValidator.mockImplementationOnce((manifests, logger) => {
      // Simulate the validator detecting the missing dependency based on the input map
      throw new ModDependencyError(expectedErrorMessage);
    });

    // Action & Assert
    let thrownError = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (error) {
      thrownError = error;
    }

    // Assertions
    expect(thrownError).toBeDefined(); // Make sure an error was actually caught
    expect(thrownError).toBeInstanceOf(ModDependencyError); // Check instance type
    expect(thrownError.message).toBe(expectedErrorMessage); // Exact match

    // Verify registry cleared twice (start + catch)
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
  });

  // ── Test Case: Conflicting Mods ─────────────────────────────────────────
  it('should throw ModDependencyError if conflicting mods are loaded', async () => {
    // Arrange
    const expectedErrorMessage = `Mod '${modAId}' conflicts with loaded mod '${modBId}'.`;

    // Setup: Request modA and modB, where modA conflicts with modB
    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId, modBId]);
    const modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      conflicts: [modBId],
      content: {},
    };
    const modBManifest = {
      id: modBId,
      version: '1.0.0',
      name: 'Mod B',
      content: {},
    };
    const loadedManifestsMap = new Map([
      [modAId.toLowerCase(), modAManifest],
      [modBId.toLowerCase(), modBManifest],
    ]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      loadedManifestsMap
    );

    // Configure registry.get to return both manifests
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests') {
        if (id === modAId.toLowerCase()) return modAManifest;
        if (id === modBId.toLowerCase()) return modBManifest;
      }
      return undefined;
    });

    // *** FIX: Mock the dependency validator to throw the specific error ***
    mockedModDependencyValidator.mockImplementationOnce((manifests, logger) => {
      // Simulate the validator detecting the conflict
      throw new ModDependencyError(expectedErrorMessage);
    });

    // Action & Assert
    let thrownError = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (error) {
      thrownError = error;
    }

    // Assertions
    expect(thrownError).toBeDefined();
    expect(thrownError).toBeInstanceOf(ModDependencyError); // Check instance type
    expect(thrownError.message).toBe(expectedErrorMessage); // Exact match

    // Verify registry cleared twice
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
  });

  // ── Test Case: Incompatible Game Version ───────────────────────────────
  it('should throw ModDependencyError if a mod requires an incompatible gameVersion', async () => {
    // Arrange
    const incompatibleVersion = '0.9.0'; // Mod version string
    const incompatibleGameRequirement = '<1.0.0'; // Mod requires older engine
    // Message depends on the actual ModVersionValidator implementation, construct a plausible one
    const expectedErrorMessage = `Engine Version Mismatch: Mod '${modAId}' v${incompatibleVersion} (requires engine ${incompatibleGameRequirement}) is incompatible with engine v${ENGINE_VERSION}`;

    // Setup: Request modA, which requires an incompatible game version
    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);
    const modAManifest = {
      id: modAId,
      version: incompatibleVersion,
      name: 'Mod A',
      gameVersion: incompatibleGameRequirement,
      content: {},
    };
    const loadedManifestsMap = new Map([[modAId.toLowerCase(), modAManifest]]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      loadedManifestsMap
    );
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests' && id === modAId.toLowerCase())
        return modAManifest;
      return undefined;
    });

    // Pass dependency validation
    mockedModDependencyValidator.mockImplementation(() => {});

    // *** FIX: Mock the *version* validator to throw the specific error ***
    mockedValidateModEngineVersions.mockImplementationOnce(
      (manifests, logger) => {
        // Simulate the version validator detecting the incompatibility
        throw new ModDependencyError(expectedErrorMessage);
      }
    );

    // Action & Assert
    let thrownError = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (error) {
      thrownError = error;
    }

    // Assertions
    expect(thrownError).toBeDefined();
    expect(thrownError).toBeInstanceOf(ModDependencyError); // Check instance type
    // Use .toContain for flexibility if the exact message format varies slightly
    expect(thrownError.message).toContain(
      `incompatible with engine v${ENGINE_VERSION}`
    );
    expect(thrownError.message).toContain(
      `Mod '${modAId}' v${incompatibleVersion}`
    );
    expect(thrownError.message).toContain(
      `requires engine ${incompatibleGameRequirement}`
    );

    // Verify registry cleared twice
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
  });

  // ── Test Case: Unsatisfiable Dependency Version Range ────────────────────
  it('should throw ModDependencyError if a dependency has an unsatisfiable version range', async () => {
    // Arrange
    const requiredVersionRange = '^2.0.0';
    const actualDepVersion = '1.0.0';
    const expectedErrorMessage = `Mod '${modAId}' requires dependency '${CORE_MOD_ID}' version '${requiredVersionRange}', but found version '${actualDepVersion}'.`;

    // Setup: Request modA and core, modA requires core@^2.0.0, but core is 1.0.0
    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId, CORE_MOD_ID]);
    const modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      dependencies: [
        { id: CORE_MOD_ID, version: requiredVersionRange, required: true },
      ],
      content: {},
    };
    const coreManifest = {
      id: CORE_MOD_ID,
      version: actualDepVersion,
      name: 'Core',
      gameVersion: ENGINE_VERSION,
      content: {},
    };
    const loadedManifestsMap = new Map([
      [modAId.toLowerCase(), modAManifest],
      [CORE_MOD_ID.toLowerCase(), coreManifest],
    ]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      loadedManifestsMap
    );

    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests') {
        if (id === modAId.toLowerCase()) return modAManifest;
        if (id === CORE_MOD_ID.toLowerCase()) return coreManifest;
      }
      return undefined;
    });

    // *** FIX: Mock the dependency validator to throw the specific error ***
    mockedModDependencyValidator.mockImplementationOnce((manifests, logger) => {
      // Simulate the validator detecting the version mismatch
      throw new ModDependencyError(expectedErrorMessage);
    });

    // Action & Assert
    let thrownError = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (error) {
      thrownError = error;
    }

    // Assertions
    expect(thrownError).toBeDefined();
    expect(thrownError).toBeInstanceOf(ModDependencyError); // Check instance type
    expect(thrownError.message).toBe(expectedErrorMessage); // Exact match

    // Verify registry cleared twice
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
  });

  // ── Test Case: No Content Loaders Called on Early Error ─────────────────
  it('should not call any content loaders if an error occurs before the loading loop', async () => {
    // Arrange: Reuse the "Missing Required Dependency" scenario which throws early
    const missingDepId = CORE_MOD_ID;
    const expectedErrorMessage = `Mod '${modAId}' requires missing dependency '${missingDepId}'.`;

    mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);
    const modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      dependencies: [{ id: missingDepId, version: '^1.0.0', required: true }],
      content: {},
    };
    const loadedManifestsMap = new Map([[modAId.toLowerCase(), modAManifest]]);
    mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      loadedManifestsMap
    );
    mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests' && id === modAId.toLowerCase())
        return modAManifest;
      return undefined;
    });

    // *** FIX: Mock the dependency validator to throw the specific error ***
    mockedModDependencyValidator.mockImplementationOnce((manifests, logger) => {
      throw new ModDependencyError(expectedErrorMessage);
    });

    // Action & Assert
    let thrownError = null;
    try {
      await worldLoader.loadWorld(worldName);
    } catch (error) {
      thrownError = error;
    }

    // Assertions
    expect(thrownError).toBeDefined();
    expect(thrownError).toBeInstanceOf(ModDependencyError); // Verify error was thrown and is correct type

    // Verify none of the content loaders' loadItemsForMod methods were called
    expect(mockComponentLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockActionLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
    // EntityLoader loads multiple types, check its method was not called
    expect(mockEntityLoader.loadItemsForMod).not.toHaveBeenCalled();

    // Verify registry cleared twice
    expect(mockRegistry.clear).toHaveBeenCalledTimes(2);
  });
});
