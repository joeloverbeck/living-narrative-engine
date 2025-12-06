import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

const envSnapshot = {};
let tempProjectRoot;

function setEnv(key, value) {
  if (!Object.prototype.hasOwnProperty.call(envSnapshot, key)) {
    envSnapshot[key] = process.env[key];
  }

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
    delete envSnapshot[key];
  }
}

function createProjectRoot() {
  return mkdtempSync(path.join(os.tmpdir(), 'api-key-path-'));
}

describe('ApiKeyService integration: path normalization with real collaborators', () => {
  beforeEach(() => {
    resetAppConfigServiceInstance();
    tempProjectRoot = createProjectRoot();

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '750');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempProjectRoot);
  });

  afterEach(() => {
    resetAppConfigServiceInstance();

    if (tempProjectRoot) {
      rmSync(tempProjectRoot, { recursive: true, force: true });
      tempProjectRoot = undefined;
    }

    restoreEnv();
    jest.restoreAllMocks();
  });

  it('normalizes path traversal attempts before reading API keys and caches the sanitized path', async () => {
    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 8,
      defaultTtl: 1000,
      enableAutoCleanup: false,
    });
    const fileReader = new NodeFileSystemReader();
    const service = new ApiKeyService(
      logger,
      fileReader,
      appConfig,
      cacheService
    );

    const sanitizedFileName = 'normalized.key';
    const attemptedFileName = '../outside/../normalized.key';
    const keyContents = 'persisted-integration-secret';
    const onDiskPath = path.join(tempProjectRoot, sanitizedFileName);
    writeFileSync(onDiskPath, keyContents, 'utf-8');

    const envVarName = 'API_KEY_SANITIZED_TEST';
    setEnv(envVarName, '   ');

    const llmConfig = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: attemptedFileName,
    };

    const firstResult = await service.getApiKey(
      llmConfig,
      'llm-path-normalization'
    );

    expect(firstResult).toEqual({
      apiKey: keyContents,
      errorDetails: null,
      source: `file '${attemptedFileName}'`,
    });

    const normalizationWarning = logger.warn.mock.calls.find(([message]) =>
      message.includes("was normalized to 'normalized.key'")
    );
    expect(normalizationWarning).toBeDefined();

    rmSync(onDiskPath, { force: true });

    const secondResult = await service.getApiKey(
      llmConfig,
      'llm-path-normalization'
    );

    expect(secondResult).toEqual({
      apiKey: keyContents,
      errorDetails: null,
      source: `file '${attemptedFileName}'`,
    });

    const cacheHitLog = logger.debug.mock.calls.find(([message]) =>
      message.includes(
        'ApiKeyService._readApiKeyFromFile: Retrieved API key from cache'
      )
    );
    expect(cacheHitLog).toBeDefined();

    cacheService.cleanup();
  });
});
