/**
 * @file app-config-getters.integration.test.js
 * @description Integration test exercising AppConfigService getter methods alongside collaborating services.
 */

import http from 'http';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { jest } from '@jest/globals';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import CacheService from '../../src/services/cacheService.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import ResponseSalvageService from '../../src/services/responseSalvageService.js';

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

describe('AppConfigService getter integration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    restoreEnv(originalEnv);
    resetAppConfigServiceInstance();
    jest.useRealTimers();
  });

  it('wires getter outputs into collaborating services using live resources', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'app-config-getters-'));
    const logsDir = path.join(tempRoot, 'logs-directory');
    await mkdir(logsDir, { recursive: true });

    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = tempRoot;
    process.env.CACHE_ENABLED = 'true';
    process.env.CACHE_DEFAULT_TTL = '25';
    process.env.CACHE_MAX_SIZE = '2';
    process.env.API_KEY_CACHE_TTL = '40';
    process.env.HTTP_AGENT_ENABLED = 'true';
    process.env.HTTP_AGENT_KEEP_ALIVE = 'false';
    process.env.HTTP_AGENT_MAX_SOCKETS = '3';
    process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '1';
    process.env.HTTP_AGENT_TIMEOUT = '1200';
    process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '600';
    process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '7';
    process.env.HTTP_AGENT_MAX_IDLE_TIME = '900';
    process.env.SALVAGE_DEFAULT_TTL = '40';
    process.env.SALVAGE_MAX_ENTRIES = '2';
    process.env.DEBUG_LOGGING_ENABLED = 'true';
    process.env.DEBUG_LOGGING_PATH = logsDir;
    process.env.DEBUG_LOGGING_RETENTION_DAYS = '14';
    process.env.DEBUG_LOGGING_MAX_FILE_SIZE = '15MB';
    process.env.DEBUG_LOGGING_WRITE_BUFFER_SIZE = '512';
    process.env.DEBUG_LOGGING_FLUSH_INTERVAL = '750';
    process.env.DEBUG_LOGGING_MAX_CONCURRENT_WRITES = '6';
    process.env.DEBUG_LOGGING_CLEANUP_SCHEDULE = '0 4 * * *';
    process.env.DEBUG_LOGGING_CLEANUP_ENABLED = 'true';
    process.env.DEBUG_LOGGING_COMPRESSION = 'true';

    const logger = createTestLogger();
    const appConfig = getAppConfigService(logger);

    expect(appConfig.isCacheEnabled()).toBe(true);
    const cacheTtl = appConfig.getCacheDefaultTtl();
    const cacheMaxSize = appConfig.getCacheMaxSize();
    const apiKeyCacheTtl = appConfig.getApiKeyCacheTtl();
    expect(cacheTtl).toBe(25);
    expect(cacheMaxSize).toBe(2);
    expect(apiKeyCacheTtl).toBe(40);

    const cacheLogger = createTestLogger();
    const cacheService = new CacheService(cacheLogger, {
      maxSize: cacheMaxSize,
      defaultTtl: cacheTtl,
      enableAutoCleanup: false,
    });

    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });

    cacheService.set('ttl-key', 'value');
    expect(cacheService.get('ttl-key')).toBe('value');
    await jest.advanceTimersByTimeAsync(cacheTtl - 5);
    expect(cacheService.get('ttl-key')).toBe('value');
    await jest.advanceTimersByTimeAsync(10);
    expect(cacheService.get('ttl-key')).toBeUndefined();

    cacheService.set('first', 'a');
    cacheService.set('second', 'b');
    cacheService.set('third', 'c');
    expect(cacheService.get('first')).toBeUndefined();
    expect(cacheService.get('second')).toBe('b');
    expect(cacheService.get('third')).toBe('c');

    const fsReader = new NodeFileSystemReader();
    const apiKeyLogger = createTestLogger();
    const apiKeyService = new ApiKeyService(
      apiKeyLogger,
      fsReader,
      appConfig,
      cacheService
    );

    const apiKeyPath = path.join(tempRoot, 'api-key.txt');
    const llmConfig = { apiType: 'openai', apiKeyFileName: 'api-key.txt' };

    await writeFile(apiKeyPath, 'initial-secret', 'utf-8');
    const firstKey = await apiKeyService.getApiKey(llmConfig, 'llm-cache');
    expect(firstKey.apiKey).toBe('initial-secret');

    await writeFile(apiKeyPath, 'updated-secret', 'utf-8');
    const cachedKey = await apiKeyService.getApiKey(llmConfig, 'llm-cache');
    expect(cachedKey.apiKey).toBe('initial-secret');

    await jest.advanceTimersByTimeAsync(apiKeyCacheTtl + 5);
    const refreshedKey = await apiKeyService.getApiKey(llmConfig, 'llm-cache');
    expect(refreshedKey.apiKey).toBe('updated-secret');

    jest.useRealTimers();
    cacheService.cleanup();

    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start HTTP server for http agent coverage');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    expect(appConfig.isHttpAgentEnabled()).toBe(true);
    const httpAgentService = new HttpAgentService(createTestLogger(), {
      keepAlive: appConfig.getHttpAgentKeepAlive(),
      maxSockets: appConfig.getHttpAgentMaxSockets(),
      maxFreeSockets: appConfig.getHttpAgentMaxFreeSockets(),
      timeout: appConfig.getHttpAgentTimeout(),
      freeSocketTimeout: appConfig.getHttpAgentFreeSocketTimeout(),
      maxTotalSockets: appConfig.getHttpAgentMaxTotalSockets(),
      maxIdleTime: appConfig.getHttpAgentMaxIdleTime(),
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 25,
    });

    const agent = httpAgentService.getAgent(`${baseUrl}/check`);
    const response = await fetch(`${baseUrl}/check`, { agent });
    const payload = await response.json();
    expect(payload).toEqual({ ok: true, path: '/check' });

    expect(agent.maxSockets).toBe(3);
    expect(agent.maxFreeSockets).toBe(1);
    expect(httpAgentService.getConfig()).toEqual(
      expect.objectContaining({
        keepAlive: false,
        maxSockets: 3,
        maxFreeSockets: 1,
        timeout: 1200,
        freeSocketTimeout: 600,
        maxTotalSockets: 7,
        maxIdleTime: 900,
      })
    );

    httpAgentService.cleanup();
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    const salvageLogger = createTestLogger();
    const salvageService = new ResponseSalvageService(salvageLogger, {
      defaultTtl: appConfig.getSalvageDefaultTtl(),
      maxEntries: appConfig.getSalvageMaxEntries(),
    });

    salvageService.salvageResponse(
      'req-1',
      'llm-one',
      { model: 'm', messages: [] },
      { ok: true },
      200
    );
    expect(salvageService.retrieveByRequestId('req-1')).not.toBeNull();
    await jest.advanceTimersByTimeAsync(appConfig.getSalvageDefaultTtl() + 5);
    expect(salvageService.retrieveByRequestId('req-1')).toBeNull();
    salvageService.clear();
    jest.useRealTimers();

    expect(appConfig.isDebugLoggingEnabled()).toBe(false);
    expect(appConfig.getDebugLoggingPath()).toBe('');
    expect(appConfig.getDebugLoggingRetentionDays()).toBe(0);
    expect(appConfig.getDebugLoggingMaxFileSize()).toBe('15MB');
    expect(appConfig.getDebugLoggingWriteBufferSize()).toBe(512);
    expect(appConfig.getDebugLoggingFlushInterval()).toBe(750);
    expect(appConfig.getDebugLoggingMaxConcurrentWrites()).toBe(6);
    expect(appConfig.getDebugLoggingCleanupSchedule()).toBe('0 4 * * *');
    expect(appConfig.isDebugLoggingCleanupEnabled()).toBe(true);
    expect(appConfig.isDebugLoggingCompressionEnabled()).toBe(true);

    const debugConfig = appConfig.getDebugLoggingConfig();
    expect(debugConfig).toEqual({
      enabled: true,
      storage: {
        path: logsDir,
        retentionDays: 14,
        maxFileSize: '15MB',
        compression: true,
      },
      performance: {
        writeBufferSize: 512,
        flushInterval: 750,
        maxConcurrentWrites: 6,
      },
      cleanup: {
        schedule: '0 4 * * *',
        enabled: true,
      },
    });

    const logFile = path.join(debugConfig.storage.path, 'integration.log');
    await writeFile(logFile, 'debug log placeholder', 'utf-8');

    await rm(tempRoot, { recursive: true, force: true });
  });
});
