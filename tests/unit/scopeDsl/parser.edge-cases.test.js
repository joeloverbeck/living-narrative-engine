/**
 * @file Edge cases tests for parser.js
 * @description Tests targeting specific uncovered lines to achieve 90%+ coverage
 */

import {
  parseDslExpression,
  parseScopeFile,
  ScopeSyntaxError,
} from '../../../src/scopeDsl/parser.js';

describe('Scope-DSL Parser - Edge Cases for Full Coverage', () => {
  describe('Tokenizer edge cases to hit uncovered lines', () => {
    test('should handle unterminated string - line 179', () => {
      // This targets the unterminated string error on line 179
      expect(() => {
        parseDslExpression('entities(core:item)[{"name": "unterminated');
      }).toThrow('Unterminated string');
    });

    test('should handle escape sequences in strings', () => {
      // Test escape sequence handling in readString
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "name"}, "test\\"quote"]}]'
      );
      expect(result.logic['=='][1]).toBe('test"quote');
    });
  });

  describe('Parser depth and filtering edge cases', () => {
    test('should handle depth limit exceeded - lines 289-291', () => {
      // Target lines 289-291: depth limit check
      expect(() => {
        parseDslExpression(
          'actor.field1[].field2[].field3[].field4[].field5[]'
        );
      }).toThrow('Expression depth limit exceeded');
    });

    test('should handle entities method after field access - line 366', () => {
      // Target line 366: entities method parsing
      const result = parseDslExpression('actor.entities(core:item)');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('entities');
      expect(result.param).toBe('core:item');
    });

    test('should handle component ID parsing edge cases - line 379', () => {
      // Target line 379: component ID parsing with colon
      const result = parseDslExpression('entities(mod:component)');
      expect(result.param).toBe('mod:component');
    });

    test('should handle component ID without colon - line 383', () => {
      // Target line 383: error when colon is missing
      expect(() => {
        parseDslExpression('entities(invalidcomponent)');
      }).toThrow('Expected colon in component ID');
    });
  });

  describe('JSON value parsing edge cases - line 400', () => {
    test('should handle string values in JSON', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "name"}, "test"]}]'
      );
      expect(result.logic['=='][1]).toBe('test');
    });

    test('should handle boolean true in JSON', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "active"}, true]}]'
      );
      expect(result.logic['=='][1]).toBe(true);
    });

    test('should handle boolean false in JSON', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "active"}, false]}]'
      );
      expect(result.logic['=='][1]).toBe(false);
    });

    test('should handle identifier values in JSON - line 400', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "type"}, weapon]}]'
      );
      expect(result.logic['=='][1]).toBe('weapon');
    });

    test('should handle JSON arrays', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"in": [{"var": "type"}, ["weapon", "armor"]]}]'
      );
      expect(result.logic.in[1]).toEqual(['weapon', 'armor']);
    });

    test('should handle nested JSON objects', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "config"}, {"enabled": true}]}]'
      );
      expect(result.logic['=='][1]).toEqual({ enabled: true });
    });

    test('should handle invalid JSON value type - line 420', () => {
      // Target line 420: error for invalid JSON value
      expect(() => {
        parseDslExpression(
          'entities(core:item)[{"==": [{"var": "name"}, (invalid)]}]'
        );
      }).toThrow('Expected JSON value');
    });
  });

  describe('Error handling edge cases', () => {
    test('should handle various syntax errors', () => {
      const errorCases = [
        {
          input: 'entities()',
          expectedPattern: 'Expected component identifier',
        },
        { input: 'actor.', expectedPattern: 'Expected field name' },
        { input: 'invalid_source', expectedPattern: 'Unknown source node' },
      ];

      errorCases.forEach(({ input, expectedPattern }) => {
        expect(() => parseDslExpression(input)).toThrow(ScopeSyntaxError);
        expect(() => parseDslExpression(input)).toThrow(expectedPattern);
      });
    });

    test('should handle unexpected characters', () => {
      expect(() => {
        parseDslExpression('actor@invalid');
      }).toThrow('Unexpected character');
    });
  });

  describe('Advanced parsing scenarios', () => {
    test('should handle union operations', () => {
      const result = parseDslExpression('actor + location');
      expect(result.type).toBe('Union');
      expect(result.left.kind).toBe('actor');
      expect(result.right.kind).toBe('location');
    });

    test('should handle complex expressions with filters', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]'
      );
      expect(result.type).toBe('Filter');
      expect(result.logic['=='][0]).toEqual({ var: 'type' });
      expect(result.logic['=='][1]).toBe('weapon');
    });

    test('should handle array access', () => {
      const result = parseDslExpression('actor.inventory[]');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('inventory');
      expect(result.isArray).toBe(true);
    });

    test('should handle field access after array', () => {
      const result = parseDslExpression('actor.inventory[].name');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('name');
      expect(result.parent.isArray).toBe(true);
    });
  });

  describe('Component ID parsing variations', () => {
    test('should handle negated component IDs', () => {
      const result = parseDslExpression('entities(!core:item)');
      expect(result.param).toBe('!core:item');
    });

    test('should handle complex component IDs', () => {
      expect(() => {
        parseDslExpression('entities(mod:submod:component)');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle negated complex component IDs', () => {
      const result = parseDslExpression('entities(!mod:component)');
      expect(result.param).toBe('!mod:component');
    });
  });

  describe('parseScopeFile edge cases', () => {
    test('should parse simple scope definition', () => {
      expect(() => {
        parseScopeFile('test := actor', 'test');
      }).toThrow(ScopeSyntaxError);
    });

    test('should parse scope with complex expression', () => {
      expect(() => {
        parseScopeFile(
          'weapons := entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]',
          'weapons'
        );
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle scope file parsing errors', () => {
      expect(() => {
        parseScopeFile('invalid syntax here', 'invalid');
      }).toThrow(ScopeSyntaxError);
    });
  });

  describe('Special formatting and whitespace', () => {
    test('should handle expressions with extensive whitespace', () => {
      const result = parseDslExpression('   actor   .   field   [   ]   ');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('field');
      expect(result.isArray).toBe(true);
    });

    test('should handle expressions with tabs and newlines', () => {
      const result = parseDslExpression('\t\nactor\n\t.field\t\n');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('field');
    });

    test('should handle comments in expressions', () => {
      const result = parseDslExpression('actor // this is a comment\n.field');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('field');
    });
  });

  describe('Location source variations', () => {
    test('should handle location source', () => {
      const result = parseDslExpression('location');
      expect(result.type).toBe('Source');
      expect(result.kind).toBe('location');
      expect(result.param).toBeNull();
    });

    test('should handle location with field access', () => {
      const result = parseDslExpression('location.exits');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('exits');
      expect(result.parent.kind).toBe('location');
    });
  });

  describe('Filter parsing edge cases', () => {
    test('should handle empty JSON object in filter', () => {
      const result = parseDslExpression('entities(core:item)[{}]');
      expect(result.type).toBe('Filter');
      expect(result.logic).toEqual({});
    });

    test('should handle single property JSON object', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"active": true}]'
      );
      expect(result.type).toBe('Filter');
      expect(result.logic.active).toBe(true);
    });

    test('should handle multiple properties in JSON object', () => {
      const result = parseDslExpression(
        'entities(core:item)[{"type": "weapon", "level": weapon}]'
      );
      expect(result.type).toBe('Filter');
      expect(result.logic.type).toBe('weapon');
      expect(result.logic.level).toBe('weapon');
    });
  });
});
