import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';
import MissingEntityInstanceError from '../../../src/errors/missingEntityInstanceError.js';
import MissingInstanceIdError from '../../../src/errors/missingInstanceIdError.js';
import ModsLoaderError from '../../../src/errors/modsLoaderError.js';
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

    const updated = await loader._processWorldFile(
      'modA',
      'world1.json',
      'schemaId',
      totals
    );

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
    expect(updated).toEqual({
      filesProcessed: 1,
      filesFailed: 0,
      instances: 2,
      overrides: 0,
      resolvedDefinitions: 2,
      unresolvedDefinitions: 0,
    });
  });

  it('flags overrides when registry store reports previous value', async () => {
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
      instances: [{ instanceId: 'core:player' }],
    };
    fetcher.fetch.mockResolvedValue(mockWorldData);
    registry.get.mockReturnValue({ id: 'def' });
    registry.store.mockReturnValue(true);

    const updated = await loader._processWorldFile(
      'modA',
      'world1.json',
      'schemaId',
      totals
    );

    expect(updated.overrides).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "World 'test:world' from mod 'modA' overwrote an existing world definition."
    );
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

    const updated = await loader._processWorldFile(
      'modA',
      'bad.json',
      'schemaId',
      totals
    );

    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'bad.json'. Path: '/mods/modA/worlds/bad.json'. Error: fail",
      { modId: 'modA', filename: 'bad.json', error: fetchError }
    );
    expect(updated).toEqual({
      filesProcessed: 0,
      filesFailed: 1,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });

  it('logs error for instances without id', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };
    const worldData = { id: 'w:1', instances: [{}] };
    fetcher.fetch.mockResolvedValue(worldData);
    const updated = await loader._processWorldFile(
      'modA',
      'world.json',
      'schemaId',
      totals
    );
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'world.json'. Path: '/mods/modA/worlds/world.json'. Error: Instance in world file 'world.json' is missing an 'instanceId'.",
      {
        modId: 'modA',
        filename: 'world.json',
        error: expect.any(MissingInstanceIdError),
      }
    );
    expect(updated.filesFailed).toBe(1);
  });

  it('logs error for unknown instance', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };
    const worldData = { id: 'w:1', instances: [{ instanceId: 'x:y' }] };
    fetcher.fetch.mockResolvedValue(worldData);
    registry.get.mockReturnValue(undefined);
    const updated = await loader._processWorldFile(
      'modA',
      'world.json',
      'schemaId',
      totals
    );
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'world.json'. Path: '/mods/modA/worlds/world.json'. Error: Unknown entity instanceId 'x:y' referenced in world 'world.json'.",
      {
        modId: 'modA',
        filename: 'world.json',
        error: expect.any(MissingEntityInstanceError),
      }
    );
    expect(updated.filesFailed).toBe(1);
  });

  it('warns when instances field is not an array', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };
    const worldData = { id: 'w:1', instances: {} };
    fetcher.fetch.mockResolvedValue(worldData);
    registry.store.mockReturnValue(false);

    const updated = await loader._processWorldFile(
      'modA',
      'world.json',
      'schemaId',
      totals
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "WorldLoader [modA]: 'instances' field in 'world.json' is not an array. Skipping instance validation.",
      { modId: 'modA', filename: 'world.json', actualType: 'object' }
    );
    expect(updated).toEqual({
      filesProcessed: 1,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });

  it('rethrows mods loader errors for missing definitions', async () => {
    const totals = {
      filesProcessed: 0,
      filesFailed: 0,
      instances: 0,
      overrides: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    };

    const worldData = {
      id: 'w:1',
      instances: [{ instanceId: 'mod:missing' }],
    };
    const modsLoaderError = new ModsLoaderError(
      'Definition missing',
      'missing_definition'
    );

    fetcher.fetch.mockResolvedValue(worldData);
    registry.get.mockImplementation(() => {
      throw modsLoaderError;
    });

    await expect(
      loader._processWorldFile('modA', 'world.json', 'schemaId', totals)
    ).rejects.toBe(modsLoaderError);
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'world.json'. Path: '/mods/modA/worlds/world.json'. Error: Definition missing",
      {
        modId: 'modA',
        filename: 'world.json',
        error: modsLoaderError,
      }
    );
  });
});
