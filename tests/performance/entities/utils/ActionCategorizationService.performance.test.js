/**
 * @file ActionCategorizationService Performance Tests
 * @description Performance benchmarks for ActionCategorizationService methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionCategorizationService from '../../../../src/entities/utils/ActionCategorizationService.js';

describe('ActionCategorizationService - Performance Tests', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new ActionCategorizationService({ logger: mockLogger });
  });

  describe('Method Performance Benchmarks', () => {
    it('should handle large action sets efficiently', () => {
      const largeActions = Array(100)
        .fill(null)
        .map((_, i) => ({
          actionId: `namespace${i % 10}:action${i}`,
        }));

      // Warmup to reduce JIT compilation effects
      service.groupActionsByNamespace(largeActions);
      service.groupActionsByNamespace(largeActions);

      // Measure multiple runs for stability
      const iterations = 5;
      let totalDuration = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const grouped = service.groupActionsByNamespace(largeActions);
        const duration = performance.now() - startTime;
        totalDuration += duration;

        expect(grouped.size).toBe(10);
      }

      const avgDuration = totalDuration / iterations;
      expect(avgDuration).toBeLessThan(15); // Average should complete in less than 15ms
    });

    it('should handle complex namespace structures efficiently', () => {
      const namespaces = Array(20)
        .fill(null)
        .map((_, i) => `namespace${i}`);

      // Warmup
      service.getSortedNamespaces(namespaces);
      service.getSortedNamespaces(namespaces);

      // Measure multiple runs for stability
      const iterations = 5;
      let totalDuration = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const sorted = service.getSortedNamespaces(namespaces);
        const duration = performance.now() - startTime;
        totalDuration += duration;

        expect(sorted).toHaveLength(20);
      }

      const avgDuration = totalDuration / iterations;
      expect(avgDuration).toBeLessThan(5); // Average should complete in less than 5ms
    });

    it('should measure method call overhead', () => {
      const iterations = 1000;

      // Warmup
      for (let i = 0; i < 100; i++) {
        service.extractNamespace(`core:action${i}`);
      }

      // Measure multiple runs for stability
      const runs = 3;
      let totalAvgDuration = 0;

      for (let run = 0; run < runs; run++) {
        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
          service.extractNamespace(`core:action${i}`);
        }
        const duration = performance.now() - startTime;
        const avgDuration = duration / iterations;
        totalAvgDuration += avgDuration;
      }

      const finalAvgDuration = totalAvgDuration / runs;
      expect(finalAvgDuration).toBeLessThan(0.5); // Average should be less than 0.5ms per call
    });

    it('should scale efficiently with increased action count', () => {
      const testSizes = [10, 50, 100, 200];
      const benchmarks = [];

      testSizes.forEach((size) => {
        const actions = Array(size)
          .fill(null)
          .map((_, i) => ({
            actionId: `namespace${i % 5}:action${i}`,
          }));

        // Run multiple iterations to get more stable timing
        const iterations = 5;
        let totalDuration = 0;

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          service.groupActionsByNamespace(actions);
          const duration = performance.now() - startTime;
          totalDuration += duration;
        }

        const avgDuration = totalDuration / iterations;
        benchmarks.push({ size, duration: avgDuration });

        // Performance should scale reasonably with size
        expect(avgDuration).toBeLessThan(size * 0.2); // <0.2ms per action (more realistic)
      });

      // Verify performance doesn't degrade dramatically
      const durations = benchmarks.map((b) => b.duration);
      const maxDuration = Math.max(...durations);

      // Even the largest dataset should complete reasonably quickly
      expect(maxDuration).toBeLessThan(50); // <50ms for largest dataset
    });

    it('should handle namespace sorting with large datasets', () => {
      const largeNamespaceCount = 100;
      const namespaces = Array(largeNamespaceCount)
        .fill(null)
        .map((_, i) => `custom_namespace_${i.toString().padStart(3, '0')}`);

      // Warmup
      service.getSortedNamespaces(namespaces);
      service.getSortedNamespaces(namespaces);

      // Measure multiple runs for stability
      const iterations = 3;
      let totalDuration = 0;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const sorted = service.getSortedNamespaces(namespaces);
        const duration = performance.now() - startTime;
        totalDuration += duration;

        expect(sorted).toHaveLength(largeNamespaceCount);
      }

      const avgDuration = totalDuration / iterations;
      expect(avgDuration).toBeLessThan(25); // Average should complete in less than 25ms
    });

    it('should handle repeated grouping decisions efficiently', () => {
      const actions = Array(25)
        .fill(null)
        .map((_, i) => ({
          actionId: `namespace${i % 5}:action${i}`,
        }));

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.shouldUseGrouping(actions);
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(0.5); // Less than 0.5ms per decision
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should maintain performance under stress testing', () => {
      // Create a mix of operations simulating real usage
      const actions = Array(50)
        .fill(null)
        .map((_, i) => ({
          actionId: `namespace${i % 8}:action${i}`,
        }));

      const iterations = 50;
      const operations = [];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Mix of operations
        const groupingDecision = service.shouldUseGrouping(actions);
        operations.push(() =>
          service.extractNamespace(actions[i % actions.length].actionId)
        );

        if (groupingDecision) {
          operations.push(() => service.groupActionsByNamespace(actions));
        }

        operations.push(() =>
          service.getSortedNamespaces(['core', 'intimacy', 'anatomy'])
        );
      }

      // Execute all operations
      operations.forEach((op) => op());

      const duration = performance.now() - startTime;

      // Total time should be reasonable for mixed operations
      expect(duration).toBeLessThan(100); // Less than 100ms total

      // Average operation time should be minimal
      const avgOpTime = duration / operations.length;
      expect(avgOpTime).toBeLessThan(1); // Less than 1ms per operation
    });
  });
});
