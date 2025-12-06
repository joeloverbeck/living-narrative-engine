/**
 * @file llm-config-service-default-paths.integration.test.js
 * @description Ensures the LlmConfigService exercises its default path resolution logic
 *              and placeholder default ID reporting using the real AppConfig service
 *              and file system reader without mocking internal modules.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('LlmConfigService default path integration coverage', () => {
  let envManager;
  let originalCwd;
  let tempDirectories;

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();
    originalCwd = process.cwd();
    tempDirectories = [];
    resetAppConfigServiceInstance();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    resetAppConfigServiceInstance();

    await Promise.all(
      tempDirectories.map((directory) =>
        rm(directory, { recursive: true, force: true })
      )
    );
    tempDirectories = [];

    envManager.restoreEnvironment();
  });

  it('resolves the repository default config path when the env path is blank', async () => {
    const logger = createTestLogger();

    process.env.LLM_CONFIG_PATH = '   ';
    const projectRoot = path.resolve(__dirname, '../../..');
    process.chdir(projectRoot);

    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(
      new NodeFileSystemReader(),
      logger,
      appConfig
    );

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(service.isOperational()).toBe(true);
    expect(service.getResolvedConfigPath()).toBe(
      path.resolve(projectRoot, 'config/llm-configs.json')
    );

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);
    expect(
      debugMessages.some(
        (message) =>
          typeof message === 'string' &&
          message.includes('Attempting to load LLM configurations from:')
      )
    ).toBe(true);
  });

  it('reports a placeholder default ID when the configuration omits defaultConfigId', async () => {
    const logger = createTestLogger();
    const tempDir = await mkdtemp(
      path.join(tmpdir(), 'llm-config-service-default-id-')
    );
    tempDirectories.push(tempDir);

    const configPath = path.join(tempDir, 'no-default.json');
    const configContents = {
      configs: {
        'model-alpha': {
          configId: 'model-alpha',
          displayName: 'Model Alpha',
          apiType: 'openai',
          endpointUrl: 'https://api.example.com/v1',
          jsonOutputStrategy: { method: 'raw' },
        },
      },
    };
    await writeFile(
      configPath,
      JSON.stringify(configContents, null, 2),
      'utf-8'
    );

    process.env.LLM_CONFIG_PATH = configPath;
    const appConfig = getAppConfigService(logger);
    const service = new LlmConfigService(
      new NodeFileSystemReader(),
      logger,
      appConfig
    );

    await expect(service.initialize()).resolves.toBeUndefined();
    expect(service.isOperational()).toBe(true);

    const successMessage = logger.debug.mock.calls
      .map(([message]) => message)
      .find(
        (message) =>
          typeof message === 'string' &&
          message.includes('LlmConfigService: Initialization successful.')
      );

    expect(successMessage).toBeDefined();
    expect(successMessage).toContain('Default LLM ID: Not set');

    const llmConfigs = service.getLlmConfigs();
    expect(llmConfigs).not.toBeNull();
    expect(llmConfigs?.defaultConfigId).toBeUndefined();
  });
});
