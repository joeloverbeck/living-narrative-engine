import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModsLoader from '../../../src/loaders/modsLoader.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import MissingSchemaError from '../../../src/errors/missingSchemaError.js';

/**
 * Creates a ModsLoader instance with mocked dependencies for unit tests.
 *
 * @returns {{
 *   modsLoader: ModsLoader,
 *   configuration: any, validator: any, logger: any, worldLoader: any, registry: any,
 *   schemaLoader: any, componentLoader: any, conditionLoader: any, ruleLoader: any,
 *   macroLoader: any, actionLoader: any, eventLoader: any, entityLoader: any,
 *   entityInstanceLoader: any, gameConfigLoader: any, promptTextLoader: any,
 *   modManifestLoader: any, validatedEventDispatcher: any, modDependencyValidator: any,
 *   modVersionValidator: any, modLoadOrderResolver: any
 * }}
 */
function createModsLoader() {
  const schemaIds = {
    game: 'id:game',
    components: 'id:components',
    'mod-manifest': 'id:manifest',
    entityDefinitions: 'id:defs',
    entityInstances: 'id:instances',
    actions: 'id:actions',
    events: 'id:events',
    rules: 'id:rules',
    conditions: 'id:conditions',
  };

  // --- Mock all direct dependencies of ModsLoader ---
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const registry = {
    store: jest.fn(),
    get: jest.fn(),
    clear: jest.fn(),
    setManifest: jest.fn(),
    getManifest: jest.fn(),
  };
  const validator = {
    isSchemaLoaded: jest.fn(() => true),
    addSchema: jest.fn(),
    validate: jest.fn(),
  }; // ISchemaValidator
  const configuration = {
    getContentTypeSchemaId: jest.fn((type) => {
      if (type === 'goals') return 'http://example.com/schemas/goal.schema.json';
      if (type === 'game') return 'http://example.com/schemas/game.schema.json';
      if (type === 'components') return 'http://example.com/schemas/component.schema.json';
      if (type === 'mod-manifest') return 'http://example.com/schemas/mod.manifest.schema.json';
      if (type === 'entityDefinitions') return 'http://example.com/schemas/entity-definition.schema.json';
      if (type === 'entityInstances') return 'http://example.com/schemas/entity-instance.schema.json';
      if (type === 'actions') return 'http://example.com/schemas/action.schema.json';
      if (type === 'events') return 'http://example.com/schemas/event.schema.json';
      if (type === 'rules') return 'http://example.com/schemas/rule.schema.json';
      if (type === 'conditions') return 'http://example.com/schemas/condition.schema.json';
      return undefined;
    }),
    getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
  }; // IConfiguration

  const schemaLoader = {
    loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
  };
  const componentLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const conditionLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const ruleLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const macroLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const actionLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const eventLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const entityLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  }; // EntityDefinitionLoader
  const entityInstanceLoader = {
    loadItemsForMod: jest
      .fn()
      .mockResolvedValue({ count: 0, overrides: 0, errors: 0 }),
  };
  const gameConfigLoader = { loadConfig: jest.fn().mockResolvedValue([]) };
  const promptTextLoader = { loadPromptText: jest.fn().mockResolvedValue({}) };
  const modManifestLoader = {
    loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
    loadManifest: jest.fn(),
  };
  const validatedEventDispatcher = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
  const modDependencyValidator = { validate: jest.fn() };
  const modVersionValidator = jest.fn().mockImplementation(() => true);
  const modLoadOrderResolver = {
    resolveOrder: jest
      .fn()
      .mockImplementation((manifests) => Array.from(manifests.keys())),
  };
  const worldLoader = { loadWorlds: jest.fn().mockResolvedValue(undefined) };
  // contentLoadersConfig can be null to use default

  // ModsLoader expects a single object with these properties
  const modsLoader = new ModsLoader({
    registry,
    logger,
    schemaLoader,
    componentLoader,
    conditionLoader,
    ruleLoader,
    macroLoader,
    actionLoader,
    eventLoader,
    entityLoader, // Alias for componentDefinitionLoader
    entityInstanceLoader,
    validator, // ISchemaValidator
    configuration, // IConfiguration
    gameConfigLoader,
    promptTextLoader,
    modManifestLoader, // Instance of ModManifestLoader class
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
    worldLoader,
    contentLoadersConfig: null, // Use default
  });

  return {
    modsLoader,
    configuration,
    validator,
    logger,
    worldLoader,
    registry,
    schemaLoader,
    componentLoader,
    conditionLoader,
    ruleLoader,
    macroLoader,
    actionLoader,
    eventLoader,
    entityLoader,
    entityInstanceLoader,
    gameConfigLoader,
    promptTextLoader,
    modManifestLoader,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
  };
}

