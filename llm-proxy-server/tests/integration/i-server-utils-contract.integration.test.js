import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  IEnvironmentVariableReader,
  IFileSystemReader,
} from '../../src/utils/IServerUtils.js';
import { IFileSystemReaderMetadata } from '../../src/interfaces/IFileSystemReader.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';
import { loadProxyLlmConfigs } from '../../src/proxyLlmConfigLoader.js';
import { createConsoleLogger } from '../../src/consoleLogger.js';

/**
 * Creates a minimal but valid proxy configuration document that exercises
 * the metadata contract for IFileSystemReader by forcing a real file read.
 * @returns {string} Serialized configuration document.
 */
function buildValidProxyConfig() {
  return JSON.stringify({
    defaultConfigId: 'metadata-driven-model',
    configs: {
      'metadata-driven-model': {
        provider: 'openai',
        model: 'gpt-4o-mini',
        transport: 'rest',
        llm: {
          name: 'metadata-driven-model',
        },
      },
    },
  });
}

describe('IFileSystemReader and IEnvironmentVariableReader integration contract', () => {
  let tempDir;
  let nodeReader;
  let delegatingReader;
  let logger;

  class DelegatingFileSystemReader extends IFileSystemReader {
    /**
     * @param {NodeFileSystemReader} delegate
     */
    constructor(delegate) {
      super();
      this.delegate = delegate;
    }

    async readFile(filePath, encoding) {
      return this.delegate.readFile(filePath, encoding);
    }
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'iserver-utils-'));
    nodeReader = new NodeFileSystemReader();
    delegatingReader = new DelegatingFileSystemReader(nodeReader);
    logger = createConsoleLogger();
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('base interface implementations guard against missing overrides', async () => {
    const baseFileReader = new IFileSystemReader();
    await expect(baseFileReader.readFile('path', 'utf-8')).rejects.toThrow(
      'IFileSystemReader.readFile method not implemented.'
    );

    const baseEnvReader = new IEnvironmentVariableReader();
    expect(() => baseEnvReader.getEnv('TEST_VAR')).toThrow(
      'IEnvironmentVariableReader.getEnv method not implemented.'
    );
  });

  test('metadata enumerates the runtime contract implemented by delegating readers', () => {
    expect(IFileSystemReaderMetadata.name).toBe('IFileSystemReader');
    expect(IFileSystemReaderMetadata.description).toContain(
      'asynchronous file reads'
    );
    expect(Object.isFrozen(IFileSystemReaderMetadata)).toBe(true);

    const [readFileContract] = IFileSystemReaderMetadata.methods;
    expect(readFileContract).toBeDefined();
    expect(readFileContract.name).toBe('readFile');
    expect(readFileContract.params.map((param) => param.name)).toEqual([
      'filePath',
      'encoding',
    ]);
    expect(readFileContract.returns).toBe('Promise<string>');

    const implementedMethod = delegatingReader[readFileContract.name];
    expect(typeof implementedMethod).toBe('function');
    expect(implementedMethod.length).toBe(readFileContract.params.length);
  });

  test('metadata-driven invocation reads configuration files through the proxy loader', async () => {
    const configPath = path.join(tempDir, 'llm-configs.json');
    await writeFile(configPath, buildValidProxyConfig(), 'utf-8');

    const [readFileContract] = IFileSystemReaderMetadata.methods;
    const methodResult = await delegatingReader[readFileContract.name](
      configPath,
      readFileContract.params[1].type === 'string' ? 'utf-8' : undefined
    );

    expect(typeof methodResult).toBe('string');
    expect(methodResult).toContain('metadata-driven-model');

    const loadResult = await loadProxyLlmConfigs(
      configPath,
      logger,
      delegatingReader
    );
    expect(loadResult.error).toBe(false);
    expect(loadResult.llmConfigs.defaultConfigId).toBe('metadata-driven-model');
    expect(Object.keys(loadResult.llmConfigs.configs)).toContain(
      'metadata-driven-model'
    );
  });

  test('metadata contract ensures loader surfaces native file system errors', async () => {
    const missingPath = path.join(tempDir, 'missing.json');

    const loadResult = await loadProxyLlmConfigs(
      missingPath,
      logger,
      delegatingReader
    );

    expect(loadResult.error).toBe(true);
    expect(loadResult.stage).toBe('read_file_not_found');
    expect(loadResult.pathAttempted).toBe(path.resolve(missingPath));
    expect(loadResult.message).toContain('ProxyLlmConfigLoader:');
    expect(loadResult.originalError).toBeTruthy();
    expect(loadResult.originalError.code).toBe('ENOENT');
  });
});
