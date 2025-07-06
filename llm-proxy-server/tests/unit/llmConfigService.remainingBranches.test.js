import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as path from 'node:path';

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

describe('LlmConfigService remaining branches', () => {
  let fsReader;
  let logger;
  let appConfig;
  let service;
  let mockLoader;

  beforeEach(async () => {
    ({ LlmConfigService } = await import(
      '../../src/config/llmConfigService.js'
    ));
    fsReader = createFsReader();
    logger = createLogger();
    appConfig = createAppConfig('/tmp/llm.json');
    mockLoader = jest.fn();
    service = new LlmConfigService(fsReader, logger, appConfig, mockLoader);
    jest.clearAllMocks();
  });

  test('initialize records error without originalError', async () => {
    mockLoader.mockResolvedValue({
      error: true,
      message: 'oops',
      stage: 'bad',
      originalError: null,
      pathAttempted: '/tmp/llm.json',
    });

    const err = await service.initialize();

    expect(err).toEqual({
      message: 'oops',
      stage: 'bad',
      details: { pathAttempted: '/tmp/llm.json' },
    });
    const details = service.getInitializationErrorDetails();
    expect(details).toEqual({
      message: 'oops',
      stage: 'bad',
      details: { pathAttempted: '/tmp/llm.json' },
    });
    expect(logger.error).toHaveBeenCalled();
    expect(service.isOperational()).toBe(false);
  });

  test('initialize logs "Not set" when default id missing', async () => {
    const cfg = { configs: { a: { configId: 'a', apiType: 'openai' } } };
    mockLoader.mockResolvedValue({ error: false, llmConfigs: cfg });

    await service.initialize();

    const msg = logger.debug.mock.calls.find((c) =>
      c[0].includes('Initialization successful')
    )[0];
    expect(msg).toContain('Default LLM ID: Not set');
  });

  test('getLlmById warns when id missing after load', async () => {
    const cfg = {
      defaultConfigId: 'a',
      configs: { a: { configId: 'a', apiType: 'openai' } },
    };
    mockLoader.mockResolvedValue({ error: false, llmConfigs: cfg });
    await service.initialize();

    const res = service.getLlmById('b');
    expect(res).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
  });

  test('getResolvedConfigPath exposes resolved path', async () => {
    expect(service.getResolvedConfigPath()).toBeNull();
    await service.initialize();
    const resolved = path.resolve('/tmp/llm.json');
    expect(service.getResolvedConfigPath()).toBe(resolved);
  });

  test('getInitializationErrorDetails returns null when no error', async () => {
    mockLoader.mockResolvedValue({ error: false, llmConfigs: sampleConfig });
    await service.initialize();
    expect(service.getInitializationErrorDetails()).toBeNull();
  });
});
