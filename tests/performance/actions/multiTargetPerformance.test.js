/**
 * @file Performance tests for multi-target action processing
 * @description Integration tests for performance characteristics and regression prevention
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { performance } from 'perf_hooks';

describe('Multi-Target Performance', () => {
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Large Target Set Performance', () => {
    it('should handle 50+ targets within performance bounds', async () => {
      const targetManager = new TargetManager({ logger });
      const startTime = Date.now();

      // Add many targets
      for (let i = 0; i < 50; i++) {
        targetManager.addTarget(`slot${i}`, `entity_${i}`);
      }

      const setupTime = Date.now() - startTime;
      expect(setupTime).toBeLessThan(50); // Should be fast

      // Validate all targets
      const validationStart = Date.now();
      const validation = targetManager.validate();
      const validationTime = Date.now() - validationStart;

      expect(validation.isValid).toBe(true);
      expect(validationTime).toBeLessThan(20); // Validation should be very fast
    });

    it('should maintain O(1) lookup performance', async () => {
      const targetManager = new TargetManager({ logger });

      // Add targets
      for (let i = 0; i < 100; i++) {
        targetManager.addTarget(`target${i}`, `entity_${i}`);
      }

      // Time individual lookups
      const lookupTimes = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        targetManager.getEntityIdByPlaceholder(`target${i}`);
        lookupTimes.push(performance.now() - start);
      }

      // All lookups should be consistently fast
      const avgTime = lookupTimes.reduce((a, b) => a + b) / lookupTimes.length;
      const maxTime = Math.max(...lookupTimes);
      
      // Calculate percentile for robustness against system variance
      const sortedTimes = lookupTimes.slice().sort((a, b) => a - b);
      const p90Time = sortedTimes[Math.floor(0.9 * sortedTimes.length)];

      expect(avgTime).toBeLessThan(0.1); // Sub-millisecond average
      expect(p90Time).toBeLessThan(1); // 90% of lookups under 1ms  
      expect(maxTime).toBeLessThan(5); // Allow for system variance/GC
    });

    it('should efficiently handle very large target sets (100+ targets)', async () => {
      const targetManager = new TargetManager({ logger });
      const targetCount = 150;

      const startTime = performance.now();

      // Create large target set
      const targets = {};
      for (let i = 0; i < targetCount; i++) {
        targets[`target${i}`] = `entity_${i}`;
      }

      // Batch set targets
      targetManager.setTargets(targets);

      const setupTime = performance.now() - startTime;
      expect(setupTime).toBeLessThan(100); // Should handle batch operations efficiently

      // Verify target count
      expect(targetManager.getTargetCount()).toBe(targetCount);

      // Test random access performance
      const randomAccessStart = performance.now();
      for (let i = 0; i < 50; i++) {
        const randomIndex = Math.floor(Math.random() * targetCount);
        const result = targetManager.getEntityIdByPlaceholder(
          `target${randomIndex}`
        );
        expect(result).toBe(`entity_${randomIndex}`);
      }
      const randomAccessTime = performance.now() - randomAccessStart;

      expect(randomAccessTime).toBeLessThan(200); // Random access should be reasonably fast
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const iterations = 1000;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const targetManager = new TargetManager({ logger });

        // Add and remove targets
        targetManager.setTargets({
          primary: 'entity_001',
          secondary: 'entity_002',
          tertiary: 'entity_003',
        });

        targetManager.validate();
        targetManager.toJSON();

        // Clear references
        targetManager.setTargets({});
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Should not grow significantly (allow 10MB for test overhead)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('should efficiently handle target manager cloning', async () => {
      const targetManager = new TargetManager({ logger });

      // Add many targets
      for (let i = 0; i < 50; i++) {
        targetManager.addTarget(`slot${i}`, `entity_${i}`);
      }

      const cloneStart = performance.now();

      // Simulate cloning via JSON serialization
      const serialized = targetManager.toJSON();
      const cloned = new TargetManager({
        targets: serialized.targets,
        primaryTarget: serialized.primaryTarget,
        logger,
      });

      const cloneTime = performance.now() - cloneStart;

      expect(cloneTime).toBeLessThan(10); // Cloning should be fast
      expect(cloned.getTargetCount()).toBe(targetManager.getTargetCount());
      expect(cloned.getPrimaryTarget()).toBe(targetManager.getPrimaryTarget());
    });
  });

  describe('Operation Performance Benchmarks', () => {
    it('should perform target operations within expected time bounds', async () => {
      const targetManager = new TargetManager({ logger });
      const operations = [];

      // Benchmark: addTarget
      const addTargetStart = performance.now();
      for (let i = 0; i < 100; i++) {
        targetManager.addTarget(`target${i}`, `entity_${i}`);
      }
      operations.push({
        name: 'addTarget (100x)',
        time: performance.now() - addTargetStart,
      });

      // Benchmark: getTargetNames
      const getTargetNamesStart = performance.now();
      for (let i = 0; i < 100; i++) {
        targetManager.getTargetNames();
      }
      operations.push({
        name: 'getTargetNames (100x)',
        time: performance.now() - getTargetNamesStart,
      });

      // Benchmark: getEntityIds
      const getEntityIdsStart = performance.now();
      for (let i = 0; i < 100; i++) {
        targetManager.getEntityIds();
      }
      operations.push({
        name: 'getEntityIds (100x)',
        time: performance.now() - getEntityIdsStart,
      });

      // Benchmark: validate
      const validateStart = performance.now();
      for (let i = 0; i < 100; i++) {
        targetManager.validate();
      }
      operations.push({
        name: 'validate (100x)',
        time: performance.now() - validateStart,
      });

      // All operations should be performant
      operations.forEach((op) => {
        expect(op.time).toBeLessThan(50); // 50ms for 100 operations
      });
    });

    it('should handle concurrent target updates efficiently', async () => {
      const targetManager = new TargetManager({ logger });
      const updateCount = 500;

      const startTime = performance.now();

      // Simulate rapid concurrent-like updates
      const promises = [];
      for (let i = 0; i < updateCount; i++) {
        // Simulate async operations
        promises.push(
          Promise.resolve().then(() => {
            if (i % 2 === 0) {
              targetManager.addTarget(`target${i}`, `entity_${i}`);
            } else {
              targetManager.setTargets({
                [`batch${i}`]: `entity_${i}`,
              });
            }
          })
        );
      }

      await Promise.all(promises);

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(100); // Should handle rapid updates efficiently

      // Verify final state is consistent
      const validation = targetManager.validate();
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Scaling Characteristics', () => {
    it('should scale linearly with target count', async () => {
      const measurements = [];

      for (const targetCount of [10, 50, 100, 200]) {
        const targetManager = new TargetManager({ logger });

        const startTime = performance.now();

        // Add targets
        for (let i = 0; i < targetCount; i++) {
          targetManager.addTarget(`target${i}`, `entity_${i}`);
        }

        // Perform operations
        targetManager.validate();
        targetManager.getTargetNames();
        targetManager.getEntityIds();

        const totalTime = performance.now() - startTime;

        measurements.push({
          count: targetCount,
          time: totalTime,
          timePerTarget: totalTime / targetCount,
        });
      }

      // Verify approximately linear scaling
      const timePerTargetVariance =
        Math.max(...measurements.map((m) => m.timePerTarget)) -
        Math.min(...measurements.map((m) => m.timePerTarget));

      expect(timePerTargetVariance).toBeLessThan(0.5); // Should not vary much
    });

    it('should maintain performance with mixed operations', async () => {
      const targetManager = new TargetManager({ logger });
      const operationCount = 200;

      const startTime = performance.now();

      for (let i = 0; i < operationCount; i++) {
        const operation = i % 4;

        switch (operation) {
          case 0:
            targetManager.addTarget(`target${i}`, `entity_${i}`);
            break;
          case 1:
            targetManager.getEntityIdByPlaceholder(
              `target${Math.floor(i / 2)}`
            );
            break;
          case 2:
            if (i > 10) {
              targetManager.validate();
            }
            break;
          case 3:
            if (i % 20 === 0) {
              targetManager.setTargets({});
            }
            break;
        }
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(50); // Mixed operations should remain fast
    });
  });

  describe('Performance Regression Guards', () => {
    it('should detect performance degradation in critical paths', async () => {
      const criticalOperations = [
        {
          name: 'Single target lookup',
          operation: (tm) => tm.getEntityIdByPlaceholder('primary'),
          maxTime: 0.5,
        },
        {
          name: 'Primary target determination',
          operation: (tm) => tm.getPrimaryTarget(),
          maxTime: 0.5,
        },
        {
          name: 'Target count check',
          operation: (tm) => tm.getTargetCount(),
          maxTime: 0.1,
        },
        {
          name: 'Multi-target check',
          operation: (tm) => tm.isMultiTarget(),
          maxTime: 0.1,
        },
      ];

      const targetManager = new TargetManager({ logger });
      targetManager.setTargets({
        primary: 'entity_001',
        secondary: 'entity_002',
        tertiary: 'entity_003',
      });

      criticalOperations.forEach(({ operation, maxTime }) => {
        const times = [];

        // Run multiple times to get average
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          operation(targetManager);
          times.push(performance.now() - start);
        }

        const avgTime = times.reduce((a, b) => a + b) / times.length;
        expect(avgTime).toBeLessThan(maxTime);
      });
    });

    it('should maintain performance under stress conditions', async () => {
      const stressIterations = 50;
      const targetManagers = [];

      const startTime = performance.now();

      // Create multiple target managers with different configurations
      for (let i = 0; i < stressIterations; i++) {
        const tm = new TargetManager({ logger });

        // Vary the number of targets
        const targetCount = Math.floor(Math.random() * 20) + 1;
        for (let j = 0; j < targetCount; j++) {
          tm.addTarget(`target${j}`, `entity_${i}_${j}`);
        }

        targetManagers.push(tm);
      }

      // Perform operations on all managers
      targetManagers.forEach((tm) => {
        tm.validate();
        tm.getTargetNames();
        tm.toJSON();
      });

      const totalTime = performance.now() - startTime;
      const avgTimePerManager = totalTime / stressIterations;

      expect(avgTimePerManager).toBeLessThan(5); // Should handle stress efficiently
    });
  });
});
