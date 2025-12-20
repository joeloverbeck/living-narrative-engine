import { describe, expect, it } from '@jest/globals';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';

describe('Scope Syntax Validation', () => {
  describe('entities() filter syntax', () => {
    it('should correctly parse entities() with iterator and filter', () => {
      const validSyntax =
        'entities(core:position)[][{"==": [{"var": "entity.id"}, "test"]}]';
      const ast = parseDslExpression(validSyntax);

      // With correct syntax, the top-level node is the Filter
      expect(ast.type).toBe('Filter');
      // The filter's parent should be the ArrayIterationStep
      expect(ast.parent.type).toBe('ArrayIterationStep');
      // The ArrayIterationStep's parent should be the Source
      expect(ast.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.kind).toBe('entities');
      expect(ast.parent.parent.param).toBe('core:position');
    });

    it('should handle incorrect syntax entities() with direct filter (missing iterator)', () => {
      // This is the problematic syntax that was causing errors
      const incorrectSyntax =
        'entities(core:position)[{"==": [{"var": "entity.id"}, "test"]}]';

      // This should parse, but the AST structure will be different
      const ast = parseDslExpression(incorrectSyntax);

      // With incorrect syntax, the filter might be attached directly to the Source
      // This can cause issues during resolution
      expect(ast.type).toBe('Filter');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('entities');
    });

    it('should correctly parse multiple filters with iterators', () => {
      const syntax =
        'entities(core:actor)[][{"condition_ref": "core:entity-at-location"}][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]';
      const ast = parseDslExpression(syntax);

      // First node should be ArrayIterationStep
      expect(ast.type).toBe('Filter');

      // Find all filter nodes
      const filters = [];
      collectNodesByType(ast, 'Filter', filters);
      expect(filters.length).toBe(2);
    });
  });

  describe('common scope patterns', () => {
    it('should correctly parse actor.component.field[] pattern', () => {
      const syntax = 'actor.core:inventory.items[]';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('ArrayIterationStep');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('items');
    });

    it('should correctly parse location.component[filter].field pattern', () => {
      const syntax =
        'location.locations:exits[{"==": [{"var": "locked"}, false]}].target';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('target');
      expect(ast.parent.type).toBe('Filter');
    });

    it('should correctly parse union of scopes', () => {
      const syntax = 'actor.core:inventory.items[] + entities(core:item)[]';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('Union');
      expect(ast.left.type).toBe('ArrayIterationStep');
      expect(ast.right.type).toBe('ArrayIterationStep');
    });

    it('should correctly parse target.topmost_clothing[] pattern', () => {
      const syntax = 'target.topmost_clothing[]';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('ArrayIterationStep');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('topmost_clothing');
      expect(ast.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.kind).toBe('target');
    });

    it('should correctly parse targets.primary pattern', () => {
      const syntax = 'targets.primary';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('primary');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('targets');
    });

    it('should correctly parse target with filter pattern', () => {
      const syntax =
        'target.topmost_clothing[][{"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]}]';
      const ast = parseDslExpression(syntax);

      expect(ast.type).toBe('Filter');
      expect(ast.parent.type).toBe('ArrayIterationStep');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('target');
    });
  });

  describe('error cases', () => {
    it('should handle component ID without mod prefix', () => {
      const syntax = 'actor.inventory.items[]'; // Missing mod: prefix
      // Parser doesn't validate component ID format - it just parses the structure
      const ast = parseDslExpression(syntax);
      expect(ast.type).toBe('ArrayIterationStep');
      expect(ast.parent.field).toBe('items');
    });

    it('should throw error for exceeding depth limit', () => {
      const tooDeep = 'actor.a.b.c.d.e.f.g'; // Depth 7, exceeds limit of 6
      expect(() => parseDslExpression(tooDeep)).toThrow();
    });
  });
});

// Helper functions
/**
 *
 * @param node
 * @param type
 */
function findNodeByType(node, type) {
  if (node.type === type) return node;

  for (const key of Object.keys(node)) {
    if (key === 'type') continue;
    const value = node[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const found = findNodeByType(value, type);
      if (found) return found;
    }
  }

  return null;
}

/**
 *
 * @param node
 * @param type
 * @param result
 */
function collectNodesByType(node, type, result = []) {
  if (node.type === type) result.push(node);

  for (const key of Object.keys(node)) {
    if (key === 'type') continue;
    const value = node[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collectNodesByType(value, type, result);
    }
  }

  return result;
}
