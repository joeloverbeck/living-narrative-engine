import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import {
  clearEntityCache,
  createEvaluationContext,
} from '../../../src/scopeDsl/core/entityHelpers.js';

// Mocks for resolver factories
jest.mock('../../../src/scopeDsl/nodes/sourceResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'source',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/stepResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'step',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/filterResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'filter',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/unionResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'union',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/arrayIterationResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'array',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/clothingStepResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'clothingStep',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/slotAccessResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'slotAccess',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/bodyPartStepResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'bodyPartStep',
  }))
);
jest.mock('../../../src/scopeDsl/nodes/scopeReferenceResolver.js', () =>
  jest.fn(() => ({
    canResolve: jest.fn(),
    resolve: jest.fn(),
    name: 'scopeReference',
  }))
);

const createSourceResolver = require('../../../src/scopeDsl/nodes/sourceResolver.js');
const createStepResolver = require('../../../src/scopeDsl/nodes/stepResolver.js');
const createFilterResolver = require('../../../src/scopeDsl/nodes/filterResolver.js');
const createUnionResolver = require('../../../src/scopeDsl/nodes/unionResolver.js');
const createArrayIterationResolver = require('../../../src/scopeDsl/nodes/arrayIterationResolver.js');
const createClothingStepResolver = require('../../../src/scopeDsl/nodes/clothingStepResolver.js');
const createSlotAccessResolver = require('../../../src/scopeDsl/nodes/slotAccessResolver.js');
const createBodyPartStepResolver = require('../../../src/scopeDsl/nodes/bodyPartStepResolver.js');
const createScopeReferenceResolver = require('../../../src/scopeDsl/nodes/scopeReferenceResolver.js');
const createCycleDetectorModule = require('../../../src/scopeDsl/core/cycleDetector.js');

