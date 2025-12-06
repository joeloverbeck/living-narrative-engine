import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';
import { LlmConfigService } from '../../src/config/llmConfigService.js';
import { ILlmConfigServiceMetadata } from '../../src/interfaces/ILlmConfigService.js';
import { TestEnvironmentManager } from '../common/testServerUtils.js';

/**
 * Builds an example configuration containing a mix of remote and local models.
 * @returns {object} Resolved configuration document
 */
function buildExampleConfig() {
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
    },
  };
}

/**
 * Creates a minimal in-memory logger that records structured log entries.
 * @returns {{ logger: import('../../src/interfaces/coreServices.js').ILogger, entries: Record<string, Array<any>> }}
 */
function createTestLogger() {
  const entries = { debug: [], info: [], warn: [], error: [] };
  return {
    entries,
    logger: {
      debug: (message, metadata) => entries.debug.push({ message, metadata }),
      info: (message, metadata) => entries.info.push({ message, metadata }),
      warn: (message, metadata) => entries.warn.push({ message, metadata }),
      error: (message, metadata) => entries.error.push({ message, metadata }),
    },
  };
}

describe('ILlmConfigService metadata contract integration', () => {
  /** @type {string | null} */
  let tempDir = null;
  /** @type {TestEnvironmentManager} */
  let envManager;
  /** @type {ReturnType<typeof createTestLogger>} */
  let loggerBundle;
  /** @type {NodeFileSystemReader} */
  let fsReader;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'llm-config-metadata-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  beforeEach(() => {
    envManager = new TestEnvironmentManager();
    envManager.backupEnvironment();
    envManager.cleanEnvironment();

    loggerBundle = createTestLogger();
    fsReader = new NodeFileSystemReader();
    resetAppConfigServiceInstance();
  });

  afterEach(() => {
    envManager.restoreEnvironment();
    resetAppConfigServiceInstance();
  });

  async function writeConfigFile(fileName, config) {
    if (!tempDir) {
      throw new Error('Temporary directory not initialized');
    }
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
    return filePath;
  }

  test('runtime metadata mirrors the live service implementation', async () => {
    const configPath = await writeConfigFile(
      'metadata-source.json',
      buildExampleConfig()
    );
    envManager.setEnvironment({ LLM_CONFIG_PATH: configPath });

    const appConfig = getAppConfigService(loggerBundle.logger);
    const service = new LlmConfigService(
      fsReader,
      loggerBundle.logger,
      appConfig
    );

    await expect(service.initialize()).resolves.toBeUndefined();

    expect(Object.isFrozen(ILlmConfigServiceMetadata)).toBe(true);
    expect(ILlmConfigServiceMetadata.name).toBe('ILlmConfigService');
    expect(ILlmConfigServiceMetadata.description.length).toBeGreaterThan(0);

    const declaredMethods = ILlmConfigServiceMetadata.methods.map(
      (method) => method.name
    );
    expect(declaredMethods).toEqual([
      'initialize',
      'isOperational',
      'getLlmConfigs',
      'getLlmById',
      'getResolvedConfigPath',
      'getInitializationErrorDetails',
      'hasFileBasedApiKeys',
    ]);

    for (const methodName of declaredMethods) {
      expect(typeof service[methodName]).toBe('function');
    }

    const getByIdContract = ILlmConfigServiceMetadata.methods.find(
      (method) => method.name === 'getLlmById'
    );
    expect(getByIdContract).toBeDefined();
    expect(getByIdContract?.params).toEqual([{ name: 'id', type: 'string' }]);
    expect(getByIdContract?.returns).toContain('LLMModelConfig');

    expect(service.isOperational()).toBe(true);
    expect(path.basename(service.getResolvedConfigPath() ?? '')).toBe(
      'metadata-source.json'
    );
    expect(service.getInitializationErrorDetails()).toBeNull();

    const configs = service.getLlmConfigs();
    expect(configs).not.toBeNull();
    expect(configs?.configs).toHaveProperty('remote-model');
    expect(service.getLlmById('remote-model')).toMatchObject({
      configId: 'remote-model',
      apiKeyFileName: 'openai.key',
    });
    expect(service.hasFileBasedApiKeys()).toBe(true);
  });

  test('metadata-driven invocation stays consistent with service behaviour', async () => {
    const configPath = await writeConfigFile(
      'metadata-behaviour.json',
      buildExampleConfig()
    );
    envManager.setEnvironment({
      LLM_CONFIG_PATH: configPath,
      PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: '/secure/secrets',
    });

    const appConfig = getAppConfigService(loggerBundle.logger);
    const service = new LlmConfigService(
      fsReader,
      loggerBundle.logger,
      appConfig
    );
    await service.initialize();

    const runtimeSnapshot = {};

    for (const method of ILlmConfigServiceMetadata.methods) {
      if (method.name === 'initialize') {
        continue; // initialization already complete for this snapshot
      }

      if (method.name === 'getLlmById') {
        runtimeSnapshot[method.name] = service.getLlmById('remote-model');
        continue;
      }

      runtimeSnapshot[method.name] = service[method.name]();
    }

    expect(runtimeSnapshot.isOperational).toBe(true);
    expect(runtimeSnapshot.getResolvedConfigPath).toBe(
      path.resolve(configPath)
    );
    expect(runtimeSnapshot.getInitializationErrorDetails).toBeNull();
    expect(
      runtimeSnapshot.getLlmConfigs?.configs['remote-model']
    ).toBeDefined();
    expect(runtimeSnapshot.getLlmById).toMatchObject({
      configId: 'remote-model',
      endpointUrl: 'https://api.openai.example/v1',
    });
    expect(runtimeSnapshot.hasFileBasedApiKeys).toBe(true);

    // Ensure metadata remains descriptive for consumers performing introspection.
    for (const method of ILlmConfigServiceMetadata.methods) {
      expect(typeof method.description).toBe('string');
      expect(method.description.length).toBeGreaterThan(0);
      expect(typeof method.returns).toBe('string');
      expect(method.returns.length).toBeGreaterThan(0);
    }
  });
});
