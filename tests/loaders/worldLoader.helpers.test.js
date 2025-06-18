import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../src/loaders/worldLoader.js';
import MissingSchemaError from '../../src/errors/missingSchemaError.js';

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

  describe('_checkEssentialSchemas', () => {
    it('passes when all schemas are loaded', () => {
      expect(() => worldLoader._checkEssentialSchemas()).not.toThrow();
    });

    it('throws MissingSchemaError when a schema id is undefined', () => {
      configuration.getContentTypeSchemaId.mockImplementation((type) =>
        type === 'actions' ? undefined : `id:${type}`
      );
      expect(() => worldLoader._checkEssentialSchemas()).toThrow(
        MissingSchemaError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'WorldLoader: Essential schema missing or not configured: Unknown Essential Schema ID'
      );
    });

    it('throws MissingSchemaError when a schema is not loaded', () => {
      validator.isSchemaLoaded.mockImplementation((id) => id !== 'id:actions');
      expect(() => worldLoader._checkEssentialSchemas()).toThrow(
        MissingSchemaError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'WorldLoader: Essential schema missing or not configured: id:actions'
      );
    });
  });

  describe('_aggregateLoaderResult', () => {
    it('aggregates counts into mod and total summaries', () => {
      const modRes = {};
      const totals = {};
      worldLoader._aggregateLoaderResult(modRes, totals, 'actions', {
        count: 2,
        overrides: 1,
        errors: 0,
      });
      expect(modRes).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
      expect(totals).toEqual({
        actions: { count: 2, overrides: 1, errors: 0 },
      });
    });

    it('handles invalid result objects', () => {
      const modRes = {};
      const totals = {};
      worldLoader._aggregateLoaderResult(modRes, totals, 'events', null);
      expect(modRes).toEqual({ events: { count: 0, overrides: 0, errors: 0 } });
      expect(totals).toEqual({ events: { count: 0, overrides: 0, errors: 0 } });
    });
  });

  describe('_recordLoaderError', () => {
    it('increments error counts for mod and total', () => {
      const modRes = { rules: { count: 1, overrides: 0, errors: 0 } };
      const totals = { rules: { count: 1, overrides: 0, errors: 0 } };
      worldLoader._recordLoaderError(modRes, totals, 'rules', 'fail');
      worldLoader._recordLoaderError(modRes, totals, 'rules', 'fail again');
      expect(modRes.rules.errors).toBe(2);
      expect(totals.rules.errors).toBe(2);
    });
  });
});
