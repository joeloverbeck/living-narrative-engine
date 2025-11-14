/**
 * @file Tests to verify correct behavior when mixing legacy and multi-target actions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';

describe('MultiTargetResolutionStage - Mixed Actions Behavior', () => {
  let stage;
  let mockDeps;
  let mockActor;
  let mockActionContext;

  beforeEach(() => {
    // Mock dependencies
    mockDeps = {
      targetDependencyResolver: {
        getResolutionOrder: jest.fn(),
      },
      legacyTargetCompatibilityLayer: {
        isLegacyAction: jest.fn(),
        convertLegacyFormat: jest.fn(),
        getMigrationSuggestion: jest.fn(),
      },
      scopeContextBuilder: {
        buildScopeContext: jest.fn(),
        buildScopeContextForSpecificPrimary: jest.fn(),
      },
      targetDisplayNameResolver: {
        getEntityDisplayName: jest.fn(),
      },
      unifiedScopeResolver: {
        resolve: jest.fn(),
      },
      entityManager: {
        getEntity: jest.fn(),
        getEntityInstance: jest.fn(),
      },
      targetResolver: {
        resolveTargets: jest.fn(),
      },
      targetContextBuilder: {
        buildBaseContext: jest.fn(),
        buildDependentContext: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    mockDeps.tracingOrchestrator = new TargetResolutionTracingOrchestrator({
      logger: mockDeps.logger,
    });

    stage = new MultiTargetResolutionStage({
      targetDependencyResolver: mockDeps.targetDependencyResolver,
      legacyTargetCompatibilityLayer: mockDeps.legacyTargetCompatibilityLayer,
      scopeContextBuilder: mockDeps.scopeContextBuilder,
      targetDisplayNameResolver: mockDeps.targetDisplayNameResolver,
      unifiedScopeResolver: mockDeps.unifiedScopeResolver,
      entityManager: mockDeps.entityManager,
      targetResolver: mockDeps.targetResolver,
      targetContextBuilder: mockDeps.targetContextBuilder,
      logger: mockDeps.logger,
      tracingOrchestrator: mockDeps.tracingOrchestrator,
    });

    mockActor = {
      id: 'actor1',
      getComponent: jest.fn(),
    };

    mockActionContext = {
      location: { id: 'room1' },
    };
  });

  it('should pass resolvedTargets/targetDefinitions even when mixed with legacy actions (fixed behavior)', async () => {
    // Create a mix of legacy and multi-target actions
    const candidateActions = [
      // Legacy action
      {
        id: 'legacy:action1',
        name: 'Legacy Action',
        targets: 'core:actors_in_location', // string = legacy format
        template: 'do something with {target}',
      },
      // Multi-target action (like adjust_clothing)
      {
        id: 'caressing:adjust_clothing',
        name: 'Adjust Clothing',
        targets: {
          primary: {
            scope:
              'caressing:close_actors_facing_each_other_with_torso_clothing',
            placeholder: 'primary',
            description: 'Person whose clothing to adjust',
          },
          secondary: {
            scope: 'clothing:target_topmost_torso_upper_clothing',
            placeholder: 'secondary',
            description: 'Specific garment to adjust',
            contextFrom: 'primary',
          },
        },
        template: "adjust {primary}'s {secondary}",
      },
    ];

    const context = {
      candidateActions,
      actor: mockActor,
      actionContext: mockActionContext,
      data: {},
    };

    // Mock setup for legacy action detection and conversion
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      true
    );
    // convertLegacyFormat is called twice for legacy actions (once in main loop, once in #resolveLegacyTarget)
    mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat
      .mockReturnValueOnce({
        targetDefinitions: {
          primary: { scope: 'core:actors_in_location', placeholder: 'target' },
        },
      })
      .mockReturnValueOnce({
        targetDefinitions: {
          primary: { scope: 'core:actors_in_location', placeholder: 'target' },
        },
      });

    // Mock for legacy action - return proper target context structure
    mockDeps.targetResolver.resolveTargets.mockResolvedValueOnce({
      success: true,
      value: [
        {
          type: 'entity',
          entityId: 'target1',
          displayName: 'Target 1',
          placeholder: 'target',
        },
      ],
    });
    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'target1',
      components: {},
    });
    mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValueOnce(
      'Target 1'
    );

    // Mock setup for multi-target action detection and resolution order
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValueOnce([
      'primary',
      'secondary',
    ]);

    // Mock for multi-target action scope context building
    mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
    });

    mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
      {
        actor: { id: 'actor1', components: {} },
        location: { id: 'room1', components: {} },
        game: { turnNumber: 1 },
        primary: { id: 'person1', components: {} },
      }
    );

    // Primary target - valid target found
    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['person1']))
    );

    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'person1',
      getComponent: jest.fn(),
      getComponentData: jest.fn().mockReturnValue({ text: 'Person 1' }),
    });

    mockDeps.entityManager.getEntity.mockReturnValueOnce({
      id: 'person1',
      getComponent: jest.fn(),
    });

    // Secondary target - valid clothing found
    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['clothing1']))
    );

    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'clothing1',
      getComponent: jest.fn(),
      getComponentData: jest.fn().mockReturnValue({ text: 'Clothing 1' }),
    });

    mockDeps.entityManager.getEntity.mockReturnValueOnce({
      id: 'clothing1',
      getComponent: jest.fn(),
    });

    // Additional mocks for getEntityDisplayName calls
    mockDeps.targetDisplayNameResolver.getEntityDisplayName
      .mockReturnValueOnce('Person 1')
      .mockReturnValueOnce('Clothing 1');

    mockDeps.entityManager.getEntityInstance
      .mockReturnValueOnce({
        id: 'person1',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue({ text: 'Person 1' }),
      })
      .mockReturnValueOnce({
        id: 'clothing1',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue({ text: 'Clothing 1' }),
      });

    // Execute the stage
    const result = await stage.executeInternal(context);

    // Verify the result
    expect(result).toBeInstanceOf(PipelineResult);
    expect(result.success).toBe(true);

    // With the fix, global metadata is now passed even when mixing legacy and multi-target actions
    // This is backward compatible since each action also has its own metadata
    expect(result.data.resolvedTargets).toBeDefined();
    expect(result.data.targetDefinitions).toBeDefined();

    // However, the actionsWithTargets should still contain both action types
    expect(result.data.actionsWithTargets).toHaveLength(2);

    // Verify both legacy and multi-target actions are included
    const actionIds = result.data.actionsWithTargets.map(
      ({ actionDef }) => actionDef.id
    );
    expect(actionIds).toContain('legacy:action1');
    expect(actionIds).toContain('caressing:adjust_clothing');
  });

  it('should work correctly when ALL actions are multi-target (current working case)', async () => {
    // Only multi-target actions
    const candidateActions = [
      {
        id: 'multi:action1',
        name: 'Multi Action 1',
        targets: {
          primary: { scope: 'scope1', placeholder: 'primary' },
        },
        template: '{primary}',
      },
    ];

    const context = {
      candidateActions,
      actor: mockActor,
      actionContext: mockActionContext,
      data: {},
    };

    // Mock setup for multi-target action
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValueOnce([
      'primary',
    ]);

    mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
    });

    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['entity1']))
    );

    mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValueOnce(
      'Entity 1'
    );

    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'entity1',
      getComponent: jest.fn(),
    });

    mockDeps.entityManager.getEntity.mockReturnValueOnce({
      id: 'entity1',
      getComponent: jest.fn(),
    });

    const result = await stage.executeInternal(context);

    // This case works correctly - resolvedTargets and targetDefinitions ARE passed
    expect(result.data.resolvedTargets).toBeDefined();
    expect(result.data.targetDefinitions).toBeDefined();
  });

  it('should properly resolve multi-target actions even when mixed with legacy actions', async () => {
    // This test verifies that multi-target actions still function correctly
    // when mixed with legacy actions, even without the optimized formatting
    const candidateActions = [
      // Legacy action first
      {
        id: 'legacy:simple',
        name: 'Simple Legacy',
        targets: 'none',
        template: 'do simple thing',
      },
      // Multi-target action with dependent targets
      {
        id: 'multi:dependent',
        name: 'Multi Dependent',
        targets: {
          primary: {
            scope: 'core:actors_in_location',
            placeholder: 'actor',
          },
          item: {
            scope: 'core:items_in_location',
            placeholder: 'item',
            contextFrom: 'primary',
          },
        },
        template: '{actor} uses {item}',
      },
    ];

    const context = {
      candidateActions,
      actor: mockActor,
      actionContext: mockActionContext,
      data: {},
    };

    // Mock setup for legacy action (none scope)
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      true
    );
    // convertLegacyFormat is called twice for legacy actions (once in main loop, once in #resolveLegacyTarget)
    mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat
      .mockReturnValueOnce({
        targetDefinitions: {
          primary: { scope: 'none', placeholder: 'target' },
        },
      })
      .mockReturnValueOnce({
        targetDefinitions: {
          primary: { scope: 'none', placeholder: 'target' },
        },
      });
    // For 'none' scope, targetResolver returns empty array but action should still be included
    mockDeps.targetResolver.resolveTargets.mockResolvedValueOnce({
      success: true,
      value: [], // Empty array is valid for 'none' scope
    });

    // Mock setup for multi-target action
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValueOnce([
      'primary',
      'item',
    ]);

    mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
    });

    // Primary target resolution
    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['actor2']))
    );

    mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValueOnce(
      'Other Actor'
    );

    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'actor2',
      getComponent: jest.fn(),
      getComponentData: jest.fn().mockReturnValue({ text: 'Other Actor' }),
    });

    mockDeps.entityManager.getEntity.mockReturnValueOnce({
      id: 'actor2',
      getComponent: jest.fn(),
    });

    // Dependent context building
    mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
      {
        actor: { id: 'actor1', components: {} },
        location: { id: 'room1', components: {} },
        game: { turnNumber: 1 },
        primary: { id: 'actor2', components: {} },
      }
    );

    // Item target resolution (dependent on primary)
    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['item1']))
    );

    mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValueOnce(
      'Magic Item'
    );

    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'item1',
      getComponent: jest.fn(),
      getComponentData: jest.fn().mockReturnValue({ text: 'Magic Item' }),
    });

    mockDeps.entityManager.getEntity.mockReturnValueOnce({
      id: 'item1',
      getComponent: jest.fn(),
    });

    // Additional mocks for display name lookups
    mockDeps.targetDisplayNameResolver.getEntityDisplayName
      .mockReturnValueOnce('Other Actor')
      .mockReturnValueOnce('Magic Item');

    mockDeps.entityManager.getEntityInstance
      .mockReturnValueOnce({
        id: 'actor2',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue({ text: 'Other Actor' }),
      })
      .mockReturnValueOnce({
        id: 'item1',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue({ text: 'Magic Item' }),
      });

    const result = await stage.executeInternal(context);

    // Verify success
    expect(result.success).toBe(true);

    // With the fix, global metadata is now passed even when mixing legacy and multi-target actions
    expect(result.data.resolvedTargets).toBeDefined();
    expect(result.data.targetDefinitions).toBeDefined();

    // Both actions should be in actionsWithTargets
    expect(result.data.actionsWithTargets).toHaveLength(2);

    // Find the multi-target action result
    const multiTargetAction = result.data.actionsWithTargets.find(
      ({ actionDef }) => actionDef.id === 'multi:dependent'
    );

    expect(multiTargetAction).toBeDefined();
    expect(multiTargetAction.targetContexts).toBeDefined();

    // Verify the multi-target action has properly resolved targets
    // Should have 2 target contexts (primary actor and dependent item)
    expect(multiTargetAction.targetContexts).toHaveLength(2);

    // Verify target context details
    const targetIds = multiTargetAction.targetContexts.map((tc) => tc.entityId);
    expect(targetIds).toContain('actor2');
    expect(targetIds).toContain('item1');

    // Verify placeholders are set correctly
    const actorContext = multiTargetAction.targetContexts.find(
      (tc) => tc.entityId === 'actor2'
    );
    const itemContext = multiTargetAction.targetContexts.find(
      (tc) => tc.entityId === 'item1'
    );

    expect(actorContext.placeholder).toBe('actor');
    expect(itemContext.placeholder).toBe('item');
  });
});
