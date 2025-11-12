/**
 * @file performance-benchmarks.test.js
 * @description Performance benchmarks and baseline measurements for the LLM proxy server
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  afterAll,
  expect,
  jest,
} from '@jest/globals';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import { ApiKeyService } from '../../src/services/apiKeyService.js';
import { LlmRequestService } from '../../src/services/llmRequestService.js';
import CacheService from '../../src/services/cacheService.js';
import HttpAgentService from '../../src/services/httpAgentService.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';
import { HTTP_AGENT_TIMEOUT } from '../../src/config/constants.js';
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import express from 'express';
import request from 'supertest';

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

// Mock fetch globally
global.fetch = jest.fn();

// Performance measurement utilities
const measureTime = async (operation) => {
  const start = process.hrtime.bigint();
  const result = await operation();
  const end = process.hrtime.bigint();
  const timeMs = Number(end - start) / 1000000;
  return { result, timeMs };
};

const measureMemory = () => {
  if (global.gc) global.gc();
  const usage = process.memoryUsage();
  return {
    rss: usage.rss / 1024 / 1024,
    heapUsed: usage.heapUsed / 1024 / 1024,
    heapTotal: usage.heapTotal / 1024 / 1024,
    external: usage.external / 1024 / 1024,
  };
};

describe('Performance Benchmarks', () => {
  let logger;
  let fileSystemReader;
  let appConfigService;
  let cacheService;
  let httpAgentService;
  let apiKeyService;
  let llmRequestService;
  let llmConfigService;
  let controller;
  let app;

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

    // Create Express app for end-to-end testing
    app = express();
    app.use(express.json());

    // Add request tracking middleware (required for response commitment guards)
    app.use(createRequestTrackingMiddleware({ logger }));

    app.post('/api/llm-request', (req, res) => {
      controller.handleLlmRequest(req, res);
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (cacheService && cacheService.cleanup) {
      cacheService.cleanup();
    }
    if (httpAgentService && httpAgentService.cleanup) {
      httpAgentService.cleanup();
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Small delay for system recovery
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    // Final cleanup after all benchmark tests
    jest.restoreAllMocks();

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    // Moderate delay after benchmark tests
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  describe('Individual Component Benchmarks', () => {
    test('should benchmark cache service performance', async () => {
      const benchmarkData = {
        set: [],
        get: [],
        has: [],
        delete: [],
      };

      // Benchmark SET operations
      for (let i = 0; i < 1000; i++) {
        const { timeMs } = await measureTime(async () => {
          cacheService.set(`key-${i}`, `value-${i}`);
        });
        benchmarkData.set.push(timeMs);
      }

      // Benchmark GET operations
      for (let i = 0; i < 1000; i++) {
        const { timeMs } = await measureTime(async () => {
          cacheService.get(`key-${i}`);
        });
        benchmarkData.get.push(timeMs);
      }

      // Benchmark HAS operations
      for (let i = 0; i < 1000; i++) {
        const { timeMs } = await measureTime(async () => {
          cacheService.has(`key-${i}`);
        });
        benchmarkData.has.push(timeMs);
      }

      // Benchmark DELETE operations
      for (let i = 0; i < 1000; i++) {
        const { timeMs } = await measureTime(async () => {
          cacheService.invalidate(`key-${i}`);
        });
        benchmarkData.delete.push(timeMs);
      }

      // Calculate statistics
      const stats = {};
      Object.keys(benchmarkData).forEach((operation) => {
        const times = benchmarkData[operation];
        stats[operation] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
        };
      });

      // Performance expectations
      expect(stats.set.avg).toBeLessThan(0.1); // Under 0.1ms average
      expect(stats.get.avg).toBeLessThan(0.1); // Under 0.1ms average
      expect(stats.has.avg).toBeLessThan(0.1); // Under 0.1ms average
      expect(stats.delete.avg).toBeLessThan(0.1); // Under 0.1ms average

      logger.info('Cache Service Benchmark Results:', stats);
    });

    test('should benchmark API key service performance', async () => {
      const llmConfig = {
        displayName: 'Benchmark LLM',
        apiKeyFileName: 'benchmark_api_key.txt',
      };

      fileSystemReader.readFile.mockResolvedValue('sk-benchmark-key-123');

      const benchmarkData = {
        firstCall: [],
        cachedCalls: [],
        differentKeys: [],
      };

      // Benchmark first call (cache miss)
      for (let i = 0; i < 100; i++) {
        apiKeyService.invalidateAllCache(); // Ensure cache miss
        const { timeMs } = await measureTime(async () => {
          await apiKeyService.getApiKey(llmConfig, `benchmark-${i}`);
        });
        benchmarkData.firstCall.push(timeMs);
      }

      // Prime the cache for cached calls benchmark
      await apiKeyService.getApiKey(llmConfig, 'benchmark-cached');

      // Benchmark cached calls (cache hits)
      for (let i = 0; i < 100; i++) {
        const { timeMs } = await measureTime(async () => {
          await apiKeyService.getApiKey(llmConfig, 'benchmark-cached');
        });
        benchmarkData.cachedCalls.push(timeMs);
      }

      // Benchmark different keys
      for (let i = 0; i < 100; i++) {
        const { timeMs } = await measureTime(async () => {
          await apiKeyService.getApiKey(llmConfig, `benchmark-unique-${i}`);
        });
        benchmarkData.differentKeys.push(timeMs);
      }

      // Calculate statistics
      const stats = {};
      Object.keys(benchmarkData).forEach((scenario) => {
        const times = benchmarkData[scenario];
        stats[scenario] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
        };
      });

      // Performance expectations
      expect(stats.cachedCalls.avg).toBeLessThan(2); // Cached calls should be very fast
      // Note: With mocked instant file reads, relative performance comparison is not meaningful

      logger.info('API Key Service Benchmark Results:', stats);
    });

    test('should benchmark HTTP agent service performance', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ test: 'response' }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const benchmarkData = {
        sameHost: [],
        differentHosts: [],
        agentReuse: [],
      };

      // Benchmark requests to same host (agent reuse)
      for (let i = 0; i < 100; i++) {
        const { timeMs } = await measureTime(async () => {
          httpAgentService.getAgent('https://api.same.com');
        });
        benchmarkData.sameHost.push(timeMs);
      }

      // Benchmark requests to different hosts
      for (let i = 0; i < 100; i++) {
        const { timeMs } = await measureTime(async () => {
          httpAgentService.getAgent(`https://api${i}.different.com`);
        });
        benchmarkData.differentHosts.push(timeMs);
      }

      // Benchmark agent reuse efficiency
      const testHost = 'https://api.reuse.com';
      for (let i = 0; i < 100; i++) {
        const { timeMs } = await measureTime(async () => {
          httpAgentService.getAgent(testHost);
        });
        benchmarkData.agentReuse.push(timeMs);
      }

      // Calculate statistics
      const stats = {};
      Object.keys(benchmarkData).forEach((scenario) => {
        const times = benchmarkData[scenario];
        stats[scenario] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
        };
      });

      // Performance expectations
      expect(stats.agentReuse.avg).toBeLessThan(0.5); // Agent reuse should be very fast
      expect(stats.sameHost.avg).toBeLessThan(1); // Same host should be fast

      const httpStats = httpAgentService.getStats();
      logger.info('HTTP Agent Service Benchmark Results:', {
        performanceStats: stats,
        agentStats: httpStats,
      });
    });
  });

  describe('End-to-End Performance Benchmarks', () => {
    test('should benchmark complete request workflow', async () => {
      const mockLlmConfig = {
        displayName: 'E2E Benchmark LLM',
        endpointUrl: 'https://api.benchmark.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'e2e_benchmark_key.txt',
      };

      llmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      fileSystemReader.readFile.mockResolvedValue('sk-e2e-benchmark-key');
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: 'benchmark-response',
          choices: [{ message: { content: 'Benchmark response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const requestBody = {
        llmId: 'e2e-benchmark-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Benchmark test' }],
        },
      };

      const benchmarkData = {
        coldStart: [],
        warmRequests: [],
        cachedRequests: [],
      };

      // Benchmark cold start (first request)
      for (let i = 0; i < 10; i++) {
        // Clear caches to simulate cold start
        apiKeyService.invalidateAllCache();
        if (httpAgentService.cleanup) {
          httpAgentService.cleanup();
        }

        const { timeMs } = await measureTime(async () => {
          const response = await request(app)
            .post('/api/llm-request')
            .send(requestBody);
          return response;
        });
        benchmarkData.coldStart.push(timeMs);
      }

      // Benchmark warm requests (caches populated)
      for (let i = 0; i < 50; i++) {
        const { timeMs } = await measureTime(async () => {
          const response = await request(app)
            .post('/api/llm-request')
            .send(requestBody);
          return response;
        });
        benchmarkData.warmRequests.push(timeMs);
      }

      // Benchmark fully cached requests
      for (let i = 0; i < 50; i++) {
        const { timeMs } = await measureTime(async () => {
          const response = await request(app)
            .post('/api/llm-request')
            .send(requestBody);
          return response;
        });
        benchmarkData.cachedRequests.push(timeMs);
      }

      // Calculate statistics
      const stats = {};
      Object.keys(benchmarkData).forEach((scenario) => {
        const times = benchmarkData[scenario];
        stats[scenario] = {
          avg: times.reduce((sum, time) => sum + time, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          p50: times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)],
          p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
          p99: times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)],
        };
      });

      // Performance expectations - more realistic for test environment
      // Allow for only 5% improvement due to test environment overhead
      expect(stats.cachedRequests.avg).toBeLessThan(stats.coldStart.avg * 0.95); // 5% improvement
      expect(stats.cachedRequests.p95).toBeLessThan(150); // 95th percentile under 150ms (more forgiving)

      logger.info('E2E Workflow Benchmark Results:', stats);
    });

    test('should benchmark concurrent request performance', async () => {
      const mockLlmConfig = {
        displayName: 'Concurrent Benchmark LLM',
        endpointUrl: 'https://api.concurrent.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'concurrent_benchmark_key.txt',
      };

      llmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      fileSystemReader.readFile.mockResolvedValue(
        'sk-concurrent-benchmark-key'
      );
      global.fetch.mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    status: 200,
                    json: jest.fn().mockResolvedValue({
                      choices: [
                        { message: { content: 'Concurrent response' } },
                      ],
                    }),
                    headers: new Map([['content-type', 'application/json']]),
                  }),
                Math.random() * 50 + 25
              ) // 25-75ms delay
          )
      );

      const requestBody = {
        llmId: 'concurrent-benchmark-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Concurrent test' }],
        },
      };

      const concurrencyLevels = [1, 5, 10, 25, 50, 100];
      const benchmarkResults = [];

      for (const concurrency of concurrencyLevels) {
        const requests = Array.from({ length: concurrency }, (_, i) =>
          request(app)
            .post('/api/llm-request')
            .send({
              ...requestBody,
              targetPayload: {
                ...requestBody.targetPayload,
                messages: [{ role: 'user', content: `Concurrent test ${i}` }],
              },
            })
        );

        const { timeMs, result } = await measureTime(async () => {
          return Promise.all(requests);
        });

        const successfulResponses = result.filter(
          (r) => r.status === 200
        ).length;
        const averageResponseTime = timeMs / concurrency;
        const throughput = (concurrency / timeMs) * 1000; // requests per second

        benchmarkResults.push({
          concurrency,
          totalTime: timeMs,
          averageResponseTime,
          throughput,
          successRate: (successfulResponses / concurrency) * 100,
        });

        // Performance expectations
        expect(successfulResponses).toBe(concurrency); // All should succeed
        expect(throughput).toBeGreaterThan(concurrency / 10); // Reasonable throughput
      }

      logger.info('Concurrent Request Benchmark Results:', benchmarkResults);
    });

    test('should benchmark memory efficiency under load', async () => {
      const mockLlmConfig = {
        displayName: 'Memory Benchmark LLM',
        endpointUrl: 'https://api.memory.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'memory_benchmark_key.txt',
      };

      llmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      fileSystemReader.readFile.mockResolvedValue('sk-memory-benchmark-key');
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Memory test response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const requestBody = {
        llmId: 'memory-benchmark-llm',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Memory test' }],
        },
      };

      // Baseline memory measurement
      const baseline = measureMemory();
      const memorySnapshots = [{ operations: 0, ...baseline }];

      // Perform operations in batches and measure memory
      const batchSize = 50;
      const totalBatches = 10;

      for (let batch = 0; batch < totalBatches; batch++) {
        const requests = Array.from({ length: batchSize }, (_, i) =>
          request(app)
            .post('/api/llm-request')
            .send({
              ...requestBody,
              targetPayload: {
                ...requestBody.targetPayload,
                messages: [
                  { role: 'user', content: `Batch ${batch}, Request ${i}` },
                ],
              },
            })
        );

        await Promise.all(requests);

        // Take memory snapshot
        const snapshot = measureMemory();
        memorySnapshots.push({
          operations: (batch + 1) * batchSize,
          ...snapshot,
        });
      }

      // Analyze memory efficiency
      const finalSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const totalMemoryGrowth = finalSnapshot.heapUsed - baseline.heapUsed;
      const memoryPerOperation = totalMemoryGrowth / (totalBatches * batchSize);

      // Performance expectations - adjusted for test environment
      expect(totalMemoryGrowth).toBeLessThan(60); // Under 60MB total growth (more forgiving)
      expect(memoryPerOperation).toBeLessThan(0.12); // Under 0.12MB per operation (more forgiving)

      logger.info('Memory Efficiency Benchmark Results:', {
        totalOperations: totalBatches * batchSize,
        baselineMemory: `${baseline.heapUsed.toFixed(2)}MB`,
        finalMemory: `${finalSnapshot.heapUsed.toFixed(2)}MB`,
        totalGrowth: `${totalMemoryGrowth.toFixed(2)}MB`,
        memoryPerOperation: `${(memoryPerOperation * 1024).toFixed(2)}KB`,
        memorySnapshots: memorySnapshots.map((s) => ({
          operations: s.operations,
          heapUsed: `${s.heapUsed.toFixed(2)}MB`,
        })),
      });
    });
  });

  describe('Performance Regression Detection', () => {
    test('should establish baseline performance metrics', async () => {
      // This test establishes baseline metrics that can be used for regression testing
      const baselines = {
        cacheSet: { target: 0.1, tolerance: 0.05 }, // 0.1ms ± 0.05ms
        cacheGet: { target: 0.1, tolerance: 0.05 }, // 0.1ms ± 0.05ms
        apiKeyCached: { target: 2, tolerance: 1 }, // 2ms ± 1ms
        httpAgentReuse: { target: 0.5, tolerance: 0.25 }, // 0.5ms ± 0.25ms
        e2eRequest: { target: 50, tolerance: 25 }, // 50ms ± 25ms
        memoryPerOperation: { target: 0.05, tolerance: 0.05 }, // 0.05MB ± 0.05MB
      };

      // Test cache performance
      const cacheSetTimes = [];
      const cacheGetTimes = [];

      for (let i = 0; i < 100; i++) {
        const { timeMs: setTime } = await measureTime(async () => {
          cacheService.set(`baseline-${i}`, `value-${i}`);
        });
        cacheSetTimes.push(setTime);

        const { timeMs: getTime } = await measureTime(async () => {
          cacheService.get(`baseline-${i}`);
        });
        cacheGetTimes.push(getTime);
      }

      const avgCacheSet =
        cacheSetTimes.reduce((sum, time) => sum + time, 0) /
        cacheSetTimes.length;
      const avgCacheGet =
        cacheGetTimes.reduce((sum, time) => sum + time, 0) /
        cacheGetTimes.length;

      // Test API key cached performance
      const llmConfig = {
        displayName: 'Baseline LLM',
        apiKeyFileName: 'baseline_key.txt',
      };
      fileSystemReader.readFile.mockResolvedValue('sk-baseline-key');

      // Prime the cache
      await apiKeyService.getApiKey(llmConfig, 'baseline-test');

      const apiKeyCachedTimes = [];
      for (let i = 0; i < 50; i++) {
        const { timeMs } = await measureTime(async () => {
          await apiKeyService.getApiKey(llmConfig, 'baseline-test');
        });
        apiKeyCachedTimes.push(timeMs);
      }
      const avgApiKeyCached =
        apiKeyCachedTimes.reduce((sum, time) => sum + time, 0) /
        apiKeyCachedTimes.length;

      // Test HTTP agent reuse
      const agentReuseTimes = [];
      for (let i = 0; i < 50; i++) {
        const { timeMs } = await measureTime(async () => {
          httpAgentService.getAgent('https://baseline.test.com');
        });
        agentReuseTimes.push(timeMs);
      }
      const avgAgentReuse =
        agentReuseTimes.reduce((sum, time) => sum + time, 0) /
        agentReuseTimes.length;

      // Test E2E request
      llmConfigService.getLlmById.mockReturnValue({
        displayName: 'Baseline E2E LLM',
        endpointUrl: 'https://api.baseline.com/v1/chat',
        apiType: 'openai',
        apiKeyFileName: 'baseline_e2e_key.txt',
      });

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Baseline response' } }],
        }),
        headers: new Map([['content-type', 'application/json']]),
      });

      const { timeMs: e2eTime } = await measureTime(async () => {
        await request(app)
          .post('/api/llm-request')
          .send({
            llmId: 'baseline-e2e-llm',
            targetPayload: {
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'Baseline test' }],
            },
          });
      });

      // Collect results
      const results = {
        cacheSet: avgCacheSet,
        cacheGet: avgCacheGet,
        apiKeyCached: avgApiKeyCached,
        httpAgentReuse: avgAgentReuse,
        e2eRequest: e2eTime,
      };

      // Check against baselines
      Object.keys(baselines).forEach((metric) => {
        const metricValue = results[metric];

        // Skip undefined metrics
        if (metricValue === undefined) return;

        const baseline = baselines[metric];
        const actualValue = metricValue;
        const upperBound = baseline.target + baseline.tolerance;

        expect(actualValue).toBeGreaterThanOrEqual(0); // Sanity check
        expect(actualValue).toBeLessThanOrEqual(upperBound);

        // Log warning if performance is degraded but within tolerance
        if (actualValue > baseline.target) {
          logger.warn(`Performance degradation detected for ${metric}:`, {
            target: baseline.target,
            actual: actualValue,
            degradation: `${(((actualValue - baseline.target) / baseline.target) * 100).toFixed(1)}%`,
          });
        }
      });

      logger.info('Baseline Performance Metrics:', {
        results,
        baselines,
        timestamp: new Date().toISOString(),
      });
    });
  });
});
