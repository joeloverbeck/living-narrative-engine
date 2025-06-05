// llm-proxy-server/tests/utils/responseUtils.test.js
// --- FILE START ---
import { describe, expect, jest, test, beforeEach } from '@jest/globals';

// 1. Mock loggerUtils.js
// The factory now directly assigns jest.fn() to ensureValidLogger.
jest.mock('../../src/utils/loggerUtils', () => ({
  ensureValidLogger: jest.fn(),
}));

// 2. Import the SUT (System Under Test) and other dependencies AFTER mocks.
import { sendProxyError } from '../../src/utils/responseUtils';
import { LOG_LLM_ID_NOT_APPLICABLE } from '../../src/config/constants';

// 3. Import the mocked function(s) AFTER jest.mock.
// This 'ensureValidLogger' is now the mock function we defined in jest.mock.
import { ensureValidLogger } from '../../src/utils/loggerUtils';

describe('sendProxyError', () => {
  let mockRes;
  let mockLogger; // This will be the logger instance we expect our SUT to use.

  beforeEach(() => {
    // Reset mocks for each test. This also clears call history on the imported ensureValidLogger.
    jest.clearAllMocks();

    // Setup a fresh mock logger instance for each test.
    // This is the object that our mocked ensureValidLogger will return.
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Configure the imported (and mocked) ensureValidLogger to return our mockLogger instance.
    ensureValidLogger.mockReturnValue(mockLogger);

    // Setup a fresh mock Express response object for each test
    mockRes = {
      status: jest.fn().mockReturnThis(), // Allows chaining res.status().json()
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      headersSent: false, // Default to headers not sent
    };
  });

  test('should send a JSON error response and log the error', () => {
    const httpStatusCode = 400;
    const stage = 'validation_error';
    const errorMessage = 'Invalid input';
    const details = { field: 'email', issue: 'format' };
    const llmIdForLog = 'test-llm-1';
    const originalLoggerPassedToFunction = { custom: 'logger' }; // A dummy logger passed to sendProxyError

    sendProxyError(
      mockRes,
      httpStatusCode,
      stage,
      errorMessage,
      details,
      llmIdForLog,
      originalLoggerPassedToFunction
    );

    // Verify that ensureValidLogger was called with the original logger and context string
    expect(ensureValidLogger).toHaveBeenCalledWith(
      originalLoggerPassedToFunction,
      'sendProxyError'
    );

    // Verify that the logger returned by ensureValidLogger (i.e., mockLogger) was used
    expect(mockLogger.error).toHaveBeenCalledWith(
      `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
      { errorDetailsSentToClient: details }
    );
    expect(mockRes.status).toHaveBeenCalledWith(httpStatusCode);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: true,
      message: errorMessage,
      stage: stage,
      details: details,
      originalStatusCode: httpStatusCode,
    });
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockRes.send).not.toHaveBeenCalled();
  });

  test('should use LOG_LLM_ID_NOT_APPLICABLE if llmIdForLog is not provided', () => {
    const httpStatusCode = 500;
    const stage = 'internal_error';
    const errorMessage = 'Something went wrong';
    const originalLoggerPassedToFunction = { type: 'another_logger' };

    sendProxyError(
      mockRes,
      httpStatusCode,
      stage,
      errorMessage,
      {},
      undefined,
      originalLoggerPassedToFunction
    );

    expect(ensureValidLogger).toHaveBeenCalledWith(
      originalLoggerPassedToFunction,
      'sendProxyError'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`LLM ID for log: ${LOG_LLM_ID_NOT_APPLICABLE}`),
      expect.any(Object)
    );
  });

  test('should ensure details is an empty object if not provided', () => {
    const httpStatusCode = 404;
    const stage = 'not_found';
    const errorMessage = 'Resource not found';
    const originalLoggerPassedToFunction = null; // Test with null logger too

    sendProxyError(
      mockRes,
      httpStatusCode,
      stage,
      errorMessage,
      undefined,
      undefined,
      originalLoggerPassedToFunction
    );

    expect(ensureValidLogger).toHaveBeenCalledWith(
      originalLoggerPassedToFunction,
      'sendProxyError'
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {},
      })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), {
      errorDetailsSentToClient: {},
    });
  });

  test('should warn and not attempt to send response if headers were already sent', () => {
    mockRes.headersSent = true;
    const httpStatusCode = 503;
    const stage = 'service_unavailable';
    const errorMessage = 'Service is down';
    const details = { retryAfter: 120 };
    const llmIdForLog = 'test-llm-2';
    const originalLoggerPassedToFunction = {};

    sendProxyError(
      mockRes,
      httpStatusCode,
      stage,
      errorMessage,
      details,
      llmIdForLog,
      originalLoggerPassedToFunction
    );

    expect(ensureValidLogger).toHaveBeenCalledWith(
      originalLoggerPassedToFunction,
      'sendProxyError'
    );

    // The first error log (intent to send) still happens
    expect(mockLogger.error).toHaveBeenCalledWith(
      `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
      { errorDetailsSentToClient: details }
    );

    // Then the warning about headers already sent
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `LLM Proxy Server: Attempted to send error response, but headers were already sent. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
      { errorDetailsNotSentDueToHeaders: details }
    );

    // No attempt to set status or send json/send should be made if headers are sent
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockRes.send).not.toHaveBeenCalled(); // Also check res.send
  });

  describe('Fallback Mechanisms on Send Failure', () => {
    const httpStatusCode = 500;
    const stage = 'critical_failure';
    const errorMessage = 'Failed to process request';
    const details = { internalCode: 'XF-123' };
    const llmIdForLog = 'fallback-llm';
    const sendJsonError = new Error('Failed to serialize JSON');
    sendJsonError.name = 'TypeError';
    const originalLoggerPassedToFunction = { id: 'fallbackLogger' };

    beforeEach(() => {
      // Common setup for fallback tests: res.json() will throw an error
      mockRes.json.mockImplementation(() => {
        throw sendJsonError;
      });
    });

    test('should log critical error and attempt to send plain text if res.json() fails', () => {
      sendProxyError(
        mockRes,
        httpStatusCode,
        stage,
        errorMessage,
        details,
        llmIdForLog,
        originalLoggerPassedToFunction
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        originalLoggerPassedToFunction,
        'sendProxyError'
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(2); // Initial log + critical failure log

      // First log: attempt to send (this happens before .json() is called)
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
        { errorDetailsSentToClient: details }
      );

      // Second log: critical failure to send the original error
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        `LLM Proxy Server: CRITICAL - Failed to send original error response to client. LLM ID for log: ${llmIdForLog}, Original Stage: "${stage}", Original Message: "${errorMessage}". Send Error: ${sendJsonError.message}`,
        {
          originalErrorIntendedForClient: {
            error: true,
            message: errorMessage,
            stage: stage,
            details: details,
            originalStatusCode: httpStatusCode,
          },
          failureToSendDetails: {
            name: sendJsonError.name,
            stack: sendJsonError.stack,
          },
        }
      );

      expect(mockRes.status).toHaveBeenCalledWith(httpStatusCode); // Initial attempt for .json()
      expect(mockRes.json).toHaveBeenCalledTimes(1); // Attempted once

      // Fallback attempt
      // res.status should be called again for the fallback, making it twice in total for status.
      expect(mockRes.status).toHaveBeenCalledWith(500); // Fallback status
      expect(mockRes.status).toHaveBeenCalledTimes(2); // Once for original, once for fallback
      expect(mockRes.send).toHaveBeenCalledWith(
        'Internal Server Error: Failed to format and send detailed error response.'
      );
    });

    test('should log critical error multiple times if res.json() and res.send() fail, when headers not sent', () => {
      const sendTextError = new Error('Failed to send plain text');
      sendTextError.name = 'StreamClosedError';
      mockRes.send.mockImplementation(() => {
        throw sendTextError;
      });

      sendProxyError(
        mockRes,
        httpStatusCode,
        stage,
        errorMessage,
        details,
        llmIdForLog,
        originalLoggerPassedToFunction
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        originalLoggerPassedToFunction,
        'sendProxyError'
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(3); // Initial log + critical json failure + critical send failure

      // First log (intent to send)
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
        { errorDetailsSentToClient: details }
      );

      // Second log (failure of res.json)
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        `LLM Proxy Server: CRITICAL - Failed to send original error response to client. LLM ID for log: ${llmIdForLog}, Original Stage: "${stage}", Original Message: "${errorMessage}". Send Error: ${sendJsonError.message}`,
        expect.objectContaining({
          originalErrorIntendedForClient: expect.any(Object),
        })
      );

      // Third log: failure of the last-ditch attempt (res.send)
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        3,
        `LLM Proxy Server: CRITICAL - Failed even to send last-ditch plain text error. LLM ID for log: ${llmIdForLog}. Last Ditch Error: ${sendTextError.message}`,
        {
          lastDitchSendErrorDetails: {
            name: sendTextError.name,
            stack: sendTextError.stack,
          },
        }
      );

      expect(mockRes.json).toHaveBeenCalledTimes(1);
      expect(mockRes.send).toHaveBeenCalledTimes(1);
    });

    test('should not attempt fallback send if headers become sent after res.json() fails but before res.send()', () => {
      mockRes.json.mockImplementation(() => {
        // Simulate headers being sent immediately after .json() fails (e.g., by an error handler in Express closing the connection)
        mockRes.headersSent = true;
        throw sendJsonError;
      });

      sendProxyError(
        mockRes,
        httpStatusCode,
        stage,
        errorMessage,
        details,
        llmIdForLog,
        originalLoggerPassedToFunction
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        originalLoggerPassedToFunction,
        'sendProxyError'
      );
      // Initial log and critical failure for .json()
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
        { errorDetailsSentToClient: details }
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        `LLM Proxy Server: CRITICAL - Failed to send original error response to client. LLM ID for log: ${llmIdForLog}, Original Stage: "${stage}", Original Message: "${errorMessage}". Send Error: ${sendJsonError.message}`,
        expect.any(Object) // Details checked in other tests
      );

      // Fallback res.send should NOT have been called because headersSent is now true
      expect(mockRes.send).not.toHaveBeenCalled();
    });
  });
});
// --- FILE END ---
