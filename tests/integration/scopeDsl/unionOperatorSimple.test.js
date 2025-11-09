import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

describe('Scope DSL - Pipe Union Operator Simple Integration', () => {
  let engine;
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = createMockLogger();
    jsonLogicEval = new JsonLogicEvaluationService({ logger });
    engine = new ScopeEngine();
  });

  it('should parse pipe operator identically to plus operator', () => {
    // Parse both expressions
    const pipeAst = parseDslExpression('actor | location');
    const plusAst = parseDslExpression('actor + location');

    // Both should create Union nodes
    expect(pipeAst.type).toBe('Union');
    expect(plusAst.type).toBe('Union');

    // Both should have identical structure
    expect(pipeAst.left).toEqual({ type: 'Source', kind: 'actor' });
    expect(pipeAst.right).toEqual({
      type: 'Source',
      kind: 'location',
      param: null,
    });

    expect(plusAst.left).toEqual({ type: 'Source', kind: 'actor' });
    expect(plusAst.right).toEqual({
      type: 'Source',
      kind: 'location',
      param: null,
    });
  });

  it('should handle multiple pipe operators (right-associative)', () => {
    const ast = parseDslExpression('actor | location | entities(core:item)');

    // Should create nested Union nodes (right-associative)
    expect(ast).toEqual({
      type: 'Union',
      left: { type: 'Source', kind: 'actor' },
      right: {
        type: 'Union',
        left: { type: 'Source', kind: 'location', param: null },
        right: { type: 'Source', kind: 'entities', param: 'core:item' },
      },
    });
  });

  it('should work with mixed union operators', () => {
    const ast = parseDslExpression('actor + location | entities(core:item)');

    // Both operators should create the same Union node type
    expect(ast).toEqual({
      type: 'Union',
      left: { type: 'Source', kind: 'actor' },
      right: {
        type: 'Union',
        left: { type: 'Source', kind: 'location', param: null },
        right: { type: 'Source', kind: 'entities', param: 'core:item' },
      },
    });
  });

  it('should resolve unions with source nodes', () => {
    // Create a minimal runtime context
    const actorEntity = { id: 'player1' };
    const locationEntity = { id: 'room1' };

    const runtimeCtx = {
      location: locationEntity,
      entityManager: {
        getEntity: jest.fn(),
        getComponentData: jest.fn(),
        getEntitiesWithComponent: jest.fn(),
      },
      componentRegistry: {
        getEntitiesWithComponent: jest.fn(),
      },
      jsonLogicEval,
      logger,
    };

    // Parse and resolve a simple union
    const ast = parseDslExpression('actor | location');
    const result = engine.resolve(ast, actorEntity, runtimeCtx);

    // Should return a set with both entity IDs
    expect(result).toBeInstanceOf(Set);
    expect(result.has('player1')).toBe(true); // actor ID
    expect(result.has('room1')).toBe(true); // location ID
    expect(result.size).toBe(2);
  });

  it('should deduplicate results in unions', () => {
    // If both sides of union resolve to same entity, should only appear once
    const actorEntity = { id: 'entity1' };

    const runtimeCtx = {
      location: actorEntity, // Same entity as actor
      entityManager: {
        getEntity: jest.fn(),
        getComponentData: jest.fn(),
        getEntitiesWithComponent: jest.fn(),
      },
      jsonLogicEval,
      logger,
    };

    const ast = parseDslExpression('actor | location');
    const result = engine.resolve(ast, actorEntity, runtimeCtx);

    // Should only have one instance of entity1
    expect(result).toBeInstanceOf(Set);
    expect(result.has('entity1')).toBe(true);
    expect(result.size).toBe(1);
  });
});
