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
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);

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

      const measurements = [];

      // Test with increasing limb counts
      [10, 20, 40, 80].forEach((count) => {
        const template = createTemplate(count);

        const startTime = performance.now();
        socketGenerator.generateSockets(template);
        slotGenerator.generateBlueprintSlots(template);
        const endTime = performance.now();

        measurements.push({
          count,
          time: endTime - startTime,
        });
      });

      // Verify approximately linear scaling
      // Time for 80 limbs should be < 10x time for 10 limbs (allowing overhead)
      const time10 = measurements[0].time;
      const time80 = measurements[3].time;

      expect(time80).toBeLessThan(time10 * 10);

      // Verify general trend: doubling limbs shouldn't more than double time
      for (let i = 1; i < measurements.length; i++) {
        const prev = measurements[i - 1];
        const curr = measurements[i];
        const scaleFactor = curr.count / prev.count;
        const timeRatio = curr.time / prev.time;

        // Time ratio should not exceed scale factor * 1.5 (allowing overhead)
        expect(timeRatio).toBeLessThan(scaleFactor * 1.5);
      }
    });
  });
});
