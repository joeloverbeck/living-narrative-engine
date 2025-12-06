/**
 * @file api-key-service-all-sources-failure.integration.test.js
 * @description Integration test covering scenarios where all configured API key sources fail.
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

/**
 * Creates a basic logger implementation for integration testing.
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
 * Sets or clears an environment variable while keeping track of prior state.
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

/**
 * Creates a temporary directory for file-system based scenarios.
 * @returns {string}
 */
function createTempDir() {
  const dir = mkdtempSync(
    path.join(os.tmpdir(), 'api-key-all-sources-failure-')
  );
  createdTempDirs.push(dir);
  return dir;
}

/**
 * Builds an ApiKeyService instance with supporting dependencies configured for testing.
 * @param {{ projectRoot: string, cacheEnabled?: boolean }} options
 */
function buildService(options) {
  const { projectRoot, cacheEnabled = false } = options;

  resetAppConfigServiceInstance();

  setEnv('CACHE_ENABLED', cacheEnabled ? 'true' : 'false');
  setEnv('API_KEY_CACHE_TTL', '250');
  setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 8,
    defaultTtl: 250,
    enableAutoCleanup: false,
  });
  const fsReader = new NodeFileSystemReader();

  return {
    service: new ApiKeyService(logger, fsReader, appConfig, cacheService),
    logger,
    cacheService,
    appConfig,
  };
}

describe('ApiKeyService integration - all sources failure', () => {
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
  });

  it('combines environment and file failures into a consolidated error', async () => {
    const envVarName = 'API_KEY_ALL_SOURCES_FAIL';
    setEnv(envVarName, '   ');

    const projectRoot = createTempDir();
    const missingFileName = 'missing-cloud.key';

    const { service, logger } = buildService({
      projectRoot,
      cacheEnabled: false,
    });

    const config = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: missingFileName,
    };

    const result = await service.getApiKey(config, 'unrecoverable-cloud');

    expect(result.apiKey).toBeNull();
    expect(result.source).toBe('N/A');
    expect(result.errorDetails).toMatchObject({
      stage: 'api_key_all_sources_failed',
      details: {
        llmId: 'unrecoverable-cloud',
        attemptedEnvVar: envVarName,
        attemptedFile: missingFileName,
      },
    });

    expect(result.errorDetails.details.reason).toContain(
      `Environment variable '${envVarName}' was not set or empty.`
    );
    expect(result.errorDetails.details.reason).toContain(
      `File '${missingFileName}' retrieval also failed`
    );

    // Ensure that error creation path logged diagnostic information via _createErrorDetails
    const loggedMessages = logger.warn.mock.calls.map((call) => call[0]);
    expect(
      loggedMessages.some((message) =>
        message.includes('ApiKeyService: Error condition encountered')
      )
    ).toBe(true);
  });
});
