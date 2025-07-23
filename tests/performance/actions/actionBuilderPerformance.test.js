/**
 * @file Performance benchmarks for ActionDefinitionBuilder
 * @description Comprehensive performance testing to ensure the builder meets
 * performance requirements and detect regressions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';

describe('ActionDefinitionBuilder Performance', () => {
  describe('creation performance', () => {
    it('should create definitions quickly (target: <0.1ms per action)', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new ActionDefinitionBuilder(`test:action${i}`)
          .withName(`Action ${i}`)
          .withDescription(`Description ${i}`)
          .asBasicAction()
          .build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.1); // Less than 0.1ms per action

      // Log performance metrics for monitoring
      console.log(`Average creation time: ${avgTime.toFixed(4)}ms per action`);
      console.log(
        `Total time for ${iterations} actions: ${(endTime - startTime).toFixed(2)}ms`
      );
    });

    it('should handle bulk creation efficiently (target: <100ms for 1000 actions)', () => {
      const startTime = performance.now();

      const actions = Array.from({ length: 1000 }, (_, i) =>
        new ActionDefinitionBuilder(`test:action${i}`)
          .withName(`Action ${i}`)
          .withDescription(`Description ${i}`)
          .asBasicAction()
          .build()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(actions).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be less than 100ms for 1000 actions

      console.log(
        `Bulk creation time: ${duration.toFixed(2)}ms for 1000 actions`
      );
    });

    it('should scale linearly with complexity', () => {
      const testCases = [
        { size: 100, name: '100 actions' },
        { size: 500, name: '500 actions' },
        { size: 1000, name: '1000 actions' },
      ];

      const results = [];

      testCases.forEach(({ size, name }) => {
        const startTime = performance.now();

        const actions = Array.from({ length: size }, (_, i) =>
          new ActionDefinitionBuilder(`test:scale${i}`)
            .withName(`Scale Test ${i}`)
            .withDescription(`Scale test action ${i}`)
            .asTargetedAction('test:scope')
            .requiresComponent('test:component')
            .withPrerequisite('test:condition')
            .build()
        );

        const endTime = performance.now();
        const duration = endTime - startTime;
        const avgTime = duration / size;

        results.push({ size, duration, avgTime });

        expect(actions).toHaveLength(size);
        expect(avgTime).toBeLessThan(0.2); // Should remain under 0.2ms per action

        console.log(
          `${name}: ${duration.toFixed(2)}ms total, ${avgTime.toFixed(4)}ms per action`
        );
      });

      // Check that performance scales reasonably (within 2x factor)
      const baselineAvg = results[0].avgTime;
      results.forEach(({ size, avgTime }) => {
        expect(avgTime).toBeLessThan(baselineAvg * 2);
      });
    });
  });

  describe('complex operation performance', () => {
    it('should handle complex configurations efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new ActionDefinitionBuilder(`test:complex${i}`)
          .withName(`Complex Action ${i}`)
          .withDescription(`Complex action with many requirements ${i}`)
          .asTargetedAction(
            'test:targets',
            `perform complex operation ${i} on {target}`
          )
          .requiresComponents([
            'test:comp1',
            'test:comp2',
            'test:comp3',
            'test:comp4',
            'test:comp5',
          ])
          .withPrerequisites([
            'test:cond1',
            { condition: 'test:cond2', message: 'Custom message 1' },
            'test:cond3',
            { condition: 'test:cond4', message: 'Custom message 2' },
            'test:cond5',
          ])
          .asCombatAction()
          .build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.5); // Should be under 0.5ms even for complex actions

      console.log(
        `Complex action average time: ${avgTime.toFixed(4)}ms per action`
      );
    });

    it('should handle large component arrays efficiently', () => {
      const componentCount = 100;
      const components = Array.from(
        { length: componentCount },
        (_, i) => `test:comp${i}`
      );

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new ActionDefinitionBuilder(`test:large${i}`)
          .withName(`Large Components ${i}`)
          .withDescription(`Action with ${componentCount} components`)
          .asBasicAction()
          .requiresComponents(components)
          .build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1.0); // Should handle 100 components in under 1ms

      console.log(
        `Large components average time: ${avgTime.toFixed(4)}ms per action`
      );
    });

    it('should handle large prerequisite arrays efficiently', () => {
      const prerequisiteCount = 50;
      const prerequisites = Array.from(
        { length: prerequisiteCount },
        (_, i) => `test:cond${i}`
      );

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        new ActionDefinitionBuilder(`test:prereqs${i}`)
          .withName(`Large Prerequisites ${i}`)
          .withDescription(`Action with ${prerequisiteCount} prerequisites`)
          .asBasicAction()
          .withPrerequisites(prerequisites)
          .build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1.0); // Should handle 50 prerequisites in under 1ms

      console.log(
        `Large prerequisites average time: ${avgTime.toFixed(4)}ms per action`
      );
    });
  });

  describe('memory usage', () => {
    it('should have minimal memory overhead (target: <2KB per action)', () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const initialMemory = process.memoryUsage().heapUsed;

        const actions = Array.from({ length: 1000 }, (_, i) =>
          new ActionDefinitionBuilder(`test:memory${i}`)
            .withName(`Memory Test ${i}`)
            .withDescription(`Memory test action ${i}`)
            .asBasicAction()
            .build()
        );

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryPerAction = (finalMemory - initialMemory) / 1000;

        expect(memoryPerAction).toBeLessThan(2048); // Less than 2KB per action
        expect(actions).toHaveLength(1000);

        console.log(
          `Memory usage: ${memoryPerAction.toFixed(0)} bytes per action`
        );
        console.log(
          `Total memory increase: ${((finalMemory - initialMemory) / 1024).toFixed(2)} KB`
        );
      } else {
        // Skip memory test in browser environment
        console.log('Memory test skipped (not in Node.js environment)');
        expect(true).toBe(true);
      }
    });

    it('should not leak memory during repeated operations', () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memorySnapshots = [];

        // Take memory snapshots during repeated operations
        for (let cycle = 0; cycle < 5; cycle++) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          const beforeMemory = process.memoryUsage().heapUsed;

          // Create and discard many actions
          for (let i = 0; i < 200; i++) {
            new ActionDefinitionBuilder(`test:leak${cycle}_${i}`)
              .withName(`Leak Test ${cycle}_${i}`)
              .withDescription(`Leak test action ${cycle}_${i}`)
              .asTargetedAction('test:scope')
              .requiresComponent('test:component')
              .withPrerequisite('test:condition')
              .build();
          }

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          const afterMemory = process.memoryUsage().heapUsed;
          memorySnapshots.push(afterMemory - beforeMemory);
        }

        // Memory usage should not grow significantly across cycles
        const firstCycle = memorySnapshots[0];
        const lastCycle = memorySnapshots[memorySnapshots.length - 1];
        const growthRatio = lastCycle / firstCycle;

        expect(growthRatio).toBeLessThan(2.0); // Memory shouldn't double

        console.log(
          'Memory snapshots:',
          memorySnapshots.map((m) => `${(m / 1024).toFixed(2)}KB`)
        );
        console.log(`Memory growth ratio: ${growthRatio.toFixed(2)}x`);
      } else {
        console.log('Memory leak test skipped (not in Node.js environment)');
        expect(true).toBe(true);
      }
    });
  });

  describe('validation performance', () => {
    it('should validate efficiently', () => {
      const builder = new ActionDefinitionBuilder('test:validation')
        .withName('Validation Test')
        .withDescription('Testing validation performance')
        .asTargetedAction('test:scope')
        .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
        .withPrerequisites(['test:cond1', 'test:cond2']);

      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        builder.validate();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.01); // Should validate in under 0.01ms

      console.log(
        `Validation average time: ${avgTime.toFixed(6)}ms per validation`
      );
    });

    it('should build efficiently after validation', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const builder = new ActionDefinitionBuilder(`test:build${i}`)
          .withName(`Build Test ${i}`)
          .withDescription(`Build test action ${i}`)
          .asBasicAction();

        // Validate then build (includes validation)
        builder.validate();
        builder.build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.2); // Should validate + build in under 0.2ms

      console.log(
        `Validate + build average time: ${avgTime.toFixed(4)}ms per operation`
      );
    });
  });

  describe('fromDefinition performance', () => {
    it('should recreate builders efficiently', () => {
      // Create a complex definition to recreate
      const originalDefinition = new ActionDefinitionBuilder('test:original')
        .withName('Original Action')
        .withDescription('Original complex action')
        .asTargetedAction('test:targets')
        .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
        .withPrerequisites([
          'test:cond1',
          { condition: 'test:cond2', message: 'Custom message' },
          'test:cond3',
        ])
        .build();

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        ActionDefinitionBuilder.fromDefinition(originalDefinition).build();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.3); // Should recreate in under 0.3ms

      console.log(
        `fromDefinition average time: ${avgTime.toFixed(4)}ms per recreation`
      );
    });
  });

  describe('comparison benchmarks', () => {
    it('should compare builder vs manual object creation', () => {
      const iterations = 1000;

      // Benchmark builder creation
      const builderStartTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        new ActionDefinitionBuilder(`test:builder${i}`)
          .withName(`Builder Test ${i}`)
          .withDescription(`Builder test action ${i}`)
          .asTargetedAction('test:scope')
          .requiresComponent('test:component')
          .withPrerequisite('test:condition')
          .build();
      }
      const builderEndTime = performance.now();
      const builderTime = builderEndTime - builderStartTime;

      // Benchmark manual object creation
      const manualStartTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        const manualDefinition = {
          id: `test:manual${i}`,
          name: `Manual Test ${i}`,
          description: `Manual test action ${i}`,
          scope: 'test:scope',
          template: `manual test ${i} {target}`,
          prerequisites: ['test:condition'],
          required_components: {
            actor: ['test:component'],
          },
        };
        // Simulate the same validation and cloning that builder does
        JSON.parse(JSON.stringify(manualDefinition));
      }
      const manualEndTime = performance.now();
      const manualTime = manualEndTime - manualStartTime;

      const builderAvg = builderTime / iterations;
      const manualAvg = manualTime / iterations;
      const overhead = ((builderTime - manualTime) / manualTime) * 100;

      // Builder should have less than 100% overhead compared to manual creation
      expect(overhead).toBeLessThan(100);

      console.log(`Builder average: ${builderAvg.toFixed(4)}ms per action`);
      console.log(`Manual average: ${manualAvg.toFixed(4)}ms per action`);
      console.log(`Builder overhead: ${overhead.toFixed(1)}%`);
    });
  });

  describe('regression testing', () => {
    it('should maintain performance baselines', () => {
      // This test establishes performance baselines to detect regressions
      const performanceBaselines = {
        simpleCreation: 0.1, // ms
        complexCreation: 0.5, // ms
        validation: 0.01, // ms
        memoryPerAction: 2048, // bytes
        builderOverhead: 100, // percent
      };

      // Test simple creation
      const simpleStart = performance.now();
      new ActionDefinitionBuilder('test:baseline')
        .withName('Baseline Test')
        .withDescription('Baseline test action')
        .asBasicAction()
        .build();
      const simpleTime = performance.now() - simpleStart;

      expect(simpleTime).toBeLessThan(performanceBaselines.simpleCreation);

      // Test complex creation
      const complexStart = performance.now();
      new ActionDefinitionBuilder('test:complex-baseline')
        .withName('Complex Baseline')
        .withDescription('Complex baseline test')
        .asTargetedAction('test:scope')
        .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
        .withPrerequisites(['test:cond1', 'test:cond2'])
        .asCombatAction()
        .build();
      const complexTime = performance.now() - complexStart;

      expect(complexTime).toBeLessThan(performanceBaselines.complexCreation);

      console.log('Performance baselines maintained:');
      console.log(
        `Simple creation: ${simpleTime.toFixed(4)}ms (limit: ${performanceBaselines.simpleCreation}ms)`
      );
      console.log(
        `Complex creation: ${complexTime.toFixed(4)}ms (limit: ${performanceBaselines.complexCreation}ms)`
      );
    });
  });
});
