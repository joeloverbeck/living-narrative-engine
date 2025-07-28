/**
 * @file Performance benchmark tests for CommandProcessor
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createPerformanceTestBed } from '../common/performanceTestBed.js';
import CommandProcessor from '../../src/commands/commandProcessor.js';
import { safeDispatchError } from '../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('CommandProcessor - Performance Benchmarks', () => {
  let performanceTestBed;
  let performanceTracker;
  let commandProcessor;
  let mockActor;
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;

  beforeEach(() => {
    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();

    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
    });

    mockActor = { id: 'perf_actor_123', name: 'Performance Actor' };

    jest.clearAllMocks();
  });

  afterEach(() => {
    performanceTestBed.cleanup();
  });

  describe('Payload Creation Performance', () => {
    it('should meet performance targets for legacy actions', async () => {
      const legacyAction = {
        actionDefinitionId: 'perf:legacy',
        commandString: 'performance test legacy',
        resolvedParameters: { targetId: 'target_123' },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const benchmark = performanceTracker.startBenchmark(
        'Legacy Action Performance',
        {
          trackMemory: true,
        }
      );

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(50); // 50ms mean
      expect(metrics.totalTime).toBeLessThan(5000); // Total time under 5 seconds
    });

    it('should meet performance targets for multi-target actions', async () => {
      const multiTargetAction = {
        actionDefinitionId: 'perf:multi',
        commandString: 'performance test multi-target',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            item: ['item_123'],
            target: ['target_456'],
            tool: ['tool_789'],
          },
        },
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, multiTargetAction);
      }

      const benchmark = performanceTracker.startBenchmark(
        'Multi-Target Action Performance',
        {
          trackMemory: true,
        }
      );

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, multiTargetAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(75); // 75ms mean for multi-target
      expect(metrics.totalTime).toBeLessThan(7500); // Total time under 7.5 seconds
    });

    it('should handle complex multi-target scenarios efficiently', async () => {
      const complexAction = {
        actionDefinitionId: 'perf:complex',
        commandString: 'complex performance test action',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary_target: ['primary_123'],
            secondary_target: ['secondary_456'],
            weapon: ['sword_789', 'axe_012'], // Multiple options
            tool: ['shield_345'],
            consumable: ['potion_678'],
            location: ['room_901'],
            container: ['chest_234'],
            ally: ['ally_567'],
          },
        },
      };

      const benchmark = performanceTracker.startBenchmark(
        'Complex Multi-Target Action',
        {
          trackMemory: true,
        }
      );

      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, complexAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(100); // 100ms mean for complex
      expect(metrics.totalTime).toBeLessThan(5000); // Total time under 5 seconds
    });
  });

  describe('Comparative Performance Analysis', () => {
    it('should not degrade legacy performance significantly', async () => {
      const legacyAction = {
        actionDefinitionId: 'compare:legacy',
        commandString: 'comparison test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const benchmark = performanceTracker.startBenchmark(
        'Enhanced Legacy Performance'
      );
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const averageTime = (endTime - startTime) / iterations;

      // The enhanced system should maintain reasonable performance
      expect(averageTime).toBeLessThan(50); // Should be fast
    });

    it('should scale efficiently with target count', async () => {
      const targetCounts = [1, 2, 5, 10, 20];
      const results = [];

      for (const count of targetCounts) {
        const targetIds = {};
        for (let i = 1; i <= count; i++) {
          targetIds[`target_${i}`] = [`entity_${i}`];
        }

        const action = {
          actionDefinitionId: 'scale:test',
          commandString: `scaling test with ${count} targets`,
          resolvedParameters: {
            isMultiTarget: count > 1,
            targetIds: count > 1 ? targetIds : undefined,
            targetId: count === 1 ? 'entity_1' : undefined,
          },
        };

        const benchmark = performanceTracker.startBenchmark(
          `Scaling Test - ${count} targets`
        );

        const iterations = 20;
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          await commandProcessor.dispatchAction(mockActor, action);
        }

        const endTime = performance.now();
        const metrics = benchmark.end();
        const averageTime = (endTime - startTime) / iterations;

        results.push({
          targetCount: count,
          meanTime: averageTime,
        });
      }

      // Verify scaling is reasonable
      for (const result of results) {
        expect(result.meanTime).toBeLessThan(result.targetCount * 50); // Reasonable scaling
      }
    });
  });


  describe('Throughput Analysis', () => {
    it('should maintain high throughput under sustained load', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = performance.now();
      let actionCount = 0;

      const actions = [
        {
          actionDefinitionId: 'throughput:legacy',
          commandString: 'throughput test legacy',
          resolvedParameters: { targetId: 'target_123' },
        },
        {
          actionDefinitionId: 'throughput:multi',
          commandString: 'throughput test multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
            },
          },
        },
      ];

      while (performance.now() - startTime < testDuration) {
        const action = actions[actionCount % actions.length];
        await commandProcessor.dispatchAction(mockActor, action);
        actionCount++;
      }

      const actualDuration = performance.now() - startTime;
      const throughput = (actionCount / actualDuration) * 1000; // Actions per second

      expect(throughput).toBeGreaterThan(10); // At least 10 actions per second
    });

    it('should handle mixed workload efficiently', async () => {
      const workloadMix = [
        // 40% legacy single-target
        ...Array(40).fill({
          actionDefinitionId: 'mixed:legacy',
          commandString: 'mixed legacy',
          resolvedParameters: { targetId: 'target_123' },
        }),
        // 40% simple multi-target
        ...Array(40).fill({
          actionDefinitionId: 'mixed:multi',
          commandString: 'mixed multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
            },
          },
        }),
        // 20% complex multi-target
        ...Array(20).fill({
          actionDefinitionId: 'mixed:complex',
          commandString: 'mixed complex',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              primary: ['p1'],
              secondary: ['s1'],
              item: ['i1'],
              tool: ['t1'],
              location: ['l1'],
            },
          },
        }),
      ];

      // Shuffle workload
      const shuffled = workloadMix.sort(() => Math.random() - 0.5);

      const benchmark = performanceTracker.startBenchmark(
        'Mixed Workload Performance',
        {
          trackMemory: true,
        }
      );

      const startTime = performance.now();

      for (const action of shuffled) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      const metrics = benchmark.end();
      const averageTime = metrics.totalTime / shuffled.length;

      expect(averageTime).toBeLessThan(75); // Average should be reasonable for mixed workload
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid-fire burst without degradation', async () => {
      const burstSize = 100;
      const burstAction = {
        actionDefinitionId: 'burst:test',
        commandString: 'burst test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const responseTimes = [];

      for (let i = 0; i < burstSize; i++) {
        const startTime = performance.now();
        await commandProcessor.dispatchAction(mockActor, burstAction);
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      }

      // Calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(burstSize * 0.5)];
      const p95 = responseTimes[Math.floor(burstSize * 0.95)];
      const p99 = responseTimes[Math.floor(burstSize * 0.99)];

      expect(p50).toBeLessThan(50); // Median should be fast
      expect(p95).toBeLessThan(100); // 95th percentile reasonable
      expect(p99).toBeLessThan(200); // 99th percentile acceptable
    });

    it('should recover from performance spike', async () => {
      const normalAction = {
        actionDefinitionId: 'normal:test',
        commandString: 'normal test',
        resolvedParameters: { targetId: 'target_123' },
      };

      const spikeAction = {
        actionDefinitionId: 'spike:test',
        commandString: 'spike test',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `target_${i}`,
              [`entity_${i}`],
            ])
          ),
        },
      };

      // Baseline performance
      const baselineStart = performance.now();
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, normalAction);
      }
      const baselineAvg = (performance.now() - baselineStart) / 10;

      // Cause spike
      await commandProcessor.dispatchAction(mockActor, spikeAction);

      // Measure recovery
      const recoveryStart = performance.now();
      for (let i = 0; i < 10; i++) {
        await commandProcessor.dispatchAction(mockActor, normalAction);
      }
      const recoveryAvg = (performance.now() - recoveryStart) / 10;

      // Recovery performance should be close to baseline
      expect(recoveryAvg).toBeLessThan(baselineAvg * 2); // Within 2x of baseline
    });
  });

  describe('Performance Metrics Accuracy', () => {
    it('should accurately track performance statistics', async () => {
      // Reset statistics
      commandProcessor.resetPayloadCreationStatistics();

      const testActions = [
        // 10 legacy actions
        ...Array(10).fill({
          actionDefinitionId: 'metrics:legacy',
          commandString: 'metrics legacy',
          resolvedParameters: { targetId: 'target_123' },
        }),
        // 5 multi-target actions
        ...Array(5).fill({
          actionDefinitionId: 'metrics:multi',
          commandString: 'metrics multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
            },
          },
        }),
      ];

      for (const action of testActions) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      const stats = commandProcessor.getPayloadCreationStatistics();

      expect(stats.totalPayloadsCreated).toBe(15);
      expect(stats.legacyPayloads).toBe(10);
      expect(stats.multiTargetPayloads).toBe(5);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
      expect(stats.averageCreationTime).toBeLessThan(100); // Should be reasonable
    });
  });
});
