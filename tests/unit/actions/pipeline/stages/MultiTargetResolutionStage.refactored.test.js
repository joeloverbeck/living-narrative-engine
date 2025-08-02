/**
 * @file MultiTargetResolutionStage.refactored.test.js
 * Tests for the refactored MultiTargetResolutionStage with service delegation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';

describe('MultiTargetResolutionStage - Refactored with Services', () => {
  let stage;
  let mockDependencyResolver;
  let mockLegacyLayer;
  let mockContextBuilder;
  let mockNameResolver;
  let mockUnifiedScopeResolver;
  let mockEntityManager;
  let mockTargetResolver;
  let mockLogger;

  beforeEach(() => {
    // Create mock services
    mockDependencyResolver = {
      getResolutionOrder: jest.fn(),
    };

    mockLegacyLayer = {
      isLegacyAction: jest.fn(),
      convertLegacyFormat: jest.fn(),
    };

    mockContextBuilder = {
      buildScopeContext: jest.fn(),
      buildScopeContextForSpecificPrimary: jest.fn(),
    };

    mockNameResolver = {
      getEntityDisplayName: jest.fn(),
    };

    mockUnifiedScopeResolver = {
      resolve: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockTargetResolver = {
      resolveTargets: jest.fn(),
    };

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    // Create stage with mocked services
    stage = new MultiTargetResolutionStage({
      targetDependencyResolver: mockDependencyResolver,
      legacyTargetCompatibilityLayer: mockLegacyLayer,
      scopeContextBuilder: mockContextBuilder,
      targetDisplayNameResolver: mockNameResolver,
      unifiedScopeResolver: mockUnifiedScopeResolver,
      entityManager: mockEntityManager,
      targetResolver: mockTargetResolver,
      targetContextBuilder: {}, // Not used directly in refactored version
      logger: mockLogger,
    });
  });

  describe('Service Integration', () => {
    it('should use LegacyTargetCompatibilityLayer to detect legacy actions', async () => {
      const actionDef = { id: 'test-action', targets: 'actor.partners' };
      const actor = { id: 'actor-1' };
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(true);
      mockLegacyLayer.convertLegacyFormat.mockReturnValue({
        isLegacy: true,
        targetDefinitions: {
          primary: { scope: 'actor.partners', placeholder: 'partner' },
        },
      });
      mockTargetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      await stage.execute(context);

      expect(mockLegacyLayer.isLegacyAction).toHaveBeenCalledWith(actionDef);
    });

    it('should use TargetDependencyResolver for multi-target resolution order', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
        secondary: {
          scope: 'primary.items',
          placeholder: 'item',
          contextFrom: 'primary',
        },
      };
      const actionDef = { id: 'test-action', targets: targetDefs };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);
      mockContextBuilder.buildScopeContext.mockReturnValue({});
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['entity-1']),
      });
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-1' });
      mockNameResolver.getEntityDisplayName.mockReturnValue('Entity 1');

      await stage.execute(context);

      expect(mockDependencyResolver.getResolutionOrder).toHaveBeenCalledWith(
        targetDefs
      );
    });

    it('should use ScopeContextBuilder for context creation', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
      };
      const actionDef = { id: 'test-action', targets: targetDefs };
      const actor = { id: 'actor-1' };
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: { location: { id: 'loc-1' } },
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);
      mockContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'actor-1' },
      });
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['entity-1']),
      });
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-1' });
      mockNameResolver.getEntityDisplayName.mockReturnValue('Entity 1');

      await stage.execute(context);

      expect(mockContextBuilder.buildScopeContext).toHaveBeenCalledWith(
        actor,
        context.actionContext,
        expect.any(Object), // resolvedTargets object being built up
        targetDefs.primary,
        undefined // trace
      );
    });

    it('should use TargetDisplayNameResolver for entity display names', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
      };
      const actionDef = { id: 'test-action', targets: targetDefs };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);
      mockContextBuilder.buildScopeContext.mockReturnValue({});
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['entity-1']),
      });
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-1' });
      mockNameResolver.getEntityDisplayName.mockReturnValue('Custom Name');

      const result = await stage.execute(context);

      expect(mockNameResolver.getEntityDisplayName).toHaveBeenCalledWith(
        'entity-1'
      );
      expect(
        result.data.actionsWithTargets[0].resolvedTargets.primary[0].displayName
      ).toBe('Custom Name');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain same output format for legacy actions', async () => {
      const actionDef = { id: 'legacy-action', targets: 'actor.partners' };
      const actor = { id: 'actor-1' };
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(true);
      mockLegacyLayer.convertLegacyFormat.mockReturnValue({
        isLegacy: true,
        targetDefinitions: {
          primary: { scope: 'actor.partners', placeholder: 'partner' },
        },
      });
      mockTargetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'partner-1', displayName: 'Partner 1' }],
      });
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'partner-1' });
      mockNameResolver.getEntityDisplayName.mockReturnValue('Partner 1');

      const result = await stage.execute(context);

      // Verify backward compatibility fields
      expect(result.data.targetContexts).toBeDefined();
      expect(result.data.actionsWithTargets[0].isMultiTarget).toBe(false);
      expect(result.data.actionsWithTargets[0].targetDefinitions).toBeDefined();
    });

    it('should maintain same output format for multi-target actions', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
      };
      const actionDef = { id: 'multi-action', targets: targetDefs };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);
      mockContextBuilder.buildScopeContext.mockReturnValue({});
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['partner-1']),
      });
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'partner-1' });
      mockNameResolver.getEntityDisplayName.mockReturnValue('Partner 1');

      const result = await stage.execute(context);

      // Verify multi-target specific fields
      expect(result.data.resolvedTargets).toBeDefined();
      expect(result.data.targetDefinitions).toBeDefined();
      expect(result.data.actionsWithTargets[0].isMultiTarget).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const actionDef = { id: 'test-action', targets: {} };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockImplementation(() => {
        throw new Error('Circular dependency detected');
      });

      const result = await stage.execute(context);

      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.data.actionsWithTargets).toEqual([]);
    });

    it('should handle missing entities gracefully', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
      };
      const actionDef = { id: 'test-action', targets: targetDefs };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);
      mockContextBuilder.buildScopeContext.mockReturnValue({});
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: new Set(['missing-entity']),
      });
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = await stage.execute(context);

      expect(result.success).toBe(true);
      // When entities are missing, the action has no targets and resolvedTargets won't be added
      expect(result.data.actionsWithTargets).toEqual([]);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle dependent targets with contextFrom', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
        items: {
          scope: 'target.items',
          placeholder: 'item',
          contextFrom: 'primary',
        },
      };
      const actionDef = { id: 'complex-action', targets: targetDefs };
      const actor = { id: 'actor-1' };
      const context = {
        candidateActions: [actionDef],
        actor,
        actionContext: {},
      };

      const mockPartner = { id: 'partner-1', displayName: 'Partner 1' };

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'items',
      ]);

      // First call for primary target
      mockContextBuilder.buildScopeContext.mockReturnValueOnce({
        actor: { id: 'actor-1' },
      });
      mockUnifiedScopeResolver.resolve.mockResolvedValueOnce({
        success: true,
        value: new Set(['partner-1']),
      });
      mockEntityManager.getEntityInstance.mockReturnValueOnce({
        id: 'partner-1',
      });
      mockNameResolver.getEntityDisplayName.mockReturnValueOnce('Partner 1');

      // Second call for dependent target
      mockContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValueOnce(
        {
          target: { id: 'partner-1' },
        }
      );
      mockUnifiedScopeResolver.resolve.mockResolvedValueOnce({
        success: true,
        value: new Set(['item-1', 'item-2']),
      });
      mockEntityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'item-1' })
        .mockReturnValueOnce({ id: 'item-2' });
      mockNameResolver.getEntityDisplayName
        .mockReturnValueOnce('Item 1')
        .mockReturnValueOnce('Item 2');

      const result = await stage.execute(context);

      expect(
        mockContextBuilder.buildScopeContextForSpecificPrimary
      ).toHaveBeenCalledWith(
        actor,
        context.actionContext,
        expect.objectContaining({
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'partner-1' }),
          ]),
        }), // The entire resolvedTargets object, which may contain other resolved targets
        expect.objectContaining({ id: 'partner-1' }),
        targetDefs.items,
        undefined // trace
      );

      expect(
        result.data.actionsWithTargets[0].resolvedTargets.items
      ).toHaveLength(2);
      expect(
        result.data.actionsWithTargets[0].resolvedTargets.items[0].contextFromId
      ).toBe('partner-1');
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time for large target sets', async () => {
      const targetDefs = {
        primary: { scope: 'actor.partners', placeholder: 'partner' },
      };
      const actionDef = { id: 'perf-test', targets: targetDefs };
      const context = {
        candidateActions: [actionDef],
        actor: { id: 'actor-1' },
        actionContext: {},
      };

      // Mock large result set
      const largeEntitySet = new Set();
      for (let i = 0; i < 1000; i++) {
        largeEntitySet.add(`entity-${i}`);
      }

      mockLegacyLayer.isLegacyAction.mockReturnValue(false);
      mockDependencyResolver.getResolutionOrder.mockReturnValue(['primary']);
      mockContextBuilder.buildScopeContext.mockReturnValue({});
      mockUnifiedScopeResolver.resolve.mockResolvedValue({
        success: true,
        value: largeEntitySet,
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));
      mockNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Name of ${id}`
      );

      const startTime = Date.now();
      const result = await stage.execute(context);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(
        result.data.actionsWithTargets[0].resolvedTargets.primary
      ).toHaveLength(1000);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
