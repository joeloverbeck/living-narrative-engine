import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest.fn(() => 'worldSchema'),
});

const createMockSchemaValidator = () => ({
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
});

const createMockDataRegistry = () => ({
  store: jest.fn(),
  get: jest.fn(),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('WorldLoader._processWorldFile', () => {
  let config;
  let resolver;
  let fetcher;
  let validator;
  let registry;
  let logger;
  let loader;

  beforeEach(() => {
    config = createMockConfiguration();
    resolver = createMockPathResolver({
      resolveModContentPath: jest.fn(
        (modId, dir, filename) => `/mods/${modId}/${dir}/${filename}`
      ),
    });
    fetcher = createMockDataFetcher();
    validator = createMockSchemaValidator();
    registry = createMockDataRegistry();
    logger = createMockLogger();
    loader = new WorldLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );
    jest.clearAllMocks();
  });

  it('processes world file and updates totals on success', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };

    const mockWorldData = {
      id: 'test:world',
      name: 'Test World',
      instances: [{ instanceId: 'core:player' }, { instanceId: 'core:npc' }],
    };
    fetcher.fetch.mockResolvedValue(mockWorldData);
    registry.get.mockReturnValue({ id: 'def' });

    await loader._processWorldFile('modA', 'world1.json', 'schemaId', totals);

    expect(resolver.resolveModContentPath).toHaveBeenCalledWith(
      'modA',
      'worlds',
      'world1.json'
    );
    expect(fetcher.fetch).toHaveBeenCalledWith('/mods/modA/worlds/world1.json');
    expect(registry.store).toHaveBeenCalledWith(
      'worlds',
      'test:world',
      mockWorldData
    );
    expect(totals).toEqual({
      filesProcessed: 1,
      filesFailed: 0,
      instances: 2,
      overrides: 0,
      resolvedDefinitions: 2,
      unresolvedDefinitions: 0,
    });
  });

  it('records failure when fetch throws', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };
    const fetchError = new Error('fail');
    fetcher.fetch.mockRejectedValue(fetchError);

    await loader._processWorldFile('modA', 'bad.json', 'schemaId', totals);

    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'bad.json'. Path: '/mods/modA/worlds/bad.json'. Error: fail",
      { modId: 'modA', filename: 'bad.json', error: fetchError }
    );
    expect(totals).toEqual({
      filesProcessed: 0,
      filesFailed: 1,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });
});
