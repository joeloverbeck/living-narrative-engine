/**
 * @file templateExpansion.performance.test.js
 * @description Integration performance tests for complete template expansion workflow
 * Benchmarks SocketGenerator + SlotGenerator working together to ensure socket-slot synchronization
 * and validates complete blueprint expansion overhead remains under 5ms
 * @see workflows/ANABLUNONHUM-012-performance-benchmarks.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';

describe('Template Expansion - Integration Performance Tests', () => {
  let socketGenerator;
  let slotGenerator;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger to avoid logging overhead in performance measurements
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    socketGenerator = new SocketGenerator({ logger: mockLogger });
    slotGenerator = new SlotGenerator({ logger: mockLogger });
  });

  /**
   * Helper function to create complete structure template with both limbSets and appendages
   * @param {number} limbSetCount - Number of limb sets
   * @param {number} itemsPerLimbSet - Number of items per limb set
   * @param {number} appendageCount - Number of appendages
   * @returns {object} Complete structure template
   */
  const createCompleteTemplate = (
    limbSetCount,
    itemsPerLimbSet,
    appendageCount
  ) => ({
    topology: {
      limbSets: Array.from({ length: limbSetCount }, (_, setIndex) => ({
        type: `limb_${setIndex}`,
        count: itemsPerLimbSet,
        socketPattern: {
          idTemplate: `socket_${setIndex}_{{index}}`,
          allowedTypes: ['test_part'],
        },
        arrangement: 'bilateral',
        optional: false,
      })),
      appendages: Array.from({ length: appendageCount }, (_, index) => ({
        type: `appendage_${index}`,
        count: 1,
        socketPattern: {
          idTemplate: `app_${index}`,
          allowedTypes: ['test_appendage'],
        },
        optional: true,
      })),
    },
  });

  /**
   * Helper to perform complete blueprint expansion
   * @param {object} template - Structure template
   * @returns {object} Generated sockets and slots
   */
  const expandBlueprint = (template) => {
    const sockets = socketGenerator.generateSockets(template);
    const slots = slotGenerator.generateBlueprintSlots(template);
    return { sockets, slots };
  };

  /**
   * Helper to validate socket-slot synchronization
   * @param {Array} sockets - Generated sockets
   * @param {object} slots - Generated slots
   * @returns {boolean} True if synchronized
   */
  const validateSynchronization = (sockets, slots) => {
    const socketIds = new Set(sockets.map((s) => s.id));
    const slotKeys = new Set(Object.keys(slots));

    // All socket IDs should have matching slot keys
    for (const socketId of socketIds) {
      if (!slotKeys.has(socketId)) {
        return false;
      }
    }

    // All slot keys should have matching socket IDs
    for (const slotKey of slotKeys) {
      if (!socketIds.has(slotKey)) {
        return false;
      }
    }

    return socketIds.size === slotKeys.size;
  };

  describe('Complete Blueprint Expansion Performance', () => {
    it('should expand small blueprint efficiently (<1ms)', () => {
      // 10 total sockets/slots: 1 limb set with 10 items
      const template = createCompleteTemplate(1, 10, 0);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 1000ms
      expect(totalTime).toBeLessThan(1000);

      // Average time per expansion should be under 1ms
      expect(avgTime).toBeLessThan(1);

      console.log(
        `Small blueprint expansion (10 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should expand medium blueprint efficiently (<2ms)', () => {
      // 20 total sockets/slots: 2 limb sets with 10 items each
      const template = createCompleteTemplate(2, 10, 0);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 2000ms
      expect(totalTime).toBeLessThan(2000);

      // Average time per expansion should be under 2ms
      expect(avgTime).toBeLessThan(2);

      console.log(
        `Medium blueprint expansion (20 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should expand large blueprint efficiently (<5ms)', () => {
      // 50 total sockets/slots: 5 limb sets with 10 items each
      const template = createCompleteTemplate(5, 10, 0);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 5000ms
      expect(totalTime).toBeLessThan(5000);

      // Average time per expansion should be under 5ms
      expect(avgTime).toBeLessThan(5);

      console.log(
        `Large blueprint expansion (50 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should expand extra large blueprint efficiently (<10ms)', () => {
      // 100 total sockets/slots: 10 limb sets with 10 items each
      const template = createCompleteTemplate(10, 10, 0);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 10000ms
      expect(totalTime).toBeLessThan(10000);

      // Average time per expansion should be under 10ms
      expect(avgTime).toBeLessThan(10);

      console.log(
        `Extra large blueprint expansion (100 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('Combined LimbSet and Appendage Expansion', () => {
    it('should efficiently expand blueprints with mixed limbSets and appendages', () => {
      // 30 total: 2 limb sets (10 each) + 10 appendages
      const template = createCompleteTemplate(2, 10, 10);
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // 30 items should be < 3.5ms avg (CI-adjusted)
      expect(totalTime).toBeLessThan(3500);
      expect(avgTime).toBeLessThan(3.5);

      console.log(
        `Mixed limbSets + appendages (30 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should efficiently expand appendage-heavy blueprints', () => {
      // 50 total: 1 limb set (10 items) + 40 appendages
      const template = createCompleteTemplate(1, 10, 40);
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // 50 items should be < 5ms avg
      expect(totalTime).toBeLessThan(5000);
      expect(avgTime).toBeLessThan(5);

      console.log(
        `Appendage-heavy blueprint (50 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should efficiently expand limbSet-heavy blueprints', () => {
      // 50 total: 5 limb sets (10 each) + 0 appendages
      const template = createCompleteTemplate(5, 10, 0);
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        expandBlueprint(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // 50 items should be < 5ms avg
      expect(totalTime).toBeLessThan(5000);
      expect(avgTime).toBeLessThan(5);

      console.log(
        `LimbSet-heavy blueprint (50 items): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('Socket-Slot Synchronization Validation', () => {
    it('should maintain socket-slot ID synchronization in small blueprints', () => {
      const template = createCompleteTemplate(1, 10, 0);
      const { sockets, slots } = expandBlueprint(template);

      // Validate synchronization
      expect(validateSynchronization(sockets, slots)).toBe(true);

      // Socket IDs should match slot keys
      const socketIds = sockets.map((s) => s.id).sort();
      const slotKeys = Object.keys(slots).sort();

      expect(socketIds).toEqual(slotKeys);
    });

    it('should maintain socket-slot ID synchronization in medium blueprints', () => {
      const template = createCompleteTemplate(2, 10, 0);
      const { sockets, slots } = expandBlueprint(template);

      // Validate synchronization
      expect(validateSynchronization(sockets, slots)).toBe(true);

      // Should generate 20 matching items
      expect(sockets.length).toBe(20);
      expect(Object.keys(slots).length).toBe(20);
    });

    it('should maintain socket-slot ID synchronization in large blueprints', () => {
      const template = createCompleteTemplate(5, 10, 0);
      const { sockets, slots } = expandBlueprint(template);

      // Validate synchronization
      expect(validateSynchronization(sockets, slots)).toBe(true);

      // Should generate 50 matching items
      expect(sockets.length).toBe(50);
      expect(Object.keys(slots).length).toBe(50);
    });

    it('should maintain synchronization with mixed limbSets and appendages', () => {
      const template = createCompleteTemplate(2, 10, 10);
      const { sockets, slots } = expandBlueprint(template);

      // Validate synchronization
      expect(validateSynchronization(sockets, slots)).toBe(true);

      // Should generate 30 matching items (20 from limbSets + 10 from appendages)
      expect(sockets.length).toBe(30);
      expect(Object.keys(slots).length).toBe(30);
    });

    it('should validate synchronization performance at scale', () => {
      const template = createCompleteTemplate(10, 10, 0); // 100 items
      const iterations = 1000;

      let allSynchronized = true;

      // Warmup
      for (let i = 0; i < 100; i++) {
        const { sockets, slots } = expandBlueprint(template);
        validateSynchronization(sockets, slots);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const { sockets, slots } = expandBlueprint(template);
        if (!validateSynchronization(sockets, slots)) {
          allSynchronized = false;
          break;
        }
      }
      const totalTime = performance.now() - start;

      // All expansions should maintain synchronization
      expect(allSynchronized).toBe(true);

      // Performance should remain good even with validation
      expect(totalTime).toBeLessThan(10000); // 1000 iterations in < 10s

      console.log(
        `Synchronization validation at scale (100 items, ${iterations} iterations): ${totalTime.toFixed(2)}ms`
      );
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive expansions without degradation', () => {
      const template = createCompleteTemplate(3, 10, 0); // 30 items
      const times = [];

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        expandBlueprint(template);
      }

      // Measure performance over 10 batches to detect degradation
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = performance.now();

        for (let i = 0; i < 100; i++) {
          expandBlueprint(template);
        }

        const batchTime = performance.now() - batchStart;
        times.push(batchTime);
      }

      const firstBatchTime = times[0];
      const lastBatchTime = times[times.length - 1];
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const degradationRatio = lastBatchTime / firstBatchTime;

      console.log(
        `Stress test batch times: [${times.map((t) => t.toFixed(2)).join(', ')}]ms`
      );
      console.log(
        `First batch: ${firstBatchTime.toFixed(2)}ms, Last batch: ${lastBatchTime.toFixed(2)}ms`
      );
      console.log(`Average batch time: ${avgTime.toFixed(2)}ms`);
      console.log(`Degradation ratio: ${degradationRatio.toFixed(2)}x`);

      // Performance should not degrade significantly (last batch < 5x first batch)
      expect(degradationRatio).toBeLessThan(5);

      // All batches should complete within reasonable time (100 expansions in < 50ms)
      times.forEach((time) => {
        expect(time).toBeLessThan(50);
      });
    });

    it('should maintain performance across varying blueprint sizes', () => {
      const templates = [
        { name: '10 items', template: createCompleteTemplate(1, 10, 0), target: 1 },
        { name: '20 items', template: createCompleteTemplate(2, 10, 0), target: 2 },
        { name: '50 items', template: createCompleteTemplate(5, 10, 0), target: 5 },
        {
          name: '100 items',
          template: createCompleteTemplate(10, 10, 0),
          target: 10,
        },
      ];

      const iterations = 100;

      for (const testCase of templates) {
        // Warmup
        for (let i = 0; i < 100; i++) {
          expandBlueprint(testCase.template);
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          expandBlueprint(testCase.template);
        }
        const totalTime = performance.now() - start;
        const avgTime = totalTime / iterations;

        // Should meet performance target
        expect(avgTime).toBeLessThan(testCase.target);

        console.log(
          `${testCase.name}: ${avgTime.toFixed(4)}ms avg (target: <${testCase.target}ms)`
        );
      }
    });
  });

  describe('Performance Summary', () => {
    it('should demonstrate that complete template expansion is performant', () => {
      const testCases = [
        {
          name: 'Small (10 items)',
          template: createCompleteTemplate(1, 10, 0),
          target: 1,
        },
        {
          name: 'Medium (20 items)',
          template: createCompleteTemplate(2, 10, 0),
          target: 2,
        },
        {
          name: 'Large (50 items)',
          template: createCompleteTemplate(5, 10, 0),
          target: 5,
        },
        {
          name: 'Extra Large (100 items)',
          template: createCompleteTemplate(10, 10, 0),
          target: 10,
        },
        {
          name: 'Mixed (30 items)',
          template: createCompleteTemplate(2, 10, 10),
          target: 3,
        },
      ];

      console.log('\n=== Template Expansion Performance Summary ===');

      const results = [];

      for (const testCase of testCases) {
        const iterations = 1000;

        // Warmup
        for (let i = 0; i < 100; i++) {
          expandBlueprint(testCase.template);
        }

        const start = performance.now();
        let synchronized = true;
        for (let i = 0; i < iterations; i++) {
          const { sockets, slots } = expandBlueprint(testCase.template);
          if (!validateSynchronization(sockets, slots)) {
            synchronized = false;
          }
        }
        const totalTime = performance.now() - start;
        const avgTime = totalTime / iterations;

        results.push({
          name: testCase.name,
          avgTime,
          target: testCase.target,
          synchronized,
          passed: avgTime < testCase.target && synchronized,
        });

        console.log(
          `${testCase.name}: ${avgTime.toFixed(4)}ms avg (target: <${testCase.target}ms), sync: ${synchronized ? '✓' : '✗'} - ${avgTime < testCase.target && synchronized ? '✓ PASS' : '✗ FAIL'}`
        );
      }

      // All test cases should pass their performance targets and maintain synchronization
      results.forEach((result) => {
        expect(result.passed).toBe(true);
        expect(result.synchronized).toBe(true);
      });

      console.log('================================================\n');
    });
  });
});
