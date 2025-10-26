import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when safeEventDispatcher dependency is missing or invalid', () => {
    expect(() => new LoggerConfigLoader()).toThrow(
      'LoggerConfigLoader requires a valid ISafeEventDispatcher instance.'
    );

    expect(
      () =>
        new LoggerConfigLoader({
          safeEventDispatcher: {},
        })
    ).toThrow('LoggerConfigLoader requires a valid ISafeEventDispatcher instance.');
  });

  it('allows overriding the default configuration path when provided', async () => {
    fetchWithRetry.mockResolvedValue({ logLevel: 'DEBUG' });
    const customPath = 'custom/config/logger.json';
    const customLoader = new LoggerConfigLoader({
      logger,
      safeEventDispatcher: dispatcherMock,
      configPath: customPath,
    });

    const result = await customLoader.loadConfig();

    expect(result).toEqual({ logLevel: 'DEBUG' });
    expect(fetchWithRetry).toHaveBeenCalledWith(
      customPath,
      { method: 'GET', headers: { Accept: 'application/json' } },
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      dispatcherMock,
      logger
    );
  });

  it('returns other configuration properties unchanged when logLevel is absent', async () => {
    const configWithoutLogLevel = { tracingEnabled: true };
    fetchWithRetry.mockResolvedValue(configWithoutLogLevel);

    const result = await loader.loadConfig('no-loglevel.json');

    expect(result).toEqual(configWithoutLogLevel);
  });

  it('falls back to console.warn when the provided logger lacks a warn method', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loggerWithoutWarn = { error: jest.fn() };
    fetchWithRetry.mockResolvedValue('bad-response');

    const customLoader = new LoggerConfigLoader({
      logger: loggerWithoutWarn,
      safeEventDispatcher: dispatcherMock,
    });

    const result = await customLoader.loadConfig('bad.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'validation',
        path: 'bad.json',
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Configuration file from bad.json is malformed'),
      'bad-response'
    );
  });

  it('falls back to console.error when the provided logger lacks an error method', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loggerWithoutError = { warn: jest.fn() };
    fetchWithRetry.mockRejectedValue(new Error('Network status 500'));

    const customLoader = new LoggerConfigLoader({
      logger: loggerWithoutError,
      safeEventDispatcher: dispatcherMock,
    });

    const result = await customLoader.loadConfig('err.json');

    expect(result).toEqual(
      expect.objectContaining({ error: true, stage: 'fetch', path: 'err.json' })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load or parse logger configuration from err.json'),
      expect.objectContaining({
        path: 'err.json',
        originalError: expect.objectContaining({ message: 'Network status 500' }),
      })
    );
  });

  it('classifies fetch errors containing "not found" as fetch-stage failures', async () => {
    fetchWithRetry.mockRejectedValue(new Error('Resource Not Found'));

    const result = await loader.loadConfig('missing.json');

    expect(result).toEqual(
      expect.objectContaining({ error: true, stage: 'fetch', path: 'missing.json' })
    );
  });

  it('classifies fetch errors containing "status" as fetch-stage failures', async () => {
    fetchWithRetry.mockRejectedValue(new Error('HTTP status 500 received'));

    const result = await loader.loadConfig('status.json');

    expect(result).toEqual(
      expect.objectContaining({ error: true, stage: 'fetch', path: 'status.json' })
    );
  });

  it('defaults to fetch_or_parse stage when error message is missing', async () => {
    const errorWithoutMessage = { name: 'UnknownError' };
    fetchWithRetry.mockRejectedValue(errorWithoutMessage);

    const result = await loader.loadConfig('unknown.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_or_parse',
        path: 'unknown.json',
        originalError: errorWithoutMessage,
      })
    );
  });

  it('defaults to fetch_or_parse stage when error message lacks keywords', async () => {
    fetchWithRetry.mockRejectedValue(new Error('Unexpected failure occurred'));

    const result = await loader.loadConfig('ambiguous.json');

    expect(result).toEqual(
      expect.objectContaining({
        error: true,
        stage: 'fetch_or_parse',
        path: 'ambiguous.json',
      })
    );
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
