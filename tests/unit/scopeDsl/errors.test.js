/**
 * @file Tests for Scope DSL error classes
 * @description Comprehensive tests for all error classes in the Scope DSL module
 */

import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { ScopeDefinitionError } from '../../../src/scopeDsl/errors/scopeDefinitionError.js';

describe('Scope DSL Error Classes', () => {
  describe('ScopeDslError', () => {
    it('should create error with message', () => {
      const error = new ScopeDslError('Test error message');
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ScopeDslError');
      expect(error instanceof Error).toBe(true);
    });

    it('should create error with empty string message', () => {
      const error = new ScopeDslError('');
      expect(error.message).toBe('');
      expect(error.name).toBe('ScopeDslError');
    });

    it('should handle undefined message', () => {
      const error = new ScopeDslError(undefined);
      expect(error.message).toBe('');
      expect(error.name).toBe('ScopeDslError');
    });
  });

  describe('ScopeDefinitionError', () => {
    describe('Inheritance and properties', () => {
      it('should inherit from ScopeDslError', () => {
        const error = new ScopeDefinitionError('Test message', 'test.scope');
        expect(error instanceof ScopeDslError).toBe(true);
        expect(error instanceof Error).toBe(true);
        expect(error.name).toBe('ScopeDefinitionError');
      });

      it('should store file path and line content', () => {
        const error = new ScopeDefinitionError(
          'Test message',
          'test.scope',
          'line content'
        );
        expect(error.filePath).toBe('test.scope');
        expect(error.lineContent).toBe('line content');
      });

      it('should handle missing line content', () => {
        const error = new ScopeDefinitionError('Test message', 'test.scope');
        expect(error.filePath).toBe('test.scope');
        expect(error.lineContent).toBe('');
      });

      it('should handle null and undefined parameters gracefully', () => {
        expect(() => {
          new ScopeDefinitionError(null, null, null);
        }).toThrow();

        expect(() => {
          new ScopeDefinitionError(undefined, undefined, undefined);
        }).toThrow();
      });
    });

    describe('Empty file error messages', () => {
      it('should format empty file error message', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          'empty.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: empty.scope'
        );
      });

      it('should handle empty file with different paths', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          'path/to/empty.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: path/to/empty.scope'
        );
      });
    });

    describe('Invalid line format error messages', () => {
      it('should format invalid line format error', () => {
        const error = new ScopeDefinitionError(
          'Invalid line format. Expected "name := dsl_expression".',
          'invalid.scope',
          'invalid line content'
        );
        expect(error.message).toBe(
          'Invalid scope definition format in invalid.scope: "invalid line content". Expected "name := dsl_expression"'
        );
      });

      it('should handle invalid line format without line content', () => {
        const error = new ScopeDefinitionError(
          'Invalid line format. Expected "name := dsl_expression".',
          'invalid.scope'
        );
        expect(error.message).toBe(
          'Invalid scope definition format in invalid.scope: "". Expected "name := dsl_expression"'
        );
      });

      it('should handle special characters in line content', () => {
        const error = new ScopeDefinitionError(
          'Invalid line format. Expected "name := dsl_expression".',
          'special.scope',
          'line with "quotes" and symbols !@#$%'
        );
        expect(error.message).toBe(
          'Invalid scope definition format in special.scope: "line with "quotes" and symbols !@#$%". Expected "name := dsl_expression"'
        );
      });
    });

    describe('Invalid DSL expression error messages', () => {
      it('should format DSL expression error with quoted scope name', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "testScope": Syntax error',
          'test.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in test.scope for scope "testScope":'
        );
      });

      it('should handle DSL expression error with complex scope name', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "mod:complex_scope": Unexpected token',
          'complex.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in complex.scope for scope "mod:complex_scope":'
        );
      });

      it('should handle DSL expression error with nested quotes', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "scope_with_"nested"_quotes": Error message',
          'nested.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in nested.scope for scope "scope_with_":'
        );
      });

      it('should handle DSL expression error without proper quote structure', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope missing_quotes: Error message',
          'missing.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in missing.scope for scope missing_quotes: Error message'
        );
      });

      it('should handle malformed DSL expression error message', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope',
          'malformed.scope'
        );
        expect(error.message).toBe(
          'Invalid scope definition in malformed.scope: Invalid DSL expression for scope'
        );
      });
    });

    describe('Edge cases in message formatting', () => {
      it('should handle empty scope name in quotes', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "": Empty scope name',
          'empty.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in empty.scope for scope "": Empty scope name'
        );
      });

      it('should handle message starting exactly with expected pattern', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "exact": Test',
          'exact.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in exact.scope for scope "exact":'
        );
      });

      it('should handle single character scope name', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "a": Single char',
          'single.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in single.scope for scope "a":'
        );
      });

      it('should handle scope name with special characters', () => {
        const error = new ScopeDefinitionError(
          'Invalid DSL expression for scope "test-scope_123": Special chars',
          'special.scope'
        );
        expect(error.message).toBe(
          'Invalid DSL expression in special.scope for scope "test-scope_123":'
        );
      });
    });

    describe('Default fallback error messages', () => {
      it('should use default format for unrecognized messages', () => {
        const error = new ScopeDefinitionError(
          'Some other error message',
          'other.scope',
          'line content'
        );
        expect(error.message).toBe(
          'Invalid scope definition in other.scope: Some other error message (at line "line content")'
        );
      });

      it('should use default format without line content', () => {
        const error = new ScopeDefinitionError(
          'Some other error message',
          'other.scope'
        );
        expect(error.message).toBe(
          'Invalid scope definition in other.scope: Some other error message'
        );
      });

      it('should handle custom error with empty message', () => {
        const error = new ScopeDefinitionError(
          '',
          'empty-message.scope',
          'some content'
        );
        expect(error.message).toBe(
          'Invalid scope definition in empty-message.scope:  (at line "some content")'
        );
      });

      it('should handle null message fallback', () => {
        expect(() => {
          new ScopeDefinitionError(null, 'null-message.scope', 'content');
        }).toThrow(TypeError);
      });
    });

    describe('File path variations', () => {
      it('should handle absolute file paths', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          '/absolute/path/to/file.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: /absolute/path/to/file.scope'
        );
      });

      it('should handle relative file paths', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          './relative/path.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: ./relative/path.scope'
        );
      });

      it('should handle file paths with spaces', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          'path with spaces/file name.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: path with spaces/file name.scope'
        );
      });

      it('should handle Windows-style file paths', () => {
        const error = new ScopeDefinitionError(
          'File is empty or contains only comments.',
          'C:\\Windows\\Path\\file.scope'
        );
        expect(error.message).toBe(
          'Scope file is empty or contains only comments: C:\\Windows\\Path\\file.scope'
        );
      });
    });
  });
});
