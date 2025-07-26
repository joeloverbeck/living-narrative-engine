import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

describe('MultiTargetResolutionStage', () => {
  let stage;
  let mockDeps;
  let mockContext;

  beforeEach(() => {
    // Create mock dependencies
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

    // Create stage instance
    stage = new MultiTargetResolutionStage(mockDeps);

    // Create mock context
    mockContext = {
      candidateActions: [],
      actor: {
        id: 'player',
        getComponent: jest.fn(),
      },
      actionContext: {
        location: { id: 'room' },
      },
      data: {},
    };
  });

  describe('Legacy Action Support', () => {
    it('should handle string targets property', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:valid_targets',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        components: {},
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(actionDef);
      // Legacy actions store resolvedTargets in the action
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toEqual([
        {
          entityId: 'target1',
          displayName: 'Target 1',
          placeholder: undefined,
        },
      ]);
    });

    it('should handle legacy scope property', async () => {
      const actionDef = {
        id: 'test:legacy',
        scope: 'test:valid_targets', // Old property
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        components: {},
      });

      const result = await stage.executeInternal(mockContext);

      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:valid_targets',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy'
      );
      expect(result.success).toBe(true);
    });

    it('should handle legacy action with no targets', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:empty_scope',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // The stage itself doesn't set continueProcessing to false
      expect(result.continueProcessing).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
    });
  });

  describe('Multi-Target Resolution', () => {
    it('should resolve single primary target', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1', 'item2']))
      );

      mockDeps.entityManager.getEntityInstance
        .mockReturnValueOnce({ id: 'item1', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item2', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item1', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item2', getComponent: jest.fn() });

      mockDeps.entityManager.getEntity
        .mockReturnValueOnce({ id: 'item1', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item2', getComponent: jest.fn() });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      // Check that action has the expected structure
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.actionDef).toBe(actionDef);
      expect(actionWithTargets.targetContexts).toHaveLength(2);
      expect(actionWithTargets.targetContexts[0]).toEqual({
        entityId: 'item1',
        displayName: 'item1',
        placeholder: 'item',
      });
      expect(actionWithTargets.targetContexts[1]).toEqual({
        entityId: 'item2',
        displayName: 'item2',
        placeholder: 'item',
      });
    });

    it('should resolve dependent targets with context', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'test:target_items',
            placeholder: 'item',
            contextFrom: 'primary',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      // Setup base context
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue(
        baseContext
      );

      // First resolution (primary)
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1'])))
        .mockResolvedValueOnce(
          ActionResult.success(new Set(['item1', 'item2']))
        );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
      });

      // Setup dependent context
      const dependentContext = {
        ...baseContext,
        target: { id: 'npc1', components: {} },
        targets: {
          primary: [{ id: 'npc1', components: {} }],
        },
      };
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue(
        dependentContext
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(
        mockDeps.targetContextBuilder.buildDependentContext
      ).toHaveBeenCalledWith(
        baseContext,
        expect.objectContaining({
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'npc1' }),
          ]),
        }),
        actionDef.targets.secondary
      );
    });

    it('should handle optional targets', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:required',
            placeholder: 'main',
          },
          secondary: {
            scope: 'test:optional',
            placeholder: 'extra',
            optional: true,
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // Primary resolves successfully
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['target1'])))
        .mockResolvedValueOnce(ActionResult.success(new Set())); // Empty for optional

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0].entityId).toBe('target1');
    });

    it('should skip when required target has no candidates', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // No candidates found
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set())
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // The stage returns the empty array, not setting continueProcessing
      expect(result.continueProcessing).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
    });

    it('should handle all optional targets with no matches', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:optional1',
            placeholder: 'opt1',
            optional: true,
          },
          secondary: {
            scope: 'test:optional2',
            placeholder: 'opt2',
            optional: true,
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set())
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.continueProcessing).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
    });
  });

  describe('Resolution Order', () => {
    it('should resolve targets in dependency order', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          secondary: {
            scope: 'test:dependent',
            placeholder: 'dep',
            contextFrom: 'primary',
          },
          primary: {
            scope: 'test:base',
            placeholder: 'base',
          },
          tertiary: {
            scope: 'test:final',
            placeholder: 'final',
            contextFrom: 'secondary',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      const evaluationOrder = [];
      mockDeps.unifiedScopeResolver.resolve.mockImplementation((scope) => {
        evaluationOrder.push(scope);
        return ActionResult.success(new Set(['dummy']));
      });

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});
      mockDeps.entityManager.getEntityInstance.mockReturnValue({ id: 'dummy' });

      await stage.executeInternal(mockContext);

      expect(evaluationOrder).toEqual([
        'test:base', // primary first (no deps)
        'test:dependent', // secondary next (depends on primary)
        'test:final', // tertiary last (depends on secondary)
      ]);
    });

    it('should detect circular dependencies', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:a',
            placeholder: 'a',
            contextFrom: 'secondary',
          },
          secondary: {
            scope: 'test:b',
            placeholder: 'b',
            contextFrom: 'primary',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true); // Stage succeeds
      expect(result.data.actionsWithTargets).toEqual([]); // No actions due to circular dependency
      // When circular dependency is detected, the method returns a failure result,
      // but the stage continues and returns success with empty actions
    });
  });

  describe('Error Handling', () => {
    it('should handle scope evaluation errors gracefully', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:invalid',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.failure({
          error: 'Invalid scope syntax',
          phase: 'resolution',
        })
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.continueProcessing).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    it('should handle missing entity gracefully', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['valid_id', 'missing_id']))
      );

      // Mock getEntityInstance to return entity for valid_id but null for missing_id
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'valid_id')
          return { id: 'valid_id', getComponent: jest.fn() };
        if (id === 'missing_id') return null;
        return null;
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toHaveLength(1);
      expect(actionWithTargets.targetContexts[0].entityId).toBe('valid_id');
    });

    it('should handle invalid targets configuration', async () => {
      const actionDef = {
        id: 'test:action',
        targets: null,
      };
      mockContext.candidateActions = [actionDef];

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true); // Stage succeeds
      expect(result.data.actionsWithTargets).toEqual([]);
      // When targets configuration is invalid, the method returns a failure result,
      // but the stage continues and returns success with empty actions
    });

    it('should display names from various component sources', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(
          new Set(['entity1', 'entity2', 'entity3', 'entity4'])
        )
      );

      // Mock different component name sources
      const mockEntity1 = {
        id: 'entity1',
        getComponent: jest.fn((comp) => {
          if (comp === 'core:description') return { name: 'Description Name' };
          return null;
        }),
      };

      const mockEntity2 = {
        id: 'entity2',
        getComponent: jest.fn((comp) => {
          if (comp === 'core:actor') return { name: 'Actor Name' };
          return null;
        }),
      };

      const mockEntity3 = {
        id: 'entity3',
        getComponent: jest.fn((comp) => {
          if (comp === 'core:item') return { name: 'Item Name' };
          return null;
        }),
      };

      const mockEntity4 = {
        id: 'entity4',
        getComponent: jest.fn(() => null), // No name components
      };

      // Setup entity manager to return the correct entity for each ID
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        switch (id) {
          case 'entity1':
            return mockEntity1;
          case 'entity2':
            return mockEntity2;
          case 'entity3':
            return mockEntity3;
          case 'entity4':
            return mockEntity4;
          default:
            return null;
        }
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts[0].displayName).toBe(
        'Description Name'
      );
      expect(actionWithTargets.targetContexts[1].displayName).toBe(
        'Actor Name'
      );
      expect(actionWithTargets.targetContexts[2].displayName).toBe('Item Name');
      expect(actionWithTargets.targetContexts[3].displayName).toBe('entity4'); // Falls back to ID
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain targetContexts for backward compatibility', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity1', 'entity2']))
      );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Check that the action has targetContexts for backward compatibility
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toBeDefined();
      expect(actionWithTargets.targetContexts).toHaveLength(2);
      expect(actionWithTargets.targetContexts[0]).toHaveProperty('entityId');
      expect(actionWithTargets.targetContexts[0]).toHaveProperty('displayName');
      expect(actionWithTargets.targetContexts[0]).toHaveProperty('placeholder');
    });
  });

  describe('Multiple Candidate Actions', () => {
    it('should process multiple candidate actions', async () => {
      const action1 = {
        id: 'test:action1',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      const action2 = {
        id: 'test:action2',
        targets: 'test:legacy_scope', // Legacy format
      };
      const action3 = {
        id: 'test:action3',
        targets: {
          primary: {
            scope: 'test:actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'test:items',
            placeholder: 'item',
            optional: true,
          },
        },
      };
      mockContext.candidateActions = [action1, action2, action3];

      // Setup for action1
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['item1']))) // action1
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1']))) // action3 primary
        .mockResolvedValueOnce(ActionResult.success(new Set(['item2']))); // action3 secondary

      // Setup for action2 (legacy)
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(3);

      // Verify each action was processed
      expect(result.data.actionsWithTargets[0].actionDef).toBe(action1);
      expect(result.data.actionsWithTargets[1].actionDef).toBe(action2);
      expect(result.data.actionsWithTargets[2].actionDef).toBe(action3);
    });

    it('should handle null actions in candidateActions array', async () => {
      const validAction = {
        id: 'test:valid',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      // Test with an object without id to trigger error, not null
      const invalidAction = { targets: 'test:scope' }; // Missing id
      mockContext.candidateActions = [invalidAction, validAction];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'item1',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Invalid action causes error when accessing undefined id
      expect(result.errors).toHaveLength(1);
      expect(mockDeps.logger.error).toHaveBeenCalled();
      // Only the valid action should be processed
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(validAction);
    });

    it('should collect errors from individual actions', async () => {
      const action1 = {
        id: 'test:action1',
        targets: null, // Will cause error
      };
      const action2 = {
        id: 'test:action2',
        targets: {
          primary: {
            scope: 'test:valid',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [action1, action2];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'item1',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Invalid targets configuration returns a failure result, not an exception
      // So it won't be in the errors array
      expect(result.errors).toHaveLength(0);
      // Both actions fail validation, so no actions are returned
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(action2);
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should handle actions with "none" scope', async () => {
      const actionDef = {
        id: 'test:no_target',
        targets: 'none',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Actions with 'none' scope should still be included
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef).toBe(actionDef);
    });

    it('should handle trace context throughout execution', async () => {
      const mockTrace = {
        step: jest.fn(),
        info: jest.fn(),
        failure: jest.fn(),
        success: jest.fn(),
      };
      mockContext.trace = mockTrace;

      const actionDef = {
        id: 'test:traced',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'item1',
        getComponent: jest.fn(),
      });

      await stage.executeInternal(mockContext);

      expect(mockTrace.step).toHaveBeenCalledWith(
        expect.stringContaining('Resolving targets for 1 candidate actions'),
        'MultiTargetResolutionStage'
      );
      expect(mockTrace.info).toHaveBeenCalledWith(
        expect.stringContaining('Target resolution completed'),
        'MultiTargetResolutionStage'
      );
    });

    it('should handle complex dependency chains', async () => {
      const actionDef = {
        id: 'test:complex',
        targets: {
          a: { scope: 'test:a', placeholder: 'a' },
          b: { scope: 'test:b', placeholder: 'b', contextFrom: 'a' },
          c: { scope: 'test:c', placeholder: 'c', contextFrom: 'b' },
          d: { scope: 'test:d', placeholder: 'd', contextFrom: 'c' },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      // Verify buildDependentContext was called 3 times (for b, c, d)
      expect(
        mockDeps.targetContextBuilder.buildDependentContext
      ).toHaveBeenCalledTimes(3);
    });
  });
});
