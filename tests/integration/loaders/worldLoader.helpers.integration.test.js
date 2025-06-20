import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import MissingSchemaError from '../../../src/errors/missingSchemaError.js';

/**
 * Creates a WorldLoader instance with mocked dependencies for unit tests.
 *
 * @returns {{worldLoader: WorldLoader, configuration: any, validator: any, logger: any}}
 */
function createWorldLoader() {
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

  const configuration = {
    getContentTypeSchemaId: jest.fn((type) => schemaIds[type]),
  };
  const validator = {
    isSchemaLoaded: jest.fn(() => true),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const registry = { store: jest.fn(), get: jest.fn(), clear: jest.fn() };
  const loaderMock = { loadItemsForMod: jest.fn() };
  const schemaLoader = { loadAndCompileAllSchemas: jest.fn() };
  const gameConfigLoader = { loadConfig: jest.fn().mockResolvedValue([]) };
  const promptTextLoader = { loadPromptText: jest.fn() };
  const modManifestLoader = {
    loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
  };
  const validatedEventDispatcher = { dispatch: jest.fn() };
  const modDependencyValidator = { validate: jest.fn() };
  const modVersionValidator = jest.fn();
  const modLoadOrderResolver = { resolveOrder: jest.fn() };

  const worldLoader = new WorldLoader({
    registry,
    logger,
    schemaLoader,
    componentLoader: loaderMock,
    conditionLoader: loaderMock,
    ruleLoader: loaderMock,
    macroLoader: loaderMock,
    actionLoader: loaderMock,
    eventLoader: loaderMock,
    entityLoader: loaderMock,
    entityInstanceLoader: loaderMock,
    validator,
    configuration,
    gameConfigLoader,
    promptTextLoader,
    modManifestLoader,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
    contentLoadersConfig: null,
  });

  return { worldLoader, configuration, validator, logger };
}

describe('WorldLoader helper methods', () => {
  let worldLoader;
  let configuration;
  let validator;
  let logger;

  beforeEach(() => {
    ({ worldLoader, configuration, validator, logger } = createWorldLoader());
    jest.clearAllMocks();
  });

  describe('checkEssentialSchemas', () => {
    it('passes when all schemas are loaded', () => {
      expect(() => worldLoader.checkEssentialSchemas()).not.toThrow();
    });

    it('throws MissingSchemaError when a schema id is undefined', () => {
      const missingType = 'actions';
      const expectedLog = `WorldLoader: Essential schema type '${missingType}' is not configured (no schema ID found).`;
      const expectedErrorMsg = `Essential schema type '${missingType}' is not configured (no schema ID found).`;

      configuration.getContentTypeSchemaId.mockImplementation((type) =>
        type === missingType ? undefined : `id:${type}`
      );

      let caughtError;
      try {
        worldLoader.checkEssentialSchemas();
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
      const expectedLog = `WorldLoader: Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;
      const expectedErrorMsg = `Essential schema '${notLoadedSchemaId}' (type: '${notLoadedType}') is configured but not loaded.`;

      validator.isSchemaLoaded.mockImplementation(
        (id) => id !== notLoadedSchemaId
      );

      let caughtError;
      try {
        worldLoader.checkEssentialSchemas();
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
