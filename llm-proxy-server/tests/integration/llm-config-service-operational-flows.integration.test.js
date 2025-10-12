import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

/**
 * Creates a deterministic config payload with optional overrides for specific LLM entries.
 * @param {object} overrides - Optional overrides keyed by config id.
 * @returns {object} Complete configuration ready to be written to disk.
 */
function buildConfig(overrides = {}) {
  return {
    defaultConfigId: 'remote-model',
    configs: {
      'remote-model': {
        configId: 'remote-model',
        displayName: 'Remote GPT',
        apiType: 'openai',
        endpointUrl: 'https://api.openai.example/v1',
        apiKeyFileName: 'openai.key',
        jsonOutputStrategy: { method: 'tool_calling' },
      },
      'local-ollama': {
        configId: 'local-ollama',
        displayName: 'Local Ollama',
        apiType: 'ollama',
        endpointUrl: 'http://127.0.0.1:11434',
        jsonOutputStrategy: { method: 'raw' },
      },
      ...overrides,
    },
  };
}

describe('LlmConfigService integration with AppConfig and real file access', () => {
  let tempDir;
  let envManager;
  let logger;
  let fsReader;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'llm-config-service-int-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();

    resetAppConfigServiceInstance();
    logger = new ConsoleLogger();
    fsReader = new NodeFileSystemReader();
  });

  afterEach(() => {
    envManager.restoreEnvironment();
  });

  const writeConfigFile = async (fileName, config) => {
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    return filePath;
  };

  it('loads configuration from AppConfig-provided path and detects file-based API keys', async () => {
    const configPath = await writeConfigFile(
      'remote-and-local.json',
      buildConfig()
    );

    process.env.LLM_CONFIG_PATH = configPath;
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '/var/secure';

    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(fsReader, logger, appConfig);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.isOperational()).toBe(true);
    expect(service.getResolvedConfigPath()).toBe(path.resolve(configPath));

    const configs = service.getLlmConfigs();
    expect(configs).not.toBeNull();
    expect(Object.keys(configs.configs)).toContain('remote-model');
    expect(service.getLlmById('remote-model')).toMatchObject({
      apiKeyFileName: 'openai.key',
      apiType: 'openai',
    });

    expect(service.hasFileBasedApiKeys()).toBe(true);
  });

  it('treats local-only configurations as not requiring proxy-managed API keys', async () => {
    const localOnlyConfig = buildConfig({
      'remote-model': {
        configId: 'remote-model',
        displayName: 'Local Only',
        apiType: 'ollama',
        endpointUrl: 'http://localhost:8080',
        apiKeyFileName: 'ignored.key',
        jsonOutputStrategy: { method: 'raw' },
      },
    });
    const configPath = await writeConfigFile(
      'local-only.json',
      localOnlyConfig
    );

    process.env.LLM_CONFIG_PATH = configPath;

    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(fsReader, logger, appConfig);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.isOperational()).toBe(true);
    expect(service.hasFileBasedApiKeys()).toBe(false);
    expect(service.getLlmById('remote-model')).toMatchObject({
      apiType: 'ollama',
    });
  });
});
