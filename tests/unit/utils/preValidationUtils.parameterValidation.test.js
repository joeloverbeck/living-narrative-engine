/**
 * @file preValidationUtils.parameterValidation.test.js
 * @description Tests for enhanced parameter validation in pre-validation utils
 */

import {
  describe,
  it,
  expect,
} from '@jest/globals';

import {
  validateOperationStructure,
  validateRuleStructure,
  performPreValidation,
} from '../../../src/utils/preValidationUtils.js';

describe('preValidationUtils - Parameter Validation', () => {
  describe('validateOperationStructure - common parameter mistakes', () => {
    it('should catch entity_id instead of entity_ref in GET_NAME operation', () => {
      const operation = {
        type: 'GET_NAME',
        parameters: {
          entity_id: '{context.someVariable}', // Wrong field name
          result_variable: 'name'
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Use "entity_ref" instead of "entity_id"')
        ])
      );
    });

    it('should accept correct entity_ref in GET_NAME operation', () => {
      const operation = {
        type: 'GET_NAME',
        parameters: {
          entity_ref: 'actor',
          result_variable: 'name'
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should catch entity_id in QUERY_COMPONENT operation', () => {
      const operation = {
        type: 'QUERY_COMPONENT',
        parameters: {
          entity_id: 'actor', // Wrong field name
          component_type: 'core:position',
          result_variable: 'position'
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('QUERY_COMPONENT expects: entity_ref, component_type, result_variable')
        ])
      );
    });

    it('should catch entity_id in ADD_COMPONENT operation', () => {
      const operation = {
        type: 'ADD_COMPONENT',
        parameters: {
          entity_id: 'actor', // Wrong field name
          component_type: 'positioning:bending_over',
          value: { surface_id: 'table' }
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
    });

    it('should catch entity_id in REMOVE_COMPONENT operation', () => {
      const operation = {
        type: 'REMOVE_COMPONENT',
        parameters: {
          entity_id: 'actor', // Wrong field name
          component_type: 'positioning:bending_over'
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
    });

    it('should provide helpful suggestion with actual value for entity_id mistake', () => {
      const operation = {
        type: 'GET_NAME',
        parameters: {
          entity_id: '{context.bendingOverInfo.surface_id}',
          result_variable: 'surfaceName'
        }
      };

      const result = validateOperationStructure(operation);
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Change to: "entity_ref": "{context.bendingOverInfo.surface_id}"')
        ])
      );
    });
  });

  describe('validateRuleStructure - with parameter validation', () => {
    it('should catch entity_id error in rule actions', () => {
      const rule = {
        rule_id: 'test_rule',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor',
              result_variable: 'actorName'
            }
          },
          {
            type: 'GET_NAME',
            parameters: {
              entity_id: '{context.someId}', // Error here
              result_variable: 'targetName'
            }
          }
        ]
      };

      const result = validateRuleStructure(rule);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
      expect(result.path).toContain('actions[1]');
    });

    it('should validate correct rule with all entity_ref fields', () => {
      const rule = {
        rule_id: 'test_rule',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_ref: 'actor',
              result_variable: 'actorName'
            }
          },
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:position',
              result_variable: 'position'
            }
          },
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'positioning:bending_over'
            }
          },
          { macro: 'core:logSuccessAndEndTurn' }
        ]
      };

      const result = validateRuleStructure(rule);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('performPreValidation - integration with parameter validation', () => {
    it('should catch entity_id error when validating rule schema', () => {
      const ruleData = {
        rule_id: 'handle_straighten_up',
        event_type: 'core:attempt_action',
        condition: { condition_ref: 'positioning:event-is-action-straighten-up' },
        actions: [
          {
            type: 'GET_NAME',
            parameters: {
              entity_id: '{context.bendingOverInfo.surface_id}', // The actual error from the file
              result_variable: 'surfaceName'
            }
          }
        ]
      };

      const result = performPreValidation(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json',
        'straighten_up.rule.json'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid parameter "entity_id"');
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Use "entity_ref" instead of "entity_id"')
        ])
      );
    });
  });
});