import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';

describe('FilterResolver Edge Cases', () => {
  let resolver;
  let logicEval;
  let entitiesGateway;
  let locationProvider;
  let dispatcher;

  beforeEach(() => {
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
            componentTypeIds: ['core:name'],
            getComponentData: jest.fn(),
          },
        };
        return entities[id] || null;
      }),
      getComponentData: jest.fn(),
    };

    locationProvider = {
      getLocation: jest.fn(() => ({ id: 'location1' })),
    };

    dispatcher = {
      resolve: jest.fn(),
    };

    resolver = createFilterResolver({
      logicEval,
      entitiesGateway,
      locationProvider,
    });
  });

  describe('actor entity validation', () => {
    it('should throw error when actorEntity is undefined', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: undefined,
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: actorEntity is undefined in context'
      );
    });

    it('should throw error when actorEntity is null', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: null,
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: actorEntity is undefined in context'
      );
    });

    it('should throw error when actorEntity.id is undefined', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: undefined },
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: actorEntity has invalid ID'
      );
    });

    it('should throw error when actorEntity.id is "undefined" string', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'undefined' },
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: actorEntity has invalid ID'
      );
    });

    it('should throw error when actorEntity.id is not a string', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 123 }, // Number instead of string
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: actorEntity has invalid ID'
      );
    });

    it('should throw error when node structure is invalid', () => {
      const node = {
        type: 'Filter',
        parent: null, // Missing parent
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123' },
        dispatcher,
      };

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'FilterResolver: Invalid node structure - missing parent node'
      );
    });
  });

  describe('null/undefined handling in results', () => {
    it('should skip null items in parent result', () => {
      const parentResult = new Set(['entity1', null, 'entity2']);
      dispatcher.resolve.mockReturnValue(parentResult);

      logicEval.evaluate.mockReturnValue(true);

      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123' },
        dispatcher,
      };

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      expect(result.has('entity1')).toBe(true);
      expect(result.has('entity2')).toBe(true);
      expect(result.has(null)).toBe(false);
    });

    it('should skip undefined items in parent result', () => {
      const parentResult = new Set(['entity1', undefined, 'entity2']);
      dispatcher.resolve.mockReturnValue(parentResult);

      logicEval.evaluate.mockReturnValue(true);

      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123' },
        dispatcher,
      };

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      expect(result.has('entity1')).toBe(true);
      expect(result.has('entity2')).toBe(true);
      expect(result.has(undefined)).toBe(false);
    });

    it('should handle arrays with null/undefined elements', () => {
      const parentResult = new Set([['entity1', null, 'entity2', undefined]]);
      dispatcher.resolve.mockReturnValue(parentResult);

      logicEval.evaluate.mockReturnValue(true);

      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123' },
        dispatcher,
      };

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      expect(result.has('entity1')).toBe(true);
      expect(result.has('entity2')).toBe(true);
      expect(result.has(null)).toBe(false);
      expect(result.has(undefined)).toBe(false);
    });
  });

  describe('context propagation', () => {
    it('should maintain valid context throughout resolution', () => {
      const parentResult = new Set(['entity1']);
      dispatcher.resolve.mockReturnValue(parentResult);

      logicEval.evaluate.mockImplementation((logic, ctx) => {
        // Verify context structure
        expect(ctx).toHaveProperty('entity');
        expect(ctx).toHaveProperty('actor');
        expect(ctx).toHaveProperty('location');
        expect(ctx.actor.id).toBe('actor123');
        expect(ctx.location.id).toBe('location1');
        return true;
      });

      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
      };
      const ctx = {
        actorEntity: { id: 'actor123', components: {} },
        dispatcher,
      };

      const result = resolver.resolve(node, ctx);

      expect(logicEval.evaluate).toHaveBeenCalled();
      expect(result.size).toBe(1);
    });
  });

  describe('trace logging', () => {
    it('should log warnings for null/undefined items when trace is provided', () => {
      const parentResult = new Set(['entity1', null, undefined]);
      dispatcher.resolve.mockReturnValue(parentResult);

      logicEval.evaluate.mockReturnValue(true);

      const trace = {
        addLog: jest.fn(),
      };

      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [1, 1] },
      };
      const ctx = {
        actorEntity: { id: 'actor123' },
        dispatcher,
        trace,
      };

      resolver.resolve(node, ctx);

      // Should have logged warnings for null/undefined
      expect(trace.addLog).toHaveBeenCalledWith(
        'warning',
        'Skipping null/undefined item in filter',
        'ScopeEngine.resolveFilter'
      );
    });
  });
});