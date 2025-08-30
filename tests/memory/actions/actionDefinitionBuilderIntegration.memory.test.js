/**
 * @file Memory usage tests for ActionDefinitionBuilder integration scenarios
 * @description Tests focused on memory consumption and garbage collection behavior
 * when using ActionDefinitionBuilder in bulk operations and stress scenarios
 */

import { describe, it, expect } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';

describe('ActionDefinitionBuilder Integration Memory Tests', () => {
  beforeEach(async () => {
    // Force garbage collection before each test for reliable baseline
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('memory overhead analysis', () => {
    it('should have minimal memory overhead', async () => {
      // Skip test if memory monitoring is not available
      if (typeof process === 'undefined' || !process.memoryUsage) {
        // This test requires Node.js environment
        return;
      }

      const actionCount = global.memoryTestUtils.isCI() ? 800 : 1000;

      // Establish stable memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const actions = Array.from({ length: actionCount }, (_, i) =>
        new ActionDefinitionBuilder(`test:memory${i}`)
          .withName(`Memory Test ${i}`)
          .withDescription(`Memory test action ${i}`)
          .asBasicAction()
          .build()
      );

      // Allow memory to stabilize after creation
      await new Promise((resolve) => setTimeout(resolve, 50));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory usage with proper baseline
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryPerAction = memoryGrowth / actionCount;

      // Environment-aware thresholds (more lenient for CI environments)
      const maxMemoryPerActionBytes = global.memoryTestUtils.isCI()
        ? 3072
        : 2560; // 3KB/2.5KB per action
      const maxTotalGrowthMB = global.memoryTestUtils.isCI() ? 4 : 3; // Total growth limit

      expect(memoryPerAction).toBeLessThan(maxMemoryPerActionBytes);
      expect(memoryGrowth).toBeLessThan(maxTotalGrowthMB * 1024 * 1024);
      expect(actions).toHaveLength(actionCount);

      console.log(
        `Memory usage - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Action: ${memoryPerAction.toFixed(0)} bytes, ` +
          `Actions: ${actionCount}, ` +
          `Threshold: ${maxMemoryPerActionBytes} bytes`
      );

      // Clean up references
      actions.length = 0;
    });
  });

  describe('garbage collection stress testing', () => {
    if (typeof global !== 'undefined' && global.gc) {
      it('should not create excessive garbage under stress', async () => {
        const stressActionCount = global.memoryTestUtils.isCI() ? 800 : 1000;

        // Establish stable memory baseline
        await global.memoryTestUtils.forceGCAndWait();
        const baselineMemory =
          await global.memoryTestUtils.getStableMemoryUsage();

        // Create and destroy many builders
        for (let i = 0; i < stressActionCount; i++) {
          const builder = new ActionDefinitionBuilder(`stress:action${i}`)
            .withName(`Stress Action ${i}`)
            .withDescription(`Stress test action ${i}`)
            .asTargetedAction('stress:scope')
            .requiresComponents([
              'stress:comp1',
              'stress:comp2',
              'stress:comp3',
            ])
            .withPrerequisites([
              'stress:cond1',
              'stress:cond2',
              'stress:cond3',
            ]);

          const action = builder.build();

          // Use the action briefly
          expect(action.id).toBeDefined();
        }

        // Force garbage collection after test and stabilize
        await global.memoryTestUtils.forceGCAndWait();
        const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

        const memoryIncrease = Math.max(0, finalMemory - baselineMemory);

        // Environment-aware memory increase threshold
        const maxMemoryIncreaseMB = global.memoryTestUtils.isCI() ? 12 : 10; // More lenient for CI

        expect(memoryIncrease).toBeLessThan(maxMemoryIncreaseMB * 1024 * 1024);

        console.log(
          `Garbage collection test - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
            `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
            `Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, ` +
            `Actions: ${stressActionCount}, ` +
            `Threshold: ${maxMemoryIncreaseMB}MB`
        );
      });
    } else {
      it('should skip garbage collection test when global.gc is not available', () => {
        // This test is skipped when --expose-gc is not available
        expect(true).toBe(true);
      });
    }
  });
});
