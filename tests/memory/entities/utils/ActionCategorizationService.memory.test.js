/**
 * @file ActionCategorizationService Memory Tests
 * @description Memory usage and leak detection tests for ActionCategorizationService
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ActionCategorizationService from '../../../../src/entities/utils/ActionCategorizationService.js';

describe('ActionCategorizationService - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization
  
  let service;
  let mockLogger;

  beforeEach(async () => {
    // Force garbage collection before each test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new ActionCategorizationService({ logger: mockLogger });
  });

  afterEach(async () => {
    // Clean up references
    service = null;
    mockLogger = null;

    // Force garbage collection after each test
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    } else if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not create memory leaks during repeated operations', async () => {
      const actionCount = 20;
      const iterationCount = 1000;

      // Create test actions
      const actions = Array.from({ length: actionCount }, (_, i) => ({
        actionId: `namespace${i % 5}:action${i}`,
      }));

      // Establish memory baseline
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
      const baselineMemory = process.memoryUsage().heapUsed;

      // Perform many operations to test for memory leaks
      for (let i = 0; i < iterationCount; i++) {
        service.shouldUseGrouping(actions);
        if (i % 2 === 0) {
          service.groupActionsByNamespace(actions);
        }
        service.extractNamespace(actions[i % actions.length].actionId);
        service.formatNamespaceDisplayName(`namespace${i % 5}`);
        service.getSortedNamespaces(['core', 'intimacy', 'anatomy']);
      }

      // Allow memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - baselineMemory;

      // Memory increase should be minimal (accounting for Node.js overhead)
      const memoryThreshold = 5 * 1024 * 1024; // 5MB threshold
      expect(memoryIncrease).toBeLessThan(memoryThreshold);

      // Log memory metrics for debugging
      if (process.env.DEBUG_MEMORY) {
        console.log('Memory metrics:', {
          baseline: `${(baselineMemory / 1024 / 1024).toFixed(2)}MB`,
          final: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
          increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
          threshold: `${(memoryThreshold / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    });

    it('should handle performance monitoring without memory leaks', async () => {
      // Test the performance monitoring wrapper exists and works correctly
      // without creating memory leaks
      const largeActions = Array(1000)
        .fill(null)
        .map((_, i) => ({
          actionId: `namespace${i % 50}:action${i}`,
        }));

      // Establish baseline
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
      const baselineMemory = process.memoryUsage().heapUsed;

      const startTime = performance.now();
      const grouped = service.groupActionsByNamespace(largeActions);
      const duration = performance.now() - startTime;

      // Verify the operation completes successfully
      expect(grouped.size).toBe(50);

      // Performance should be reasonable
      expect(duration).toBeLessThan(100); // Should complete in reasonable time

      // Allow cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - baselineMemory;

      // Memory usage should be reasonable for the large dataset
      const memoryThreshold = 10 * 1024 * 1024; // 10MB threshold for large operations
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
    });

    it('should maintain consistent memory usage across varying loads', async () => {
      const testConfigs = [
        { actionCount: 10, iterations: 100 },
        { actionCount: 25, iterations: 100 },
        { actionCount: 50, iterations: 100 },
      ];

      const memoryUsageResults = [];

      for (const config of testConfigs) {
        // Create test actions
        const actions = Array.from({ length: config.actionCount }, (_, i) => ({
          actionId: `mod${i % 7}:action${i}`,
        }));

        // Establish baseline
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 50));
        const baseline = process.memoryUsage().heapUsed;

        // Perform operations
        for (let i = 0; i < config.iterations; i++) {
          service.shouldUseGrouping(actions);
          service.groupActionsByNamespace(actions);
          service.extractNamespace(actions[i % actions.length].actionId);
        }

        // Measure peak usage
        const peak = process.memoryUsage().heapUsed;
        const memoryGrowth = Math.max(0, peak - baseline);
        const growthPerAction = memoryGrowth / config.actionCount;

        memoryUsageResults.push({
          actionCount: config.actionCount,
          memoryGrowth,
          growthPerAction,
        });

        // Cleanup
        actions.length = 0;
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Memory growth should be reasonable and relatively consistent
      memoryUsageResults.forEach(result => {
        expect(result.memoryGrowth).toBeLessThan(5 * 1024 * 1024); // < 5MB per test
        expect(result.growthPerAction).toBeLessThan(100 * 1024); // < 100KB per action
      });
    });

    it('should properly clean up internal references', async () => {
      // Test that the service doesn't hold onto references longer than necessary
      const actionsSet1 = Array.from({ length: 20 }, (_, i) => ({
        actionId: `set1_namespace${i % 3}:action${i}`,
      }));

      const actionsSet2 = Array.from({ length: 20 }, (_, i) => ({
        actionId: `set2_namespace${i % 3}:action${i}`,
      }));

      // Establish baseline
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
      const baselineMemory = process.memoryUsage().heapUsed;

      // Process first set
      service.groupActionsByNamespace(actionsSet1);
      service.shouldUseGrouping(actionsSet1);

      // Clear first set and force cleanup
      actionsSet1.length = 0;
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Process second set
      service.groupActionsByNamespace(actionsSet2);
      service.shouldUseGrouping(actionsSet2);

      // Clear second set and force cleanup
      actionsSet2.length = 0;
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryRetained = Math.max(0, finalMemory - baselineMemory);

      // Memory retention should be minimal after cleanup
      const retentionThreshold = 1 * 1024 * 1024; // 1MB retention threshold
      expect(memoryRetained).toBeLessThan(retentionThreshold);
    });
  });

  describe('Memory Efficiency', () => {
    it('should use memory efficiently for namespace operations', async () => {
      const namespaceCount = 50;
      const namespaces = Array.from({ length: namespaceCount }, (_, i) => 
        `namespace_${i.toString().padStart(3, '0')}`
      );

      // Establish baseline
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
      const baselineMemory = process.memoryUsage().heapUsed;

      // Perform namespace operations
      for (let i = 0; i < 100; i++) {
        service.getSortedNamespaces(namespaces);
        namespaces.forEach(ns => service.formatNamespaceDisplayName(ns));
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryUsed = peakMemory - baselineMemory;

      // Memory usage should be reasonable for namespace operations
      expect(memoryUsed).toBeLessThan(2 * 1024 * 1024); // < 2MB for namespace operations
    });
  });
});