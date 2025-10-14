import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import * as path from 'node:path';
import { ApiKeyService } from '../../../src/services/apiKeyService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({
  readFile: jest.fn(),
});

const createAppConfigService = (cacheEnabled = true, ttl = 90_000) => ({
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/secure/root'),
  isCacheEnabled: jest.fn(() => cacheEnabled),
  getApiKeyCacheTtl: jest.fn(() => ttl),
});

const createCacheService = () => {
  const store = new Map();
  const service = {
    get: jest.fn((key) => (store.has(key) ? store.get(key) : undefined)),
    set: jest.fn((key, value, ttl) => {
      store.set(key, value);
      service.lastSetArgs = { key, value, ttl };
    }),
    invalidatePattern: jest.fn(),
    getStats: jest.fn(),
    resetStats: jest.fn(),
  };

  return service;
};

describe('ApiKeyService file caching behavior', () => {
  let logger;
  let fsReader;
  let appConfigService;
  let cacheService;
  let apiKeyService;

  beforeEach(() => {
    logger = createLogger();
    fsReader = createFsReader();
    cacheService = createCacheService();
    appConfigService = createAppConfigService();
    apiKeyService = new ApiKeyService(
      logger,
      fsReader,
      appConfigService,
      cacheService
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('caches trimmed API keys and reuses them on subsequent reads', async () => {
    const llmId = 'llm-cached';
    const fileName = 'provider.key';
    const projectRoot = '/secure/root';
    const expectedFullPath = path.join(projectRoot, fileName);
    const expectedCacheKey = `api_key:file:${expectedFullPath}`;

    fsReader.readFile.mockResolvedValue('  cached-secret  ');

    const firstResult = await apiKeyService._readApiKeyFromFile(
      fileName,
      projectRoot,
      llmId
    );

    expect(firstResult).toEqual({ key: 'cached-secret', error: null });
    expect(cacheService.set).toHaveBeenCalledWith(
      expectedCacheKey,
      'cached-secret',
      90_000
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Cached API key for llmId '${llmId}' from '${expectedFullPath}'`
      )
    );

    const secondResult = await apiKeyService._readApiKeyFromFile(
      fileName,
      projectRoot,
      llmId
    );

    expect(secondResult).toEqual({ key: 'cached-secret', error: null });
    expect(fsReader.readFile).toHaveBeenCalledTimes(1);
    expect(cacheService.get).toHaveBeenCalledWith(expectedCacheKey);
    expect(cacheService.set).toHaveBeenCalledTimes(1);

    const cacheDebugLog = logger.debug.mock.calls.find(([message]) =>
      message.includes('Retrieved API key from cache')
    );
    expect(cacheDebugLog).toBeDefined();
  });

  it('skips cache lookups and writes when caching is disabled', async () => {
    appConfigService.isCacheEnabled.mockReturnValue(false);
    fsReader.readFile.mockResolvedValue('no-cache-secret');

    const result = await apiKeyService._readApiKeyFromFile(
      'nocache.key',
      '/secure/root',
      'llm-no-cache'
    );

    expect(result).toEqual({ key: 'no-cache-secret', error: null });
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
  });
});
