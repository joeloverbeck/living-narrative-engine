/**
 * @file Advanced edge case tests for ActionDefinitionBuilder
 * @description Comprehensive edge case testing for complex scenarios, boundary conditions,
 * and error recovery situations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../../src/actions/builders/actionDefinitionBuilder.js';
import { InvalidActionDefinitionError } from '../../../../src/errors/invalidActionDefinitionError.js';

describe('ActionDefinitionBuilder - Advanced Edge Cases', () => {
  describe('extreme input scenarios', () => {
    it('should handle very large component arrays', () => {
      const largeComponentArray = Array.from(
        { length: 1000 },
        (_, i) => `test:component${i}`
      );

      const action = new ActionDefinitionBuilder('test:large-components')
        .withName('Large Components Test')
        .withDescription('Testing with 1000 components')
        .asBasicAction()
        .requiresComponents(largeComponentArray)
        .build();

      expect(action.required_components.actor).toHaveLength(1000);
      expect(action.required_components.actor[0]).toBe('test:component0');
      expect(action.required_components.actor[999]).toBe('test:component999');
    });

    it('should handle very large prerequisite arrays', () => {
      const largePrerequisiteArray = Array.from(
        { length: 500 },
        (_, i) => `test:condition${i}`
      );

      const action = new ActionDefinitionBuilder('test:large-prerequisites')
        .withName('Large Prerequisites Test')
        .withDescription('Testing with 500 prerequisites')
        .asBasicAction()
        .withPrerequisites(largePrerequisiteArray)
        .build();

      expect(action.prerequisites).toHaveLength(500);
      expect(action.prerequisites[0]).toBe('test:condition0');
      expect(action.prerequisites[499]).toBe('test:condition499');
    });

    it('should handle extremely long strings', () => {
      const veryLongString = 'a'.repeat(10000);

      const action = new ActionDefinitionBuilder('test:long-strings')
        .withName(veryLongString)
        .withDescription(veryLongString)
        .withScope('test:scope')
        .withTemplate(`very long template ${veryLongString} {target}`)
        .build();

      expect(action.name).toHaveLength(10000);
      expect(action.description).toHaveLength(10000);
      expect(action.template).toContain(veryLongString);
    });

    it('should handle special characters in all string fields', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';

      const action = new ActionDefinitionBuilder('test:special-chars')
        .withName(`Name with ${specialChars}`)
        .withDescription(`Description with ${specialChars}`)
        .withScope('test:scope')
        .withTemplate(`Template with ${specialChars} {target}`)
        .build();

      expect(action.name).toContain(specialChars);
      expect(action.description).toContain(specialChars);
      expect(action.template).toContain(specialChars);
    });

    it('should handle unicode and emoji characters', () => {
      const unicodeText = '你好世界 🌍🎮🚀⚡🔥💎🌟⭐🎯🎲';

      const action = new ActionDefinitionBuilder('test:unicode')
        .withName(`Unicode ${unicodeText}`)
        .withDescription(`Description with ${unicodeText}`)
        .withScope('test:scope')
        .withTemplate(`Unicode template ${unicodeText} {target}`)
        .build();

      expect(action.name).toContain(unicodeText);
      expect(action.description).toContain(unicodeText);
      expect(action.template).toContain(unicodeText);
    });
  });

  describe('complex prerequisite combinations', () => {
    it('should handle mixed prerequisite formats in large numbers', () => {
      const prerequisites = [];

      // Add 50 simple string prerequisites
      for (let i = 0; i < 50; i++) {
        prerequisites.push(`test:simple${i}`);
      }

      // Add 50 complex object prerequisites
      for (let i = 0; i < 50; i++) {
        prerequisites.push({
          condition: `test:complex${i}`,
          message: `Complex failure message ${i}`,
        });
      }

      const action = new ActionDefinitionBuilder('test:mixed-prereqs')
        .withName('Mixed Prerequisites Test')
        .withDescription('Testing mixed prerequisite formats')
        .asBasicAction()
        .withPrerequisites(prerequisites)
        .build();

      expect(action.prerequisites).toHaveLength(100);

      // Check first 50 are strings
      for (let i = 0; i < 50; i++) {
        expect(action.prerequisites[i]).toBe(`test:simple${i}`);
      }

      // Check last 50 are objects
      for (let i = 50; i < 100; i++) {
        const complexIndex = i - 50;
        expect(action.prerequisites[i]).toEqual({
          logic: { condition_ref: `test:complex${complexIndex}` },
          failure_message: `Complex failure message ${complexIndex}`,
        });
      }
    });

    it('should handle nested prerequisite additions', () => {
      let builder = new ActionDefinitionBuilder('test:nested-prereqs')
        .withName('Nested Prerequisites')
        .withDescription('Testing nested prerequisite additions')
        .asBasicAction();

      // Add prerequisites in multiple stages
      for (let stage = 0; stage < 10; stage++) {
        const stagePrereqs = [];
        for (let i = 0; i < 5; i++) {
          stagePrereqs.push(`test:stage${stage}_prereq${i}`);
        }
        builder = builder.withPrerequisites(stagePrereqs);
      }

      const action = builder.build();
      expect(action.prerequisites).toHaveLength(50);
    });

    it('should handle prerequisite duplication across different addition methods', () => {
      const action = new ActionDefinitionBuilder('test:prereq-duplication')
        .withName('Prerequisite Duplication')
        .withDescription('Testing prerequisite duplication scenarios')
        .asBasicAction()
        .withPrerequisite('test:duplicate', 'First message')
        .withPrerequisites(['test:duplicate', 'test:unique'])
        .withPrerequisite('test:duplicate', 'Second message')
        .withPrerequisites([
          { condition: 'test:duplicate', message: 'Third message' },
          'test:another-unique',
        ])
        .build();

      // Should have all duplicates (not deduplicated for prerequisites)
      expect(action.prerequisites).toHaveLength(6);

      // Check the various formats are preserved
      expect(action.prerequisites[0]).toEqual({
        logic: { condition_ref: 'test:duplicate' },
        failure_message: 'First message',
      });
      expect(action.prerequisites[1]).toBe('test:duplicate');
      expect(action.prerequisites[2]).toBe('test:unique');
    });
  });

  describe('component requirement edge cases', () => {
    it('should handle component deduplication across multiple calls', () => {
      const action = new ActionDefinitionBuilder('test:component-dedup')
        .withName('Component Deduplication')
        .withDescription('Testing component deduplication')
        .asBasicAction()
        .requiresComponent('test:duplicate')
        .requiresComponents(['test:duplicate', 'test:unique1'])
        .requiresComponent('test:duplicate') // Another duplicate
        .requiresComponents(['test:unique2', 'test:duplicate'])
        .asCombatAction() // Adds core:position and core:health
        .requiresComponent('test:duplicate') // Yet another duplicate
        .build();

      // Should deduplicate test:duplicate but keep all unique ones
      const components = action.required_components.actor;
      const duplicateCount = components.filter(
        (c) => c === 'test:duplicate'
      ).length;

      expect(duplicateCount).toBe(1);
      expect(components).toContain('test:duplicate');
      expect(components).toContain('test:unique1');
      expect(components).toContain('test:unique2');
      expect(components).toContain('core:position');
      expect(components).toContain('core:health');
    });

    it('should handle empty arrays mixed with non-empty arrays', () => {
      const action = new ActionDefinitionBuilder('test:mixed-arrays')
        .withName('Mixed Arrays')
        .withDescription('Testing mixed empty and non-empty arrays')
        .asBasicAction()
        .requiresComponents([]) // Empty array
        .requiresComponent('test:component1')
        .requiresComponents(['test:component2', 'test:component3'])
        .requiresComponents([]) // Another empty array
        .requiresComponent('test:component4')
        .withPrerequisites([]) // Empty prerequisites
        .withPrerequisite('test:condition1')
        .withPrerequisites(['test:condition2'])
        .withPrerequisites([]) // Another empty prerequisites array
        .build();

      expect(action.required_components.actor).toEqual([
        'test:component1',
        'test:component2',
        'test:component3',
        'test:component4',
      ]);
      expect(action.prerequisites).toEqual([
        'test:condition1',
        'test:condition2',
      ]);
    });
  });

  describe('convenience method interactions', () => {
    it('should handle complex convenience method combinations', () => {
      const action = new ActionDefinitionBuilder('test:complex-convenience')
        .withName('Complex Convenience')
        .withDescription('Testing complex convenience method combinations')
        .asTargetedAction('test:targets', 'complex {target}')
        .asMovementAction() // Adds core:position + anatomy:actor-can-move
        .asCombatAction() // Adds core:health + core:has-health (position already exists)
        .requiresComponent('extra:component1')
        .withPrerequisite('extra:condition1')
        .requiresComponents(['extra:component2', 'extra:component3'])
        .withPrerequisites([
          'extra:condition2',
          { condition: 'extra:condition3', message: 'Extra failure' },
        ])
        .build();

      // Check all components are present (with deduplication)
      const components = action.required_components.actor;
      expect(components).toContain('core:position'); // From both movement and combat
      expect(components).toContain('core:health'); // From combat
      expect(components).toContain('extra:component1');
      expect(components).toContain('extra:component2');
      expect(components).toContain('extra:component3');

      // Position should only appear once due to deduplication
      const positionCount = components.filter(
        (c) => c === 'core:position'
      ).length;
      expect(positionCount).toBe(1);

      // Check all prerequisites are present
      const allConditionRefs = action.prerequisites.map((p) =>
        typeof p === 'string' ? p : p.logic?.condition_ref
      );
      expect(allConditionRefs).toContain('anatomy:actor-can-move');
      expect(allConditionRefs).toContain('core:has-health');
      expect(allConditionRefs).toContain('extra:condition1');
      expect(allConditionRefs).toContain('extra:condition2');
      expect(allConditionRefs).toContain('extra:condition3');
    });

    it('should handle order-dependent convenience method calls', () => {
      // Test different orders of convenience method calls
      // All orders must include either asBasicAction or asTargetedAction to set scope/template
      const orders = [
        ['asBasicAction', 'asMovementAction', 'asCombatAction'],
        ['asTargetedAction', 'asCombatAction', 'asMovementAction'],
        ['asTargetedAction', 'asMovementAction', 'asCombatAction'],
        ['asBasicAction', 'asCombatAction', 'asMovementAction'],
      ];

      orders.forEach((order, index) => {
        let builder = new ActionDefinitionBuilder(`test:order${index}`)
          .withName(`Order Test ${index}`)
          .withDescription(`Testing order ${order.join(' -> ')}`);

        // Apply methods in the specified order
        order.forEach((methodName) => {
          switch (methodName) {
            case 'asBasicAction':
              builder = builder.asBasicAction();
              break;
            case 'asTargetedAction':
              builder = builder.asTargetedAction('test:scope');
              break;
            case 'asMovementAction':
              builder = builder.asMovementAction();
              break;
            case 'asCombatAction':
              builder = builder.asCombatAction();
              break;
          }
        });

        const action = builder.build();

        // All orders should result in the same final components
        // (because of deduplication)
        if (order.includes('asCombatAction')) {
          expect(action.required_components.actor).toContain('core:position');
          expect(action.required_components.actor).toContain('core:health');
        }
        if (order.includes('asMovementAction')) {
          expect(action.required_components.actor).toContain('core:position');
        }
      });
    });
  });

  describe('validation and build edge cases', () => {
    it('should handle multiple validation calls without side effects', () => {
      const builder = new ActionDefinitionBuilder('test:multiple-validations')
        .withName('Multiple Validations')
        .withDescription('Testing multiple validation calls')
        .asBasicAction();

      // Call validate multiple times
      const result1 = builder.validate();
      const result2 = builder.validate();
      const result3 = builder.validate();

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.isValid).toBe(true);

      // Should still be able to build after multiple validations
      const action = builder.build();
      expect(action).toBeDefined();
    });

    it('should handle toPartial calls during different states', () => {
      const builder = new ActionDefinitionBuilder('test:partial-states');

      const state1 = builder.toPartial();
      expect(state1.name).toBeUndefined();

      builder.withName('Test Name');
      const state2 = builder.toPartial();
      expect(state2.name).toBe('Test Name');
      expect(state2.description).toBeUndefined();

      builder.withDescription('Test Description');
      const state3 = builder.toPartial();
      expect(state3.name).toBe('Test Name');
      expect(state3.description).toBe('Test Description');

      // Previous states should remain unchanged
      expect(state1.name).toBeUndefined();
      expect(state2.description).toBeUndefined();
    });

    it('should maintain immutability across multiple build calls', () => {
      const builder = new ActionDefinitionBuilder('test:immutable-builds')
        .withName('Immutable Test')
        .withDescription('Testing immutability')
        .asBasicAction();

      const action1 = builder.build();
      const action2 = builder.build();
      const action3 = builder.build();

      // All builds should be separate objects
      expect(action1).not.toBe(action2);
      expect(action2).not.toBe(action3);
      expect(action1).not.toBe(action3);

      // But should have identical content
      expect(action1).toEqual(action2);
      expect(action2).toEqual(action3);

      // Mutating one shouldn't affect others
      action1.name = 'Modified';
      expect(action2.name).toBe('Immutable Test');
      expect(action3.name).toBe('Immutable Test');
    });
  });

  describe('fromDefinition edge cases', () => {
    it('should handle definitions with unusual but valid structures', () => {
      const unusualDefinition = {
        id: 'test:unusual',
        name: 'Unusual Definition',
        description: 'Definition with unusual structure',
        scope: 'test:unusual-scope',
        template: 'unusual template {target}',
        prerequisites: [
          'test:simple',
          { logic: { condition_ref: 'test:complex' } }, // No failure message
          {
            logic: { condition_ref: 'test:with-message' },
            failure_message: 'Has message',
          },
        ],
        required_components: { actor: ['test:comp1', 'test:comp2'] },
        // Extra properties that should be ignored
        extraProperty1: 'should be ignored',
        extraProperty2: { nested: 'also ignored' },
      };

      const builder = ActionDefinitionBuilder.fromDefinition(unusualDefinition);
      const recreated = builder.build();

      expect(recreated.id).toBe('test:unusual');
      expect(recreated.name).toBe('Unusual Definition');
      expect(recreated.prerequisites).toHaveLength(3);
      expect(recreated.prerequisites[0]).toBe('test:simple');
      expect(recreated.prerequisites[1]).toBe('test:complex'); // Converted to simple string
      expect(recreated.prerequisites[2]).toEqual({
        logic: { condition_ref: 'test:with-message' },
        failure_message: 'Has message',
      });

      // Extra properties should not be in the final definition
      expect(recreated).not.toHaveProperty('extraProperty1');
      expect(recreated).not.toHaveProperty('extraProperty2');
    });

    it('should handle definitions with null and undefined optional fields', () => {
      const sparseDefinition = {
        id: 'test:sparse',
        name: 'Sparse Definition',
        description: 'Definition with sparse fields',
        scope: 'test:scope',
        template: 'sparse {target}',
        prerequisites: null, // Should be handled gracefully
        required_components: undefined, // Should be handled gracefully
      };

      const builder = ActionDefinitionBuilder.fromDefinition(sparseDefinition);
      const recreated = builder.build();

      expect(recreated.prerequisites).toEqual([]);
      expect(recreated.required_components.actor).toEqual([]);
    });

    it('should handle round-trip conversion preserving complex structures', () => {
      // Create a complex action with all features
      const originalAction = new ActionDefinitionBuilder('test:roundtrip')
        .withName('Round Trip Test')
        .withDescription('Testing round-trip conversion')
        .asTargetedAction('test:complex-scope', 'complex action on {target}')
        .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
        .withPrerequisites([
          'test:simple1',
          { condition: 'test:complex1', message: 'Complex message 1' },
          'test:simple2',
          { condition: 'test:complex2', message: 'Complex message 2' },
        ])
        .asCombatAction()
        .build();

      // Convert to builder and back
      const recreatedBuilder =
        ActionDefinitionBuilder.fromDefinition(originalAction);
      const recreatedAction = recreatedBuilder.build();

      // Should be identical
      expect(recreatedAction).toEqual(originalAction);

      // Multiple round trips should remain stable
      for (let i = 0; i < 5; i++) {
        const builder = ActionDefinitionBuilder.fromDefinition(recreatedAction);
        const action = builder.build();
        expect(action).toEqual(originalAction);
      }
    });
  });

  describe('error recovery and resilience', () => {
    it('should recover from validation errors when fields are added', () => {
      const builder = new ActionDefinitionBuilder('test:error-recovery');

      // Initially invalid
      let validation = builder.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Add name - still invalid
      builder.withName('Recovery Test');
      validation = builder.validate();
      expect(validation.isValid).toBe(false);

      // Add description - still invalid
      builder.withDescription('Testing error recovery');
      validation = builder.validate();
      expect(validation.isValid).toBe(false);

      // Add scope and template - should become valid
      builder.asBasicAction();
      validation = builder.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);

      // Should be able to build now
      const action = builder.build();
      expect(action).toBeDefined();
    });

    it('should handle builder modifications after partial build attempts', () => {
      const builder = new ActionDefinitionBuilder(
        'test:partial-builds'
      ).withName('Partial Build Test');

      // Try to build incomplete definition (should throw)
      expect(() => builder.build()).toThrow(InvalidActionDefinitionError);

      // Continue building after error
      builder.withDescription('After error description').asBasicAction();

      // Should work now
      const action = builder.build();
      expect(action.name).toBe('Partial Build Test');
      expect(action.description).toBe('After error description');
    });

    it('should handle whitespace and trimming edge cases', () => {
      const action = new ActionDefinitionBuilder('test:whitespace')
        .withName('   Name with spaces   ')
        .withDescription('\t\tDescription with tabs\t\t')
        .withScope('  test:scope  ')
        .withTemplate('  template with spaces {target}  ')
        .requiresComponent('  test:component  ')
        .withPrerequisite('  test:condition  ', '  failure message  ')
        .build();

      expect(action.name).toBe('Name with spaces');
      expect(action.description).toBe('Description with tabs');
      expect(action.scope).toBe('test:scope');
      expect(action.template).toBe('template with spaces {target}');
      expect(action.required_components.actor).toContain('test:component');
      expect(action.prerequisites[0]).toEqual({
        logic: { condition_ref: 'test:condition' },
        failure_message: '  failure message  ', // Failure messages not trimmed
      });
    });
  });
});
