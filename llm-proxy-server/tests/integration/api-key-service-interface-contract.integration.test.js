/**
 * @file api-key-service-interface-contract.integration.test.js
 * @description Ensures ApiKeyService handles scenarios where its collaborators do not implement
 *              the expected server utility interfaces, exercising the defensive error paths that
 *              rely on those contracts.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import {
  IFileSystemReader,
  IEnvironmentVariableReader,
} from '../../src/utils/IServerUtils.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
 * Creates a Jest-backed logger compatible with ILogger.
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

const envSnapshot = {};
const createdTempDirs = [];

/**
 * Sets or clears an environment variable while tracking original values for restoration.
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

describe('ApiKeyService interface contract integration', () => {
  beforeEach(() => {
    resetAppConfigServiceInstance();
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'api-key-contract-'));
    createdTempDirs.push(tempDir);

    setEnv('CACHE_ENABLED', 'true');
    setEnv('API_KEY_CACHE_TTL', '120');
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', tempDir);
  });

  afterEach(() => {
    resetAppConfigServiceInstance();

    for (const dir of createdTempDirs.splice(0, createdTempDirs.length)) {
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

    jest.restoreAllMocks();
  });

  it('surfaces descriptive failures when a non-implemented file reader is provided', async () => {
    const logger = createLogger();
    const appConfig = getAppConfigService(logger);
    const cacheService = new CacheService(logger, {
      maxSize: 4,
      defaultTtl: appConfig.getApiKeyCacheTtl(),
      enableAutoCleanup: false,
    });

    const faultyReader = new IFileSystemReader();
    const service = new ApiKeyService(
      logger,
      faultyReader,
      appConfig,
      cacheService
    );

    const result = await service.getApiKey(
      {
        apiType: 'openai',
        apiKeyEnvVar: undefined,
        apiKeyFileName: 'contract.key',
      },
      'llm-interface'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_file_read_exception');
    expect(result.errorDetails.details.reason).toBe(
      'Unexpected file system/read error.'
    );
    expect(result.errorDetails.details.originalErrorMessage).toBe(
      'IFileSystemReader.readFile method not implemented.'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected error reading API key file.'),
      expect.objectContaining({
        llmId: 'llm-interface',
        originalError: expect.objectContaining({
          message: 'IFileSystemReader.readFile method not implemented.',
        }),
      })
    );

    const envReader = new IEnvironmentVariableReader();
    expect(() => envReader.getEnv('SHOULD_FAIL')).toThrow(
      'IEnvironmentVariableReader.getEnv method not implemented.'
    );
  });
});
