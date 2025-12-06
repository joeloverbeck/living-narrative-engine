/**
 * @file api-key-service-all-sources-message-fallback.integration.test.js
 * @description Integration coverage for ApiKeyService combining environment and file failures
 *              when downstream file error metadata omits detailed reasons.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Custom ApiKeyService variant that strips detailed reason metadata from file-read errors
 * to simulate minimal error payloads coming from the filesystem layer.
 */
class ReasonStrippingApiKeyService extends ApiKeyService {
  #stripMessage = false;

  /**
   * Enables additional stripping of the error message field for fallback coverage.
   */
  enableMessageStripping() {
    this.#stripMessage = true;
  }

  /**
   * @override
   */
  async _readApiKeyFromFile(fileName, projectRootPath, llmId) {
    const result = await super._readApiKeyFromFile(
      fileName,
      projectRootPath,
      llmId
    );

    if (result?.error?.details) {
      delete result.error.details.reason;
      if (this.#stripMessage && result.error.message) {
        delete result.error.message;
      }
    }

    return result;
  }
}

const envSnapshot = {};
const tempDirs = [];

/**
 * Basic logger implementation capturing debug/info/warn/error calls.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
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

/**
 * Tracks environment mutations so they can be restored after each test.
 * @param {string} key
 * @param {string | undefined} value
 */
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

describe('ApiKeyService integration - combined failure message fallback', () => {
  afterEach(() => {
    resetAppConfigServiceInstance();

    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }

    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
      delete envSnapshot[key];
    }
  });

  it('uses the file error message when detailed reason metadata is missing', async () => {
    const envVarName = 'API_KEY_MESSAGE_ONLY_FAILURE';
    const llmId = 'llm-message-only';
    const missingFile = 'absent.key';

    setEnv(envVarName, '   ');

    const tempRoot = mkdtempSync(
      path.join(os.tmpdir(), 'api-key-message-fallback-')
    );
    tempDirs.push(tempRoot);

    setEnv('CACHE_ENABLED', 'false');
    setEnv('API_KEY_CACHE_TTL', '250');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempRoot);

    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 250,
      enableAutoCleanup: false,
    });
    const fsReader = new NodeFileSystemReader();

    const service = new ReasonStrippingApiKeyService(
      logger,
      fsReader,
      appConfig,
      cacheService
    );

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: envVarName,
        apiKeyFileName: missingFile,
      },
      llmId
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toMatchObject({
      stage: 'api_key_all_sources_failed',
      details: {
        llmId,
        attemptedEnvVar: envVarName,
        attemptedFile: missingFile,
      },
    });

    const combinedReason = result.errorDetails?.details.reason;
    expect(combinedReason).toBeDefined();
    expect(combinedReason).toContain(
      `Environment variable '${envVarName}' was not set or empty.`
    );
    expect(combinedReason).toContain(
      'Reason: API key file not found or not readable.'
    );
    expect(combinedReason).not.toContain('see previous logs');
  });

  it('falls back to generic guidance when both message and reason details are absent', async () => {
    const envVarName = 'API_KEY_NO_METADATA_FAILURE';
    const llmId = 'llm-generic-fallback';
    const missingFile = 'missing.key';

    setEnv(envVarName, '');

    const tempRoot = mkdtempSync(
      path.join(os.tmpdir(), 'api-key-generic-fallback-')
    );
    tempDirs.push(tempRoot);

    setEnv('CACHE_ENABLED', 'false');
    setEnv('API_KEY_CACHE_TTL', '250');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempRoot);

    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: 250,
      enableAutoCleanup: false,
    });
    const fsReader = new NodeFileSystemReader();

    const service = new ReasonStrippingApiKeyService(
      logger,
      fsReader,
      appConfig,
      cacheService
    );
    service.enableMessageStripping();

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: envVarName,
        apiKeyFileName: missingFile,
      },
      llmId
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_all_sources_failed');

    const combinedReason = result.errorDetails?.details.reason;
    expect(combinedReason).toBeDefined();
    expect(combinedReason).toContain(
      `Environment variable '${envVarName}' was not set or empty.`
    );
    expect(combinedReason).toContain('Reason: see previous logs');
  });
});
