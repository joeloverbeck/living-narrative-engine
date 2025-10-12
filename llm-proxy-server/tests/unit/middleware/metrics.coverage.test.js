/**
 * @file Additional coverage tests for metrics middleware
 * @description Tests for edge cases and uncovered branches in metrics.js
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
} from '../../../src/middleware/metrics.js';

describe('Metrics Middleware - Additional Coverage Tests', () => {
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
      originalUrl: '/api/test',
      url: '/api/test',
      path: '/api/test',
      headers: {},
      body: {},
      get: jest.fn((header) => mockRequest.headers[header.toLowerCase()]),
      correlationId: 'test-correlation-456',
    };

    mockResponse = {
      statusCode: 200,
      end: jest.fn(),
      json: jest.fn(),
      on: jest.fn(),
      get: jest.fn((header) => mockResponse.headers?.[header.toLowerCase()]),
      set: jest.fn(),
      headers: {},
    };

    mockNext = jest.fn();

    // Mock process.hrtime.bigint
    global.process.hrtime = {
      bigint: jest.fn().mockReturnValue(BigInt(1000000000)),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Size Estimation Edge Cases', () => {
    it('should handle string body type', () => {
      mockRequest.body = 'This is a string body';

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
          requestSize: Buffer.byteLength('This is a string body', 'utf8'),
        })
      );
    });

    it('should handle JSON.stringify failure for request body', () => {
      // Create circular reference
      const circularObj = { a: 1 };
      circularObj.self = circularObj;
      mockRequest.body = circularObj;

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
          requestSize: 1000, // Fallback value
        })
      );
    });

    it('should handle general error in getRequestSize', () => {
      // Mock Buffer.byteLength to throw an error
      const originalByteLength = Buffer.byteLength;
      Buffer.byteLength = jest.fn(() => {
        throw new Error('Buffer error');
      });

      mockRequest.body = 'test string';

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
          requestSize: 0, // Error fallback
        })
      );

      // Restore original function
      Buffer.byteLength = originalByteLength;
    });
  });

  describe('Response Size Estimation Edge Cases', () => {
    it('should handle string response data', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      const stringData = 'This is a string response';
      mockResponse.end(stringData);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          responseSize: Buffer.byteLength(stringData, 'utf8'),
        })
      );
    });

    it('should handle Buffer response data', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      const bufferData = Buffer.from('Buffer response data');
      mockResponse.end(bufferData);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          responseSize: bufferData.length,
        })
      );
    });

    it('should handle JSON.stringify failure for response data', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Create circular reference
      const circularResponse = { data: 'test' };
      circularResponse.self = circularResponse;

      mockResponse.end(circularResponse);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          responseSize: 1000, // Fallback value
        })
      );
    });

    it('should handle null/undefined response data', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Test with null data
      mockResponse.end(null);

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          responseSize: 0, // Should return 0 for null data
        })
      );
    });

    it('should handle general error in getResponseSize', () => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Mock Buffer.byteLength to throw an error
      const originalByteLength = Buffer.byteLength;
      Buffer.byteLength = jest.fn(() => {
        throw new Error('Buffer error');
      });

      mockResponse.end('test response');

      expect(mockMetricsService.recordHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          responseSize: 0, // Error fallback
        })
      );

      // Restore original function
      Buffer.byteLength = originalByteLength;
    });
  });

  describe('Error classification coverage', () => {
    /**
     * Helper to execute middleware with a specific status code and capture metrics
     * @param {number} statusCode - HTTP status code to simulate
     */
    const runMiddlewareWithStatus = (statusCode) => {
      const middleware = createMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      mockResponse.statusCode = statusCode;

      middleware(mockRequest, mockResponse, mockNext);
      mockResponse.end('response');
    };

    it('classifies unknown client errors with default mapping', () => {
      runMiddlewareWithStatus(499);

      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'client_error',
          severity: 'low',
        })
      );
    });

    it('classifies unknown server errors with default mapping', () => {
      runMiddlewareWithStatus(599);

      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'server_error',
          severity: 'high',
        })
      );
    });
  });

  describe('Additional HTTP Status Code Coverage', () => {
    const statusCodeTests = [
      {
        statusCode: 405,
        expectedType: 'method_not_allowed',
        expectedSeverity: 'low',
      },
      {
        statusCode: 408,
        expectedType: 'request_timeout',
        expectedSeverity: 'low',
      },
      { statusCode: 409, expectedType: 'conflict', expectedSeverity: 'low' },
      {
        statusCode: 413,
        expectedType: 'payload_too_large',
        expectedSeverity: 'low',
      },
      {
        statusCode: 410,
        expectedType: 'client_error',
        expectedSeverity: 'low',
      }, // Other 4xx
      {
        statusCode: 501,
        expectedType: 'not_implemented',
        expectedSeverity: 'high',
      },
      {
        statusCode: 504,
        expectedType: 'gateway_timeout',
        expectedSeverity: 'high',
      },
      {
        statusCode: 505,
        expectedType: 'server_error',
        expectedSeverity: 'high',
      }, // Other 5xx
      { statusCode: 100, expectedType: null, expectedSeverity: null }, // Non-error code - no error recorded
      { statusCode: 200, expectedType: null, expectedSeverity: null }, // Success - no error
      { statusCode: 301, expectedType: null, expectedSeverity: null }, // Redirect - no error
    ];

    statusCodeTests.forEach(
      ({ statusCode, expectedType, expectedSeverity }) => {
        it(`should handle status code ${statusCode} correctly`, () => {
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
          mockResponse.end('response');

          expect(mockMetricsService.recordHttpRequest).toHaveBeenCalled();

          if (expectedType) {
            expect(mockMetricsService.recordError).toHaveBeenCalledWith({
              errorType: expectedType,
              component: 'http_server',
              severity: expectedSeverity,
            });
          }

          if (!expectedType) {
            // For non-error status codes, recordError should not be called
            expect(mockMetricsService.recordError).not.toHaveBeenCalled();
          }
        });
      }
    );
  });

  describe('LLM ID Parsing Edge Cases', () => {
    const llmIdTests = [
      { llmId: null, expectedProvider: 'unknown', expectedModel: 'unknown' },
      {
        llmId: undefined,
        expectedProvider: 'unknown',
        expectedModel: 'unknown',
      },
      { llmId: '', expectedProvider: 'unknown', expectedModel: 'unknown' },
      { llmId: 123, expectedProvider: 'unknown', expectedModel: 'unknown' }, // Non-string
      { llmId: {}, expectedProvider: 'unknown', expectedModel: 'unknown' }, // Object
      { llmId: [], expectedProvider: 'unknown', expectedModel: 'unknown' }, // Array
      { llmId: true, expectedProvider: 'unknown', expectedModel: 'unknown' }, // Boolean
    ];

    llmIdTests.forEach(({ llmId, expectedProvider, expectedModel }) => {
      it(`should handle llmId: ${llmId}`, () => {
        mockRequest.body = { llmId };

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
      });
    });
  });

  describe('Token Extraction Error Handling', () => {
    it('should handle errors during token extraction gracefully', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Create a response that will cause an error when accessing properties
      const problematicResponse = {};
      Object.defineProperty(problematicResponse, 'usage', {
        get() {
          throw new Error('Property access error');
        },
      });

      mockResponse.json(problematicResponse);

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: null, // Should handle error and return null
        })
      );
    });

    it('should handle circular references in token extraction', () => {
      const middleware = createLlmMetricsMiddleware({
        metricsService: mockMetricsService,
        logger: mockLogger,
      });

      let timeCounter = 0;
      global.process.hrtime.bigint = jest.fn(() =>
        BigInt(timeCounter++ * 1000000000)
      );

      middleware(mockRequest, mockResponse, mockNext);

      // Create a response that will cause token extraction to fail more explicitly
      const problematicResponse = {
        get usage() {
          throw new Error('Token extraction error');
        },
      };

      mockResponse.json(problematicResponse);

      expect(mockMetricsService.recordLlmRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: null, // Should handle error and return null
        })
      );
    });
  });

  describe('Error Functions Direct Testing', () => {
    // Import the module to access internal functions for direct testing
    it('should test getErrorType and getErrorSeverity with non-error codes directly', async () => {
      // Since these functions are only called when statusCode >= 400 in the actual middleware,
      // we need to test them directly by importing the module differently
      await import('../../../src/middleware/metrics.js');

      // We can't directly access internal functions, so we'll test through the middleware
      // by mocking the recordError to check what's passed
      mockResponse.statusCode = 399; // Just below error threshold

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

      // Should not call recordError for non-error status codes
      expect(mockMetricsService.recordError).not.toHaveBeenCalled();
    });
  });

  describe('Route Resolution Edge Cases', () => {
    it('should handle undefined URL gracefully', () => {
      delete mockRequest.originalUrl;
      delete mockRequest.url;

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
          route: '/', // Should default to root
        })
      );
    });

    it('should handle API routes with multiple path segments', () => {
      mockRequest.originalUrl = '/api/v2/users/123/posts';

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
          route: '/api/v*/users/:id/posts', // Should parameterize properly
        })
      );
    });
  });
});
