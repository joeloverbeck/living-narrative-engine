/**
 * @file app-config-env-logging.integration.test.js
 * @description Integration coverage for AppConfigService string environment variable logging paths
 * combined with proxy configuration loading.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import EnhancedConsoleLogger from '../../src/logging/enhancedConsoleLogger.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { loadProxyLlmConfigs } from '../../src/proxyLlmConfigLoader.js';

const createMinimalConfigs = () =>
  JSON.stringify(
    {
      defaultConfigId: 'primary-model',
      configs: {
        'primary-model': {
          apiType: 'openai',
          apiKeyFileName: 'ignored.txt',
          model: 'gpt-test',
          baseUrl: 'https://example.invalid',
        },
      },
    },
    null,
    2
  );

describe('AppConfigService string env logging integration', () => {
  const originalEnv = { ...process.env };
  let consoleWarnSpy;

  const restoreEnv = () => {
    const currentKeys = Object.keys(process.env);
    for (const key of currentKeys) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetAppConfigServiceInstance();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    restoreEnv();
    resetAppConfigServiceInstance();
  });

  it('covers defined, empty, and missing string env var paths while loading configs through collaborators', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'app-config-logging-'));
    const configPath = path.join(tempRoot, 'llm-configs.json');
    await writeFile(configPath, createMinimalConfigs(), 'utf-8');

    process.env.LLM_CONFIG_PATH = configPath;
    process.env.PROXY_ALLOWED_ORIGIN = '';
    delete process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES;

    const logger = new EnhancedConsoleLogger();
    const debugSpy = jest.spyOn(logger, 'debug');

    const appConfig = getAppConfigService(logger);

    expect(appConfig.getLlmConfigPath()).toBe(configPath);
    expect(appConfig.getProxyAllowedOrigin()).toBe('');
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBeNull();

    const fsReader = new NodeFileSystemReader();
    const loadResult = await loadProxyLlmConfigs(
      appConfig.getLlmConfigPath(),
      logger,
      fsReader
    );

    expect(loadResult.error).toBe(false);
    expect(loadResult.llmConfigs.configs['primary-model'].apiType).toBe(
      'openai'
    );

    const debugMessages = debugSpy.mock.calls.map(([message]) => message);

    expect(
      debugMessages.some((message) =>
        message?.includes('LLM_CONFIG_PATH found in environment:')
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message?.includes(
          'PROXY_ALLOWED_ORIGIN found in environment but is empty. Current effective value'
        )
      )
    ).toBe(true);

    expect(
      debugMessages.some((message) =>
        message?.includes(
          'PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES not set in environment.'
        )
      )
    ).toBe(true);

    debugSpy.mockRestore();
    await rm(tempRoot, { recursive: true, force: true });
  });
});
