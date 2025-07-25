/**
 * @file Unit tests for LLMRequestExecutor service
 * @see src/llms/services/llmRequestExecutor.js
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { LLMRequestExecutor } from '../../../../src/llms/services/llmRequestExecutor.js';

describe('LLMRequestExecutor', () => {
  let requestExecutor;
  let mockLogger;
  let mockStrategy;

  beforeEach(() => {
    jest.useFakeTimers();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStrategy = {
      execute: jest.fn(),
    };

    requestExecutor = new LLMRequestExecutor({ logger: mockLogger });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(requestExecutor).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMRequestExecutor: Instance created.'
      );
    });

    it('should throw error with invalid logger', () => {
      expect(() => new LLMRequestExecutor({ logger: null })).toThrow(
        'Missing required dependency: ILogger.'
      );
      expect(() => new LLMRequestExecutor({ logger: {} })).toThrow(
        "Invalid or missing method 'info' on dependency 'ILogger'."
      );
    });
  });

  describe('executeRequest', () => {
    const mockEnvironmentContext = {
      getExecutionEnvironment: jest.fn().mockReturnValue('test'),
      isClient: jest.fn().mockReturnValue(false),
    };

    const defaultParams = {
      strategy: null,
      gameSummary: 'Test prompt',
      llmConfig: { configId: 'test-llm' },
      apiKey: 'test-key',
      environmentContext: mockEnvironmentContext,
    };

    it('should execute strategy successfully', async () => {
      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      const result = await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
      });

      expect(result).toBe('{"action": "test"}');
      expect(mockStrategy.execute).toHaveBeenCalledWith({
        gameSummary: 'Test prompt',
        llmConfig: { configId: 'test-llm' },
        apiKey: 'test-key',
        environmentContext: mockEnvironmentContext,
        abortSignal: undefined,
        requestOptions: {},
      });
    });

    it('should pass abort signal to strategy', async () => {
      const abortController = new AbortController();
      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
        abortSignal: abortController.signal,
      });

      expect(mockStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: abortController.signal,
          requestOptions: {},
        })
      );
    });

    it('should handle aborted requests', async () => {
      const abortController = new AbortController();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      mockStrategy.execute.mockRejectedValue(abortError);
      abortController.abort();

      await expect(
        requestExecutor.executeRequest({
          ...defaultParams,
          strategy: mockStrategy,
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow('Aborted');
    });

    it('should throw error for null strategy', async () => {
      await expect(
        requestExecutor.executeRequest(defaultParams)
      ).rejects.toThrow('Valid strategy with execute method is required');
    });

    it('should execute with custom requestOptions', async () => {
      const customOptions = { customParam: 'test-value' };
      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      const result = await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
        requestOptions: customOptions,
      });

      expect(result).toBe('{"action": "test"}');
      expect(mockStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOptions: customOptions,
        })
      );
    });

    it('should log requestOptions in debug', async () => {
      const customOptions = { param1: 'value1', param2: 'value2' };
      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
        requestOptions: customOptions,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMRequestExecutor: Executing request',
        expect.objectContaining({
          hasRequestOptions: true,
        })
      );
    });

    it('should trigger abort callback when signal is aborted', async () => {
      const abortController = new AbortController();
      const mockCallback = jest.fn();

      // Mock the handleAbortSignal to capture and call the callback
      const originalHandleAbortSignal = requestExecutor.handleAbortSignal;
      requestExecutor.handleAbortSignal = jest.fn((signal, callback) => {
        callback(); // Call the abort callback immediately
        return () => {}; // Return cleanup function
      });

      mockStrategy.execute.mockImplementation(async () => {
        abortController.abort();
        return '{"action": "test"}';
      });

      await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
        abortSignal: abortController.signal,
      });

      expect(requestExecutor.handleAbortSignal).toHaveBeenCalledWith(
        abortController.signal,
        expect.any(Function)
      );

      // Restore original method
      requestExecutor.handleAbortSignal = originalHandleAbortSignal;
    });

    it('should call cleanup function in finally block', async () => {
      const abortController = new AbortController();
      const mockCleanup = jest.fn();

      // Mock handleAbortSignal to return our cleanup function
      requestExecutor.handleAbortSignal = jest.fn(() => mockCleanup);

      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      await requestExecutor.executeRequest({
        ...defaultParams,
        strategy: mockStrategy,
        abortSignal: abortController.signal,
      });

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call cleanup function even when error occurs', async () => {
      const abortController = new AbortController();
      const mockCleanup = jest.fn();

      // Mock handleAbortSignal to return our cleanup function
      requestExecutor.handleAbortSignal = jest.fn(() => mockCleanup);

      const error = new Error('Test error');
      mockStrategy.execute.mockRejectedValue(error);

      await expect(
        requestExecutor.executeRequest({
          ...defaultParams,
          strategy: mockStrategy,
          abortSignal: abortController.signal,
        })
      ).rejects.toThrow('Test error');

      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('executeWithRetry', () => {
    const defaultParams = {
      strategy: null,
      gameSummary: 'Test prompt',
      llmConfig: { configId: 'test-llm' },
      apiKey: 'test-key',
      environmentContext: {
        getExecutionEnvironment: jest.fn().mockReturnValue('test'),
        isClient: jest.fn().mockReturnValue(false),
      },
    };

    it('should succeed on first try', async () => {
      mockStrategy.execute.mockResolvedValue('{"action": "test"}');

      const result = await requestExecutor.executeWithRetry({
        ...defaultParams,
        strategy: mockStrategy,
      });

      expect(result).toBe('{"action": "test"}');
      expect(mockStrategy.execute).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = new Error('Service Unavailable');
      retryableError.name = 'HttpClientError';
      retryableError.status = 503;

      mockStrategy.execute
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('{"action": "test"}');

      const resultPromise = requestExecutor.executeWithRetry({
        ...defaultParams,
        strategy: mockStrategy,
        maxRetries: 3,
      });

      // Fast-forward through retry delays
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result).toBe('{"action": "test"}');
      expect(mockStrategy.execute).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMRequestExecutor: Request failed, will retry',
        expect.any(Object)
      );
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new Error('Bad Request');
      nonRetryableError.name = 'HttpClientError';
      nonRetryableError.status = 400;

      mockStrategy.execute.mockRejectedValue(nonRetryableError);

      await expect(
        requestExecutor.executeWithRetry({
          ...defaultParams,
          strategy: mockStrategy,
        })
      ).rejects.toThrow('Bad Request');

      expect(mockStrategy.execute).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const retryableError = new Error('Service Unavailable');
      retryableError.name = 'HttpClientError';
      retryableError.status = 503;

      mockStrategy.execute
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('{"action": "test"}');

      const startTime = Date.now();
      const resultPromise = requestExecutor.executeWithRetry({
        ...defaultParams,
        strategy: mockStrategy,
        maxRetries: 3,
      });

      // First retry after 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStrategy.execute).toHaveBeenCalledTimes(2);

      // Second retry after 2000ms more (exponential backoff)
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockStrategy.execute).toHaveBeenCalledTimes(3);

      await resultPromise;
    });

    it('should handle maximum delay correctly', async () => {
      const retryableError = new Error('Service Unavailable');
      retryableError.name = 'HttpClientError';
      retryableError.status = 503;

      mockStrategy.execute
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('{"action": "test"}');

      const resultPromise = requestExecutor.executeWithRetry({
        ...defaultParams,
        strategy: mockStrategy,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 2500,
        backoffMultiplier: 3,
      });

      // First retry: 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockStrategy.execute).toHaveBeenCalledTimes(2);

      // Second retry: 3000ms, but capped at maxDelay (2500ms)
      await jest.advanceTimersByTimeAsync(2500);
      expect(mockStrategy.execute).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toBe('{"action": "test"}');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable HTTP status codes', () => {
      const error = new Error('Error');
      error.name = 'HttpClientError';

      error.status = 429;
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 500;
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 502;
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 503;
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 504;
      expect(requestExecutor.isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable HTTP status codes', () => {
      const error = new Error('Error');
      error.name = 'HttpClientError';

      error.status = 400;
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.status = 401;
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.status = 403;
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.status = 404;
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });

    it('should identify retryable network errors', () => {
      const error = new Error('Network error');
      error.code = 'ECONNRESET';
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.code = 'ETIMEDOUT';
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.code = 'ECONNREFUSED';
      expect(requestExecutor.isRetryableError(error)).toBe(false); // Not included in implementation
    });

    it('should not retry non-network errors', () => {
      const error = new Error('Generic error');
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.name = 'TypeError';
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });

    it('should identify retryable error types', () => {
      let error = new Error('Rate limit exceeded');
      error.name = 'RateLimitError';
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error = new Error('Server error');
      error.name = 'ServerError';
      expect(requestExecutor.isRetryableError(error)).toBe(true);
    });

    it('should identify NetworkError as retryable', () => {
      const error = new Error('Network error');
      error.name = 'NetworkError';
      expect(requestExecutor.isRetryableError(error)).toBe(true);
    });

    it('should handle errors without status property', () => {
      const error = new Error('Error without status');
      error.name = 'HttpClientError';
      // No status property
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });

    it('should handle generic errors with status property', () => {
      const error = new Error('Error with status');
      error.status = 503;
      // Not HttpClientError name, but has status
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 400;
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });

    it('should handle edge case status codes', () => {
      const error = new Error('Error');
      error.name = 'HttpClientError';

      error.status = 599;
      expect(requestExecutor.isRetryableError(error)).toBe(true);

      error.status = 600;
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.status = 499;
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });

    it('should handle non-ECONNRESET/ETIMEDOUT network codes', () => {
      const error = new Error('Network error');
      error.code = 'ENOTFOUND';
      expect(requestExecutor.isRetryableError(error)).toBe(false);

      error.code = 'ECONNREFUSED';
      expect(requestExecutor.isRetryableError(error)).toBe(false);
    });
  });

  describe('handleAbortSignal', () => {
    it('should handle invalid abort signal', () => {
      const cleanup = jest.fn();

      // Test with null signal
      let result = requestExecutor.handleAbortSignal(null, cleanup);
      expect(result).toBeInstanceOf(Function);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMRequestExecutor: Invalid abort signal provided'
      );

      // Test with signal without addEventListener
      const invalidSignal = {};
      result = requestExecutor.handleAbortSignal(invalidSignal, cleanup);
      expect(result).toBeInstanceOf(Function);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LLMRequestExecutor: Invalid abort signal provided'
      );
    });

    it('should setup abort listener correctly', () => {
      const abortController = new AbortController();
      const cleanup = jest.fn();
      const addEventListenerSpy = jest.spyOn(
        abortController.signal,
        'addEventListener'
      );

      const cleanupFn = requestExecutor.handleAbortSignal(
        abortController.signal,
        cleanup
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      );
      expect(cleanupFn).toBeInstanceOf(Function);
    });

    it('should execute cleanup when abort signal is triggered', () => {
      const abortController = new AbortController();
      const cleanup = jest.fn();

      requestExecutor.handleAbortSignal(abortController.signal, cleanup);

      // Trigger abort
      abortController.abort();

      expect(cleanup).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMRequestExecutor: Abort signal received'
      );
    });

    it('should handle non-function cleanup gracefully', () => {
      const abortController = new AbortController();
      const nonFunctionCleanup = 'not a function';

      requestExecutor.handleAbortSignal(
        abortController.signal,
        nonFunctionCleanup
      );

      // Trigger abort - should not throw
      expect(() => abortController.abort()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMRequestExecutor: Abort signal received'
      );
    });

    it('should remove event listener when cleanup function is called', () => {
      const abortController = new AbortController();
      const cleanup = jest.fn();
      const removeEventListenerSpy = jest.spyOn(
        abortController.signal,
        'removeEventListener'
      );

      const cleanupFn = requestExecutor.handleAbortSignal(
        abortController.signal,
        cleanup
      );

      // Call the returned cleanup function
      cleanupFn();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      );
    });

    it('should handle abort signal without cleanup function', () => {
      const abortController = new AbortController();

      requestExecutor.handleAbortSignal(abortController.signal);

      // Trigger abort - should not throw
      expect(() => abortController.abort()).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMRequestExecutor: Abort signal received'
      );
    });
  });

  describe('validation', () => {
    it('should throw error for null options', async () => {
      await expect(requestExecutor.executeRequest(null)).rejects.toThrow(
        'LLMRequestExecutor: Request options are required'
      );

      await expect(requestExecutor.executeRequest(undefined)).rejects.toThrow(
        'LLMRequestExecutor: Request options are required'
      );
    });

    it('should throw error for non-object options', async () => {
      await expect(requestExecutor.executeRequest('invalid')).rejects.toThrow(
        'LLMRequestExecutor: Request options are required'
      );

      await expect(requestExecutor.executeRequest(123)).rejects.toThrow(
        'LLMRequestExecutor: Request options are required'
      );
    });

    it('should throw error for non-string gameSummary', async () => {
      const invalidOptions = {
        strategy: { execute: jest.fn() },
        gameSummary: 123, // Not a string
        llmConfig: { configId: 'test' },
        environmentContext: {
          getExecutionEnvironment: jest.fn().mockReturnValue('test'),
        },
      };

      await expect(
        requestExecutor.executeRequest(invalidOptions)
      ).rejects.toThrow('LLMRequestExecutor: gameSummary must be a string');
    });

    it('should throw error for invalid llmConfig', async () => {
      const invalidOptions = {
        strategy: { execute: jest.fn() },
        gameSummary: 'Test prompt',
        llmConfig: null, // Invalid
        environmentContext: {
          getExecutionEnvironment: jest.fn().mockReturnValue('test'),
        },
      };

      await expect(
        requestExecutor.executeRequest(invalidOptions)
      ).rejects.toThrow('LLMRequestExecutor: llmConfig is required');
    });

    it('should throw error for invalid environmentContext', async () => {
      const invalidOptions = {
        strategy: { execute: jest.fn() },
        gameSummary: 'Test prompt',
        llmConfig: { configId: 'test' },
        environmentContext: null, // Invalid
      };

      await expect(
        requestExecutor.executeRequest(invalidOptions)
      ).rejects.toThrow(
        'LLMRequestExecutor: Valid environmentContext is required'
      );

      // Test with environmentContext without required method
      invalidOptions.environmentContext = { someOtherMethod: jest.fn() };
      await expect(
        requestExecutor.executeRequest(invalidOptions)
      ).rejects.toThrow(
        'LLMRequestExecutor: Valid environmentContext is required'
      );
    });
  });
});
