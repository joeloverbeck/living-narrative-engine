import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';
import { fetchWithRetry } from '../../../src/utils';

jest.mock('../../../src/utils', () => ({
  fetchWithRetry: jest.fn(),
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
  let dispatcherMock;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = mockLogger();
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(true) };
    loader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher: dispatcherMock,
    });
  });

  it('loads configuration using default path', async () => {
    fetchWithRetry.mockResolvedValue({ logLevel: 'INFO' });

    const result = await loader.loadConfig();

    expect(result).toEqual({ logLevel: 'INFO' });
    expect(fetchWithRetry).toHaveBeenCalledWith(
      'config/logger-config.json',
      { method: 'GET', headers: { Accept: 'application/json' } },
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      dispatcherMock,
      logger
    );
  });

  it('returns empty object if config file is empty', async () => {
    fetchWithRetry.mockResolvedValue({});

    const result = await loader.loadConfig('custom.json');

    expect(result).toEqual({});
  });

  it('returns error when parsed response is not an object', async () => {
    fetchWithRetry.mockResolvedValue('not-object');

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
    fetchWithRetry.mockResolvedValue({ logLevel: 123 });

    const result = await loader.loadConfig('badlog.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: 'badlog.json',
      })
    );
  });

  it('marks stage as "parse" when fetchWithRetry throws parsing error', async () => {
    fetchWithRetry.mockRejectedValue(new Error('JSON parse error'));

    const result = await loader.loadConfig('parse.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'parse',
        path: 'parse.json',
      })
    );
  });

  it('marks stage as "fetch" when fetchWithRetry throws network error', async () => {
    fetchWithRetry.mockRejectedValue(
      new Error('Network failure: failed to fetch')
    );

    const result = await loader.loadConfig('net.json');

    expect(result).toEqual(
      expect.objectContaining({ error: true, stage: 'fetch', path: 'net.json' })
    );
  });
});
