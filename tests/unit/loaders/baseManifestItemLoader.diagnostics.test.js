// Tests for BaseManifestItemLoader diagnostic branches
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn().mockReturnValue('./mods'),
  getContentTypeSchemaId: jest.fn(() => 'schema://default'),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(),
  ...overrides,
});

const createMockDataFetcher = (overrides = {}) => ({
  fetch: jest.fn(),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn(),
  getValidator: jest.fn(() => jest.fn()),
  isSchemaLoaded: jest.fn(),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn(),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ...overrides,
});

let loader;
let mockConfig;
let mockFetcher;
let mockLogger;

beforeEach(() => {
  jest.clearAllMocks();

  mockConfig = createMockConfiguration();
  const mockResolver = createMockPathResolver();
  mockFetcher = createMockDataFetcher();
  const mockValidator = createMockSchemaValidator();
  const mockRegistry = createMockDataRegistry();
  mockLogger = createMockLogger();

  loader = new BaseManifestItemLoader(
    'testType',
    mockConfig,
    mockResolver,
    mockFetcher,
    mockValidator,
    mockRegistry,
    mockLogger
  );
});

describe('BaseManifestItemLoader._getContentTypeSchemaId', () => {
  it('returns schema id from configuration without logging a warning', () => {
    const expectedSchema = 'schema://actions';
    mockConfig.getContentTypeSchemaId.mockReturnValue(expectedSchema);

    const result = loader._getContentTypeSchemaId('actions');

    expect(result).toBe(expectedSchema);
    expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith('actions');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('returns null and logs a warning when configuration lacks schema id', () => {
    mockConfig.getContentTypeSchemaId.mockReturnValue(null);

    const result = loader._getContentTypeSchemaId('components');

    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "BaseManifestItemLoader: Schema ID for content type 'components' not found in configuration."
    );
  });
});

describe('BaseManifestItemLoader.fetchContent', () => {
  it('fetches data and logs the successful fetch message', async () => {
    const path = '/mods/test/mod-file.json';
    const modId = 'test-mod';
    const filename = 'mod-file.json';
    const registryKey = 'items';
    const payload = { some: 'data' };
    mockFetcher.fetch.mockResolvedValue(payload);

    const result = await loader.fetchContent(path, modId, filename, registryKey);

    expect(result).toBe(payload);
    expect(mockFetcher.fetch).toHaveBeenCalledWith(path);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Fetched data from ${path}`
    );
  });

  it('logs detailed diagnostics when fetching handle_drop_item.rule.json', async () => {
    const path = '/mods/test/handle_drop_item.rule.json';
    const modId = 'loot-mod';
    const filename = 'handle_drop_item.rule.json';
    const registryKey = 'rules';
    const payload = { actions: [] };
    mockFetcher.fetch.mockResolvedValue(payload);

    await loader.fetchContent(path, modId, filename, registryKey);

    const diagnosticSnapshot = JSON.stringify(payload, null, 2).substring(0, 500);

    expect(mockFetcher.fetch).toHaveBeenCalledWith(path);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `[${modId}] Fetched data from ${path}`
    );

    const diagnosticCall = mockLogger.debug.mock.calls.find(
      ([message]) =>
        message ===
        '🔍 DEBUG: Raw file content loaded for handle_drop_item.rule.json:'
    );

    expect(diagnosticCall).toBeDefined();
    expect(diagnosticCall[1]).toEqual(
      expect.objectContaining({
        path,
        dataType: 'object',
        isObject: true,
        hasActions: true,
        actionsType: 'array',
        actionsLength: 0,
        dataSnapshot: diagnosticSnapshot,
      })
    );
  });
});
