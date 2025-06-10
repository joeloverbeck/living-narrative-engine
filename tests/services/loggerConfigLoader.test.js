import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LoggerConfigLoader } from '../../src/configuration/loggerConfigLoader.js';
import { Workspace_retry } from '../../src/utils/apiUtils.js';

jest.mock('../../src/utils/apiUtils.js', () => ({
  Workspace_retry: jest.fn(),
}));

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('LoggerConfigLoader', () => {
  /** @type {LoggerConfigLoader} */
  let loader;
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    loader = new LoggerConfigLoader({ logger });
  });

  it('loads configuration using default path', async () => {
    Workspace_retry.mockResolvedValue({ logLevel: 'INFO' });

    const result = await loader.loadConfig();

    expect(result).toEqual({ logLevel: 'INFO' });
    expect(Workspace_retry).toHaveBeenCalledWith(
      'config/logger-config.json',
      { method: 'GET', headers: { Accept: 'application/json' } },
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      logger
    );
  });

  it('returns empty object if config file is empty', async () => {
    Workspace_retry.mockResolvedValue({});

    const result = await loader.loadConfig('custom.json');

    expect(result).toEqual({});
  });

  it('returns error when parsed response is not an object', async () => {
    Workspace_retry.mockResolvedValue('not-object');

    const result = await loader.loadConfig('bad.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: 'bad.json',
      })
    );
  });

  it('returns error when logLevel is not a string', async () => {
    Workspace_retry.mockResolvedValue({ logLevel: 123 });

    const result = await loader.loadConfig('badlog.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: 'badlog.json',
      })
    );
  });

  it('marks stage as "parse" when Workspace_retry throws parsing error', async () => {
    Workspace_retry.mockRejectedValue(new Error('JSON parse error'));

    const result = await loader.loadConfig('parse.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: 'parse.json',
      })
    );
  });

  it('marks stage as "fetch" when Workspace_retry throws network error', async () => {
    Workspace_retry.mockRejectedValue(
      new Error('Network failure: failed to fetch')
    );

    const result = await loader.loadConfig('net.json');

    expect(result).toEqual(
      expect.objectContaining({ error: true, stage: 'fetch', path: 'net.json' })
    );
  });
});
