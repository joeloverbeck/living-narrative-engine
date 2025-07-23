/**
 * @file testModuleValidationError.test.js
 * @description Unit tests for TestModuleValidationError
 */

import { describe, it, expect } from '@jest/globals';
import { TestModuleValidationError } from '../../../../../tests/common/builders/errors/testModuleValidationError.js';

describe('TestModuleValidationError', () => {
  describe('Constructor', () => {
    it('should create error with message only', () => {
      const error = new TestModuleValidationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TestModuleValidationError);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('TestModuleValidationError');
      expect(error.errors).toEqual([]);
    });

    it('should create error with message and errors array', () => {
      const errors = [
        { field: 'llm', message: 'LLM config required' },
        { field: 'actors', message: 'No actors configured', code: 'NO_ACTORS' },
      ];

      const error = new TestModuleValidationError('Validation failed', errors);

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(errors);
    });

    it('should capture stack trace', () => {
      const error = new TestModuleValidationError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TestModuleValidationError');
    });
  });

  describe('getFormattedErrors()', () => {
    it('should return just message when no errors', () => {
      const error = new TestModuleValidationError('Simple error');

      expect(error.getFormattedErrors()).toBe('Simple error');
    });

    it('should format single error', () => {
      const error = new TestModuleValidationError('Validation failed', [
        { field: 'test', message: 'Test field error' },
      ]);

      const formatted = error.getFormattedErrors();

      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('Validation errors:');
      expect(formatted).toContain('  - test: Test field error');
    });

    it('should format multiple errors', () => {
      const error = new TestModuleValidationError('Multiple errors', [
        { field: 'field1', message: 'Error 1' },
        { field: 'field2', message: 'Error 2', code: 'ERROR_2' },
      ]);

      const formatted = error.getFormattedErrors();

      expect(formatted).toContain('Multiple errors');
      expect(formatted).toContain('  - field1: Error 1');
      expect(formatted).toContain('  - field2: Error 2 [ERROR_2]');
    });
  });

  describe('getFieldErrors()', () => {
    it('should return errors for specific field', () => {
      const errors = [
        { field: 'llm', message: 'LLM error 1' },
        { field: 'actors', message: 'Actors error' },
        { field: 'llm', message: 'LLM error 2' },
      ];

      const error = new TestModuleValidationError('Test', errors);

      const llmErrors = error.getFieldErrors('llm');
      expect(llmErrors).toHaveLength(2);
      expect(llmErrors[0].message).toBe('LLM error 1');
      expect(llmErrors[1].message).toBe('LLM error 2');
    });

    it('should return empty array for non-existent field', () => {
      const error = new TestModuleValidationError('Test', [
        { field: 'llm', message: 'LLM error' },
      ]);

      const notFoundErrors = error.getFieldErrors('notFound');
      expect(notFoundErrors).toEqual([]);
    });
  });

  describe('hasFieldErrors()', () => {
    it('should return true when field has errors', () => {
      const error = new TestModuleValidationError('Test', [
        { field: 'llm', message: 'LLM error' },
      ]);

      expect(error.hasFieldErrors('llm')).toBe(true);
    });

    it('should return false when field has no errors', () => {
      const error = new TestModuleValidationError('Test', [
        { field: 'llm', message: 'LLM error' },
      ]);

      expect(error.hasFieldErrors('actors')).toBe(false);
    });

    it('should return false when no errors at all', () => {
      const error = new TestModuleValidationError('Test');

      expect(error.hasFieldErrors('any')).toBe(false);
    });
  });

  describe('errorCount', () => {
    it('should return 0 for no errors', () => {
      const error = new TestModuleValidationError('Test');

      expect(error.errorCount).toBe(0);
    });

    it('should return correct count', () => {
      const error = new TestModuleValidationError('Test', [
        { field: 'field1', message: 'Error 1' },
        { field: 'field2', message: 'Error 2' },
        { field: 'field3', message: 'Error 3' },
      ]);

      expect(error.errorCount).toBe(3);
    });
  });

  describe('toJSON()', () => {
    it('should serialize to JSON', () => {
      const errors = [
        { field: 'test', message: 'Test error', code: 'TEST_ERROR' },
      ];

      const error = new TestModuleValidationError('Test message', errors);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'TestModuleValidationError',
        message: 'Test message',
        errors: errors,
      });
    });

    it('should be JSON stringifiable', () => {
      const error = new TestModuleValidationError('Test', [
        { field: 'test', message: 'Error' },
      ]);

      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('TestModuleValidationError');
      expect(parsed.message).toBe('Test');
      expect(parsed.errors).toHaveLength(1);
    });
  });

  describe('Error Throwing', () => {
    it('should be throwable and catchable', () => {
      expect(() => {
        throw new TestModuleValidationError('Test error');
      }).toThrow(TestModuleValidationError);
    });

    it('should be catchable as Error', () => {
      expect(() => {
        throw new TestModuleValidationError('Test error');
      }).toThrow(Error);
    });

    it('should preserve error information when thrown', () => {
      const errors = [{ field: 'test', message: 'Test field error' }];

      try {
        throw new TestModuleValidationError('Validation failed', errors);
      } catch (error) {
        expect(error.message).toBe('Validation failed');
        expect(error.errors).toEqual(errors);
        expect(error.errorCount).toBe(1);
      }
    });
  });
});
