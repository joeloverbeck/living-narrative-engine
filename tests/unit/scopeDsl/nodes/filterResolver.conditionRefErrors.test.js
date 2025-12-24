import { describe, expect, it, jest } from '@jest/globals';
import createFilterResolver from '../../../../src/scopeDsl/nodes/filterResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

const ACTOR_ENTITY = {
  id: 'actor-1',
  components: {
    'core:position': { locationId: 'loc-actor' },
  },
};

const ENTITY_INSTANCE = {
  id: 'entity-1',
  components: {
    'core:position': { locationId: 'loc-actor' },
  },
  componentTypeIds: ['items-core:item'],
};

/**
 *
 * @param overrides
 */
function createCommonContext(overrides = {}) {
  return {
    actorEntity: { ...ACTOR_ENTITY },
    dispatcher: { resolve: jest.fn(() => new Set(['entity-1'])) },
    trace: { addLog: jest.fn() },
    runtimeCtx: {},
    ...overrides,
  };
}

/**
 *
 * @param overrides
 */
function createCommonDeps(overrides = {}) {
  const logicEval = overrides.logicEval || {
    evaluate: jest.fn(() => {
      throw new Error('Could not resolve condition_ref: missing predicate');
    }),
  };

  const entitiesGateway = overrides.entitiesGateway || {
    getEntityInstance: jest.fn((id) =>
      id === 'entity-1' ? { ...ENTITY_INSTANCE } : null
    ),
    getItemComponents: jest.fn(),
  };

  const locationProvider = overrides.locationProvider || {
    getLocation: jest.fn(() => ({ id: 'loc-actor' })),
  };

  return {
    logicEval,
    entitiesGateway,
    locationProvider,
    ...('errorHandler' in overrides
      ? { errorHandler: overrides.errorHandler }
      : {}),
  };
}

describe('filterResolver condition_ref error handling', () => {
  const baseNode = {
    type: 'Filter',
    parent: { type: 'Source' },
    logic: { '==': [1, 1] },
  };

  it('delegates condition_ref resolution failures to the error handler when provided', () => {
    const errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    const deps = createCommonDeps({ errorHandler });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    const result = resolver.resolve(baseNode, ctx);

    expect(result.size).toBe(0);
    expect(deps.logicEval.evaluate).toHaveBeenCalledTimes(1);
    expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
    const [handledError, handledCtx, resolverName, code] =
      errorHandler.handleError.mock.calls[0];
    expect(handledError).toBeInstanceOf(Error);
    expect(handledError.message).toContain('Filter logic evaluation failed');
    expect(handledCtx).toBe(ctx);
    expect(resolverName).toBe('FilterResolver');
    expect(code).toBe(ErrorCodes.RESOLUTION_FAILED_GENERIC);
  });

  it('rethrows condition_ref resolution failures when no error handler is registered', () => {
    const deps = createCommonDeps();
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    expect(() => resolver.resolve(baseNode, ctx)).toThrow(
      /Filter logic evaluation failed/
    );
    expect(deps.logicEval.evaluate).toHaveBeenCalledTimes(1);
  });

  it('records evaluation metadata when trace context is provided', () => {
    const logicEval = { evaluate: jest.fn(() => true) };
    const deps = createCommonDeps({ logicEval });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    const result = resolver.resolve(baseNode, ctx);

    expect(result.has('entity-1')).toBe(true);
    expect(logicEval.evaluate).toHaveBeenCalledTimes(1);
    const dataLogCall = ctx.trace.addLog.mock.calls.find(
      (call) => call[2] === 'ScopeEngine.filterEvaluation'
    );
    expect(dataLogCall).toBeTruthy();
    const [, , , payload] = dataLogCall;
    expect(payload.filterEvaluations).toHaveLength(1);
    expect(payload.filterEvaluations[0]).toMatchObject({
      entityId: 'entity-1',
      passedFilter: true,
    });
  });

  it('records evaluation metadata defaults when entity metadata is absent', () => {
    const logicEval = { evaluate: jest.fn(() => false) };
    const entitiesGateway = {
      getEntityInstance: jest.fn(() => ({ id: 'entity-1' })),
      getItemComponents: jest.fn(),
    };

    const deps = createCommonDeps({ logicEval, entitiesGateway });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    const result = resolver.resolve(baseNode, ctx);

    expect(result.size).toBe(0);
    const dataLogCall = ctx.trace.addLog.mock.calls.find(
      (call) => call[2] === 'ScopeEngine.filterEvaluation'
    );
    expect(dataLogCall).toBeTruthy();
    const [, , , payload] = dataLogCall;
    expect(payload.filterEvaluations[0]).toMatchObject({
      entityId: 'entity-1',
      passedFilter: false,
      evaluationContext: expect.objectContaining({
        hasItemMarker: false,
        hasPortableMarker: false,
      }),
    });
  });

  it('captures evaluation metadata for object items returned by the dispatcher', () => {
    const logicEval = { evaluate: jest.fn(() => true) };
    const objectItem = {
      id: 'entity-object',
      components: {
        'core:position': { locationId: 'loc-actor' },
      },
    };

    const deps = createCommonDeps({ logicEval });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext({
      dispatcher: { resolve: jest.fn(() => new Set([objectItem])) },
    });

    const result = resolver.resolve(baseNode, ctx);

    expect(result.has(objectItem)).toBe(true);
    const dataLogCall = ctx.trace.addLog.mock.calls.find(
      (call) => call[2] === 'ScopeEngine.filterEvaluation'
    );
    expect(dataLogCall).toBeTruthy();
    const [, , , payload] = dataLogCall;
    expect(payload.filterEvaluations[0]).toMatchObject({
      entityId: 'entity-object',
      passedFilter: true,
    });
  });

  it('surfaces invalid actor identifiers via the error handler', () => {
    const errorHandler = {
      handleError: jest.fn(() => {
        throw new Error('handled: invalid actor id');
      }),
      getErrorBuffer: jest.fn(() => []),
    };

    const deps = createCommonDeps({ errorHandler });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();
    ctx.actorEntity.id = undefined;

    expect(() => resolver.resolve(baseNode, ctx)).toThrow(
      'handled: invalid actor id'
    );
    expect(errorHandler.handleError).toHaveBeenCalledWith(
      expect.any(Error),
      ctx,
      'FilterResolver',
      ErrorCodes.INVALID_ACTOR_ID
    );
  });

  it('continues processing when evaluation throws non condition_ref errors', () => {
    const logicEval = {
      evaluate: jest.fn(() => {
        throw new Error('Unexpected evaluation failure');
      }),
    };

    const deps = createCommonDeps({ logicEval });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    const result = resolver.resolve(baseNode, ctx);

    expect(result.size).toBe(0);
    expect(logicEval.evaluate).toHaveBeenCalledTimes(1);
  });
});
