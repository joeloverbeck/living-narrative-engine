/**
 * @file Performance tests for ActionDefinitionBuilder
 * @description Performance benchmarks for ActionDefinitionBuilder operations,
 * including creation speed, bulk operations, and extreme list handling
 */

import { describe, it, expect } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../../src/actions/builders/actionDefinitionBuilder.js';

describe('ActionDefinitionBuilder Performance', () => {
  describe('performance benchmarks', () => {
    it('should create individual actions quickly', () => {
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        new ActionDefinitionBuilder(`test:perf${i}`)
          .withName(`Performance Test ${i}`)
          .withDescription(`Performance test action ${i}`)
          .asBasicAction()
          .build();

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(avgTime).toBeLessThan(0.5); // Less than 0.5ms per action on average
    });

    it('should handle bulk creation efficiently', () => {
      const startTime = performance.now();

      const actions = Array.from({ length: 100 }, (_, i) =>
        new ActionDefinitionBuilder(`test:bulk${i}`)
          .withName(`Bulk Test ${i}`)
          .withDescription(`Bulk test action ${i}`)
          .asTargetedAction('test:scope')
          .requiresComponent('test:component')
          .withPrerequisite('test:condition')
          .build()
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(actions).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should be less than 50ms for 100 actions
    });
  });

  describe('extreme scale handling', () => {
    it('should handle extreme component list sizes', () => {
      const components = Array.from(
        { length: 50 },
        (_, i) => `test:component${i}`
      );

      const action = new ActionDefinitionBuilder('test:many-components')
        .withName('Many Components')
        .withDescription('Testing many components')
        .asBasicAction()
        .requiresComponents(components)
        .build();

      expect(action.required_components.actor).toHaveLength(50);
      expect(action.required_components.actor).toEqual(components);
    });

    it('should handle extreme prerequisite list sizes', () => {
      const prerequisites = Array.from(
        { length: 30 },
        (_, i) => `test:condition${i}`
      );

      const action = new ActionDefinitionBuilder('test:many-prereqs')
        .withName('Many Prerequisites')
        .withDescription('Testing many prerequisites')
        .asBasicAction()
        .withPrerequisites(prerequisites)
        .build();

      expect(action.prerequisites).toHaveLength(30);
      expect(action.prerequisites).toEqual(prerequisites);
    });
  });
});