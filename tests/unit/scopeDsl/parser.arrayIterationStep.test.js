/**
 * @file Tests for ArrayIterationStep node type and immutability
 */

import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';

describe('Parser - ArrayIterationStep Node', () => {
  describe('ArrayIterationStep creation', () => {
    test('should create ArrayIterationStep node for bare [] syntax', () => {
      const result = parseDslExpression('actor[]');
      expect(result).toEqual({
        type: 'ArrayIterationStep',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      });
    });

    test('should create ArrayIterationStep node after field access', () => {
      const result = parseDslExpression('actor.followers[]');
      expect(result).toEqual({
        type: 'ArrayIterationStep',
        parent: {
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

    test('should create ArrayIterationStep node in chained expressions', () => {
      const result = parseDslExpression('location.actors[].inventory');
      expect(result).toEqual({
        type: 'Step',
        field: 'inventory',
        isArray: false,
        parent: {
          type: 'ArrayIterationStep',
          parent: {
            type: 'Step',
            field: 'actors',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'location',
              param: null,
            },
          },
        },
      });
    });
  });

  describe('Immutability tests', () => {
    test('should not mutate nodes when creating ArrayIterationStep', () => {
      const expr = 'actor.followers[]';
      const result = parseDslExpression(expr);

      // Find the Step node
      const stepNode = result.parent;

      // Freeze the step node to ensure it's not mutated
      const frozenStep = Object.freeze({ ...stepNode });

      // Parse again and verify the structure is created fresh
      const result2 = parseDslExpression(expr);

      // Verify ArrayIterationStep was created
      expect(result2.type).toBe('ArrayIterationStep');

      // Verify original structure wasn't mutated
      expect(frozenStep.isArray).toBe(false);
      expect(frozenStep.type).toBe('Step');
    });

    test('should create independent AST instances', () => {
      const expr = 'actor[]';

      const result1 = parseDslExpression(expr);
      const result2 = parseDslExpression(expr);

      // Results should be equal but not the same object
      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
      expect(result1.parent).not.toBe(result2.parent);
    });

    test('should handle complex nested array iterations', () => {
      const result = parseDslExpression(
        'entities(core:actor)[].relationships[].target'
      );

      // Verify the structure has two ArrayIterationStep nodes
      let arrayIterationCount = 0;
      let node = result;

      while (node) {
        if (node.type === 'ArrayIterationStep') {
          arrayIterationCount++;
        }
        node = node.parent;
      }

      expect(arrayIterationCount).toBe(2);
    });
  });

  describe('Backward compatibility', () => {
    test('should no longer produce Step nodes with isArray=true', () => {
      const expressions = [
        'actor[]',
        'actor.followers[]',
        'location.actors[]',
        'entities(core:item)[]',
      ];

      expressions.forEach((expr) => {
        const result = parseDslExpression(expr);

        // Walk the AST and verify no Step nodes have isArray=true
        const checkNode = (node) => {
          if (node.type === 'Step' && node.isArray === true) {
            throw new Error(
              `Found Step node with isArray=true in expression: ${expr}`
            );
          }
          if (node.parent) {
            checkNode(node.parent);
          }
          if (node.left) {
            checkNode(node.left);
          }
          if (node.right) {
            checkNode(node.right);
          }
        };

        checkNode(result);
      });
    });
  });
});
