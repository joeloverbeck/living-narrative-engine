import { describe, expect, it, jest } from '@jest/globals';
import createFilterResolver from '../../../../src/scopeDsl/nodes/filterResolver.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';
import { ScopeResolutionError } from '../../../../src/scopeDsl/errors/scopeResolutionError.js';

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
      // Simulates what jsonLogicEvaluationService.js now throws with ACTDISDIAFAIFAS-002b changes
      throw new ScopeResolutionError(
        "Condition reference 'missing:predicate' not found. Did you mean: core:actor, core:target?",
        {
          phase: 'condition_resolution',
          conditionId: 'missing:predicate',
          suggestions: ['core:actor', 'core:target'],
          hint: 'Check that the condition is defined in your mod and the ID is correct',
        }
      );
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
    expect(handledError).toBeInstanceOf(ScopeResolutionError);
    // ACTDISDIAFAIFAS-002b: Error message now preserves original with suggestions
    expect(handledError.message).toContain("Condition reference 'missing:predicate' not found");
    expect(handledError.message).toContain('Did you mean:');
    // Suggestions are preserved from the original error
    expect(handledError.context.suggestions).toEqual(['core:actor', 'core:target']);
    expect(handledCtx).toBe(ctx);
    expect(resolverName).toBe('FilterResolver');
    expect(code).toBe(ErrorCodes.RESOLUTION_FAILED_GENERIC);
  });

  it('rethrows condition_ref resolution failures when no error handler is registered', () => {
    const deps = createCommonDeps();
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    // ACTDISDIAFAIFAS-002b: Error message now preserves original with suggestions
    expect(() => resolver.resolve(baseNode, ctx)).toThrow(
      /Condition reference.*not found/
    );
    expect(() => resolver.resolve(baseNode, ctx)).toThrow(/Did you mean:/);
    expect(deps.logicEval.evaluate).toHaveBeenCalledTimes(2); // Called twice due to two throws above
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

  it('gracefully skips items when evaluation throws non-condition_ref errors', () => {
    const logicEval = {
      evaluate: jest.fn(() => {
        throw new Error('Unexpected evaluation failure');
      }),
    };

    const deps = createCommonDeps({ logicEval });
    const resolver = createFilterResolver(deps);
    const ctx = createCommonContext();

    // Non-condition_ref errors gracefully skip items to support heterogeneous collections
    // (e.g., inventory with mixed item types where some items lack filter-referenced components)
    // Only condition_ref errors (configuration bugs) fail-fast per INV-EVAL-1
    const result = resolver.resolve(baseNode, ctx);
    expect(result.size).toBe(0);
    expect(logicEval.evaluate).toHaveBeenCalledTimes(1);
  });

  // ACTDISDIAFAIFAS-002b: New tests for suggestion functionality
  describe('condition_ref suggestion integration (ACTDISDIAFAIFAS-002b)', () => {
    it('preserves suggestions array when condition_ref error includes suggestions', () => {
      const errorHandler = {
        handleError: jest.fn(),
        getErrorBuffer: jest.fn(() => []),
      };

      const logicEval = {
        evaluate: jest.fn(() => {
          throw new ScopeResolutionError(
            "Condition reference 'core:actorr' not found. Did you mean: core:actor, core:target?",
            {
              phase: 'condition_resolution',
              conditionId: 'core:actorr',
              suggestions: ['core:actor', 'core:target'],
            }
          );
        }),
      };

      const deps = createCommonDeps({ logicEval, errorHandler });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      resolver.resolve(baseNode, ctx);

      const [handledError] = errorHandler.handleError.mock.calls[0];
      expect(handledError.context.suggestions).toEqual(['core:actor', 'core:target']);
      expect(handledError.context.conditionId).toBe('core:actorr');
    });

    it('handles empty suggestions array gracefully', () => {
      const errorHandler = {
        handleError: jest.fn(),
        getErrorBuffer: jest.fn(() => []),
      };

      const logicEval = {
        evaluate: jest.fn(() => {
          throw new ScopeResolutionError(
            "Condition reference 'xyzzy:unknown' not found.",
            {
              phase: 'condition_resolution',
              conditionId: 'xyzzy:unknown',
              suggestions: [],
            }
          );
        }),
      };

      const deps = createCommonDeps({ logicEval, errorHandler });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      resolver.resolve(baseNode, ctx);

      const [handledError] = errorHandler.handleError.mock.calls[0];
      expect(handledError.context.suggestions).toEqual([]);
      expect(handledError.message).not.toContain('Did you mean');
    });

    it('preserves conditionId in wrapped error context', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new ScopeResolutionError(
            "Condition reference 'positioning:closeness' not found.",
            {
              phase: 'condition_resolution',
              conditionId: 'positioning:closeness',
              suggestions: ['positioning:close'],
            }
          );
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      try {
        resolver.resolve(baseNode, ctx);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeResolutionError);
        expect(error.context.conditionId).toBe('positioning:closeness');
        expect(error.context.suggestions).toEqual(['positioning:close']);
      }
    });

    it('preserves hint from original error', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new ScopeResolutionError(
            "Condition reference 'test:missing' not found.",
            {
              phase: 'condition_resolution',
              conditionId: 'test:missing',
              suggestions: [],
              hint: 'Check that the condition is defined in your mod and the ID is correct',
            }
          );
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      try {
        resolver.resolve(baseNode, ctx);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.context.hint).toContain('Check that');
      }
    });
  });
});
