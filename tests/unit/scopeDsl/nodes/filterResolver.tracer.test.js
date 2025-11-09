/**
 * @file Unit tests for FilterResolver - Tracer Integration
 * @description Tests for tracer integration in src/scopeDsl/nodes/filterResolver.js
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createFilterResolver from '../../../../src/scopeDsl/nodes/filterResolver.js';
import { ScopeEvaluationTracer } from '../../../common/mods/scopeEvaluationTracer.js';

describe('FilterResolver - Tracer Integration', () => {
  let resolver;
  let logicEval;
  let entitiesGateway;
  let locationProvider;
  let dispatcher;
  let tracer;

  beforeEach(() => {
    // Create tracer
    tracer = new ScopeEvaluationTracer();

    // Create mock logic evaluator
    logicEval = {
      evaluate: jest.fn(),
    };

    // Create stub gateways
    entitiesGateway = {
      getEntityInstance: jest.fn((id) => {
        const entities = {
          entity1: {
            id: 'entity1',
            componentTypeIds: ['core:actor'],
            components: new Map([['core:name', { value: 'Entity One' }]]),
            getComponentData: (cid) => {
              if (cid === 'core:name') return { value: 'Entity One' };
              return null;
            },
          },
          entity2: {
            id: 'entity2',
            componentTypeIds: ['core:actor'],
            components: new Map([['core:name', { value: 'Entity Two' }]]),
            getComponentData: (cid) => {
              if (cid === 'core:name') return { value: 'Entity Two' };
              return null;
            },
          },
          entity3: {
            id: 'entity3',
            componentTypeIds: ['core:actor'],
            components: new Map([['core:name', { value: 'Entity Three' }]]),
            getComponentData: (cid) => {
              if (cid === 'core:name') return { value: 'Entity Three' };
              return null;
            },
          },
        };
        return entities[id] || null;
      }),
      getComponentData: jest.fn(),
    };

    locationProvider = {
      getLocation: jest.fn(() => ({ id: 'location1' })),
    };

    // Create a mock dispatcher for recursive resolution
    dispatcher = {
      resolve: jest.fn(),
    };

    resolver = createFilterResolver({
      logicEval,
      entitiesGateway,
      locationProvider,
    });
  });

  describe('Filter evaluation logging', () => {
    it('should log filter evaluation when tracer enabled', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBe(1);
    });

    it('should not log when tracer disabled', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.disable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBe(0);
    });

    it('should include entity ID', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations[0].entityId).toBe('entity1');
    });

    it('should include logic expression', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.enable();

      const logic = { '==': [{ var: 'entity.id' }, 'entity1'] };
      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic,
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations[0].logic).toEqual(logic);
    });

    it('should include pass/fail result', () => {
      const parentResult = new Set(['entity1', 'entity2']);
      dispatcher.resolve.mockReturnValue(parentResult);

      // entity1 passes, entity2 fails
      logicEval.evaluate.mockImplementation((logic, ctx) => {
        return ctx.entity.id === 'entity1';
      });

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBe(2);
      expect(filterEvaluations[0].result).toBe(true);
      expect(filterEvaluations[1].result).toBe(false);
    });

    it('should include eval context', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations[0].context).toBeDefined();
      expect(filterEvaluations[0].context.entity).toBeDefined();
    });
  });

  describe('Multiple entities', () => {
    it('should log evaluation for each entity', () => {
      const parentResult = new Set(['entity1', 'entity2', 'entity3']);
      dispatcher.resolve.mockReturnValue(parentResult);
      logicEval.evaluate.mockReturnValue(true);

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBe(3);
      expect(filterEvaluations[0].entityId).toBe('entity1');
      expect(filterEvaluations[1].entityId).toBe('entity2');
      expect(filterEvaluations[2].entityId).toBe('entity3');
    });

    it('should track pass/fail for each', () => {
      const parentResult = new Set(['entity1', 'entity2', 'entity3']);
      dispatcher.resolve.mockReturnValue(parentResult);

      // Only entity2 passes
      logicEval.evaluate.mockImplementation((logic, ctx) => {
        return ctx.entity.id === 'entity2';
      });

      tracer.enable();

      const node = {
        type: 'Filter',
        parent: { type: 'Source', kind: 'entities' },
        logic: { '==': [{ var: 'entity.id' }, 'entity2'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', componentTypeIds: ['core:actor'], components: new Map() },
        dispatcher,
        tracer: tracer,
        runtimeCtx: {},
      };

      resolver.resolve(node, ctx);

      const trace = tracer.getTrace();
      const filterEvaluations = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

      expect(filterEvaluations.length).toBe(3);
      expect(filterEvaluations[0].result).toBe(false); // entity1
      expect(filterEvaluations[1].result).toBe(true);  // entity2
      expect(filterEvaluations[2].result).toBe(false); // entity3
    });
  });
});
