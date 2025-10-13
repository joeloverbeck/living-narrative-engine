/**
 * @file api-key-service-local-flows.integration.test.js
 * @description Integration tests covering ApiKeyService scenarios where API keys are optional
 *              or only provided through environment variables, ensuring early-return and
 *              fallback behaviours are exercised with real collaborators.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
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
 * Creates a lightweight logger compatible with ILogger for integration verification.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  logger.isDebugEnabled = false;
  return logger;
}

const envSnapshot = {};
const createdTempDirs = [];

/**
 * Sets or clears an environment variable while remembering the original value for cleanup.
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
 * Creates a unique temporary directory for tests that require a project root.
 * @returns {string}
 */
function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-local-'));
  createdTempDirs.push(dir);
  return dir;
}

/**
 * Builds a fully wired ApiKeyService instance with real collaborators.
 * @param {{ cacheEnabled?: boolean, projectRoot?: string | null }} [options]
 * @returns {ApiKeyService}
 */
function buildService(options = {}) {
  const { cacheEnabled = true, projectRoot = null } = options;

  resetAppConfigServiceInstance();

  setEnv('CACHE_ENABLED', cacheEnabled ? 'true' : 'false');
  setEnv('API_KEY_CACHE_TTL', '250');

  if (projectRoot !== null) {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);
  } else {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);
  }

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 8,
    defaultTtl: 250,
    enableAutoCleanup: false,
  });
  const fsReader = new NodeFileSystemReader();

  return new ApiKeyService(logger, fsReader, appConfig, cacheService);
}

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

describe('ApiKeyService local and environment-only flows', () => {
  it('skips retrieval work when API keys are not required for local providers', async () => {
    const projectRoot = createTempDir();
    const service = buildService({ cacheEnabled: true, projectRoot });

    expect(service.isApiKeyRequired(null)).toBe(false);
    expect(service.isApiKeyRequired({})).toBe(false);
    expect(service.isApiKeyRequired({ apiType: 'ollama' })).toBe(false);

    const envOnlyKey = 'LOCAL_MODEL_SHOULD_IGNORE';
    setEnv(envOnlyKey, 'should-not-be-used');

    const result = await service.getApiKey(
      {
        apiType: 'ollama',
        apiKeyEnvVar: envOnlyKey,
        apiKeyFileName: 'ignored.key',
      },
      'ollama-local'
    );

    expect(result).toEqual({
      apiKey: null,
      errorDetails: null,
      source: 'Not applicable (local LLM or no key needed)',
    });
  });

  it('provides detailed errors when an environment variable is the only source and empty', async () => {
    const service = buildService({ cacheEnabled: false, projectRoot: null });
    const envVarName = 'ENV_ONLY_MISSING_KEY';
    setEnv(envVarName, '   ');

    const config = {
      apiType: 'OpenAI',
      apiKeyEnvVar: envVarName,
      apiKeyFileName: undefined,
    };

    expect(service.isApiKeyRequired(config)).toBe(true);

    const result = await service.getApiKey(config, 'env-only');

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails?.stage).toBe('api_key_env_var_not_set_or_empty');
    expect(result.errorDetails?.details?.attemptedEnvVar).toBe(envVarName);
    expect(result.source).toBe('N/A');
  });
});
