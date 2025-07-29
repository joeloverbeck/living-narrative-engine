/**
 * @file Performance benchmarks for ActionDefinitionBuilder integration scenarios
 * @description Tests focused on performance aspects of ActionDefinitionBuilder when used
 * in integration contexts - bulk operations, rapid cycles, and consistency across action types
 */

import { describe, it, expect } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';
import { validateActionStructure } from '../../common/actions/actionBuilderHelpers.js';

describe('ActionDefinitionBuilder Integration Performance', () => {
  describe('bulk operations performance', () => {
    it('should handle bulk creation efficiently', () => {
      const startTime = performance.now();

      const actions = Array.from({ length: 1000 }, (_, i) =>
        new ActionDefinitionBuilder(`test:action${i}`)
          .withName(`Action ${i}`)
          .withDescription(`Test action ${i}`)
          .asBasicAction()
          .build()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(actions).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be less than 100ms

      // Verify all actions are valid
      actions.forEach((action) => {
        expect(validateActionStructure(action)).toBe(true);
        expect(action.id).toMatch(/^test:action\d+$/);
      });

      console.log(
        `Bulk creation time: ${duration.toFixed(2)}ms for 1000 actions`
      );
    });

    it('should create individual actions quickly', () => {
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        new ActionDefinitionBuilder(`test:perf${i}`)
          .withName(`Performance Test ${i}`)
          .withDescription(`Performance test action ${i}`)
          .asTargetedAction('test:scope')
          .requiresComponent('test:component')
          .withPrerequisite('test:condition')
          .build();

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(avgTime).toBeLessThan(0.1); // Less than 0.1ms per action on average

      console.log(
        `Individual creation average time: ${avgTime.toFixed(4)}ms per action`
      );
    });
  });

  describe('stress testing and consistency', () => {
    it('should handle rapid creation and destruction cycles', () => {
      // Test memory management under rapid allocation/deallocation
      const startTime = performance.now();

      for (let cycle = 0; cycle < 10; cycle++) {
        const builders = Array.from({ length: 100 }, (_, i) =>
          new ActionDefinitionBuilder(`perf:cycle${cycle}-action${i}`)
            .withName(`Performance Action ${i}`)
            .withDescription(`Cycle ${cycle} performance test action ${i}`)
            .asBasicAction()
        );

        const actions = builders.map((builder) => builder.build());

        // Verify all actions in this cycle
        actions.forEach((action) => {
          expect(validateActionStructure(action)).toBe(true);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 actions across 10 cycles in reasonable time
      expect(duration).toBeLessThan(500); // Less than 500ms total

      console.log(
        `Rapid cycles time: ${duration.toFixed(2)}ms for 1000 actions across 10 cycles`
      );
    });

    it('should maintain consistent performance across different action types', () => {
      const actionTypes = [
        () =>
          new ActionDefinitionBuilder('perf:basic')
            .withName('Basic')
            .withDescription('Basic action')
            .asBasicAction()
            .build(),
        () =>
          new ActionDefinitionBuilder('perf:targeted')
            .withName('Targeted')
            .withDescription('Targeted action')
            .asTargetedAction('test:scope')
            .build(),
        () =>
          new ActionDefinitionBuilder('perf:movement')
            .withName('Movement')
            .withDescription('Movement action')
            .asMovementAction()
            .asBasicAction()
            .build(),
        () =>
          new ActionDefinitionBuilder('perf:combat')
            .withName('Combat')
            .withDescription('Combat action')
            .asCombatAction()
            .asBasicAction()
            .build(),
        () =>
          new ActionDefinitionBuilder('perf:complex')
            .withName('Complex')
            .withDescription('Complex action')
            .asTargetedAction('test:scope')
            .asCombatAction()
            .requiresComponents(['test:a', 'test:b', 'test:c'])
            .withPrerequisites(['test:x', 'test:y', 'test:z'])
            .build(),
      ];

      const times = actionTypes.map((createAction) => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          createAction();
        }
        return performance.now() - start;
      });

      // All action types should have similar performance characteristics
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;

      // Variance should be reasonable (less than 50ms difference)
      expect(variance).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100); // No single type should take more than 100ms for 100 actions

      console.log('Action type performance consistency:');
      times.forEach((time, index) => {
        const typeNames = ['basic', 'targeted', 'movement', 'combat', 'complex'];
        console.log(`  ${typeNames[index]}: ${time.toFixed(2)}ms for 100 actions`);
      });
      console.log(`  Variance: ${variance.toFixed(2)}ms`);
    });
  });
});