import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

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

const createSourceResolver = require('../../../src/scopeDsl/nodes/sourceResolver.js');
const createStepResolver = require('../../../src/scopeDsl/nodes/stepResolver.js');
const createFilterResolver = require('../../../src/scopeDsl/nodes/filterResolver.js');
const createUnionResolver = require('../../../src/scopeDsl/nodes/unionResolver.js');
const createArrayIterationResolver = require('../../../src/scopeDsl/nodes/arrayIterationResolver.js');
const createClothingStepResolver = require('../../../src/scopeDsl/nodes/clothingStepResolver.js');
const createSlotAccessResolver = require('../../../src/scopeDsl/nodes/slotAccessResolver.js');

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
      },
      jsonLogicEval: { evaluate: jest.fn(() => true) },
    };
    jest.clearAllMocks();
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
  });
});
