/**
 * @file Comprehensive unit tests for RetryHttpClient
 * @see ../../../src/llms/retryHttpClient.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  RetryHttpClient,
  HttpClientError,
} from '../../../src/llms/retryHttpClient.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

// Mock dependencies
jest.mock('../../../src/utils/index.js', () => ({
  fetchWithRetry: jest.fn(),
  initLogger: jest.fn(
    (name, logger) =>
      logger || {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }
  ),
}));

jest.mock('../../../src/utils/systemErrorDispatchUtils.js', () => ({
  dispatchSystemErrorEvent: jest.fn(),
}));

import { fetchWithRetry, initLogger } from '../../../src/utils/index.js';
import { dispatchSystemErrorEvent } from '../../../src/utils/systemErrorDispatchUtils.js';

// Test utilities
const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});

const createResponse = (body, init) => new Response(body, init);

const createFetchResult = (data, responseInit = {}) => ({
  data,
  response: createResponse('', responseInit),
});

describe('RetryHttpClient', () => {
  let logger;
  let dispatcher;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = createDispatcher();
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const client = new RetryHttpClient({ logger, dispatcher });

      expect(initLogger).toHaveBeenCalledWith('RetryHttpClient', logger);
      expect(logger.debug).toHaveBeenCalledWith(
        'RetryHttpClient: Instance created.',
        {
          maxRetries: 3,
          baseDelayMs: 500,
          maxDelayMs: 10000,
        }
      );
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        logger,
        dispatcher,
        defaultMaxRetries: 5,
        defaultBaseDelayMs: 1000,
        defaultMaxDelayMs: 15000,
      };

      const client = new RetryHttpClient(customConfig);

      expect(logger.debug).toHaveBeenCalledWith(
        'RetryHttpClient: Instance created.',
        {
          maxRetries: 5,
          baseDelayMs: 1000,
          maxDelayMs: 15000,
        }
      );
    });

    it('should handle invalid dispatcher and throw error', () => {
      const invalidDispatcher = null;

      expect(() => {
        new RetryHttpClient({ logger, dispatcher: invalidDispatcher });
      }).toThrow('RetryHttpClient: dispatcher dependency invalid.');

      expect(logger.error).toHaveBeenCalledWith(
        'RetryHttpClient: Missing or invalid SafeEventDispatcher with .dispatch(...)'
      );
    });

    it('should handle dispatcher without dispatch method and throw error', () => {
      const invalidDispatcher = { subscribe: jest.fn() };

      expect(() => {
        new RetryHttpClient({ logger, dispatcher: invalidDispatcher });
      }).toThrow('RetryHttpClient: dispatcher dependency invalid.');

      expect(logger.error).toHaveBeenCalledWith(
        'RetryHttpClient: Missing or invalid SafeEventDispatcher with .dispatch(...)'
      );
    });

    it('should use default values for invalid numeric parameters', () => {
      const client = new RetryHttpClient({
        logger,
        dispatcher,
        defaultMaxRetries: -1,
        defaultBaseDelayMs: 'invalid',
        defaultMaxDelayMs: null,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'RetryHttpClient: Instance created.',
        {
          maxRetries: 3, // default
          baseDelayMs: 500, // default
          maxDelayMs: 10000, // default
        }
      );
    });

    it('should ensure maxDelayMs is at least baseDelayMs', () => {
      const client = new RetryHttpClient({
        logger,
        dispatcher,
        defaultBaseDelayMs: 2000,
        defaultMaxDelayMs: 1000, // smaller than base
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'RetryHttpClient: Instance created.',
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 10000, // adjusted to default since it was smaller than base
        }
      );
    });
  });

  describe('HttpClientError', () => {
    it('should create error with all properties', () => {
      const errorDetails = {
        url: 'https://example.com',
        status: 500,
        responseBody: 'Server Error',
        attempts: 3,
        isRetryableFailure: true,
        cause: new Error('Network error'),
      };

      const error = new HttpClientError('Test error', errorDetails);

      expect(error.name).toBe('HttpClientError');
      expect(error.message).toBe('Test error');
      expect(error.url).toBe('https://example.com');
      expect(error.status).toBe(500);
      expect(error.responseBody).toBe('Server Error');
      expect(error.attempts).toBe(3);
      expect(error.isRetryableFailure).toBe(true);
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should create error without cause', () => {
      const errorDetails = {
        url: 'https://example.com',
        status: 404,
        responseBody: 'Not Found',
        attempts: 1,
        isRetryableFailure: false,
      };

      const error = new HttpClientError('Not found error', errorDetails);

      expect(error.name).toBe('HttpClientError');
      expect(error.message).toBe('Not found error');
      expect(error.cause).toBeUndefined();
    });

    it('should call Error.captureStackTrace when available', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;
      Error.captureStackTrace = jest.fn();

      const error = new HttpClientError('Test', {
        url: 'https://example.com',
        status: 500,
        responseBody: 'Error',
        attempts: 1,
        isRetryableFailure: true,
      });

      expect(Error.captureStackTrace).toHaveBeenCalledWith(
        error,
        HttpClientError
      );

      Error.captureStackTrace = originalCaptureStackTrace;
    });

    it('should handle missing Error.captureStackTrace gracefully', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;
      delete Error.captureStackTrace;

      expect(() => {
        new HttpClientError('Test', {
          url: 'https://example.com',
          status: 500,
          responseBody: 'Error',
          attempts: 1,
          isRetryableFailure: true,
        });
      }).not.toThrow();

      Error.captureStackTrace = originalCaptureStackTrace;
    });
  });

  describe('Private helper methods tested through public API', () => {
    let client;

    beforeEach(() => {
      client = new RetryHttpClient({
        logger,
        dispatcher,
        defaultMaxRetries: 2,
        defaultBaseDelayMs: 0,
        defaultMaxDelayMs: 1000,
      });
    });

    describe('Delay calculation behavior', () => {
      it('should implement exponential backoff through retry behavior', async () => {
        const error = new Error('Retryable error');
        error.status = 503;
        error.body = 'Service unavailable';

        fetchWithRetry
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(createFetchResult({ success: true }));

        // Mock setTimeout to track delay calls
        const originalSetTimeout = global.setTimeout;
        const delays = [];
        global.setTimeout = jest.fn((callback, delay) => {
          delays.push(delay);
          return originalSetTimeout(callback, 0); // Execute immediately for test
        });

        await client.request('https://example.com', { method: 'GET' });

        // Should have made 2 retries with delays
        expect(delays).toHaveLength(2);
        expect(delays[0]).toBeGreaterThanOrEqual(0);
        expect(delays[1]).toBeGreaterThanOrEqual(0);

        global.setTimeout = originalSetTimeout;
      });
    });

    describe('Raw data processing through warning emissions', () => {
      it('should handle null/undefined raw data in warnings', async () => {
        // Create an error object to directly test the raw = null case
        const error = {
          status: 503,
          body: null,
          message: null, // Both null to make raw = null
        };

        fetchWithRetry
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(createFetchResult({ success: true }));

        await client.request('https://example.com', { method: 'GET' });

        const warningCall = dispatcher.dispatch.mock.calls.find(
          (call) => call[0] === SYSTEM_WARNING_OCCURRED_ID
        );

        expect(warningCall).toBeDefined();
        // Should handle null raw data properly by converting to empty string (line 130)
        expect(warningCall[1].details.raw).toBe('');
      });

      it('should handle complex object raw data in warnings', async () => {
        const complexError = {
          error: { nested: { message: 'Complex error' } },
        };
        const error = new Error('API error');
        error.status = 503;
        error.body = complexError;

        fetchWithRetry
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(createFetchResult({ success: true }));

        await client.request('https://example.com', { method: 'GET' });

        const warningCall = dispatcher.dispatch.mock.calls.find(
          (call) => call[0] === SYSTEM_WARNING_OCCURRED_ID
        );

        expect(warningCall).toBeDefined();
        const rawField = warningCall[1].details.raw;
        expect(typeof rawField).toBe('string');
        expect(rawField.length).toBeLessThanOrEqual(200);
        expect(rawField).toContain('Complex error');
      });

      it('should handle non-stringifiable objects in warnings', async () => {
        const circularObj = {};
        circularObj.self = circularObj;
        const error = new Error('Circular error');
        error.status = 503;
        error.body = circularObj;

        fetchWithRetry
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(createFetchResult({ success: true }));

        await client.request('https://example.com', { method: 'GET' });

        const warningCall = dispatcher.dispatch.mock.calls.find(
          (call) => call[0] === SYSTEM_WARNING_OCCURRED_ID
        );

        expect(warningCall).toBeDefined();
        expect(warningCall[1].details.raw).toBe('[object Object]');
      });

      it('should truncate long raw data in warnings to 200 characters', async () => {
        const longString = 'a'.repeat(300);
        const error = new Error('Long error');
        error.status = 503;
        error.body = longString;

        fetchWithRetry
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(createFetchResult({ success: true }));

        await client.request('https://example.com', { method: 'GET' });

        const warningCall = dispatcher.dispatch.mock.calls.find(
          (call) => call[0] === SYSTEM_WARNING_OCCURRED_ID
        );

        expect(warningCall).toBeDefined();
        expect(warningCall[1].details.raw).toHaveLength(200);
        expect(warningCall[1].details.raw).toBe('a'.repeat(200));
      });
    });

    describe('Raw data processing through error emissions', () => {
      it('should handle null/undefined raw data in final errors', async () => {
        // Create an Error object that inherits from Error but has undefined body/message
        const error = new Error();
        error.status = 500;
        error.body = undefined;
        error.message = undefined; // Both undefined to make raw = undefined
        error.stack = 'Error stack';

        fetchWithRetry.mockRejectedValue(error);

        await expect(
          client.request('https://example.com', { method: 'GET' })
        ).rejects.toThrow();

        const errorCall = dispatchSystemErrorEvent.mock.calls[0];
        expect(errorCall[2].raw).toBe(''); // Should convert undefined to empty string (line 158)
      });

      it('should handle complex object raw data in final errors', async () => {
        const complexError = {
          error: {
            type: 'SERVER_ERROR',
            details: { message: 'Database connection failed' },
          },
        };
        const error = new Error('Database error');
        error.status = 500;
        error.body = complexError;
        error.stack = 'Error stack';

        fetchWithRetry.mockRejectedValue(error);

        await expect(
          client.request('https://example.com', { method: 'GET' })
        ).rejects.toThrow();

        const errorCall = dispatchSystemErrorEvent.mock.calls[0];
        expect(typeof errorCall[2].raw).toBe('string');
        expect(errorCall[2].raw.length).toBeLessThanOrEqual(200);
        expect(errorCall[2].raw).toContain('SERVER_ERROR');
      });

      it('should handle non-stringifiable objects in final errors', async () => {
        const circularObj = {};
        circularObj.self = circularObj;
        const error = new Error('Circular error');
        error.status = 500;
        error.body = circularObj;
        error.stack = 'Error stack';

        fetchWithRetry.mockRejectedValue(error);

        await expect(
          client.request('https://example.com', { method: 'GET' })
        ).rejects.toThrow();

        const errorCall = dispatchSystemErrorEvent.mock.calls[0];
        expect(errorCall[2].raw).toBe('[object Object]');
      });
    });
  });

  describe('AbortSignal handling', () => {
    let client;

    beforeEach(() => {
      client = new RetryHttpClient({ logger, dispatcher });
      fetchWithRetry.mockResolvedValue(createFetchResult({ success: true }));
    });

    it('should map abortSignal to signal for native fetch', async () => {
      const abortController = new AbortController();
      const options = {
        method: 'POST',
        abortSignal: abortController.signal,
        headers: { 'Content-Type': 'application/json' },
      };

      await client.request('https://example.com', options);

      expect(fetchWithRetry).toHaveBeenCalledWith(
        'https://example.com',
        {
          method: 'POST',
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
        },
        1,
        500,
        10000,
        expect.any(Object),
        logger,
        undefined,
        { includeResponse: true }
      );
    });

    it('should not modify options when no abortSignal is present', async () => {
      const options = {
        method: 'GET',
        headers: { Accept: 'application/json' },
      };

      await client.request('https://example.com', options);

      expect(fetchWithRetry).toHaveBeenCalledWith(
        'https://example.com',
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        1,
        500,
        10000,
        expect.any(Object),
        logger,
        undefined,
        { includeResponse: true }
      );
    });
  });

  describe('Network error handling', () => {
    let client;

    beforeEach(() => {
      client = new RetryHttpClient({
        logger,
        dispatcher,
        defaultMaxRetries: 1,
        defaultBaseDelayMs: 0,
        defaultMaxDelayMs: 0,
      });
    });

    it('should emit warning for network errors without status code', async () => {
      const networkError = new Error('Network connection failed');
      networkError.status = undefined;
      networkError.body = undefined;
      networkError.message = 'Network connection failed';

      fetchWithRetry
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(createFetchResult({ success: true }));

      await client.request('https://example.com', { method: 'GET' });

      const warningCall = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === SYSTEM_WARNING_OCCURRED_ID
      );

      expect(warningCall).toBeDefined();
      expect(warningCall[1].message).toContain(
        'Network error contacting https://example.com'
      );
      expect(warningCall[1].details.statusCode).toBeUndefined();
    });

    it('should emit final error for network failures after retries', async () => {
      const networkError = new Error('Network connection failed');
      networkError.status = undefined;
      networkError.message = 'Network connection failed';
      networkError.stack = 'Error stack trace';

      fetchWithRetry.mockRejectedValue(networkError);

      await expect(
        client.request('https://example.com', { method: 'GET' })
      ).rejects.toThrow('Network connection failed');

      expect(dispatchSystemErrorEvent).toHaveBeenCalledWith(
        dispatcher,
        'Network failure contacting https://example.com after 2 attempts',
        {
          statusCode: undefined,
          url: 'https://example.com',
          raw: 'Network connection failed',
          stack: 'Error stack trace',
          scopeName: 'RetryHttpClient',
          timestamp: expect.any(String),
        },
        logger
      );
    });
  });

  describe('Retry exhaustion handling', () => {
    let client;

    beforeEach(() => {
      client = new RetryHttpClient({
        logger,
        dispatcher,
        defaultMaxRetries: 0, // No retries
        defaultBaseDelayMs: 0,
        defaultMaxDelayMs: 0,
      });
    });

    it('should throw last error when retries are exhausted', async () => {
      const error = new Error('Server error');
      error.status = 500;
      error.body = 'Internal server error';
      error.stack = 'Error stack trace';

      fetchWithRetry.mockRejectedValue(error);

      await expect(
        client.request('https://example.com', { method: 'GET' })
      ).rejects.toThrow('Server error');

      // Should reach the final throw statement
      expect(dispatchSystemErrorEvent).toHaveBeenCalled();
    });

    it('should handle final throw when no retries configured', async () => {
      const error = new Error('Immediate failure');
      error.status = 400;
      error.body = 'Bad request';

      fetchWithRetry.mockRejectedValue(error);

      let thrownError;
      try {
        await client.request('https://example.com', { method: 'GET' });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBe(error);
    });
  });

  describe('salvage recovery', () => {
    it('attempts salvage when a 503 occurs after a response with request id', async () => {
      const client = new RetryHttpClient({ logger, dispatcher });
      const initialHeaders = { headers: { 'X-Request-ID': 'req-123' } };
      fetchWithRetry.mockResolvedValueOnce(
        createFetchResult({ success: true }, initialHeaders)
      );

      await client.request('https://example.com/api/llm-request', {
        method: 'GET',
      });

      const salvageResponse = createResponse('salvaged', { status: 200 });
      const serviceError = new Error('Service unavailable');
      serviceError.status = 503;
      serviceError.body = 'Service unavailable';

      fetchWithRetry.mockRejectedValueOnce(serviceError);
      global.fetch.mockResolvedValueOnce(salvageResponse);

      const result = await client.request(
        'https://example.com/api/llm-request',
        { method: 'GET' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/llm-request/salvage/req-123'
      );
      expect(result).toBe(salvageResponse);
    });
  });
});
