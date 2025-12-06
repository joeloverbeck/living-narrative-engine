/**
 * @file Unit tests for metrics middleware
 * @description Tests for HTTP request tracking and LLM metrics collection middleware
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
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
  createCacheMetricsRecorder,
} from '../../../src/middleware/metrics.js';

describe('Metrics Middleware', () => {
  let mockMetricsService;
  let mockLogger;
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockMetricsService = {
      recordHttpRequest: jest.fn(),
      recordLlmRequest: jest.fn(),
      recordCacheOperation: jest.fn(),
      recordError: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRequest = {
      method: 'POST',
      originalUrl: '/api/llm-request',
      url: '/api/llm-request',
      path: '/api/llm-request',
      headers: {
        'content-type': 'application/json',
        'content-length': '1024',
      },
      body: {
        llmId: 'openai-gpt-3.5-turbo',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
        },
      },
      get: jest.fn((header) => mockRequest.headers[header.toLowerCase()]),
      correlationId: 'test-correlation-123',
    };

    mockResponse = {
      statusCode: 200,
      end: jest.fn(),
      json: jest.fn(),
      on: jest.fn(),
      get: jest.fn((header) => mockResponse.headers?.[header.toLowerCase()]),
      set: jest.fn(),
      headers: {
        'content-length': '2048',
      },
    };

    mockNext = jest.fn();

    // Mock process.hrtime.bigint
    global.process.hrtime = {
      bigint: jest.fn().mockReturnValue(BigInt(1000000000)), // 1 second in nanoseconds
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMetricsMiddleware', () => {
    it('should create middleware that tracks HTTP requests', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should throw error when metricsService is not provided', () => {
      expect(() => {
        createMetricsMiddleware({ logger: mockLogger });
      }).toThrow('metricsService is required for metrics middleware');
    });

    it('should return no-op middleware when disabled', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
        enabled: false,
      });

      middleware(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockMetricsService.recordHttpRequest).not.toHaveBeenCalled();
    });

    it('should skip metrics for /metrics endpoint', () => {
      mockRequest.path = '/metrics';

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockMetricsService.recordHttpRequest).not.toHaveBeenCalled();
    });

    it('should record metrics when response ends', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      // Mock hrtime to show progression
      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Simulate response ending
      const originalEnd = mockResponse.end;
      mockResponse.end('response data');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith({
        method: 'POST',
        route: '/api/llm-request',
        statusCode: 200,
        duration: expect.any(Number),
        requestSize: 1024,
        responseSize: expect.any(Number),
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('should record metrics on response finish event', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Simulate response finish event
      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalled();
    });

    it('should record error metrics for 4xx status codes', () => {
      mockResponse.statusCode = 400;

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('error response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalled();
      expect(mockMetricsService.recordError).toHaveBeenCalledWith({
        errorType: 'bad_request',
        component: 'http_server',
        severity: 'low',
      });
    });

    it('should record error metrics for 5xx status codes', () => {
      mockResponse.statusCode = 500;

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('server error');

      expect(mockMetricsService.recordError).toHaveBeenCalledWith({
        errorType: 'internal_server_error',
        component: 'http_server',
        severity: 'high',
      });
    });

    it('should handle custom route resolver', () => {
      const customRouteResolver = jest.fn().mockReturnValue('/custom/route');

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
        routeResolver: customRouteResolver,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(customRouteResolver).toHaveBeenCalledWith(mockRequest);
      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/custom/route',
        })
      );
    });

    it('should handle errors during metrics recording gracefully', () => {
      mockMetricsService.recordHttpRequest.mockImplementation(() => {
        throw new Error('Metrics recording failed');
      });

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      expect(() => {
        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.end('response');
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording HTTP request metrics',
        expect.any(Error)
      );
    });

    it('should estimate request size from body when Content-Length is missing', () => {
      delete mockRequest.headers['content-length'];
      mockRequest.get.mockReturnValue(undefined);

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestSize: expect.any(Number), // Should estimate from body
        })
      );
    });
  });

  describe('createLlmMetricsMiddleware', () => {
    it('should create LLM-specific metrics middleware', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3);
    });

    it('should throw error when metricsService is not provided', () => {
      expect(() => {
        createLlmMetricsMiddleware({ logger: mockLogger });
      }).toThrow('metricsService is required for LLM metrics middleware');
    });

    it('should record LLM metrics when response is sent', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Simulate successful LLM response
      const responseData = {
        data: {
          choices: [{ message: { content: 'AI response' } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
          },
        },
      };

      mockResponse.json(responseData);

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        status: 'success',
        duration: expect.any(Number),
        tokens: {
          input: 100,
          output: 50,
        },
      });
    });

    it('should handle error responses in LLM metrics', () => {
      mockResponse.statusCode = 500;

      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.json({ error: 'LLM request failed' });

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });

    it('should parse different LLM ID formats', () => {
      const testCases = [
        {
          llmId: 'anthropic-claude-3-haiku',
          expectedProvider: 'anthropic',
          expectedModel: 'claude-3-haiku',
        },
        {
          llmId: 'openrouter/anthropic/claude-3-haiku',
          expectedProvider: 'openrouter_anthropic',
          expectedModel: 'claude-3-haiku',
        },
        {
          llmId: 'unknown-format',
          expectedProvider: 'unknown',
          expectedModel: 'unknown-format',
        },
        { llmId: null, expectedProvider: 'unknown', expectedModel: 'unknown' },
      ];

      testCases.forEach(({ llmId, expectedProvider, expectedModel }) => {
        mockRequest.body.llmId = llmId;

        const middleware = createLlmMetricsMiddleware({
          metricsService: mockMetricsService,
          logger: mockLogger,
        });

        let timeCounter = 0;
        global.process.hrtime.bigint = jest.fn(() =>
          BigInt(timeCounter++ * 1000000000)
        );

        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.json({ success: true });

        expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: expectedProvider,
            model: expectedModel,
          })
        );

        jest.clearAllMocks();
      });
    });

    it('should extract tokens from different response formats', () => {
      const testCases = [
        {
          responseData: {
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          },
          expectedTokens: { input: 100, output: 50 },
        },
        {
          responseData: { usage: { input_tokens: 80, output_tokens: 40 } },
          expectedTokens: { input: 80, output: 40 },
        },
        {
          responseData: { token_usage: { input: 60, output: 30 } },
          expectedTokens: { input: 60, output: 30 },
        },
        {
          responseData: {
            data: { usage: { prompt_tokens: 120, completion_tokens: 60 } },
          },
          expectedTokens: { input: 120, output: 60 },
        },
        {
          responseData: { no_usage: true },
          expectedTokens: null,
        },
      ];

      testCases.forEach(({ responseData, expectedTokens }) => {
        const middleware = createLlmMetricsMiddleware({
          metricsService: mockMetricsService,
          logger: mockLogger,
        });

        let timeCounter = 0;
        global.process.hrtime.bigint = jest.fn(() =>
          BigInt(timeCounter++ * 1000000000)
        );

        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.json(responseData);

        expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            tokens: expectedTokens,
          })
        );

        jest.clearAllMocks();
      });
    });

    it('should handle errors during LLM metrics recording gracefully', () => {
      mockMetricsService.recordLlmRequest.mockImplementation(() => {
        throw new Error('LLM metrics recording failed');
      });

      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      expect(() => {
        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.json({ success: true });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording LLM request metrics',
        expect.any(Error)
      );
    });
  });

  describe('createCacheMetricsRecorder', () => {
    it('should create cache metrics recorder', () => {
      const recorder = createCacheMetricsRecorder({
        metricsService: mockMetricsService,
        cacheType: 'api_key',
      });

      expect(recorder).toBeDefined();
      expect(typeof recorder.recordOperation).toBe('function');
      expect(typeof recorder.recordStats).toBe('function');
    });

    it('should throw error when metricsService is not provided', () => {
      expect(() => {
        createCacheMetricsRecorder({ cacheType: 'test' });
      }).toThrow('metricsService is required for cache metrics recorder');
    });

    it('should record cache operations correctly', () => {
      const recorder = createCacheMetricsRecorder({
        metricsService: mockMetricsService,
        cacheType: 'api_key',
      });

      recorder.recordOperation('get', 'hit', { size: 50 });

      expect(mockMetricsService.recordCacheOperation).toHaveBeenCalledWith({
        operation: 'get',
        result: 'hit',
        cacheType: 'api_key',
        size: 50,
      });
    });

    it('should record cache stats correctly', () => {
      const recorder = createCacheMetricsRecorder({
        metricsService: mockMetricsService,
        cacheType: 'general',
      });

      recorder.recordStats(100, 1024000);

      expect(mockMetricsService.recordCacheOperation).toHaveBeenCalledWith({
        operation: 'stats_update',
        result: 'success',
        cacheType: 'general',
        size: 100,
        memoryUsage: 1024000,
      });
    });

    it('should use default cache type when not specified', () => {
      const recorder = createCacheMetricsRecorder({
        metricsService: mockMetricsService,
      });

      recorder.recordOperation('set', 'success');

      expect(mockMetricsService.recordCacheOperation).toHaveBeenCalledWith({
        operation: 'set',
        result: 'success',
        cacheType: 'general',
      });
    });
  });

  describe('Route Resolution', () => {
    it('should resolve common routes correctly', () => {
      const testCases = [
        { url: '/health', expected: '/health' },
        { url: '/health/ready', expected: '/health/ready' },
        { url: '/metrics', expected: '/metrics' },
        { url: '/api/llm-request', expected: '/api/llm-request' },
        { url: '/api/other', expected: '/api/*' },
        { url: '/', expected: '/' },
        { url: '', expected: '/' },
        { url: '/users/123', expected: '/users/:id' },
        { url: '/files/abc123def456', expected: '/files/:hash' },
        { url: '/api/v1/test', expected: '/api/v*/test' },
        { url: '/test?param=value', expected: '/test' },
      ];

      testCases.forEach(({ url, expected }) => {
        mockRequest.originalUrl = url;
        mockRequest.url = url;

        const middleware = createMetricsMiddleware({
          metricsService: mockMetricsService,
          logger: mockLogger,
        });

        let timeCounter = 0;
        global.process.hrtime.bigint = jest.fn(() =>
          BigInt(timeCounter++ * 1000000000)
        );

        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.end('response');

        expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            route: expected,
          })
        );

        jest.clearAllMocks();
      });
    });
  });

  describe('Error Type and Severity Detection', () => {
    it('should detect error types correctly from status codes', () => {
      const testCases = [
        {
          statusCode: 400,
          expectedType: 'bad_request',
          expectedSeverity: 'low',
        },
        {
          statusCode: 401,
          expectedType: 'unauthorized',
          expectedSeverity: 'medium',
        },
        {
          statusCode: 403,
          expectedType: 'forbidden',
          expectedSeverity: 'medium',
        },
        { statusCode: 404, expectedType: 'not_found', expectedSeverity: 'low' },
        {
          statusCode: 429,
          expectedType: 'rate_limit_exceeded',
          expectedSeverity: 'medium',
        },
        {
          statusCode: 500,
          expectedType: 'internal_server_error',
          expectedSeverity: 'high',
        },
        {
          statusCode: 502,
          expectedType: 'bad_gateway',
          expectedSeverity: 'high',
        },
        {
          statusCode: 503,
          expectedType: 'service_unavailable',
          expectedSeverity: 'high',
        },
      ];

      testCases.forEach(({ statusCode, expectedType, expectedSeverity }) => {
        mockResponse.statusCode = statusCode;

        const middleware = createMetricsMiddleware({
          metricsService: mockMetricsService,
          logger: mockLogger,
        });

        let timeCounter = 0;
        global.process.hrtime.bigint = jest.fn(() =>
          BigInt(timeCounter++ * 1000000000)
        );

        middleware(mockRequest, mockResponse, mockNext);
        mockResponse.end('error response');

        expect(mockMetricsService.recordError).toHaveBeenCalledWith({
          errorType: expectedType,
          component: 'http_server',
          severity: expectedSeverity,
        });

        jest.clearAllMocks();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle multiple response end calls gracefully', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Call end multiple times
      mockResponse.end('first');
      mockResponse.end('second');

      // Trigger finish event as well
      const finishHandler = mockResponse.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      // Should only record metrics once
      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle missing request properties gracefully', () => {
      const incompleteRequest = {
        // Missing many properties
        method: 'GET',
        get: jest.fn().mockReturnValue(undefined),
      };

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      expect(() => {
        middleware(incompleteRequest, mockResponse, mockNext);
        mockResponse.end('response');
      }).not.toThrow();
    });

    it('should handle very large request/response sizes', () => {
      mockRequest.headers['content-length'] = '10000000'; // 10MB
      mockResponse.headers['content-length'] = '20000000'; // 20MB

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('large response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestSize: 10000000,
          responseSize: expect.any(Number),
        })
      );
    });

    it('should perform well with high request volume', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      const startTime = performance.now();

      // Simulate many requests
      for (let i = 0; i < 1000; i++) {
        const req = { ...mockRequest };
        const res = { ...mockResponse, end: jest.fn(), on: jest.fn() };
        const next = jest.fn();

        let timeCounter = 0;
        global.process.hrtime.bigint = jest.fn(() =>
          BigInt(timeCounter++ * 1000000000)
        );

        middleware(req, res, next);
        res.end('response');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly even with many requests
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('Additional branch coverage scenarios', () => {
    it('should throw when metrics middleware is called without options', () => {
      expect(() => createMetricsMiddleware()).toThrow(
        'metricsService is required for metrics middleware'
      );
    });

    it('should default to console logger when no logger is provided', () => {
      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(debugSpy).toHaveBeenCalledWith(
        'HTTP request metrics recorded',
        expect.objectContaining({
          method: mockRequest.method,
          route: mockRequest.originalUrl,
          statusCode: mockResponse.statusCode,
          correlationId: mockRequest.correlationId,
        })
      );

      debugSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should fallback to default request size when JSON serialization fails', () => {
      delete mockRequest.headers['content-length'];
      mockRequest.get = jest.fn(() => undefined);
      const circular = {};
      circular.self = circular;
      mockRequest.body = circular;

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ requestSize: 1000 })
      );
    });

    it('should return zero request size when header access throws an error', () => {
      delete mockRequest.headers['content-length'];
      delete mockRequest.body;
      mockRequest.get = jest.fn(() => {
        throw new Error('header failure');
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ requestSize: 0 })
      );
    });

    it('should calculate response size for buffer payloads without headers', () => {
      delete mockResponse.headers['content-length'];
      mockResponse.get = jest.fn(() => undefined);

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      const buffer = Buffer.from('buffer-response-data');
      mockResponse.end(buffer);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ responseSize: buffer.length })
      );
    });

    it('should fallback to default response size when JSON serialization fails', () => {
      delete mockResponse.headers['content-length'];
      mockResponse.get = jest.fn(() => undefined);

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      const circularResponse = {};
      circularResponse.self = circularResponse;
      mockResponse.end(circularResponse);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ responseSize: 1000 })
      );
    });

    it('should return zero response size when header lookup throws', () => {
      delete mockResponse.headers['content-length'];
      mockResponse.get = jest.fn(() => {
        throw new Error('header failure');
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ responseSize: 0 })
      );
    });

    it('should classify unspecified client errors as generic client_error', () => {
      mockResponse.statusCode = 418;

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('error response');

      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'client_error',
          severity: 'low',
        })
      );
    });

    it('should classify unspecified server errors as server_error', () => {
      mockResponse.statusCode = 510;

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('error response');

      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'server_error',
          severity: 'high',
        })
      );
    });

    it('should throw when LLM metrics middleware is called without options', () => {
      expect(() => createLlmMetricsMiddleware()).toThrow(
        'metricsService is required for LLM metrics middleware'
      );
    });

    it('should default to console logger for LLM middleware when not provided', () => {
      const debugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
      });

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.json({ usage: {} });

      expect(debugSpy).toHaveBeenCalledWith(
        'LLM request metrics recorded',
        expect.objectContaining({
          status: 'success',
          tokens: { input: 0, output: 0 },
          correlationId: mockRequest.correlationId,
        })
      );

      debugSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should default token counts when usage fields are missing', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.json({ usage: {} });

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: { input: 0, output: 0 } })
      );
    });

    it('should default token counts for token_usage structures when values are missing', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.json({ token_usage: {} });

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: { input: 0, output: 0 } })
      );
    });

    it('should default nested usage token counts when values are missing', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.json({ data: { usage: {} } });

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: { input: 0, output: 0 } })
      );
    });

    it('should throw when cache metrics recorder is called without options', () => {
      expect(() => createCacheMetricsRecorder()).toThrow(
        'metricsService is required for cache metrics recorder'
      );
    });
  });
});
