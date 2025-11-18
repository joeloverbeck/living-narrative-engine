import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
} from '@jest/globals';
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

/**
 * @description Creates a Jest-friendly logger implementation for integration tests.
 * @returns {{error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock}}
 */
function createTestLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * @description Builds a fully wired filter resolver and the supporting runtime context.
 * @param {object} [options] - Optional overrides for the resolver dependencies.
 * @param {boolean} [options.includeErrorHandler] - Whether to provide the Scope DSL error handler.
 * @param {Array<object>} [options.entities] - Seed entities for the SimpleEntityManager.
 * @param {{evaluate: Function}} [options.logicEvalOverride] - Custom logic evaluator used instead of the default.
 * @param {boolean} [options.omitErrorHandlerProperty] - Whether to omit the error handler parameter entirely.
 * @returns {{
 *   filterResolver: { resolve: Function, canResolve: Function },
 *   errorHandler: ScopeDslErrorHandler|null,
 *   runtimeCtx: object,
 *   logger: { error: jest.Mock, warn: jest.Mock, info: jest.Mock, debug: jest.Mock },
 *   actorEntity: object|null,
 * }}
 */
function createFilterResolverHarness({
  includeErrorHandler = true,
  entities,
  logicEvalOverride,
  omitErrorHandlerProperty = false,
} = {}) {
  const logger = createTestLogger();
  const errorHandler = includeErrorHandler
    ? new ScopeDslErrorHandler({ logger })
    : null;

  const entityManager = new SimpleEntityManager(
    entities ?? [
      {
        id: 'actor:hero',
        components: {
          'core:actor': { name: 'Hero' },
        },
      },
    ],
  );

  const jsonLogicEval = new JsonLogicEvaluationService({ logger });
  const runtimeCtx = {
    entityManager,
    jsonLogicEval,
    location: { id: 'location:central', components: {} },
  };

  const scopeEngine = new ScopeEngine({ errorHandler });
  const locationProvider = scopeEngine._createLocationProvider(runtimeCtx);
  const entitiesGateway = scopeEngine._createEntitiesGateway(runtimeCtx);
  const logicEval =
    logicEvalOverride ?? scopeEngine._createLogicEvaluator(runtimeCtx);

  const resolverOptions = {
    logicEval,
    entitiesGateway,
    locationProvider,
  };

  if (!omitErrorHandlerProperty) {
    resolverOptions.errorHandler = errorHandler;
  }

  const filterResolver = createFilterResolver(resolverOptions);

  return {
    filterResolver,
    errorHandler,
    runtimeCtx,
    logger,
    actorEntity: entityManager.getEntityInstance('actor:hero') ?? null,
  };
}

