/**
 * @file socketGenerator.performance.test.js
 * @description Performance benchmarks for SocketGenerator template expansion
 * Ensures socket generation overhead remains acceptable (<5ms per blueprint expansion)
 * @see workflows/ANABLUNONHUM-012-performance-benchmarks.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';

describe('SocketGenerator - Performance Tests', () => {
  let socketGenerator;
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
  });

  /**
   * Helper function to create structure template for testing
   *
   * @param {number} limbSetCount - Number of limb sets
   * @param {number} socketsPerLimbSet - Number of sockets per limb set
   * @param {string} arrangement - Arrangement type (bilateral, radial, indexed, custom)
   * @returns {object} Structure template
   */
  const createStructureTemplate = (
    limbSetCount,
    socketsPerLimbSet,
    arrangement = 'bilateral'
  ) => ({
    topology: {
      limbSets: Array.from({ length: limbSetCount }, (_, setIndex) => ({
        type: `limb_${setIndex}`,
        count: socketsPerLimbSet,
        socketPattern: {
          idTemplate: `socket_${setIndex}_{{index}}`,
          allowedTypes: ['test_part'],
        },
        arrangement,
      })),
      appendages: [],
    },
  });

  /**
   * Helper to create template with appendages
   *
   * @param {number} appendageCount - Number of appendages
   * @returns {object} Structure template with appendages
   */
  const createAppendageTemplate = (appendageCount) => ({
    topology: {
      limbSets: [],
      appendages: Array.from({ length: appendageCount }, (_, index) => ({
        type: `appendage_${index}`,
        count: 1,
        socketPattern: {
          idTemplate: `app_${index}`,
          allowedTypes: ['test_appendage'],
        },
      })),
    },
  });

  describe('Socket Generation Performance', () => {
    it('should generate single socket efficiently (<0.01ms)', () => {
      const template = createStructureTemplate(1, 1);
      const iterations = 10000;

      // Warmup phase to ensure JIT compilation
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 100ms
      expect(totalTime).toBeLessThan(100);

      // Average time per call should be under 0.01ms (10 microseconds)
      expect(avgTime).toBeLessThan(0.01);

      console.log(
        `Single socket generation: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should generate 10 sockets efficiently (<0.1ms)', () => {
      const template = createStructureTemplate(1, 10);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 1000ms
      expect(totalTime).toBeLessThan(1000);

      // Average time per call should be under 0.1ms
      expect(avgTime).toBeLessThan(0.1);

      console.log(
        `10 sockets generation: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should generate 20 sockets efficiently (<0.2ms)', () => {
      const template = createStructureTemplate(1, 20);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 2000ms
      expect(totalTime).toBeLessThan(2000);

      // Average time per call should be under 0.2ms
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `20 sockets generation: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should generate 50 sockets efficiently (<0.5ms)', () => {
      const template = createStructureTemplate(1, 50);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 5000ms
      expect(totalTime).toBeLessThan(5000);

      // Average time per call should be under 0.5ms
      expect(avgTime).toBeLessThan(0.5);

      console.log(
        `50 sockets generation: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should generate 100 sockets efficiently (<1ms)', () => {
      const template = createStructureTemplate(1, 100);
      const iterations = 10000;

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // Should complete 10k iterations in under 10000ms
      expect(totalTime).toBeLessThan(10000);

      // Average time per call should be under 1ms
      expect(avgTime).toBeLessThan(1);

      console.log(
        `100 sockets generation: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('Orientation Scheme Performance', () => {
    it('should handle bilateral arrangement efficiently', () => {
      const template = createStructureTemplate(2, 10, 'bilateral');
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(2000);
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `Bilateral arrangement (20 sockets): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should handle radial arrangement efficiently', () => {
      const template = createStructureTemplate(2, 10, 'radial');
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(2000);
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `Radial arrangement (20 sockets): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should handle indexed arrangement efficiently', () => {
      const template = createStructureTemplate(2, 10, 'indexed');
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(2000);
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `Indexed arrangement (20 sockets): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });

    it('should handle custom arrangement efficiently', () => {
      const template = createStructureTemplate(2, 10, 'custom');
      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(2000);
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `Custom arrangement (20 sockets): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('Mixed LimbSet and Appendage Performance', () => {
    it('should handle combined limbSets and appendages efficiently', () => {
      const template = {
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 10,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                allowedTypes: ['leg_part'],
              },
              arrangement: 'bilateral',
            },
          ],
          appendages: Array.from({ length: 10 }, (_, index) => ({
            type: `tail_segment_${index}`,
            count: 1,
            socketPattern: {
              idTemplate: `tail_${index}`,
              allowedTypes: ['tail_part'],
            },
          })),
        },
      };

      const iterations = 10000;

      // Warmup
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        socketGenerator.generateSockets(template);
      }
      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      // 20 total sockets: should be < 0.2ms avg
      expect(totalTime).toBeLessThan(2000);
      expect(avgTime).toBeLessThan(0.2);

      console.log(
        `Combined limbSets + appendages (20 sockets): ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms avg`
      );
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive calls without degradation', () => {
      const template = createStructureTemplate(2, 15); // 30 sockets total
      const times = [];

      // Warmup phase
      for (let i = 0; i < 1000; i++) {
        socketGenerator.generateSockets(template);
      }

      // Measure performance over 10 batches to detect degradation
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = performance.now();

        for (let i = 0; i < 100; i++) {
          socketGenerator.generateSockets(template);
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

      // All batches should complete within reasonable time (100 operations in < 50ms)
      times.forEach((time) => {
        expect(time).toBeLessThan(50);
      });
    });

    it('should maintain consistent performance across multiple generations', () => {
      const templates = [
        createStructureTemplate(1, 1), // 1 socket
        createStructureTemplate(1, 10), // 10 sockets
        createStructureTemplate(1, 50), // 50 sockets
        createAppendageTemplate(20), // 20 appendages
      ];

      const iterations = 100;

      for (const template of templates) {
        // Warmup
        for (let i = 0; i < 100; i++) {
          socketGenerator.generateSockets(template);
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          socketGenerator.generateSockets(template);
        }
        const totalTime = performance.now() - start;

        // All template variations should maintain good performance
        expect(totalTime).toBeLessThan(100);
      }
    });
  });

  describe('Performance Summary', () => {
    it('should demonstrate that socket generation is performant across all scales', () => {
      const testCases = [
        {
          name: '1 socket',
          template: createStructureTemplate(1, 1),
          target: 0.01,
        },
        {
          name: '10 sockets',
          template: createStructureTemplate(1, 10),
          target: 0.1,
        },
        {
          name: '20 sockets',
          template: createStructureTemplate(1, 20),
          target: 0.2,
        },
        {
          name: '50 sockets',
          template: createStructureTemplate(1, 50),
          target: 0.5,
        },
        {
          name: '100 sockets',
          template: createStructureTemplate(1, 100),
          target: 1,
        },
      ];

      console.log('\n=== Socket Generation Performance Summary ===');

      const results = [];

      for (const testCase of testCases) {
        const iterations = 1000;

        // Warmup
        for (let i = 0; i < 100; i++) {
          socketGenerator.generateSockets(testCase.template);
        }

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          socketGenerator.generateSockets(testCase.template);
        }
        const totalTime = performance.now() - start;
        const avgTime = totalTime / iterations;

        results.push({
          name: testCase.name,
          avgTime,
          target: testCase.target,
          passed: avgTime < testCase.target,
        });

        console.log(
          `${testCase.name}: ${avgTime.toFixed(4)}ms avg (target: <${testCase.target}ms) - ${avgTime < testCase.target ? '✓ PASS' : '✗ FAIL'}`
        );
      }

      // All test cases should pass their performance targets
      results.forEach((result) => {
        expect(result.passed).toBe(true);
      });

      console.log('===========================================\n');
    });
  });
});