describe('ModsLoader helper methods', () => {
  let modsLoader;
  let configuration;
  let validator;
  let logger;
  let worldLoader;
  let registry;
  let schemaLoader;
  let componentLoader;
  let conditionLoader;
  let ruleLoader;
  let macroLoader;
  let actionLoader;
  let eventLoader;
  let entityLoader;
  let entityInstanceLoader;
  let gameConfigLoader;
  let promptTextLoader;
  let modManifestLoader;
  let validatedEventDispatcher;
  let modDependencyValidator;
  let modVersionValidator;
  let modLoadOrderResolver;

  beforeEach(() => {
    // Destructure all relevant mocks
    ({
      modsLoader,
      configuration,
      validator,
      logger,
      worldLoader,
      registry, // Added
      schemaLoader, // Added
      componentLoader, // Added
      conditionLoader, // Added
      ruleLoader, // Added
      macroLoader, // Added
      actionLoader, // Added
      eventLoader, // Added
      entityLoader, // Added
      entityInstanceLoader, // Added
      gameConfigLoader, // Added
      promptTextLoader, // Added
      modManifestLoader, // Added
      validatedEventDispatcher, // Added
      modDependencyValidator, // Added
      modVersionValidator, // Added
      modLoadOrderResolver, // Added
    } = createModsLoader());
    jest.clearAllMocks();
  });

  describe('checkEssentialSchemas', () => {
    it('passes when all schemas are loaded', () => {
      expect(() => modsLoader._checkEssentialSchemas()).not.toThrow();
    });

    it('throws MissingSchemaError when a schema id is undefined', () => {
      const missingType = 'actions';
      const expectedLog = `ModsLoader: Essential schema type '${missingType}' is not configured (no schema ID found).`;
      const expectedErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

      configuration.getContentTypeSchemaId.mockImplementation((type) =>
        type === missingType ? undefined : `id:${type}`
      );

      let caughtError;
      try {
        modsLoader._checkEssentialSchemas();
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(MissingSchemaError);
      expect(caughtError.message).toBe(expectedErrorMsg);
      expect(caughtError.schemaId).toBeNull();
      expect(caughtError.contentType).toBe(missingType);
      expect(logger.error).toHaveBeenCalledWith(expectedLog);
    });

    it('throws MissingSchemaError when a schema is not loaded', () => {
      const notLoadedType = 'actions';
      const notLoadedSchemaId = `id:${notLoadedType}`;
      const expectedLog = `ModsLoader: Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;
      const expectedErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

      configuration.getContentTypeSchemaId.mockImplementation((type) => {
        if (type === notLoadedType) return notLoadedSchemaId;
        return `id:${type}`;
      });

      validator.isSchemaLoaded.mockImplementation(
        (id) => id !== notLoadedSchemaId
      );

      let caughtError;
      try {
        modsLoader._checkEssentialSchemas();
      } catch (e) {
        caughtError = e;
      }
      
      expect(caughtError).toBeInstanceOf(MissingSchemaError);
      expect(caughtError.message).toBe(expectedErrorMsg);
      expect(caughtError.schemaId).toBe(notLoadedSchemaId);
      expect(caughtError.contentType).toBe(notLoadedType);
      expect(logger.error).toHaveBeenCalledWith(expectedLog);
    });
  });

  describe('LoadResultAggregator', () => {
    it('aggregates counts into mod and total summaries', () => {
      const totals = {};
      const agg = new LoadResultAggregator(totals);
      agg.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');
      expect(agg.modResults).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
      expect(totals).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
    });

    it('handles invalid result objects', () => {
      const totals = {};
      const agg = new LoadResultAggregator(totals);
      agg.aggregate(null, 'events');
      expect(agg.modResults).toEqual({
        events: { count: 0, overrides: 0, errors: 0 },
      });
      expect(totals).toEqual({ events: { count: 0, overrides: 0, errors: 0 } });
    });

    it('recordFailure increments error counts', () => {
      const totals = { rules: { count: 1, overrides: 0, errors: 0 } };
      const agg = new LoadResultAggregator(totals);
      agg.modResults = { rules: { count: 1, overrides: 0, errors: 0 } };
      agg.recordFailure('rules');
      agg.recordFailure('rules');
      expect(agg.modResults.rules.errors).toBe(2);
      expect(totals.rules.errors).toBe(2);
    });
  });
});
