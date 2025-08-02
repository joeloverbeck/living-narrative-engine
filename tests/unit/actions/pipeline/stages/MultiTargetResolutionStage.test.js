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
        type: 'entity',
        entityId: 'item1',
        displayName: 'item1',
        placeholder: 'item',
      });
      expect(actionWithTargets.targetContexts[1]).toEqual({
        type: 'entity',
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

      // Mock entity instances with proper structure
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'npc1') {
          return {
            id: 'npc1',
            getComponent: jest.fn(),
            getAllComponents: jest
              .fn()
              .mockReturnValue({ 'core:name': { value: 'NPC 1' } }),
          };
        }
        return {
          id,
          getComponent: jest.fn(),
        };
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // The new implementation doesn't call buildDependentContext for contextFrom targets
      // Instead, it resolves secondary targets per primary target
      expect(result.data.resolvedTargets.secondary).toHaveLength(2);
      expect(result.data.resolvedTargets.secondary[0].contextFromId).toBe(
        'npc1'
      );
      expect(result.data.resolvedTargets.secondary[1].contextFromId).toBe(
        'npc1'
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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});
      mockDeps.entityManager.getEntityInstance.mockReturnValue({ 
        id: 'dummy',
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      });

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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['valid_id', 'missing_id']))
      );

      // Mock getEntityInstance to return entity for valid_id but null for missing_id
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'valid_id')
          return { 
            id: 'valid_id', 
            getComponent: jest.fn(),
            getComponentData: jest.fn().mockReturnValue(null),
            getAllComponents: jest.fn().mockReturnValue({})
          };
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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(
          new Set(['entity1', 'entity2', 'entity3', 'entity4'])
        )
      );

      // Mock different component name sources
      const mockEntity1 = {
        id: 'entity1',
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:description') return { name: 'Description Name' };
          return null;
        }),
      };

      const mockEntity2 = {
        id: 'entity2',
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:actor') return { name: 'Actor Name' };
          return null;
        }),
      };

      const mockEntity3 = {
        id: 'entity3',
        getComponentData: jest.fn((comp) => {
          if (comp === 'core:item') return { name: 'Item Name' };
          return null;
        }),
      };

      const mockEntity4 = {
        id: 'entity4',
        getComponentData: jest.fn(() => null), // No name components
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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity1', 'entity2']))
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id: id,
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      }));

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Check that the action has targetContexts for backward compatibility
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.targetContexts).toBeDefined();
      expect(actionWithTargets.targetContexts).toHaveLength(2);
      expect(actionWithTargets.targetContexts[0]).toHaveProperty('type');
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
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['item1']))) // action1
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1']))) // action3 primary
        .mockResolvedValueOnce(ActionResult.success(new Set(['item2']))); // action3 secondary

      // Setup for action2 (legacy)
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id: id,
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      }));

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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id: id,
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      }));

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

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id: id,
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({})
      }));

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

  describe('Dependent Scope Resolution in MultiTargetResolutionStage', () => {
    describe('Basic Context Dependencies', () => {
      it('should resolve secondary target with primary context', async () => {
        // Define action with dependent targets
        const actionDef = {
          id: 'test:dependent_action',
          targets: {
            primary: {
              scope: 'location.npcs',
              placeholder: 'npc',
            },
            secondary: {
              scope: 'target.inventory.items',
              placeholder: 'item',
              contextFrom: 'primary',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock primary target resolution
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.success(new Set(['npc_001']))
        );

        // Mock entity data with proper structure for the new implementation
        mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'npc_001')
            return {
              id: 'npc_001',
              getComponent: jest.fn(),
              getAllComponents: jest.fn().mockReturnValue({
                'core:inventory': { items: ['item_001', 'item_002'] },
              }),
            };
          return {
            id,
            getComponent: jest.fn(),
            getAllComponents: jest.fn().mockReturnValue({}),
          };
        });

        // Mock context building for dependent resolution
        mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 },
        });

        // Mock secondary target resolution
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.success(new Set(['item_001', 'item_002']))
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // The new implementation builds specific primary context rather than using buildDependentContext
        expect(result.data.resolvedTargets.secondary).toHaveLength(2);
        expect(result.data.resolvedTargets.secondary[0].contextFromId).toBe(
          'npc_001'
        );
        expect(result.data.resolvedTargets.secondary[1].contextFromId).toBe(
          'npc_001'
        );
      });

      it('should handle missing primary target gracefully', async () => {
        const actionDef = {
          id: 'test:dependent_action',
          targets: {
            primary: {
              scope: 'location.npcs',
              placeholder: 'npc',
            },
            secondary: {
              scope: 'target.inventory.items',
              placeholder: 'item',
              contextFrom: 'primary',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock empty primary target resolution
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.success(new Set())
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.actionsWithTargets).toHaveLength(0);
      });
    });

    describe('Multi-Level Dependencies', () => {
      it('should resolve tertiary target with secondary context', async () => {
        const actionDef = {
          id: 'test:three_level_action',
          targets: {
            primary: {
              scope: 'actor.tools',
              placeholder: 'tool',
            },
            secondary: {
              scope: 'location.containers',
              placeholder: 'container',
              contextFrom: 'primary',
            },
            tertiary: {
              scope: 'target.contents.items',
              placeholder: 'item',
              contextFrom: 'secondary',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock resolutions in order
        mockDeps.unifiedScopeResolver.resolve
          .mockResolvedValueOnce(ActionResult.success(new Set(['tool_001'])))
          .mockResolvedValueOnce(
            ActionResult.success(new Set(['container_001']))
          )
          .mockResolvedValueOnce(
            ActionResult.success(new Set(['treasure_001', 'treasure_002']))
          );

        // Mock entity instances with proper structure for the new implementation
        mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
          switch (id) {
            case 'tool_001':
              return {
                id: 'tool_001',
                getComponent: jest.fn(),
                getAllComponents: jest.fn().mockReturnValue({}),
              };
            case 'container_001':
              return {
                id: 'container_001',
                getComponent: jest.fn(),
                getAllComponents: jest.fn().mockReturnValue({
                  'core:container': {
                    contents: { items: ['treasure_001', 'treasure_002'] },
                  },
                }),
              };
            default:
              return {
                id,
                getComponent: jest.fn(),
                getAllComponents: jest.fn().mockReturnValue({}),
              };
          }
        });

        // Mock context building
        mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 },
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.actionsWithTargets).toHaveLength(1);
        // The new implementation builds specific primary context for each contextFrom target
        expect(result.data.resolvedTargets.secondary[0].contextFromId).toBe(
          'tool_001'
        );
        expect(result.data.resolvedTargets.tertiary[0].contextFromId).toBe(
          'container_001'
        );
      });
    });

    describe('Complex Dependency Chains', () => {
      it('should handle deeply nested dependencies', async () => {
        // Note: The actual implementation supports up to 3-4 levels of dependencies
        // based on the resolution order algorithm
        const actionDef = {
          id: 'test:deep_chain',
          targets: {
            a: { scope: 'actor.factions', placeholder: 'faction' },
            b: {
              scope: 'game.guilds[faction]',
              placeholder: 'guild',
              contextFrom: 'a',
            },
            c: {
              scope: 'target.members',
              placeholder: 'member',
              contextFrom: 'b',
            },
            d: { scope: 'target.items', placeholder: 'item', contextFrom: 'c' },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock successful resolutions for each level
        mockDeps.unifiedScopeResolver.resolve
          .mockResolvedValueOnce(
            ActionResult.success(new Set(['faction_merchants']))
          )
          .mockResolvedValueOnce(ActionResult.success(new Set(['guild_001'])))
          .mockResolvedValueOnce(ActionResult.success(new Set(['member_001'])))
          .mockResolvedValueOnce(ActionResult.success(new Set(['item_001'])));

        // Mock base context
        mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 },
        });

        // Mock dependent context for each level
        mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});

        // Mock entity instances
        mockDeps.entityManager.getEntityInstance.mockReturnValue({
          id: 'entity',
          components: {},
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // The resolution order algorithm should handle this properly
        expect(mockDeps.unifiedScopeResolver.resolve).toHaveBeenCalledTimes(4);
      });

      it('should detect circular dependencies in target definitions', async () => {
        // Circular dependency: a depends on b, b depends on a
        const actionDef = {
          id: 'test:circular',
          targets: {
            a: { scope: 'targets.b', placeholder: 'a', contextFrom: 'b' },
            b: { scope: 'targets.a', placeholder: 'b', contextFrom: 'a' },
          },
        };

        mockContext.candidateActions = [actionDef];

        const result = await stage.executeInternal(mockContext);

        // The stage should detect this and fail gracefully
        expect(result.success).toBe(true);
        expect(result.data.actionsWithTargets).toHaveLength(0);
        expect(result.errors).toBeDefined();
      });
    });

    describe('Error Conditions', () => {
      it('should handle broken dependency chains gracefully', async () => {
        const actionDef = {
          id: 'test:broken_chain',
          targets: {
            primary: { scope: 'location.npcs', placeholder: 'npc' },
            secondary: {
              scope: 'target.missing_property',
              placeholder: 'item',
              contextFrom: 'primary',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Primary resolves successfully
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.success(new Set(['npc_001']))
        );

        // Secondary fails due to missing property
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.success(new Set())
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.actionsWithTargets).toHaveLength(0);
      });

      it('should handle resolution errors gracefully', async () => {
        const actionDef = {
          id: 'test:error_action',
          targets: {
            primary: {
              scope: 'invalid.scope.expression',
              placeholder: 'target',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock resolution failure
        mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
          ActionResult.failure({
            error: 'Invalid scope expression',
            phase: 'scope_resolution',
          })
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.actionsWithTargets).toHaveLength(0);
      });
    });

    describe('Performance Tests', () => {
      it('should handle large numbers of dependent targets efficiently', async () => {
        const itemCount = 100;
        const itemIds = Array.from(
          { length: itemCount },
          (_, i) => `item_${i}`
        );

        const actionDef = {
          id: 'test:large_dependency',
          targets: {
            primary: { scope: 'location.npcs', placeholder: 'npc' },
            secondary: {
              scope: 'target.inventory.items',
              placeholder: 'item',
              contextFrom: 'primary',
            },
          },
        };

        mockContext.candidateActions = [actionDef];

        // Mock resolutions
        mockDeps.unifiedScopeResolver.resolve
          .mockResolvedValueOnce(ActionResult.success(new Set(['npc_001'])))
          .mockResolvedValueOnce(ActionResult.success(new Set(itemIds)));

        mockDeps.entityManager.getEntityInstance.mockReturnValue({
          id: 'generic',
          components: {},
        });

        const start = performance.now();
        const result = await stage.executeInternal(mockContext);
        const end = performance.now();

        expect(result.success).toBe(true);
        expect(end - start).toBeLessThan(500); // Should complete quickly
      });
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
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
        getAllComponents: jest.fn().mockReturnValue({}),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      // The new implementation builds specific primary context for each contextFrom target
      // Validate that targets have proper contextFromId relationships
      expect(result.data.resolvedTargets.b[0].contextFromId).toBe('entity');
      expect(result.data.resolvedTargets.c[0].contextFromId).toBe('entity');
      expect(result.data.resolvedTargets.d[0].contextFromId).toBe('entity');
    });
  });

  describe('Mixed Action Type Processing', () => {
    it('should process multi-target actions with full capabilities when mixed with legacy actions', async () => {
      // Create both legacy and multi-target actions
      const legacyAction = {
        id: 'core:follow',
        scope: 'core:potential_leaders',
        template: 'follow {target}',
      };

      const multiTargetAction = {
        id: 'core:go',
        targets: {
          primary: {
            scope: 'location.exits',
            placeholder: 'destination',
          },
        },
        template: 'go to {destination}',
      };

      mockContext.candidateActions = [legacyAction, multiTargetAction];

      // Mock legacy action resolution
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'npc_001', displayName: 'Guard Captain' }],
      });

      // Mock multi-target action resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['room_tavern']))
      );

      // Mock entity instances
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        switch (id) {
          case 'npc_001':
            return {
              id: 'npc_001',
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'Guard Captain' }),
            };
          case 'room_tavern':
            return {
              id: 'room_tavern',
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'The Gilded Bean' }),
            };
          default:
            return null;
        }
      });

      // Mock context building
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(2);

      // Verify legacy action has per-action metadata
      const legacyActionResult = result.data.actionsWithTargets.find(
        (awt) => awt.actionDef.id === 'core:follow'
      );
      expect(legacyActionResult).toBeDefined();
      expect(legacyActionResult.isMultiTarget).toBe(false);
      expect(legacyActionResult.resolvedTargets).toBeDefined();
      expect(legacyActionResult.targetDefinitions).toBeDefined();

      // Verify multi-target action has per-action metadata
      const multiTargetActionResult = result.data.actionsWithTargets.find(
        (awt) => awt.actionDef.id === 'core:go'
      );
      expect(multiTargetActionResult).toBeDefined();
      expect(multiTargetActionResult.isMultiTarget).toBe(true);
      expect(multiTargetActionResult.resolvedTargets).toBeDefined();
      expect(multiTargetActionResult.resolvedTargets.primary).toHaveLength(1);
      expect(multiTargetActionResult.resolvedTargets.primary[0].id).toBe(
        'room_tavern'
      );
      expect(multiTargetActionResult.targetDefinitions).toBeDefined();

      // Verify global metadata is still set for backward compatibility
      expect(result.data.resolvedTargets).toBeDefined();
      expect(result.data.targetDefinitions).toBeDefined();
    });

    it('should handle mixed actions without suppressing multi-target metadata', async () => {
      // This test verifies the fix - previously, multi-target metadata would be suppressed
      const actions = [
        {
          id: 'test:legacy1',
          scope: 'test:scope1',
          template: 'legacy {target}',
        },
        {
          id: 'test:multi1',
          targets: {
            primary: { scope: 'test:scope2', placeholder: 'thing' },
          },
          template: 'multi {thing}',
        },
        {
          id: 'test:legacy2',
          targets: 'test:scope3', // Legacy using targets property
          template: 'legacy2 {target}',
        },
      ];

      mockContext.candidateActions = actions;

      // Mock resolutions
      mockDeps.targetResolver.resolveTargets
        .mockResolvedValueOnce({
          success: true,
          value: [{ entityId: 'target1', displayName: 'Target 1' }],
        })
        .mockResolvedValueOnce({
          success: true,
          value: [{ entityId: 'target3', displayName: 'Target 3' }],
        });

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['target2']))
      );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'generic',
        getComponentData: jest.fn().mockReturnValue({ text: 'Generic' }),
      });

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(3);

      // Each action should have its own metadata
      result.data.actionsWithTargets.forEach((awt) => {
        expect(awt.resolvedTargets).toBeDefined();
        expect(awt.targetDefinitions).toBeDefined();
        expect(typeof awt.isMultiTarget).toBe('boolean');
      });

      // Verify the multi-target action maintains its full metadata
      const multiAction = result.data.actionsWithTargets.find(
        (awt) => awt.actionDef.id === 'test:multi1'
      );
      expect(multiAction.isMultiTarget).toBe(true);
      expect(multiAction.resolvedTargets.primary).toBeDefined();
    });
  });
});
