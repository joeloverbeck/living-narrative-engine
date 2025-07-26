import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createEvaluationContext } from '../../../src/scopeDsl/core/entityHelpers.js';
import createSourceResolver from '../../../src/scopeDsl/nodes/sourceResolver.js';
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';

describe('Target Context Integration', () => {
  let mockGateway;
  let mockLocationProvider;
  let mockLogicEval;
  let sourceResolver;
  let filterResolver;

  beforeEach(() => {
    mockGateway = {
      getEntityInstance: jest.fn(),
      getItemComponents: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      hasComponent: jest.fn(),
      getEntities: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockLocationProvider = {
      getLocation: jest.fn(() => ({ id: 'test_location' })),
    };

    mockLogicEval = {
      evaluate: jest.fn(),
    };

    sourceResolver = createSourceResolver({
      entitiesGateway: mockGateway,
      locationProvider: mockLocationProvider,
    });

    filterResolver = createFilterResolver({
      logicEval: mockLogicEval,
      entitiesGateway: mockGateway,
      locationProvider: mockLocationProvider,
    });
  });

  describe('createEvaluationContext with Runtime Context', () => {
    it('should include target context when provided', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };
      const runtimeContext = {
        target: {
          id: 'target_001',
          components: { 'core:actor': { name: 'Target NPC' } },
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      expect(result).toHaveProperty('target');
      expect(result.target).toEqual({
        id: 'target_001',
        components: { 'core:actor': { name: 'Target NPC' } },
      });
    });

    it('should include targets context when provided', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };
      const runtimeContext = {
        targets: {
          primary: [
            {
              id: 'target_001',
              components: { 'core:item': { type: 'weapon' } },
            },
            {
              id: 'target_002',
              components: { 'core:item': { type: 'potion' } },
            },
          ],
          secondary: [
            { id: 'npc_001', components: { 'core:actor': { name: 'Guard' } } },
          ],
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      expect(result).toHaveProperty('targets');
      expect(result.targets).toEqual(runtimeContext.targets);
    });

    it('should work without runtime context (backward compatibility)', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null
      );

      expect(result).not.toHaveProperty('target');
      expect(result).not.toHaveProperty('targets');
      expect(result).toHaveProperty('entity');
      expect(result).toHaveProperty('actor');
      expect(result).toHaveProperty('location');
    });

    it('should include both target and targets when both provided', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };
      const runtimeContext = {
        target: {
          id: 'target_001',
          components: { 'core:actor': { name: 'Target NPC' } },
        },
        targets: {
          primary: [
            {
              id: 'target_001',
              components: { 'core:item': { type: 'weapon' } },
            },
          ],
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      expect(result).toHaveProperty('target');
      expect(result).toHaveProperty('targets');
      expect(result.target).toEqual(runtimeContext.target);
      expect(result.targets).toEqual(runtimeContext.targets);
    });
  });

  describe('Source Resolver Target Context Support', () => {
    it('should resolve target source when target is in runtime context', () => {
      const node = { type: 'Source', kind: 'target' };
      const ctx = {
        actorEntity: { id: 'actor_001' },
        runtimeCtx: {
          target: {
            id: 'target_001',
            components: { 'core:actor': { name: 'Target NPC' } },
          },
        },
      };

      const result = sourceResolver.resolve(node, ctx);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('target_001')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('should return empty set when target source requested but no target in context', () => {
      const node = { type: 'Source', kind: 'target' };
      const ctx = {
        actorEntity: { id: 'actor_001' },
        runtimeCtx: {},
      };

      const result = sourceResolver.resolve(node, ctx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should resolve targets source when targets are in runtime context', () => {
      const node = { type: 'Source', kind: 'targets' };
      const ctx = {
        actorEntity: { id: 'actor_001' },
        runtimeCtx: {
          targets: {
            primary: [
              { id: 'target_001', components: {} },
              { id: 'target_002', components: {} },
            ],
            secondary: [{ id: 'npc_001', components: {} }],
          },
        },
      };

      const result = sourceResolver.resolve(node, ctx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      // The targets source returns the targets object itself, not individual IDs
      const targetsObj = Array.from(result)[0];
      expect(targetsObj).toBe(ctx.runtimeCtx.targets);
      expect(targetsObj.primary).toHaveLength(2);
      expect(targetsObj.secondary).toHaveLength(1);
    });

    it('should return empty set when targets source requested but no targets in context', () => {
      const node = { type: 'Source', kind: 'targets' };
      const ctx = {
        actorEntity: { id: 'actor_001' },
        runtimeCtx: {},
      };

      const result = sourceResolver.resolve(node, ctx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should handle targets with non-array values gracefully', () => {
      const node = { type: 'Source', kind: 'targets' };
      const ctx = {
        actorEntity: { id: 'actor_001' },
        runtimeCtx: {
          targets: {
            primary: [{ id: 'target_001', components: {} }],
            invalid: 'not-an-array',
            secondary: null,
          },
        },
      };

      const result = sourceResolver.resolve(node, ctx);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      // The targets source returns the targets object itself
      const targetsObj = Array.from(result)[0];
      expect(targetsObj).toBe(ctx.runtimeCtx.targets);
      expect(targetsObj.primary).toHaveLength(1);
      expect(targetsObj.invalid).toBe('not-an-array');
      expect(targetsObj.secondary).toBeNull();
    });
  });

  describe('Filter Resolver Target Context Support', () => {
    it('should pass runtime context to createEvaluationContext for array elements', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [{ var: 'target.id' }, 'target_001'] },
      };
      const ctx = {
        actorEntity: { id: 'actor_001', components: {} },
        runtimeCtx: {
          target: {
            id: 'target_001',
            components: { 'core:actor': { name: 'Target NPC' } },
          },
        },
        dispatcher: {
          resolve: jest.fn(() => new Set([['item_001', 'item_002']])),
        },
      };

      mockGateway.getEntityInstance.mockImplementation((id) => {
        if (id === 'item_001') return { id: 'item_001', components: {} };
        if (id === 'item_002') return { id: 'item_002', components: {} };
        return null;
      });

      mockLogicEval.evaluate.mockReturnValue(true);

      const result = filterResolver.resolve(node, ctx);

      expect(mockLogicEval.evaluate).toHaveBeenCalled();
      // Verify the evaluation context included target
      const evaluationContext = mockLogicEval.evaluate.mock.calls[0][1];
      expect(evaluationContext).toHaveProperty('target');
      expect(evaluationContext.target.id).toBe('target_001');
    });

    it('should pass runtime context to createEvaluationContext for single items', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [{ var: 'target.id' }, 'target_001'] },
      };
      const ctx = {
        actorEntity: { id: 'actor_001', components: {} },
        runtimeCtx: {
          target: {
            id: 'target_001',
            components: { 'core:actor': { name: 'Target NPC' } },
          },
        },
        dispatcher: {
          resolve: jest.fn(() => new Set(['item_001'])),
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'item_001',
        components: {},
      });

      mockLogicEval.evaluate.mockReturnValue(true);

      const result = filterResolver.resolve(node, ctx);

      expect(mockLogicEval.evaluate).toHaveBeenCalled();
      // Verify the evaluation context included target
      const evaluationContext = mockLogicEval.evaluate.mock.calls[0][1];
      expect(evaluationContext).toHaveProperty('target');
      expect(evaluationContext.target.id).toBe('target_001');
    });

    it('should work without runtime context for backward compatibility', () => {
      const node = {
        type: 'Filter',
        parent: { type: 'Source' },
        logic: { '==': [{ var: 'entity.id' }, 'item_001'] },
      };
      const ctx = {
        actorEntity: { id: 'actor_001', components: {} },
        dispatcher: {
          resolve: jest.fn(() => new Set(['item_001'])),
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'item_001',
        components: {},
      });

      mockLogicEval.evaluate.mockReturnValue(true);

      const result = filterResolver.resolve(node, ctx);

      expect(mockLogicEval.evaluate).toHaveBeenCalled();
      // Verify the evaluation context does not have target
      const evaluationContext = mockLogicEval.evaluate.mock.calls[0][1];
      expect(evaluationContext).not.toHaveProperty('target');
      expect(evaluationContext).not.toHaveProperty('targets');
    });
  });

  describe('JSON Logic Integration with Target Context', () => {
    it('should enable JSON Logic to access target properties', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:stats': { strength: 10 } },
      };
      const runtimeContext = {
        target: {
          id: 'chest_001',
          components: {
            'core:container': { locked: true, difficulty: 5 },
          },
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { type: 'key' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      // Test that JSON Logic can access nested target properties
      expect(result.target.components['core:container'].difficulty).toBe(5);
      expect(result.actor.components['core:stats'].strength).toBe(10);
    });

    it('should enable JSON Logic to access targets array properties', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };
      const runtimeContext = {
        targets: {
          primary: [
            {
              id: 'item_001',
              components: { 'core:item': { type: 'weapon', value: 100 } },
            },
            {
              id: 'item_002',
              components: { 'core:item': { type: 'potion', value: 50 } },
            },
          ],
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      // Test that JSON Logic can access targets structure
      expect(result.targets.primary).toHaveLength(2);
      expect(result.targets.primary[0].components['core:item'].type).toBe(
        'weapon'
      );
      expect(result.targets.primary[1].components['core:item'].value).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing runtime context gracefully', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      expect(() => {
        createEvaluationContext(
          item,
          actorEntity,
          mockGateway,
          mockLocationProvider,
          null,
          null
        );
      }).not.toThrow();
    });

    it('should handle invalid target context gracefully', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };
      const runtimeContext = {
        target: null, // Invalid target
        targets: undefined, // Invalid targets
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );

      expect(result).not.toHaveProperty('target');
      expect(result).not.toHaveProperty('targets');
    });
  });

  describe('Performance Considerations', () => {
    it('should not significantly impact performance when runtime context is not provided', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        createEvaluationContext(
          item,
          actorEntity,
          mockGateway,
          mockLocationProvider,
          null
        );
      }
      const end = performance.now();
      const avgTime = (end - start) / 100;

      expect(avgTime).toBeLessThan(1); // Should be very fast
    });

    it('should handle large targets arrays efficiently', () => {
      const item = 'test_item';
      const actorEntity = {
        id: 'actor_001',
        components: { 'core:actor': { name: 'Player' } },
      };

      // Create large targets array
      const largeTargetsArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `target_${i}`,
        components: { 'core:item': { value: i } },
      }));

      const runtimeContext = {
        targets: {
          primary: largeTargetsArray,
        },
      };

      mockGateway.getEntityInstance.mockReturnValue({
        id: 'test_item',
        components: { 'core:item': { name: 'Test Item' } },
      });

      const start = performance.now();
      const result = createEvaluationContext(
        item,
        actorEntity,
        mockGateway,
        mockLocationProvider,
        null,
        runtimeContext
      );
      const end = performance.now();

      expect(result.targets.primary).toHaveLength(1000);
      expect(end - start).toBeLessThan(10); // Should handle large arrays efficiently
    });
  });
});
