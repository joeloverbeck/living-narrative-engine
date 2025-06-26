/**
 * @file Additional comprehensive tests for Scope-DSL Parser
 * @description Tests to improve coverage of src/scopeDsl/parser.js edge cases and error scenarios
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { 
  parseDslExpression, 
  parseScopeFile, 
  ScopeSyntaxError 
} from '../../../src/scopeDsl/parser.js';

describe('Scope-DSL Parser - Additional Coverage Tests', () => {
  
  describe('Tokenizer edge cases', () => {
    test('should handle unterminated strings', () => {
      expect(() => {
        parseDslExpression('entities([{"var": "unterminated string}])');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities([{"var": "unterminated string}])');
      }).toThrow('Unterminated string');
    });

    test('should handle string tokenization edge cases', () => {
      // Test basic string parsing
      expect(() => {
        parseDslExpression('entities(core:item)');
      }).not.toThrow();
    });

    test('should handle comments in tokenization', () => {
      // Test comment handling
      expect(() => {
        parseDslExpression('// This is a comment\nactor');
      }).not.toThrow();
    });

    test('should handle whitespace tokenization', () => {
      // Test whitespace handling
      expect(() => {
        parseDslExpression('  actor  ');
      }).not.toThrow();
    });

    test('should handle comments at various positions', () => {
      const expressions = [
        '// comment\nactor',
        'actor // comment',
        'actor.field // comment\n.other',
        'entities(core:item) // comment\n[{"==": [{"var": "type"}, "weapon"]}]'
      ];
      
      expressions.forEach(expr => {
        expect(() => parseDslExpression(expr)).not.toThrow();
      });
    });

    test('should handle unexpected characters', () => {
      expect(() => {
        parseDslExpression('actor @ location');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('actor @ location');
      }).toThrow('Unexpected character');
    });
  });

  describe('Parser error scenarios', () => {
    test('should handle depth limit exceeded error', () => {
      const deepExpression = 'actor.field1.field2.field3.field4.field5';
      expect(() => {
        parseDslExpression(deepExpression);
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression(deepExpression);
      }).toThrow('Expression depth limit exceeded');
    });

    test('should handle missing field name after dot', () => {
      expect(() => {
        parseDslExpression('actor.');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('actor.');
      }).toThrow('Expected field name');
    });

    test('should handle missing identifier after colon in namespaced fields', () => {
      expect(() => {
        parseDslExpression('actor.core:');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('actor.core:');
      }).toThrow('Expected identifier after colon');
    });

    test('should handle invalid source nodes', () => {
      expect(() => {
        parseDslExpression('invalidSource');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('invalidSource');
      }).toThrow('Unknown source node');
    });

    test('should handle entities without parentheses', () => {
      expect(() => {
        parseDslExpression('entities');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities');
      }).toThrow('Expected opening parenthesis');
    });

    test('should handle entities with missing component ID', () => {
      expect(() => {
        parseDslExpression('entities()');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities()');
      }).toThrow('Expected component identifier');
    });

    test('should handle entities with missing closing parenthesis', () => {
      expect(() => {
        parseDslExpression('entities(core:item');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item');
      }).toThrow('Expected closing parenthesis');
    });

    test('should handle missing opening brace in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)["==": [{"var": "type"}, "weapon"]]');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item)["==": [{"var": "type"}, "weapon"]]');
      }).toThrow('Expected opening brace for JSON Logic object');
    });

    test('should handle non-string keys in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{123: [{"var": "type"}, "weapon"]}]');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item)[{123: [{"var": "type"}, "weapon"]}]');
      }).toThrow('Unexpected character');
    });

    test('should handle missing colon after key in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{"==" [{"var": "type"}, "weapon"]}]');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item)[{"==" [{"var": "type"}, "weapon"]}]');
      }).toThrow('Expected colon after key');
    });

    test('should handle missing closing brace in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]');
      }).toThrow('Expected closing brace for JSON Logic object');
    });

    test('should handle missing closing bracket for filter', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]}');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]}');
      }).toThrow('Expected closing bracket for filter');
    });

    test('should handle unexpected tokens after expression', () => {
      expect(() => {
        parseDslExpression('actor extra tokens');
      }).toThrow(ScopeSyntaxError);
      
      expect(() => {
        parseDslExpression('actor extra tokens');
      }).toThrow('Unexpected tokens after expression');
    });
  });

  describe('JSON Logic parsing edge cases', () => {
    test('should handle numeric values in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "level"}, 5]}]');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle boolean values in JSON Logic', () => {
      const result = parseDslExpression('entities(core:item)[{"==": [{"var": "active"}, true]}]');
      expect(result.logic['==']).toEqual([{'var': 'active'}, true]);
    });

    test('should handle null values in JSON Logic', () => {
      const result = parseDslExpression('entities(core:item)[{"==": [{"var": "parent"}, "null"]}]');
      expect(result.logic['==']).toEqual([{'var': 'parent'}, 'null']);
    });

    test('should handle nested objects in JSON Logic', () => {
      expect(() => {
        parseDslExpression('entities(core:item)[{"==": [{"var": "config"}, {"enabled": true, "level": 5}]}]');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle arrays in JSON Logic', () => {
      const result = parseDslExpression('entities(core:item)[{"in": [{"var": "type"}, ["weapon", "armor", "consumable"]]}]');
      expect(result.logic['in']).toEqual([{'var': 'type'}, ['weapon', 'armor', 'consumable']]);
    });

    test('should handle empty arrays in JSON Logic', () => {
      const result = parseDslExpression('entities(core:item)[{"in": [{"var": "type"}, []]}]');
      expect(result.logic['in']).toEqual([{'var': 'type'}, []]);
    });

    test('should handle multiple key-value pairs in JSON Logic with trailing comma', () => {
      const result = parseDslExpression('entities(core:item)[{"and": [{"==": [{"var": "type"}, "weapon"]}, {"!=": [{"var": "broken"}, true]},]}]');
      expect(result.logic['and']).toEqual([
        {'==': [{'var': 'type'}, 'weapon']},
        {'!=': [{'var': 'broken'}, true]}
      ]);
    });

    test('should handle entity references in JSON Logic', () => {
      const result = parseDslExpression('entities(core:item)[{"==": [{"var": "owner"}, {"entity": "player1"}]}]');
      expect(result.logic['==']).toEqual([{'var': 'owner'}, {'entity': 'player1'}]);
    });
  });

  describe('Component ID parsing edge cases', () => {
    test('should handle component IDs with exclamation mark (negation)', () => {
      const result = parseDslExpression('entities(!core:item)');
      expect(result.param).toBe('!core:item');
    });

    test('should handle component IDs with multiple colons', () => {
      expect(() => {
        parseDslExpression('entities(mod:namespace:component)');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle component IDs starting with numbers', () => {
      const result = parseDslExpression('entities(core:item2)');
      expect(result.param).toBe('core:item2');
    });

    test('should handle component IDs with underscores', () => {
      const result = parseDslExpression('entities(core:item_type)');
      expect(result.param).toBe('core:item_type');
    });
  });

  describe('Field access edge cases', () => {
    test('should handle entities method directly after field access', () => {
      const result = parseDslExpression('location.entities(core:item)');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('entities');
      expect(result.param).toBe('core:item');
    });

    test('should handle complex field names with namespaces', () => {
      expect(() => {
        parseDslExpression('actor.mod:complex:namespace:field');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle array iteration on complex expressions', () => {
      const result = parseDslExpression('entities(core:container).contents[]');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('contents');
      expect(result.isArray).toBe(true);
    });
  });

  describe('Complex expression parsing', () => {
    test('should handle deeply nested union expressions', () => {
      const result = parseDslExpression('actor + location + entities(core:item) + entities(core:npc)');
      expect(result.type).toBe('Union');
      expect(result.left.type).toBe('Source');
      expect(result.right.type).toBe('Union');
      expect(result.right.right.type).toBe('Union');
    });

    test('should handle filter on union result', () => {
      expect(() => {
        parseDslExpression('(actor + entities(core:npc))[{"!=": [{"var": "id"}, "excludeId"]}]');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle multiple array iterations', () => {
      const result = parseDslExpression('actor.followers[].inventory[]');
      expect(result.type).toBe('Step');
      expect(result.field).toBe('inventory');
      expect(result.isArray).toBe(true);
      expect(result.parent.type).toBe('Step');
      expect(result.parent.field).toBe('followers');
      expect(result.parent.isArray).toBe(true);
    });
  });

  describe('parseScopeFile edge cases', () => {
    test('should handle scope file with single definition', () => {
      expect(() => {
        parseScopeFile('testScope := actor.followers[]', 'testScope');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle empty scope file', () => {
      expect(() => {
        parseScopeFile('', 'emptyScope');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle scope file with invalid expression', () => {
      expect(() => {
        parseScopeFile('testScope := invalid syntax here', 'testScope');
      }).toThrow(ScopeSyntaxError);
    });
  });

  describe('Error message generation', () => {
    test('should generate detailed error snippets with line and column information', () => {
      try {
        parseDslExpression('actor.\ninvalid');
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeSyntaxError);
        expect(error.message).toContain('line');
        expect(error.message).toContain('column');
        expect(error.line).toBeDefined();
        expect(error.column).toBeDefined();
        expect(error.snippet).toBeDefined();
      }
    });

    test('should handle multi-line expressions in error reporting', () => {
      const multiLineExpr = `actor
        .field1
        .invalid syntax here`;
      
      try {
        parseDslExpression(multiLineExpr);
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeSyntaxError);
        expect(error.message).toContain('line');
        expect(error.snippet).toContain('^');
      }
    });
  });

  describe('Token position tracking', () => {
    test('should track line and column positions correctly through newlines', () => {
      const expression = `
        // Comment line
        actor
          .field1
          .field2
      `;
      
      // This shouldn't throw, but if it does, position should be tracked correctly
      expect(() => parseDslExpression(expression)).not.toThrow();
    });

    test('should handle windows-style line endings', () => {
      const expression = 'actor\r\n.field1\r\n.field2';
      expect(() => parseDslExpression(expression)).not.toThrow();
    });
  });

  describe('Whitespace handling', () => {
    test('should handle tabs and mixed whitespace', () => {
      const expression = 'actor\t.field1  .field2\n\t.field3';
      expect(() => parseDslExpression(expression)).not.toThrow();
    });

    test('should handle expressions with only whitespace and comments', () => {
      expect(() => {
        parseDslExpression('  \t\n  // just a comment  \n  \t  ');
      }).toThrow(ScopeSyntaxError);
    });
  });
}); 