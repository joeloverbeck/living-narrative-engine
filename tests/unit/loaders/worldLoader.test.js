import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import WorldLoader from '../../../src/loaders/worldLoader.js';

const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest.fn(() => 'worldSchema'),
});

const createMockPathResolver = () => ({
  resolveModContentPath: jest.fn(
    (modId, dir, filename) => `/mods/${modId}/${dir}/${filename}`
  ),
});

const createMockDataFetcher = () => ({
  fetch: jest.fn().mockResolvedValue({ instances: [] }),
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
    resolver = createMockPathResolver();
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
    await loader.loadWorlds(['modA'], new Map(), counts);
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader: Schema ID for content type 'world' not found in configuration. Cannot process world files."
    );
    expect(registry.store).not.toHaveBeenCalled();
    // The expected behavior in this error case has been updated to provide a full summary object.
    expect(counts.worlds).toEqual(expect.objectContaining({ errors: 1 }));
  });

  it('warns when manifest missing', async () => {
    const counts = {};
    await loader.loadWorlds(['modA'], new Map(), counts);
    expect(logger.warn).toHaveBeenCalledWith(
      'WorldLoader [modA]: Manifest not found. Skipping world file search.'
    );
    expect(registry.store).toHaveBeenCalledWith('worlds', 'main', []);
    expect(counts.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 0,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });

  it('skips when manifest has no world files', async () => {
    const manifests = new Map([['moda', { content: { worlds: [] } }]]);
    const counts = {};
    await loader.loadWorlds(['modA'], manifests, counts);
    expect(logger.debug).toHaveBeenCalledWith(
      'WorldLoader [modA]: No world files listed in manifest. Skipping.'
    );
    expect(registry.store).toHaveBeenCalledWith('worlds', 'main', []);
    expect(counts.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 0,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });

  it('aggregates instances from world files', async () => {
    const manifests = new Map([
      ['moda', { content: { worlds: ['world1.json'] } }],
    ]);
    const mockInstances = [{ definitionId: 'core:player' }, { definitionId: 'core:npc' }];
    fetcher.fetch.mockResolvedValue({ instances: mockInstances });
    // Mock that the entity definitions exist in the registry
    registry.get.mockReturnValue({ id: 'some-definition' });

    const counts = {};
    await loader.loadWorlds(['modA'], manifests, counts);
    expect(resolver.resolveModContentPath).toHaveBeenCalledWith(
      'modA',
      'worlds',
      'world1.json'
    );
    expect(fetcher.fetch).toHaveBeenCalledWith('/mods/modA/worlds/world1.json');
    expect(registry.store).toHaveBeenCalledWith('worlds', 'main', mockInstances);
    expect(counts.worlds).toEqual({
      count: 1,
      overrides: 0,
      errors: 0,
      instances: 2,
      resolvedDefinitions: 2,
      unresolvedDefinitions: 0,
    });
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
    await loader.loadWorlds(['modA'], manifests, counts);
    expect(logger.error).toHaveBeenCalledWith(
      "WorldLoader [modA]: Failed to process world file 'bad.json'. Path: '/mods/modA/worlds/bad.json'",
      expect.objectContaining({ error: 'fail' })
    );
    expect(registry.store).toHaveBeenCalledWith('worlds', 'main', []);
    expect(counts.worlds).toEqual({
      count: 0,
      overrides: 0,
      errors: 1,
      instances: 0,
      resolvedDefinitions: 0,
      unresolvedDefinitions: 0,
    });
  });
});