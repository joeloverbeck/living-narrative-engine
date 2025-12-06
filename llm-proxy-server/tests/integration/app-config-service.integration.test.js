import http from 'http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { jest } from '@jest/globals';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import {
  API_KEY_CACHE_TTL,
  CACHE_DEFAULT_MAX_SIZE,
  CACHE_DEFAULT_TTL,
  DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED,
  DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE,
  DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL,
  DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES,
  DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE,
  DEBUG_LOGGING_DEFAULT_RETENTION_DAYS,
  DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE,
  HTTP_AGENT_FREE_SOCKET_TIMEOUT,
  HTTP_AGENT_KEEP_ALIVE,
  HTTP_AGENT_MAX_FREE_SOCKETS,
  HTTP_AGENT_MAX_SOCKETS,
  HTTP_AGENT_MAX_TOTAL_SOCKETS,
  HTTP_AGENT_MAX_IDLE_TIME,
  HTTP_AGENT_TIMEOUT,
  SALVAGE_DEFAULT_TTL,
  SALVAGE_MAX_ENTRIES,
} from '../../src/config/constants.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { ResponseSalvageService } from '../../src/services/responseSalvageService.js';

function createTestLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

function restoreEnv(originalEnv) {
  const currentKeys = Object.keys(process.env);
  for (const key of currentKeys) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe('AppConfigService integration coverage', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    restoreEnv(originalEnv);
    resetAppConfigServiceInstance();
    jest.useRealTimers();
  });

  it('applies environment overrides across dependent services', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'app-config-int-'));
    const tempLogsDir = path.join(tempDir, 'logs');

    process.env.PROXY_PORT = '4100';
    process.env.LLM_CONFIG_PATH = path.join(tempDir, 'llm-config.json');
    process.env.PROXY_ALLOWED_ORIGIN =
      'https://example.com,https://example.org';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = tempDir;
    process.env.NODE_ENV = 'production';

    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_DEFAULT_TTL = '40';
    process.env.CACHE_MAX_SIZE = '2';
    process.env.API_KEY_CACHE_TTL = '75';

    process.env.HTTP_AGENT_ENABLED = 'true';
    process.env.HTTP_AGENT_KEEP_ALIVE = 'false';
    process.env.HTTP_AGENT_MAX_SOCKETS = '3';
    process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '1';
    process.env.HTTP_AGENT_TIMEOUT = '5000';
    process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '2000';
    process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '10';
    process.env.HTTP_AGENT_MAX_IDLE_TIME = '4000';

    process.env.SALVAGE_DEFAULT_TTL = '30';
    process.env.SALVAGE_MAX_ENTRIES = '5';

    process.env.DEBUG_LOGGING_ENABLED = 'false';
    process.env.DEBUG_LOGGING_PATH = tempLogsDir;
    process.env.DEBUG_LOGGING_RETENTION_DAYS = '30';
    process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '5MB';
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '256';
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '250';
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '7';
    process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 3 * * *';
    process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'false';
    process.env.DEBUG_LOGGING_COMPRESSION = 'true';

    const appConfigLogger = createTestLogger();
    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(appConfigLogger);

    expect(appConfig.getProxyPort()).toBe(4100);
    expect(appConfig.isProxyPortDefaulted()).toBe(false);
    expect(appConfig.getLlmConfigPath()).toBe(process.env.LLM_CONFIG_PATH);
    expect(appConfig.getAllowedOriginsArray()).toEqual([
      'https://example.com',
      'https://example.org',
    ]);
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBe(tempDir);
    expect(appConfig.isProduction()).toBe(true);
    expect(appConfig.isDevelopment()).toBe(false);

    const cacheConfig = appConfig.getCacheConfig();
    expect(cacheConfig).toEqual({
      enabled: true,
      defaultTtl: 40,
      maxSize: 2,
      apiKeyCacheTtl: 75,
    });

    jest.useFakeTimers();
    const cacheLogger = createTestLogger();
    const ttlCacheService = new CacheService(cacheLogger, {
      maxSize: cacheConfig.maxSize,
      defaultTtl: cacheConfig.defaultTtl,
      enableAutoCleanup: false,
    });
    ttlCacheService.set('ttl-check', 'value');
    expect(ttlCacheService.get('ttl-check')).toBe('value');
    await jest.advanceTimersByTimeAsync(cacheConfig.defaultTtl + 5);
    expect(ttlCacheService.get('ttl-check')).toBeUndefined();
    ttlCacheService.cleanup();
    jest.useRealTimers();

    const cacheService = new CacheService(cacheLogger, {
      maxSize: cacheConfig.maxSize,
      defaultTtl: cacheConfig.defaultTtl,
      enableAutoCleanup: false,
    });
    const apiKeyService = new ApiKeyService(
      createTestLogger(),
      new NodeFileSystemReader(),
      appConfig,
      cacheService
    );

    process.env.TEST_API_KEY_ENV = 'env-secret';
    const llmConfig = {
      apiType: 'openai',
      apiKeyEnvVar: 'TEST_API_KEY_ENV',
      apiKeyFileName: 'api-key.txt',
    };

    const envResult = await apiKeyService.getApiKey(llmConfig, 'llm-env');
    expect(envResult.apiKey).toBe('env-secret');
    expect(envResult.source).toContain(
      "environment variable 'TEST_API_KEY_ENV'"
    );

    delete process.env.TEST_API_KEY_ENV;
    const apiKeyPath = path.join(tempDir, 'api-key.txt');
    await writeFile(apiKeyPath, 'file-secret', 'utf-8');

    const fileResult = await apiKeyService.getApiKey(llmConfig, 'llm-file');
    expect(fileResult.apiKey).toBe('file-secret');
    expect(fileResult.source).toBe("file 'api-key.txt'");

    await rm(apiKeyPath);
    const cachedResult = await apiKeyService.getApiKey(llmConfig, 'llm-file');
    expect(cachedResult.apiKey).toBe('file-secret');

    const httpServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ path: req.url }));
    });

    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start HTTP server for integration test');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const httpConfig = appConfig.getHttpAgentConfig();
    const httpAgentService = new HttpAgentService(createTestLogger(), {
      ...httpConfig,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 25,
      minCleanupIntervalMs: 10,
    });

    const agent = httpAgentService.getAgent(`${baseUrl}/config`);
    expect(agent.options.keepAlive).toBe(false);
    expect(agent.maxSockets).toBe(3);
    expect(agent.maxFreeSockets).toBe(1);

    const response = await fetch(`${baseUrl}/config`, { agent });
    const payload = await response.json();
    expect(payload.path).toBe('/config');

    httpAgentService.cleanup();
    await new Promise((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    jest.useFakeTimers();
    const salvageConfig = appConfig.getSalvageConfig();
    const salvageService = new ResponseSalvageService(createTestLogger(), {
      defaultTtl: salvageConfig.defaultTtl,
      maxEntries: salvageConfig.maxEntries,
    });
    salvageService.salvageResponse(
      'req-1',
      'llm-test',
      { model: 'm', messages: [] },
      { ok: true },
      200
    );
    expect(salvageService.retrieveByRequestId('req-1')).not.toBeNull();
    await jest.advanceTimersByTimeAsync(salvageConfig.defaultTtl + 5);
    expect(salvageService.retrieveByRequestId('req-1')).toBeNull();
    jest.useRealTimers();

    const debugConfig = appConfig.getDebugLoggingConfig();
    expect(debugConfig).toEqual({
      enabled: false,
      storage: {
        path: tempLogsDir,
        retentionDays: 30,
        maxFileSize: '5MB',
        compression: true,
      },
      performance: {
        writeBufferSize: 256,
        flushInterval: 250,
        maxConcurrentWrites: 7,
      },
      cleanup: {
        schedule: '0 3 * * *',
        enabled: false,
      },
    });

    await rm(tempDir, { recursive: true, force: true });
  });

  it('recovers gracefully from invalid environment configuration', async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), 'app-config-int-invalid-')
    );
    process.env.PROXY_PORT = 'not-a-number';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = tempDir;
    // Explicitly clear any previously configured allowed origins to simulate
    // an invalid configuration rather than inheriting values from other tests.
    process.env.PROXY_ALLOWED_ORIGIN = '   ';

    process.env.CACHE_ENABLED = 'false';
    process.env.CACHE_DEFAULT_TTL = 'NaN';
    process.env.CACHE_MAX_SIZE = '-10';
    process.env.API_KEY_CACHE_TTL = 'oops';

    process.env.HTTP_AGENT_ENABLED = 'true';
    process.env.HTTP_AGENT_KEEP_ALIVE = 'maybe';
    process.env.HTTP_AGENT_MAX_SOCKETS = '0';
    process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '-5';
    process.env.HTTP_AGENT_TIMEOUT = 'bad';
    process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = 'invalid';
    process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '-1';
    process.env.HTTP_AGENT_MAX_IDLE_TIME = '-1';

    process.env.SALVAGE_DEFAULT_TTL = '-5';
    process.env.SALVAGE_MAX_ENTRIES = '0';

    process.env.DEBUG_LOGGING_ENABLED = 'maybe';
    process.env.DEBUG_LOGGING_RETENTION_DAYS = '999';
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '0';
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '50';
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '0';

    const appConfigLogger = createTestLogger();
    resetAppConfigServiceInstance();
    const appConfig = getAppConfigService(appConfigLogger);

    expect(appConfig.getProxyPort()).toBe(3001);
    expect(appConfig.isProxyPortDefaulted()).toBe(true);
    expect(appConfig.getAllowedOriginsArray()).toEqual([]);
    expect(appConfig.getCacheConfig()).toEqual({
      enabled: false,
      defaultTtl: CACHE_DEFAULT_TTL,
      maxSize: CACHE_DEFAULT_MAX_SIZE,
      apiKeyCacheTtl: API_KEY_CACHE_TTL,
    });

    const httpConfig = appConfig.getHttpAgentConfig();
    expect(httpConfig).toEqual({
      enabled: true,
      keepAlive: false,
      maxSockets: HTTP_AGENT_MAX_SOCKETS,
      maxFreeSockets: HTTP_AGENT_MAX_FREE_SOCKETS,
      timeout: HTTP_AGENT_TIMEOUT,
      freeSocketTimeout: HTTP_AGENT_FREE_SOCKET_TIMEOUT,
      maxTotalSockets: HTTP_AGENT_MAX_TOTAL_SOCKETS,
      maxIdleTime: HTTP_AGENT_MAX_IDLE_TIME,
    });

    const salvageConfig = appConfig.getSalvageConfig();
    expect(salvageConfig).toEqual({
      defaultTtl: SALVAGE_DEFAULT_TTL,
      maxEntries: SALVAGE_MAX_ENTRIES,
    });

    const debugConfig = appConfig.getDebugLoggingConfig();
    expect(debugConfig.enabled).toBe(false);
    expect(debugConfig.storage.retentionDays).toBe(
      DEBUG_LOGGING_DEFAULT_RETENTION_DAYS
    );
    expect(debugConfig.performance.writeBufferSize).toBe(
      DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE
    );
    expect(debugConfig.performance.flushInterval).toBe(
      DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL
    );
    expect(debugConfig.performance.maxConcurrentWrites).toBe(
      DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES
    );
    expect(debugConfig.cleanup.schedule).toBe(
      DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE
    );
    expect(debugConfig.cleanup.enabled).toBe(
      DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED
    );

    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('PROXY_PORT found in environment')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('CACHE_DEFAULT_TTL invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('CACHE_MAX_SIZE invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('API_KEY_CACHE_TTL invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_MAX_SOCKETS invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_MAX_FREE_SOCKETS invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_TIMEOUT invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_MAX_TOTAL_SOCKETS invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('HTTP_AGENT_MAX_IDLE_TIME invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('SALVAGE_DEFAULT_TTL invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('SALVAGE_MAX_ENTRIES invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('DEBUG_LOGGING_RETENTION_DAYS invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('DEBUG_LOGGING_WRITE_BUFFER_SIZE invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('DEBUG_LOGGING_FLUSH_INTERVAL invalid')
      )
    ).toBe(true);
    expect(
      appConfigLogger.warn.mock.calls.some(([msg]) =>
        msg.includes('DEBUG_LOGGING_MAX_CONCURRENT_WRITES invalid')
      )
    ).toBe(true);

    const cacheLogger = createTestLogger();
    const cacheService = new CacheService(cacheLogger, {
      maxSize: CACHE_DEFAULT_MAX_SIZE,
      defaultTtl: CACHE_DEFAULT_TTL,
      enableAutoCleanup: false,
    });

    const reader = new NodeFileSystemReader();
    const apiKeyService = new ApiKeyService(
      createTestLogger(),
      reader,
      appConfig,
      cacheService
    );

    const keyPath = path.join(tempDir, 'api-key.txt');
    await writeFile(keyPath, 'first-value', 'utf-8');
    const llmConfig = {
      apiType: 'openai',
      apiKeyFileName: 'api-key.txt',
    };

    const firstRead = await apiKeyService.getApiKey(llmConfig, 'llm-invalid');
    expect(firstRead.apiKey).toBe('first-value');
    await writeFile(keyPath, 'updated-value', 'utf-8');
    const secondRead = await apiKeyService.getApiKey(llmConfig, 'llm-invalid');
    expect(secondRead.apiKey).toBe('updated-value');

    const httpServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    await new Promise((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start HTTP server for invalid config test');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const httpAgentService = new HttpAgentService(createTestLogger(), {
      ...httpConfig,
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 25,
      minCleanupIntervalMs: 10,
    });
    const agent = httpAgentService.getAgent(baseUrl);
    const res = await fetch(baseUrl, { agent });
    expect(res.status).toBe(200);
    httpAgentService.cleanup();
    await new Promise((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    jest.useFakeTimers();
    const salvageService = new ResponseSalvageService(createTestLogger(), {});
    salvageService.salvageResponse(
      'req-invalid',
      'llm',
      { model: 'm', messages: [] },
      { ok: true },
      200,
      SALVAGE_DEFAULT_TTL
    );
    expect(salvageService.retrieveByRequestId('req-invalid')).not.toBeNull();
    await jest.advanceTimersByTimeAsync(SALVAGE_DEFAULT_TTL + 5);
    expect(salvageService.retrieveByRequestId('req-invalid')).toBeNull();
    jest.useRealTimers();

    await rm(tempDir, { recursive: true, force: true });
  });
});
