import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'node:path';
// Loader will be mocked via dependency injection

let LlmConfigService;

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({ readFile: jest.fn() });
const createAppConfig = (pathArg) => ({
  getLlmConfigPath: jest.fn(() => pathArg),
});

const sampleConfig = {
  defaultConfigId: 'gpt4',
  configs: {
    gpt4: { configId: 'gpt4', apiType: 'openai', apiKeyFileName: 'key.txt' },
    local: { configId: 'local', apiType: 'ollama' },
  },
};

describe('LlmConfigService', () => {
  let fsReader;
  let logger;
  let appConfig;
  let service;
  let mockLoader;

  beforeEach(async () => {
    ({ LlmConfigService } = await import('../src/config/llmConfigService.js'));
    fsReader = createFsReader();
    logger = createLogger();
    appConfig = createAppConfig('/tmp/llm.json');
    mockLoader = jest.fn();
    service = new LlmConfigService(fsReader, logger, appConfig, mockLoader);
    jest.clearAllMocks();
    mockLoader.mockResolvedValue({
      error: false,
      llmConfigs: sampleConfig,
    });
  });

  test('constructor validates dependencies', () => {
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

  test('successful initialization loads configs and marks operational', async () => {
    const resolvedPath = path.resolve('/tmp/llm.json');
    await service.initialize();
    expect(mockLoader).toHaveBeenCalledWith(resolvedPath, logger, fsReader);
    expect(service.isOperational()).toBe(true);
    expect(service.getInitializationErrorDetails()).toBeNull();
    expect(service.getLlmConfigs()).toEqual(sampleConfig);
  });

  test('initialize falls back to default path when custom path is blank', async () => {
    const defaultPath = path.resolve(process.cwd(), 'config/llm-configs.json');
    appConfig.getLlmConfigPath.mockReturnValue('   ');

    await service.initialize();

    expect(mockLoader).toHaveBeenCalledWith(defaultPath, logger, fsReader);
    expect(service.isOperational()).toBe(true);
  });

  test('getLlmById returns configuration when loaded', async () => {
    await service.initialize();
    const cfg = service.getLlmById('gpt4');
    expect(cfg).toEqual(sampleConfig.configs.gpt4);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('getLlmById warns when configs not loaded', () => {
    const cfg = service.getLlmById('missing');
    expect(cfg).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('hasFileBasedApiKeys detects cloud config with key file', async () => {
    await service.initialize();
    expect(service.hasFileBasedApiKeys()).toBe(true);
  });

  test('hasFileBasedApiKeys returns false when not initialized', () => {
    expect(service.hasFileBasedApiKeys()).toBe(false);
  });

  test('hasFileBasedApiKeys ignores local configs with key files', async () => {
    const localOnly = {
      defaultConfigId: 'local',
      configs: {
        local: {
          configId: 'local',
          apiType: 'ollama',
          apiKeyFileName: 'local.txt',
        },
      },
    };
    mockLoader.mockResolvedValue({ error: false, llmConfigs: localOnly });
    await service.initialize();
    expect(service.hasFileBasedApiKeys()).toBe(false);
  });

  test('initialize handles loader error result', async () => {
    mockLoader.mockResolvedValue({
      error: true,
      message: 'boom',
      stage: 'bad',
      originalError: new Error('boom'),
      pathAttempted: '/tmp/llm.json',
    });

    const returnedErr = await service.initialize();

    const err = service.getInitializationErrorDetails();
    expect(err).toEqual({
      message: 'boom',
      stage: 'bad',
      details: {
        originalErrorMessage: 'boom',
        pathAttempted: '/tmp/llm.json',
      },
    });
    expect(returnedErr).toMatchObject({ stage: 'bad', message: 'boom' });
    expect(returnedErr.originalError).toBeInstanceOf(Error);
    expect(service.isOperational()).toBe(false);
  });

  test('initialize returns error when loader throws', async () => {
    const thrown = new Error('explode');
    mockLoader.mockRejectedValue(thrown);

    const returnedErr = await service.initialize();

    expect(returnedErr.stage).toBe('config_load_unexpected_error');
    expect(returnedErr.originalError).toBe(thrown);
    expect(service.isOperational()).toBe(false);
  });

  test('initialize propagates loader error and disables service', async () => {
    const loaderError = {
      error: true,
      message: 'nope',
      stage: 'loader_stage',
      originalError: new Error('nope'),
      pathAttempted: '/tmp/llm.json',
    };

    mockLoader.mockResolvedValue(loaderError);

    const returnedErr = await service.initialize();

    expect(returnedErr).toMatchObject({
      message: 'nope',
      stage: 'loader_stage',
    });
    expect(returnedErr.originalError).toBe(loaderError.originalError);
    expect(service.isOperational()).toBe(false);
    expect(service.getLlmConfigs()).toBeNull();

    const cfg = service.getLlmById('gpt4');
    expect(cfg).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('loaded configurations are frozen', async () => {
    await service.initialize();
    const configs = service.getLlmConfigs();
    expect(Object.isFrozen(configs)).toBe(true);
    expect(Object.isFrozen(configs.configs.gpt4)).toBe(true);
    expect(() => {
      // In strict mode (default for ESM), modifying a frozen object throws
      configs.configs.gpt4.newProp = 'fail';
    }).toThrow();
  });

  test('initialize handles loader error without originalError', async () => {
    mockLoader.mockResolvedValue({
      error: true,
      message: 'fail',
      stage: 'loader',
      pathAttempted: '/tmp/llm.json',
    });

    const returnedErr = await service.initialize();

    expect(returnedErr).toEqual({
      message: 'fail',
      stage: 'loader',
      details: { pathAttempted: '/tmp/llm.json' },
    });
    expect(returnedErr.originalError).toBeUndefined();
    const err = service.getInitializationErrorDetails();
    expect(err).toEqual({
      message: 'fail',
      stage: 'loader',
      details: { pathAttempted: '/tmp/llm.json' },
    });
    expect(service.isOperational()).toBe(false);
  });
});
