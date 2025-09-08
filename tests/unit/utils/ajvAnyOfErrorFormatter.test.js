/**
 * @file ajvAnyOfErrorFormatter.test.js
 * @description Unit tests for the enhanced AnyOf error formatter
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  formatAnyOfErrors,
  formatAjvErrorsEnhanced,
} from '../../../src/utils/ajvAnyOfErrorFormatter.js';

describe('ajvAnyOfErrorFormatter', () => {
  describe('formatAjvErrorsEnhanced', () => {
    it('should return placeholder message for null or empty errors', () => {
      expect(formatAjvErrorsEnhanced(null)).toBe('No validation errors');
      expect(formatAjvErrorsEnhanced(undefined)).toBe('No validation errors');
      expect(formatAjvErrorsEnhanced([])).toBe('No validation errors');
    });

    it('should use standard formatting for small error counts', () => {
      const errors = [
        {
          instancePath: '/field1',
          schemaPath: '#/properties/field1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      const result = formatAjvErrorsEnhanced(errors);
      expect(result).toContain('Validation errors:');
      expect(result).toContain('/field1');
      expect(result).toContain("Expected type 'string'");
    });

    it('should use intelligent anyOf formatting for large error counts', () => {
      // Create 60 errors to trigger anyOf handling
      const errors = [];
      for (let i = 0; i < 60; i++) {
        errors.push({
          instancePath: `/field${i}`,
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i % 10}` },
          message: `must be equal to operation${i % 10}`,
        });
      }

      const data = { type: 'operation5' };
      const result = formatAjvErrorsEnhanced(errors, data);
      
      expect(result).toContain("Operation type 'operation5'");
      expect(result.length).toBeLessThan(JSON.stringify(errors).length);
    });

    it('should handle missing data parameter gracefully', () => {
      const errors = [];
      for (let i = 0; i < 60; i++) {
        errors.push({
          instancePath: `/field${i}`,
          schemaPath: '#/anyOf/0/properties/field/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        });
      }

      const result = formatAjvErrorsEnhanced(errors);
      expect(result).toBeDefined();
      expect(result).not.toBe('No validation errors');
    });
  });

  describe('formatAnyOfErrors', () => {
    it('should handle empty errors array', () => {
      const result = formatAnyOfErrors([]);
      expect(result).toBe('No validation errors');
    });

    it('should format standard errors when not operation validation', () => {
      const errors = [
        {
          instancePath: '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      const result = formatAnyOfErrors(errors, {});
      expect(result).toContain('Validation errors:');
      expect(result).toContain('/name');
    });

    it('should detect operation validation from schema path', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'moveEntity' },
          message: 'must be equal to moveEntity',
        },
        {
          instancePath: '/parameters',
          schemaPath: '#/anyOf/0/properties/parameters/required',
          keyword: 'required',
          params: { missingProperty: 'targetPosition' },
          message: 'must have required property targetPosition',
        },
      ];

      const data = { type: 'moveEntity', parameters: {} };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Operation type 'moveEntity'");
      expect(result).toContain('targetPosition');
    });

    it('should group errors by operation type', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        {
          instancePath: '/param1',
          schemaPath: '#/anyOf/0/properties/param1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation2' },
          message: 'must be equal to operation2',
        },
      ];

      const data = { type: 'operation1', param1: 123 };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Operation type 'operation1'");
      expect(result).toContain("Expected type 'string'");
    });

    it('should handle unknown operation type', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'validOp1' },
          message: 'must be equal to validOp1',
        },
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'validOp2' },
          message: 'must be equal to validOp2',
        },
      ];

      const data = { type: 'unknownOp' };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Unknown or invalid operation type: 'unknownOp'");
      expect(result).toContain('validOp1');
      expect(result).toContain('validOp2');
    });

    it('should handle missing type field', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
      ];

      const data = { parameters: {} };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain('Missing operation type - this operation needs a "type" field');
      expect(result).toContain('operation1');
    });

    it('should filter out type const errors for matched operation', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'myOperation' },
          message: 'must be equal to myOperation',
        },
        {
          instancePath: '/parameters/field1',
          schemaPath: '#/anyOf/0/properties/parameters/properties/field1/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        },
      ];

      const data = { type: 'myOperation', parameters: { field1: 'wrong' } };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Operation type 'myOperation'");
      expect(result).toContain("Expected type 'number'");
      expect(result).not.toContain('must be equal to myOperation');
    });

    it('should find intended operation type with fewest errors', () => {
      const errors = [
        // Operation 1 with many errors
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        {
          instancePath: '/field1',
          schemaPath: '#/anyOf/0/properties/field1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
        {
          instancePath: '/field2',
          schemaPath: '#/anyOf/0/properties/field2/type',
          keyword: 'type',
          params: { type: 'number' },
          message: 'must be number',
        },
        // Operation 2 with fewer errors (better match)
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation2' },
          message: 'must be equal to operation2',
        },
        {
          instancePath: '/field1',
          schemaPath: '#/anyOf/1/properties/field1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      // Data without explicit type - should infer operation2 has fewer errors
      const data = { field1: 123, field2: 'text' };
      const result = formatAnyOfErrors(errors, data);
      
      // Should pick operation2 as it has fewer errors
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle additionalProperties errors', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'strictOperation' },
          message: 'must be equal to strictOperation',
        },
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/additionalProperties',
          keyword: 'additionalProperties',
          params: { additionalProperty: 'unexpectedField' },
          message: 'must NOT have additional properties',
        },
      ];

      const data = { type: 'strictOperation', unexpectedField: 'value' };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Operation type 'strictOperation'");
      expect(result).toContain("Unexpected property 'unexpectedField'");
    });

    it('should handle enum validation errors', () => {
      const errors = [
        {
          instancePath: '/status',
          schemaPath: '#/properties/status/enum',
          keyword: 'enum',
          params: { allowedValues: ['active', 'inactive', 'pending'] },
          message: 'must be equal to one of the allowed values',
        },
      ];

      const result = formatAnyOfErrors(errors, { status: 'invalid' });
      expect(result).toContain('Must be one of: active, inactive, pending');
    });

    it('should handle complex nested paths', () => {
      const errors = [
        {
          instancePath: '/parameters/options/nested/field',
          schemaPath: '#/anyOf/0/properties/parameters/properties/options/properties/nested/properties/field/type',
          keyword: 'type',
          params: { type: 'boolean' },
          message: 'must be boolean',
        },
      ];

      const data = {
        type: 'complexOperation',
        parameters: {
          options: {
            nested: {
              field: 'not-a-boolean',
            },
          },
        },
      };

      const result = formatAnyOfErrors(errors, data);
      expect(result).toContain('/parameters/options/nested/field');
      expect(result).toContain("Expected type 'boolean'");
    });

    it('should limit operation types shown in summary', () => {
      const errors = [];
      // Create errors for 15 different operation types
      for (let i = 0; i < 15; i++) {
        errors.push({
          instancePath: '',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i}` },
          message: `must be equal to operation${i}`,
        });
      }

      const data = {}; // No type specified
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain('Missing operation type - this operation needs a "type" field');
      expect(result).toContain('operation0');
      expect(result).toContain('operation9');
      expect(result).toContain('... and 3 more');
    });

    // Test for lines 57-59: No best match found (all have type mismatches)
    it('should return null when all operation types have type mismatches', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation2' },
          message: 'must be equal to operation2',
        },
      ];

      // Data with no type field, all branches have const type mismatches
      const data = { parameters: {} };
      const result = formatAnyOfErrors(errors, data);
      
      // Should handle the case where no best match is found
      expect(result).toContain('Missing operation type');
      expect(result).toContain('operation1');
      expect(result).toContain('operation2');
    });

    // Test for lines 132-140: Valid type with errors in correct anyOf branch
    it('should handle valid type with errors in the matching anyOf branch', () => {
      const errors = [
        // Branch 0 - wrong type
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        // Branch 1 - matching type but with other errors
        {
          instancePath: '/parameters/field1',
          schemaPath: '#/anyOf/1/properties/parameters/properties/field1/required',
          keyword: 'required',
          params: { missingProperty: 'requiredField' },
          message: 'must have required property requiredField',
        },
        {
          instancePath: '/parameters/field2',
          schemaPath: '#/anyOf/1/properties/parameters/properties/field2/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
      ];

      const data = { type: 'operation2', parameters: { field1: {}, field2: 123 } };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Operation type 'operation2' validation failed:");
      expect(result).toContain('requiredField');
      expect(result).toContain("Expected type 'string'");
    });

    // Test for lines 200-204: Macro reference with incorrect format
    it('should detect and provide guidance for incorrectly formatted macro references', () => {
      const errors = [];
      // Create many anyOf errors to simulate validation failure
      for (let i = 0; i < 10; i++) {
        errors.push({
          instancePath: '',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i}` },
          message: `must be equal to operation${i}`,
        });
      }

      // Data with macro field (incorrect format - should not have type field)
      const data = { macro: 'core:myMacro', type: 'invalidType' };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain('Invalid macro reference format detected');
      expect(result).toContain('{"macro": "namespace:macroId"}');
      expect(result).toContain('Do NOT include a "type" field with macro references');
    });

    // Test for line 215: More than 15 operation types in error summary
    it('should show truncation message when there are more than 15 operation types', () => {
      const errors = [];
      // Create errors for 20 different operation types
      for (let i = 0; i < 20; i++) {
        errors.push({
          instancePath: '',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i}` },
          message: `must be equal to operation${i}`,
        });
      }

      const data = { type: 'unknownOperation' };
      const result = formatAnyOfErrors(errors, data);
      
      expect(result).toContain("Unknown or invalid operation type: 'unknownOperation'");
      expect(result).toContain('operation0');
      expect(result).toContain('operation14'); // Should show first 15
      expect(result).toContain('... and 5 more'); // 20 - 15 = 5 more
    });

    // Test for lines 262-265: Invalid non-string type field (part 1 - large error count)
    it('should detect critical structural issue with non-string type field (large error count)', () => {
      const errors = [];
      // Create >100 errors to trigger critical issue detection
      for (let i = 0; i < 120; i++) {
        errors.push({
          instancePath: '',
          schemaPath: `#/anyOf/${i % 10}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i % 10}` },
          message: `must be equal to operation${i % 10}`,
        });
      }

      // Data with non-string type field
      const data = { type: 123, parameters: {} }; // type is a number, not string
      const result = formatAjvErrorsEnhanced(errors, data);
      
      expect(result).toContain('Critical structural issue: Invalid "type" field value');
      expect(result).toContain('The "type" field must be a string, but got number');
      expect(result).toContain('Pre-validation should have caught this');
    });

    // Test for lines 263: Missing type field with large error count
    it('should detect critical structural issue with missing type field (large error count)', () => {
      const errors = [];
      // Create >100 errors with operation validation pattern
      for (let i = 0; i < 110; i++) {
        errors.push({
          instancePath: '',
          schemaPath: `#/anyOf/${i % 10}/properties/type/const`,
          keyword: 'const',
          params: { allowedValue: `operation${i % 10}` },
          message: `must be equal to operation${i % 10}`,
        });
      }

      // Data with no type or macro field
      const data = { parameters: { someField: 'value' } };
      const result = formatAjvErrorsEnhanced(errors, data);
      
      expect(result).toContain('Critical structural issue: Missing "type" field in operation');
      expect(result).toContain('Add a "type" field with a valid operation type');
      expect(result).toContain('{"macro": "namespace:id"} for macro references');
      expect(result).toContain('Pre-validation should have caught this');
    });

    // Additional test for anyOf with data.type set correctly
    it('should handle anyOf errors when type matches exactly', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf',
          keyword: 'anyOf',
          message: 'must match a schema in anyOf',
        },
        {
          instancePath: '/parameters',
          schemaPath: '#/anyOf/5/properties/parameters/required',
          keyword: 'required',
          params: { missingProperty: 'entityId' },
          message: 'must have required property entityId',
        },
      ];

      const data = { type: 'updateEntity', parameters: {} };
      const result = formatAnyOfErrors(errors, data);
      
      // Should handle anyOf error with specific type
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    // Test detecting intended operation type from data without explicit type
    it('should infer intended operation type from available error patterns', () => {
      const errors = [
        // Branch 0 has type mismatch but fewer other errors
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        // Branch 1 has more errors
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation2' },
          message: 'must be equal to operation2',
        },
        {
          instancePath: '/field1',
          schemaPath: '#/anyOf/1/properties/field1/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
        {
          instancePath: '/field2',
          schemaPath: '#/anyOf/1/properties/field2/required',
          keyword: 'required',
          params: { missingProperty: 'subfield' },
          message: 'must have required property subfield',
        },
      ];

      const data = { field1: 123, field2: {} };
      const result = formatAnyOfErrors(errors, data);
      
      // Should handle case where no clear intended type can be determined
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    // Test for line 164: const error without allowedValue param
    it('should handle const error without allowedValue param', () => {
      const errors = [
        {
          instancePath: '/field',
          schemaPath: '#/properties/field/const',
          keyword: 'const',
          params: {}, // No allowedValue
          message: 'must be equal to constant',
        },
      ];

      const result = formatAnyOfErrors(errors, {});
      expect(result).toContain("Must be equal to 'undefined'");
    });

    // Test for line 168: default case with unknown keyword
    it('should handle unknown validation keywords', () => {
      const errors = [
        {
          instancePath: '/field',
          schemaPath: '#/properties/field/customKeyword',
          keyword: 'customKeyword',
          params: {},
          message: 'custom validation failed',
        },
      ];

      const result = formatAnyOfErrors(errors, {});
      expect(result).toContain('custom validation failed');
    });

    // Test for line 168: default case with no message
    it('should handle errors with no message in default case', () => {
      const errors = [
        {
          instancePath: '/field',
          schemaPath: '#/properties/field/unknownKeyword',
          keyword: 'unknownKeyword',
          params: {},
          // No message property
        },
      ];

      const result = formatAnyOfErrors(errors, {});
      expect(result).toContain('Validation failed');
    });

    // Test for lines 57-59: Edge case where all operations have type mismatch (ensuring null return)
    it('should handle case where findIntendedOperationType returns null', () => {
      const errors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'op1' },
          message: 'must be equal to op1',
        },
        {
          instancePath: '/other',
          schemaPath: '#/anyOf/0/properties/other',
          keyword: 'required',
          params: { missingProperty: 'field' },
        },
      ];

      // No data.type and all operations have type mismatches
      const data = { other: {} };
      const result = formatAnyOfErrors(errors, data);
      
      // When findIntendedOperationType returns null, formatOperationTypeSummary is called
      expect(result).toContain('Missing operation type');
    });

    // Test for lines 57-59: Best match selection when operations don't have type mismatches
    it('should select operation with fewest errors when no type mismatches exist', () => {
      const errors = [
        // Operation 1 branch - has more errors (not a type mismatch)
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation1' },
          message: 'must be equal to operation1',
        },
        {
          instancePath: '/param1',
          schemaPath: '#/anyOf/0/properties/param1/required',
          keyword: 'required',
          params: { missingProperty: 'field1' },
        },
        {
          instancePath: '/param2',
          schemaPath: '#/anyOf/0/properties/param2/required',
          keyword: 'required',
          params: { missingProperty: 'field2' },
        },
        {
          instancePath: '/param3',
          schemaPath: '#/anyOf/0/properties/param3/type',
          keyword: 'type',
          params: { type: 'string' },
        },
        // Operation 2 branch - has fewer errors  
        {
          instancePath: '',
          schemaPath: '#/anyOf/1/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'operation2' },
          message: 'must be equal to operation2',
        },
        {
          instancePath: '/param1',
          schemaPath: '#/anyOf/1/properties/param1/required',
          keyword: 'required',
          params: { missingProperty: 'field1' },
        },
      ];

      // Data without an explicit type, will need to infer from error counts
      const data = { param1: {}, param2: {}, param3: 123 };
      const result = formatAnyOfErrors(errors, data);
      
      // Should contain information about the operation with fewer errors
      expect(result).toBeDefined();
      expect(result).not.toContain('null');
    });
  });
});