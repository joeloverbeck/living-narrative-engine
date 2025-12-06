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
import v8 from 'v8';

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

    it('should default version information when package version is unavailable', () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      const livenessCheck = createLivenessCheck({ logger: mockLogger });

      livenessCheck(mockRequest, mockResponse);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.0.0',
        })
      );

      if (originalVersion !== undefined) {
        process.env.npm_package_version = originalVersion;
      }
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
        invalidate: jest.fn(),
        getSize: jest.fn(),
        getMemoryInfo: jest.fn().mockReturnValue({
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

    it('should provide default initialization error details when unavailable', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue(
        undefined
      );

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      const payload = mockJson.mock.calls.at(-1)[0];
      const configDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'llmConfigService'
      );

      expect(configDependency).toEqual(
        expect.objectContaining({
          status: 'DOWN',
          details: expect.objectContaining({
            operational: false,
            error: 'Service not operational',
            stage: 'unknown',
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

    it('should downgrade status when cache service round-trip fails', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      mockCacheService.set.mockImplementation(() => {});
      mockCacheService.get.mockReturnValue(null);
      mockCacheService.invalidate.mockImplementation(() => {});
      mockCacheService.getSize.mockReturnValue(3);

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        cacheService: mockCacheService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      const payload = mockJson.mock.calls.at(-1)[0];
      const cacheDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'cacheService'
      );
      expect(payload.status).toBe('OUT_OF_SERVICE');
      expect(cacheDependency.status).toBe('DOWN');
      expect(cacheDependency.details.working).toBeFalsy();
    });

    it('should handle process memory pressure correctly', async () => {
      // Mock high memory usage (95%)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      const previousCriticalHeapPercent =
        process.env.READINESS_CRITICAL_HEAP_PERCENT;
      const previousCriticalHeapTotal =
        process.env.READINESS_CRITICAL_HEAP_TOTAL_MB;
      const previousCriticalHeapUsed =
        process.env.READINESS_CRITICAL_HEAP_USED_MB;
      try {
        // Lower thresholds so the simulated memory usage trips the breaker
        process.env.READINESS_CRITICAL_HEAP_PERCENT = '80';
        process.env.READINESS_CRITICAL_HEAP_TOTAL_MB = '64';
        process.env.READINESS_CRITICAL_HEAP_USED_MB = '64';

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
      } finally {
        if (previousCriticalHeapPercent === undefined) {
          delete process.env.READINESS_CRITICAL_HEAP_PERCENT;
        } else {
          process.env.READINESS_CRITICAL_HEAP_PERCENT =
            previousCriticalHeapPercent;
        }
        if (previousCriticalHeapTotal === undefined) {
          delete process.env.READINESS_CRITICAL_HEAP_TOTAL_MB;
        } else {
          process.env.READINESS_CRITICAL_HEAP_TOTAL_MB =
            previousCriticalHeapTotal;
        }
        if (previousCriticalHeapUsed === undefined) {
          delete process.env.READINESS_CRITICAL_HEAP_USED_MB;
        } else {
          process.env.READINESS_CRITICAL_HEAP_USED_MB =
            previousCriticalHeapUsed;
        }
      }
    });

    it('should include V8 heap limit statistics when available', async () => {
      process.memoryUsage.mockReturnValue({
        heapUsed: 60 * 1024 * 1024,
        heapTotal: 120 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 140 * 1024 * 1024,
      });
      jest
        .spyOn(v8, 'getHeapStatistics')
        .mockReturnValue({ heap_size_limit: 160 * 1024 * 1024 });

      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: { 'test-llm': {} },
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      const payload = mockJson.mock.calls.at(-1)[0];
      const processDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'nodeProcess'
      );

      expect(payload.status).toBe('UP');
      expect(processDependency).toEqual(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            memoryUsage: expect.objectContaining({
              limits: {
                heapSizeLimitMB: 160,
                usagePercentOfLimit: 38,
              },
            }),
          }),
        })
      );
    });

    it('should handle missing V8 heap statistics gracefully', async () => {
      process.memoryUsage.mockReturnValue({
        heapUsed: 45 * 1024 * 1024,
        heapTotal: 120 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 140 * 1024 * 1024,
      });
      jest.spyOn(v8, 'getHeapStatistics').mockReturnValue(null);

      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: { 'test-llm': {} },
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      const payload = mockJson.mock.calls.at(-1)[0];
      const processDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'nodeProcess'
      );

      expect(processDependency).toEqual(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            memoryUsage: expect.objectContaining({
              limits: null,
            }),
          }),
        })
      );
    });

    it('should continue when V8 getHeapStatistics is not a function', async () => {
      const originalGetHeapStatistics = v8.getHeapStatistics;
      process.memoryUsage.mockReturnValue({
        heapUsed: 40 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
      });

      try {
        // Simulate environments where getHeapStatistics is unavailable
        // eslint-disable-next-line no-global-assign
        v8.getHeapStatistics = undefined;

        mockLlmConfigService.isOperational.mockReturnValue(true);
        mockLlmConfigService.getLlmConfigs.mockReturnValue({
          llms: { 'test-llm': {} },
        });

        const readinessCheck = createReadinessCheck({
          logger: mockLogger,
          llmConfigService: mockLlmConfigService,
        });

        await readinessCheck(mockRequest, mockResponse);

        const payload = mockJson.mock.calls.at(-1)[0];
        const processDependency = payload.details.dependencies.find(
          (dep) => dep.name === 'nodeProcess'
        );

        expect(processDependency).toEqual(
          expect.objectContaining({
            status: 'UP',
            details: expect.objectContaining({
              memoryUsage: expect.objectContaining({
                limits: null,
              }),
            }),
          })
        );
      } finally {
        v8.getHeapStatistics = originalGetHeapStatistics;
      }
    });

    it('should mark HTTP agent service as degraded when missing methods', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      const incompleteAgentService = {
        getAgent: jest.fn(),
      };

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        httpAgentService: incompleteAgentService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      const payload = mockJson.mock.calls.at(-1)[0];
      const agentDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );
      expect(payload.status).toBe('OUT_OF_SERVICE');
      expect(agentDependency.status).toBe('DOWN');
      expect(agentDependency.details.error).toBe('Missing required methods');
    });

    it('should report HTTP agent service statistics when available', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        configs: { 'test-llm': {} },
        defaultConfigId: 'test-llm',
      });

      const stats = {
        activeAgents: 4,
        totalRequests: 128,
        memoryUsage: { rss: 42 },
      };

      mockHttpAgentService.getAgent.mockReturnValue({});
      mockHttpAgentService.cleanup.mockReturnValue(undefined);
      mockHttpAgentService.getStats.mockReturnValue(stats);

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        httpAgentService: mockHttpAgentService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(200);
      const payload = mockJson.mock.calls.at(-1)[0];
      const agentDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );

      expect(agentDependency).toEqual(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            working: true,
            agentCount: stats.activeAgents,
            totalRequests: stats.totalRequests,
            memoryUsage: stats.memoryUsage,
          }),
        })
      );
    });

    it('should treat HTTP agent service as healthy when stats are unavailable', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ configs: {} });

      mockHttpAgentService.getAgent.mockReturnValue({});
      mockHttpAgentService.cleanup.mockReturnValue(undefined);
      delete mockHttpAgentService.getStats;

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        httpAgentService: mockHttpAgentService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(200);
      const payload = mockJson.mock.calls.at(-1)[0];
      const agentDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );

      expect(agentDependency).toEqual(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            working: true,
            agentCount: null,
            totalRequests: null,
            memoryUsage: null,
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

    it('should downgrade when HTTP agent stats retrieval throws an error', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ configs: {} });

      mockHttpAgentService.getAgent.mockReturnValue({});
      mockHttpAgentService.cleanup.mockReturnValue(undefined);
      mockHttpAgentService.getStats.mockImplementation(() => {
        throw new Error('Stats unavailable');
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        httpAgentService: mockHttpAgentService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      const payload = mockJson.mock.calls.at(-1)[0];
      const agentDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'httpAgentService'
      );

      expect(payload.status).toBe('OUT_OF_SERVICE');
      expect(agentDependency).toEqual(
        expect.objectContaining({
          status: 'DOWN',
          details: expect.objectContaining({
            error: 'Stats unavailable',
            working: false,
          }),
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
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      // Mock cache to properly simulate round-trip behavior
      let cacheStorage = new Map();
      mockCacheService.set.mockImplementation((key, value, _ttl) => {
        cacheStorage.set(key, value);
      });
      mockCacheService.get.mockImplementation((key) => {
        return cacheStorage.get(key) || null;
      });
      mockCacheService.invalidate.mockImplementation((key) => {
        return cacheStorage.delete(key);
      });
      mockCacheService.getSize.mockReturnValue(10);

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
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
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

    it('should report cache memory usage as null when unavailable', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      mockCacheService.set.mockImplementation(() => {});
      mockCacheService.get.mockReturnValue({ timestamp: Date.now() });
      mockCacheService.invalidate.mockImplementation(() => {});
      mockCacheService.getSize.mockReturnValue(5);
      delete mockCacheService.getMemoryInfo;

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        cacheService: mockCacheService,
      });

      await readinessCheck(mockRequest, mockResponse);

      const payload = mockJson.mock.calls.at(-1)[0];
      const cacheDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'cacheService'
      );

      expect(cacheDependency).toEqual(
        expect.objectContaining({
          status: 'UP',
          details: expect.objectContaining({
            working: true,
            memoryUsage: null,
          }),
        })
      );
    });

    it('should handle process inspection failures gracefully', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ configs: {} });

      process.memoryUsage.mockImplementation(() => {
        throw new Error('Memory metrics unavailable');
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockStatus).toHaveBeenCalledWith(503);
      const payload = mockJson.mock.calls.at(-1)[0];
      const processDependency = payload.details.dependencies.find(
        (dep) => dep.name === 'nodeProcess'
      );

      expect(payload.status).toBe('DOWN');
      expect(processDependency).toEqual(
        expect.objectContaining({
          status: 'DOWN',
          details: expect.objectContaining({
            error: 'Memory metrics unavailable',
          }),
        })
      );
    });

    it('should use default version when package version is missing in readiness response', async () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ configs: {} });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      const payload = mockJson.mock.calls.at(-1)[0];
      expect(payload.version).toBe('1.0.0');

      if (originalVersion !== undefined) {
        process.env.npm_package_version = originalVersion;
      }
    });

    it('should fall back to failure response when readiness logging throws', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ configs: {} });

      mockLogger.info.mockImplementation(() => {
        throw new Error('Logging failure');
      });

      const readinessCheck = createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
      });

      await readinessCheck(mockRequest, mockResponse);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Health check (readiness) failed with exception',
        expect.any(Error)
      );
      expect(mockStatus).toHaveBeenLastCalledWith(503);
      expect(mockJson).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          error: expect.objectContaining({
            message: 'Readiness check failed',
            details: 'Logging failure',
          }),
          details: expect.objectContaining({
            responseTime: expect.any(Number),
          }),
        })
      );
    });
  });
});
