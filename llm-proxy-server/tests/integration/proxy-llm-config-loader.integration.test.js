import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

import { loadProxyLlmConfigs } from '../../src/proxyLlmConfigLoader.js';
import { NodeFileSystemReader } from '../../src/nodeFileSystemReader.js';

describe('Proxy LLM Config Loader integration', () => {
  let tempDir;
  let fileSystemReader;

  const createConfigFile = async (fileName, contents) => {
    const filePath = path.join(tempDir, fileName);
    await writeFile(filePath, contents, 'utf-8');
    return filePath;
  };

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'proxy-llm-config-loader-'));
    fileSystemReader = new NodeFileSystemReader();
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('loads and validates a well-formed configuration file using the real file system reader', async () => {
    const configData = {
      defaultConfigId: 'test-model',
      configs: {
        'test-model': { provider: 'openai', model: 'gpt-4' },
        'backup-model': { provider: 'anthropic', model: 'claude' },
      },
    };

    const filePath = await createConfigFile(
      'llm-configs.json',
      JSON.stringify(configData)
    );

    const result = await loadProxyLlmConfigs(
      filePath,
      console,
      fileSystemReader
    );

    expect(result).toEqual({
      error: false,
      llmConfigs: configData,
    });
  });

  test('returns a descriptive error when the file does not exist', async () => {
    const missingPath = path.join(tempDir, 'missing-configs.json');

    const result = await loadProxyLlmConfigs(
      missingPath,
      console,
      fileSystemReader
    );

    expect(result.error).toBe(true);
    expect(result.stage).toBe('read_file_not_found');
    expect(result.message).toContain('ProxyLlmConfigLoader:');
    expect(result.pathAttempted).toBe(path.resolve(missingPath));
    expect(result.originalError).toBeTruthy();
    expect(result.originalError.code).toBe('ENOENT');
  });

  test('reports file system errors that are not simple missing-file scenarios', async () => {
    const directoryPath = await mkdtemp(path.join(tempDir, 'as-directory-'));

    const result = await loadProxyLlmConfigs(
      directoryPath,
      console,
      fileSystemReader
    );

    expect(result.error).toBe(true);
    expect(result.stage).toBe('read_file_system_error');
    expect(result.message).toContain('ProxyLlmConfigLoader:');
    expect(result.originalError).toBeTruthy();
    expect(result.originalError.code).toBe('EISDIR');
  });

  test('flags syntax errors when the configuration file cannot be parsed', async () => {
    const malformedContent = '{"configs": { "broken": true '; // missing closing braces
    const malformedPath = await createConfigFile(
      'malformed-configs.json',
      malformedContent
    );

    const result = await loadProxyLlmConfigs(
      malformedPath,
      console,
      fileSystemReader
    );

    expect(result.error).toBe(true);
    expect(result.stage).toBe('parse_json_syntax_error');
    expect(result.message).toContain('JSON syntax error');
  });

  test("identifies configuration files that don't contain a configs map", async () => {
    const invalidStructurePath = await createConfigFile(
      'invalid-structure.json',
      JSON.stringify({ defaultConfigId: 'only-default' })
    );

    const result = await loadProxyLlmConfigs(
      invalidStructurePath,
      console,
      fileSystemReader
    );

    expect(result.error).toBe(true);
    expect(result.stage).toBe('validation_malformed_or_missing_configs_map');
    expect(result.message).toContain('ProxyLlmConfigLoader:');
  });

  test('exposes initialization errors when no file system reader is provided', async () => {
    const result = await loadProxyLlmConfigs(
      path.join(tempDir, 'any.json'),
      console,
      null
    );

    expect(result).toEqual({
      error: true,
      message:
        'ProxyLlmConfigLoader: A valid fileSystemReader with a readFile method must be provided.',
      stage: 'initialization_error_dependency_missing_filereader',
      pathAttempted: path.join(tempDir, 'any.json'),
    });
  });

  test('bubbles up unexpected errors from alternative file system readers', async () => {
    class ThrowingReader {
      async readFile() {
        throw new Error('Synthetic failure for integration coverage');
      }
    }

    const result = await loadProxyLlmConfigs(
      path.join(tempDir, 'synthetic.json'),
      console,
      new ThrowingReader()
    );

    expect(result.error).toBe(true);
    expect(result.stage).toBe('unknown_load_parse_error');
    expect(result.message).toContain(
      'ProxyLlmConfigLoader: An unexpected error occurred'
    );
    expect(result.originalError).toBeInstanceOf(Error);
  });
});
