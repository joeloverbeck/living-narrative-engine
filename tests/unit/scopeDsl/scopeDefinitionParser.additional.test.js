/**
 * @file Additional tests for Scope Definition Parser
 * @description Tests to improve coverage of src/scopeDsl/scopeDefinitionParser.js edge cases
 */

import { describe, it, expect, jest } from '@jest/globals';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import { ScopeDefinitionError } from '../../../src/scopeDsl/errors/scopeDefinitionError.js';
import { ScopeSyntaxError } from '../../../src/scopeDsl/parser/parser.js';

// Mock the parser.js module
jest.mock('../../../src/scopeDsl/parser/parser.js', () => {
  const originalModule = jest.requireActual(
    '../../../src/scopeDsl/parser/parser.js'
  );
  return {
    ...originalModule,
    parseDslExpression: jest.fn(),
  };
});

describe('parseScopeDefinitions - Additional Coverage Tests', () => {
  let mockParseDslExpression;

  beforeEach(() => {
    const parserModule = require('../../../src/scopeDsl/parser/parser.js');
    mockParseDslExpression = parserModule.parseDslExpression;
    jest.clearAllMocks();

    // Default successful parsing behavior
    mockParseDslExpression.mockReturnValue({
      type: 'scope',
      expression: 'mocked',
    });
  });

  describe('Error handling with parser failures', () => {
    it('should throw ScopeDefinitionError when parser throws ScopeSyntaxError', () => {
      const content = 'core:invalid := invalid.syntax.here';
      const filePath = 'test.scope';

      const syntaxError = new ScopeSyntaxError(
        'Invalid syntax at position 5',
        1,
        5,
        'invalid.syntax.here\n    ^'
      );
      mockParseDslExpression.mockImplementation(() => {
        throw syntaxError;
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Invalid DSL expression in test.scope for scope "core:invalid":'
      );
    });

    it('should throw ScopeDefinitionError when parser throws generic Error', () => {
      const content = 'core:broken := some.broken.expression';
      const filePath = 'broken.scope';

      mockParseDslExpression.mockImplementation(() => {
        throw new Error('Parser failed unexpectedly');
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Invalid DSL expression in broken.scope for scope "core:broken":'
      );
    });

    it('should handle malformed scope name in error message', () => {
      const content = 'malformed:scope:name := expression';
      const filePath = 'malformed.scope';

      mockParseDslExpression.mockImplementation(() => {
        throw new Error('Invalid expression');
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });
  });

  describe('Edge cases in line processing', () => {
    it('should handle empty content after trimming', () => {
      const content = '   \n\n   \t  \n  ';
      const filePath = 'empty-trimmed.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Scope file is empty or contains only comments: empty-trimmed.scope'
      );
    });

    it('should handle content with only comments', () => {
      const content = `
        // This is a comment
        // Another comment
        // And another one
      `;
      const filePath = 'comments-only.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Scope file is empty or contains only comments: comments-only.scope'
      );
    });

    it('should handle mixed whitespace and comments', () => {
      const content =
        '  // comment  \n\t// another comment\n   \n// final comment';
      const filePath = 'mixed-whitespace-comments.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Scope file is empty or contains only comments: mixed-whitespace-comments.scope'
      );
    });

    it('should handle continuation lines that are not part of any scope', () => {
      const content = 'continuation line without scope start';
      const filePath = 'invalid-continuation.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Invalid scope definition format in invalid-continuation.scope: "continuation line without scope start". Expected "name := dsl_expression"'
      );
    });

    it('should handle malformed scope definition line', () => {
      const content = 'invalid format without colon equals';
      const filePath = 'malformed.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Invalid scope definition format in malformed.scope: "invalid format without colon equals". Expected "name := dsl_expression"'
      );
    });

    it('should handle scope with valid initial definition but parser error', () => {
      const content = 'test:scope := invalid_dsl_syntax_here()';
      const filePath = 'invalid-dsl.scope';

      // Mock the parser to throw an error
      mockParseDslExpression.mockImplementation((expr) => {
        if (expr === 'invalid_dsl_syntax_here()') {
          throw new ScopeSyntaxError(
            'Invalid syntax in DSL expression',
            1,
            1,
            expr
          );
        }
        return { type: 'scope', expression: 'mocked' };
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });

    it('should handle multiple continuation lines correctly', () => {
      const content = `
        core:complex := entities(core:item)[
          {"and": [
            {"==": [{"var": "type"}, "weapon"]},
            {"!=": [{"var": "broken"}, true]}
          ]}
        ]
      `;
      const filePath = 'multi-continuation.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      const scopeDef = result.get('core:complex');
      expect(scopeDef.expr).toContain('entities(core:item)');
      expect(scopeDef.expr).toContain('{"and": [');
      expect(scopeDef.expr).toContain('{"==": [{"var": "type"}, "weapon"]}');
      expect(scopeDef.expr).toContain('{"!=": [{"var": "broken"}, true]}');
      expect(scopeDef.ast).toBeDefined();
    });

    it('should handle whitespace-only continuation lines', () => {
      const content = `
        core:spaced := entities(core:item)
          
            [{"==": [{"var": "type"}, "weapon"]}]
      `;
      const filePath = 'whitespace-continuation.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      const scopeDef = result.get('core:spaced');
      expect(scopeDef.expr).toContain('entities(core:item)');
      expect(scopeDef.expr).toContain('[{"==": [{"var": "type"}, "weapon"]}]');
      expect(scopeDef.ast).toBeDefined();
    });

    it('should preserve exact spacing in multi-line expressions', () => {
      const content = `core:precise := entities(core:item)[
  {"==": [
    {"var": "type"}, 
    "weapon"
  ]}
]`;
      const filePath = 'precise-spacing.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      const scopeDef = result.get('core:precise');
      // Should preserve the structure with spaces where line breaks were
      expect(scopeDef.expr).toMatch(/entities\(core:item\)\[\s+/);
      expect(scopeDef.ast).toBeDefined();
    });
  });

  describe('Scope name validation edge cases', () => {
    it('should handle scope names with numbers', () => {
      const content = 'mod123:item := entities(core:item)';
      const filePath = 'numeric-scope.scope';

      const result = parseScopeDefinitions(content, filePath);
      expect(result.has('mod123:item')).toBe(true);
      expect(result.get('mod123:item').expr).toBe('entities(core:item)');
      expect(result.get('mod123:item').ast).toBeDefined();
    });

    it('should handle scope names with underscores', () => {
      const content = 'test_mod:item_type := entities(core:item)';
      const filePath = 'underscore-scope.scope';

      const result = parseScopeDefinitions(content, filePath);
      expect(result.has('test_mod:item_type')).toBe(true);
      expect(result.get('test_mod:item_type').expr).toBe('entities(core:item)');
      expect(result.get('test_mod:item_type').ast).toBeDefined();
    });

    it('should handle long scope names', () => {
      const content =
        'very_long_mod_name:very_long_component_name := entities(core:item)';
      const filePath = 'long-names.scope';

      const result = parseScopeDefinitions(content, filePath);
      expect(result.has('very_long_mod_name:very_long_component_name')).toBe(
        true
      );
      expect(
        result.get('very_long_mod_name:very_long_component_name').expr
      ).toBe('entities(core:item)');
      expect(
        result.get('very_long_mod_name:very_long_component_name').ast
      ).toBeDefined();
    });

    it('should handle complex namespace patterns', () => {
      const content =
        'mod123:complex_namespace:item_v2 := entities(mod123:item)';
      const filePath = 'complex-namespace.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });
  });

  describe('Expression trimming and cleanup', () => {
    it('should trim whitespace from expressions', () => {
      const content = 'core:trimmed :=   entities(core:item)   ';
      const filePath = 'trimmed.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      expect(result.get('core:trimmed').expr).toBe('entities(core:item)');
      expect(result.get('core:trimmed').ast).toBeDefined();
      expect(mockParseDslExpression).toHaveBeenCalledWith(
        'entities(core:item)'
      );
    });

    it('should handle expressions that are only whitespace after trimming', () => {
      const content = 'core:empty :=   \t\n  ';
      const filePath = 'empty-expr.scope';

      mockParseDslExpression.mockImplementation((expr) => {
        if (expr === '') {
          throw new ScopeSyntaxError('Empty expression', 1, 1, '');
        }
        return { type: 'scope', expression: 'mocked' };
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });

    it('should handle expressions with internal whitespace correctly', () => {
      const content = 'core:spaced := actor . followers [ ]';
      const filePath = 'internal-spaces.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      expect(result.get('core:spaced').expr).toBe('actor . followers [ ]');
      expect(result.get('core:spaced').ast).toBeDefined();
      expect(mockParseDslExpression).toHaveBeenCalledWith(
        'actor . followers [ ]'
      );
    });
  });

  describe('File processing edge cases', () => {
    it('should handle files with only whitespace', () => {
      const content = '   \t\n\r\n   \t  ';
      const filePath = 'whitespace-only.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Scope file is empty or contains only comments:'
      );
    });

    it('should handle files with mixed line endings', () => {
      const content = 'core:mixed := actor\r\ncore:endings := location\n';
      const filePath = 'mixed-endings.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(2);
      expect(result.get('core:mixed').expr).toBe('actor');
      expect(result.get('core:mixed').ast).toBeDefined();
      expect(result.get('core:endings').expr).toBe('location');
      expect(result.get('core:endings').ast).toBeDefined();
    });

    it('should handle files ending with comments', () => {
      const content = `
        core:test := actor
        // Final comment
      `;
      const filePath = 'ending-comment.scope';

      const result = parseScopeDefinitions(content, filePath);

      expect(result.size).toBe(1);
      expect(result.get('core:test').expr).toBe('actor');
      expect(result.get('core:test').ast).toBeDefined();
    });

    it('should handle empty lines between definitions', () => {
      const content = `
        first:scope := actor

        
        second:scope := location


        third:scope := entities(core:item)
      `;
      const filePath = 'empty-lines.scope';

      const result = parseScopeDefinitions(content, filePath);
      expect(result.size).toBe(3);
      expect(result.has('first:scope')).toBe(true);
      expect(result.has('second:scope')).toBe(true);
      expect(result.has('third:scope')).toBe(true);
    });
  });

  describe('Error message formatting edge cases', () => {
    it('should handle scope names with quotes in error messages', () => {
      const content = 'core:test"quote := invalid';
      const filePath = 'quote.scope';

      mockParseDslExpression.mockImplementation(() => {
        throw new Error('Invalid syntax');
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });

    it('should handle very long scope names in error messages', () => {
      const longScopeName = 'core:' + 'a'.repeat(200);
      const content = `${longScopeName} := invalid`;
      const filePath = 'long-name.scope';

      mockParseDslExpression.mockImplementation(() => {
        throw new Error('Invalid syntax');
      });

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
    });

    it('should handle non-standard scope name formats in error reporting', () => {
      const content = 'invalid-format := expression';
      const filePath = 'invalid-format.scope';

      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        ScopeDefinitionError
      );
      expect(() => parseScopeDefinitions(content, filePath)).toThrow(
        'Invalid scope definition format in invalid-format.scope: "invalid-format := expression". Expected "name := dsl_expression"'
      );
    });
  });
});
