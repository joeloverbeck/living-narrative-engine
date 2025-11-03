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

  const DEFAULT_ITERATIONS = 1000;
  const DEFAULT_WARMUP_ITERATIONS = 200;

  /**
   * @typedef {object} ExpansionPerformanceOptions
   * @property {number} [iterations]
   * @property {number} [warmupIterations]
   * @property {boolean} [validateSync]
   */

  /**
   * @typedef {object} ExpansionPerformanceResult
   * @property {number} totalTime
   * @property {number} avgTime
   * @property {boolean} [synchronized]
   */

  /**
   * Measure expansion performance with optional synchronization validation.
   * @param {object} template - Template to expand
   * @param {ExpansionPerformanceOptions} [options] - Measurement configuration
   * @returns {ExpansionPerformanceResult} Measured performance metrics
   */
  const measureExpansionPerformance = (template, options = {}) => {
    const {
      iterations = DEFAULT_ITERATIONS,
      warmupIterations = DEFAULT_WARMUP_ITERATIONS,
      validateSync = false,
    } = options;

    for (let i = 0; i < warmupIterations; i++) {
      expandBlueprint(template);
    }

    let synchronized = true;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      if (validateSync) {
        const { sockets, slots } = expandBlueprint(template);
        if (synchronized && !validateSynchronization(sockets, slots)) {
          synchronized = false;
        }
      } else {
        expandBlueprint(template);
      }
    }

    const totalTime = performance.now() - start;
    const avgTime = totalTime / iterations;

    return { totalTime, avgTime, synchronized };
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
    const scenarios = [
      {
        label: 'small blueprint (10 items)',
        templateFactory: () => createCompleteTemplate(1, 10, 0),
        perIterationTarget: 1,
      },
      {
        label: 'medium blueprint (20 items)',
        templateFactory: () => createCompleteTemplate(2, 10, 0),
        perIterationTarget: 2,
      },
      {
        label: 'large blueprint (50 items)',
        templateFactory: () => createCompleteTemplate(5, 10, 0),
        perIterationTarget: 5,
      },
      {
        label: 'extra large blueprint (100 items)',
        templateFactory: () => createCompleteTemplate(10, 10, 0),
        perIterationTarget: 10,
      },
    ];

    scenarios.forEach(({ label, templateFactory, perIterationTarget }) => {
      it(`should expand ${label} efficiently (<${perIterationTarget}ms)`, () => {
        const template = templateFactory();
        const { totalTime, avgTime } = measureExpansionPerformance(template);

        expect(totalTime).toBeLessThan(DEFAULT_ITERATIONS * perIterationTarget);
        expect(avgTime).toBeLessThan(perIterationTarget);

        console.log(
          `${label}: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
        );
      });
    });
  });

  describe('Combined LimbSet and Appendage Expansion', () => {
    const scenarios = [
      {
        label: 'mixed limbSets + appendages (30 items)',
        templateFactory: () => createCompleteTemplate(2, 10, 10),
        perIterationTarget: 3.5,
      },
      {
        label: 'appendage-heavy blueprint (50 items)',
        templateFactory: () => createCompleteTemplate(1, 10, 40),
        perIterationTarget: 5,
      },
      {
        label: 'limbSet-heavy blueprint (50 items)',
        templateFactory: () => createCompleteTemplate(5, 10, 0),
        perIterationTarget: 5,
      },
    ];

    scenarios.forEach(({ label, templateFactory, perIterationTarget }) => {
      it(`should efficiently expand ${label}`, () => {
        const template = templateFactory();
        const { totalTime, avgTime } = measureExpansionPerformance(template);

        expect(totalTime).toBeLessThan(DEFAULT_ITERATIONS * perIterationTarget);
        expect(avgTime).toBeLessThan(perIterationTarget);

        console.log(
          `${label}: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
        );
      });
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
      const iterations = 300;
      const perIterationTarget = 10;

      const { totalTime, synchronized } = measureExpansionPerformance(
        template,
        {
          iterations,
          warmupIterations: 100,
          validateSync: true,
        }
      );

      expect(synchronized).toBe(true);
      expect(totalTime).toBeLessThan(iterations * perIterationTarget);

      console.log(
        `Synchronization validation at scale (100 items, ${iterations} iterations): ${totalTime.toFixed(2)}ms`
      );
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive expansions without degradation', () => {
      const template = createCompleteTemplate(3, 10, 0); // 30 items
      const batchCount = 5;
      const batchSize = 50;
      const times = [];

      for (let i = 0; i < 150; i++) {
        expandBlueprint(template);
      }

      for (let batch = 0; batch < batchCount; batch++) {
        const batchStart = performance.now();

        for (let i = 0; i < batchSize; i++) {
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

      expect(degradationRatio).toBeLessThan(5);

      const perBatchTarget = 25;
      times.forEach((time) => {
        expect(time).toBeLessThan(perBatchTarget);
      });
    });

    it('should maintain performance across varying blueprint sizes', () => {
      const templates = [
        {
          name: '10 items',
          template: createCompleteTemplate(1, 10, 0),
          target: 1,
        },
        {
          name: '20 items',
          template: createCompleteTemplate(2, 10, 0),
          target: 2,
        },
        {
          name: '50 items',
          template: createCompleteTemplate(5, 10, 0),
          target: 5,
        },
        {
          name: '100 items',
          template: createCompleteTemplate(10, 10, 0),
          target: 10,
        },
      ];

      for (const testCase of templates) {
        const { avgTime } = measureExpansionPerformance(testCase.template, {
          iterations: 250,
          warmupIterations: 80,
        });

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
        const { avgTime, synchronized } = measureExpansionPerformance(
          testCase.template,
          {
            iterations: 250,
            warmupIterations: 80,
            validateSync: true,
          }
        );

        const passed = avgTime < testCase.target && synchronized;

        results.push({
          name: testCase.name,
          avgTime,
          target: testCase.target,
          synchronized,
          passed,
        });

        console.log(
          `${testCase.name}: ${avgTime.toFixed(4)}ms avg (target: <${testCase.target}ms), sync: ${synchronized ? '✓' : '✗'} - ${passed ? '✓ PASS' : '✗ FAIL'}`
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
