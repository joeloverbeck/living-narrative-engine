import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { HttpConfigurationProvider } from '../../../src/configuration/httpConfigurationProvider.js';
import { createMockLogger } from '../testUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

/**
 * Additional branch coverage tests for HttpConfigurationProvider
 */
describe('HttpConfigurationProvider additional branches', () => {
  let mockLogger;
  let mockDispatcher;
  let originalFetch;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDispatcher = { dispatch: jest.fn() };
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('constructor should throw when safeEventDispatcher is missing', () => {
    expect(() => new HttpConfigurationProvider()).toThrow(
      'HttpConfigurationProvider requires ISafeEventDispatcher'
    );
  });

  it('handles missing statusText when response is not ok', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503, statusText: '' })
    );

    const provider = new HttpConfigurationProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const url = 'http://example.com/unavailable.json';
    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to fetch configuration file from ${url}: HTTP status 503`
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: `HttpConfigurationProvider: Failed to fetch configuration from ${url}. Status: 503 HTTP status 503`,
        details: { status: 503, statusText: 'HTTP status 503' },
      })
    );
  });

  it('handles parse errors that are not Error instances', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.reject('boom'),
        status: 200,
        statusText: 'OK',
      })
    );

    const provider = new HttpConfigurationProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const url = 'http://example.com/invalid.json';
    await expect(provider.fetchData(url)).rejects.toThrow(
      `Failed to parse configuration data from ${url} as JSON: undefined`
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: `HttpConfigurationProvider: Failed to parse JSON response from ${url}.`,
        details: { error: 'boom', stack: undefined },
      })
    );
  });

  it('handles non-Error fetch rejections', async () => {
    global.fetch = jest.fn(() => Promise.reject('broken'));

    const provider = new HttpConfigurationProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const url = 'http://example.com/fail.json';
    await expect(provider.fetchData(url)).rejects.toThrow(
      `Could not load configuration from ${url}: broken`
    );

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: `HttpConfigurationProvider: Error loading or parsing configuration from ${url}. Detail: broken`,
        details: { error: 'broken', stack: undefined },
      })
    );
  });
});
