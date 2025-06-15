// tests/services/HttpConfigurationProvider.test.js
// --- FILE START ---
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { HttpConfigurationProvider } from '../../src/configuration/httpConfigurationProvider.js'; // Adjust path as needed
import { createMockLogger } from '../testUtils.js'; // Path updated as per your usage
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

describe('HttpConfigurationProvider', () => {
  let mockLogger;
  let mockDispatcher;
  let originalFetch;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDispatcher = { dispatch: jest.fn() };
    originalFetch = global.fetch; // Store original fetch
    // Default mock for global.fetch in case a test doesn't override it but still wants to spy.
    // Tests that provide their own mock (e.g., for specific return values) will override this.
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch; // Restore original fetch
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should use provided logger', () => {
      const customLogger = createMockLogger();
      new HttpConfigurationProvider({
        logger: customLogger,
        safeEventDispatcher: mockDispatcher,
      });
      // No direct assertion here as logger usage is in fetchData
    });

    it('should default to console if no logger is provided', () => {
      const provider = new HttpConfigurationProvider({
        safeEventDispatcher: mockDispatcher,
      });
      expect(provider).toBeInstanceOf(HttpConfigurationProvider);
    });
  });

  describe('fetchData', () => {
    it('should fetch and parse valid JSON data successfully', async () => {
      const mockData = { test: 'data', configs: {} };
      // Override the default global.fetch mock from beforeEach for this specific case
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
          status: 200,
          statusText: 'OK',
        })
      );

      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = 'http://example.com/config.json';
      const result = await provider.fetchData(url);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(url);
      expect(result).toEqual(mockData);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `HttpConfigurationProvider: Attempting to load configurations from ${url}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `HttpConfigurationProvider: Successfully fetched and parsed configuration from ${url}.`
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw an error and log if sourceUrl is invalid (empty string)', async () => {
      // global.fetch is already jest.fn() from beforeEach
      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = '';
      await expect(provider.fetchData(url)).rejects.toThrow(
        'HttpConfigurationProvider: sourceUrl must be a non-empty string.'
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message:
            'HttpConfigurationProvider: sourceUrl must be a non-empty string.',
        })
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw an error and log if sourceUrl is not a string (null)', async () => {
      // global.fetch is already jest.fn() from beforeEach
      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = null;
      // @ts-ignore // Testing invalid input
      await expect(provider.fetchData(url)).rejects.toThrow(
        'HttpConfigurationProvider: sourceUrl must be a non-empty string.'
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message:
            'HttpConfigurationProvider: sourceUrl must be a non-empty string.',
        })
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw an error and log if fetch response is not ok (e.g., 404)', async () => {
      // Override the default global.fetch mock
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      );

      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = 'http://example.com/nonexistent.json';
      await expect(provider.fetchData(url)).rejects.toThrow(
        'Failed to fetch configuration file from http://example.com/nonexistent.json: Not Found'
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: `HttpConfigurationProvider: Failed to fetch configuration from ${url}. Status: 404 Not Found`,
        })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1); // Ensure fetch was actually called
    });

    it('should throw an error and log if fetch response is not ok (e.g., 500)', async () => {
      // Override the default global.fetch mock
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );
      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = 'http://example.com/server-error.json';

      await expect(provider.fetchData(url)).rejects.toThrow(
        `Failed to fetch configuration file from ${url}: Internal Server Error`
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: `HttpConfigurationProvider: Failed to fetch configuration from ${url}. Status: 500 Internal Server Error`,
        })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error and log if response.json() fails (invalid JSON)', async () => {
      const parseError = new Error('Unexpected token < in JSON at position 0');
      // Override the default global.fetch mock
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(parseError), // Simulate JSON.parse error
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
        `Failed to parse configuration data from ${url} as JSON: ${parseError.message}`
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: `HttpConfigurationProvider: Failed to parse JSON response from ${url}.`,
        })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error and log if fetch itself fails (network error)', async () => {
      const networkError = new Error('Network request failed');
      // Override the default global.fetch mock
      global.fetch = jest.fn(() => Promise.reject(networkError));

      const provider = new HttpConfigurationProvider({
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });
      const url = 'http://example.com/network-issue.json';
      await expect(provider.fetchData(url)).rejects.toThrow(
        `Could not load configuration from ${url}: ${networkError.message}`
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_ERROR_ID,
        expect.objectContaining({
          message: `HttpConfigurationProvider: Error loading or parsing configuration from ${url}. Detail: ${networkError.message}`,
        })
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
// --- FILE END ---
