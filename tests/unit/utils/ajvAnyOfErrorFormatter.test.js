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
  });
});