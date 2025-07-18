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
  get: jest.fn(), // FIX: Added missing 'get' method to the mock.
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('WorldLoader.loadWorlds', () => {
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

  it('logs error and returns early when schema id missing', async () => {
    config.getContentTypeSchemaId.mockReturnValue(null);
    const counts = {};
    // Re-instantiate loader with the modified config
    loader = new WorldLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );
    const updated = await loader.loadWorlds(['modA'], new Map(), counts);
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader: Schema ID for content type 'world' not found in configuration. Cannot process world files."
    );
    expect(registry.store).not.toHaveBeenCalled();
    expect(updated.worlds).toEqual(expect.objectContaining({ errors: 1 }));
    expect(counts).toEqual({});
  });

  it('warns when manifest missing', async () => {
    const counts = {};
    const updated = await loader.loadWorlds(['modA'], new Map(), counts);
    expect(logger.warn).toHaveBeenCalledWith(
      'WorldLoader [modA]: Manifest not found. Skipping world file search.'
    );
    expect(updated.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 0,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
    expect(counts).toEqual({});
  });

  it('skips when manifest has no world files', async () => {
    const manifests = new Map([['moda', { content: { worlds: [] } }]]);
    const counts = {};
    const updated = await loader.loadWorlds(['modA'], manifests, counts);
    expect(logger.debug).toHaveBeenCalledWith(
      'WorldLoader [modA]: No world files listed in manifest. Skipping.'
    );
    expect(updated.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 0,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
    expect(counts).toEqual({});
  });

  it('aggregates instances from world files', async () => {
    const manifests = new Map([
      ['moda', { content: { worlds: ['world1.json'] } }],
    ]);
    const mockWorldData = {
      id: 'test:world',
      name: 'Test World',
      instances: [{ instanceId: 'core:player' }, { instanceId: 'core:npc' }],
    };
    fetcher.fetch.mockResolvedValue(mockWorldData);
    // Mock that the entity definitions exist in the registry
    registry.get.mockReturnValue({ id: 'some-definition' });

    const counts = {};
    const updated = await loader.loadWorlds(['modA'], manifests, counts);
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
    expect(updated.worlds).toEqual({
      count: 1,
      overrides: 0,
      errors: 0,
      instances: 2,
      resolvedDefinitions: 2,
      unresolvedDefinitions: 0,
    });
    expect(counts).toEqual({});
  });

  it('records failures when fetch throws', async () => {
    const manifests = new Map([
      ['moda', { content: { worlds: ['bad.json'] } }],
    ]);
    resolver.resolveModContentPath.mockReturnValue(
      '/mods/modA/worlds/bad.json'
    );
    const fetchError = new Error('fail');
    fetcher.fetch.mockRejectedValue(fetchError);
    const counts = {};
    const updated = await loader.loadWorlds(['modA'], manifests, counts);
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'bad.json'. Path: '/mods/modA/worlds/bad.json'. Error: fail",
      { modId: 'modA', filename: 'bad.json', error: fetchError }
    );
    expect(updated.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 1,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
    expect(counts).toEqual({});
  });
});
