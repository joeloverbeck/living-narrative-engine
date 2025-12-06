/**
 * @file api-key-service-multi-source-failures.integration.test.js
 * @description Integration tests exercising ApiKeyService when multiple configured
 *              key sources fail to yield credentials.
 */

import { jest } from '@jest/globals';
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

/** @type {Map<string, string | undefined>} */
const originalEnv = new Map();

/** @type {string[]} */
const tempDirs = [];

/**
 * Captures the original environment value so tests can safely mutate process.env
 * without leaking state between suites.
 * @param {string} key
 */
function snapshotEnv(key) {
  if (!originalEnv.has(key)) {
    originalEnv.set(key, process.env[key]);
  }
}

/**
 * Sets or unsets an environment variable, preserving the initial value for cleanup.
 * @param {string} key
 * @param {string | undefined} value
 */
function setEnv(key, value) {
  snapshotEnv(key);
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * Restores mutated environment variables to their original values.
 */
function restoreEnv() {
  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  originalEnv.clear();
}

/**
 * Creates a deterministic logger spy that records structured messages without
 * muting log calls required for coverage.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger & { isDebugEnabled: boolean }}
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
 * Builds a fully-wired ApiKeyService instance using real collaborators.
 * @param {{ cacheEnabled?: boolean, projectRoot?: string | null }} [options]
 */
function buildService(options = {}) {
  const { cacheEnabled = true, projectRoot = null } = options;

  resetAppConfigServiceInstance();

  setEnv('CACHE_ENABLED', cacheEnabled ? 'true' : 'false');
  setEnv('API_KEY_CACHE_TTL', '90');
  if (projectRoot !== null) {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);
  } else {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);
  }

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 5,
    defaultTtl: 90,
    enableAutoCleanup: false,
  });
  const fsReader = new NodeFileSystemReader();

  const service = new ApiKeyService(logger, fsReader, appConfig, cacheService);

  return { service, logger };
}

/**
 * Registers a temporary directory for automatic cleanup.
 * @returns {string}
 */
function registerTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-multi-source-'));
  tempDirs.push(dir);
  return dir;
}

describe('ApiKeyService multi-source failure integration', () => {
  afterEach(() => {
    resetAppConfigServiceInstance();

    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }

    restoreEnv();
  });

  it('consolidates environment and file failure details when every configured source breaks', async () => {
    const projectRoot = registerTempDir();
    const { service, logger } = buildService({ projectRoot });

    // Ensure the env var path fails first.
    setEnv('MISSING_PROXY_KEY', undefined);

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: 'MISSING_PROXY_KEY',
        apiKeyFileName: 'absent.key',
      },
      'double-failure-llm'
    );

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_all_sources_failed');
    expect(result.errorDetails.details.llmId).toBe('double-failure-llm');
    expect(result.errorDetails.details.attemptedEnvVar).toBe(
      'MISSING_PROXY_KEY'
    );
    expect(result.errorDetails.details.attemptedFile).toBe('absent.key');
    expect(result.errorDetails.details.reason).toContain(
      "Environment variable 'MISSING_PROXY_KEY'"
    );
    expect(result.errorDetails.details.reason).toContain("File 'absent.key'");
    expect(result.errorDetails.details.originalErrorMessage).toContain(
      'ENOENT'
    );

    // _createErrorDetails logs every structured failure — verify the combined stage was logged.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('api_key_all_sources_failed'),
      expect.objectContaining({
        details: expect.objectContaining({
          attemptedEnvVar: 'MISSING_PROXY_KEY',
          attemptedFile: 'absent.key',
        }),
      })
    );

    // Ensure the upstream file failure was also surfaced to the logger for coverage completeness.
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('api_key_file_not_found_or_unreadable'),
      expect.objectContaining({
        details: expect.objectContaining({ attemptedFile: expect.any(String) }),
      })
    );
  });
});
