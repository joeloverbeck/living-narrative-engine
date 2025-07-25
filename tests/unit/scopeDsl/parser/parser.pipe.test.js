import { describe, it, expect } from '@jest/globals';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';

describe('Parser - PIPE Union Operator', () => {
  it('should parse pipe operator as Union node', () => {
    const ast = parseDslExpression('actor.followers | actor.partners');

    expect(ast).toMatchObject({
      type: 'Union',
      left: {
        type: 'Step',
        field: 'followers',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      },
      right: {
        type: 'Step',
        field: 'partners',
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      },
    });
  });

  it('should handle multiple pipe unions (right-associative)', () => {
    const ast = parseDslExpression('actor | location | entities(core:item)');

    expect(ast).toMatchObject({
      type: 'Union',
      left: { type: 'Source', kind: 'actor' },
      right: {
        type: 'Union',
        left: { type: 'Source', kind: 'location', param: null },
        right: { type: 'Source', kind: 'entities', param: 'core:item' },
      },
    });
  });

  it('should handle mixed union operators', () => {
    const ast = parseDslExpression('actor + location | entities(core:item)');

    expect(ast).toMatchObject({
      type: 'Union',
      left: { type: 'Source', kind: 'actor' },
      right: {
        type: 'Union',
        left: { type: 'Source', kind: 'location', param: null },
        right: { type: 'Source', kind: 'entities', param: 'core:item' },
      },
    });
  });

  it('should preserve operator precedence with pipes', () => {
    const ast = parseDslExpression(
      'actor.items[].name | location.items[].name'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.type).toBe('Step');
    expect(ast.left.field).toBe('name');
    expect(ast.right.type).toBe('Step');
    expect(ast.right.field).toBe('name');
  });

  it('should handle pipe in complex expressions', () => {
    const ast = parseDslExpression(
      'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.parent.field).toBe('topmost_clothing');
    expect(ast.right.parent.field).toBe('topmost_clothing');
  });

  it('should work with filters and pipes', () => {
    const ast = parseDslExpression(
      'actor.items[{"==": [{"var": "type"}, "weapon"]}] | actor.equipped'
    );

    expect(ast.type).toBe('Union');
    expect(ast.left.type).toBe('Filter');
    expect(ast.right.field).toBe('equipped');
  });
});

describe('Parser - Backward Compatibility', () => {
  it('should still support plus operator for unions', () => {
    const plusAst = parseDslExpression('actor + location');
    const pipeAst = parseDslExpression('actor | location');

    // Both should produce identical Union nodes
    expect(plusAst.type).toBe('Union');
    expect(pipeAst.type).toBe('Union');

    // Structure should be identical
    expect(plusAst.left).toEqual(pipeAst.left);
    expect(plusAst.right).toEqual(pipeAst.right);
  });

  it('should produce identical AST for both operators', () => {
    const plusAst = parseDslExpression('actor.followers + actor.partners');
    const pipeAst = parseDslExpression('actor.followers | actor.partners');

    // Deep equality check - structures should be identical
    expect(plusAst).toEqual({
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
        field: 'partners',
        isArray: false,
        parent: {
          type: 'Source',
          kind: 'actor',
        },
      },
    });

    expect(pipeAst).toEqual(plusAst);
  });
});
