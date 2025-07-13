/**
 * @file Integration tests for health check endpoints
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import {
  createLivenessCheck,
  createReadinessCheck,
} from '../../src/middleware/healthCheck.js';

describe('Health Check Endpoints Integration', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockCacheService;
  let mockHttpAgentService;

  beforeEach(() => {
    app = express();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockLlmConfigService = {
      isOperational: jest.fn(),
      getLlmConfigs: jest.fn(),
      getInitializationErrorDetails: jest.fn(),
      getResolvedConfigPath: jest.fn(),
    };

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      size: jest.fn(),
      getMemoryUsage: jest.fn(),
    };

    mockHttpAgentService = {
      getAgent: jest.fn(),
      cleanup: jest.fn(),
      getStats: jest.fn(),
    };

    // Mock process methods with realistic values
    jest.spyOn(process, 'uptime').mockReturnValue(7200); // 2 hours
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 75 * 1024 * 1024, // 75MB
      heapTotal: 150 * 1024 * 1024, // 150MB
      external: 15 * 1024 * 1024, // 15MB
      rss: 180 * 1024 * 1024, // 180MB
    });
    jest.spyOn(process, 'cpuUsage').mockReturnValue({
      user: 1000000, // 1 second
      system: 500000, // 0.5 seconds
    });

    // Set up routes
    app.get('/health', createLivenessCheck({ logger: mockLogger }));
    app.get(
      '/health/ready',
      createReadinessCheck({
        logger: mockLogger,
        llmConfigService: mockLlmConfigService,
        cacheService: mockCacheService,
        httpAgentService: mockHttpAgentService,
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /health (Liveness Check)', () => {
    it('should return 200 with healthy status and system metrics', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'UP',
        timestamp: expect.any(String),
        version: expect.any(String),
        details: {
          uptime: 7200,
          memory: {
            used: 75,
            total: 150,
            external: 15,
          },
          responseTime: expect.any(Number),
        },
      });

      // Validate timestamp is recent (within last 5 seconds)
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const timeDifference = Math.abs(now - timestamp);
      expect(timeDifference).toBeLessThan(5000);

      // Validate response time is reasonable
      expect(response.body.details.responseTime).toBeGreaterThan(0);
      expect(response.body.details.responseTime).toBeLessThan(1000); // Less than 1 second

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Health check (liveness) completed',
        expect.objectContaining({
          status: 'UP',
          responseTime: expect.any(Number),
          memoryUsed: 75,
        })
      );
    });

    it('should handle system errors gracefully', async () => {
      // Mock process.uptime to throw an error
      jest.spyOn(process, 'uptime').mockImplementation(() => {
        throw new Error('System unavailable');
      });

      const response = await request(app)
        .get('/health')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'DOWN',
        timestamp: expect.any(String),
        error: {
          message: 'Health check failed',
          details: 'System unavailable',
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Health check (liveness) failed',
        expect.any(Error)
      );
    });

    it('should include version from package.json when available', async () => {
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '1.2.3';

      const response = await request(app).get('/health').expect(200);

      expect(response.body.version).toBe('1.2.3');

      process.env.npm_package_version = originalVersion;
    });

    it('should use default version when package version unavailable', async () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      const response = await request(app).get('/health').expect(200);

      expect(response.body.version).toBe('1.0.0');

      process.env.npm_package_version = originalVersion;
    });
  });

  describe('GET /health/ready (Readiness Check)', () => {
    beforeEach(() => {
      // Set up default healthy state
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({
        llms: {
          'openai-gpt4': { apiType: 'openai' },
          'anthropic-claude': { apiType: 'anthropic' },
        },
        defaultLlmId: 'openai-gpt4',
      });
      mockLlmConfigService.getResolvedConfigPath.mockReturnValue(
        '/config/llm-configs.json'
      );

      // Mock cache to work properly by storing and retrieving values
      const cacheStore = new Map();
      mockCacheService.set.mockImplementation((key, value) => {
        cacheStore.set(key, value);
      });
      mockCacheService.get.mockImplementation((key) => {
        return cacheStore.get(key);
      });
      mockCacheService.delete.mockImplementation((key) => {
        return cacheStore.delete(key);
      });
      mockCacheService.size.mockReturnValue(25);
      mockCacheService.getMemoryUsage.mockReturnValue({
        used: 2048,
        total: 4096,
      });

      mockHttpAgentService.getStats.mockReturnValue({
        activeAgents: 3,
        totalRequests: 567,
        memoryUsage: 1024,
      });
    });

    it('should return 200 when all dependencies are healthy', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'UP',
        timestamp: expect.any(String),
        version: expect.any(String),
        details: {
          responseTime: expect.any(Number),
          dependencies: expect.arrayContaining([
            {
              name: 'llmConfigService',
              status: 'UP',
              details: {
                operational: true,
                configuredLlms: 2,
                defaultLlm: 'openai-gpt4',
                configPath: '/config/llm-configs.json',
              },
            },
            {
              name: 'cacheService',
              status: 'UP',
              details: {
                working: true,
                size: 25,
                memoryUsage: { used: 2048, total: 4096 },
              },
            },
            {
              name: 'httpAgentService',
              status: 'UP',
              details: {
                working: true,
                agentCount: 3,
                totalRequests: 567,
                memoryUsage: 1024,
              },
            },
            {
              name: 'nodeProcess',
              status: 'UP',
              details: expect.objectContaining({
                uptime: expect.any(Number),
                memoryUsage: expect.objectContaining({
                  used: expect.any(Number),
                  total: expect.any(Number),
                  percentage: expect.any(Number),
                }),
                nodeVersion: expect.any(String),
                platform: expect.any(String),
              }),
            },
          ]),
          summary: {
            total: 4,
            up: 4,
            down: 0,
          },
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Health check (readiness) completed',
        expect.objectContaining({
          status: 'UP',
          statusCode: 200,
          dependenciesChecked: 4,
          upDependencies: 4,
          downDependencies: 0,
        })
      );
    });

    it('should return 503 when LLM config service is not operational', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(false);
      mockLlmConfigService.getInitializationErrorDetails.mockReturnValue({
        message: 'Configuration file not found',
        stage: 'file_loading',
        pathAttempted: '/invalid/path',
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'DOWN',
        timestamp: expect.any(String),
        details: {
          dependencies: expect.arrayContaining([
            {
              name: 'llmConfigService',
              status: 'DOWN',
              details: {
                operational: false,
                error: 'Configuration file not found',
                stage: 'file_loading',
              },
            },
          ]),
          summary: expect.objectContaining({
            down: expect.any(Number),
          }),
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Health check (readiness) completed',
        expect.objectContaining({
          status: 'DOWN',
          statusCode: 503,
        })
      );
    });

    it('should return 503 OUT_OF_SERVICE when cache fails but LLM service is up', async () => {
      mockCacheService.set.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'OUT_OF_SERVICE',
        details: {
          dependencies: expect.arrayContaining([
            expect.objectContaining({
              name: 'llmConfigService',
              status: 'UP',
            }),
            expect.objectContaining({
              name: 'cacheService',
              status: 'DOWN',
              details: expect.objectContaining({
                error: 'Redis connection failed',
                working: false,
              }),
            }),
            expect.objectContaining({
              name: 'httpAgentService',
              status: 'UP',
            }),
            expect.objectContaining({
              name: 'nodeProcess',
              status: 'UP',
            }),
          ]),
        },
      });
    });

    it('should detect high memory usage in node process', async () => {
      // Mock high memory usage scenario
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB (95% usage)
        external: 50 * 1024 * 1024,
        rss: 1100 * 1024 * 1024,
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'DOWN',
        details: {
          dependencies: expect.arrayContaining([
            {
              name: 'nodeProcess',
              status: 'DOWN',
              details: expect.objectContaining({
                memoryUsage: expect.objectContaining({
                  percentage: 95,
                }),
              }),
            },
          ]),
        },
      });
    });

    it('should validate cache functionality with test operations', async () => {
      await request(app).get('/health/ready').expect(200);

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
    });

    it('should work without optional services (cache and HTTP agent)', async () => {
      // Create app without optional services
      const minimalApp = express();
      minimalApp.get(
        '/health/ready',
        createReadinessCheck({
          logger: mockLogger,
          llmConfigService: mockLlmConfigService,
          // No cache or HTTP agent service
        })
      );

      const response = await request(minimalApp)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'UP',
        details: {
          dependencies: [
            expect.objectContaining({ name: 'llmConfigService', status: 'UP' }),
            expect.objectContaining({ name: 'nodeProcess', status: 'UP' }),
          ],
          summary: {
            total: 2,
            up: 2,
            down: 0,
          },
        },
      });
    });

    it('should handle missing HTTP agent methods gracefully', async () => {
      mockHttpAgentService.getAgent = undefined; // Missing method
      mockHttpAgentService.cleanup = jest.fn();

      const response = await request(app).get('/health/ready').expect(503);

      expect(response.body.details.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'httpAgentService',
            status: 'DOWN',
            details: {
              error: 'Missing required methods',
              working: false,
            },
          }),
        ])
      );
    });

    it('should handle unexpected errors during dependency checks', async () => {
      mockLlmConfigService.isOperational.mockImplementation(() => {
        throw new Error('Unexpected service error');
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        status: 'DOWN',
        timestamp: expect.any(String),
        version: expect.any(String),
        details: {
          responseTime: expect.any(Number),
          dependencies: expect.arrayContaining([
            expect.objectContaining({
              name: 'llmConfigService',
              status: 'DOWN',
              details: {
                error: 'Unexpected service error',
                operational: false,
              },
            }),
          ]),
          summary: expect.objectContaining({
            down: expect.any(Number),
          }),
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Health check (readiness) completed',
        expect.objectContaining({
          status: 'DOWN',
          statusCode: 503,
        })
      );
    });

    it('should include CPU usage information in node process check', async () => {
      jest.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 1000000, // 1 second
        system: 500000, // 0.5 seconds
      });

      const response = await request(app).get('/health/ready').expect(200);

      const nodeProcessCheck = response.body.details.dependencies.find(
        (dep) => dep.name === 'nodeProcess'
      );

      expect(nodeProcessCheck.details).toMatchObject({
        cpuUsage: {
          user: 1000000,
          system: 500000,
        },
        nodeVersion: expect.any(String),
        platform: expect.any(String),
      });
    });

    it('should measure and report response time accurately', async () => {
      const startTime = Date.now();

      const response = await request(app).get('/health/ready').expect(200);

      const endTime = Date.now();
      const actualResponseTime = endTime - startTime;

      expect(response.body.details.responseTime).toBeGreaterThan(0);
      expect(response.body.details.responseTime).toBeLessThan(
        actualResponseTime + 50
      ); // Allow 50ms margin
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app).get('/health/invalid').expect(404);

      // Should not cause server errors
      expect(response.status).toBe(404);
    });

    it('should handle concurrent health check requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body.status).toBe('UP');
        expect(response.body.details.responseTime).toBeGreaterThan(0);
      });

      // Should have logged each request
      expect(mockLogger.debug).toHaveBeenCalledTimes(10);
    });

    it('should handle readiness checks under load', async () => {
      mockLlmConfigService.isOperational.mockReturnValue(true);
      mockLlmConfigService.getLlmConfigs.mockReturnValue({ llms: {} });

      // Re-setup cache mock for this test
      const cacheStore = new Map();
      mockCacheService.set.mockImplementation((key, value) => {
        cacheStore.set(key, value);
      });
      mockCacheService.get.mockImplementation((key) => {
        return cacheStore.get(key);
      });
      mockCacheService.delete.mockImplementation((key) => {
        return cacheStore.delete(key);
      });

      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/health/ready').expect(200)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body.status).toBe('UP');
        expect(response.body.details.summary.total).toBeGreaterThan(0);
      });

      expect(mockLogger.info).toHaveBeenCalledTimes(5);
    });
  });
});