describe('ScopeEngine helper methods', () => {
  let engine;
  let runtimeCtx;

  beforeEach(() => {
    engine = new ScopeEngine();
    runtimeCtx = {
      location: { id: 'loc1' },
      entityManager: {
        getEntities: jest.fn(() => [{ id: 'e1' }]),
        getEntitiesWithComponent: jest.fn(),
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(),
        getEntity: jest.fn(),
        getEntityInstance(entityId) {
          return { id: entityId };
        },
      },
      jsonLogicEval: { evaluate: jest.fn(() => true) },
    };
    jest.clearAllMocks();
    clearEntityCache();
  });

  describe('_createLocationProvider', () => {
    it('returns provider that fetches location from runtime context', () => {
      const provider = engine._createLocationProvider(runtimeCtx);
      expect(provider.getLocation()).toBe(runtimeCtx.location);
    });
  });

  describe('_createEntitiesGateway', () => {
    it('delegates entity operations to runtime context', () => {
      const gateway = engine._createEntitiesGateway(runtimeCtx);
      gateway.getEntities();
      expect(runtimeCtx.entityManager.getEntities).toHaveBeenCalled();
      gateway.getEntitiesWithComponent('c1');
      expect(
        runtimeCtx.entityManager.getEntitiesWithComponent
      ).toHaveBeenCalledWith('c1');
      gateway.hasComponent('e1', 'c1');
      expect(runtimeCtx.entityManager.hasComponent).toHaveBeenCalledWith(
        'e1',
        'c1'
      );
    });

    it('returns entity values when entity manager exposes plain object storage', () => {
      const entityOne = { id: 'entity-1' };
      const entityTwo = { id: 'entity-2' };
      const gateway = engine._createEntitiesGateway({
        entityManager: {
          getEntity: () => null,
          entities: {
            [entityOne.id]: entityOne,
            [entityTwo.id]: entityTwo,
          },
        },
      });

      const entities = gateway.getEntities();
      expect(entities).toEqual([entityOne, entityTwo]);
    });

    it('returns entity array when entity manager exposes array storage', () => {
      const entityOne = { id: 'entity-1' };
      const entityTwo = { id: 'entity-2' };
      const entityArray = [entityOne, entityTwo];
      Object.defineProperty(entityArray, 'values', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const gateway = engine._createEntitiesGateway({
        entityManager: {
          getEntity: () => null,
          entities: entityArray,
        },
      });

      const entities = gateway.getEntities();

      expect(Array.isArray(entities)).toBe(true);
      expect(entities).toBe(entityArray);
    });

    it('returns empty array when entity manager lacks retrievable collections', () => {
      const gateway = engine._createEntitiesGateway({
        entityManager: {
          getEntity: () => null,
        },
      });

      expect(gateway.getEntities()).toEqual([]);
    });

    it('keeps lookups observable when spies attach after gateway creation', () => {
      const cacheEvents = jest.fn();
      const runtimeCtxWithDebug = {
        ...runtimeCtx,
        entityManager: { ...runtimeCtx.entityManager },
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
        scopeEntityLookupDebug: {
          enabled: true,
          cacheEvents,
        },
      };

      runtimeCtxWithDebug.entityManager.getEntityInstance = function getEntityInstance(
        entityId
      ) {
        return { id: entityId, components: {} };
      };

      const gateway = engine._createEntitiesGateway(runtimeCtxWithDebug);
      const locationProvider = engine._createLocationProvider(runtimeCtxWithDebug);
      const actor = { id: 'actor-1', componentTypeIds: [] };

      const getEntitySpy = jest
        .spyOn(runtimeCtxWithDebug.entityManager, 'getEntityInstance')
        .mockImplementation((entityId) => ({ id: entityId, components: {} }));

      createEvaluationContext(
        'entity-99',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtxWithDebug
      );

      createEvaluationContext(
        'entity-99',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtxWithDebug
      );

      expect(getEntitySpy).toHaveBeenCalledTimes(1);
      const eventTypes = cacheEvents.mock.calls.map(([event]) => event.type);
      expect(eventTypes).toContain('miss');
      expect(eventTypes).toContain('hit');
    });

    it('builds item components from componentTypeIds when no component map exists', () => {
      const itemId = 'item-from-ids';
      const runtimeCtxWithComponentIds = {
        entityManager: {
          getEntity: jest.fn(() => ({
            id: itemId,
            componentTypeIds: ['core:item', 'core:clothing'],
          })),
          getComponentData: jest.fn((entityId, componentId) => {
            if (entityId !== itemId) {
              return null;
            }

            if (componentId === 'core:item') {
              return { name: 'Hat' };
            }

            if (componentId === 'core:clothing') {
              return { slot: 'head' };
            }

            return null;
          }),
        },
      };

      const gateway = engine._createEntitiesGateway(runtimeCtxWithComponentIds);

      const components = gateway.getItemComponents(itemId);

      expect(components).toEqual({
        'core:item': { name: 'Hat' },
        'core:clothing': { slot: 'head' },
      });
      expect(
        runtimeCtxWithComponentIds.entityManager.getComponentData
      ).toHaveBeenCalledWith(itemId, 'core:item');
      expect(
        runtimeCtxWithComponentIds.entityManager.getComponentData
      ).toHaveBeenCalledWith(itemId, 'core:clothing');
    });
  });

  describe('_createLogicEvaluator', () => {
    it('wraps jsonLogic evaluator from runtime context', () => {
      const evalr = engine._createLogicEvaluator(runtimeCtx);
      evalr.evaluate('logic', { ctx: true });
      expect(runtimeCtx.jsonLogicEval.evaluate).toHaveBeenCalledWith('logic', {
        ctx: true,
      });
    });
  });

  describe('_createResolvers', () => {
    it('constructs resolver list using factory functions', () => {
      const locationProvider = engine._createLocationProvider(runtimeCtx);
      const entitiesGateway = engine._createEntitiesGateway(runtimeCtx);
      const logicEval = engine._createLogicEvaluator(runtimeCtx);
      const resolvers = engine._createResolvers({
        locationProvider,
        entitiesGateway,
        logicEval,
      });

      expect(createClothingStepResolver).toHaveBeenCalledWith({
        entitiesGateway,
      });
      expect(createSlotAccessResolver).toHaveBeenCalledWith({
        entitiesGateway,
      });
      expect(createBodyPartStepResolver).toHaveBeenCalledWith({
        entitiesGateway,
        errorHandler: null,
      });
      expect(createSourceResolver).toHaveBeenCalledWith({
        entitiesGateway,
        locationProvider,
        errorHandler: null,
      });
      expect(createStepResolver).toHaveBeenCalledWith({
        entitiesGateway,
        errorHandler: null,
      });
      expect(createFilterResolver).toHaveBeenCalledWith({
        logicEval,
        entitiesGateway,
        locationProvider,
        errorHandler: null,
      });
      expect(createUnionResolver).toHaveBeenCalled();
      expect(createArrayIterationResolver).toHaveBeenCalled();
      expect(resolvers).toEqual([
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'clothingStep',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'slotAccess',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'bodyPartStep',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'source',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'step',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'filter',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'union',
        },
        {
          canResolve: expect.any(Function),
          resolve: expect.any(Function),
          name: 'array',
        },
      ]);
    });

    it('appends scope reference resolver when a registry is provided', () => {
      const scopedEngine = new ScopeEngine({
        scopeRegistry: {},
        errorHandler: { handleError: jest.fn() },
      });
      const locationProvider = scopedEngine._createLocationProvider(runtimeCtx);
      const entitiesGateway = scopedEngine._createEntitiesGateway(runtimeCtx);
      const logicEval = scopedEngine._createLogicEvaluator(runtimeCtx);

      const resolvers = scopedEngine._createResolvers({
        locationProvider,
        entitiesGateway,
        logicEval,
        runtimeCtx,
      });

      expect(createScopeReferenceResolver).toHaveBeenCalledWith({
        scopeRegistry: {},
        cycleDetector: null,
        errorHandler: expect.objectContaining({ handleError: expect.any(Function) }),
      });
      expect(resolvers[resolvers.length - 1]).toEqual({
        canResolve: expect.any(Function),
        resolve: expect.any(Function),
        name: 'scopeReference',
      });
    });
  });

  describe('resolve instrumentation and cycle detection', () => {
    it('properly delegates to dispatcher with wrapped context', () => {
      const actor = { id: 'actor-1' };
      const dispatcherResolve = jest.fn(() => new Set(['actor-1']));
      const ensureInitializedSpy = jest
        .spyOn(engine, '_ensureInitialized')
        .mockReturnValue({ resolve: dispatcherResolve });

      const result = engine.resolve(
        { type: 'Source', kind: 'actor' },
        actor,
        runtimeCtx
      );

      expect(result).toEqual(new Set(['actor-1']));
      expect(ensureInitializedSpy).toHaveBeenCalledWith(runtimeCtx, null);
      expect(dispatcherResolve).toHaveBeenCalled();

      ensureInitializedSpy.mockRestore();
    });

    it('uses scope reference keys when resolving nested scopes', () => {
      const cycleDetector = { enter: jest.fn(), leave: jest.fn() };
      const cycleDetectorSpy = jest
        .spyOn(createCycleDetectorModule, 'default')
        .mockReturnValue(cycleDetector);

      const dispatcherResolve = jest.fn((node, ctx) => {
        if (!ctx.__inner) {
          const innerResult = ctx.dispatcher.resolve(
            { type: 'ScopeReference', scopeId: 'scope-123' },
            { ...ctx, __inner: true, depth: ctx.depth + 1 }
          );
          expect(innerResult).toBeInstanceOf(Set);
        }
        return new Set(['resolved']);
      });

      const ensureInitializedSpy = jest
        .spyOn(engine, '_ensureInitialized')
        .mockReturnValue({ resolve: dispatcherResolve });

      const actorEntity = { id: 'actor-outer' };

      try {
        const result = engine.resolve(
          { type: 'ScopeReference', scopeId: 'root-scope' },
          actorEntity,
          runtimeCtx
        );

        expect(result).toBeInstanceOf(Set);
        const [, ctxFromCall] = dispatcherResolve.mock.calls[0];
        ctxFromCall.dispatcher.resolve(
          { type: 'ScopeReference', scopeId: 'manual-scope' },
          { ...ctxFromCall, __inner: true, depth: ctxFromCall.depth + 1 }
        );

        expect(dispatcherResolve).toHaveBeenCalledTimes(3);
        expect(cycleDetector.enter).toHaveBeenCalledWith('ScopeReference:scope-123');
        expect(cycleDetector.enter).toHaveBeenCalledWith('ScopeReference:manual-scope');
        expect(cycleDetector.leave).toHaveBeenCalledTimes(3);
      } finally {
        ensureInitializedSpy.mockRestore();
        cycleDetectorSpy.mockRestore();
      }
    });
  });
});
