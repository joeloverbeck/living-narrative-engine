/**
 * @file Integration tests for ActionDefinitionBuilder
 * @description Tests compatibility with existing systems, performance, and integration scenarios
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../src/actions/builders/actionDefinitionBuilder.js';
import { TestDataFactory } from '../../common/actions/testDataFactory.js';
import {
  createTestAction,
  validateActionStructure,
  actionMatchers,
} from '../../common/actions/actionBuilderHelpers.js';

// Add custom matchers
expect.extend(actionMatchers);

describe('ActionDefinitionBuilder Integration', () => {
  describe('compatibility with existing system', () => {
    it('should create definitions with equivalent functionality to manual definitions', () => {
      const builderActions = TestDataFactory.createActionsWithBuilder();
      const manualActions = TestDataFactory.createBasicActions();

      expect(builderActions).toHaveLength(4);
      expect(manualActions).toHaveLength(4);

      // Check that all actions have the same core structure and content
      builderActions.forEach((builderAction, index) => {
        const manualAction = manualActions[index];

        // Compare all required fields
        expect(builderAction.id).toBe(manualAction.id);
        expect(builderAction.name).toBe(manualAction.name);
        expect(builderAction.description).toBe(manualAction.description);
        expect(builderAction.scope).toBe(manualAction.scope);
        expect(builderAction.template).toBe(manualAction.template);
        expect(builderAction.required_components).toEqual(
          manualAction.required_components
        );

        // Prerequisites may have different formats but same functional content
        // Builder uses objects with failure messages, manual uses strings
        expect(builderAction.prerequisites).toHaveLength(
          manualAction.prerequisites.length
        );

        // For detailed prerequisite comparison, extract condition references
        const builderConditions = builderAction.prerequisites.map((p) =>
          typeof p === 'string' ? p : p.logic?.condition_ref
        );
        const manualConditions = manualAction.prerequisites.map((p) =>
          typeof p === 'string' ? p : p.logic?.condition_ref
        );

        expect(builderConditions).toEqual(manualConditions);
      });
    });

    it('should create edge case definitions compatible with manual versions', () => {
      const builderEdgeCases =
        TestDataFactory.createEdgeCaseActionsWithBuilder();
      const manualEdgeCases = TestDataFactory.createEdgeCaseActions();

      expect(builderEdgeCases).toHaveLength(2);

      // Test the always-fail action
      const builderAlwaysFail = builderEdgeCases.find(
        (action) => action.id === 'test:always-fail'
      );
      const manualAlwaysFail = manualEdgeCases.find(
        (action) => action.id === 'test:always-fail'
      );

      expect(builderAlwaysFail).toBeDefined();
      expect(manualAlwaysFail).toBeDefined();
      expect(builderAlwaysFail.prerequisites).toEqual([
        {
          logic: { condition_ref: 'test:always-false' },
          failure_message: 'This action always fails',
        },
      ]);

      // Test the complex requirements action
      const builderComplex = builderEdgeCases.find(
        (action) => action.id === 'test:complex-requirements'
      );
      const manualComplex = manualEdgeCases.find(
        (action) => action.id === 'test:complex-requirements'
      );

      expect(builderComplex).toBeDefined();
      expect(manualComplex).toBeDefined();
      expect(builderComplex.required_components.actor).toHaveLength(4);
      expect(builderComplex.prerequisites).toHaveLength(3);
    });

    it('should work with custom matchers', () => {
      const action = createTestAction('test:matcher-test');

      expect(action).toBeValidActionDefinition();

      const movementAction = new ActionDefinitionBuilder('test:movement')
        .withName('Movement Test')
        .withDescription('Test movement')
        .asMovementAction()
        .asBasicAction()
        .build();

      expect(movementAction).toRequireComponent('core:position');
      expect(movementAction).toHavePrerequisite('anatomy:actor-can-move');
    });
  });

  describe('structure validation', () => {
    it('should create structurally valid definitions', () => {
      const action = new ActionDefinitionBuilder('test:structural')
        .withName('Structural Test')
        .withDescription('Testing structure')
        .asTargetedAction('test:scope', 'perform {target}')
        .requiresComponent('test:component')
        .withPrerequisite('test:condition', 'Failure message')
        .build();

      expect(validateActionStructure(action)).toBe(true);
      expect(action).toHaveProperty('id', 'test:structural');
      expect(action).toHaveProperty('name', 'Structural Test');
      expect(action).toHaveProperty('description', 'Testing structure');
      expect(action).toHaveProperty('scope', 'test:scope');
      expect(action).toHaveProperty(
        'template',
        'structural test perform {target}'
      );
      expect(action).toHaveProperty('prerequisites');
      expect(action).toHaveProperty('required_components.actor');

      expect(Array.isArray(action.prerequisites)).toBe(true);
      expect(Array.isArray(action.required_components.actor)).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const complexAction = new ActionDefinitionBuilder(
        'test:complex-structure'
      )
        .withName('Complex Structure')
        .withDescription('Testing complex structures')
        .asTargetedAction('test:targets')
        .requiresComponents(['test:comp1', 'test:comp2', 'test:comp3'])
        .withPrerequisites([
          'test:simple-condition',
          { condition: 'test:complex-condition', message: 'Complex message' },
          'test:another-condition',
        ])
        .build();

      expect(validateActionStructure(complexAction)).toBe(true);
      expect(complexAction.required_components.actor).toHaveLength(3);
      expect(complexAction.prerequisites).toHaveLength(3);

      // Check prerequisite structure
      expect(complexAction.prerequisites[0]).toBe('test:simple-condition');
      expect(complexAction.prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:complex-condition' },
        failure_message: 'Complex message',
      });
      expect(complexAction.prerequisites[2]).toBe('test:another-condition');
    });
  });

  describe('builder pattern validation', () => {
    it('should maintain fluent interface throughout complex chains', () => {
      const builder = new ActionDefinitionBuilder('test:fluent');

      // Each method should return the builder for chaining
      const result = builder
        .withName('Fluent Test')
        .withDescription('Testing fluent interface')
        .withScope('test:scope')
        .withTemplate('fluent {target}')
        .requiresComponent('test:comp1')
        .requiresComponent('test:comp2')
        .withPrerequisite('test:cond1')
        .withPrerequisite('test:cond2', 'Custom message')
        .asMovementAction()
        .build();

      expect(result).toBeDefined();
      expect(result.id).toBe('test:fluent');
      expect(result.required_components.actor).toContain('test:comp1');
      expect(result.required_components.actor).toContain('test:comp2');
      expect(result.required_components.actor).toContain('core:position');
      expect(result.prerequisites).toHaveLength(3); // 2 custom + 1 from asMovementAction
    });

    it('should handle fromDefinition recreate cycle', () => {
      const original = new ActionDefinitionBuilder('test:cycle')
        .withName('Cycle Test')
        .withDescription('Testing recreation cycle')
        .asTargetedAction('test:targets')
        .requiresComponents(['test:comp1', 'test:comp2'])
        .withPrerequisites([
          'test:cond1',
          { condition: 'test:cond2', message: 'Message' },
        ])
        .build();

      const recreatedBuilder = ActionDefinitionBuilder.fromDefinition(original);
      const recreated = recreatedBuilder.build();

      // Should be identical
      expect(recreated).toEqual(original);
      expect(validateActionStructure(recreated)).toBe(true);
    });
  });

  describe('convenience method combinations', () => {
    it('should properly combine asBasicAction with other methods', () => {
      const action = new ActionDefinitionBuilder('test:basic-combo')
        .withName('Basic Combo')
        .withDescription('Testing basic action combination')
        .asBasicAction()
        .requiresComponent('extra:component')
        .withPrerequisite('extra:condition')
        .build();

      expect(action.scope).toBe('none');
      expect(action.template).toBe('basic combo');
      expect(action.required_components.actor).toContain('extra:component');
      expect(action.prerequisites).toContain('extra:condition');
    });

    it('should properly combine asTargetedAction with convenience methods', () => {
      const action = new ActionDefinitionBuilder('test:targeted-combo')
        .withName('Targeted Combo')
        .withDescription('Testing targeted action combination')
        .asTargetedAction('test:scope', 'perform on {target}')
        .asCombatAction()
        .requiresComponent('extra:component')
        .build();

      expect(action.scope).toBe('test:scope');
      expect(action.template).toBe('targeted combo perform on {target}');
      expect(action.required_components.actor).toContain('core:position');
      expect(action.required_components.actor).toContain('core:health');
      expect(action.required_components.actor).toContain('extra:component');
      expect(action.prerequisites).toHaveLength(2); // from asCombatAction
    });

    it('should handle movement and combat action combinations', () => {
      const action = new ActionDefinitionBuilder('test:movement-combat')
        .withName('Movement Combat')
        .withDescription('Testing movement and combat combination')
        .asTargetedAction('test:enemies')
        .asMovementAction()
        .asCombatAction()
        .build();

      // Should have both movement and combat requirements
      expect(action.required_components.actor).toContain('core:position');
      expect(action.required_components.actor).toContain('core:health');

      // Should have all prerequisites (may be objects with failure messages)
      const allConditionRefs = action.prerequisites.map((p) =>
        typeof p === 'string' ? p : p.logic?.condition_ref
      );

      expect(allConditionRefs).toContain('anatomy:actor-can-move');
      expect(allConditionRefs).toContain('core:has-health');
    });
  });

  describe('error handling and validation integration', () => {
    it('should handle constructor error scenarios', () => {
      // Test missing ID
      expect(() => new ActionDefinitionBuilder()).toThrow(
        'Action ID is required and must be a string'
      );

      // Test null ID
      expect(() => new ActionDefinitionBuilder(null)).toThrow(
        'Action ID is required and must be a string'
      );

      // Test empty string ID
      expect(() => new ActionDefinitionBuilder('')).toThrow(
        'Action ID is required and must be a string'
      );

      // Test non-string ID
      expect(() => new ActionDefinitionBuilder(123)).toThrow(
        'Action ID is required and must be a string'
      );

      expect(() => new ActionDefinitionBuilder({})).toThrow(
        'Action ID is required and must be a string'
      );
    });

    it('should handle withName validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:name-errors');

      // Test empty string
      expect(() => builder.withName('')).toThrow(
        'Name must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.withName('   ')).toThrow(
        'Name must be a non-empty string'
      );

      // Test null
      expect(() => builder.withName(null)).toThrow(
        'Name must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.withName(123)).toThrow(
        'Name must be a non-empty string'
      );
    });

    it('should handle withDescription validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:desc-errors');

      // Test empty string
      expect(() => builder.withDescription('')).toThrow(
        'Description must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.withDescription('   ')).toThrow(
        'Description must be a non-empty string'
      );

      // Test null
      expect(() => builder.withDescription(null)).toThrow(
        'Description must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.withDescription({})).toThrow(
        'Description must be a non-empty string'
      );
    });

    it('should handle withScope validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:scope-errors');

      // Test empty string
      expect(() => builder.withScope('')).toThrow(
        'Scope must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.withScope('   ')).toThrow(
        'Scope must be a non-empty string'
      );

      // Test null
      expect(() => builder.withScope(null)).toThrow(
        'Scope must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.withScope([])).toThrow(
        'Scope must be a non-empty string'
      );
    });

    it('should handle withTemplate validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:template-errors');

      // Test empty string
      expect(() => builder.withTemplate('')).toThrow(
        'Template must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.withTemplate('   ')).toThrow(
        'Template must be a non-empty string'
      );

      // Test null
      expect(() => builder.withTemplate(null)).toThrow(
        'Template must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.withTemplate(false)).toThrow(
        'Template must be a non-empty string'
      );
    });

    it('should handle requiresComponent validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:component-errors');

      // Test empty string
      expect(() => builder.requiresComponent('')).toThrow(
        'Component ID must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.requiresComponent('   ')).toThrow(
        'Component ID must be a non-empty string'
      );

      // Test null
      expect(() => builder.requiresComponent(null)).toThrow(
        'Component ID must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.requiresComponent(123)).toThrow(
        'Component ID must be a non-empty string'
      );
    });

    it('should handle requiresComponents validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:components-errors');

      // Test non-array
      expect(() => builder.requiresComponents('not-array')).toThrow(
        'Component IDs must be an array'
      );

      expect(() => builder.requiresComponents(null)).toThrow(
        'Component IDs must be an array'
      );

      expect(() => builder.requiresComponents({})).toThrow(
        'Component IDs must be an array'
      );

      // Test array with invalid items
      expect(() => builder.requiresComponents(['valid', ''])).toThrow(
        'Component ID must be a non-empty string'
      );

      expect(() => builder.requiresComponents(['valid', null])).toThrow(
        'Component ID must be a non-empty string'
      );
    });

    it('should handle withPrerequisite validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:prereq-errors');

      // Test empty string
      expect(() => builder.withPrerequisite('')).toThrow(
        'Condition ID must be a non-empty string'
      );

      // Test whitespace-only string
      expect(() => builder.withPrerequisite('   ')).toThrow(
        'Condition ID must be a non-empty string'
      );

      // Test null
      expect(() => builder.withPrerequisite(null)).toThrow(
        'Condition ID must be a non-empty string'
      );

      // Test non-string
      expect(() => builder.withPrerequisite({})).toThrow(
        'Condition ID must be a non-empty string'
      );
    });

    it('should handle withPrerequisites validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:prereqs-errors');

      // Test non-array
      expect(() => builder.withPrerequisites('not-array')).toThrow(
        'Prerequisites must be an array'
      );

      expect(() => builder.withPrerequisites(null)).toThrow(
        'Prerequisites must be an array'
      );

      expect(() => builder.withPrerequisites({})).toThrow(
        'Prerequisites must be an array'
      );

      // Test array with invalid formats
      expect(() => builder.withPrerequisites([123])).toThrow(
        'Invalid prerequisite format. Expected string or {condition, message} object'
      );

      expect(() => builder.withPrerequisites([{ condition: 'test' }])).toThrow(
        'Invalid prerequisite format. Expected string or {condition, message} object'
      );

      expect(() => builder.withPrerequisites([{ message: 'test' }])).toThrow(
        'Invalid prerequisite format. Expected string or {condition, message} object'
      );
    });

    it('should handle asTargetedAction validation errors', () => {
      const builder = new ActionDefinitionBuilder('test:targeted-errors');

      // Test empty scope ID
      expect(() => builder.asTargetedAction('')).toThrow(
        'Scope ID is required for targeted actions'
      );

      // Test whitespace-only scope ID
      expect(() => builder.asTargetedAction('   ')).toThrow(
        'Scope ID is required for targeted actions'
      );

      // Test null scope ID
      expect(() => builder.asTargetedAction(null)).toThrow(
        'Scope ID is required for targeted actions'
      );

      // Test non-string scope ID
      expect(() => builder.asTargetedAction(123)).toThrow(
        'Scope ID is required for targeted actions'
      );
    });

    it('should handle build validation errors', () => {
      // Create a builder that would fail validation (missing required fields)
      const builder = new ActionDefinitionBuilder('test:build-error');
      // Note: We're not adding name/description which might be required by validator

      // This should throw when build() calls validate()
      expect(() => builder.build()).toThrow('Invalid action definition:');
    });

    it('should handle fromDefinition validation errors', () => {
      // Test missing definition
      expect(() => ActionDefinitionBuilder.fromDefinition(null)).toThrow(
        'Definition must have an ID'
      );

      // Test definition without ID
      expect(() => ActionDefinitionBuilder.fromDefinition({})).toThrow(
        'Definition must have an ID'
      );

      expect(() =>
        ActionDefinitionBuilder.fromDefinition({ name: 'Test' })
      ).toThrow('Definition must have an ID');
    });

    it('should handle empty component arrays gracefully', () => {
      const action = new ActionDefinitionBuilder('test:empty-arrays')
        .withName('Empty Arrays')
        .withDescription('Testing empty arrays')
        .asBasicAction()
        .requiresComponents([])
        .withPrerequisites([])
        .build();

      expect(action.required_components.actor).toEqual([]);
      expect(action.prerequisites).toEqual([]);
      expect(validateActionStructure(action)).toBe(true);
    });

    it('should deduplicate component requirements', () => {
      const action = new ActionDefinitionBuilder('test:deduplication')
        .withName('Deduplication Test')
        .withDescription('Testing component deduplication')
        .asBasicAction()
        .requiresComponent('test:component')
        .requiresComponent('test:component') // Duplicate
        .requiresComponents(['test:component', 'test:other']) // Partial duplicate
        .build();

      expect(action.required_components.actor).toEqual([
        'test:component',
        'test:other',
      ]);
    });

    it('should handle various prerequisite formats consistently', () => {
      const action = new ActionDefinitionBuilder('test:prereq-formats')
        .withName('Prerequisite Formats')
        .withDescription('Testing prerequisite format handling')
        .asBasicAction()
        .withPrerequisite('test:simple-string')
        .withPrerequisite('test:with-message', 'Custom failure message')
        .withPrerequisites([
          'test:another-string',
          { condition: 'test:object-format', message: 'Object message' },
        ])
        .build();

      expect(action.prerequisites).toHaveLength(4);
      expect(action.prerequisites[0]).toBe('test:simple-string');
      expect(action.prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:with-message' },
        failure_message: 'Custom failure message',
      });
      expect(action.prerequisites[2]).toBe('test:another-string');
      expect(action.prerequisites[3]).toEqual({
        logic: { condition_ref: 'test:object-format' },
        failure_message: 'Object message',
      });
    });
  });

  describe('ActionDefinitionValidator integration', () => {
    it('should integrate with validator for validation failures', () => {
      // Test validation with missing required fields
      const builderMinimal = new ActionDefinitionBuilder(
        'test:validator-integration'
      );

      // Should fail validation due to missing name and description
      const validation = builderMinimal.validate();
      expect(validation.isValid).toBe(false);
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate complete definitions successfully', () => {
      const builder = new ActionDefinitionBuilder('test:complete-validation')
        .withName('Complete Action')
        .withDescription('A complete action for validation testing')
        .asBasicAction();

      const validation = builder.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should pass validation results through to build method', () => {
      const builderValid = new ActionDefinitionBuilder('test:valid-build')
        .withName('Valid Action')
        .withDescription('Valid action description')
        .asBasicAction();

      // Should build successfully
      const action = builderValid.build();
      expect(action).toBeDefined();
      expect(action.id).toBe('test:valid-build');

      // Invalid builder should throw during build
      const builderInvalid = new ActionDefinitionBuilder('test:invalid-build');
      expect(() => builderInvalid.build()).toThrow(
        'Invalid action definition:'
      );
    });
  });

  describe('system compatibility and workflow integration', () => {
    it('should create definitions compatible with existing action processing', () => {
      // Create actions that would work with the broader action system
      const basicAction = new ActionDefinitionBuilder('integration:wait')
        .withName('Wait')
        .withDescription('Wait for a period of time')
        .asBasicAction()
        .build();

      const targetedAction = new ActionDefinitionBuilder('integration:examine')
        .withName('Examine')
        .withDescription('Examine a target closely')
        .asTargetedAction('core:nearby_items')
        .build();

      const complexAction = new ActionDefinitionBuilder(
        'integration:complex-attack'
      )
        .withName('Complex Attack')
        .withDescription('Perform a complex attack maneuver')
        .asTargetedAction('core:enemies')
        .asCombatAction()
        .requiresComponents(['core:weapon', 'core:stamina'])
        .withPrerequisites([
          'core:has-weapon',
          {
            condition: 'core:has-stamina',
            message: 'You are too tired to attack',
          },
        ])
        .build();

      // Verify all actions have expected structure for system compatibility
      [basicAction, targetedAction, complexAction].forEach((action) => {
        expect(action).toHaveProperty('id');
        expect(action).toHaveProperty('name');
        expect(action).toHaveProperty('description');
        expect(action).toHaveProperty('scope');
        expect(action).toHaveProperty('template');
        expect(action).toHaveProperty('prerequisites');
        expect(action).toHaveProperty('required_components');
        expect(action.required_components).toHaveProperty('actor');
        expect(Array.isArray(action.prerequisites)).toBe(true);
        expect(Array.isArray(action.required_components.actor)).toBe(true);
        expect(validateActionStructure(action)).toBe(true);
      });
    });

    it('should work with test data factory patterns', () => {
      // Test integration with existing test patterns
      const testActions = [
        new ActionDefinitionBuilder('factory:action1')
          .withName('Factory Action 1')
          .withDescription('First factory test action')
          .asBasicAction()
          .build(),
        new ActionDefinitionBuilder('factory:action2')
          .withName('Factory Action 2')
          .withDescription('Second factory test action')
          .asTargetedAction('test:targets')
          .requiresComponent('test:component')
          .build(),
      ];

      // Verify all actions are valid and compatible
      testActions.forEach((action) => {
        expect(validateActionStructure(action)).toBe(true);
        expect(action).toBeValidActionDefinition();
      });
    });

    it('should handle edge cases from real-world usage patterns', () => {
      // Simulate edge cases that might occur in production usage
      const edgeCaseActions = [
        // Very long action name
        new ActionDefinitionBuilder('edge:long-name')
          .withName(
            'A Very Long Action Name That Might Come From User Input Or Mod Content That Could Be Quite Lengthy'
          )
          .withDescription('Action with very long name')
          .asBasicAction()
          .build(),

        // Action with many components and prerequisites
        new ActionDefinitionBuilder('edge:complex-requirements')
          .withName('Complex Requirements')
          .withDescription('Action with many requirements')
          .asTargetedAction('test:complex-scope')
          .requiresComponents([
            'core:component1',
            'core:component2',
            'core:component3',
            'mod:component1',
            'mod:component2',
            'system:component1',
          ])
          .withPrerequisites([
            'core:condition1',
            'core:condition2',
            { condition: 'mod:condition1', message: 'Mod condition failed' },
            {
              condition: 'system:condition1',
              message: 'System condition failed',
            },
          ])
          .asCombatAction()
          .build(),

        // Action with special characters in template
        new ActionDefinitionBuilder('edge:special-template')
          .withName('Special Template')
          .withDescription('Action with special template characters')
          .asTargetedAction(
            'test:targets',
            'perform "{special}" action on {target}'
          )
          .build(),
      ];

      edgeCaseActions.forEach((action) => {
        expect(validateActionStructure(action)).toBe(true);
        expect(action).toBeValidActionDefinition();
      });
    });

    it('should maintain immutability and prevent external modification', () => {
      const builder = new ActionDefinitionBuilder('immutable:test')
        .withName('Immutable Test')
        .withDescription('Testing immutability')
        .asBasicAction()
        .requiresComponent('test:component')
        .withPrerequisite('test:condition');

      const action1 = builder.build();
      const action2 = builder.build();

      // Should be equal but not the same object
      expect(action1).toEqual(action2);
      expect(action1).not.toBe(action2);

      // Modifying one should not affect the other
      action1.id = 'modified';
      expect(action2.id).toBe('immutable:test');

      // Modifying arrays should not affect original
      action1.prerequisites.push('new-condition');
      expect(action2.prerequisites).not.toContain('new-condition');

      action1.required_components.actor.push('new-component');
      expect(action2.required_components.actor).not.toContain('new-component');
    });

    it('should handle toPartial for debugging workflows', () => {
      const builder = new ActionDefinitionBuilder('debug:partial')
        .withName('Partial Debug')
        .withDescription('Testing partial output for debugging');

      // Get partial state before completion
      const partial1 = builder.toPartial();
      expect(partial1.id).toBe('debug:partial');
      expect(partial1.name).toBe('Partial Debug');
      expect(partial1.description).toBe('Testing partial output for debugging');
      expect(partial1.scope).toBeUndefined();

      // Add more and check partial again
      builder.asTargetedAction('debug:scope');
      const partial2 = builder.toPartial();
      expect(partial2.scope).toBe('debug:scope');
      expect(partial2.template).toBe('partial debug {target}');

      // Partials should be immutable copies
      partial1.id = 'modified';
      expect(builder.toPartial().id).toBe('debug:partial');
    });
  });
});
