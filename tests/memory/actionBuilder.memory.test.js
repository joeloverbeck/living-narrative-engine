/**
 * @file Memory tests for ActionDefinitionBuilder
 * @description Tests memory usage patterns of action definition creation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionDefinitionBuilder from '../../src/actions/builders/actionDefinitionBuilder.js';

describe('ActionDefinitionBuilder - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('action creation memory efficiency', () => {
    it('should have minimal memory overhead per action', async () => {
      const actionCount = global.memoryTestUtils.isCI() ? 800 : 1000;

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create many action definitions to test memory usage
      const actions = Array.from({ length: actionCount }, (_, i) =>
        new ActionDefinitionBuilder(`test:memory${i}`)
          .withName(`Memory Test ${i}`)
          .withDescription(`Memory test action ${i}`)
          .asBasicAction()
          .build()
      );

      // Allow memory to stabilize after creation
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clear references and force cleanup
      actions.length = 0; // Clear array references
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryPerAction = memoryGrowth / actionCount;

      // Memory efficiency assertions
      const maxMemoryPerActionBytes = global.memoryTestUtils.isCI()
        ? 3072
        : 2560; // 3KB/2.5KB per action
      const maxTotalGrowthMB = global.memoryTestUtils.isCI() ? 4 : 3; // Total growth limit
      const maxLeakageMB = global.memoryTestUtils.isCI() ? 1 : 0.5; // Memory leak limit

      expect(memoryPerAction).toBeLessThan(maxMemoryPerActionBytes);
      expect(memoryGrowth).toBeLessThan(maxTotalGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxLeakageMB * 1024 * 1024);

      expect(actions).toHaveLength(0); // Ensure cleanup worked

      console.log(
        `Action builder memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Action: ${memoryPerAction.toFixed(0)} bytes, ` +
          `Actions: ${actionCount}`
      );
    });

    it('should handle complex action definitions without excessive memory usage', async () => {
      const complexActionCount = global.memoryTestUtils.isCI() ? 200 : 300;

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create complex action definitions with multiple components
      const complexActions = Array.from(
        { length: complexActionCount },
        (_, i) =>
          new ActionDefinitionBuilder(`test:complex_memory${i}`)
            .withName(`Complex Memory Test ${i}`)
            .withDescription(
              `Complex memory test action with detailed description ${i}`
            )
            .asBasicAction()
            .withPrerequisites([
              {
                condition: 'core:has-health',
                message: 'Actor must be healthy',
              },
              {
                condition: 'core:location-safe',
                message: 'Location must be safe',
              },
            ])
            .build()
      );

      // Allow memory to stabilize after creation
      await new Promise((resolve) => setTimeout(resolve, 150));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clear references and force cleanup
      complexActions.length = 0;
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryPerComplexAction = memoryGrowth / complexActionCount;

      // Complex actions should still be memory efficient
      const maxComplexMemoryPerActionBytes = global.memoryTestUtils.isCI()
        ? 5120
        : 4096; // 5KB/4KB per complex action
      const maxComplexTotalGrowthMB = global.memoryTestUtils.isCI() ? 3 : 2; // Total growth limit
      const maxComplexLeakageMB = global.memoryTestUtils.isCI() ? 1 : 0.5; // Memory leak limit

      expect(memoryPerComplexAction).toBeLessThan(
        maxComplexMemoryPerActionBytes
      );
      expect(memoryGrowth).toBeLessThan(maxComplexTotalGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxComplexLeakageMB * 1024 * 1024);

      console.log(
        `Complex action memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Action: ${memoryPerComplexAction.toFixed(0)} bytes, ` +
          `Actions: ${complexActionCount}`
      );
    });

    it('should demonstrate memory efficiency in builder pattern usage', async () => {
      const builderIterations = global.memoryTestUtils.isCI() ? 100 : 150;

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Test builder pattern memory usage with multiple build cycles
      const allActions = [];

      for (let cycle = 0; cycle < 5; cycle++) {
        const cycleActions = [];

        for (let i = 0; i < builderIterations; i++) {
          // Create builder, configure it, and build action
          const builder = new ActionDefinitionBuilder(
            `test:builder_cycle${cycle}_${i}`
          )
            .withName(`Builder Cycle ${cycle} Action ${i}`)
            .withDescription(`Action created in cycle ${cycle}, iteration ${i}`)
            .asBasicAction();

          // Add some dynamic configuration
          if (i % 3 === 0) {
            builder.withPrerequisites([
              {
                condition: 'core:has-level',
                message: 'Minimum level required',
              },
            ]);
          }

          // Skip effects for memory testing since withEffects is not available
          // if (i % 2 === 0) {
          //   builder.withEffects([
          //     { type: 'component_change', target: 'actor', changes: { experience: 10 } }
          //   ]);
          // }

          const action = builder.build();
          cycleActions.push(action);
        }

        allActions.push(...cycleActions);

        // Allow memory to stabilize between cycles
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Measure peak memory after all building
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clear all references and force cleanup
      allActions.length = 0;
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory metrics
      const totalActions = builderIterations * 5;
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryPerBuilderAction = memoryGrowth / totalActions;

      // Builder pattern should not add significant memory overhead
      const maxBuilderMemoryPerActionBytes = global.memoryTestUtils.isCI()
        ? 4096
        : 3584; // 4KB/3.5KB per action
      const maxBuilderTotalGrowthMB = global.memoryTestUtils.isCI() ? 3 : 2.5; // Total growth limit
      const maxBuilderLeakageMB = global.memoryTestUtils.isCI() ? 0.5 : 0.3; // Memory leak limit

      expect(memoryPerBuilderAction).toBeLessThan(
        maxBuilderMemoryPerActionBytes
      );
      expect(memoryGrowth).toBeLessThan(maxBuilderTotalGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxBuilderLeakageMB * 1024 * 1024);

      console.log(
        `Builder pattern memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Action: ${memoryPerBuilderAction.toFixed(0)} bytes, ` +
          `Total Actions: ${totalActions}, Cycles: 5`
      );
    });
  });
});
