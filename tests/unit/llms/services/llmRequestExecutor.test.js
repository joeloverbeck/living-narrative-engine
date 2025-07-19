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
  });

  describe('handleAbortSignal', () => {
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
  });
});
