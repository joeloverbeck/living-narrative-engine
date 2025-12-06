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

const mkLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Filters outliers from an array of measurements using IQR method
 *
 * @param {number[]} measurements - Array of timing measurements
 * @returns {number[]} Filtered array without outliers
 */
function filterOutliers(measurements) {
  if (measurements.length < 3) {
    return measurements; // Can't filter outliers from small datasets
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  // Use a more conservative outlier threshold (2.0 instead of 1.5)
  const lowerBound = q1 - 2.0 * iqr;
  const upperBound = q3 + 2.0 * iqr;

  const filtered = measurements.filter(
    (m) => m >= lowerBound && m <= upperBound
  );

  // Ensure we keep at least 60% of the measurements
  if (filtered.length < measurements.length * 0.6) {
    return measurements; // Return original if too many outliers detected
  }

  return filtered.length > 0 ? filtered : measurements;
}

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
      for (let i = 0; i < 5; i++) {
        await commandProcessor.dispatchAction(mockActor, legacyAction);
      }

      const benchmark = performanceTracker.startBenchmark(
        'Legacy Action Performance'
      );

      const iterations = 25;
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
      for (let i = 0; i < 5; i++) {
        await commandProcessor.dispatchAction(mockActor, multiTargetAction);
      }

      const benchmark = performanceTracker.startBenchmark(
        'Multi-Target Action Performance'
      );

      const iterations = 25;
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
        'Complex Multi-Target Action'
      );

      const iterations = 15;
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
    it('should scale efficiently with target count', async () => {
      const targetCounts = [1, 5, 20];
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

        const iterations = 10;
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
          await commandProcessor.dispatchAction(mockActor, action);
        }

        const endTime = performance.now();
        benchmark.end(); // End benchmark tracking
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
    it('should handle mixed workload efficiently with sustained throughput', async () => {
      // Test both sustained load and mixed workload in one comprehensive test
      const workloadMix = [
        // 30% legacy single-target
        ...Array(15).fill({
          actionDefinitionId: 'mixed:legacy',
          commandString: 'mixed legacy',
          resolvedParameters: { targetId: 'target_123' },
        }),
        // 40% simple multi-target
        ...Array(20).fill({
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
        // 30% complex multi-target
        ...Array(15).fill({
          actionDefinitionId: 'mixed:complex',
          commandString: 'mixed complex',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              primary: ['p1'],
              secondary: ['s1'],
              item: ['i1'],
              tool: ['t1'],
            },
          },
        }),
      ];

      // Shuffle workload for realistic mixed pattern
      const shuffled = workloadMix.sort(() => Math.random() - 0.5);

      const benchmark = performanceTracker.startBenchmark(
        'Mixed Workload & Throughput Performance',
        {
          trackMemory: true,
        }
      );

      const startTime = performance.now();

      for (const action of shuffled) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      const endTime = performance.now();
      const metrics = benchmark.end();
      const totalDuration = endTime - startTime;
      const averageTime = metrics.totalTime / shuffled.length;
      const throughput = (shuffled.length / totalDuration) * 1000; // Actions per second

      // Test both average performance and overall throughput
      expect(averageTime).toBeLessThan(75); // Average should be reasonable for mixed workload
      expect(throughput).toBeGreaterThan(8); // At least 8 actions per second for mixed workload
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst load and recover gracefully', async () => {
      // Combined test: burst performance + recovery validation
      const normalAction = {
        actionDefinitionId: 'stress:normal',
        commandString: 'stress normal',
        resolvedParameters: { targetId: 'target_123' },
      };

      const spikeAction = {
        actionDefinitionId: 'stress:spike',
        commandString: 'stress spike',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [
              `target_${i}`,
              [`entity_${i}`],
            ])
          ),
        },
      };

      // Multiple baseline measurements for stability - increased from 3 to 5 samples
      const baselineMeasurements = [];
      for (let run = 0; run < 5; run++) {
        const baselineStart = performance.now();
        for (let i = 0; i < 5; i++) {
          await commandProcessor.dispatchAction(mockActor, normalAction);
        }
        const baselineAvg = (performance.now() - baselineStart) / 5;
        baselineMeasurements.push(baselineAvg);
      }

      // Filter outliers and use median baseline for stability
      const filteredBaseline = filterOutliers(baselineMeasurements);
      filteredBaseline.sort((a, b) => a - b);
      const stableBaseline =
        filteredBaseline[Math.floor(filteredBaseline.length / 2)]; // median

      // Validate baseline is reasonable (not too fast or too slow)
      expect(stableBaseline).toBeGreaterThan(0.001); // At least 0.001ms - sanity check
      expect(stableBaseline).toBeLessThan(200); // Less than 200ms - reasonable upper bound

      // Burst test with reduced size for faster execution
      const burstSize = 40;
      const responseTimes = [];

      for (let i = 0; i < burstSize; i++) {
        const startTime = performance.now();
        await commandProcessor.dispatchAction(mockActor, normalAction);
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      }

      // Calculate percentiles for burst performance
      responseTimes.sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(burstSize * 0.5)];
      const p95 = responseTimes[Math.floor(burstSize * 0.95)];

      // Cause performance spike
      await commandProcessor.dispatchAction(mockActor, spikeAction);

      // Multiple recovery measurements for reliability - increased from 3 to 5 samples
      const recoveryMeasurements = [];
      for (let run = 0; run < 5; run++) {
        const recoveryStart = performance.now();
        for (let i = 0; i < 5; i++) {
          await commandProcessor.dispatchAction(mockActor, normalAction);
        }
        const recoveryAvg = (performance.now() - recoveryStart) / 5;
        recoveryMeasurements.push(recoveryAvg);
      }

      // Filter outliers and use median recovery time for stability
      const filteredRecovery = filterOutliers(recoveryMeasurements);
      filteredRecovery.sort((a, b) => a - b);
      const stableRecovery =
        filteredRecovery[Math.floor(filteredRecovery.length / 2)]; // median

      // Validate burst performance
      expect(p50).toBeLessThan(50); // Median should be fast
      expect(p95).toBeLessThan(100); // 95th percentile reasonable

      // Validate recovery performance with environment-aware multiplier
      // CI environments can be 5x slower due to resource constraints and higher variance
      const isCI = !!(
        process.env.CI ||
        process.env.GITHUB_ACTIONS ||
        process.env.GITLAB_CI
      );
      const recoveryMultiplier = isCI ? 5 : 4; // More lenient multipliers for stability

      expect(stableRecovery).toBeLessThan(stableBaseline * recoveryMultiplier);

      // Additional validation: recovery should be reasonable in absolute terms
      expect(stableRecovery).toBeLessThan(200); // 200ms absolute maximum (increased for stability)
    });
  });

  describe('Performance Metrics Accuracy', () => {
    it('should accurately track performance statistics', async () => {
      // Reset statistics
      commandProcessor.resetPayloadCreationStatistics();

      const testActions = [
        // 3 legacy actions
        ...Array(3).fill({
          actionDefinitionId: 'metrics:legacy',
          commandString: 'metrics legacy',
          resolvedParameters: { targetId: 'target_123' },
        }),
        // 2 multi-target actions
        ...Array(2).fill({
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

      expect(stats.totalPayloadsCreated).toBe(5);
      expect(stats.legacyPayloads).toBe(3);
      expect(stats.multiTargetPayloads).toBe(2);
      expect(stats.fallbackPayloads).toBe(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
      expect(stats.averageCreationTime).toBeLessThan(100); // Should be reasonable
    });
  });
});
