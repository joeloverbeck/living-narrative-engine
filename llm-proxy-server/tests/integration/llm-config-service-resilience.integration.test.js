import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

const buildConfig = (overrides = {}) => ({
  defaultConfigId: 'primary-model',
  configs: {
    'primary-model': {
      configId: 'primary-model',
      displayName: 'Primary Model',
      apiType: 'openai',
      endpointUrl: 'https://api.openai.example/v1',
      apiKeyFileName: 'openai.key',
      jsonOutputStrategy: { method: 'tool_calling' },
    },
    ...overrides,
  },
});

describe('LlmConfigService resilience integration coverage', () => {
  let tempDir;
  let envManager;
  let logger;
  let fsReader;

  beforeAll(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), 'llm-config-service-resilience-')
    );
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
    jest.restoreAllMocks();
    envManager.restoreEnvironment();
  });

  const configPath = (fileName) => path.join(tempDir, fileName);

  it('records detailed initialization errors when the config file is missing', async () => {
    const missingConfigPath = configPath('does-not-exist.json');
    process.env.LLM_CONFIG_PATH = missingConfigPath;

    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(fsReader, logger, appConfig);

    const errorResult = await service.initialize();

    expect(errorResult).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('ProxyLlmConfigLoader'),
        stage: 'read_file_not_found',
      })
    );
    expect(service.isOperational()).toBe(false);
    expect(service.getLlmConfigs()).toBeNull();
    expect(service.hasFileBasedApiKeys()).toBe(false);

    const errorDetails = service.getInitializationErrorDetails();
    expect(errorDetails).toEqual(
      expect.objectContaining({
        message: errorResult.message,
        stage: 'read_file_not_found',
        details: expect.objectContaining({
          pathAttempted: path.resolve(missingConfigPath),
        }),
      })
    );
    expect(errorDetails).not.toHaveProperty('originalError');

    const resolvedPath = service.getResolvedConfigPath();
    expect(resolvedPath).toBe(path.resolve(missingConfigPath));

    expect(service.getLlmById('any')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "LlmConfigService.getLlmById: Attempted to get LLM 'any' but configurations are not loaded."
    );
  });

  it('surfaces loader validation failures when configs map is missing', async () => {
    const malformedConfigPath = configPath('malformed.json');
    await writeFile(
      malformedConfigPath,
      JSON.stringify({ defaultConfigId: 'primary-model' }, null, 2),
      'utf-8'
    );
    process.env.LLM_CONFIG_PATH = malformedConfigPath;

    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(fsReader, logger, appConfig);

    const errorResult = await service.initialize();

    expect(errorResult).toEqual(
      expect.objectContaining({
        stage: 'validation_malformed_or_missing_configs_map',
        message: expect.stringContaining('ProxyLlmConfigLoader'),
      })
    );
    expect(service.isOperational()).toBe(false);
    expect(service.getInitializationErrorDetails()).toEqual(
      expect.objectContaining({
        stage: 'validation_malformed_or_missing_configs_map',
        details: expect.objectContaining({
          pathAttempted: path.resolve(malformedConfigPath),
        }),
      })
    );
    expect(service.getLlmConfigs()).toBeNull();
  });

  it('freezes loaded configs and warns when requesting unknown identifiers', async () => {
    const validConfigPath = configPath('valid.json');
    const config = buildConfig({
      'secondary-model': {
        configId: 'secondary-model',
        displayName: 'Secondary',
        apiType: 'bedrock',
        endpointUrl: 'https://bedrock.aws.example',
        apiKeyFileName: 'bedrock.key',
        jsonOutputStrategy: { method: 'raw' },
      },
    });
    await writeFile(validConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    process.env.LLM_CONFIG_PATH = validConfigPath;

    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(fsReader, logger, appConfig);

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.isOperational()).toBe(true);
    expect(service.getInitializationErrorDetails()).toBeNull();
    expect(service.getResolvedConfigPath()).toBe(path.resolve(validConfigPath));

    const configs = service.getLlmConfigs();
    expect(configs).not.toBeNull();
    expect(Object.isFrozen(configs)).toBe(true);
    expect(Object.isFrozen(configs.configs['primary-model'])).toBe(true);
    expect(Object.isFrozen(configs.configs['secondary-model'])).toBe(true);

    expect(service.getLlmById('primary-model')).toEqual(
      expect.objectContaining({ endpointUrl: 'https://api.openai.example/v1' })
    );
    expect(service.getLlmById('missing-model')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "LlmConfigService.getLlmById: LLM configuration for ID 'missing-model' not found."
    );

    expect(service.hasFileBasedApiKeys()).toBe(true);
  });
});
