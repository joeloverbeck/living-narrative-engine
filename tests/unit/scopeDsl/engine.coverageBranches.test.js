import { describe, expect, it, jest } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('ScopeEngine coverage branches', () => {
  const baseRuntimeCtx = {
    entityManager: {
      getEntityInstance: jest.fn(),
      getEntity: jest.fn(),
    },
    jsonLogicEval: { evaluate: jest.fn() },
    logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
  };

  it('prefers runtimeCtx scopeEntityLookupStrategy when provided', () => {
    const strategy = { resolve: jest.fn().mockReturnValue('from-runtime') };
    const engine = new ScopeEngine();

    const gateway = engine._createEntitiesGateway({
      ...baseRuntimeCtx,
      scopeEntityLookupStrategy: strategy,
    });

    expect(gateway.getEntityInstance('target')).toBe('from-runtime');
    expect(strategy.resolve).toHaveBeenCalledWith('target');
  });

  it('builds strategy from debug strategyFactory when none is injected', () => {
    const candidateStrategy = {
      resolve: jest.fn().mockReturnValue('from-factory'),
    };
    const strategyFactory = jest.fn().mockReturnValue(candidateStrategy);
    const engine = new ScopeEngine();

    const gateway = engine._createEntitiesGateway({
      ...baseRuntimeCtx,
      scopeEntityLookupDebug: { strategyFactory },
    });

    expect(strategyFactory).toHaveBeenCalled();
    expect(gateway.getEntityInstance('item-1')).toBe('from-factory');
    expect(candidateStrategy.resolve).toHaveBeenCalledWith('item-1');
  });

  it('returns null for invalid item IDs without attempting debug logging', () => {
    const engine = new ScopeEngine();
    const runtimeCtx = {
      ...baseRuntimeCtx,
      logger: { debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      scopeEntityLookupDebug: false,
    };

    const gateway = engine._createEntitiesGateway(runtimeCtx);
    const result = gateway.getItemComponents(null);

    expect(result).toBeNull();
    expect(runtimeCtx.logger.debug).not.toHaveBeenCalled();
  });

  it('returns structured missing result when includeSources debug flag is enabled', () => {
    const engine = new ScopeEngine();
    const gateway = engine._createEntitiesGateway({
      ...baseRuntimeCtx,
      scopeEntityLookupDebug: { enabled: true, includeSources: true },
    });

    const result = gateway.getItemComponents(undefined);

    expect(result).toEqual({
      components: null,
      source: 'missing:entity',
      reason: 'invalid-id',
    });
  });

  it('routes nested resolution through the wrapped dispatcher and traces unknown nodes', () => {
    const engine = new ScopeEngine();
    const tracer = { isEnabled: () => true, logStep: jest.fn() };

    const parentResolver = {
      canResolve: (node) => node.type === 'Parent',
      resolve: (node, ctx) =>
        ctx.dispatcher.resolve(node.child, {
          ...ctx,
          currentSet: new Set(['parent-input']),
        }),
    };

    const childResolver = {
      canResolve: (node) => node.type === 'Child',
      resolve: () => new Set(['child-result']),
    };

    jest
      .spyOn(engine, '_createResolvers')
      .mockReturnValue([parentResolver, childResolver]);

    const runtimeCtx = {
      ...baseRuntimeCtx,
      tracer,
    };

    const ast = { type: 'Parent', child: { type: 'Child' } };
    const result = engine.resolve(
      ast,
      { id: 'actor-1', components: {} },
      runtimeCtx
    );

    expect(result).toEqual(new Set(['child-result']));
    expect(tracer.logStep).toHaveBeenCalledTimes(2);

    const parentCall = tracer.logStep.mock.calls.find(
      ([, , , , meta]) => meta?.node?.type === 'Parent'
    );

    expect(parentCall).toBeDefined();

    const [, operation, inputSet, resultSet, meta] = parentCall;

    expect(operation).toBe("resolve(type='Parent')");
    expect(Array.from(inputSet)).toEqual(['actor-1']);
    expect(Array.from(resultSet)).toEqual(['child-result']);
    expect(meta).toEqual({ node: ast });
  });
});
