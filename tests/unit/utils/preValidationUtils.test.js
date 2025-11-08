/**
 * @file preValidationUtils.test.js
 * @description Unit tests for preValidationUtils
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import {
  validateOperationStructure,
  validateAllOperations,
  validateRuleStructure,
  performPreValidation,
  formatPreValidationError,
  validateOperationType,
} from '../../../src/utils/preValidationUtils.js';
import OperationValidationError from '../../../src/errors/operationValidationError.js';

describe('preValidationUtils', () => {
  describe('validateOperationStructure', () => {
    describe('valid operations', () => {
      it('should validate a simple operation with type and parameters', () => {
        const operation = {
          type: 'QUERY_COMPONENT',
          parameters: {
            componentId: 'core:actor',
            entityId: 'player',
          },
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should validate operation type END_TURN without parameters', () => {
        const operation = {
          type: 'END_TURN',
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should validate a macro reference', () => {
        const operation = {
          macro: 'core:common_macro',
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should validate operations with all known types', () => {
        const knownTypes = [
          'MODIFY_COMPONENT',
          'ADD_COMPONENT',
          'REMOVE_COMPONENT',
          'DISPATCH_EVENT',
          'IF',
          'FOR_EACH',
          'LOG',
          'SET_VARIABLE',
          'QUERY_ENTITIES',
          'HAS_COMPONENT',
        ];

        knownTypes.forEach((type) => {
          const operation = {
            type,
            parameters: {},
          };
          const result = validateOperationStructure(operation);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeNull();
        });
      });

      it('should validate OPEN_CONTAINER operation type', () => {
        const operation = {
          type: 'OPEN_CONTAINER',
          parameters: {
            actorEntity: '{event.payload.actorId}',
            containerEntity: '{event.payload.targetId}',
            result_variable: 'openResult',
          },
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });

      it('should validate OPEN_CONTAINER without result_variable parameter', () => {
        const operation = {
          type: 'OPEN_CONTAINER',
          parameters: {
            actorEntity: 'actor',
            containerEntity: 'container',
          },
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(true);
      });

      it('should validate item-related operation types', () => {
        const itemOperationTypes = [
          'TRANSFER_ITEM',
          'DROP_ITEM_AT_LOCATION',
          'PICK_UP_ITEM_FROM_LOCATION',
          'VALIDATE_INVENTORY_CAPACITY',
          'OPEN_CONTAINER',
          'TAKE_FROM_CONTAINER',
        ];

        itemOperationTypes.forEach((type) => {
          const operation = {
            type,
            parameters: {},
          };
          const result = validateOperationStructure(operation);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeNull();
        });
      });
    });

    describe('invalid operations', () => {
      it('should fail for null operation', () => {
        const result = validateOperationStructure(null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation must be an object');
        expect(result.path).toBe('root');
        expect(result.suggestions).toContain(
          'Ensure the operation is a valid JSON object with type and parameters fields'
        );
      });

      it('should fail for undefined operation', () => {
        const result = validateOperationStructure(undefined);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation must be an object');
      });

      it('should fail for non-object operation', () => {
        const result = validateOperationStructure('not an object');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation must be an object');
      });

      it('should fail for array instead of object', () => {
        const result = validateOperationStructure([]);
        expect(result.isValid).toBe(false);
        // Arrays are objects in JS, but the function checks for missing 'type' field first
        expect(result.error).toBe('Missing required "type" field in operation');
      });

      it('should fail for macro reference with type field', () => {
        const operation = {
          macro: 'core:macro_id',
          type: 'QUERY_COMPONENT', // This should not be here with macro
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Macro reference should not have a type field'
        );
        expect(result.suggestions).toContain(
          'Remove the type field when using macro reference'
        );
      });

      it('should fail for missing type field in regular operation', () => {
        const operation = {
          parameters: {},
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Missing required "type" field in operation');
        expect(result.suggestions[0]).toBe(
          'Add a "type" field with one of the valid operation types'
        );
      });

      it('should fail for non-string type field', () => {
        const operation = {
          type: 123, // Should be string
          parameters: {},
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation "type" field must be a string');
        expect(result.suggestions).toContain(
          'Ensure the type field is a string value like "QUERY_COMPONENT"'
        );
      });

      it('should fail for unknown operation type', () => {
        const operation = {
          type: 'UNKNOWN_OPERATION_TYPE',
          parameters: {},
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Unknown operation type "UNKNOWN_OPERATION_TYPE"'
        );
        expect(result.suggestions[0]).toBe('Valid operation types include:');
        expect(result.suggestions.length).toBeGreaterThan(1);
      });

      it('should fail for missing parameters on operations that require them', () => {
        const operation = {
          type: 'QUERY_COMPONENT',
          // Missing parameters
        };
        const result = validateOperationStructure(operation);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Missing "parameters" field for operation type "QUERY_COMPONENT"'
        );
        expect(result.suggestions).toContain(
          'Add a "parameters" object with the required fields for this operation type'
        );
      });

      it('should use custom path in error reporting', () => {
        const result = validateOperationStructure(null, 'actions[0]');
        expect(result.isValid).toBe(false);
        expect(result.path).toBe('actions[0]');
      });
    });
  });

  describe('validateAllOperations', () => {
    describe('valid structures', () => {
      it('should validate null data', () => {
        const result = validateAllOperations(null);
        expect(result.isValid).toBe(true);
      });

      it('should validate undefined data', () => {
        const result = validateAllOperations(undefined);
        expect(result.isValid).toBe(true);
      });

      it('should validate empty object', () => {
        const result = validateAllOperations({});
        expect(result.isValid).toBe(true);
      });

      it('should validate array of operations in operation context', () => {
        const operations = [
          { type: 'QUERY_COMPONENT', parameters: {} },
          { type: 'MODIFY_COMPONENT', parameters: {} },
        ];
        const result = validateAllOperations(operations, 'root', true);
        expect(result.isValid).toBe(true);
      });

      it('should validate nested structure with actions field', () => {
        const data = {
          condition: 'some_condition',
          actions: [
            { type: 'LOG', parameters: { message: 'test' } },
            { type: 'END_TURN' },
          ],
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(true);
      });

      it('should validate IF operation with then_actions and else_actions', () => {
        const data = {
          type: 'IF',
          parameters: {
            condition: {},
            then_actions: [{ type: 'LOG', parameters: { message: 'then' } }],
            else_actions: [{ type: 'LOG', parameters: { message: 'else' } }],
          },
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(true);
      });
    });

    describe('invalid structures', () => {
      it('should fail for invalid operation in array', () => {
        const operations = [
          { type: 'QUERY_COMPONENT', parameters: {} },
          { /* missing type */ parameters: {} },
        ];
        const result = validateAllOperations(operations, 'root', true);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation at index 1 failed validation: Missing required "type" field in operation');

        expect(result.path).toBe('root[1]');
      });

      it('should include snippet when parameters object is missing', () => {
        const operations = [
          { type: 'GET_NAME', parameters: { entity_ref: 'actor', result_variable: 'name' } },
          { type: 'GET_NAME', parameters: null }
        ];

        const result = validateAllOperations(operations, 'root', true);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Operation at index 1 failed validation: Missing "parameters" field for operation type "GET_NAME"'
        );
        expect(result.path).toBe('root[1]');
        expect(result.suggestions).toEqual(
          expect.arrayContaining([
            'Add a "parameters" object with the required fields for this operation type',
            expect.stringContaining('Problematic operation:')
          ])
        );
      });

      it('should fail for invalid operations in actions field', () => {
        const data = {
          actions: [{ type: 'INVALID_TYPE', parameters: {} }],
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unknown operation type');
      });

      it('should fail for invalid operations in then_actions', () => {
        const data = {
          then_actions: [
            null, // Invalid operation
          ],
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation at index 0 failed validation: Operation must be an object');

      });

      it('should fail for invalid operations in else_actions', () => {
        const data = {
          else_actions: [
            'not an object', // Invalid operation
          ],
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation at index 0 failed validation: Operation must be an object');

      });

      it('should recursively validate nested objects', () => {
        const data = {
          someField: {
            nested: {
              actions: [
                { type: 123, parameters: {} }, // Invalid type
              ],
            },
          },
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Operation at index 0 failed validation: Operation "type" field must be a string');

      });

      it('should skip validation for non-operation fields', () => {
        const data = {
          type: 'CONFIG_TYPE', // Not an operation type
          parameters: {
            someValue: 'test',
          },
          metadata: {
            description: 'test',
          },
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(true);
      });

      it('should validate complex nested structure', () => {
        const data = {
          rules: {
            actions: [
              {
                type: 'IF',
                parameters: {
                  condition: {},
                  // The nested then_actions and else_actions need to be at the root level of parameters
                  // for the validateAllOperations to find them
                },
              },
            ],
          },
          // Put the invalid operation at a level where it will be found
          then_actions: [
            { type: 'UNKNOWN_TYPE', parameters: {} }, // This should fail
          ],
        };
        const result = validateAllOperations(data);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unknown operation type');
      });

      it('should recursively validate operations inside array elements', () => {
        const operations = [
          {
            type: 'IF',
            parameters: {
              condition: {},
              // then_actions should be inside parameters for IF operations to be validated

              then_actions: [{ type: 'INVALID_NESTED', parameters: {} }],
            },
          },
        ];
        const result = validateAllOperations(operations, 'root', true);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Operation at index 0 failed validation: Unknown operation type "INVALID_NESTED"'
        );
      });
    });
  });

  describe('validateRuleStructure', () => {
    describe('valid rules', () => {
      it('should validate a complete rule structure', () => {
        const rule = {
          event_type: 'core:entity_moved',
          actions: [{ type: 'LOG', parameters: { message: 'Entity moved' } }],
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(true);
      });

      it('should validate rule with multiple actions', () => {
        const rule = {
          event_type: 'core:turn_started',
          condition: {},
          actions: [
            { type: 'QUERY_COMPONENT', parameters: {} },
            { type: 'MODIFY_COMPONENT', parameters: {} },
            { type: 'DISPATCH_EVENT', parameters: {} },
          ],
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(true);
      });
    });

    describe('invalid rules', () => {
      it('should fail for null rule data', () => {
        const result = validateRuleStructure(null);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Rule data must be an object');
      });

      it('should fail for non-object rule data', () => {
        const result = validateRuleStructure('not an object');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Rule data must be an object');
      });

      it('should fail for missing event_type', () => {
        const rule = {
          actions: [{ type: 'LOG', parameters: {} }],
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Missing required "event_type" field in rule'
        );
        expect(result.suggestions).toContain(
          'Add an "event_type" field with a namespaced event ID like "core:entity_thought"'
        );
      });

      it('should fail for missing actions field', () => {
        const rule = {
          event_type: 'core:test_event',
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Missing required "actions" field in rule');
        expect(result.suggestions).toContain(
          'Add an "actions" array with at least one operation'
        );
      });

      it('should fail for non-array actions field', () => {
        const rule = {
          event_type: 'core:test_event',
          actions: 'not an array',
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Rule "actions" field must be an array');
        expect(result.suggestions).toContain(
          'Change the actions field to an array of operations'
        );
      });

      it('should fail for empty actions array', () => {
        const rule = {
          event_type: 'core:test_event',
          actions: [],
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Rule "actions" array cannot be empty');
        expect(result.suggestions).toContain(
          'Add at least one operation to the actions array'
        );
      });

      it('should fail for invalid operations in actions', () => {
        const rule = {
          event_type: 'core:test_event',
          actions: [{ type: 'INVALID_OPERATION', parameters: {} }],
        };
        const result = validateRuleStructure(rule);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unknown operation type');
      });

      it('should use file path in error context', () => {
        const result = validateRuleStructure(null, '/path/to/rule.json');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Rule data must be an object');
      });
    });
  });

  describe('performPreValidation', () => {
    it('should validate rule schema', () => {
      const rule = {
        event_type: 'core:test',
        actions: [{ type: 'LOG', parameters: {} }],
      };
      const result = performPreValidation(
        rule,
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for invalid rule', () => {
      const rule = {
        // Missing event_type
        actions: [],
      };
      const result = performPreValidation(
        rule,
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('event_type');
    });

    it('should skip validation for non-rule schemas', () => {
      const data = { anyField: 'anyValue' };
      const result = performPreValidation(
        data,
        'schema://living-narrative-engine/component.schema.json'
      );
      expect(result.isValid).toBe(true);
    });

    it('should skip validation for unknown schemas', () => {
      const data = null;
      const result = performPreValidation(data, 'schema://unknown/schema.json');
      expect(result.isValid).toBe(true);
    });

    it('should use file path when provided', () => {
      const rule = null;
      const result = performPreValidation(
        rule,
        'schema://living-narrative-engine/rule.schema.json',
        '/mods/test/rule.json'
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('formatPreValidationError', () => {
    it('should return success message for valid result', () => {
      const result = {
        isValid: true,
        error: null,
        path: null,
        suggestions: null,
      };
      const message = formatPreValidationError(
        result,
        'test.json',
        'test-schema'
      );
      expect(message).toBe('No pre-validation errors');
    });

    it('should format error without suggestions', () => {
      const result = {
        isValid: false,
        error: 'Test error message',
        path: 'root.field',
        suggestions: null,
      };
      const message = formatPreValidationError(
        result,
        'test.json',
        'test-schema'
      );
      expect(message).toContain("Pre-validation failed for 'test.json'");
      expect(message).toContain('Location: root.field');
      expect(message).toContain('Error: Test error message');
      expect(message).not.toContain('Suggestions:');
    });

    it('should format error with empty suggestions array', () => {
      const result = {
        isValid: false,
        error: 'Test error',
        path: 'root',
        suggestions: [],
      };
      const message = formatPreValidationError(result, 'file.json', 'schema');
      expect(message).not.toContain('Suggestions:');
    });

    it('should format error with suggestions', () => {
      const result = {
        isValid: false,
        error: 'Missing type field',
        path: 'actions[0]',
        suggestions: [
          'Add a type field',
          'Valid types: QUERY_COMPONENT, MODIFY_COMPONENT',
        ],
      };
      const message = formatPreValidationError(
        result,
        'rule.json',
        'rule-schema'
      );
      expect(message).toContain("Pre-validation failed for 'rule.json'");
      expect(message).toContain('Location: actions[0]');
      expect(message).toContain('Error: Missing type field');
      expect(message).toContain('Suggestions:');
      expect(message).toContain('- Add a type field');
      expect(message).toContain(
        '- Valid types: QUERY_COMPONENT, MODIFY_COMPONENT'
      );
    });

    it('should format multiline message correctly', () => {
      const result = {
        isValid: false,
        error: 'Complex error',
        path: 'deep.nested.path',
        suggestions: ['Fix 1', 'Fix 2', 'Fix 3'],
      };
      const message = formatPreValidationError(
        result,
        'complex.json',
        'schema'
      );
      const lines = message.split('\n');
      expect(lines).toHaveLength(7); // Header + location + error + suggestions header + 3 suggestions
      expect(lines[0]).toContain('complex.json');
      expect(lines[1]).toContain('deep.nested.path');
      expect(lines[2]).toContain('Complex error');
      expect(lines[3]).toContain('Suggestions:');
    });

    it('should handle all parameters correctly', () => {
      const result = {
        isValid: false,
        error: 'Error with all params',
        path: 'test.path',
        suggestions: ['Suggestion 1'],
      };
      const message = formatPreValidationError(
        result,
        'filename.json',
        'schema://test/schema.json'
      );
      expect(message).toContain('filename.json');
      expect(message).toContain('test.path');
      expect(message).toContain('Error with all params');
      expect(message).toContain('Suggestion 1');
    });
  });

  describe('validateOperationType - Enhanced Error Messages', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
      };
    });

    it('should provide detailed error for missing whitelist entry', () => {
      expect(() => {
        validateOperationType('NEW_OPERATION', mockLogger);
      }).toThrow(OperationValidationError);

      expect(() => {
        validateOperationType('NEW_OPERATION', mockLogger);
      }).toThrow(/NOT IN PRE-VALIDATION WHITELIST/);

      expect(() => {
        validateOperationType('NEW_OPERATION', mockLogger);
      }).toThrow(/src\/utils\/preValidationUtils\.js/);
    });

    it('should include guidance for all potential issues', () => {
      expect(() => {
        validateOperationType('MISSING_OP', mockLogger);
      }).toThrow(OperationValidationError);

      // Test the error message separately
      let errorMessage;
      try {
        validateOperationType('MISSING_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toMatch(/SCHEMA FILE NOT FOUND/);
      expect(errorMessage).toMatch(/SCHEMA NOT REFERENCED/);
      expect(errorMessage).toMatch(/NOT IN PRE-VALIDATION WHITELIST/);
    });

    it('should pass validation for fully registered operation', () => {
      expect(() => {
        validateOperationType('ADD_COMPONENT', mockLogger);
      }).not.toThrow();
    });

    it('should provide correct verification commands', () => {
      expect(() => {
        validateOperationType('BAD_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('BAD_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toMatch(/npm run validate/);
      expect(errorMessage).toMatch(/npm run validate:strict/);
      expect(errorMessage).toMatch(/npm run test:unit/);
    });

    it('should include file paths in error message', () => {
      expect(() => {
        validateOperationType('TEST_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('TEST_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toMatch(/src\/utils\/preValidationUtils\.js/);
      expect(errorMessage).toMatch(/data\/schemas\/operation\.schema\.json/);
      expect(errorMessage).toMatch(/data\/schemas\/operations\//);
    });

    it('should include code snippets in error message', () => {
      expect(() => {
        validateOperationType('SAMPLE_OPERATION', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('SAMPLE_OPERATION', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toMatch(/SAMPLE_OPERATION/);
      expect(errorMessage).toMatch(/Code to add:/);
      expect(errorMessage).toMatch(/Example:/);
    });

    it('should log error details to logger', () => {
      expect(() => {
        validateOperationType('UNKNOWN_OP', mockLogger);
      }).toThrow(OperationValidationError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Operation validation error',
        expect.objectContaining({
          operationType: 'UNKNOWN_OP',
          errorMessage: expect.stringContaining('UNKNOWN_OP'),
        })
      );
    });

    it('should log debug message for valid operation', () => {
      validateOperationType('QUERY_COMPONENT', mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Operation type validation passed',
        expect.objectContaining({
          operationType: 'QUERY_COMPONENT',
        })
      );
    });

    it('should set operationType property on error', () => {
      expect(() => {
        validateOperationType('MY_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType('MY_OP', mockLogger);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).toBeInstanceOf(OperationValidationError);
      expect(caughtError.operationType).toBe('MY_OP');
    });

    it('should set missingRegistrations property on error', () => {
      expect(() => {
        validateOperationType('MY_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType('MY_OP', mockLogger);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).toBeInstanceOf(OperationValidationError);
      // Enhanced implementation returns all potential missing registrations
      expect(caughtError.missingRegistrations).toEqual([
        'whitelist',
        'schema',
        'reference',
        'token',
        'handler',
        'mapping',
      ]);
    });

    it('should have correct error name', () => {
      expect(() => {
        validateOperationType('MY_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let caughtError;
      try {
        validateOperationType('MY_OP', mockLogger);
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError.name).toBe('OperationValidationError');
    });

    it('should reference CLAUDE.md documentation', () => {
      expect(() => {
        validateOperationType('TEST_OP', mockLogger);
      }).toThrow(OperationValidationError);

      let errorMessage;
      try {
        validateOperationType('TEST_OP', mockLogger);
      } catch (err) {
        errorMessage = err.message;
      }
      expect(errorMessage).toMatch(/CLAUDE\.md/);
      expect(errorMessage).toMatch(/8-step checklist/);
    });
  });
});
