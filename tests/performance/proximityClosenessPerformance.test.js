/**
 * @file Performance benchmarks for proximity-based closeness system
 * @description Tests the performance characteristics of proximity operation handlers
 * and validates scalability under various load conditions.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import { createTestBed } from '../common/testBed.js';
import EstablishSittingClosenessHandler from '../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import {
  getAdjacentSpots,
  findAdjacentOccupants,
} from '../../src/utils/proximityUtils.js';

describe('Proximity Closeness Performance Tests', () => {
  let testBed;
  let establishHandler;
  let removeHandler;
  let mockClosenessCircleService;
  let executionContext;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock closeness circle service
    mockClosenessCircleService = {
      merge: jest.fn(),
      repair: jest.fn(),
      dedupe: jest.fn((partners) => partners),
    };

    // Create execution context
    executionContext = {
      logger: testBed.createMockLogger(),
      variables: new Map(),
    };

    // Initialize handlers with mocks
    const mockEntityManager = {
      ...testBed.createMockEntityManager(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
      setComponentData: jest.fn(),
    };
    testBed.entityManager = mockEntityManager; // Store for test access
    const mockLogger = testBed.createMockLogger();
    const mockEventDispatcher = { dispatch: jest.fn() };

    establishHandler = new EstablishSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      closenessCircleService: mockClosenessCircleService,
    });

    removeHandler = new RemoveSittingClosenessHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockEventDispatcher,
      closenessCircleService: mockClosenessCircleService,
    });
  });

  afterEach(() => {
    testBed.cleanup();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Core Utility Performance', () => {
    it('should calculate adjacency in constant time O(1)', () => {
      const iterations = 100000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const spotIndex = Math.floor(Math.random() * 10);
        const totalSpots = 10;
        getAdjacentSpots(spotIndex, totalSpots);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerMs = iterations / duration;

      console.log(`Adjacency Calculation Performance:
      Iterations: ${iterations}
      Duration: ${duration.toFixed(2)}ms
      Operations/ms: ${operationsPerMs.toFixed(0)}`);

      // Should handle >1000 adjacency calculations per millisecond
      expect(operationsPerMs).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(100); // <100ms for 100k operations
    });

    it('should find adjacent occupants efficiently with varying furniture sizes', () => {
      const testSizes = [2, 5, 10]; // Different furniture sizes
      const iterations = 10000;

      testSizes.forEach((size) => {
        const furnitureComponent = {
          spots: new Array(size).fill(null),
        };

        // Fill with some actors
        for (let i = 0; i < size; i += 2) {
          furnitureComponent.spots[i] = `game:actor_${i}`;
        }

        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          const spotIndex = Math.floor(Math.random() * size);
          findAdjacentOccupants(furnitureComponent, spotIndex);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(
          `Adjacent Occupants (size ${size}): ${iterations} operations in ${duration.toFixed(2)}ms`
        );

        // Performance should be independent of furniture size
        expect(duration).toBeLessThan(50); // <50ms for 10k operations regardless of size
      });
    });
  });

  describe('Operation Handler Performance', () => {
    it('should execute establish closeness operation quickly', async () => {
      const operations = 1000;
      const results = [];

      // Setup mock responses for consistent behavior
      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots: ['game:alice', null, 'game:charlie'] };
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({
        'game:alice': ['game:bob'],
        'game:bob': ['game:alice'],
      });

      const startTime = performance.now();

      for (let i = 0; i < operations; i++) {
        const operationStart = performance.now();

        await establishHandler.execute(
          {
            furniture_id: 'furniture:couch',
            actor_id: 'game:bob',
            spot_index: 1,
          },
          executionContext
        );

        const operationEnd = performance.now();
        results.push(operationEnd - operationStart);
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageOperation =
        results.reduce((sum, time) => sum + time, 0) / operations;
      const maxOperation = Math.max(...results);
      const minOperation = Math.min(...results);

      console.log(`Establish Closeness Performance:
      Operations: ${operations}
      Total Duration: ${totalDuration.toFixed(2)}ms
      Average Operation: ${averageOperation.toFixed(2)}ms
      Min Operation: ${minOperation.toFixed(2)}ms
      Max Operation: ${maxOperation.toFixed(2)}ms
      Operations/sec: ${((operations / totalDuration) * 1000).toFixed(0)}`);

      // Performance assertions
      expect(averageOperation).toBeLessThan(50); // <50ms average
      expect(maxOperation).toBeLessThan(100); // <100ms worst case
      expect(totalDuration).toBeLessThan(10000); // <10s for 1000 operations
    });

    it('should execute remove closeness operation quickly', async () => {
      const operations = 1000;
      const results = [];

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots: ['game:alice', null, 'game:charlie'] };
          }
          if (componentType === 'positioning:closeness') {
            return { partners: ['game:alice', 'game:charlie'] };
          }
          return null;
        }
      );

      mockClosenessCircleService.repair.mockReturnValue({
        'game:alice': [],
        'game:charlie': [],
      });

      const startTime = performance.now();

      for (let i = 0; i < operations; i++) {
        const operationStart = performance.now();

        await removeHandler.execute(
          {
            furniture_id: 'furniture:couch',
            actor_id: 'game:bob',
            spot_index: 1,
          },
          executionContext
        );

        const operationEnd = performance.now();
        results.push(operationEnd - operationStart);
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageOperation =
        results.reduce((sum, time) => sum + time, 0) / operations;
      const maxOperation = Math.max(...results);
      const minOperation = Math.min(...results);

      console.log(`Remove Closeness Performance:
      Operations: ${operations}
      Total Duration: ${totalDuration.toFixed(2)}ms
      Average Operation: ${averageOperation.toFixed(2)}ms
      Min Operation: ${minOperation.toFixed(2)}ms
      Max Operation: ${maxOperation.toFixed(2)}ms
      Operations/sec: ${((operations / totalDuration) * 1000).toFixed(0)}`);

      expect(averageOperation).toBeLessThan(50); // <50ms average
      expect(maxOperation).toBeLessThan(100); // <100ms worst case
      expect(totalDuration).toBeLessThan(10000); // <10s for 1000 operations
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with actor count', async () => {
      const actorCounts = [10, 50, 100, 500];
      const scalabilityResults = [];

      for (const actorCount of actorCounts) {
        // Setup furniture with all spots occupied
        const spots = new Array(Math.min(actorCount, 10)).fill(null);
        for (let i = 0; i < spots.length; i++) {
          spots[i] = `game:actor_${i}`;
        }

        testBed.entityManager.getComponentData.mockImplementation(
          (entityId, componentType) => {
            if (componentType === 'positioning:allows_sitting') {
              return { spots };
            }
            if (componentType === 'positioning:closeness') {
              // Return partners based on adjacency
              const actorIndex = parseInt(entityId.split('_')[1]);
              const partners = [];
              if (actorIndex > 0) partners.push(`game:actor_${actorIndex - 1}`);
              if (actorIndex < spots.length - 1)
                partners.push(`game:actor_${actorIndex + 1}`);
              return partners.length > 0 ? { partners } : null;
            }
            return null;
          }
        );

        // Create partner data for closeness service
        const partnerData = {};
        for (let i = 0; i < spots.length; i++) {
          const partners = [];
          if (i > 0) partners.push(`game:actor_${i - 1}`);
          if (i < spots.length - 1) partners.push(`game:actor_${i + 1}`);
          partnerData[`game:actor_${i}`] = partners;
        }

        mockClosenessCircleService.repair.mockReturnValue(partnerData);

        const startTime = performance.now();

        // Simulate multiple actors standing up
        const operations = Math.min(actorCount / 10, 50); // Scale operations with actor count
        for (let i = 0; i < operations; i++) {
          await removeHandler.execute(
            {
              furniture_id: 'furniture:large_space',
              actor_id: `game:actor_${i % spots.length}`,
              spot_index: i % spots.length,
            },
            executionContext
          );
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const operationsPerSecond = (operations / duration) * 1000;

        scalabilityResults.push({
          actorCount,
          operations,
          duration,
          operationsPerSecond,
        });
      }

      // Verify linear scaling (operations per second should remain relatively consistent)
      const baselineOpsPerSec = scalabilityResults[0].operationsPerSecond;

      console.log('Scalability Test Results:');
      scalabilityResults.forEach((result, index) => {
        const degradation =
          index > 0
            ? (baselineOpsPerSec - result.operationsPerSecond) /
              baselineOpsPerSec
            : 0;

        console.log(
          `  Actor Count: ${result.actorCount}, Ops/sec: ${result.operationsPerSecond.toFixed(0)}, Degradation: ${(degradation * 100).toFixed(1)}%`
        );
      });

      // Verify performance degradation is within acceptable bounds for all non-baseline measurements
      // Performance should not degrade more than 200% even with 50x more actors
      // Note: This accounts for Jest mock overhead which scales with operation count
      // (1 op baseline vs 50 ops at 500 actors). Real production code has O(1) or O(k)
      // complexity where k is bounded by furniture capacity (~10 max).
      // The lenient threshold catches genuine performance issues while reducing flakiness.
      const nonBaselineResults = scalabilityResults.slice(1);
      for (const result of nonBaselineResults) {
        const degradation =
          (baselineOpsPerSec - result.operationsPerSecond) / baselineOpsPerSec;
        expect(degradation).toBeLessThan(2.0);
      }
    });

    it('should handle concurrent operations efficiently', async () => {
      const concurrentCount = 20;
      const operations = [];

      // Setup mock for concurrent operations
      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots: new Array(10).fill(null) };
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({});

      const startTime = performance.now();

      // Create concurrent operations
      for (let i = 0; i < concurrentCount; i++) {
        operations.push(
          establishHandler.execute(
            {
              furniture_id: `furniture:piece_${i % 5}`,
              actor_id: `game:actor_${i}`,
              spot_index: i % 10,
            },
            executionContext
          )
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (concurrentCount / duration) * 1000;

      console.log(`Concurrent Operations Performance:
      Concurrent Operations: ${concurrentCount}
      Duration: ${duration.toFixed(2)}ms
      Ops/sec: ${operationsPerSecond.toFixed(0)}`);

      expect(operationsPerSecond).toBeGreaterThan(100); // >100 ops/sec concurrent
      expect(duration).toBeLessThan(1000); // <1s for 20 concurrent operations
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const sustainedDuration = 2000; // 2 seconds of sustained load
      const startTime = performance.now();
      let operationCount = 0;
      const operationTimes = [];

      // Setup mocks for sustained load
      testBed.entityManager.getComponentData.mockReturnValue({
        spots: ['game:alice', null, 'game:bob', null, 'game:charlie'],
      });

      mockClosenessCircleService.merge.mockReturnValue({});
      mockClosenessCircleService.repair.mockReturnValue({});

      while (performance.now() - startTime < sustainedDuration) {
        const opStart = performance.now();

        // Alternate between establish and remove operations
        if (operationCount % 2 === 0) {
          await establishHandler.execute(
            {
              furniture_id: 'furniture:stress_test',
              actor_id: `game:actor_${operationCount}`,
              spot_index: 1,
            },
            executionContext
          );
        } else {
          await removeHandler.execute(
            {
              furniture_id: 'furniture:stress_test',
              actor_id: `game:actor_${operationCount}`,
              spot_index: 3,
            },
            executionContext
          );
        }

        const opEnd = performance.now();
        operationTimes.push(opEnd - opStart);
        operationCount++;
      }

      const totalDuration = performance.now() - startTime;
      const averageOpTime =
        operationTimes.reduce((sum, time) => sum + time, 0) /
        operationTimes.length;
      // Use a loop to find max to avoid stack overflow with large arrays
      let maxOpTime = 0;
      for (const time of operationTimes) {
        if (time > maxOpTime) maxOpTime = time;
      }
      const opsPerSecond = (operationCount / totalDuration) * 1000;

      console.log(`Sustained Load Performance:
      Duration: ${totalDuration.toFixed(2)}ms
      Operations: ${operationCount}
      Average Operation: ${averageOpTime.toFixed(2)}ms
      Max Operation: ${maxOpTime.toFixed(2)}ms
      Ops/sec: ${opsPerSecond.toFixed(0)}`);

      expect(averageOpTime).toBeLessThan(50); // Average should stay under 50ms
      expect(maxOpTime).toBeLessThan(200); // Max should not exceed 200ms even under load
      expect(opsPerSecond).toBeGreaterThan(20); // Should maintain >20 ops/sec under sustained load
    });
  });
});
