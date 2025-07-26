import { describe, expect, it } from '@jest/globals';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';

describe('Target Context Parsing', () => {
  describe('target source', () => {
    it('should parse target as a valid source', () => {
      const ast = parseDslExpression('target');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('target');
    });

    it('should parse target with field access', () => {
      const ast = parseDslExpression('target.id');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('id');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('target');
    });

    it('should parse target with component access', () => {
      const ast = parseDslExpression('target.components');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('components');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('target');
    });

    it('should parse target with nested field access', () => {
      const ast = parseDslExpression('target.components.core:actor.name');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('name');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('core:actor');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('components');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('target');
    });

    it('should parse target.topmost_clothing[]', () => {
      const ast = parseDslExpression('target.topmost_clothing[]');
      expect(ast.type).toBe('ArrayIterationStep');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('topmost_clothing');
      expect(ast.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.kind).toBe('target');
    });

    it('should parse target with array iteration and filter', () => {
      const ast = parseDslExpression(
        'target.topmost_clothing[][{"in": ["adjustable", {"var": "entity.properties"}]}]'
      );
      expect(ast.type).toBe('Filter');
      expect(ast.parent.type).toBe('ArrayIterationStep');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('topmost_clothing');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('target');
    });

    it('should parse target.components with complex path', () => {
      const ast = parseDslExpression(
        'target.components.clothing:equipment.equipped.torso_upper.outer'
      );

      // Check the full chain
      let current = ast;
      const fields = [
        'outer',
        'torso_upper',
        'equipped',
        'clothing:equipment',
        'components',
      ];

      for (const field of fields) {
        expect(current.type).toBe('Step');
        expect(current.field).toBe(field);
        current = current.parent;
      }

      expect(current.type).toBe('Source');
      expect(current.kind).toBe('target');
    });

    it('should parse target with position access', () => {
      const ast = parseDslExpression(
        'target.components.core:position.locationId'
      );
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('locationId');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('core:position');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('components');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('target');
    });
  });

  describe('targets source', () => {
    it('should parse targets as a valid source', () => {
      const ast = parseDslExpression('targets');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('targets');
    });

    it('should parse targets.primary', () => {
      const ast = parseDslExpression('targets.primary');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('primary');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('targets');
    });

    it('should parse targets.secondary', () => {
      const ast = parseDslExpression('targets.secondary');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('secondary');
      expect(ast.parent.type).toBe('Source');
      expect(ast.parent.kind).toBe('targets');
    });

    it('should parse targets with array iteration', () => {
      const ast = parseDslExpression('targets.primary[]');
      expect(ast.type).toBe('ArrayIterationStep');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('primary');
      expect(ast.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.kind).toBe('targets');
    });

    it('should parse targets with nested access', () => {
      const ast = parseDslExpression('targets.primary[].id');
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('id');
      expect(ast.parent.type).toBe('ArrayIterationStep');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('primary');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('targets');
    });

    it('should parse targets with filter on array', () => {
      const ast = parseDslExpression(
        'targets.primary[][{"==": [{"var": "entity.components[\\"core:item\\"].type"}, "weapon"]}]'
      );
      expect(ast.type).toBe('Filter');
      expect(ast.parent.type).toBe('ArrayIterationStep');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('primary');
      expect(ast.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.kind).toBe('targets');
    });

    it('should parse complex targets expression', () => {
      const ast = parseDslExpression(
        'targets.primary[].components.core:actor.name'
      );
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('name');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('core:actor');
      expect(ast.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.field).toBe('components');
      expect(ast.parent.parent.parent.type).toBe('ArrayIterationStep');
      expect(ast.parent.parent.parent.parent.type).toBe('Step');
      expect(ast.parent.parent.parent.parent.field).toBe('primary');
      expect(ast.parent.parent.parent.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.parent.parent.parent.kind).toBe('targets');
    });
  });

  describe('union operations with target/targets', () => {
    it('should parse union with target using + operator', () => {
      const ast = parseDslExpression('target + actor');
      expect(ast.type).toBe('Union');
      expect(ast.left.type).toBe('Source');
      expect(ast.left.kind).toBe('target');
      expect(ast.right.type).toBe('Source');
      expect(ast.right.kind).toBe('actor');
    });

    it('should parse union with targets using | operator', () => {
      const ast = parseDslExpression('targets.primary | targets.secondary');
      expect(ast.type).toBe('Union');
      expect(ast.left.type).toBe('Step');
      expect(ast.left.field).toBe('primary');
      expect(ast.left.parent.kind).toBe('targets');
      expect(ast.right.type).toBe('Step');
      expect(ast.right.field).toBe('secondary');
      expect(ast.right.parent.kind).toBe('targets');
    });

    it('should parse complex union with target', () => {
      const ast = parseDslExpression('target.followers[] + actor.followers[]');
      expect(ast.type).toBe('Union');

      // Left side: target.followers[]
      expect(ast.left.type).toBe('ArrayIterationStep');
      expect(ast.left.parent.type).toBe('Step');
      expect(ast.left.parent.field).toBe('followers');
      expect(ast.left.parent.parent.type).toBe('Source');
      expect(ast.left.parent.parent.kind).toBe('target');

      // Right side: actor.followers[]
      expect(ast.right.type).toBe('ArrayIterationStep');
      expect(ast.right.parent.type).toBe('Step');
      expect(ast.right.parent.field).toBe('followers');
      expect(ast.right.parent.parent.type).toBe('Source');
      expect(ast.right.parent.parent.kind).toBe('actor');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle target without any field access', () => {
      const ast = parseDslExpression('target');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('target');
      expect(ast.param).toBeUndefined();
    });

    it('should handle targets without any field access', () => {
      const ast = parseDslExpression('targets');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('targets');
      expect(ast.param).toBeUndefined();
    });

    it('should parse deeply nested target access', () => {
      const ast = parseDslExpression(
        'target.components.core:inventory.items[].properties.weight'
      );

      // Verify it's a valid AST without errors
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('weight');

      // Walk up the chain to verify structure
      let current = ast;
      let depth = 0;
      while (current.parent && depth < 10) {
        current = current.parent;
        depth++;
      }
      expect(current.type).toBe('Source');
      expect(current.kind).toBe('target');
    });

    it('should parse target with colon in component names', () => {
      const ast = parseDslExpression(
        'target.components.special:component_123'
      );
      expect(ast.type).toBe('Step');
      expect(ast.field).toBe('special:component_123');
      expect(ast.parent.type).toBe('Step');
      expect(ast.parent.field).toBe('components');
      expect(ast.parent.parent.type).toBe('Source');
      expect(ast.parent.parent.kind).toBe('target');
    });
  });

  describe('compatibility with existing syntax', () => {
    it('should still parse actor source correctly', () => {
      const ast = parseDslExpression('actor');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('actor');
    });

    it('should still parse location source correctly', () => {
      const ast = parseDslExpression('location');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('location');
      expect(ast.param).toBe(null);
    });

    it('should still parse entities source correctly', () => {
      const ast = parseDslExpression('entities(core:actor)');
      expect(ast.type).toBe('Source');
      expect(ast.kind).toBe('entities');
      expect(ast.param).toBe('core:actor');
    });
  });
});
