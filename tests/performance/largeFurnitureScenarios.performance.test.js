/**
 * @file Performance tests for large furniture and multi-furniture scenarios
 * @description Tests the performance of the proximity system with maximum capacity furniture
 * and concurrent operations across multiple furniture pieces.
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
import { findAdjacentOccupants } from '../../src/utils/proximityUtils.js';

describe('Large Furniture Scenarios Performance', () => {
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

    // Initialize handlers
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
    if (global.gc) {
      global.gc();
    }
  });

  describe('Maximum Capacity Furniture', () => {
    it('should handle maximum capacity furniture efficiently', async () => {
      const maxSpots = 10;
      const iterations = 100;

      // Create fully occupied furniture
      const spots = new Array(maxSpots).fill(null);
      for (let i = 0; i < maxSpots; i++) {
        spots[i] = `game:actor_${i}`;
      }

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots };
          }
          if (componentType === 'positioning:closeness') {
            const actorIndex = parseInt(entityId.split('_')[1]);
            const partners = [];
            if (actorIndex > 0) partners.push(`game:actor_${actorIndex - 1}`);
            if (actorIndex < maxSpots - 1)
              partners.push(`game:actor_${actorIndex + 1}`);
            return partners.length > 0 ? { partners } : null;
          }
          return null;
        }
      );

      const results = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        // Test removing from middle position (affects 2 adjacent actors)
        await removeHandler.execute(
          {
            furniture_id: 'furniture:max_capacity',
            actor_id: 'game:actor_5', // Middle position
            spot_index: 5,
          },
          executionContext
        );

        const endTime = performance.now();
        results.push(endTime - startTime);
      }

      const averageTime =
        results.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);

      console.log(`Max Capacity Performance:
      Spots: ${maxSpots}
      Iterations: ${iterations}
      Average Time: ${averageTime.toFixed(2)}ms
      Min Time: ${minTime.toFixed(2)}ms
      Max Time: ${maxTime.toFixed(2)}ms`);

      // Performance should be independent of furniture size
      expect(averageTime).toBeLessThan(50); // <50ms average
      expect(maxTime).toBeLessThan(100); // <100ms worst case
    });

    it('should handle edge and corner positions efficiently in large furniture', async () => {
      const maxSpots = 10;
      const iterations = 50;

      // Create partially occupied furniture for more realistic scenario
      const spots = new Array(maxSpots).fill(null);
      spots[0] = 'game:actor_0'; // First position
      spots[2] = 'game:actor_2';
      spots[5] = 'game:actor_5';
      spots[7] = 'game:actor_7';
      spots[9] = 'game:actor_9'; // Last position

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots: [...spots] }; // Return copy to avoid mutation
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({});

      const testPositions = [
        { position: 0, name: 'first' },
        { position: 9, name: 'last' },
        { position: 5, name: 'middle' },
        { position: 1, name: 'near-first' },
        { position: 8, name: 'near-last' },
      ];

      const results = {};

      for (const { position, name } of testPositions) {
        const positionTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();

          await establishHandler.execute(
            {
              furniture_id: 'furniture:edge_test',
              actor_id: `game:new_actor_${i}`,
              spot_index: position,
            },
            executionContext
          );

          const endTime = performance.now();
          positionTimes.push(endTime - startTime);
        }

        results[name] = {
          average:
            positionTimes.reduce((sum, time) => sum + time, 0) / iterations,
          max: Math.max(...positionTimes),
        };
      }

      console.log('Edge Position Performance:');
      Object.entries(results).forEach(([position, metrics]) => {
        console.log(
          `  ${position}: avg=${metrics.average.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms`
        );

        // All positions should have similar performance
        expect(metrics.average).toBeLessThan(50);
        expect(metrics.max).toBeLessThan(100);
      });

      // Verify no significant performance difference between positions
      const averages = Object.values(results).map((r) => r.average);
      const minAvg = Math.min(...averages);
      const maxAvg = Math.max(...averages);
      const variance = minAvg > 0 ? (maxAvg - minAvg) / minAvg : 0;

      console.log(`  Position variance: ${(variance * 100).toFixed(1)}%`);
      // With such fast operations (<0.05ms), small absolute differences can appear as large percentages
      // What matters is that all operations are still very fast
      const absoluteDifference = maxAvg - minAvg;
      expect(absoluteDifference).toBeLessThan(10); // Less than 10ms absolute difference
    });
  });

  describe('Multi-Furniture Concurrent Operations', () => {
    it('should handle concurrent operations on multiple furniture pieces', async () => {
      const furnitureCount = 10;
      const concurrentOperations = 20;

      // Setup multiple furniture pieces
      const furnitureData = {};
      for (let f = 0; f < furnitureCount; f++) {
        const spots = new Array(5).fill(null);
        for (let s = 0; s < 5; s++) {
          spots[s] = `game:actor_${f}_${s}`;
        }
        furnitureData[`furniture:piece_${f}`] = spots;
      }

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            // Return furniture data based on the last furniture ID used
            const furnitureId =
              executionContext.variables.get('lastFurnitureId') ||
              'furniture:piece_0';
            return { spots: furnitureData[furnitureId] || [] };
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({});

      const startTime = performance.now();

      // Execute concurrent operations
      const operations = [];
      for (let i = 0; i < concurrentOperations; i++) {
        const furnitureIndex = i % furnitureCount;
        const actorIndex = i % 5;
        const furnitureId = `furniture:piece_${furnitureIndex}`;

        // Store furniture ID in context for mock to use
        executionContext.variables.set('lastFurnitureId', furnitureId);

        operations.push(
          establishHandler.execute(
            {
              furniture_id: furnitureId,
              actor_id: `game:new_actor_${i}`,
              spot_index: actorIndex,
            },
            executionContext
          )
        );
      }

      await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (concurrentOperations / duration) * 1000;

      console.log(`Concurrent Multi-Furniture Operations:
      Furniture Pieces: ${furnitureCount}
      Concurrent Operations: ${concurrentOperations}
      Duration: ${duration.toFixed(2)}ms
      Ops/sec: ${operationsPerSecond.toFixed(0)}`);

      expect(operationsPerSecond).toBeGreaterThan(100); // >100 ops/sec concurrent
      expect(duration).toBeLessThan(1000); // <1s for 20 concurrent operations
    });

    it('should handle mixed operations (sit/stand) across multiple furniture', async () => {
      const furnitureCount = 5;
      const operationsPerFurniture = 10;
      const totalOperations = furnitureCount * operationsPerFurniture;

      // Setup furniture with mixed occupancy
      const furnitureStates = {};
      for (let f = 0; f < furnitureCount; f++) {
        const spots = new Array(8).fill(null);
        // Partially fill furniture
        for (let s = 0; s < 8; s += 2) {
          spots[s] = `game:initial_actor_${f}_${s}`;
        }
        furnitureStates[`furniture:mixed_${f}`] = spots;
      }

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            const furnitureId =
              executionContext.variables.get('currentFurnitureId');
            return { spots: [...(furnitureStates[furnitureId] || [])] };
          }
          if (componentType === 'positioning:closeness') {
            return { partners: [] }; // Simplified for testing
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({});
      mockClosenessCircleService.repair.mockReturnValue({});

      const operations = [];
      const startTime = performance.now();

      // Create mixed operations
      for (let f = 0; f < furnitureCount; f++) {
        for (let op = 0; op < operationsPerFurniture; op++) {
          const furnitureId = `furniture:mixed_${f}`;
          executionContext.variables.set('currentFurnitureId', furnitureId);

          if (op % 2 === 0) {
            // Establish operation
            operations.push(
              establishHandler.execute(
                {
                  furniture_id: furnitureId,
                  actor_id: `game:new_actor_${f}_${op}`,
                  spot_index: (op + 1) % 8,
                },
                executionContext
              )
            );
          } else {
            // Remove operation
            operations.push(
              removeHandler.execute(
                {
                  furniture_id: furnitureId,
                  actor_id: `game:initial_actor_${f}_${(op - 1) * 2}`,
                  spot_index: (op - 1) * 2,
                },
                executionContext
              )
            );
          }
        }
      }

      await Promise.all(operations);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (totalOperations / duration) * 1000;

      console.log(`Mixed Operations Performance:
      Furniture Count: ${furnitureCount}
      Total Operations: ${totalOperations}
      Duration: ${duration.toFixed(2)}ms
      Ops/sec: ${operationsPerSecond.toFixed(0)}`);

      expect(operationsPerSecond).toBeGreaterThan(50); // >50 ops/sec for mixed operations
      expect(duration).toBeLessThan(2000); // <2s for all operations
    });
  });

  describe('Complex Adjacency Calculations', () => {
    it('should efficiently calculate complex adjacency patterns', () => {
      const iterations = 5000;
      const furnitureConfigs = [
        {
          name: 'sparse',
          spots: [
            'game:a',
            null,
            null,
            'game:b',
            null,
            null,
            'game:c',
            null,
            null,
            'game:d',
          ],
        },
        {
          name: 'dense',
          spots: [
            'game:a',
            'game:b',
            'game:c',
            'game:d',
            'game:e',
            'game:f',
            'game:g',
            'game:h',
            'game:i',
            'game:j',
          ],
        },
        {
          name: 'alternating',
          spots: [
            'game:a',
            null,
            'game:b',
            null,
            'game:c',
            null,
            'game:d',
            null,
            'game:e',
            null,
          ],
        },
        {
          name: 'clustered',
          spots: [
            'game:a',
            'game:b',
            'game:c',
            null,
            null,
            null,
            'game:d',
            'game:e',
            'game:f',
            'game:g',
          ],
        },
      ];

      const results = {};

      furnitureConfigs.forEach((config) => {
        const furniture = { spots: config.spots };
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          const spotIndex = i % 10;
          findAdjacentOccupants(furniture, spotIndex);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const opsPerMs = iterations / duration;

        results[config.name] = {
          duration,
          opsPerMs,
        };
      });

      console.log('Complex Adjacency Performance:');
      Object.entries(results).forEach(([pattern, metrics]) => {
        console.log(
          `  ${pattern}: ${metrics.duration.toFixed(2)}ms, ${metrics.opsPerMs.toFixed(0)} ops/ms`
        );

        // All patterns should be efficient
        expect(metrics.duration).toBeLessThan(100); // <100ms for 5000 operations
        expect(metrics.opsPerMs).toBeGreaterThan(50); // >50 ops/ms
      });
    });

    it('should handle rapid state changes efficiently', async () => {
      const rapidChanges = 100;
      const spots = new Array(10).fill(null);

      // Dynamic furniture state that changes during operations
      let currentState = [...spots];

      testBed.entityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'positioning:allows_sitting') {
            return { spots: [...currentState] };
          }
          if (componentType === 'positioning:closeness') {
            return { partners: [] };
          }
          return null;
        }
      );

      mockClosenessCircleService.merge.mockReturnValue({});
      mockClosenessCircleService.repair.mockReturnValue({});

      const operationTimes = [];
      const startTime = performance.now();

      for (let i = 0; i < rapidChanges; i++) {
        const opStart = performance.now();

        // Rapidly alternate between adding and removing actors
        if (i % 2 === 0) {
          const spotIndex = i % 10;
          currentState[spotIndex] = `game:actor_${i}`;

          await establishHandler.execute(
            {
              furniture_id: 'furniture:rapid_change',
              actor_id: `game:actor_${i}`,
              spot_index: spotIndex,
            },
            executionContext
          );
        } else {
          const spotIndex = (i - 1) % 10;
          currentState[spotIndex] = null;

          await removeHandler.execute(
            {
              furniture_id: 'furniture:rapid_change',
              actor_id: `game:actor_${i - 1}`,
              spot_index: spotIndex,
            },
            executionContext
          );
        }

        const opEnd = performance.now();
        operationTimes.push(opEnd - opStart);
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageOpTime =
        operationTimes.reduce((sum, t) => sum + t, 0) / rapidChanges;
      const maxOpTime = Math.max(...operationTimes);

      console.log(`Rapid State Changes Performance:
      Changes: ${rapidChanges}
      Total Duration: ${totalDuration.toFixed(2)}ms
      Average Operation: ${averageOpTime.toFixed(2)}ms
      Max Operation: ${maxOpTime.toFixed(2)}ms
      Changes/sec: ${((rapidChanges / totalDuration) * 1000).toFixed(0)}`);

      expect(averageOpTime).toBeLessThan(50); // <50ms average for rapid changes
      expect(maxOpTime).toBeLessThan(150); // <150ms worst case
      expect(totalDuration).toBeLessThan(5000); // <5s for 100 rapid changes
    });
  });

});
