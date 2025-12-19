/**
 * @file preValidationUtils.macroReference.test.js
 * @description Specific tests for macro reference validation that reproduce the runtime issue
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

import {
  validateOperationStructure,
  validateRuleStructure,
  performPreValidation,
} from '../../../src/utils/preValidationUtils.js';

describe('preValidationUtils - Macro Reference Issue Reproduction', () => {
  describe('validateOperationStructure - exact macro reference from failing rule', () => {
    it('should validate the exact macro reference that causes the runtime failure', () => {
      // This is the exact macro reference from handle_get_up_from_furniture.rule.json line 149
      const macroOperation = {
        macro: 'core:logSuccessAndEndTurn',
      };

      const result = validateOperationStructure(macroOperation);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.path).toBeNull();
      expect(result.suggestions).toBeNull();
    });

    it('should validate macro reference in different contexts', () => {
      const testCases = [
        {
          name: 'macro only',
          operation: { macro: 'core:logSuccessAndEndTurn' },
        },
        {
          name: 'macro with comment',
          operation: {
            macro: 'core:logSuccessAndEndTurn',
            comment: 'End the turn successfully',
          },
        },
        {
          name: 'different macro reference',
          operation: { macro: 'positioning:someMacro' },
        },
      ];

      testCases.forEach((testCase) => {
        const result = validateOperationStructure(testCase.operation);
        expect(result.isValid).toBe(
          true,
          `Failed for test case: ${testCase.name}`
        );
        expect(result.error).toBeNull();
      });
    });

    it('should validate macro reference with proper namespacing pattern', () => {
      const validMacroReferences = [
        'core:logSuccessAndEndTurn',
        'positioning:establishSittingCloseness',
        'combat:attackSequence',
        'dialog:endConversation',
        'mod_name:macro_name',
      ];

      validMacroReferences.forEach((macroId) => {
        const operation = { macro: macroId };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true, `Failed for macro: ${macroId}`);
        expect(result.error).toBeNull();
      });
    });
  });

  describe('validateRuleStructure - rule with macro reference', () => {
    it('should validate rule structure that contains the failing macro reference', () => {
      // Simplified version of the failing rule structure
      const rule = {
        rule_id: 'test_rule',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:position',
              result_variable: 'actorPosition',
            },
          },
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'logMessage',
              value: 'Test action completed.',
            },
          },
          {
            macro: 'core:logSuccessAndEndTurn',
          },
        ],
      };

      const result = validateRuleStructure(rule);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate rule with only macro reference action', () => {
      const rule = {
        event_type: 'core:test_event',
        actions: [
          {
            macro: 'core:logSuccessAndEndTurn',
          },
        ],
      };

      const result = validateRuleStructure(rule);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate mixed operations and macro references', () => {
      const rule = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'test',
              value: 'value',
            },
          },
          {
            macro: 'core:someMacro',
          },
          {
            type: 'LOG',
            parameters: {
              message: 'Done',
            },
          },
          {
            macro: 'core:anotherMacro',
          },
        ],
      };

      const result = validateRuleStructure(rule);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('performPreValidation - macro reference in rule context', () => {
    it('should validate rule with macro reference through performPreValidation', () => {
      const rule = {
        rule_id: 'test_macro_rule',
        event_type: 'core:attempt_action',
        actions: [
          {
            macro: 'core:logSuccessAndEndTurn',
          },
        ],
      };

      const result = performPreValidation(
        rule,
        'schema://living-narrative-engine/rule.schema.json',
        'test_macro_rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate complex rule with macro reference through performPreValidation', () => {
      // This mirrors the exact structure causing the issue
      const rule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_get_up_from_furniture',
        event_type: 'core:attempt_action',
        actions: [
          {
            type: 'QUERY_COMPONENT',
            parameters: {
              entity_ref: '{event.payload.actorId}',
              component_type: 'sitting-states:sitting_on',
              result_variable: 'sittingInfo',
            },
          },
          {
            type: 'REMOVE_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'sitting-states:sitting_on',
            },
          },
          {
            type: 'GET_NAME',
            parameters: { entity_ref: 'actor', result_variable: 'actorName' },
          },
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'logMessage',
              value: '{context.actorName} gets up.',
            },
          },
          {
            macro: 'core:logSuccessAndEndTurn',
          },
        ],
      };

      const result = performPreValidation(
        rule,
        'schema://living-narrative-engine/rule.schema.json',
        'handle_get_up_from_furniture.rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('edge cases for macro reference validation', () => {
    it('should fail for macro reference with invalid structure', () => {
      const invalidCases = [
        {
          name: 'empty macro string',
          operation: { macro: '' },
          expectedError: 'Missing required "type" field in operation', // This might be the bug
        },
        {
          name: 'macro with non-string value',
          operation: { macro: 123 },
          expectedError: 'Missing required "type" field in operation',
        },
        {
          name: 'macro with null value',
          operation: { macro: null },
          expectedError: 'Missing required "type" field in operation',
        },
        {
          name: 'macro reference with type field',
          operation: { macro: 'core:test', type: 'QUERY_COMPONENT' },
          expectedError: 'Macro reference should not have a type field',
        },
      ];

      invalidCases.forEach((testCase) => {
        const result = validateOperationStructure(testCase.operation);
        expect(result.isValid).toBe(false, `Should fail for: ${testCase.name}`);
        expect(result.error).toContain(testCase.expectedError.split(' ')[0]);
      });
    });

    it('should provide helpful suggestions for macro reference errors', () => {
      const operationWithBothMacroAndType = {
        macro: 'core:test',
        type: 'QUERY_COMPONENT',
      };

      const result = validateOperationStructure(operationWithBothMacroAndType);
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toContain(
        'Remove the type field when using macro reference'
      );
      expect(result.suggestions).toContain(
        'Use either {"macro": "namespace:id"} OR {"type": "OPERATION_TYPE", "parameters": {...}}'
      );
    });
  });
});