describe('filterResolver integration coverage', () => {
  let baseEntities;

  beforeEach(() => {
    baseEntities = [
      {
        id: 'actor:hero',
        components: {
          'core:actor': { name: 'Hero' },
          'core:position': { locationId: 'location:central' },
        },
      },
      {
        id: 'item:legendary-blade',
        components: {
          'core:item': { type: 'weapon', rarity: 'legendary' },
          'core:tags': { tags: ['legendary', 'quest'] },
        },
      },
      {
        id: 'item:common-shield',
        components: {
          'core:item': { type: 'armor', rarity: 'common' },
          'core:tags': { tags: ['common'] },
        },
      },
      {
        id: 'item:legendary-tonic',
        components: {
          'core:item': { type: 'potion', rarity: 'legendary' },
        },
      },
    ];
  });

  it('filters nested parent results, caches actor preprocessing, and logs trace events', () => {
    const { filterResolver, runtimeCtx, actorEntity } =
      createFilterResolverHarness({ entities: baseEntities });

    const parentResultFirstPass = new Set([
      ['item:legendary-blade', null, 'item:common-shield', undefined],
      'item:legendary-tonic',
      { id: 'item:crafted-relic', rarity: 'legendary', quantity: 2 },
      null,
      42,
    ]);

    const parentResultSecondPass = new Set([
      'item:legendary-blade',
      'item:common-shield',
    ]);

    const traceLogs = [];
    const trace = {
      addLog: jest.fn((level, message, source) => {
        traceLogs.push({ level, message, source });
      }),
    };

    const dispatcherResolve = jest
      .fn()
      .mockReturnValueOnce(parentResultFirstPass)
      .mockReturnValueOnce(parentResultSecondPass);

    const node = {
      type: 'Filter',
      parent: { type: 'Source' },
      logic: {
        or: [
          {
            in: ['legendary', { var: 'components.core:tags.tags' }],
          },
          {
            '==': [{ var: 'components.core:item.rarity' }, 'legendary'],
          },
          {
            '==': [{ var: 'rarity' }, 'legendary'],
          },
        ],
      },
    };

    const ctx = {
      actorEntity,
      dispatcher: { resolve: dispatcherResolve },
      trace,
      runtimeCtx,
    };

    const firstResult = filterResolver.resolve(node, ctx);
    const secondResult = filterResolver.resolve(node, ctx);
    const resultWithoutTrace = filterResolver.resolve(node, {
      actorEntity,
      dispatcher: { resolve: () => new Set(['item:legendary-tonic']) },
      runtimeCtx,
    });

    expect(dispatcherResolve).toHaveBeenCalledTimes(2);
    expect(dispatcherResolve).toHaveBeenCalledWith(node.parent, ctx);
    expect(firstResult.has('item:legendary-blade')).toBe(true);
    expect(firstResult.has('item:legendary-tonic')).toBe(true);
    expect(
      Array.from(firstResult).some(
        (value) => typeof value === 'object' && value?.id === 'item:crafted-relic',
      ),
    ).toBe(true);
    expect(firstResult.has('item:common-shield')).toBe(false);
    expect(firstResult.has(42)).toBe(false);
    expect(ctx._processedActor).toBeDefined();
    expect(secondResult.has('item:legendary-blade')).toBe(true);
    expect(Array.from(secondResult)).toHaveLength(1);
    expect(traceLogs.length).toBeGreaterThanOrEqual(4);
    expect(trace.addLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Applying filter to'),
      'ScopeEngine.resolveFilter',
      expect.any(Object),
    );
    expect(trace.addLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Filter application complete'),
      'ScopeEngine.resolveFilter',
    );
    expect(resultWithoutTrace.has('item:legendary-tonic')).toBe(true);
  });

  it('identifies filter nodes via canResolve even when no error handler is supplied', () => {
    const { filterResolver } = createFilterResolverHarness({
      entities: baseEntities,
      omitErrorHandlerProperty: true,
    });

    expect(filterResolver.canResolve({ type: 'Filter' })).toBe(true);
    expect(filterResolver.canResolve({ type: 'Step' })).toBe(false);
  });

  it('returns an empty set immediately when the parent result is empty', () => {
    const { filterResolver, runtimeCtx, actorEntity } =
      createFilterResolverHarness({ entities: baseEntities });

    const node = {
      type: 'Filter',
      parent: { type: 'Source' },
      logic: { '==': [1, 1] },
    };

    const ctx = {
      actorEntity,
      dispatcher: { resolve: () => new Set() },
      trace: { addLog: jest.fn() },
      runtimeCtx,
    };

    const result = filterResolver.resolve(node, ctx);
    expect(result.size).toBe(0);
    expect(ctx._processedActor).toBeUndefined();
  });

  it('raises a ScopeDslError when the actor entity is missing and an error handler is available', () => {
    const { filterResolver } = createFilterResolverHarness({
      entities: baseEntities,
    });

    const node = { type: 'Filter', parent: { type: 'Source' }, logic: {} };

    let capturedError;
    try {
      filterResolver.resolve(node, {
        actorEntity: null,
        dispatcher: { resolve: () => new Set() },
        runtimeCtx: {},
      });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(ScopeDslError);
    expect(capturedError?.message).toContain(ErrorCodes.MISSING_ACTOR);
  });

  it('throws the original error when no error handler is configured and actor is missing', () => {
    const { filterResolver } = createFilterResolverHarness({
      includeErrorHandler: false,
      entities: baseEntities,
    });

    const node = { type: 'Filter', parent: { type: 'Source' }, logic: {} };

    expect(() =>
      filterResolver.resolve(node, {
        actorEntity: null,
        dispatcher: { resolve: () => new Set() },
        runtimeCtx: {},
      }),
    ).toThrow(/actorEntity is undefined/);
  });

  it('detects invalid actor IDs that likely lost their getter and routes through the error handler', () => {
    const { filterResolver } = createFilterResolverHarness({
      entities: baseEntities,
    });

    const node = { type: 'Filter', parent: { type: 'Source' }, logic: {} };

    const invalidActors = [
      { components: {}, componentTypeIds: ['core:actor'] },
      { components: {} },
    ];

    for (const invalidActor of invalidActors) {
      let capturedError;
      try {
        filterResolver.resolve(node, {
          actorEntity: invalidActor,
          dispatcher: { resolve: () => new Set() },
          runtimeCtx: {},
        });
      } catch (error) {
        capturedError = error;
      }

      expect(capturedError).toBeInstanceOf(ScopeDslError);
      expect(capturedError?.message).toContain(ErrorCodes.INVALID_ACTOR_ID);
      expect(capturedError?.message).toContain("lost its 'id' getter method");
    }
  });

  it('throws directly for invalid actor IDs when no error handler is present', () => {
    const { filterResolver } = createFilterResolverHarness({
      includeErrorHandler: false,
      entities: baseEntities,
    });

    const node = { type: 'Filter', parent: { type: 'Source' }, logic: {} };

    expect(() =>
      filterResolver.resolve(node, {
        actorEntity: { id: 123 },
        dispatcher: { resolve: () => new Set() },
        runtimeCtx: {},
      }),
    ).toThrow(/invalid ID/);
  });

  it('validates the presence of a parent node', () => {
    const { filterResolver, actorEntity, runtimeCtx } =
      createFilterResolverHarness({ entities: baseEntities });

    expect(() =>
      filterResolver.resolve(
        { type: 'Filter', logic: {} },
        {
          actorEntity,
          dispatcher: { resolve: () => new Set() },
          runtimeCtx,
        },
      ),
    ).toThrow(ScopeDslError);
  });

  it('throws when the parent node is missing without an error handler', () => {
    const { filterResolver, actorEntity, runtimeCtx } =
      createFilterResolverHarness({
        entities: baseEntities,
        includeErrorHandler: false,
      });

    expect(() =>
      filterResolver.resolve(
        { type: 'Filter', logic: {} },
        {
          actorEntity,
          dispatcher: { resolve: () => new Set() },
          runtimeCtx,
        },
      ),
    ).toThrow(/missing parent node/);
  });

  it("surfaces condition_ref resolution errors through the error handler", () => {
    const entities = baseEntities;
    const logger = createTestLogger();
    const jsonLogicEval = new JsonLogicEvaluationService({ logger });
    const runtimeCtx = {
      entityManager: new SimpleEntityManager(entities),
      jsonLogicEval,
      location: { id: 'location:central', components: {} },
    };

    const errorHandler = new ScopeDslErrorHandler({ logger });
    const scopeEngine = new ScopeEngine({ errorHandler });
    const locationProvider = scopeEngine._createLocationProvider(runtimeCtx);
    const entitiesGateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const logicEval = {
      evaluate: (logic, context) => {
        if (logic.forceConditionRefFailure) {
          throw new Error(
            "Could not resolve condition_ref 'missing_condition'. Definition or its logic property not found.",
          );
        }
        return scopeEngine._createLogicEvaluator(runtimeCtx).evaluate(logic, context);
      },
    };

    const filterResolver = createFilterResolver({
      logicEval,
      entitiesGateway,
      locationProvider,
      errorHandler,
    });

    const node = {
      type: 'Filter',
      parent: { type: 'Source' },
      logic: { forceConditionRefFailure: true, '==': [1, 1] },
    };

    expect(() =>
      filterResolver.resolve(node, {
        actorEntity: runtimeCtx.entityManager.getEntityInstance('actor:hero'),
        dispatcher: { resolve: () => new Set(['item:legendary-blade']) },
      runtimeCtx,
    }),
    ).toThrow(ScopeDslError);
  });

  it('rethrows condition_ref errors when no error handler is provided', () => {
    const logger = createTestLogger();
    const jsonLogicEval = new JsonLogicEvaluationService({ logger });
    const runtimeCtx = {
      entityManager: new SimpleEntityManager(baseEntities),
      jsonLogicEval,
      location: { id: 'location:central', components: {} },
    };

    const scopeEngine = new ScopeEngine();
    const locationProvider = scopeEngine._createLocationProvider(runtimeCtx);
    const entitiesGateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const logicEval = {
      evaluate: (logic, context) => {
        if (logic.forceConditionRefFailure) {
          throw new Error(
            "Could not resolve condition_ref 'missing_condition'. Definition or its logic property not found.",
          );
        }
        return scopeEngine._createLogicEvaluator(runtimeCtx).evaluate(logic, context);
      },
    };

    const filterResolver = createFilterResolver({
      logicEval,
      entitiesGateway,
      locationProvider,
    });

    expect(() =>
      filterResolver.resolve(
        {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: { forceConditionRefFailure: true, '==': [1, 1] },
        },
        {
          actorEntity: runtimeCtx.entityManager.getEntityInstance('actor:hero'),
          dispatcher: { resolve: () => new Set(['item:legendary-blade']) },
          runtimeCtx,
        },
      ),
    ).toThrow(/Filter logic evaluation failed/);
  });
});
