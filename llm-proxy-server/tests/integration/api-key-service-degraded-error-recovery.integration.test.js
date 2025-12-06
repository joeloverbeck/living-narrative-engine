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
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

/**
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

class UnstableApiKeyService extends ApiKeyService {
  /**
   * @param {import('../../src/interfaces/coreServices.js').ILogger} logger
   * @param {import('../../src/interfaces/IFileSystemReader.js').IFileSystemReader} fileSystemReader
   * @param {import('../../src/config/appConfig.js').AppConfigService} appConfigService
   * @param {CacheService} cacheService
   */
  constructor(logger, fileSystemReader, appConfigService, cacheService) {
    super(logger, fileSystemReader, appConfigService, cacheService);
    this.__stagesToNull = new Set();
  }

  /**
   * @param {string[]} stages
   */
  configureNullStages(stages) {
    this.__stagesToNull = new Set(stages);
  }

  /** @override */
  _createErrorDetails(message, stage, detailsContext, originalError = null) {
    if (this.__stagesToNull?.has(stage)) {
      return null;
    }

    return super._createErrorDetails(
      message,
      stage,
      detailsContext,
      originalError
    );
  }
}

const envSnapshot = {};
const tempDirectories = [];

/**
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
 * @returns {string}
 */
function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'api-key-degraded-'));
  tempDirectories.push(dir);
  return dir;
}

/**
 * @param {{ cacheEnabled?: boolean; projectRoot?: string | null; nullStages?: string[] }} [options]
 */
function buildService(options = {}) {
  const { cacheEnabled = false, projectRoot = null, nullStages = [] } = options;

  resetAppConfigServiceInstance();

  setEnv('CACHE_ENABLED', cacheEnabled ? 'true' : 'false');
  setEnv('API_KEY_CACHE_TTL', '200');

  if (projectRoot !== null) {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', projectRoot);
  } else {
    setEnv('PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES', undefined);
  }

  const logger = createLogger();
  const appConfig = getAppConfigService(logger);
  const cacheService = new CacheService(logger, {
    maxSize: 8,
    defaultTtl: 200,
    enableAutoCleanup: false,
  });
  const fsReader = new NodeFileSystemReader();

  const service = new UnstableApiKeyService(
    logger,
    fsReader,
    appConfig,
    cacheService
  );
  service.configureNullStages(nullStages);

  return { service, logger, cacheService, appConfig };
}

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetAppConfigServiceInstance();

  while (tempDirectories.length > 0) {
    const dir = tempDirectories.pop();
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

describe('ApiKeyService degraded error recovery integration', () => {
  it('synthesizes a fallback error when environment-only retrieval loses diagnostics', async () => {
    const envVarName = 'DEGRADED_ENV_ONLY_KEY';
    setEnv(envVarName, undefined);

    const { service } = buildService({
      cacheEnabled: false,
      projectRoot: null,
      nullStages: ['api_key_env_var_not_set_or_empty'],
    });

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: envVarName,
        apiKeyFileName: undefined,
      },
      'env-only-llm'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_env_var_fail_no_fallback');
    expect(result.errorDetails.details.attemptedEnvVar).toBe(envVarName);
  });

  it('recovers diagnostic context when file-based retrieval loses its original error', async () => {
    const projectRoot = createTempDir();

    const { service } = buildService({
      cacheEnabled: false,
      projectRoot,
      nullStages: ['api_key_file_not_found_or_unreadable'],
    });

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: undefined,
        apiKeyFileName: 'missing.key',
      },
      'file-only-llm'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_file_fail_no_env_fallback');
    expect(result.errorDetails.details.attemptedFile).toBe('missing.key');
  });

  it('reports an unknown retrieval failure when all diagnostics disappear', async () => {
    const { service } = buildService({
      cacheEnabled: false,
      projectRoot: null,
      nullStages: ['api_key_config_sources_missing'],
    });

    const result = await service.getApiKey(
      {
        apiType: 'OpenAI',
        apiKeyEnvVar: undefined,
        apiKeyFileName: undefined,
      },
      'no-sources-llm'
    );

    expect(result.apiKey).toBeNull();
    expect(result.errorDetails).not.toBeNull();
    expect(result.errorDetails.stage).toBe('api_key_retrieval_unknown_error');
    expect(result.errorDetails.details.llmId).toBe('no-sources-llm');
    expect(result.errorDetails.details.attemptedEnvVar).toBe('N/A');
    expect(result.errorDetails.details.attemptedFile).toBe('N/A');
  });
});
