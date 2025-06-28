import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createFilterResolver from '../../src/scopeDsl/nodes/filterResolver.js';

describe('filterResolver', () => {
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
            componentTypeIds: ['core:name', 'core:position'],
            getComponentData: (cid) => {
              if (cid === 'core:name') return { value: 'Entity One' };
              if (cid === 'core:position')
                return { location: 'loc1', x: 10, y: 20 };
              return null;
            },
          },
          entity2: {
            id: 'entity2',
            componentTypeIds: ['core:name'],
            getComponentData: (cid) => {
              if (cid === 'core:name') return { value: 'Entity Two' };
              return null;
            },
          },
          entity3: {
            id: 'entity3',
            componentTypeIds: ['core:position'],
            getComponentData: (cid) => {
              if (cid === 'core:position')
                return { location: 'loc2', x: 30, y: 40 };
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

  describe('canResolve', () => {
    it('should return true for Filter nodes', () => {
      expect(resolver.canResolve({ type: 'Filter' })).toBe(true);
    });

    it('should return false for non-Filter nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Union' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('basic filtering', () => {
      it('should filter entity IDs based on logic evaluation', () => {
        const parentResult = new Set(['entity1', 'entity2', 'entity3']);
        dispatcher.resolve.mockReturnValue(parentResult);

        // Only entity1 and entity3 pass the filter
        logicEval.evaluate.mockImplementation((logic, ctx) => {
          return ctx.entity.id === 'entity1' || ctx.entity.id === 'entity3';
        });

        const node = {
          type: 'Filter',
          parent: { type: 'Source', kind: 'entities' },
          logic: { '==': [{ var: 'entity.id' }, 'entity1'] },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity2')).toBe(false);
      });

      it('should return empty set when parent result is empty', () => {
        dispatcher.resolve.mockReturnValue(new Set());

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

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
        expect(logicEval.evaluate).not.toHaveBeenCalled();
      });
    });

    describe('array filtering', () => {
      it('should filter elements within arrays', () => {
        const parentResult = new Set([['entity1', 'entity2'], ['entity3']]);
        dispatcher.resolve.mockReturnValue(parentResult);

        // Only entity2 passes the filter
        logicEval.evaluate.mockImplementation((logic, ctx) => {
          return ctx.entity.id === 'entity2';
        });

        const node = {
          type: 'Filter',
          parent: { type: 'Step' },
          logic: {
            '==': [{ var: 'entity.components.core:name.value' }, 'Entity Two'],
          },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(1);
        expect(result.has('entity2')).toBe(true);
      });
    });

    describe('object filtering', () => {
      it('should filter objects directly', () => {
        const obj1 = { id: 'exit1', direction: 'north', destination: 'room2' };
        const obj2 = { id: 'exit2', direction: 'south', destination: 'room3' };
        const obj3 = { id: 'exit3', direction: 'east', destination: 'room4' };

        const parentResult = new Set([obj1, obj2, obj3]);
        dispatcher.resolve.mockReturnValue(parentResult);

        // Only north and east exits pass
        logicEval.evaluate.mockImplementation((logic, ctx) => {
          return (
            ctx.entity.direction === 'north' || ctx.entity.direction === 'east'
          );
        });

        const node = {
          type: 'Filter',
          parent: { type: 'Step' },
          logic: { in: [{ var: 'entity.direction' }, ['north', 'east']] },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has(obj1)).toBe(true);
        expect(result.has(obj3)).toBe(true);
        expect(result.has(obj2)).toBe(false);
      });
    });

    describe('context building', () => {
      it('should build proper context with entity components', () => {
        const parentResult = new Set(['entity1']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: { '==': [1, 1] },
        };
        const actorEntity = {
          id: 'actor123',
          componentTypeIds: ['core:name'],
          getComponentData: (cid) => {
            if (cid === 'core:name') return { value: 'Actor' };
            return null;
          },
        };
        const ctx = { actorEntity, dispatcher };

        resolver.resolve(node, ctx);

        expect(logicEval.evaluate).toHaveBeenCalledWith(
          node.logic,
          expect.objectContaining({
            entity: expect.objectContaining({
              id: 'entity1',
              components: {
                'core:name': { value: 'Entity One' },
                'core:position': { location: 'loc1', x: 10, y: 20 },
              },
            }),
            actor: expect.objectContaining({
              id: 'actor123',
              components: {
                'core:name': { value: 'Actor' },
              },
            }),
            location: { id: 'location1' },
          })
        );
      });

      it('should handle entities without componentTypeIds', () => {
        entitiesGateway.getEntityInstance.mockReturnValue({ id: 'entity1' });
        const parentResult = new Set(['entity1']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result.has('entity1')).toBe(true);
        expect(logicEval.evaluate).toHaveBeenCalledWith(
          node.logic,
          expect.objectContaining({
            entity: { id: 'entity1' },
          })
        );
      });

      it('should handle missing entities', () => {
        entitiesGateway.getEntityInstance.mockReturnValue(null);
        const parentResult = new Set(['unknown-entity']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result.has('unknown-entity')).toBe(true);
        expect(logicEval.evaluate).toHaveBeenCalledWith(
          node.logic,
          expect.objectContaining({
            entity: { id: 'unknown-entity' },
          })
        );
      });
    });

    describe('invalid items', () => {
      it('should skip null and undefined items', () => {
        const parentResult = new Set(['entity1', null, undefined, 'entity2']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
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

      it('should skip non-string, non-object items', () => {
        const parentResult = new Set(['entity1', 123, true, 'entity2']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });
    });

    describe('trace logging', () => {
      it('should add trace logs when trace context is provided', () => {
        const trace = {
          addLog: jest.fn(),
        };
        const parentResult = new Set(['entity1', 'entity2']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValueOnce(true).mockReturnValueOnce(false);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: { test: 'logic' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
          trace,
        };

        resolver.resolve(node, ctx);

        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          'Applying filter to 2 items.',
          'FilterResolver',
          { logic: { test: 'logic' } }
        );

        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          'Filter application complete. 1 of 2 items passed.',
          'FilterResolver'
        );
      });

      it('should not throw when trace is not provided', () => {
        const parentResult = new Set(['entity1']);
        dispatcher.resolve.mockReturnValue(parentResult);
        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        expect(() => resolver.resolve(node, ctx)).not.toThrow();
      });
    });

    describe('edge cases', () => {
      it('should use entitiesGateway.getComponentData when entity.getComponentData is not available', () => {
        entitiesGateway.getEntityInstance.mockReturnValue({
          id: 'entity1',
          componentTypeIds: ['core:name'],
          // No getComponentData method
        });
        entitiesGateway.getComponentData.mockReturnValue({
          value: 'From Gateway',
        });

        const parentResult = new Set(['entity1']);
        dispatcher.resolve.mockReturnValue(parentResult);

        logicEval.evaluate.mockReturnValue(true);

        const node = {
          type: 'Filter',
          parent: { type: 'Source' },
          logic: {},
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        resolver.resolve(node, ctx);

        expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'core:name'
        );
        expect(logicEval.evaluate).toHaveBeenCalledWith(
          node.logic,
          expect.objectContaining({
            entity: expect.objectContaining({
              components: {
                'core:name': { value: 'From Gateway' },
              },
            }),
          })
        );
      });
    });
  });
});
