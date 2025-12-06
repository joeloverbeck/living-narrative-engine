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
import path from 'node:path';
import { tmpdir } from 'node:os';

import { ConsoleLogger } from '../../src/consoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

const BASE_CONFIG = {
  defaultConfigId: 'primary-model',
  configs: {
    'primary-model': {
      configId: 'primary-model',
      displayName: 'Primary Model',
      apiType: 'openai',
      endpointUrl: 'https://api.openai.example/v1',
      jsonOutputStrategy: { method: 'tool_calling' },
    },
  },
};

describe('LlmConfigService unexpected failure integration coverage', () => {
  let tempDir;
  let envManager;

  beforeAll(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), 'llm-config-service-unexpected-')
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });

  it('records unexpected loader failures while preserving original error context', async () => {
    const configPath = path.join(tempDir, 'valid.json');
    await writeFile(configPath, JSON.stringify(BASE_CONFIG, null, 2), 'utf-8');
    envManager.setEnvironment({ LLM_CONFIG_PATH: configPath });
    resetAppConfigServiceInstance();

    const logger = new ConsoleLogger();
    const errorSpy = jest.spyOn(logger, 'error');
    const fsReader = new NodeFileSystemReader();
    const appConfig = getAppConfigService(logger);

    const catastrophicFailure = new Error('catastrophic loader failure');

    const throwingLoader = async (
      resolvedPath,
      injectedLogger,
      injectedReader
    ) => {
      const contents = await injectedReader.readFile(resolvedPath, 'utf-8');
      injectedLogger.debug('Loaded bytes prior to failure', {
        resolvedPath,
        length: contents.length,
      });
      throw catastrophicFailure;
    };

    const service = new LlmConfigService(
      fsReader,
      logger,
      appConfig,
      throwingLoader
    );

    const result = await service.initialize();

    expect(result).toMatchObject({
      message: 'An unexpected error occurred during LLM configuration loading',
      stage: 'config_load_unexpected_error',
      details: {
        pathAttempted: path.resolve(configPath),
        originalErrorMessage: catastrophicFailure.message,
      },
      originalError: catastrophicFailure,
    });

    expect(service.isOperational()).toBe(false);
    expect(service.getLlmConfigs()).toBeNull();
    expect(service.getResolvedConfigPath()).toBe(path.resolve(configPath));

    const safeError = service.getInitializationErrorDetails();
    expect(safeError).toMatchObject({
      message: result.message,
      stage: result.stage,
      details: {
        pathAttempted: path.resolve(configPath),
        originalErrorMessage: catastrophicFailure.message,
      },
    });
    expect(safeError).not.toHaveProperty('originalError');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.objectContaining({ errorStage: 'config_load_unexpected_error' })
    );
  });

  it('throws descriptive errors when constructed without required dependencies', () => {
    envManager.setEnvironment({});
    resetAppConfigServiceInstance();
    const logger = new ConsoleLogger();
    const fsReader = new NodeFileSystemReader();
    const appConfig = getAppConfigService(logger);

    expect(() => new LlmConfigService(null, logger, appConfig)).toThrow(
      'LlmConfigService: fileSystemReader is required.'
    );
    expect(() => new LlmConfigService(fsReader, null, appConfig)).toThrow(
      'LlmConfigService: logger is required.'
    );
    expect(() => new LlmConfigService(fsReader, logger, null)).toThrow(
      'LlmConfigService: appConfig is required.'
    );
  });
});
