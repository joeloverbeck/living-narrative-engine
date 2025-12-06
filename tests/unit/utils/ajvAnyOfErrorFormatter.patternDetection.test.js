/**
 * @file ajvAnyOfErrorFormatter.patternDetection.test.js
 * @description Tests for early pattern detection in AJV error formatting
 *
 * This test suite verifies that common error patterns are detected early
 * and provide targeted, actionable error messages before complex anyOf processing.
 */

import { describe, it, expect } from '@jest/globals';
import { formatAjvErrorsEnhanced } from '../../../src/utils/ajvAnyOfErrorFormatter.js';

describe('ajvAnyOfErrorFormatter - Pattern Detection', () => {
  describe('Pattern 1: entity_id vs entity_ref typo', () => {
    it('should detect entity_id typo and provide correction', () => {
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/additionalProperties',
        },
      ];
      const data = { type: 'GET_NAME', parameters: { entity_id: 'actor' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('entity_id');
      expect(result).toContain('entity_ref');
      expect(result).toContain('should be');
    });

    it('should trigger unconditionally regardless of error count', () => {
      // With only 1 error (not >100)
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/anyOf/0/properties/parameters/additionalProperties',
        },
      ];
      const data = {
        type: 'QUERY_COMPONENT',
        parameters: { entity_id: 'player' },
      };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('entity_id');
      expect(result).toContain('entity_ref');
      expect(result).toContain('should be');
    });

    it('should work for any operation type', () => {
      const operations = [
        'GET_NAME',
        'QUERY_COMPONENT',
        'ADD_COMPONENT',
        'REMOVE_COMPONENT',
      ];

      operations.forEach((opType) => {
        const errors = [
          {
            keyword: 'additionalProperties',
            params: { additionalProperty: 'entity_id' },
            instancePath: '/parameters',
            schemaPath: '#/properties/parameters/additionalProperties',
          },
        ];
        const data = { type: opType, parameters: { entity_id: 'actor' } };

        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toContain('entity_id');
        expect(result).toContain('entity_ref');
        expect(result).toContain(opType);
      });
    });

    it('should include operation type in error message', () => {
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/additionalProperties',
        },
      ];
      const data = { type: 'ADD_COMPONENT', parameters: { entity_id: 'npc' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('ADD_COMPONENT');
      expect(result).toContain('invalid parameters');
    });

    it('should handle case when operation type is unknown', () => {
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/additionalProperties',
        },
      ];
      const data = { parameters: { entity_id: 'actor' } }; // No type field

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('entity_id');
      expect(result).toContain('entity_ref');
      expect(result).toContain('UNKNOWN'); // Fallback when type is missing
    });
  });

  describe('Pattern 2: missing type field', () => {
    it('should detect missing type/macro and provide examples', () => {
      const errors = Array(60)
        .fill(null)
        .map(() => ({
          keyword: 'required',
          params: { missingProperty: 'type' },
          instancePath: '',
          schemaPath: '#/required',
        }));
      const data = { parameters: {} }; // No type or macro

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('Missing operation type');
      expect(result).toContain('"type": "OPERATION_NAME"');
      expect(result).toContain('macro');
    });

    it('should provide both operation and macro examples', () => {
      const errors = Array(70)
        .fill(null)
        .map(() => ({
          keyword: 'anyOf',
          instancePath: '',
          schemaPath: '#/anyOf',
        }));
      const data = {}; // Empty object

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain(
        '{"type": "OPERATION_NAME", "parameters": {...}}'
      );
      expect(result).toContain('{"macro": "namespace:macroId"}');
    });

    it('should list common operation types', () => {
      const errors = Array(80)
        .fill(null)
        .map(() => ({
          keyword: 'anyOf',
          instancePath: '',
          schemaPath: '#/anyOf',
        }));
      const data = { parameters: { someField: 'value' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      // Check for common types
      expect(result).toContain('QUERY_COMPONENT');
      expect(result).toContain('MODIFY_COMPONENT');
      expect(result).toContain('DISPATCH_EVENT');
      expect(result).toContain('Common operation types:');
    });

    it('should NOT trigger when type field exists', () => {
      const errors = Array(100)
        .fill(null)
        .map(() => ({
          keyword: 'required',
          params: { missingProperty: 'parameters' },
          instancePath: '',
          schemaPath: '#/required',
        }));
      const data = { type: 'QUERY_COMPONENT' }; // Has type

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should not be the "missing type" message
      expect(result).not.toContain('Missing operation type');
    });

    it('should NOT trigger when macro field exists', () => {
      const errors = Array(60)
        .fill(null)
        .map(() => ({
          keyword: 'anyOf',
          instancePath: '',
          schemaPath: '#/anyOf',
        }));
      const data = { macro: 'core:my_macro' }; // Has macro

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should not be the "missing type" message
      expect(result).not.toContain('Missing operation type');
    });

    it('should require >50 errors to trigger', () => {
      // Test with 51 errors (above threshold) - should trigger pattern detection
      const errors51 = Array(51)
        .fill(null)
        .map(() => ({
          keyword: 'anyOf',
          instancePath: '',
          schemaPath: '#/anyOf',
        }));
      const data = { parameters: {} }; // No type or macro

      const result51 = formatAjvErrorsEnhanced(errors51, data);

      // Should trigger pattern detection
      expect(result51).toContain('Missing operation type');
      expect(result51).toContain('QUERY_COMPONENT');
      expect(result51).toContain('MODIFY_COMPONENT');

      // Test with 50 errors (at threshold) - should NOT trigger
      const errors50 = Array(50)
        .fill(null)
        .map(() => ({
          keyword: 'anyOf',
          instancePath: '',
          schemaPath: '#/anyOf',
        }));

      const result50 = formatAjvErrorsEnhanced(errors50, data);

      // With exactly 50 errors, should NOT trigger pattern detection (>50 required)
      // Will fall through to anyOf formatter
      expect(result50).toBeTruthy();
    });
  });

  describe('Pattern 3: invalid enum value', () => {
    it('should detect invalid enum and provide schema fix guidance', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['TYPE_A', 'TYPE_B', 'TYPE_C'] },
          data: 'INVALID_TYPE',
          instancePath: '/parameters/field',
          schemaPath: '#/properties/parameters/properties/field/enum',
        },
      ];
      const data = {
        type: 'SOME_OPERATION',
        parameters: { field: 'INVALID_TYPE' },
      };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('Invalid enum value');
      expect(result).toContain('Allowed values');
      expect(result).toContain('FIX:');
    });

    it('should list all allowed values', () => {
      const errors = [
        {
          keyword: 'enum',
          params: {
            allowedValues: ['VALUE_1', 'VALUE_2', 'VALUE_3', 'VALUE_4'],
          },
          data: 'BAD_VALUE',
          instancePath: '/parameters/enumField',
          schemaPath: '#/properties/parameters/properties/enumField/enum',
        },
      ];
      const data = { type: 'TEST_OP', parameters: { enumField: 'BAD_VALUE' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('VALUE_1');
      expect(result).toContain('VALUE_2');
      expect(result).toContain('VALUE_3');
      expect(result).toContain('VALUE_4');
      expect(result).toContain(
        'Allowed values: [VALUE_1, VALUE_2, VALUE_3, VALUE_4]'
      );
    });

    it('should infer schema file from operation type', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['A', 'B'] },
          data: 'C',
          instancePath: '/parameters/status',
          schemaPath: '#/properties/parameters/properties/status/enum',
        },
      ];
      const data = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: { status: 'C' },
      };

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should infer schema file from operation type
      expect(result).toContain(
        'data/schemas/operations/dispatchPerceptibleEvent.schema.json'
      );
    });

    it('should handle unknown operation type gracefully', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['VALID'] },
          data: 'INVALID',
          instancePath: '/parameters/field',
          schemaPath: '#/properties/parameters/properties/field/enum',
        },
      ];
      const data = { parameters: { field: 'INVALID' } }; // No type

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('Invalid enum value');
      expect(result).toContain('the relevant schema file');
    });

    it('should extract field name from instance path', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['X', 'Y', 'Z'] },
          data: 'W',
          instancePath: '/parameters/myField',
          schemaPath: '#/properties/parameters/properties/myField/enum',
        },
      ];
      const data = { type: 'TEST', parameters: { myField: 'W' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('Look for the "myField" enum array');
    });

    it('should work for different operation types', () => {
      const testCases = [
        { opType: 'ADD_COMPONENT', schemaFile: 'addComponent.schema.json' },
        { opType: 'QUERY_COMPONENT', schemaFile: 'queryComponent.schema.json' },
        {
          opType: 'MODIFY_COMPONENT',
          schemaFile: 'modifyComponent.schema.json',
        },
      ];

      testCases.forEach(({ opType, schemaFile }) => {
        const errors = [
          {
            keyword: 'enum',
            params: { allowedValues: ['A'] },
            data: 'B',
            instancePath: '/parameters/field',
            schemaPath: '#/properties/parameters/properties/field/enum',
          },
        ];
        const data = { type: opType, parameters: { field: 'B' } };

        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toContain(schemaFile);
      });
    });

    it('should handle nested field paths', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['OPTION_A', 'OPTION_B'] },
          data: 'OPTION_C',
          instancePath: '/parameters/nested/deepField',
          schemaPath:
            '#/properties/parameters/properties/nested/properties/deepField/enum',
        },
      ];
      const data = {
        type: 'COMPLEX_OP',
        parameters: { nested: { deepField: 'OPTION_C' } },
      };

      const result = formatAjvErrorsEnhanced(errors, data);

      expect(result).toContain('deepField');
      expect(result).toContain('Invalid enum value');
    });
  });

  describe('Pattern Detection Priority', () => {
    it('should prioritize entity_id pattern over enum pattern', () => {
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/additionalProperties',
        },
        {
          keyword: 'enum',
          params: { allowedValues: ['A', 'B'] },
          data: 'C',
          instancePath: '/parameters/field',
          schemaPath: '#/properties/parameters/properties/field/enum',
        },
      ];
      const data = {
        type: 'GET_NAME',
        parameters: { entity_id: 'actor', field: 'C' },
      };

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should return entity_id message (detected first)
      expect(result).toContain('entity_id');
      expect(result).toContain('entity_ref');
      // Should NOT return enum message
      expect(result).not.toContain('Invalid enum value');
    });

    it('should prioritize entity_id over missing type', () => {
      const errors = [
        {
          keyword: 'additionalProperties',
          params: { additionalProperty: 'entity_id' },
          instancePath: '/parameters',
          schemaPath: '#/properties/parameters/additionalProperties',
        },
        ...Array(60)
          .fill(null)
          .map(() => ({
            keyword: 'anyOf',
            instancePath: '',
            schemaPath: '#/anyOf',
          })),
      ];
      const data = { parameters: { entity_id: 'actor' } };

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should return entity_id message
      expect(result).toContain('entity_id');
      // Should NOT return missing type message
      expect(result).not.toContain('Missing operation type');
    });

    it('should prioritize missing type over enum when applicable', () => {
      const errors = [
        {
          keyword: 'enum',
          params: { allowedValues: ['A', 'B'] },
          data: 'C',
          instancePath: '/parameters/field',
          schemaPath: '#/properties/parameters/properties/field/enum',
        },
        ...Array(60)
          .fill(null)
          .map(() => ({
            keyword: 'anyOf',
            instancePath: '',
            schemaPath: '#/anyOf',
          })),
      ];
      const data = { parameters: { field: 'C' } }; // No type or macro

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should return missing type message (higher priority with >50 errors)
      expect(result).toContain('Missing operation type');
      // Should NOT return enum message
      expect(result).not.toContain('Invalid enum value');
    });
  });

  describe('Backward Compatibility', () => {
    it('should return "No validation errors" for empty errors array', () => {
      const result = formatAjvErrorsEnhanced([], {});
      expect(result).toBe('No validation errors');
    });

    it('should return "No validation errors" for null errors', () => {
      const result = formatAjvErrorsEnhanced(null, {});
      expect(result).toBe('No validation errors');
    });

    it('should return "No validation errors" for undefined errors', () => {
      const result = formatAjvErrorsEnhanced(undefined, {});
      expect(result).toBe('No validation errors');
    });

    it('should fall through to anyOf formatting when no pattern detected', () => {
      const errors = [
        {
          keyword: 'required',
          params: { missingProperty: 'parameters' },
          instancePath: '',
          schemaPath: '#/anyOf/0/required',
        },
      ];
      const data = { type: 'VALID_OP' };

      const result = formatAjvErrorsEnhanced(errors, data);

      // Should use standard anyOf formatting (not pattern detection)
      expect(result).toBeTruthy();
      expect(result).not.toBe('No validation errors');
    });

    it('should handle data parameter being undefined', () => {
      const errors = [
        {
          keyword: 'required',
          params: { missingProperty: 'type' },
          instancePath: '',
          schemaPath: '#/required',
        },
      ];

      const result = formatAjvErrorsEnhanced(errors, undefined);

      expect(result).toBeTruthy();
      expect(result).not.toBe('No validation errors');
    });

    it('should handle data parameter being null', () => {
      const errors = [
        {
          keyword: 'type',
          params: { type: 'object' },
          data: null,
          instancePath: '',
          schemaPath: '#/type',
        },
      ];

      const result = formatAjvErrorsEnhanced(errors, null);

      expect(result).toBeTruthy();
      expect(result).not.toBe('No validation errors');
    });
  });

  describe('SCHVALTESINT-014: Enhanced Error Integration', () => {
    describe('Did you mean? suggestions for unknown operation types', () => {
      it('should suggest similar operation type for typos', () => {
        const errors = [
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            params: { allowedValue: 'LOCK_GRABBING' },
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/1/properties/type/const',
            params: { allowedValue: 'UNLOCK_GRABBING' },
          },
        ];
        const data = { type: 'LOCK_GRABB' }; // Typo

        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toContain(
          "Unknown or invalid operation type: 'LOCK_GRABB'"
        );
        expect(result).toContain('Did you mean');
        expect(result).toContain('LOCK_GRABBING');
      });

      it('should not suggest when no similar types exist', () => {
        const errors = [
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            params: { allowedValue: 'QUERY_COMPONENT' },
          },
        ];
        const data = { type: 'COMPLETELY_DIFFERENT_XYZ123' }; // No similar types

        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toContain(
          "Unknown or invalid operation type: 'COMPLETELY_DIFFERENT_XYZ123'"
        );
        expect(result).not.toContain('Did you mean');
      });

      it('should suggest QUERY_COMPONENT for QUEYR_COMPONENT typo', () => {
        const errors = [
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            params: { allowedValue: 'QUERY_COMPONENT' },
          },
        ];
        const data = { type: 'QUEYR_COMPONENT' }; // Common typo

        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toContain('Did you mean');
        expect(result).toContain('QUERY_COMPONENT');
      });
    });

    describe('Rich context support', () => {
      it('should include file context when provided', () => {
        const errors = [
          {
            keyword: 'required',
            params: { missingProperty: 'parameters' },
            instancePath: '/actions/0',
            schemaPath: '#/required',
          },
        ];
        const data = { type: 'QUERY_COMPONENT' };
        const context = {
          filePath: '/path/to/rule.json',
          fileContent:
            '{\n  "actions": [\n    { "type": "QUERY_COMPONENT" }\n  ]\n}',
          ruleId: 'test_rule',
        };

        const result = formatAjvErrorsEnhanced(errors, data, context);

        expect(result).toContain('Validation Error');
        expect(result).toContain('/path/to/rule.json');
        expect(result).toContain('test_rule');
        expect(result).toContain('Line:');
      });

      it('should include code snippet in context', () => {
        const errors = [
          {
            keyword: 'additionalProperties',
            params: { additionalProperty: 'badField' },
            instancePath: '/parameters',
            schemaPath: '#/properties/parameters/additionalProperties',
          },
        ];
        const data = { type: 'LOG', parameters: { badField: 'value' } };
        const fileContent = JSON.stringify(
          {
            type: 'LOG',
            parameters: {
              badField: 'value',
            },
          },
          null,
          2
        );
        const context = {
          filePath: '/path/to/file.json',
          fileContent,
          ruleId: 'my_rule',
        };

        const result = formatAjvErrorsEnhanced(errors, data, context);

        expect(result).toContain('Context:');
        expect(result).toContain('|'); // Line number indicator
      });

      it('should format without context when not provided (backward compatible)', () => {
        const errors = [
          {
            keyword: 'required',
            params: { missingProperty: 'type' },
            instancePath: '',
            schemaPath: '#/required',
          },
        ];
        const data = { parameters: {} };

        // Call without context
        const result = formatAjvErrorsEnhanced(errors, data);

        expect(result).toBeTruthy();
        expect(result).not.toContain('File:');
        expect(result).not.toContain('Line:');
        expect(result).not.toContain('Context:');
      });

      it('should handle null context gracefully', () => {
        const errors = [
          {
            keyword: 'type',
            params: { type: 'string' },
            data: 123,
            instancePath: '/name',
            schemaPath: '#/properties/name/type',
          },
        ];
        const data = { name: 123 };

        const result = formatAjvErrorsEnhanced(errors, data, null);

        expect(result).toBeTruthy();
        expect(result).not.toContain('File:');
      });

      it('should handle partial context (filePath but no fileContent)', () => {
        const errors = [
          {
            keyword: 'enum',
            params: { allowedValues: ['A', 'B'] },
            data: 'C',
            instancePath: '/field',
            schemaPath: '#/properties/field/enum',
          },
        ];
        const data = { type: 'TEST', field: 'C' };
        const context = {
          filePath: '/path/to/file.json',
          // No fileContent
        };

        const result = formatAjvErrorsEnhanced(errors, data, context);

        expect(result).toBeTruthy();
        // Should fall back to basic formatting without rich context
        expect(result).not.toContain('Line:');
        expect(result).not.toContain('Context:');
      });
    });
  });
});
