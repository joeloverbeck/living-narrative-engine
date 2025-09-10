/**
 * @file Integration tests for error handling documentation examples
 * Tests the examples with real ScopeDslErrorHandler and error handling system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ScopeDslErrorHandler from '../../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';
import createBasicResolver from '../../../../docs/scopeDsl/examples/error-handling-basic.js';
import createValidationResolver from '../../../../docs/scopeDsl/examples/error-handling-validation.js';
import createAsyncResolver from '../../../../docs/scopeDsl/examples/error-handling-async.js';
import createPerformanceResolver from '../../../../docs/scopeDsl/examples/error-handling-performance.js';

describe('Error Handling Examples - Integration Tests', () => {
  let logger;
  let errorHandler;
  let originalNodeEnv;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;

    // Create real logger with tracking
    const logs = [];
    logger = {
      info: (msg, data) => logs.push({ level: 'info', msg, data }),
      warn: (msg, data) => logs.push({ level: 'warn', msg, data }),
      error: (msg, data) => logs.push({ level: 'error', msg, data }),
      debug: (msg, data) => logs.push({ level: 'debug', msg, data }),
      getLogs: () => logs,
      clearLogs: () => (logs.length = 0),
    };

    // Create real error handler
    errorHandler = new ScopeDslErrorHandler({
      logger,
      config: {
        isDevelopment: true,
        maxBufferSize: 50,
      },
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    errorHandler.clearErrorBuffer();
  });

  describe('Basic Resolver with Real Error Handler', () => {
    it('should integrate with real error handler', () => {
      const resolver = createBasicResolver({ logger, errorHandler });

      expect(() => {
        resolver.resolve({ type: 'basic', value: 'test' }, {});
      }).toThrow();

      // Check error was logged
      const logs = logger.getLogs();
      expect(logs.some((log) => log.level === 'error')).toBe(true);

      // Check error is in buffer
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].code).toBe(ErrorCodes.MISSING_ACTOR);
    });

    it('should handle multiple errors and track in buffer', () => {
      const resolver = createBasicResolver({ logger, errorHandler });
      const ctx = { actorEntity: { id: 'actor1' } };

      // Generate multiple errors
      const errors = [];
      for (let i = 0; i < 5; i++) {
        try {
          resolver.resolve({ type: 'basic' }, ctx); // Missing value
        } catch (e) {
          errors.push(e);
        }
      }

      expect(errors).toHaveLength(5);

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBe(5);
      expect(
        buffer.every((e) => e.code === ErrorCodes.INVALID_NODE_STRUCTURE)
      ).toBe(true);
    });
  });

  describe('Validation Resolver with Real Components', () => {
    let entityManager;
    let componentRegistry;

    beforeEach(() => {
      // Create mock implementations that simulate real behavior
      const entities = new Map([
        [
          'entity1',
          { id: 'entity1', components: { 'core:stats': { health: 100 } } },
        ],
        ['entity2', { id: 'entity2', components: {} }],
      ]);

      entityManager = {
        getEntity: (id) => entities.get(id),
        hasEntity: (id) => entities.has(id),
      };

      const components = new Set([
        'core:stats',
        'core:inventory',
        'core:position',
      ]);
      componentRegistry = {
        getComponent: (id) => (components.has(id) ? {} : null),
        hasComponent: (id) => components.has(id),
      };
    });

    it('should validate entity with real error tracking', () => {
      const resolver = createValidationResolver({
        logger,
        errorHandler,
        entityManager,
        componentRegistry,
      });

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: (node, ctx) => ({ resolved: true }),
      };

      // Test with valid entity
      const result = resolver.resolve(
        {
          type: 'validation',
          entityId: 'entity1',
        },
        ctx
      );

      expect(result.valid).toBe(true);
      expect(errorHandler.getErrorBuffer()).toHaveLength(0);

      // Test with invalid entity
      expect(() => {
        resolver.resolve(
          {
            type: 'validation',
            entityId: 'nonexistent',
          },
          ctx
        );
      }).toThrow();

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].code).toBe(ErrorCodes.ENTITY_RESOLUTION_FAILED);
    });

    it('should validate complex scenarios', () => {
      const resolver = createValidationResolver({
        logger,
        errorHandler,
        entityManager,
        componentRegistry,
      });

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: (node, ctx) => ({ resolved: true }),
        depth: 5,
      };

      // Test depth validation
      const deepCtx = { ...ctx, depth: 11 };
      expect(() => {
        resolver.resolve({ type: 'validation' }, deepCtx);
      }).toThrow();

      expect(errorHandler.getErrorBuffer()[0].code).toBe(
        ErrorCodes.MAX_DEPTH_EXCEEDED
      );

      // Test circular reference detection
      const visitedSet = new Set(['node1', 'node2']);
      const circularCtx = {
        ...ctx,
        visited: visitedSet,
        currentNodeId: 'node1', // Already visited
      };

      expect(() => {
        resolver.resolve({ type: 'validation' }, circularCtx);
      }).toThrow();

      const buffer = errorHandler.getErrorBuffer();
      const circularError = buffer.find(
        (e) => e.code === ErrorCodes.CYCLE_DETECTED
      );
      expect(circularError).toBeDefined();
    });
  });

  describe('Async Resolver with Real Async Operations', () => {
    let dataFetcher;
    let cache;

    beforeEach(() => {
      // Simulate real async data fetcher
      const dataStore = new Map([
        ['item1', { id: 'item1', name: 'Item One' }],
        ['item2', { id: 'item2', name: 'Item Two' }],
      ]);

      dataFetcher = {
        fetch: async (id) => {
          await new Promise((resolve) => setTimeout(resolve, 10));

          if (id === 'error') {
            throw new Error('Network error');
          }

          if (id === 'slow') {
            await new Promise((resolve) => setTimeout(resolve, 6000));
          }

          return dataStore.get(id) || null;
        },
        fetchBatch: async (ids) => {
          return Promise.all(ids.map((id) => dataFetcher.fetch(id)));
        },
      };

      // Simple cache implementation
      const cacheStore = new Map();
      cache = {
        get: (key) => cacheStore.get(key),
        set: (key, value) => cacheStore.set(key, value),
        has: (key) => cacheStore.has(key),
      };
    });

    it('should handle real async operations with caching', async () => {
      const resolver = createAsyncResolver({
        logger,
        errorHandler,
        dataFetcher,
        cache,
      });

      // First fetch - should hit dataFetcher
      const result1 = await resolver.resolve(
        {
          type: 'async',
          subtype: 'single',
          id: 'item1',
        },
        {}
      );

      expect(result1).toEqual({ id: 'item1', name: 'Item One' });
      expect(cache.has('item1')).toBe(true);

      // Second fetch - should hit cache
      const result2 = await resolver.resolve(
        {
          type: 'async',
          subtype: 'single',
          id: 'item1',
        },
        {}
      );

      expect(result2).toEqual(result1);
    });

    it('should handle batch operations with mixed results', async () => {
      const resolver = createAsyncResolver({
        logger,
        errorHandler,
        dataFetcher,
        cache,
      });

      const results = await resolver.resolve(
        {
          type: 'async',
          subtype: 'batch',
          ids: ['item1', 'error', 'item2', 'nonexistent'],
        },
        {}
      );

      // Should have results for successful fetches
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.result?.id === 'item1')).toBe(true);
      expect(results.some((r) => r.result?.id === 'item2')).toBe(true);

      // Check warnings were logged for failures
      const warnings = logger.getLogs().filter((l) => l.level === 'warn');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should handle stream processing', async () => {
      const resolver = createAsyncResolver({
        logger,
        errorHandler,
        dataFetcher,
        cache,
      });

      const items = [
        { id: 'item1' },
        { id: null }, // Will cause error
        { id: 'item2' },
      ];

      const results = await resolver.resolve(
        {
          type: 'async',
          subtype: 'stream',
          items,
        },
        {}
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Performance Resolver with Real Metrics', () => {
    let metricsCollector;

    beforeEach(() => {
      const metrics = [];
      metricsCollector = {
        recordMetric: (metric) => metrics.push(metric),
        getMetrics: () => metrics,
      };
    });

    it('should track performance metrics', () => {
      const resolver = createPerformanceResolver({
        logger,
        errorHandler,
        metricsCollector,
      });

      const result = resolver.resolve(
        {
          type: 'performance',
          id: 'test1',
        },
        {}
      );

      expect(result.processed).toBe(true);

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('resolve');
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeDefined();
    });

    it('should demonstrate development vs production behavior', () => {
      // Test development mode
      process.env.NODE_ENV = 'development';

      const devResolver = createPerformanceResolver({
        logger,
        errorHandler: new ScopeDslErrorHandler({
          logger,
          config: { isDevelopment: true },
        }),
        metricsCollector,
      });

      const fullCtx = {
        actorEntity: {
          id: 'actor1',
          name: 'Test',
          data: { lots: 'of', nested: 'data' },
        },
        targetEntity: { id: 'target1' },
        depth: 15, // Exceeds limit
        extra: 'data',
      };

      expect(() => {
        devResolver.resolve({ type: 'performance', id: 'test' }, fullCtx);
      }).toThrow();

      const devLogs = logger.getLogs();
      expect(devLogs.some((l) => l.level === 'error')).toBe(true);

      // Test production mode
      logger.clearLogs();
      process.env.NODE_ENV = 'production';

      const prodResolver = createPerformanceResolver({
        logger,
        errorHandler: new ScopeDslErrorHandler({
          logger,
          config: { isDevelopment: false },
        }),
        metricsCollector,
      });

      expect(() => {
        prodResolver.resolve({ type: 'performance', id: 'test' }, fullCtx);
      }).toThrow();

      const prodLogs = logger.getLogs();
      expect(prodLogs.some((l) => l.level === 'error')).toBe(true);
    });

    it('should manage error buffer effectively', () => {
      const resolver = createPerformanceResolver({
        logger,
        errorHandler,
        metricsCollector,
      });

      // Generate many errors to fill buffer
      for (let i = 0; i < 60; i++) {
        try {
          resolver.resolve({ type: 'performance', id: null }, {});
        } catch (e) {
          // Expected
        }
      }

      // Check buffer before management
      expect(errorHandler.getErrorBuffer().length).toBe(50); // Max buffer size

      // Manage buffer
      resolver.manageErrorBuffer();

      // Buffer should be cleared
      expect(errorHandler.getErrorBuffer().length).toBe(0);

      // Summary should have been logged
      const infoLogs = logger.getLogs().filter((l) => l.level === 'info');
      expect(infoLogs.some((l) => l.msg.includes('summary'))).toBe(true);
    });
  });

  describe('Error Handler Buffer Management', () => {
    it('should respect max buffer size', () => {
      const smallBufferHandler = new ScopeDslErrorHandler({
        logger,
        config: {
          isDevelopment: true,
          maxBufferSize: 10,
        },
      });

      const resolver = createBasicResolver({
        logger,
        errorHandler: smallBufferHandler,
      });

      // Generate more errors than buffer size
      for (let i = 0; i < 15; i++) {
        try {
          resolver.resolve({ type: 'basic', value: 'test' }, {});
        } catch (e) {
          // Expected
        }
      }

      const buffer = smallBufferHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(10);
    });

    it('should categorize errors correctly', () => {
      const resolver = createValidationResolver({
        logger,
        errorHandler,
        entityManager: { hasEntity: () => false, getEntity: () => null },
        componentRegistry: {
          hasComponent: () => false,
          getComponent: () => null,
        },
      });

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: () => {},
      };

      // Generate different error types
      const errorScenarios = [
        {
          node: { type: 'validation', entityId: 'missing' },
          expectedCategory: 'resolution_failure',
        },
        {
          node: {
            type: 'validation',
            data: 'string',
            schema: { type: 'number' },
          },
          expectedCategory: 'data_validation',
        },
      ];

      for (const scenario of errorScenarios) {
        try {
          resolver.resolve(scenario.node, ctx);
        } catch (e) {
          // Expected
        }
      }

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeGreaterThan(0);

      // Check that errors have appropriate categories
      const categories = [...new Set(buffer.map((e) => e.category))];
      expect(categories.length).toBeGreaterThan(1);
    });
  });
});
