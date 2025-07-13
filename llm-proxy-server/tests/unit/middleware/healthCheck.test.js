/**
 * @file Unit tests for health check middleware
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
  createLivenessCheck,
  createReadinessCheck,
} from '../../../src/middleware/healthCheck.js';

describe('Health Check Middleware', () => {
  let mockLogger;
  let mockRequest;
  let mockResponse;
  let mockJson;
  let mockStatus;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn(() => ({ json: mockJson }));

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    mockRequest = {};

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };

    // Mock process methods
    jest.spyOn(process, 'uptime').mockReturnValue(3600); // 1 hour
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 100 * 1024 * 1024, // 100MB
      external: 10 * 1024 * 1024, // 10MB
      rss: 120 * 1024 * 1024, // 120MB
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createLivenessCheck', () => {
    it('should return healthy status with system information', () => {
      const livenessCheck = createLivenessCheck({ logger: mockLogger });

      livenessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'UP',
          timestamp: expect.any(String),
          version: expect.any(String),
          details: expect.objectContaining({
            uptime: 3600,
            memory: expect.objectContaining({
              used: 50,
              total: 100,
              external: 10,
            }),
            responseTime: expect.any(Number),
          }),
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Health check (liveness) completed',
        expect.objectContaining({
          status: 'UP',
          responseTime: expect.any(Number),
          memoryUsed: 50,
        })
      );
    });

    it('should handle errors gracefully', () => {
      // Mock process.uptime to throw an error
      jest.spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('System error');
      });

      const livenessCheck = createLivenessCheck({ logger: mockLogger });

      livenessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          timestamp: expect.any(String),
          error: expect.objectContaining({
            message: 'Health check failed',
            details: 'System error',
          }),
        })
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Health check (liveness) failed',
        expect.any(Error)
      );
    });

    it('should include version from environment variable', () => {
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '2.1.0';

      const livenessCheck = createLivenessCheck({ logger: mockLogger });

      livenessCheck(mockRequest, mockResponse);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.1.0',
        })
      );

      process.env.npm_package_version = originalVersion;
    });
  });

  describe('createReadinessCheck', () => {
    let mockLlmConfigService;
    let mockCacheService;
    let mockHttpAgentService;

    beforeEach(() => {
      mockLlmConfigService = {
        isOperational: jest.fn(),
        getLlmConfigs: jest.fn(),
        getInitializationErrorDetails: jest.fn(),
        getResolvedConfigPath: jest
          .fn()
          .mockReturnValue('/path/to/config.json'),
      };

      mockCacheService = {
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        size: jest.fn(),
        getMemoryUsage: jest.fn().mockReturnValue({
          used: 1024,
          total: 2048,
        }),
      };

      mockHttpAgentService = {
        getAgent: jest.fn(),
        cleanup: jest.fn(),
        getStats: jest.fn(),
      };
    });

    it('should return DOWN status when LLM config service is not operational', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'Config file not found',
        stage: 'file_loading',
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'llmConfigService',
                status: 'DOWN',
                details: expect.objectContaining({
                  operational: false,
                  error: 'Config file not found',
                  stage: 'file_loading',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should return OUT_OF_SERVICE when cache service fails but LLM service is up', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: { 'test-llm': {} },
        defaultLlmId: 'test-llm',
      });

      mockCacheService.set.mockImplementation(() => {
        throw new Error('Cache write failed');
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        cacheService: mockCacheService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OUT_OF_SERVICE',
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'cacheService',
                status: 'DOWN',
                details: expect.objectContaining({
                  error: 'Cache write failed',
                  working: false,
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should handle process memory pressure correctly', async () => {
      // Mock high memory usage (95%)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: { 'test-llm': {} },
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'nodeProcess',
                status: 'DOWN',
                details: expect.objectContaining({
                  memoryUsage: expect.objectContaining({
                    percentage: 95,
                  }),
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should handle errors during readiness check gracefully', async () => {
      mockLlmConfigService.isOperational.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          timestamp: expect.any(String),
          version: expect.any(String),
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'llmConfigService',
                status: 'DOWN',
                details: expect.objectContaining({
                  error: 'Unexpected error',
                  operational: false,
                }),
              }),
            ]),
            responseTime: expect.any(Number),
            summary: expect.objectContaining({
              total: expect.any(Number),
              up: expect.any(Number),
              down: expect.any(Number),
            }),
          }),
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Health check (readiness) completed',
        expect.objectContaining({
          status: 'DOWN',
          statusCode: 503,
          dependenciesChecked: expect.any(Number),
          upDependencies: expect.any(Number),
          downDependencies: expect.any(Number),
        })
      );
    });

    it('should work with minimal dependencies (LLM service only)', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: { 'test-llm': {} },
        defaultLlmId: 'test-llm',
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        // No cache or HTTP agent service
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'llmConfigService',
                status: 'UP',
              }),
              expect.objectContaining({
                name: 'nodeProcess',
                status: 'UP',
              }),
            ]),
            summary: expect.objectContaining({
              total: 2, // Only LLM service and node process
              up: 2,
              down: 0,
            }),
          }),
        })
      );
    });

    it('should validate cache service functionality with test operations', async () => {
      const testTimestamp = Date.now();
      const testData = { timestamp: testTimestamp };

      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      mockCacheService.set.mockReturnValue(undefined);
      mockCacheService.get.mockImplementation((key) => {
        if (key === '__health_check_test__') {
          return testData;
        }
        return null;
      });
      mockCacheService.delete.mockReturnValue(true);
      mockCacheService.size.mockReturnValue(10);

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        cacheService: mockCacheService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        '__health_check_test__',
        expect.objectContaining({ timestamp: expect.any(Number) }),
        1000
      );
      expect(mockCacheService.get).toHaveBeenCalledWith(
        '__health_check_test__'
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        '__health_check_test__'
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            dependencies: expect.arrayContaining([
              expect.objectContaining({
                name: 'cacheService',
                status: 'UP',
                details: expect.objectContaining({
                  working: true,
                  size: 10,
                }),
              }),
            ]),
          }),
        })
      );
    });
  });
});
