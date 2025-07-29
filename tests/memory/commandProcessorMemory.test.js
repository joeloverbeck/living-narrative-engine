/**
 * @file Memory tests for CommandProcessor
 * @description Tests memory usage patterns and leak detection for command processing
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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

describe('CommandProcessor - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let commandProcessor;
  let mockActor;
  let logger;
  let safeEventDispatcher;
  let eventDispatchService;

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();

    logger = mkLogger();
    safeEventDispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    eventDispatchService = {
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
    };

    commandProcessor = new CommandProcessor({
      logger,
      safeEventDispatcher,
      eventDispatchService,
      traceContext: null,
    });

    mockActor = {
      id: 'test-actor',
      name: 'Test Actor',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockReturnValue({}),
      getAllComponents: jest.fn().mockReturnValue(new Map()),
    };
  });

  afterEach(async () => {
    // Clean up references
    commandProcessor = null;
    mockActor = null;
    logger = null;
    safeEventDispatcher = null;
    eventDispatchService = null;

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during extended operation', async () => {
      const actionCount = global.memoryTestUtils.isCI() ? 800 : 1000;
      const cycleCount = global.memoryTestUtils.isCI() ? 8 : 10;

      const actions = [
        {
          actionDefinitionId: 'memory:legacy',
          commandString: 'memory test legacy',
          resolvedParameters: { targetId: 'target_123' },
        },
        {
          actionDefinitionId: 'memory:multi',
          commandString: 'memory test multi',
          resolvedParameters: {
            isMultiTarget: true,
            targetIds: {
              item: ['item_123'],
              target: ['target_456'],
              tool: ['tool_789'],
            },
          },
        },
      ];

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const initialMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Run many operations to test for memory leaks
      for (let cycle = 0; cycle < cycleCount; cycle++) {
        for (let i = 0; i < actionCount / cycleCount; i++) {
          const action = actions[i % actions.length];
          await commandProcessor.dispatchAction(mockActor, action);
        }

        // Periodic garbage collection
        if (global.gc && cycle % 2 === 0) {
          await global.memoryTestUtils.forceGCAndWait();
        }
      }

      // Final garbage collection and stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const memoryIncrease = Math.max(0, finalMemory - initialMemory);
      const memoryIncreaseKB = memoryIncrease / 1024;
      const memoryIncreaseMB = memoryIncreaseKB / 1024;

      // Use environment-appropriate threshold
      const thresholdMB = global.memoryTestUtils.isCI() ? 15 : 10; // More lenient in CI
      const thresholdBytes =
        global.memoryTestUtils.getMemoryThreshold(thresholdMB);

      console.log(
        `Memory test: Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Increase: ${memoryIncreaseMB.toFixed(2)}MB (threshold: ${thresholdMB}MB)`
      );

      // Should not increase memory significantly
      expect(memoryIncrease).toBeLessThan(thresholdBytes);
    });

    it('should release memory when processing completes', async () => {
      const operationCount = global.memoryTestUtils.isCI() ? 50 : 100;

      // Establish baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Perform operations
      const action = {
        actionDefinitionId: 'memory:test',
        commandString: 'memory test',
        resolvedParameters: { targetId: 'target_123' },
      };

      for (let i = 0; i < operationCount; i++) {
        await commandProcessor.dispatchAction(mockActor, action);
      }

      // Allow for memory cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const memoryDifference = Math.abs(finalMemory - baselineMemory);
      const thresholdBytes = global.memoryTestUtils.getMemoryThreshold(5); // 5MB threshold

      console.log(
        `Memory cleanup test: Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Difference: ${(memoryDifference / 1024 / 1024).toFixed(2)}MB`
      );

      // Memory should return close to baseline
      expect(memoryDifference).toBeLessThan(thresholdBytes);
    });
  });

  describe('Memory Efficiency', () => {
    it('should have predictable memory usage per operation', async () => {
      const operationBatches = [10, 50, 100];
      const memoryPerOperation = [];

      for (const batchSize of operationBatches) {
        await global.memoryTestUtils.forceGCAndWait();
        const beforeMemory =
          await global.memoryTestUtils.getStableMemoryUsage();

        const action = {
          actionDefinitionId: 'memory:efficiency',
          commandString: 'memory efficiency test',
          resolvedParameters: { targetId: 'target_123' },
        };

        // Perform batch of operations
        for (let i = 0; i < batchSize; i++) {
          await commandProcessor.dispatchAction(mockActor, action);
        }

        const afterMemory = await global.memoryTestUtils.getStableMemoryUsage();
        const memoryUsed = Math.max(0, afterMemory - beforeMemory);
        const avgMemoryPerOp = memoryUsed / batchSize;

        memoryPerOperation.push(avgMemoryPerOp);

        console.log(
          `Batch ${batchSize}: ${(memoryUsed / 1024).toFixed(2)}KB total, ` +
            `${(avgMemoryPerOp / 1024).toFixed(3)}KB per operation`
        );
      }

      // Memory usage per operation should be reasonable and consistent
      const maxMemoryPerOp = Math.max(...memoryPerOperation);
      const maxReasonableMemoryPerOp = global.memoryTestUtils.isCI()
        ? 50 * 1024
        : 30 * 1024; // 30-50KB per operation

      expect(maxMemoryPerOp).toBeLessThan(maxReasonableMemoryPerOp);
    });
  });
});
