/**
 * @file Memory usage tests for ActionDefinitionBuilder integration scenarios
 * @description Tests focused on memory consumption and garbage collection behavior
 * when using ActionDefinitionBuilder in bulk operations and stress scenarios
 */

import { describe, it, expect } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';

describe('ActionDefinitionBuilder Integration Memory Tests', () => {
  describe('memory overhead analysis', () => {
    it('should have minimal memory overhead', () => {
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
          `Total memory increase: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)} MB for 1000 actions`
        );
      } else {
        // Skip memory test in browser environment
        expect(true).toBe(true);
      }
    });
  });

  describe('garbage collection stress testing', () => {
    if (typeof global !== 'undefined' && global.gc) {
      it('should not create excessive garbage under stress', () => {
        // Only run this test if garbage collection is available
        const initialMemory = process.memoryUsage().heapUsed;

        // Force garbage collection before test
        global.gc();
        const baselineMemory = process.memoryUsage().heapUsed;

        // Create and destroy many builders
        for (let i = 0; i < 1000; i++) {
          const builder = new ActionDefinitionBuilder(`stress:action${i}`)
            .withName(`Stress Action ${i}`)
            .withDescription(`Stress test action ${i}`)
            .asTargetedAction('stress:scope')
            .requiresComponents([
              'stress:comp1',
              'stress:comp2',
              'stress:comp3',
            ])
            .withPrerequisites([
              'stress:cond1',
              'stress:cond2',
              'stress:cond3',
            ]);

          const action = builder.build();

          // Use the action briefly
          expect(action.id).toBeDefined();
        }

        // Force garbage collection after test
        global.gc();
        const finalMemory = process.memoryUsage().heapUsed;

        const memoryIncrease = finalMemory - baselineMemory;

        // Memory increase should be reasonable (less than 10MB for 1000 actions)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

        console.log(
          `Garbage collection test - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB for 1000 stress test actions`
        );
      });
    } else {
      it('should skip garbage collection test when global.gc is not available', () => {
        // This test is skipped when --expose-gc is not available
        expect(true).toBe(true);
      });
    }
  });
});