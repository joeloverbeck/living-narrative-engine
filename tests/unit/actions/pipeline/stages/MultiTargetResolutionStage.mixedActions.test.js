/**
 * @file Focused test to reproduce the multi-target action bug when mixed with legacy actions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

describe('MultiTargetResolutionStage - Mixed Actions Bug', () => {
  let stage;
  let mockDeps;
  let mockActor;
  let mockActionContext;

  beforeEach(() => {
    // Mock dependencies
    mockDeps = {
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

    stage = new MultiTargetResolutionStage(mockDeps);

    mockActor = {
      id: 'actor1',
      getComponent: jest.fn(),
    };

    mockActionContext = {
      location: { id: 'room1' },
    };
  });

  it('should pass resolvedTargets even when mixed with legacy actions (BUG FIX)', async () => {
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
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        targets: {
          primary: {
            scope:
              'intimacy:close_actors_facing_each_other_with_torso_clothing',
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

    // Mock for legacy action
    mockDeps.targetResolver.resolveTargets.mockResolvedValueOnce({
      success: true,
      value: [{ entityId: 'target1', displayName: 'Target 1' }],
    });
    mockDeps.entityManager.getEntityInstance.mockReturnValueOnce({
      id: 'target1',
      components: {},
    });

    // Mock for multi-target action
    mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
    });

    mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
      primary: { id: 'person1', components: {} },
    });

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

    // THE FIX: Now resolvedTargets and targetDefinitions SHOULD be passed
    // even when there's a mix of legacy and multi-target actions
    // This allows adjust_clothing to be properly formatted in ActionFormattingStage

    // After the fix, these should be defined:
    expect(result.data.resolvedTargets).toBeDefined();
    expect(result.data.targetDefinitions).toBeDefined();

    // This allows the ActionFormattingStage to properly handle multi-target actions
    // mixed with legacy actions
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

    mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
      actor: { id: 'actor1', components: {} },
      location: { id: 'room1', components: {} },
      game: { turnNumber: 1 },
    });

    mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
      ActionResult.success(new Set(['entity1']))
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
});
