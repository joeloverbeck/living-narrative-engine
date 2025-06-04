// llm-proxy-server/tests/utils/proxyApiUtils.test.js
// --- FILE START ---

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

// SUT (System Under Test)
import { Workspace_retry } from '../../src/utils/proxyApiUtils.js';

// Actual constants used by the SUT
import { RETRYABLE_HTTP_STATUS_CODES } from '../../src/config/constants.js';

// Mock the loggerUtils module
import { ensureValidLogger } from '../../src/utils/loggerUtils.js';

jest.mock('../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(),
}));

// For testing the private _calculateRetryDelay function's logic,
// we're copying its implementation here. In a typical scenario,
// this utility would be exported for direct testing.
/**
 * Simplified copy of the private _calculateRetryDelay used for unit testing.
 *
 * @param {number} currentAttempt - The current attempt number.
 * @param {number} baseDelayMs - Base delay in milliseconds.
 * @param {number} maxDelayMs - Maximum delay in milliseconds.
 * @returns {number} Calculated retry delay with jitter.
 */
function _calculateRetryDelay_forTest(currentAttempt, baseDelayMs, maxDelayMs) {
  const delayFactor = Math.pow(2, currentAttempt - 1);
  let delay = baseDelayMs * delayFactor;
  delay = Math.min(delay, maxDelayMs);
  const jitter = (Math.random() * 0.4 - 0.2) * delay; // Jitter is +/- 20%
  return Math.max(0, Math.floor(delay + jitter));
}

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('proxyApiUtils', () => {
  let mockLogger;
  const mockUrl = 'http://api.example.com/data';
  const mockDefaultOptions = { method: 'GET' };
  const mockMaxRetries = 3;
  const mockBaseDelayMs = 100;
  const mockMaxDelayMs = 1000;
  let mathRandomSpy;
  let consoleSpies = {};

  beforeEach(() => {
    mockLogger = createMockLogger();

    ensureValidLogger.mockImplementation(
      (loggerParam, fallbackMessagePrefix) => {
        if (
          loggerParam &&
          typeof loggerParam.info === 'function' &&
          typeof loggerParam.warn === 'function' &&
          typeof loggerParam.error === 'function' &&
          typeof loggerParam.debug === 'function'
        ) {
          return loggerParam;
        }
        const fallbackMock = createMockLogger();
        fallbackMock.isFallback = true;
        fallbackMock.fallbackMessagePrefix = fallbackMessagePrefix;
        return fallbackMock;
      }
    );

    global.fetch = jest.fn();
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    mathRandomSpy = jest.spyOn(Math, 'random');

    consoleSpies = {
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mathRandomSpy.mockRestore();
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  describe('_calculateRetryDelay (Conceptual Test)', () => {
    test('should calculate initial delay correctly with specific jitter', () => {
      mathRandomSpy.mockReturnValue(0.5); // No jitter (0.5 * 0.4 - 0.2 = 0)
      expect(_calculateRetryDelay_forTest(1, 100, 1000)).toBe(100);

      mathRandomSpy.mockReturnValue(0); // Max negative jitter (-20%)
      expect(_calculateRetryDelay_forTest(1, 100, 1000)).toBe(80);

      mathRandomSpy.mockReturnValue(1); // Max positive jitter (+20%)
      expect(_calculateRetryDelay_forTest(1, 100, 1000)).toBe(120);
    });

    test('should apply exponential backoff', () => {
      mathRandomSpy.mockReturnValue(0.5); // No jitter
      expect(_calculateRetryDelay_forTest(1, 100, 1000)).toBe(100);
      expect(_calculateRetryDelay_forTest(2, 100, 1000)).toBe(200);
      expect(_calculateRetryDelay_forTest(3, 100, 1000)).toBe(400);
    });

    test('should cap delay at maxDelayMs', () => {
      mathRandomSpy.mockReturnValue(0.5); // No jitter
      expect(_calculateRetryDelay_forTest(4, 100, 1000)).toBe(800);
      expect(_calculateRetryDelay_forTest(5, 100, 1000)).toBe(1000);
      expect(_calculateRetryDelay_forTest(6, 100, 1000)).toBe(1000);
    });

    test('should ensure delay is non-negative and integer', () => {
      mathRandomSpy.mockReturnValue(0); // Max negative jitter
      expect(_calculateRetryDelay_forTest(1, 10, 1000)).toBe(8);

      mathRandomSpy.mockReturnValue(0);
      expect(_calculateRetryDelay_forTest(1, 1, 1000)).toBe(0);

      mathRandomSpy.mockReturnValue(0.5); // No jitter
      expect(_calculateRetryDelay_forTest(1, 1.5, 1000)).toBe(1);
    });
  });

  describe('Workspace_retry', () => {
    const mockSuccessResponseData = { data: 'success' };
    const mockErrorJsonResponseData = {
      error: { message: 'error details', code: 'SOME_CODE' },
    };
    const mockErrorTextResponseData =
      'A plain text error occurred on the server.';

    const mockFetchResponse = (status, body, isJsonBody = true, ok = true) => {
      const response = {
        ok,
        status,
        statusText: `HTTP ${status}`,
        json: jest.fn(),
        text: jest.fn(),
      };
      if (isJsonBody) {
        response.json.mockResolvedValue(body);
        response.text.mockResolvedValueOnce(
          typeof body === 'string' ? body : JSON.stringify(body)
        );
      } else {
        response.text.mockResolvedValue(body);
        response.json.mockRejectedValueOnce(
          new Error('Response is not valid JSON')
        );
      }
      return response;
    };

    test('should return parsed JSON on successful fetch (first attempt)', async () => {
      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );

      const result = await Workspace_retry(
        mockUrl,
        mockDefaultOptions,
        mockMaxRetries,
        mockBaseDelayMs,
        mockMaxDelayMs,
        mockLogger
      );

      expect(result).toEqual(mockSuccessResponseData);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(mockUrl, mockDefaultOptions);
      expect(ensureValidLogger).toHaveBeenCalledWith(
        mockLogger,
        'Workspace_retry'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Workspace_retry: Initiating request sequence for ${mockUrl} with maxRetries=${mockMaxRetries}, baseDelayMs=${mockBaseDelayMs}, maxDelayMs=${mockMaxDelayMs}.`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Attempt 1/${mockMaxRetries} - Fetching ${mockDefaultOptions.method} ${mockUrl}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Workspace_retry: Attempt 1/${mockMaxRetries} for ${mockUrl} - Request successful (status 200). Parsing JSON response.`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Workspace_retry: Successfully fetched and parsed JSON from ${mockUrl} after 1 attempt(s).`
      );
      expect(setTimeout).not.toHaveBeenCalled();
    });

    RETRYABLE_HTTP_STATUS_CODES.forEach((status) => {
      test(`should retry on retryable HTTP status ${status} and succeed on second attempt`, async () => {
        fetch
          .mockResolvedValueOnce(
            mockFetchResponse(status, mockErrorJsonResponseData, true, false)
          )
          .mockResolvedValueOnce(
            mockFetchResponse(200, mockSuccessResponseData)
          );

        mathRandomSpy.mockReturnValue(0.5); // No jitter for predictable delay

        const promise = Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          mockMaxRetries,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        );

        await jest.runOnlyPendingTimersAsync();

        const result = await promise;

        expect(result).toEqual(mockSuccessResponseData);
        expect(fetch).toHaveBeenCalledTimes(2);
        const expectedDelay = _calculateRetryDelay_forTest(
          1,
          mockBaseDelayMs,
          mockMaxDelayMs
        );
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(
          expect.any(Function),
          expectedDelay
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `Attempt 1/${mockMaxRetries} for ${mockUrl} failed with status ${status}. Retrying in ${expectedDelay}ms... Error body preview: ${JSON.stringify(mockErrorJsonResponseData).substring(0, 100)}`
          )
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Workspace_retry: Successfully fetched and parsed JSON from ${mockUrl} after 2 attempt(s).`
        );
      });
    });

    test('should fail immediately for non-retryable HTTP status (e.g., 400)', async () => {
      const nonRetryableStatus = 400;
      fetch.mockResolvedValueOnce(
        mockFetchResponse(
          nonRetryableStatus,
          mockErrorJsonResponseData,
          true,
          false
        )
      );

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          mockMaxRetries,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `API request to ${mockUrl} failed after 1 attempt(s) with status ${nonRetryableStatus}: ${JSON.stringify(mockErrorJsonResponseData)}`
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Workspace_retry: API request to ${mockUrl} failed after 1 attempt(s) with status ${nonRetryableStatus}: ${JSON.stringify(mockErrorJsonResponseData)} (Attempt 1/${mockMaxRetries}, Non-retryable or max retries reached)`
      );
    });

    const networkErrorMessages = [
      'failed to fetch',
      'network request failed',
      'dns lookup failed',
      'socket hang up',
      'econnrefused',
      'econreset',
      'enotfound',
      'etimedout',
    ];
    networkErrorMessages.forEach((errMsg) => {
      test(`should retry on network error "${errMsg}" and succeed on second attempt`, async () => {
        const networkError = new TypeError(errMsg);
        fetch
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce(
            mockFetchResponse(200, mockSuccessResponseData)
          );
        mathRandomSpy.mockReturnValue(0.5);

        const promise = Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          mockMaxRetries,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        );
        await jest.runOnlyPendingTimersAsync();
        const result = await promise;

        expect(result).toEqual(mockSuccessResponseData);
        expect(fetch).toHaveBeenCalledTimes(2);
        const expectedDelay = _calculateRetryDelay_forTest(
          1,
          mockBaseDelayMs,
          mockMaxDelayMs
        );
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(
          expect.any(Function),
          expectedDelay
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `Workspace_retry: Attempt 1/${mockMaxRetries} for ${mockUrl} failed with network error: ${networkError.message}. Retrying in ${expectedDelay}ms...`
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Workspace_retry: Successfully fetched and parsed JSON from ${mockUrl} after 2 attempt(s).`
        );
      });
    });

    test('should fail immediately for non-network, non-HTTP (unexpected) error during fetch', async () => {
      const unexpectedError = new Error('Something totally unexpected!');
      fetch.mockRejectedValueOnce(unexpectedError);

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          mockMaxRetries,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `Workspace_retry: Failed for ${mockUrl} after 1 attempt(s). Unexpected error: ${unexpectedError.message}`
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Workspace_retry: Failed for ${mockUrl} after 1 attempt(s). Unexpected error: ${unexpectedError.message}`,
        expect.objectContaining({
          originalErrorName: unexpectedError.name,
          originalErrorMessage: unexpectedError.message,
        })
      );
    });

    test('should correctly parse JSON error response body on failure', async () => {
      fetch.mockResolvedValueOnce(
        mockFetchResponse(500, mockErrorJsonResponseData, true, false)
      );
      mathRandomSpy.mockReturnValue(0.5);

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          1,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `API request to ${mockUrl} failed after 1 attempt(s) with status 500: ${JSON.stringify(mockErrorJsonResponseData)}`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Attempt 1 for ${mockUrl} - Error response body (JSON): ${JSON.stringify(mockErrorJsonResponseData).substring(0, 500)}`
        )
      );
    });

    test('should correctly parse text error response body if JSON parsing fails', async () => {
      const response = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest
          .fn()
          .mockRejectedValueOnce(
            new Error('Invalid JSON syntax for error response')
          ),
        text: jest.fn().mockResolvedValueOnce(mockErrorTextResponseData),
      };
      fetch.mockResolvedValueOnce(response);
      mathRandomSpy.mockReturnValue(0.5);

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          1,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `API request to ${mockUrl} failed after 1 attempt(s) with status 500: ${mockErrorTextResponseData}`
      );
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(response.text).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Attempt 1 for ${mockUrl} - Error response body (Text): ${mockErrorTextResponseData.substring(0, 500)}`
        )
      );
    });

    test('should handle failure to parse error response body as JSON or text', async () => {
      const textParseError = new Error('Cannot parse text body');
      const response = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
        text: jest.fn().mockRejectedValueOnce(textParseError),
      };
      fetch.mockResolvedValueOnce(response);
      mathRandomSpy.mockReturnValue(0.5);
      const expectedFallbackBodyText = `Status: 500, StatusText: Internal Server Error`;

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          1,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `API request to ${mockUrl} failed after 1 attempt(s) with status 500: ${expectedFallbackBodyText}`
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Attempt 1 for ${mockUrl} - Failed to read error response body as JSON or text. Error: ${textParseError.message}`
      );
    });

    test('should use fallback logger if no logger is provided (via ensureValidLogger mock)', async () => {
      const fallbackLoggerInstance = createMockLogger();
      ensureValidLogger.mockImplementationOnce(() => fallbackLoggerInstance);

      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        mockDefaultOptions,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        null
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(null, 'Workspace_retry');
      expect(fallbackLoggerInstance.info).toHaveBeenCalledWith(
        `Workspace_retry: Initiating request sequence for ${mockUrl} with maxRetries=1, baseDelayMs=${mockBaseDelayMs}, maxDelayMs=${mockMaxDelayMs}.`
      );
      expect(fallbackLoggerInstance.debug).toHaveBeenCalledWith(
        `Attempt 1/1 - Fetching GET ${mockUrl}`
      );
    });

    test('should use fallback logger if an invalid logger is provided (via ensureValidLogger mock)', async () => {
      const invalidLogger = { log: 'not a valid logger structure' };
      const fallbackLoggerInstance = createMockLogger();
      ensureValidLogger.mockImplementationOnce(() => fallbackLoggerInstance);

      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        mockDefaultOptions,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        invalidLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        invalidLogger,
        'Workspace_retry'
      );
      expect(fallbackLoggerInstance.info).toHaveBeenCalledWith(
        `Workspace_retry: Initiating request sequence for ${mockUrl} with maxRetries=1, baseDelayMs=${mockBaseDelayMs}, maxDelayMs=${mockMaxDelayMs}.`
      );
    });

    test('should use actual fallback (console) logger when ensureValidLogger is set to use actual implementation', async () => {
      const actualEnsureValidLogger = jest.requireActual(
        '../../src/utils/loggerUtils.js'
      ).ensureValidLogger;
      ensureValidLogger.mockImplementationOnce((logger, prefix) =>
        actualEnsureValidLogger(logger, prefix)
      );

      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        mockDefaultOptions,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        null
      );

      const expectedInitialLogMessage = `Workspace_retry: Initiating request sequence for ${mockUrl} with maxRetries=1, baseDelayMs=${mockBaseDelayMs}, maxDelayMs=${mockMaxDelayMs}.`;
      expect(consoleSpies.info).toHaveBeenCalledWith(
        'Workspace_retry: ',
        expectedInitialLogMessage
      );

      const expectedAttemptLogMessage = `Attempt 1/1 - Fetching GET ${mockUrl}`;
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        'Workspace_retry: ',
        expectedAttemptLogMessage
      );

      jest.clearAllMocks();
      ensureValidLogger.mockImplementationOnce((logger, prefix) =>
        actualEnsureValidLogger(logger, prefix)
      );

      const invalidLogger = { custom: 'field' };
      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        mockDefaultOptions,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        invalidLogger
      );
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        'Workspace_retry: ',
        'An invalid logger instance was provided. Falling back to console logging with prefix "Workspace_retry".'
      );
    });

    test('should correctly use provided method in options and log it', async () => {
      const postOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      };
      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        postOptions,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        mockLogger
      );

      expect(fetch).toHaveBeenCalledWith(mockUrl, postOptions);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Attempt 1/1 - Fetching POST ${mockUrl}`
      );
    });

    test('should default to GET method for logging if options.method is undefined', async () => {
      const optionsWithoutMethod = { headers: { 'X-Test': 'header' } };
      fetch.mockResolvedValueOnce(
        mockFetchResponse(200, mockSuccessResponseData)
      );
      await Workspace_retry(
        mockUrl,
        optionsWithoutMethod,
        1,
        mockBaseDelayMs,
        mockMaxDelayMs,
        mockLogger
      );

      expect(fetch).toHaveBeenCalledWith(mockUrl, optionsWithoutMethod);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Attempt 1/1 - Fetching GET ${mockUrl}`
      );
    });

    test('should handle maxRetries = 0: attempts once, fails on error, no retry', async () => {
      const nonRetryableStatus = 400;
      fetch.mockResolvedValueOnce(
        mockFetchResponse(
          nonRetryableStatus,
          mockErrorJsonResponseData,
          true,
          false
        )
      );

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          0,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `API request to ${mockUrl} failed after 1 attempt(s) with status ${nonRetryableStatus}: ${JSON.stringify(mockErrorJsonResponseData)}`
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Workspace_retry: API request to ${mockUrl} failed after 1 attempt(s) with status ${nonRetryableStatus}: ${JSON.stringify(mockErrorJsonResponseData)} (Attempt 1/0, Non-retryable or max retries reached)`
      );
    });

    test('should handle maxRetries = 0 with network error: attempts once, fails, no retry', async () => {
      const networkError = new TypeError('failed to fetch');
      fetch.mockRejectedValueOnce(networkError);

      await expect(
        Workspace_retry(
          mockUrl,
          mockDefaultOptions,
          0,
          mockBaseDelayMs,
          mockMaxDelayMs,
          mockLogger
        )
      ).rejects.toThrow(
        `Workspace_retry: Failed for ${mockUrl} after 1 attempt(s) due to persistent network error: ${networkError.message}`
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Workspace_retry: Failed for ${mockUrl} after 1 attempt(s) due to persistent network error: ${networkError.message}`,
        {
          originalErrorName: networkError.name,
          originalErrorMessage: networkError.message,
        }
      );
    });
  });
});
// --- FILE END ---
