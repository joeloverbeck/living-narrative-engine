/**
 * @file Performance tests for template processor pipeline
 * @see workflows/ANABLUNONHUM-011-template-processor-integration-tests.md
 * @see docs/anatomy/structure-templates.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('Template Processor Performance', () => {
  let socketGenerator;
  let slotGenerator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    socketGenerator = new SocketGenerator({ logger });
    slotGenerator = new SlotGenerator({ logger });
  });

  afterEach(() => {
    socketGenerator = null;
    slotGenerator = null;
    logger = null;
  });

  describe('Baseline Performance', () => {
    it('processes humanoid template (5 sockets) within performance threshold', () => {
      const humanoidTemplate = {
        id: 'anatomy:structure_humanoid',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_arm'],
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head_socket',
                allowedTypes: ['human_head'],
              },
            },
          ],
        },
      };

      const startTime = performance.now();

      const sockets = socketGenerator.generateSockets(humanoidTemplate);
      const slots = slotGenerator.generateBlueprintSlots(humanoidTemplate);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert correctness
      expect(sockets).toHaveLength(5);
      expect(Object.keys(slots)).toHaveLength(5);

      // Performance threshold: should complete in < 10ms
      expect(executionTime).toBeLessThan(10);
    });
  });

  describe('Medium Complexity Performance', () => {
    it('processes spider template (9 sockets) efficiently', () => {
      const spiderTemplate = {
        id: 'creatures:structure_spider',
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'torso',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'abdomen_socket',
                allowedTypes: ['spider_abdomen'],
              },
            },
          ],
        },
      };

      const startTime = performance.now();

      const sockets = socketGenerator.generateSockets(spiderTemplate);
      const slots = slotGenerator.generateBlueprintSlots(spiderTemplate);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert correctness
      expect(sockets).toHaveLength(9);
      expect(Object.keys(slots)).toHaveLength(9);

      // Performance threshold: should complete in < 15ms
      expect(executionTime).toBeLessThan(15);
    });
  });

  describe('Large Template Performance', () => {
    it('processes centipede template (50 legs) with acceptable performance', () => {
      const centipedeTemplate = {
        id: 'creatures:structure_centipede',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'leg',
              count: 50,
              arrangement: 'indexed',
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['centipede_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head_socket',
                allowedTypes: ['centipede_head'],
              },
            },
          ],
        },
      };

      const startTime = performance.now();

      const sockets = socketGenerator.generateSockets(centipedeTemplate);
      const slots = slotGenerator.generateBlueprintSlots(centipedeTemplate);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert correctness
      expect(sockets).toHaveLength(51);
      expect(Object.keys(slots)).toHaveLength(51);

      // Performance threshold: should scale linearly (< 100ms for 50 limbs)
      expect(executionTime).toBeLessThan(100);
    });
  });

  describe('Stress Testing', () => {
    it('handles hypothetical creature with 200 limbs', () => {
      const massiveTemplate = {
        id: 'test:massive_creature',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'tentacle',
              count: 200,
              arrangement: 'indexed',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
              },
            },
          ],
        },
      };

      const startTime = performance.now();

      const sockets = socketGenerator.generateSockets(massiveTemplate);
      const slots = slotGenerator.generateBlueprintSlots(massiveTemplate);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert correctness
      expect(sockets).toHaveLength(200);
      expect(Object.keys(slots)).toHaveLength(200);

      // Performance threshold: should handle large templates (< 500ms)
      expect(executionTime).toBeLessThan(500);
    });
  });

  describe('Memory Stability', () => {
    it('maintains consistent performance over repeated processing', () => {
      const template = {
        id: 'test:repeated_processing',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const iterations = 100;
      const executionTimes = [];

      // Process template multiple times
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        socketGenerator.generateSockets(template);
        slotGenerator.generateBlueprintSlots(template);

        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
      }

      // Calculate statistics
      const avgTime =
        executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;

      // Verify tests ran successfully (basic sanity check)
      expect(executionTimes.length).toBe(iterations);
      expect(avgTime).toBeGreaterThan(0);

      // No significant degradation (last 10 avg ~= first 10 avg)
      const firstTenAvg =
        executionTimes.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const lastTenAvg =
        executionTimes.slice(-10).reduce((a, b) => a + b, 0) / 10;

      // Last iterations should not be significantly slower (< 100% slower)
      // More realistic threshold accounting for JIT warmup and GC variance
      expect(lastTenAvg).toBeLessThan(firstTenAvg * 2);
    });
  });

  describe('Time Complexity Validation', () => {
    it('demonstrates linear time complexity with limb count', () => {
      const createTemplate = (count) => ({
        id: `test:complexity_${count}`,
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count,
              socketPattern: {
                idTemplate: 'limb_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      });

      /**
       * Helper to get median of array of numbers
       *
       * @param {number[]} values - Array of numbers
       * @returns {number} Median value
       */
      const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };

      // Warmup: Run a few iterations to let JIT stabilize
      // This reduces variance from JIT compilation in measurements
      for (let i = 0; i < 3; i++) {
        const warmupTemplate = createTemplate(50);
        socketGenerator.generateSockets(warmupTemplate);
        slotGenerator.generateBlueprintSlots(warmupTemplate);
      }

      const measurements = [];
      const operationsPerMeasurement = 5; // Bundle operations to reduce timer noise

      // Test with increasing limb counts
      // Using larger starting size to reduce relative timing noise
      [20, 40, 80, 160].forEach((count) => {
        const template = createTemplate(count);

        // Take multiple measurements and use median to reduce outlier impact
        // Each measurement batches several back-to-back runs to ensure timer
        // resolution noise doesn't overwhelm the ratios we care about.
        const times = [];
        for (let run = 0; run < 5; run++) {
          const startTime = performance.now();
          for (let op = 0; op < operationsPerMeasurement; op++) {
            socketGenerator.generateSockets(template);
            slotGenerator.generateBlueprintSlots(template);
          }
          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        measurements.push({
          count,
          time: median(times),
        });
      });

      // Verify approximately linear scaling
      // Time for 160 limbs should be < 10x time for 20 limbs (allowing overhead)
      const time20 = measurements[0].time;
      const time160 = measurements[3].time;

      expect(time160).toBeLessThan(time20 * 10);

      // Verify general trend: doubling limbs shouldn't more than triple time
      // Using more lenient threshold (3x instead of 1.5x) to account for:
      // - JIT compilation variance
      // - Garbage collection pauses
      // - CPU scheduling effects
      // - Timer resolution limitations
      // Even with warmup and median, micro-benchmarks have inherent variance
      for (let i = 1; i < measurements.length; i++) {
        const prev = measurements[i - 1];
        const curr = measurements[i];
        const scaleFactor = curr.count / prev.count;
        const timeRatio = curr.time / prev.time;

        // Time ratio should not exceed scale factor * 3 (lenient for micro-benchmark variance)
        expect(timeRatio).toBeLessThan(scaleFactor * 3);
      }
    });
  });
});
