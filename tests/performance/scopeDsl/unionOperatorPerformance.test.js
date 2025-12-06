/**
 * @file Performance tests for ScopeDSL Union Operator
 * @description Tests the performance of union operations with various dataset sizes and complexity
 *
 * Performance Targets:
 * - Large unions (2000+ items): <100ms total resolution
 * - Complex union chains: <50ms per chain
 * - Memory efficiency: No memory leaks during large operations
 * - Scaling: Linear or better performance scaling
 */

import { jest } from '@jest/globals';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import { PerformanceTestBed } from '../../common/performance/PerformanceTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// Set reasonable timeout for performance tests
jest.setTimeout(60000);

describe('Union Operator Performance', () => {
  let container;
  let engine;
  let actorEntity;
  let runtimeCtx;
  let entityManager;
  let registry;

  beforeAll(async () => {
    // Get shared container for performance
    container = await PerformanceTestBed.getSharedContainer();

    // Resolve required services
    entityManager = container.resolve(tokens.IEntityManager);
    registry = container.resolve(tokens.IDataRegistry);

    // Create test dataset for shared container setup
    await PerformanceTestBed.createOptimizedTestDataset(100, {
      registry,
      entityManager,
    });
  });

  afterAll(() => {
    PerformanceTestBed.cleanup();
  });

  beforeEach(() => {
    // Create a simple logger for testing
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Create a simple jsonLogicEval mock
    const jsonLogicEval = {
      evaluate: jest.fn(),
    };

    // Create a simple component registry
    const componentRegistry = {
      getEntitiesWithComponent: jest.fn((componentId) => {
        if (componentId === 'core:actor')
          return [{ id: 'actor1' }, { id: 'actor2' }];
        if (componentId === 'core:npc') return [{ id: 'npc1' }, { id: 'npc2' }];
        return [];
      }),
    };

    // Create engine - it doesn't take dependencies in constructor
    engine = new ScopeEngine();

    // Create test actor with followers and partners
    actorEntity = createEntityInstance({
      instanceId: 'test:actor',
      definitionId: 'test:actor',
      baseComponents: {
        'social:relationships': {
          followers: ['follower1', 'follower2'],
          partners: ['partner1', 'partner2'],
        },
      },
    });

    // Mock entity manager
    const mockEntityManager = {
      getEntity: jest.fn((id) => {
        const entities = {
          'test:actor': actorEntity,
          follower1: createEntityInstance({ instanceId: 'follower1' }),
          follower2: createEntityInstance({ instanceId: 'follower2' }),
          partner1: createEntityInstance({ instanceId: 'partner1' }),
          partner2: createEntityInstance({ instanceId: 'partner2' }),
        };
        return entities[id];
      }),
      getEntityInstance: jest.fn((id) => {
        // Provide the same as getEntity for test purposes
        const entities = {
          'test:actor': actorEntity,
          follower1: createEntityInstance({ instanceId: 'follower1' }),
          follower2: createEntityInstance({ instanceId: 'follower2' }),
          partner1: createEntityInstance({ instanceId: 'partner1' }),
          partner2: createEntityInstance({ instanceId: 'partner2' }),
        };
        return entities[id];
      }),
      getComponentData: jest.fn((entityId, componentId) => {
        const entity = mockEntityManager.getEntity(entityId);
        return entity ? entity.getComponentData(componentId) : null;
      }),
      hasComponent: jest.fn((entityId, componentId) => {
        const entity = mockEntityManager.getEntity(entityId);
        return entity ? entity.hasComponent(componentId) : false;
      }),
      getEntitiesWithComponent: jest.fn((componentId) => {
        return componentRegistry.getEntitiesWithComponent(componentId);
      }),
    };

    runtimeCtx = {
      entityManager: mockEntityManager,
      jsonLogicEval,
      componentRegistry,
      logger,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Large Dataset Union Performance', () => {
    it('should handle large unions efficiently', () => {
      // Create large sets - this is the extracted performance test
      const largeFollowers = Array.from({ length: 1000 }, (_, i) => `f${i}`);
      const largePartners = Array.from({ length: 1000 }, (_, i) => `p${i}`);

      actorEntity.addComponent('social:relationships', {
        followers: largeFollowers,
        partners: largePartners,
      });

      const iterations = 10;
      const timings = [];

      // Warm up - increased for JIT stabilization
      for (let i = 0; i < 20; i++) {
        try {
          const ast = parseDslExpression('actor.followers | actor.partners');
          engine.resolve(ast, actorEntity, runtimeCtx);
        } catch {
          // Ignore warm-up errors
        }
      }

      // Measure performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const ast = parseDslExpression('actor.followers | actor.partners');
        const result = engine.resolve(ast, actorEntity, runtimeCtx);
        const duration = performance.now() - start;

        timings.push(duration);
        expect(result.size).toBe(2000); // Verify correctness
      }

      // Calculate statistical metrics
      const sortedTimings = timings.sort((a, b) => a - b);
      const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
      const p95Index = Math.floor(sortedTimings.length * 0.95);
      const p95Time =
        sortedTimings[p95Index] || sortedTimings[sortedTimings.length - 1];

      // Performance assertions
      expect(avgTime).toBeLessThan(100); // Should complete in under 100ms average
      expect(p95Time).toBeLessThan(150); // 95th percentile under 150ms
    });

    it('should scale linearly with union size', () => {
      const sizes = [100, 500, 1000, 2000];
      const scalingMetrics = [];

      for (const size of sizes) {
        const followers = Array.from({ length: size }, (_, i) => `f${i}`);
        const partners = Array.from({ length: size }, (_, i) => `p${i}`);

        actorEntity.addComponent('social:relationships', {
          followers,
          partners,
        });

        // Warm up
        for (let i = 0; i < 10; i++) {
          try {
            const ast = parseDslExpression('actor.followers | actor.partners');
            engine.resolve(ast, actorEntity, runtimeCtx);
          } catch {
            // Ignore warm-up errors
          }
        }

        // Measure
        const start = performance.now();
        const ast = parseDslExpression('actor.followers | actor.partners');
        const result = engine.resolve(ast, actorEntity, runtimeCtx);
        const duration = performance.now() - start;

        const timePerItem = duration / (size * 2);
        scalingMetrics.push({
          size: size * 2, // Total items (followers + partners)
          duration,
          timePerItem,
        });

        expect(result.size).toBe(size * 2);
      }

      // Verify scaling - later operations shouldn't be significantly slower per item
      const baselineTimePerItem = scalingMetrics[0].timePerItem;
      const ratioThreshold = 5; // Guard for statistical outliers while keeping linear expectations
      const absoluteThreshold = 0.002; // 0.002ms per item ~= 8ms total at largest dataset

      for (let i = 1; i < scalingMetrics.length; i++) {
        const currentTimePerItem = scalingMetrics[i].timePerItem;
        const exceedsRatio =
          currentTimePerItem > baselineTimePerItem * ratioThreshold;
        const exceedsAbsolute =
          currentTimePerItem - baselineTimePerItem > absoluteThreshold;

        // Only fail if both thresholds are exceeded (ratio AND absolute)
        const shouldFail = exceedsRatio && exceedsAbsolute;
        expect(shouldFail).toBe(false);
      }
    });
  });

  describe('Complex Union Chain Performance', () => {
    it('should handle multiple chained unions efficiently', () => {
      // Create test data for complex chains
      actorEntity.addComponent('social:relationships', {
        followers: Array.from({ length: 250 }, (_, i) => `f${i}`),
        partners: Array.from({ length: 250 }, (_, i) => `p${i}`),
        friends: Array.from({ length: 250 }, (_, i) => `fr${i}`),
        allies: Array.from({ length: 250 }, (_, i) => `a${i}`),
      });

      const complexUnions = [
        'actor.followers | actor.partners',
        'actor.followers | actor.partners | actor.friends',
        'actor.followers | actor.partners | actor.friends | actor.allies',
      ];

      const chainMetrics = [];

      for (const unionExpr of complexUnions) {
        const iterations = 50; // Increased from 20 for more stable averages
        const timings = [];

        // Warm up - increased for better JIT optimization
        for (let i = 0; i < 30; i++) {
          try {
            const ast = parseDslExpression(unionExpr);
            engine.resolve(ast, actorEntity, runtimeCtx);
          } catch {
            // Ignore warm-up errors
          }
        }

        // Measure
        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          const ast = parseDslExpression(unionExpr);
          engine.resolve(ast, actorEntity, runtimeCtx);
          const duration = performance.now() - start;
          timings.push(duration);
        }

        const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
        const unionCount = (unionExpr.match(/\|/g) || []).length + 1;

        chainMetrics.push({
          expression: unionExpr,
          unionCount,
          avgTime,
          timePerUnion: avgTime / unionCount,
        });

        // Each chain should complete reasonably fast
        expect(avgTime).toBeLessThan(50); // <50ms per chain
      }

      // Verify that time per union operation remains reasonable as chains get longer
      const timePerUnionValues = chainMetrics.map((m) => m.timePerUnion);
      const baselineTimePerUnion = timePerUnionValues[0];

      for (let i = 1; i < timePerUnionValues.length; i++) {
        // Time per union shouldn't increase significantly with chain length
        // Increased threshold from 1.5x to 2.0x to account for normal system variance
        // Also add absolute threshold - only fail if difference is significant
        const actualTimePerUnion = timePerUnionValues[i];
        const expectedThreshold = baselineTimePerUnion * 2.0;
        const absoluteDifference = actualTimePerUnion - baselineTimePerUnion;

        // Fail only if both ratio exceeds 2x AND absolute difference > 1ms
        const shouldFail =
          actualTimePerUnion > expectedThreshold && absoluteDifference > 1;
        expect(shouldFail).toBe(false);
      }
    });

    it('should handle nested unions with complex data efficiently', () => {
      // Create nested structure
      actorEntity.addComponent('inventory:items', {
        items: Array.from({ length: 500 }, (_, i) => ({
          id: `item${i}`,
          type: i % 3 === 0 ? 'weapon' : i % 3 === 1 ? 'armor' : 'consumable',
        })),
      });

      actorEntity.addComponent('equipment:equipped', {
        weapon: 'sword1',
        armor: 'plate1',
      });

      const nestedUnionExpr = 'actor.inventory | actor.equipped';
      const iterations = 50;
      const timings = [];

      // Warm up
      for (let i = 0; i < 20; i++) {
        try {
          const ast = parseDslExpression(nestedUnionExpr);
          engine.resolve(ast, actorEntity, runtimeCtx);
        } catch {
          // Ignore warm-up errors
        }
      }

      // Measure
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const ast = parseDslExpression(nestedUnionExpr);
        engine.resolve(ast, actorEntity, runtimeCtx);
        const duration = performance.now() - start;
        timings.push(duration);
      }

      const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;
      const sortedTimings = timings.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimings.length * 0.95);
      const p95Time =
        sortedTimings[p95Index] || sortedTimings[sortedTimings.length - 1];

      // Complex nested unions should still be fast
      expect(avgTime).toBeLessThan(20); // <20ms average
      expect(p95Time).toBeLessThan(40); // <40ms 95th percentile
    });
  });

  describe('Memory Efficiency Tests', () => {
    it('should not exhibit memory leaks during repeated large unions', () => {
      // Create large datasets for memory testing
      const createLargeDataset = () => {
        return {
          followers: Array.from({ length: 500 }, (_, i) => `f${i}`),
          partners: Array.from({ length: 500 }, (_, i) => `p${i}`),
        };
      };

      const iterations = 100;
      const memoryCheckpoints = [];

      // Baseline memory measurement
      if (global.gc) {
        global.gc();
      }
      const baselineMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        // Create fresh data each iteration to simulate real usage
        const data = createLargeDataset();
        actorEntity.addComponent('social:relationships', data);

        const ast = parseDslExpression('actor.followers | actor.partners');
        const result = engine.resolve(ast, actorEntity, runtimeCtx);

        // Verify result correctness
        expect(result.size).toBe(1000);

        // Memory checkpoint every 20 iterations
        if (i % 20 === 0) {
          if (global.gc) {
            global.gc();
          }
          const currentMemory = process.memoryUsage().heapUsed;
          memoryCheckpoints.push({
            iteration: i,
            memoryUsage: currentMemory - baselineMemory,
          });
        }
      }

      // Check for memory leaks - memory usage shouldn't grow indefinitely
      const firstCheckpoint = memoryCheckpoints[1]; // Skip baseline
      const lastCheckpoint = memoryCheckpoints[memoryCheckpoints.length - 1];

      // Ensure we have enough checkpoints for meaningful analysis
      expect(memoryCheckpoints.length).toBeGreaterThan(2);
      expect(firstCheckpoint).toBeDefined();
      expect(lastCheckpoint).toBeDefined();

      const memoryGrowth =
        lastCheckpoint.memoryUsage - firstCheckpoint.memoryUsage;
      const acceptableGrowth = 50 * 1024 * 1024; // 50MB max growth

      expect(memoryGrowth).toBeLessThan(acceptableGrowth);
    });

    it('should efficiently handle deduplication in large unions', () => {
      // Create overlapping datasets to test deduplication performance
      const baseItems = Array.from({ length: 800 }, (_, i) => `item${i}`);
      const overlapItems = Array.from({ length: 400 }, (_, i) => `item${i}`); // 50% overlap

      actorEntity.addComponent('social:relationships', {
        followers: baseItems,
        partners: [
          ...overlapItems,
          ...Array.from({ length: 400 }, (_, i) => `partner${i}`),
        ],
      });

      const iterations = 30;
      const timings = [];

      // Warm up
      for (let i = 0; i < 15; i++) {
        try {
          const ast = parseDslExpression('actor.followers | actor.partners');
          engine.resolve(ast, actorEntity, runtimeCtx);
        } catch {
          // Ignore warm-up errors
        }
      }

      // Measure deduplication performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const ast = parseDslExpression('actor.followers | actor.partners');
        const result = engine.resolve(ast, actorEntity, runtimeCtx);
        const duration = performance.now() - start;

        timings.push(duration);

        // Verify deduplication worked correctly
        expect(result.size).toBe(1200); // 800 + 400 unique partners
      }

      const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length;

      // Deduplication should be efficient even with overlaps
      expect(avgTime).toBeLessThan(80); // <80ms with deduplication
    });
  });

  describe('Error Recovery Performance', () => {
    it('should maintain performance after union operation errors', () => {
      const windows = 3;
      const errorsPerWindow = 20;
      const validOpsPerWindow = 20;
      const windowMetrics = [];

      for (let w = 0; w < windows; w++) {
        // Generate errors in this window
        for (let i = 0; i < errorsPerWindow; i++) {
          try {
            const ast = parseDslExpression('actor.nonexistent | actor.invalid');
            engine.resolve(ast, actorEntity, runtimeCtx);
          } catch {
            // Expected errors
          }
        }

        // Now measure normal union performance
        const validTimings = [];
        actorEntity.addComponent('social:relationships', {
          followers: Array.from({ length: 100 }, (_, i) => `f${i}`),
          partners: Array.from({ length: 100 }, (_, i) => `p${i}`),
        });

        for (let i = 0; i < validOpsPerWindow; i++) {
          const start = performance.now();
          try {
            const ast = parseDslExpression('actor.followers | actor.partners');
            const result = engine.resolve(ast, actorEntity, runtimeCtx);
            const duration = performance.now() - start;

            if (result.size === 200) {
              // Verify correctness
              validTimings.push(duration);
            }
          } catch {
            // Count failures
          }
        }

        const avgTime =
          validTimings.reduce((sum, t) => sum + t, 0) /
          (validTimings.length || 1);
        const successRate = validTimings.length / validOpsPerWindow;

        windowMetrics.push({
          window: w,
          avgTime,
          successRate,
        });
      }

      // Performance should remain stable after errors
      const avgTimes = windowMetrics.map((m) => m.avgTime);
      const firstWindowTime = avgTimes[0];
      const lastWindowTime = avgTimes[avgTimes.length - 1];

      // Performance shouldn't degrade significantly
      // Use 2.5x tolerance for relative comparison plus 10ms absolute slack for
      // very small baseline numbers. Without the absolute buffer the ratio check
      // becomes extremely sensitive (e.g. a ~0.4ms difference on a ~0.07ms
      // baseline exceeds 2.5× even though the actual slowdown is negligible).
      const relativeTolerance = 2.5;
      const absoluteTolerance = 10; // 10ms absolute guard for low baselines
      const allowedTime =
        firstWindowTime * relativeTolerance + absoluteTolerance;
      expect(lastWindowTime).toBeLessThan(allowedTime);

      // Success rates should remain high
      windowMetrics.forEach((metric) => {
        expect(metric.successRate).toBeGreaterThan(0.7); // At least 70% success
      });
    });
  });
});
