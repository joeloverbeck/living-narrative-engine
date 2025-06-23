/**
 * @file Tests for Scope-DSL Parser
 * @description Unit tests for the recursive-descent parser
 */

const {
  parseDslExpression,
  parseScopeFile,
  ScopeSyntaxError,
} = require('../../../src/scopeDsl/parser');

describe('Scope-DSL Parser', () => {
  describe('parseDslExpression', () => {
    describe('Basic source nodes', () => {
      test('should parse actor source', () => {
        const result = parseDslExpression('actor');
        expect(result).toEqual({
          type: 'Source',
          kind: 'actor',
        });
      });

      test('should parse location source without parameter', () => {
        const result = parseDslExpression('location');
        expect(result).toEqual({
          type: 'Source',
          kind: 'location',
          param: null,
        });
      });

      // MODIFICATION: This test now asserts that a parameter causes an error.
      test('should throw error for location source with parameter', () => {
        expect(() => {
          parseDslExpression('location(player)');
        }).toThrow(ScopeSyntaxError);
        // We can be more specific about the error message if needed
        expect(() => {
          parseDslExpression('location(player)');
        }).toThrow('Unexpected tokens after expression');
      });

      test('should parse entities source', () => {
        const result = parseDslExpression('entities(core:item)');
        expect(result).toEqual({
          type: 'Source',
          kind: 'entities',
          param: 'core:item',
        });
      });
    });

    describe('Field access', () => {
      test('should parse simple field access', () => {
        const result = parseDslExpression('actor.followers');
        expect(result).toEqual({
          type: 'Step',
          field: 'followers',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        });
      });

      test('should parse array iteration', () => {
        const result = parseDslExpression('actor.followers[]');
        expect(result).toEqual({
          type: 'Step',
          field: 'followers',
          isArray: true,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        });
      });

      test('should parse chained field access', () => {
        const result = parseDslExpression('location.inventory.items');
        expect(result).toEqual({
          type: 'Step',
          field: 'items',
          isArray: false,
          parent: {
            type: 'Step',
            field: 'inventory',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });
    });

    describe('Filters', () => {
      test('should parse simple filter', () => {
        const result = parseDslExpression(
          'location.inventory[{"==": [{"var": "type"}, "weapon"]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '==': [{ var: 'type' }, 'weapon'],
          },
          parent: {
            type: 'Step',
            field: 'inventory',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });

      test('should parse complex filter', () => {
        const result = parseDslExpression(
          'entities(core:npc)[{"and": [{"==": [{"var": "faction"}, "friendly"]}, {"!=": [{"var": "status"}, "dead"]}]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            and: [
              { '==': [{ var: 'faction' }, 'friendly'] },
              { '!=': [{ var: 'status' }, 'dead'] },
            ],
          },
          parent: {
            type: 'Source',
            kind: 'entities',
            param: 'core:npc',
          },
        });
      });
    });

    describe('Unions', () => {
      test('should parse simple union', () => {
        const result = parseDslExpression('actor.followers + location.inventory');
        expect(result).toEqual({
          type: 'Union',
          left: {
            type: 'Step',
            field: 'followers',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'actor',
            },
          },
          right: {
            type: 'Step',
            field: 'inventory',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });

      test('should parse complex union', () => {
        const result = parseDslExpression(
          'actor.followers + location.inventory + entities(core:item)'
        );
        expect(result).toEqual({
          type: 'Union',
          left: {
            type: 'Step',
            field: 'followers',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'actor',
            },
          },
          right: {
            type: 'Union',
            left: {
              type: 'Step',
              field: 'inventory',
              isArray: false,
              parent: {
                type: 'Source',
                kind: 'location',
                param: null,
              },
            },
            right: {
              type: 'Source',
              kind: 'entities',
              param: 'core:item',
            },
          },
        });
      });
    });

    describe('Complex examples from specification', () => {
      test('should parse followers scope', () => {
        const result = parseDslExpression('actor.followers');
        expect(result).toEqual({
          type: 'Step',
          field: 'followers',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        });
      });

      test('should parse nearby_items scope', () => {
        const result = parseDslExpression(
          'location.inventory[{"==": [{"var": "type"}, "item"]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '==': [{ var: 'type' }, 'item'],
          },
          parent: {
            type: 'Step',
            field: 'inventory',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });

      test('should parse environment scope', () => {
        const result = parseDslExpression('location');
        expect(result).toEqual({
          type: 'Source',
          kind: 'location',
          param: null,
        });
      });

      test('should parse location_non_items scope', () => {
        const result = parseDslExpression(
          'location.inventory[{"!=": [{"var": "type"}, "item"]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '!=': [{ var: 'type' }, 'item'],
          },
          parent: {
            type: 'Step',
            field: 'inventory',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });

      test('should parse unlocked_exits scope', () => {
        const result = parseDslExpression(
          'location.exits[{"==": [{"var": "locked"}, false]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '==': [{ var: 'locked' }, false],
          },
          parent: {
            type: 'Step',
            field: 'exits',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        });
      });
    });

    describe('Comments and whitespace', () => {
      test('should handle comments', () => {
        const result = parseDslExpression(
          'actor // This is a comment\n.followers'
        );
        expect(result).toEqual({
          type: 'Step',
          field: 'followers',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        });
      });

      test('should handle whitespace', () => {
        const result = parseDslExpression('  actor  .  followers  ');
        expect(result).toEqual({
          type: 'Step',
          field: 'followers',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        });
      });
    });

    describe('Expression depth limit', () => {
      test('should enforce depth limit', () => {
        expect(() => {
          parseDslExpression('actor.a.b.c.d.e');
        }).toThrow(ScopeSyntaxError);
      });

      test('should allow maximum depth', () => {
        const result = parseDslExpression('actor.a.b.c.d');
        expect(result.type).toBe('Step');
        expect(result.field).toBe('d');
      });
    });

    describe('Entities source (positive/negative, chaining)', () => {
      test('should parse positive component query', () => {
        const result = parseDslExpression('entities(core:item)');
        expect(result).toEqual({
          type: 'Source',
          kind: 'entities',
          param: 'core:item',
        });
      });
      test('should parse negative component query', () => {
        const result = parseDslExpression('entities(!core:item)');
        expect(result).toEqual({
          type: 'Source',
          kind: 'entities',
          param: '!core:item',
        });
      });
      test('should parse array iteration after entities()', () => {
        const result = parseDslExpression('entities(core:item)[]');
        expect(result).toEqual({
          type: 'Step',
          field: null,
          isArray: true,
          parent: {
            type: 'Source',
            kind: 'entities',
            param: 'core:item',
          },
        });
      });
      test('should parse filter after entities()[]', () => {
        const result = parseDslExpression(
          'entities(core:item)[][{"==": [{"var": "entity.id"}, "item1"]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '==': [{ var: 'entity.id' }, 'item1'],
          },
          parent: {
            type: 'Step',
            field: null,
            isArray: true,
            parent: {
              type: 'Source',
              kind: 'entities',
              param: 'core:item',
            },
          },
        });
      });
      test('should parse filter after entities(!core:item)[]', () => {
        const result = parseDslExpression(
          'entities(!core:item)[][{"==": [{"var": "entity.id"}, "item1"]}]'
        );
        expect(result).toEqual({
          type: 'Filter',
          logic: {
            '==': [{ var: 'entity.id' }, 'item1'],
          },
          parent: {
            type: 'Step',
            field: null,
            isArray: true,
            parent: {
              type: 'Source',
              kind: 'entities',
              param: '!core:item',
            },
          },
        });
      });
    });
  });

  describe('parseScopeFile', () => {
    test('should parse scope definition', () => {
      const content = 'actor.followers';
      const result = parseScopeFile(content, 'followers');
      expect(result).toEqual({
        type: 'ScopeDef',
        name: 'followers',
        expr: {
          type: 'Step',
          field: 'followers',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor',
          },
        },
      });
    });
  });

  describe('Error handling', () => {
    describe('Syntax errors', () => {
      test('should throw error for invalid source node', () => {
        expect(() => {
          parseDslExpression('invalid');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for malformed location source', () => {
        expect(() => {
          parseDslExpression('location(');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for malformed entities source', () => {
        expect(() => {
          parseDslExpression('entities(core:');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for malformed field access', () => {
        expect(() => {
          parseDslExpression('actor.');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for malformed array iteration', () => {
        expect(() => {
          parseDslExpression('actor.followers[');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for malformed filter', () => {
        expect(() => {
          parseDslExpression('actor.followers[{');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for unexpected tokens', () => {
        expect(() => {
          parseDslExpression('actor ->');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for invalid JSON Logic', () => {
        expect(() => {
          parseDslExpression('actor.followers[foo := bar]');
        }).toThrow(ScopeSyntaxError);
      });

      test('should throw error for unterminated string', () => {
        expect(() => {
          parseDslExpression('actor.followers[{"key": "value]');
        }).toThrow(ScopeSyntaxError);
      });
    });

    describe('Error message details', () => {
      test('should include line and column in error', () => {
        try {
          parseDslExpression('actor\n.followers\n.');
        } catch (error) {
          expect(error).toBeInstanceOf(ScopeSyntaxError);
          expect(error.line).toBe(3);
          expect(error.column).toBe(2);
          expect(error.message).toContain('line 3, column 2');
        }
      });

      test('should include code snippet in error', () => {
        try {
          parseDslExpression('actor.followers.');
        } catch (error) {
          expect(error).toBeInstanceOf(ScopeSyntaxError);
          expect(error.snippet).toContain('actor.followers.');
          expect(error.snippet).toContain('^');
        }
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty input', () => {
      expect(() => {
        parseDslExpression('');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle only whitespace', () => {
      expect(() => {
        parseDslExpression('   ');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle only comments', () => {
      expect(() => {
        parseDslExpression('// Just a comment');
      }).toThrow(ScopeSyntaxError);
    });

    test('should handle complex nested JSON Logic', () => {
      const result = parseDslExpression(
        'entities(core:npc)[{"or": [{"==": [{"var": "faction"}, "friendly"]}, {"and": [{"==": [{"var": "type"}, "merchant"]}, {"!=": [{"var": "status"}, "dead"]}]}]}]'
      );
      expect(result.type).toBe('Filter');
      expect(result.logic).toHaveProperty('or');
    });
  });
});
