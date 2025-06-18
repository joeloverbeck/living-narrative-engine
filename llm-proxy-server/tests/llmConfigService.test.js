import { describe, test, expect, beforeEach, jest } from '@jest/globals';
let LlmConfigService;

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createFsReader = () => ({ readFile: jest.fn() });
const createAppConfig = (path) => ({ getLlmConfigPath: jest.fn(() => path) });

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

  beforeEach(async () => {
    ({ LlmConfigService } = await import('../src/config/llmConfigService.js'));
    fsReader = createFsReader();
    logger = createLogger();
    appConfig = createAppConfig('/tmp/llm.json');
    service = new LlmConfigService(fsReader, logger, appConfig);
    jest.clearAllMocks();
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
    fsReader.readFile.mockResolvedValue(JSON.stringify(sampleConfig));
    await service.initialize();
    expect(fsReader.readFile).toHaveBeenCalled();
    expect(service.isOperational()).toBe(true);
    expect(service.getInitializationErrorDetails()).toBeNull();
    expect(service.getLlmConfigs()).toEqual(sampleConfig);
  });

  test('getLlmById returns configuration when loaded', async () => {
    fsReader.readFile.mockResolvedValue(JSON.stringify(sampleConfig));
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
    fsReader.readFile.mockResolvedValue(JSON.stringify(sampleConfig));
    await service.initialize();
    expect(service.hasFileBasedApiKeys()).toBe(true);
  });

  test('initialize handles readFile error', async () => {
    fsReader.readFile.mockRejectedValue(new Error('fail'));
    await service.initialize();
    const err = service.getInitializationErrorDetails();
    expect(err.stage).toBe('config_load_file_read_error');
    expect(service.isOperational()).toBe(false);
  });

  test('initialize handles JSON parse error', async () => {
    fsReader.readFile.mockResolvedValue('{bad json');
    await service.initialize();
    const err = service.getInitializationErrorDetails();
    expect(err.stage).toBe('config_load_json_parse_error');
    expect(service.isOperational()).toBe(false);
  });
});
