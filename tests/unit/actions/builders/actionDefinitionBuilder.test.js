/**
 * @file Unit tests for ActionDefinitionBuilder
 * @description Comprehensive test suite for the ActionDefinitionBuilder class,
 * covering all methods, error scenarios, and edge cases
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionDefinitionBuilder } from '../../../../src/actions/builders/actionDefinitionBuilder.js';
import { InvalidActionDefinitionError } from '../../../../src/errors/invalidActionDefinitionError.js';

describe('ActionDefinitionBuilder', () => {
  describe('complex edge cases', () => {
    it('should handle prerequisite duplication gracefully', () => {
      const action = new ActionDefinitionBuilder('test:prereq-dup')
        .withName('Prerequisite Duplication')
        .withDescription('Testing prerequisite duplication')
        .asBasicAction()
        .withPrerequisite('test:condition', 'First message')
        .withPrerequisite('test:condition', 'Second message')
        .build();

      expect(action.prerequisites).toHaveLength(2);
      expect(action.prerequisites[0]).toEqual({
        logic: { condition_ref: 'test:condition' },
        failure_message: 'First message',
      });
      expect(action.prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:condition' },
        failure_message: 'Second message',
      });
    });

    it('should handle mixed prerequisite formats consistently', () => {
      const action = new ActionDefinitionBuilder('test:mixed-prereqs')
        .withName('Mixed Prerequisites')
        .withDescription('Testing mixed prerequisite formats')
        .asBasicAction()
        .withPrerequisite('test:simple')
        .withPrerequisites([
          'test:another-simple',
          { condition: 'test:complex', message: 'Complex message' },
        ])
        .withPrerequisite('test:final', 'Final message')
        .build();

      expect(action.prerequisites).toHaveLength(4);
      expect(action.prerequisites[0]).toBe('test:simple');
      expect(action.prerequisites[1]).toBe('test:another-simple');
      expect(action.prerequisites[2]).toEqual({
        logic: { condition_ref: 'test:complex' },
        failure_message: 'Complex message',
      });
      expect(action.prerequisites[3]).toEqual({
        logic: { condition_ref: 'test:final' },
        failure_message: 'Final message',
      });
    });

    it('should maintain state immutability across multiple operations', () => {
      const builder = new ActionDefinitionBuilder('test:immutability');

      const state1 = builder.toPartial();
      builder.withName('Test');
      const state2 = builder.toPartial();
      builder.withDescription('Description');
      const state3 = builder.toPartial();

      // Previous states should not be modified
      expect(state1.name).toBeUndefined();
      expect(state1.description).toBeUndefined();

      expect(state2.name).toBe('Test');
      expect(state2.description).toBeUndefined();

      expect(state3.name).toBe('Test');
      expect(state3.description).toBe('Description');

      // Each state should be a different object
      expect(state1).not.toBe(state2);
      expect(state2).not.toBe(state3);
    });
  });

  describe('fromDefinition edge cases', () => {
    it('should handle definitions with undefined optional fields', () => {
      const definition = {
        id: 'test:minimal',
        name: 'Minimal',
        description: 'Minimal action',
        scope: 'none',
        template: 'minimal',
        // No prerequisites or required_components
      };

      const builder = ActionDefinitionBuilder.fromDefinition(definition);
      const recreated = builder.build();

      expect(recreated.id).toBe('test:minimal');
      expect(recreated.prerequisites).toEqual([]);
      expect(recreated.required_components.actor).toEqual([]);
    });

    it('should handle definitions with null values gracefully', () => {
      const definition = {
        id: 'test:nulls',
        name: 'Null Test',
        description: 'Testing null values',
        scope: 'none',
        template: 'null test',
        prerequisites: null,
        required_components: null,
      };

      const builder = ActionDefinitionBuilder.fromDefinition(definition);
      const recreated = builder.build();

      expect(recreated.prerequisites).toEqual([]);
      expect(recreated.required_components.actor).toEqual([]);
    });

    it('should handle complex prerequisite objects in fromDefinition', () => {
      const definition = {
        id: 'test:complex-from',
        name: 'Complex From',
        description: 'Complex fromDefinition test',
        scope: 'test:scope',
        template: 'complex from {target}',
        prerequisites: [
          'test:simple',
          {
            logic: { condition_ref: 'test:complex' },
            failure_message: 'Complex failed',
          },
          { logic: { condition_ref: 'test:another' } }, // No failure message
        ],
        required_components: { actor: ['test:comp1', 'test:comp2'] },
      };

      const builder = ActionDefinitionBuilder.fromDefinition(definition);
      const recreated = builder.build();

      expect(recreated.prerequisites).toHaveLength(3);
      expect(recreated.prerequisites[0]).toBe('test:simple');
      expect(recreated.prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:complex' },
        failure_message: 'Complex failed',
      });
      expect(recreated.prerequisites[2]).toBe('test:another');
    });
  });
  describe('constructor', () => {
    it('should create builder with valid ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      const partial = builder.toPartial();

      expect(partial).toEqual({
        id: 'test:action',
        prerequisites: [],
        required_components: { actor: [] },
      });
    });

    it('should throw error for missing ID', () => {
      expect(() => new ActionDefinitionBuilder()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => new ActionDefinitionBuilder()).toThrow(
        'Action ID is required and must be a string'
      );
    });

    it('should throw error for null ID', () => {
      expect(() => new ActionDefinitionBuilder(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string ID', () => {
      expect(() => new ActionDefinitionBuilder(123)).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => new ActionDefinitionBuilder({})).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => new ActionDefinitionBuilder([])).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string ID', () => {
      expect(() => new ActionDefinitionBuilder('')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withName', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should set name and return builder for chaining', () => {
      const result = builder.withName('Test Action');
      expect(result).toBe(builder);
      expect(builder.toPartial().name).toBe('Test Action');
    });

    it('should trim whitespace from name', () => {
      builder.withName('  Test Action  ');
      expect(builder.toPartial().name).toBe('Test Action');
    });

    it('should throw error for missing name', () => {
      expect(() => builder.withName()).toThrow(InvalidActionDefinitionError);
      expect(() => builder.withName()).toThrow(
        'Name must be a non-empty string'
      );
    });

    it('should throw error for null name', () => {
      expect(() => builder.withName(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string name', () => {
      expect(() => builder.withName(123)).toThrow(InvalidActionDefinitionError);
      expect(() => builder.withName({})).toThrow(InvalidActionDefinitionError);
    });

    it('should throw error for empty string name', () => {
      expect(() => builder.withName('')).toThrow(InvalidActionDefinitionError);
    });

    it('should throw error for whitespace-only name', () => {
      expect(() => builder.withName('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withDescription', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should set description and return builder for chaining', () => {
      const result = builder.withDescription('Test description');
      expect(result).toBe(builder);
      expect(builder.toPartial().description).toBe('Test description');
    });

    it('should trim whitespace from description', () => {
      builder.withDescription('  Test description  ');
      expect(builder.toPartial().description).toBe('Test description');
    });

    it('should throw error for missing description', () => {
      expect(() => builder.withDescription()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.withDescription()).toThrow(
        'Description must be a non-empty string'
      );
    });

    it('should throw error for null description', () => {
      expect(() => builder.withDescription(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string description', () => {
      expect(() => builder.withDescription(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string description', () => {
      expect(() => builder.withDescription('')).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for whitespace-only description', () => {
      expect(() => builder.withDescription('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withScope', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should set scope and return builder for chaining', () => {
      const result = builder.withScope('test:scope');
      expect(result).toBe(builder);
      expect(builder.toPartial().scope).toBe('test:scope');
    });

    it('should trim whitespace from scope', () => {
      builder.withScope('  test:scope  ');
      expect(builder.toPartial().scope).toBe('test:scope');
    });

    it('should accept "none" as valid scope', () => {
      builder.withScope('none');
      expect(builder.toPartial().scope).toBe('none');
    });

    it('should throw error for missing scope', () => {
      expect(() => builder.withScope()).toThrow(InvalidActionDefinitionError);
      expect(() => builder.withScope()).toThrow(
        'Scope must be a non-empty string'
      );
    });

    it('should throw error for null scope', () => {
      expect(() => builder.withScope(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string scope', () => {
      expect(() => builder.withScope(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string scope', () => {
      expect(() => builder.withScope('')).toThrow(InvalidActionDefinitionError);
    });

    it('should throw error for whitespace-only scope', () => {
      expect(() => builder.withScope('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withTemplate', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should set template and return builder for chaining', () => {
      const result = builder.withTemplate('test {target}');
      expect(result).toBe(builder);
      expect(builder.toPartial().template).toBe('test {target}');
    });

    it('should trim whitespace from template', () => {
      builder.withTemplate('  test {target}  ');
      expect(builder.toPartial().template).toBe('test {target}');
    });

    it('should throw error for missing template', () => {
      expect(() => builder.withTemplate()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.withTemplate()).toThrow(
        'Template must be a non-empty string'
      );
    });

    it('should throw error for null template', () => {
      expect(() => builder.withTemplate(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string template', () => {
      expect(() => builder.withTemplate(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string template', () => {
      expect(() => builder.withTemplate('')).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for whitespace-only template', () => {
      expect(() => builder.withTemplate('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('requiresComponent', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should add component and return builder for chaining', () => {
      const result = builder.requiresComponent('test:component');
      expect(result).toBe(builder);
      expect(builder.toPartial().required_components.actor).toContain(
        'test:component'
      );
    });

    it('should trim whitespace from component ID', () => {
      builder.requiresComponent('  test:component  ');
      expect(builder.toPartial().required_components.actor).toContain(
        'test:component'
      );
    });

    it('should deduplicate components automatically', () => {
      builder
        .requiresComponent('test:component')
        .requiresComponent('test:component');

      expect(builder.toPartial().required_components.actor).toEqual([
        'test:component',
      ]);
    });

    it('should add multiple different components', () => {
      builder
        .requiresComponent('test:component1')
        .requiresComponent('test:component2');

      expect(builder.toPartial().required_components.actor).toEqual([
        'test:component1',
        'test:component2',
      ]);
    });

    it('should throw error for missing component ID', () => {
      expect(() => builder.requiresComponent()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.requiresComponent()).toThrow(
        'Component ID must be a non-empty string'
      );
    });

    it('should throw error for null component ID', () => {
      expect(() => builder.requiresComponent(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string component ID', () => {
      expect(() => builder.requiresComponent(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string component ID', () => {
      expect(() => builder.requiresComponent('')).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for whitespace-only component ID', () => {
      expect(() => builder.requiresComponent('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('requiresComponents', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should add multiple components and return builder for chaining', () => {
      const result = builder.requiresComponents(['test:comp1', 'test:comp2']);
      expect(result).toBe(builder);
      expect(builder.toPartial().required_components.actor).toEqual([
        'test:comp1',
        'test:comp2',
      ]);
    });

    it('should handle empty array gracefully', () => {
      expect(() => builder.requiresComponents([])).not.toThrow();
      expect(builder.toPartial().required_components.actor).toEqual([]);
    });

    it('should deduplicate across multiple calls', () => {
      builder
        .requiresComponents(['test:comp1', 'test:comp2'])
        .requiresComponents(['test:comp2', 'test:comp3']);

      expect(builder.toPartial().required_components.actor).toEqual([
        'test:comp1',
        'test:comp2',
        'test:comp3',
      ]);
    });

    it('should throw error for non-array input', () => {
      expect(() => builder.requiresComponents('test:comp')).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.requiresComponents('test:comp')).toThrow(
        'Component IDs must be an array'
      );
    });

    it('should throw error for null input', () => {
      expect(() => builder.requiresComponents(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for invalid component in array', () => {
      expect(() => builder.requiresComponents(['test:comp1', null])).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.requiresComponents(['test:comp1', 123])).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withPrerequisite', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should add string prerequisite and return builder for chaining', () => {
      const result = builder.withPrerequisite('test:condition');
      expect(result).toBe(builder);
      expect(builder.toPartial().prerequisites).toContain('test:condition');
    });

    it('should add prerequisite with failure message', () => {
      builder.withPrerequisite('test:condition', 'Test failed');
      const prerequisites = builder.toPartial().prerequisites;

      expect(prerequisites).toHaveLength(1);
      expect(prerequisites[0]).toEqual({
        logic: { condition_ref: 'test:condition' },
        failure_message: 'Test failed',
      });
    });

    it('should trim whitespace from condition ID', () => {
      builder.withPrerequisite('  test:condition  ');
      expect(builder.toPartial().prerequisites).toContain('test:condition');
    });

    it('should allow multiple prerequisites', () => {
      builder
        .withPrerequisite('test:condition1')
        .withPrerequisite('test:condition2', 'Failed message');

      const prerequisites = builder.toPartial().prerequisites;
      expect(prerequisites).toHaveLength(2);
      expect(prerequisites[0]).toBe('test:condition1');
      expect(prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:condition2' },
        failure_message: 'Failed message',
      });
    });

    it('should throw error for missing condition ID', () => {
      expect(() => builder.withPrerequisite()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.withPrerequisite()).toThrow(
        'Condition ID must be a non-empty string'
      );
    });

    it('should throw error for null condition ID', () => {
      expect(() => builder.withPrerequisite(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string condition ID', () => {
      expect(() => builder.withPrerequisite(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string condition ID', () => {
      expect(() => builder.withPrerequisite('')).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for whitespace-only condition ID', () => {
      expect(() => builder.withPrerequisite('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('withPrerequisites', () => {
    let builder;

    beforeEach(() => {
      builder = new ActionDefinitionBuilder('test:action');
    });

    it('should add multiple string prerequisites', () => {
      const result = builder.withPrerequisites(['test:cond1', 'test:cond2']);
      expect(result).toBe(builder);
      expect(builder.toPartial().prerequisites).toEqual([
        'test:cond1',
        'test:cond2',
      ]);
    });

    it('should add multiple object prerequisites', () => {
      builder.withPrerequisites([
        { condition: 'test:cond1', message: 'Message 1' },
        { condition: 'test:cond2', message: 'Message 2' },
      ]);

      const prerequisites = builder.toPartial().prerequisites;
      expect(prerequisites).toHaveLength(2);
      expect(prerequisites[0]).toEqual({
        logic: { condition_ref: 'test:cond1' },
        failure_message: 'Message 1',
      });
      expect(prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:cond2' },
        failure_message: 'Message 2',
      });
    });

    it('should handle mixed string and object prerequisites', () => {
      builder.withPrerequisites([
        'test:cond1',
        { condition: 'test:cond2', message: 'Message 2' },
      ]);

      const prerequisites = builder.toPartial().prerequisites;
      expect(prerequisites).toHaveLength(2);
      expect(prerequisites[0]).toBe('test:cond1');
      expect(prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:cond2' },
        failure_message: 'Message 2',
      });
    });

    it('should handle empty array gracefully', () => {
      expect(() => builder.withPrerequisites([])).not.toThrow();
      expect(builder.toPartial().prerequisites).toEqual([]);
    });

    it('should throw error for non-array input', () => {
      expect(() => builder.withPrerequisites('test:cond')).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.withPrerequisites('test:cond')).toThrow(
        'Prerequisites must be an array'
      );
    });

    it('should throw error for invalid object format', () => {
      expect(() => builder.withPrerequisites([{ invalid: 'format' }])).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.withPrerequisites([{ invalid: 'format' }])).toThrow(
        'Invalid prerequisite format'
      );
    });

    it('should throw error for missing condition in object', () => {
      expect(() => builder.withPrerequisites([{ message: 'Message' }])).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for missing message in object', () => {
      expect(() =>
        builder.withPrerequisites([{ condition: 'test:cond' }])
      ).toThrow(InvalidActionDefinitionError);
    });
  });

  describe('asBasicAction', () => {
    it('should configure as basic action with default template', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('TestAction')
        .asBasicAction();

      const partial = builder.toPartial();
      expect(partial.scope).toBe('none');
      expect(partial.template).toBe('testaction');
    });

    it('should use "action" as default template when no name set', () => {
      const builder = new ActionDefinitionBuilder(
        'test:action'
      ).asBasicAction();

      expect(builder.toPartial().template).toBe('action');
    });

    it('should return builder for chaining', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      const result = builder.asBasicAction();
      expect(result).toBe(builder);
    });
  });

  describe('asTargetedAction', () => {
    it('should configure as targeted action with default suffix', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('Attack')
        .asTargetedAction('test:targets');

      const partial = builder.toPartial();
      expect(partial.scope).toBe('test:targets');
      expect(partial.template).toBe('attack {target}');
    });

    it('should configure with custom suffix', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('Take')
        .asTargetedAction('test:items', 'from {target}');

      const partial = builder.toPartial();
      expect(partial.scope).toBe('test:items');
      expect(partial.template).toBe('take from {target}');
    });

    it('should use "action" as default name when no name set', () => {
      const builder = new ActionDefinitionBuilder(
        'test:action'
      ).asTargetedAction('test:targets');

      expect(builder.toPartial().template).toBe('action {target}');
    });

    it('should trim whitespace from scope ID', () => {
      const builder = new ActionDefinitionBuilder(
        'test:action'
      ).asTargetedAction('  test:targets  ');

      expect(builder.toPartial().scope).toBe('test:targets');
    });

    it('should return builder for chaining', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      const result = builder.asTargetedAction('test:targets');
      expect(result).toBe(builder);
    });

    it('should throw error for missing scope ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      expect(() => builder.asTargetedAction()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => builder.asTargetedAction()).toThrow(
        'Scope ID is required for targeted actions'
      );
    });

    it('should throw error for null scope ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      expect(() => builder.asTargetedAction(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for non-string scope ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      expect(() => builder.asTargetedAction(123)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for empty string scope ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      expect(() => builder.asTargetedAction('')).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for whitespace-only scope ID', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      expect(() => builder.asTargetedAction('   ')).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('asMovementAction', () => {
    it('should add movement component and prerequisite', () => {
      const builder = new ActionDefinitionBuilder(
        'test:action'
      ).asMovementAction();

      const partial = builder.toPartial();
      expect(partial.required_components.actor).toContain('core:position');
      expect(partial.prerequisites).toContainEqual({
        logic: { condition_ref: 'anatomy:actor-can-move' },
        failure_message: 'You cannot move right now',
      });
    });

    it('should return builder for chaining', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      const result = builder.asMovementAction();
      expect(result).toBe(builder);
    });

    it('should work with other configuration methods', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('Go')
        .asTargetedAction('test:locations')
        .asMovementAction();

      const partial = builder.toPartial();
      expect(partial.scope).toBe('test:locations');
      expect(partial.template).toBe('go {target}');
      expect(partial.required_components.actor).toContain('core:position');
    });
  });

  describe('asCombatAction', () => {
    it('should add combat components and prerequisites', () => {
      const builder = new ActionDefinitionBuilder(
        'test:action'
      ).asCombatAction();

      const partial = builder.toPartial();
      expect(partial.required_components.actor).toContain('core:position');
      expect(partial.required_components.actor).toContain('core:health');
      expect(partial.prerequisites).toContainEqual({
        logic: { condition_ref: 'anatomy:actor-can-move' },
        failure_message: 'You cannot move right now',
      });
      expect(partial.prerequisites).toContainEqual({
        logic: { condition_ref: 'core:has-health' },
        failure_message: 'You need health to perform this action',
      });
    });

    it('should return builder for chaining', () => {
      const builder = new ActionDefinitionBuilder('test:action');
      const result = builder.asCombatAction();
      expect(result).toBe(builder);
    });

    it('should work with other configuration methods', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('Attack')
        .asTargetedAction('test:enemies')
        .asCombatAction();

      const partial = builder.toPartial();
      expect(partial.scope).toBe('test:enemies');
      expect(partial.template).toBe('attack {target}');
      expect(partial.required_components.actor).toContain('core:position');
      expect(partial.required_components.actor).toContain('core:health');
    });
  });

  describe('validate', () => {
    it('should return valid result for complete definition', () => {
      const builder = new ActionDefinitionBuilder('test:action')
        .withName('Test')
        .withDescription('Test action')
        .withScope('test:scope')
        .withTemplate('test {target}');

      const result = builder.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid result for incomplete definition', () => {
      const builder = new ActionDefinitionBuilder('test:action');

      const result = builder.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('build', () => {
    it('should build complete valid definition', () => {
      const action = new ActionDefinitionBuilder('test:complete')
        .withName('Complete Action')
        .withDescription('A complete test action')
        .withScope('test:scope')
        .withTemplate('complete {target}')
        .requiresComponent('test:component')
        .withPrerequisite('test:condition', 'Test failed')
        .build();

      expect(action).toEqual({
        id: 'test:complete',
        name: 'Complete Action',
        description: 'A complete test action',
        scope: 'test:scope',
        template: 'complete {target}',
        prerequisites: [
          {
            logic: { condition_ref: 'test:condition' },
            failure_message: 'Test failed',
          },
        ],
        required_components: {
          actor: ['test:component'],
        },
      });
    });

    it('should return deep clone to prevent mutation', () => {
      const builder = new ActionDefinitionBuilder('test:immutable')
        .withName('Immutable')
        .withDescription('Test immutability')
        .asBasicAction();

      const action1 = builder.build();
      const action2 = builder.build();

      expect(action1).not.toBe(action2);
      expect(action1).toEqual(action2);

      // Modifying one shouldn't affect the other
      action1.name = 'Modified';
      expect(action2.name).toBe('Immutable');
    });

    it('should throw error for invalid definition', () => {
      const builder = new ActionDefinitionBuilder('test:invalid');

      expect(() => builder.build()).toThrow(InvalidActionDefinitionError);
      expect(() => builder.build()).toThrow('Invalid action definition');
    });
  });

  describe('toPartial', () => {
    it('should return current definition state', () => {
      const builder = new ActionDefinitionBuilder('test:partial').withName(
        'Partial'
      );

      const partial = builder.toPartial();
      expect(partial.id).toBe('test:partial');
      expect(partial.name).toBe('Partial');
      expect(partial.description).toBeUndefined();
    });

    it('should return deep clone', () => {
      const builder = new ActionDefinitionBuilder('test:clone');
      const partial1 = builder.toPartial();
      const partial2 = builder.toPartial();

      expect(partial1).not.toBe(partial2);
      expect(partial1).toEqual(partial2);
    });
  });

  describe('fromDefinition', () => {
    it('should recreate builder from complete definition', () => {
      const original = {
        id: 'test:original',
        name: 'Original',
        description: 'Original action',
        scope: 'test:scope',
        template: 'original {target}',
        prerequisites: ['test:condition'],
        required_components: { actor: ['test:component'] },
      };

      const rebuilt = ActionDefinitionBuilder.fromDefinition(original).build();
      expect(rebuilt).toEqual(original);
    });

    it('should handle complex prerequisites', () => {
      const original = {
        id: 'test:complex',
        name: 'Complex',
        description: 'Complex action',
        scope: 'test:scope',
        template: 'complex {target}',
        prerequisites: [
          'test:condition1',
          {
            logic: { condition_ref: 'test:condition2' },
            failure_message: 'Failed',
          },
        ],
        required_components: { actor: ['test:comp1', 'test:comp2'] },
      };

      const rebuilt = ActionDefinitionBuilder.fromDefinition(original).build();
      expect(rebuilt).toEqual(original);
    });

    it('should handle partial definitions', () => {
      const partial = {
        id: 'test:partial',
        name: 'Partial',
      };

      const builder = ActionDefinitionBuilder.fromDefinition(partial);
      const result = builder.toPartial();

      expect(result.id).toBe('test:partial');
      expect(result.name).toBe('Partial');
      expect(result.description).toBeUndefined();
    });

    it('should throw error for missing definition', () => {
      expect(() => ActionDefinitionBuilder.fromDefinition()).toThrow(
        InvalidActionDefinitionError
      );
      expect(() => ActionDefinitionBuilder.fromDefinition()).toThrow(
        'Definition must have an ID'
      );
    });

    it('should throw error for null definition', () => {
      expect(() => ActionDefinitionBuilder.fromDefinition(null)).toThrow(
        InvalidActionDefinitionError
      );
    });

    it('should throw error for definition without ID', () => {
      expect(() => ActionDefinitionBuilder.fromDefinition({})).toThrow(
        InvalidActionDefinitionError
      );
    });
  });

  describe('method chaining', () => {
    it('should support complete fluent chaining', () => {
      const action = new ActionDefinitionBuilder('test:fluent')
        .withName('Fluent Action')
        .withDescription('Demonstrates fluent chaining')
        .asTargetedAction('test:targets')
        .requiresComponent('test:component')
        .withPrerequisite('test:condition')
        .build();

      expect(action.id).toBe('test:fluent');
      expect(action.name).toBe('Fluent Action');
      expect(action.description).toBe('Demonstrates fluent chaining');
      expect(action.scope).toBe('test:targets');
      expect(action.template).toBe('fluent action {target}');
      expect(action.required_components.actor).toContain('test:component');
      expect(action.prerequisites).toContain('test:condition');
    });

    it('should support mixed method order', () => {
      const action = new ActionDefinitionBuilder('test:mixed')
        .requiresComponent('test:component')
        .withName('Mixed Order')
        .withPrerequisite('test:condition')
        .withDescription('Mixed method order')
        .asBasicAction()
        .build();

      expect(action).toBeDefined();
      expect(action.name).toBe('Mixed Order');
      expect(action.scope).toBe('none');
    });
  });

  describe('schema compliance', () => {
    it('should create schema-compliant definitions', () => {
      const action = new ActionDefinitionBuilder('test:compliant')
        .withName('Compliant Action')
        .withDescription('Schema compliant action')
        .asTargetedAction('test:scope')
        .requiresComponent('test:component')
        .withPrerequisite('test:condition', 'Failure message')
        .build();

      // Validate against expected schema structure
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('description');
      expect(action).toHaveProperty('scope');
      expect(action).toHaveProperty('template');
      expect(action).toHaveProperty('prerequisites');
      expect(action).toHaveProperty('required_components.actor');

      // Validate ID format (namespace:identifier)
      expect(action.id).toMatch(
        /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
      );

      // Validate required_components structure
      expect(Array.isArray(action.required_components.actor)).toBe(true);
      action.required_components.actor.forEach((componentId) => {
        expect(typeof componentId).toBe('string');
        expect(componentId).toMatch(
          /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
        );
      });

      // Validate prerequisites structure
      expect(Array.isArray(action.prerequisites)).toBe(true);
      action.prerequisites.forEach((prereq) => {
        if (typeof prereq === 'string') {
          expect(prereq).toMatch(
            /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
          );
        } else {
          expect(prereq).toHaveProperty('logic');
          expect(prereq.logic).toHaveProperty('condition_ref');
          expect(prereq.logic.condition_ref).toMatch(
            /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
          );
        }
      });
    });

    it('should handle different prerequisite formats correctly', () => {
      const action = new ActionDefinitionBuilder('test:prereq-formats')
        .withName('Prerequisite Formats Test')
        .withDescription('Testing different prerequisite formats')
        .asBasicAction()
        .withPrerequisite('test:simple-condition')
        .withPrerequisite(
          'test:condition-with-message',
          'Custom failure message'
        )
        .withPrerequisites([
          'test:another-simple',
          { condition: 'test:complex-condition', message: 'Another message' },
        ])
        .build();

      expect(action.prerequisites).toHaveLength(4);

      // Simple string prerequisite
      expect(action.prerequisites[0]).toBe('test:simple-condition');

      // Prerequisite with failure message (object format)
      expect(action.prerequisites[1]).toEqual({
        logic: { condition_ref: 'test:condition-with-message' },
        failure_message: 'Custom failure message',
      });

      // Another simple string
      expect(action.prerequisites[2]).toBe('test:another-simple');

      // Complex object format
      expect(action.prerequisites[3]).toEqual({
        logic: { condition_ref: 'test:complex-condition' },
        failure_message: 'Another message',
      });
    });

    it('should maintain ID format compliance across all builder methods', () => {
      const testIds = [
        'core:attack',
        'test_mod:custom_action',
        'namespace123:identifier456',
        'my_namespace:action-with-hyphens',
        'a:b',
      ];

      testIds.forEach((id) => {
        const action = new ActionDefinitionBuilder(id)
          .withName('Test Action')
          .withDescription('Test description')
          .asBasicAction()
          .build();

        expect(action.id).toBe(id);
        expect(action.id).toMatch(
          /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
        );
      });
    });

    it('should ensure scope format compliance', () => {
      const validScopes = [
        'none',
        'core:nearby_actors',
        'test_mod:custom_scope',
        'my_namespace:action-scope',
      ];

      validScopes.forEach((scope) => {
        const action = new ActionDefinitionBuilder('test:scope-compliance')
          .withName('Scope Test')
          .withDescription('Testing scope compliance')
          .withScope(scope)
          .withTemplate(scope === 'none' ? 'basic action' : 'targeted {target}')
          .build();

        expect(action.scope).toBe(scope);
        if (scope !== 'none') {
          expect(scope).toMatch(
            /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
          );
        }
      });
    });

    it('should validate component ID formats in required_components', () => {
      const validComponentIds = [
        'core:position',
        'core:health',
        'test_mod:custom_component',
        'namespace123:component456',
      ];

      const action = new ActionDefinitionBuilder('test:component-compliance')
        .withName('Component Test')
        .withDescription('Testing component compliance')
        .asBasicAction()
        .requiresComponents(validComponentIds)
        .build();

      action.required_components.actor.forEach((componentId) => {
        expect(componentId).toMatch(
          /^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z0-9_][a-zA-Z0-9_-]*$/
        );
      });
    });

    it('should ensure templates include {target} for targeted actions', () => {
      const targetedAction = new ActionDefinitionBuilder(
        'test:targeted-template'
      )
        .withName('Targeted Template Test')
        .withDescription('Testing targeted action templates')
        .asTargetedAction('test:scope', 'perform action on {target}')
        .build();

      expect(targetedAction.template).toContain('{target}');
      expect(targetedAction.scope).not.toBe('none');
    });

    it('should not require {target} for basic actions', () => {
      const basicAction = new ActionDefinitionBuilder('test:basic-template')
        .withName('Basic Template Test')
        .withDescription('Testing basic action templates')
        .asBasicAction()
        .build();

      expect(basicAction.scope).toBe('none');
      // Template may or may not contain {target} for basic actions
    });
  });

  describe('edge cases', () => {
    it('should handle UTF-8 characters in strings', () => {
      const action = new ActionDefinitionBuilder('test:utf8')
        .withName('Açcént Tëst')
        .withDescription('Test with açcénts and émojis 🎯')
        .asBasicAction()
        .build();

      expect(action.name).toBe('Açcént Tëst');
      expect(action.description).toBe('Test with açcénts and émojis 🎯');
      expect(action.template).toBe('açcént tëst'); // Template is generated from lowercased name
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const builder = new ActionDefinitionBuilder('test:long');

      expect(() => builder.withName(longString)).not.toThrow();
      expect(() => builder.withDescription(longString)).not.toThrow();
      expect(() => builder.withTemplate(longString)).not.toThrow();
    });

    it('should handle many components and prerequisites', () => {
      const components = Array.from({ length: 100 }, (_, i) => `test:comp${i}`);
      const prerequisites = Array.from(
        { length: 100 },
        (_, i) => `test:cond${i}`
      );

      const builder = new ActionDefinitionBuilder('test:many')
        .withName('Many Items')
        .withDescription('Test with many items')
        .asBasicAction()
        .requiresComponents(components)
        .withPrerequisites(prerequisites);

      const partial = builder.toPartial();
      expect(partial.required_components.actor).toHaveLength(100);
      expect(partial.prerequisites).toHaveLength(100);
    });
  });
});
