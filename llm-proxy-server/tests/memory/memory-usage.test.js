/**
 * @file memory-usage.test.js
 * @description Memory usage and leak detection tests for the LLM proxy server
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';
import { HTTP_AGENT_TIMEOUT } from '../../src/config/constants.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockFileSystemReader = () => ({
  readFile: jest.fn(),
});

const createMockAppConfigService = () => ({
  isCacheEnabled: jest.fn(() => true),
  getCacheConfig: jest.fn(() => ({
    enabled: true,
    defaultTtl: 300000,
    maxSize: 1000,
    apiKeyCacheTtl: 300000,
  })),
  getSalvageConfig: jest.fn(() => ({
    defaultTtl: 120000,
    maxEntries: 1000,
  })),
  getApiKeyCacheTtl: jest.fn(() => 300000),
  isHttpAgentEnabled: jest.fn(() => true),
  getHttpAgentConfig: jest.fn(() => ({
    enabled: true,
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: HTTP_AGENT_TIMEOUT,
    freeSocketTimeout: 30000,
    maxTotalSockets: 500,
  })),
  getProxyProjectRootPathForApiKeyFiles: jest.fn(() => '/test/path'),
});

// Mock fetch globally for HTTP requests
global.fetch = jest.fn();

// Helper to force garbage collection if available
const forceGC = () => {
  if (global.gc) {
    global.gc();
  }
};

// Helper to get memory usage in MB
const getMemoryUsageMB = () => {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss / 1024 / 1024,
    heapUsed: usage.heapUsed / 1024 / 1024,
    heapTotal: usage.heapTotal / 1024 / 1024,
    external: usage.external / 1024 / 1024,
  };
};

describe('Memory Usage Tests', () => {
  let logger;
  let fileSystemReader;
  let appConfigService;
  let cacheService;
  let httpAgentService;
  let apiKeyService;
  let llmRequestService;
  let llmConfigService;
  let controller;

  beforeEach(() => {
    logger = createMockLogger();
    fileSystemReader = createMockFileSystemReader();
    appConfigService = createMockAppConfigService();

    // Initialize services
    cacheService = new CacheService(logger, {
      maxSize: 1000,
      defaultTtl: 300000,
    });

    httpAgentService = new HttpAgentService(logger, {
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: HTTP_AGENT_TIMEOUT,
      freeSocketTimeout: 30000,
    });

    apiKeyService = new ApiKeyService(
      logger,
      fileSystemReader,
      appConfigService,
      cacheService
    );

    llmRequestService = new LlmRequestService(
      logger,
      httpAgentService,
      appConfigService,
      RetryManager
    );

    llmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(),
    };

    controller = new LlmRequestController(
      logger,
      llmConfigService,
      apiKeyService,
      llmRequestService
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all services to prevent open handles
    if (cacheService && cacheService.cleanup) {
      cacheService.cleanup();
    }
    if (httpAgentService && httpAgentService.cleanup) {
      httpAgentService.cleanup();
    }
    jest.restoreAllMocks();
  });

  describe('Service Memory Usage', () => {
    test('should not leak memory during normal cache operations', async () => {
      const llmConfig = {
        displayName: 'Memory Test LLM',
        apiKeyFileName: 'memory_test_key.txt',
      };

      fileSystemReader.readFile.mockResolvedValue('sk-memory-test-key');

      // Baseline memory measurement
      forceGC();
      const baseline = getMemoryUsageMB();

      // Perform many cache operations
      for (let i = 0; i < 1000; i++) {
        await apiKeyService.getApiKey(llmConfig, `memory-test-${i % 100}`);

        // Occasionally force garbage collection
        if (i % 200 === 0) {
          forceGC();
        }
      }

      // Final memory measurement
      forceGC();
      const final = getMemoryUsageMB();

      const heapGrowth = final.heapUsed - baseline.heapUsed;
      const rssGrowth = final.rss - baseline.rss;

      // Memory growth should be reasonable (under 5MB for 1000 operations)
      expect(heapGrowth).toBeLessThan(5);
      expect(rssGrowth).toBeLessThan(10);

      logger.info('Cache Memory Usage Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        rssGrowth: `${rssGrowth.toFixed(2)}MB`,
        operations: 1000,
      });
    });

    test('should handle HTTP agent memory efficiently', async () => {
      // Mock fetch for HTTP requests
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest
          .fn()
          .mockResolvedValue({ choices: [{ message: { content: 'Test' } }] }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const llmConfig = {
        displayName: 'HTTP Agent Test LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      // Baseline memory measurement
      forceGC();
      const baseline = getMemoryUsageMB();

      // Perform many HTTP requests to different hosts
      const hosts = [
        'https://api1.test.com/v1/chat',
        'https://api2.test.com/v1/chat',
        'https://api3.test.com/v1/chat',
        'https://api4.test.com/v1/chat',
        'https://api5.test.com/v1/chat',
      ];

      for (let i = 0; i < 500; i++) {
        const hostIndex = i % hosts.length;
        const testConfig = { ...llmConfig, endpointUrl: hosts[hostIndex] };

        try {
          await llmRequestService.forwardRequest(
            `test-llm-${hostIndex}`,
            testConfig,
            { model: 'test', messages: [{ role: 'user', content: 'test' }] },
            {},
            'test-api-key'
          );
        } catch (_error) {
          // Expected to fail, we're just testing memory usage
        }

        if (i % 100 === 0) {
          forceGC();
        }
      }

      // Final memory measurement
      forceGC();
      const final = getMemoryUsageMB();

      const heapGrowth = final.heapUsed - baseline.heapUsed;
      const httpStats = httpAgentService.getStats();

      // Memory growth should be bounded even with many HTTP agents
      expect(heapGrowth).toBeLessThan(10);
      expect(httpStats.agentsCreated).toBe(5); // One per host

      logger.info('HTTP Agent Memory Usage Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        httpRequests: 500,
        agentsCreated: httpStats.agentsCreated,
      });
    });

    test('should handle controller memory usage under load', async () => {
      const llmConfig = {
        displayName: 'Controller Memory Test',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'controller_test_key.txt',
      };

      llmConfigService.getLlmById.mockReturnValue(llmConfig);
      fileSystemReader.readFile.mockResolvedValue('sk-controller-test-key');
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      // Baseline memory measurement
      forceGC();
      const baseline = getMemoryUsageMB();

      // Simulate many controller requests
      for (let i = 0; i < 200; i++) {
        const req = {
          body: {
            llmId: 'controller-memory-test',
            targetPayload: {
              model: 'test-model',
              messages: [{ role: 'user', content: `Test message ${i}` }],
            },
          },
          ip: '127.0.0.1',
        };

        const res = {
          status: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          json: jest.fn(),
          headersSent: false,
        };

        await controller.handleLlmRequest(req, res);

        if (i % 50 === 0) {
          forceGC();
        }
      }

      // Final memory measurement
      forceGC();
      const final = getMemoryUsageMB();

      const heapGrowth = final.heapUsed - baseline.heapUsed;

      // Controller should not accumulate significant memory
      expect(heapGrowth).toBeLessThan(15);

      logger.info('Controller Memory Usage Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        controllerRequests: 200,
      });
    });
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory with cache invalidation cycles', async () => {
      const llmConfigs = Array.from({ length: 50 }, (_, i) => ({
        displayName: `Leak Test LLM ${i}`,
        apiKeyFileName: `leak_test_${i}.txt`,
      }));

      fileSystemReader.readFile.mockImplementation((path) =>
        Promise.resolve(`sk-key-for-${path.split('/').pop()}`)
      );

      // Baseline memory
      forceGC();
      const baseline = getMemoryUsageMB();

      // Perform multiple cache fill/invalidation cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Fill cache
        for (let i = 0; i < 50; i++) {
          await apiKeyService.getApiKey(llmConfigs[i], `leak-test-${i}`);
        }

        // Invalidate cache
        apiKeyService.invalidateAllCache();

        // Force garbage collection
        forceGC();
      }

      // Final memory measurement
      forceGC();
      const final = getMemoryUsageMB();

      const heapGrowth = final.heapUsed - baseline.heapUsed;

      // Memory should not grow significantly over cycles
      expect(heapGrowth).toBeLessThan(3);

      logger.info('Cache Invalidation Leak Test Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        cycles: 10,
        operationsPerCycle: 50,
      });
    });

    test('should handle HTTP agent cleanup without memory leaks', async () => {
      // Create multiple HTTP agent services and clean them up
      const services = [];

      forceGC();
      const baseline = getMemoryUsageMB();

      for (let i = 0; i < 20; i++) {
        const service = new HttpAgentService(logger, {
          keepAlive: true,
          maxSockets: 10,
          maxFreeSockets: 5,
          timeout: 30000,
          freeSocketTimeout: 15000,
        });

        services.push(service);

        // Simulate some usage
        try {
          global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({}),
          });

          // Force creation of agents for different hosts
          for (let j = 0; j < 5; j++) {
            service.getAgent(`https://api${j}.test.com`);
          }
        } catch (_error) {
          // Expected to fail in test environment
        }

        // Clean up every few services
        if (i % 5 === 4) {
          services.forEach((s) => s.cleanup && s.cleanup());
          services.length = 0;
          forceGC();
        }
      }

      // Clean up remaining services
      services.forEach((s) => s.cleanup && s.cleanup());
      forceGC();

      const final = getMemoryUsageMB();
      const heapGrowth = final.heapUsed - baseline.heapUsed;

      // Should not leak memory with proper cleanup
      expect(heapGrowth).toBeLessThan(5);

      logger.info('HTTP Agent Cleanup Test Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        servicesCreated: 20,
      });
    });

    test('should detect memory leaks in long-running scenarios', async () => {
      const llmConfig = {
        displayName: 'Long Running Test',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'long_running_test.txt',
      };

      llmConfigService.getLlmById.mockReturnValue(llmConfig);
      fileSystemReader.readFile.mockResolvedValue('sk-long-running-key');

      // Create reusable mock response to reduce object creation
      const mockJsonFn = jest.fn();
      mockJsonFn.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: mockJsonFn,
        headers: new Map([['content-type', 'application/json']]),
      });

      // Create reusable mock functions outside the loop
      const statusMock = jest.fn();
      const setMock = jest.fn();
      const jsonMock = jest.fn();

      // Configure mock functions to return correct values
      statusMock.mockReturnThis();
      setMock.mockReturnThis();

      // Take memory snapshots over time
      const memorySnapshots = [];

      // Force initial garbage collection and take baseline
      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow time for GC

      for (let iteration = 0; iteration < 20; iteration++) {
        // Perform batch of operations
        for (let i = 0; i < 50; i++) {
          // Reuse mock functions but clear their state
          statusMock.mockClear();
          setMock.mockClear();
          jsonMock.mockClear();

          const req = {
            body: {
              llmId: 'long-running-test',
              targetPayload: {
                model: 'test-model',
                messages: [
                  {
                    role: 'user',
                    content: `Iteration ${iteration}, Request ${i}`,
                  },
                ],
              },
            },
            ip: '127.0.0.1',
          };

          const res = {
            status: statusMock,
            set: setMock,
            json: jsonMock,
            headersSent: false,
          };

          await controller.handleLlmRequest(req, res);
        }

        // More aggressive garbage collection
        forceGC();
        await new Promise((resolve) => setTimeout(resolve, 50)); // Allow time for GC
        forceGC();

        const snapshot = getMemoryUsageMB();
        memorySnapshots.push({
          iteration,
          heapUsed: snapshot.heapUsed,
          rss: snapshot.rss,
        });
      }

      // Analyze memory trend
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const totalGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;

      // Calculate linear regression to detect consistent growth
      let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumXX = 0;
      const n = memorySnapshots.length;

      memorySnapshots.forEach((snapshot, index) => {
        sumX += index;
        sumY += snapshot.heapUsed;
        sumXY += index * snapshot.heapUsed;
        sumXX += index * index;
      });

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const projectedGrowthPer1000Ops = (slope * 1000) / 50; // 50 ops per iteration

      // Memory growth should be bounded and not show severe leaks
      // Note: In test environments with mocks, some memory growth is expected
      expect(totalGrowth).toBeLessThan(50); // Total growth under 50MB for 1000 operations
      expect(projectedGrowthPer1000Ops).toBeLessThan(15); // Less than 15MB per 1000 operations in test environment

      logger.info('Long Running Memory Analysis:', {
        totalOperations: 20 * 50,
        firstHeapUsed: `${firstSnapshot.heapUsed.toFixed(2)}MB`,
        lastHeapUsed: `${lastSnapshot.heapUsed.toFixed(2)}MB`,
        totalGrowth: `${totalGrowth.toFixed(2)}MB`,
        projectedGrowthPer1000Ops: `${projectedGrowthPer1000Ops.toFixed(2)}MB`,
        memoryTrendSlope: slope.toFixed(6),
      });
    });
  });

  describe('Resource Cleanup', () => {
    test('should properly clean up all resources on shutdown', async () => {
      // Create services with resources that need cleanup
      const httpService = new HttpAgentService(logger, {
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 30000,
      });

      const cacheServiceToCleanup = new CacheService(logger, {
        maxSize: 100,
        defaultTtl: 300000,
      });

      // Populate resources
      for (let i = 0; i < 5; i++) {
        httpService.getAgent(`https://api${i}.test.com`);
      }

      cacheServiceToCleanup.set('test-key-1', 'value1');
      cacheServiceToCleanup.set('test-key-2', 'value2');

      // Baseline memory
      forceGC();
      const baseline = getMemoryUsageMB();

      // Cleanup resources
      if (httpService.cleanup) {
        httpService.cleanup();
      }

      // Use cleanup instead of clear to stop the interval timer
      if (cacheServiceToCleanup.cleanup) {
        cacheServiceToCleanup.cleanup();
      }

      forceGC();
      const afterCleanup = getMemoryUsageMB();

      const memoryFreed = baseline.heapUsed - afterCleanup.heapUsed;

      // Should free some memory (or at least not grow)
      expect(memoryFreed).toBeGreaterThanOrEqual(-1); // Allow for small variance

      logger.info('Resource Cleanup Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        afterCleanup: `${afterCleanup.heapUsed.toFixed(2)}MB`,
        memoryFreed: `${memoryFreed.toFixed(2)}MB`,
      });
    });

    test('should handle graceful degradation under memory pressure', async () => {
      // Create cache with limited size to test eviction behavior
      const smallCache = new CacheService(logger, {
        maxSize: 10,
        defaultTtl: 300000,
      });

      const pressureApiKeyService = new ApiKeyService(
        logger,
        fileSystemReader,
        appConfigService,
        smallCache
      );

      fileSystemReader.readFile.mockImplementation((path) =>
        Promise.resolve(`sk-key-for-${path.split('/').pop()}`)
      );

      forceGC();
      const baseline = getMemoryUsageMB();

      // Generate memory pressure by adding many cache entries
      for (let i = 0; i < 100; i++) {
        const llmConfig = {
          displayName: `Pressure Test LLM ${i}`,
          apiKeyFileName: `pressure_test_${i}.txt`,
        };

        await pressureApiKeyService.getApiKey(llmConfig, `pressure-test-${i}`);
      }

      forceGC();
      const final = getMemoryUsageMB();

      const heapGrowth = final.heapUsed - baseline.heapUsed;
      const cacheStats = pressureApiKeyService.getCacheStats();

      // Cache should limit size and not grow memory excessively
      expect(cacheStats.size).toBeLessThanOrEqual(10);
      expect(heapGrowth).toBeLessThan(5);

      logger.info('Memory Pressure Test Results:', {
        baseline: `${baseline.heapUsed.toFixed(2)}MB`,
        final: `${final.heapUsed.toFixed(2)}MB`,
        heapGrowth: `${heapGrowth.toFixed(2)}MB`,
        cacheSize: cacheStats.size,
        requestsProcessed: 100,
      });

      // Clean up the smallCache instance to prevent open handles
      if (smallCache && smallCache.cleanup) {
        smallCache.cleanup();
      }
    });
  });
});
