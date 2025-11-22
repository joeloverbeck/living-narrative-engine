import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

describe('MultiTargetResolutionStage', () => {
  let stage;
  let mockDeps;
  let mockContext;

  // Helper to setup legacy action behavior
  const setupLegacyAction = (scope) => {
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      true
    );
    mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
      {
        isLegacy: true,
        targetDefinitions: { primary: { scope, placeholder: 'target' } },
      }
    );
  };

  // Helper to setup multi-target action behavior
  const setupMultiTargetAction = (resolutionOrder) => {
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValueOnce(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue(
      resolutionOrder
    );
  };

  // Helper to setup action type checking based on action definition
  const setupActionTypeForAction = (actionDef, isLegacy) => {
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockImplementation(
      (action) => {
        if (action === actionDef) return isLegacy;
        // Default behavior for other actions
        return (
          typeof action.targets === 'string' || typeof action.scope === 'string'
        );
      }
    );
  };

  // Helper to setup display name resolution - no longer needed since mock handles this automatically

  beforeEach(() => {
    // Create mock dependencies
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
    mockDeps.targetResolutionResultBuilder = new TargetResolutionResultBuilder({
      entityManager: mockDeps.entityManager,
      logger: mockDeps.logger,
    });
    mockDeps.targetResolutionCoordinator = {
      coordinateResolution: jest.fn().mockImplementation(async (context) => {
        try {
          // Default implementation: resolve targets using UnifiedScopeResolver and build result
          const actionDef = context.actionDef;
          const actor = context.actor;

          if (!actionDef.targets || typeof actionDef.targets !== 'object') {
            return PipelineResult.failure(
              {
                error: 'Invalid targets configuration',
                phase: 'target_resolution',
                actionId: actionDef.id,
                stage: 'MultiTargetResolutionStage',
              },
              { ...context.data, error: 'Invalid targets configuration' }
            );
          }

          const resolvedTargets = {};
          const targetDefinitions = actionDef.targets;
          const targetContexts = [];

          // Get resolution order from dependency resolver
          let resolutionOrder;
          try {
            resolutionOrder = mockDeps.targetDependencyResolver.getResolutionOrder(targetDefinitions);
          } catch (error) {
            // Fallback: if mock returns error or nothing, use simple order based on keys
            resolutionOrder = Object.keys(targetDefinitions);
          }

          // If resolution order is empty, use keys from targetDefinitions
          if (!resolutionOrder || resolutionOrder.length === 0) {
            resolutionOrder = Object.keys(targetDefinitions);
          }

          // Resolve targets in dependency order
          for (const targetKey of resolutionOrder) {
            const targetDef = targetDefinitions[targetKey];

            try {
              const scopeResult = await mockDeps.unifiedScopeResolver.resolve(
                targetDef.scope,
                { actor, location: context.actionContext?.location }
              );

              if (scopeResult.success) {
                const entityIds = Array.from(scopeResult.value);

                // Determine contextFromId for dependent targets
                let contextFromId = null;
                if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
                  const contextTargets = resolvedTargets[targetDef.contextFrom];
                  if (contextTargets.length > 0) {
                    contextFromId = contextTargets[0].id;
                  }
                }

                resolvedTargets[targetKey] = entityIds
                  .map((id) => {
                    const entity = mockDeps.entityManager.getEntityInstance(id);
                    // Filter out missing entities
                    if (!entity) return null;

                    const displayName = mockDeps.targetDisplayNameResolver.getEntityDisplayName(id);
                    targetContexts.push({
                      type: 'entity', // Fixed: use 'entity' instead of targetKey
                      entityId: id,
                      displayName,
                      placeholder: targetDef.placeholder,
                    });

                    const targetObj = {
                      id,
                      displayName,
                      entity,
                    };

                    // Add contextFromId for dependent targets
                    if (contextFromId) {
                      targetObj.contextFromId = contextFromId;
                    }

                    return targetObj;
                  })
                  .filter(t => t !== null); // Remove null entries from missing entities
              } else {
                // Log scope resolution failures
                const errorInfo = scopeResult.errors?.[0] || { error: 'Unknown scope resolution error' };
                mockDeps.logger.error(`Scope resolution failed for target ${targetKey}:`, errorInfo);
                resolvedTargets[targetKey] = [];
              }
            } catch (error) {
              // Log scope evaluation errors
              mockDeps.logger.error(`Scope evaluation error for target ${targetKey}:`, error);
              resolvedTargets[targetKey] = [];
            }
          }

          // Exclusion logic: filter out actions where any non-optional target has no candidates
          const hasEmptyRequiredTarget = Object.entries(targetDefinitions).some(
            ([key, def]) => {
              const isOptional = def.optional === true;
              const hasNoCandidates = !resolvedTargets[key] || resolvedTargets[key].length === 0;
              return !isOptional && hasNoCandidates;
            }
          );

          if (hasEmptyRequiredTarget) {
            // Return success but with empty actionsWithTargets array
            return mockDeps.targetResolutionResultBuilder.buildFinalResult(
              context,
              [], // empty actionsWithTargets
              [],
              null,
              null,
              []
            );
          }

          const result = mockDeps.targetResolutionResultBuilder.buildMultiTargetResult(
            context,
            resolvedTargets,
            targetContexts,
            targetDefinitions,
            actionDef,
            undefined
          );
          return result;
        } catch (err) {
          throw err;
        }
      }),
    };

    // Setup default mock behaviors
    mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
      actor: { id: 'player', components: {} },
      location: { id: 'room', components: {} },
    });

    mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
      actor: { id: 'player', components: {} },
      location: { id: 'room', components: {} },
    });

    mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
      {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        target: {},
      }
    );

    mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
      (entityId) => {
        // Mock the behavior to use entity component data for display names
        const entity = mockDeps.entityManager.getEntityInstance(entityId);
        if (!entity) return entityId;

        // Match the TargetDisplayNameResolver pattern: core:name?.text || core:description?.name || core:actor?.name || core:item?.name
        const nameData = entity.getComponentData('core:name');
        if (nameData?.text) return nameData.text;

        const descData = entity.getComponentData('core:description');
        if (descData?.name) return descData.name;

        const actorData = entity.getComponentData('core:actor');
        if (actorData?.name) return actorData.name;

        const itemData = entity.getComponentData('core:item');
        if (itemData?.name) return itemData.name;

        return entityId; // Fallback to entityId
      }
    );

    // Default behaviors for action type detection - use returnValue that can be overridden
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
      'primary',
    ]);

    // Create stage instance
    stage = new MultiTargetResolutionStage({
      legacyTargetCompatibilityLayer: mockDeps.legacyTargetCompatibilityLayer,
      targetDisplayNameResolver: mockDeps.targetDisplayNameResolver,
      unifiedScopeResolver: mockDeps.unifiedScopeResolver,
      entityManager: mockDeps.entityManager,
      targetResolver: mockDeps.targetResolver,
      logger: mockDeps.logger,
      tracingOrchestrator: mockDeps.tracingOrchestrator,
      targetResolutionResultBuilder: mockDeps.targetResolutionResultBuilder,
      targetResolutionCoordinator: mockDeps.targetResolutionCoordinator,
    });

    // Create mock context
    mockContext = {
      candidateActions: [],
      actor: {
        id: 'player',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
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

      setupLegacyAction('test:valid_targets');

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        components: {},
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
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
          placeholder: 'target',
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

      setupLegacyAction('test:valid_targets');

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        components: {},
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
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

    it('propagates template-derived placeholder metadata for legacy actions', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:legacy_scope',
        template: 'release {primary} from the hug',
      };
      mockContext.candidateActions = [actionDef];

      setupLegacyAction('test:legacy_scope');
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue({
        isLegacy: true,
        targetDefinitions: {
          primary: { scope: 'test:legacy_scope', placeholder: 'primary' },
        },
      });

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [ActionTargetContext.forEntity('target1')],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        getComponentData: jest
          .fn()
          .mockImplementation((componentId) =>
            componentId === 'core:name' ? { text: 'Alicia Western' } : null
          ),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const legacyResult = result.data.actionsWithTargets[0];
      expect(legacyResult.targetContexts[0]).toMatchObject({
        entityId: 'target1',
        placeholder: 'primary',
        displayName: 'Alicia Western',
      });

      expect(legacyResult.resolvedTargets.primary[0]).toMatchObject({
        id: 'target1',
        displayName: 'Alicia Western',
      });
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

      setupMultiTargetAction(['primary']);

      // Ensure the action is treated as multi-target
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1', 'item2']))
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'item1') {
          return {
            id: 'item1',
            getComponent: jest.fn(),
            getComponentData: jest.fn(() => null),
          };
        } else if (id === 'item2') {
          return {
            id: 'item2',
            getComponent: jest.fn(),
            getComponentData: jest.fn(() => null),
          };
        }
        return null;
      });

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

      // Setup resolution order for dependent targets
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      // Setup scope context builder
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // Setup context for dependent target resolution
      mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
        {
          actor: { id: 'player', components: {} },
          location: { id: 'room', components: {} },
          target: { id: 'npc1', components: {} },
          game: { turnNumber: 1 },
        }
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
            getComponentData: jest.fn(() => null),
            getAllComponents: jest
              .fn()
              .mockReturnValue({ 'core:name': { value: 'NPC 1' } }),
          };
        }
        return {
          id,
          getComponent: jest.fn(),
          getComponentData: jest.fn(() => null),
        };
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      // Check that the action has resolved targets attached (per-action metadata)
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.resolvedTargets).toBeDefined();
      expect(actionWithTargets.resolvedTargets.secondary).toBeDefined();
      expect(actionWithTargets.resolvedTargets.secondary).toHaveLength(2);
      expect(actionWithTargets.resolvedTargets.secondary[0].contextFromId).toBe(
        'npc1'
      );
      expect(actionWithTargets.resolvedTargets.secondary[1].contextFromId).toBe(
        'npc1'
      );
    });

    it('should fail when any target has no candidates', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:required',
            placeholder: 'main',
          },
          secondary: {
            scope: 'test:secondary',
            placeholder: 'extra',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      // Setup as multi-target action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // Primary resolves successfully, secondary has no candidates
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['target1'])))
        .mockResolvedValueOnce(ActionResult.success(new Set())); // Empty for secondary

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.continueProcessing).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
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

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
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

      // Set up resolution order to match the target definitions
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
        'tertiary',
      ]);

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'dummy',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({}),
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
            getAllComponents: jest.fn().mockReturnValue({}),
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

      // Mock different component name sources - match TargetDisplayNameResolver patterns
      // Resolver checks: core:name?.text || core:description?.name || core:actor?.name || core:item?.name
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
        getAllComponents: jest.fn().mockReturnValue({}),
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

      // Setup action types for all three actions at once
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockImplementation(
        (action) => {
          if (action === action1) return false; // multi-target
          if (action === action2) return true; // legacy
          if (action === action3) return false; // multi-target
          // Default behavior
          return (
            typeof action.targets === 'string' ||
            typeof action.scope === 'string'
          );
        }
      );

      // Setup for action1 and action3 (multi-target)
      mockDeps.targetDependencyResolver.getResolutionOrder
        .mockReturnValueOnce(['primary']) // for action1
        .mockReturnValueOnce(['primary', 'secondary']); // for action3

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['item1']))) // action1
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1']))) // action3 primary
        .mockResolvedValueOnce(ActionResult.success(new Set(['item2']))); // action3 secondary

      // Setup for action2 (legacy)
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:legacy_scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id: id,
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue(null),
        getAllComponents: jest.fn().mockReturnValue({}),
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

      // Set up legacy detection for actions
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockImplementation(
        (action) => {
          if (action === invalidAction) return true; // treat as legacy since it has string targets
          if (action === validAction) return false;
          return (
            typeof action.targets === 'string' ||
            typeof action.scope === 'string'
          );
        }
      );

      // Mock for invalid action (legacy)
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      // Mock for valid action (multi-target)
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
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
        getAllComponents: jest.fn().mockReturnValue({}),
      }));

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // The production code handles this gracefully - actions without valid IDs are skipped
      // The invalid action is processed but may not result in any targets
      // Only the valid action should produce results
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
        getAllComponents: jest.fn().mockReturnValue({}),
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

        // Ensure action is treated as multi-target
        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );

        // Setup resolution order for dependent targets
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
          'secondary',
        ]);

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
              getComponentData: jest.fn(() => null),
              getAllComponents: jest.fn().mockReturnValue({
                'core:inventory': { items: ['item_001', 'item_002'] },
              }),
            };
          return {
            id,
            getComponent: jest.fn(),
            getComponentData: jest.fn(() => null),
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
        expect(result.data.actionsWithTargets).toHaveLength(1);

        // Check that the action has resolved targets attached (per-action metadata)
        const actionWithTargets = result.data.actionsWithTargets[0];
        expect(actionWithTargets.resolvedTargets).toBeDefined();
        expect(actionWithTargets.resolvedTargets.secondary).toHaveLength(2);
        expect(
          actionWithTargets.resolvedTargets.secondary[0].contextFromId
        ).toBe('npc_001');
        expect(
          actionWithTargets.resolvedTargets.secondary[1].contextFromId
        ).toBe('npc_001');
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

        // Ensure action is treated as multi-target
        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );

        // Setup resolution order
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
          'secondary',
          'tertiary',
        ]);

        // Mock scope context builders
        mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
        });
        mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
          {
            actor: { id: 'player' },
            location: { id: 'room' },
            target: {},
          }
        );

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
                getComponentData: jest.fn(() => null),
                getAllComponents: jest.fn().mockReturnValue({}),
              };
            case 'container_001':
              return {
                id: 'container_001',
                getComponent: jest.fn(),
                getComponentData: jest.fn(() => null),
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
                getComponentData: jest.fn(() => null),
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

        // Check that the action has resolved targets attached (per-action metadata)
        const actionWithTargets = result.data.actionsWithTargets[0];
        expect(actionWithTargets.resolvedTargets).toBeDefined();
        expect(
          actionWithTargets.resolvedTargets.secondary[0].contextFromId
        ).toBe('tool_001');
        expect(
          actionWithTargets.resolvedTargets.tertiary[0].contextFromId
        ).toBe('container_001');
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

        // Set up resolution order
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'a',
          'b',
          'c',
          'd',
        ]);

        // Mock successful resolutions for each level
        mockDeps.unifiedScopeResolver.resolve
          .mockResolvedValueOnce(
            ActionResult.success(new Set(['faction_merchants']))
          )
          .mockResolvedValueOnce(ActionResult.success(new Set(['guild_001'])))
          .mockResolvedValueOnce(ActionResult.success(new Set(['member_001'])))
          .mockResolvedValueOnce(ActionResult.success(new Set(['item_001'])));

        // Mock scope context builders
        mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
          game: { turnNumber: 1 },
        });

        // Mock dependent context for each level
        mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
          {
            actor: { id: 'player' },
            location: { id: 'room' },
            target: {},
            game: { turnNumber: 1 },
          }
        );

        // Mock entity instances
        mockDeps.entityManager.getEntityInstance.mockReturnValue({
          id: 'entity',
          components: {},
          getComponent: jest.fn(),
          getComponentData: jest.fn(() => null),
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
          getComponent: jest.fn(),
          getComponentData: jest.fn(() => null),
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

      // Set up as legacy action since it has string targets
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'none', placeholder: 'target' },
          },
        }
      );

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
        getComponentData: jest.fn(() => null),
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

      // Set up resolution order
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'a',
        'b',
        'c',
        'd',
      ]);

      // Set up scope context builders
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });
      mockDeps.scopeContextBuilder.buildScopeContextForSpecificPrimary.mockReturnValue(
        {
          actor: { id: 'player' },
          location: { id: 'room' },
          target: { id: 'entity' },
        }
      );

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity']))
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
        getAllComponents: jest.fn().mockReturnValue({}),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      // Check that the action has resolved targets attached (per-action metadata)
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.resolvedTargets).toBeDefined();
      // Validate that targets have proper contextFromId relationships
      expect(actionWithTargets.resolvedTargets.b[0].contextFromId).toBe(
        'entity'
      );
      expect(actionWithTargets.resolvedTargets.c[0].contextFromId).toBe(
        'entity'
      );
      expect(actionWithTargets.resolvedTargets.d[0].contextFromId).toBe(
        'entity'
      );
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
        id: 'movement:go',
        targets: {
          primary: {
            scope: 'location.exits',
            placeholder: 'destination',
          },
        },
        template: 'go to {destination}',
      };

      mockContext.candidateActions = [legacyAction, multiTargetAction];

      // Setup action type detection
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockImplementation(
        (action) => {
          if (action === legacyAction) return true;
          if (action === multiTargetAction) return false;
          return (
            typeof action.targets === 'string' ||
            typeof action.scope === 'string'
          );
        }
      );

      // Setup legacy conversion
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'core:potential_leaders', placeholder: 'target' },
          },
        }
      );

      // Mock legacy action resolution
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'npc_001', displayName: 'Guard Captain' }],
      });

      // Setup multi-target resolution order
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Setup scope context builder
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
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
              getComponent: jest.fn(),
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'Guard Captain' }),
            };
          case 'room_tavern':
            return {
              id: 'room_tavern',
              getComponent: jest.fn(),
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'The Gilded Bean' }),
            };
          default:
            return null;
        }
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
        (awt) => awt.actionDef.id === 'movement:go'
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

      // Setup action type detection
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockImplementation(
        (action) => {
          if (action === actions[0]) return true; // legacy1
          if (action === actions[1]) return false; // multi1
          if (action === actions[2]) return true; // legacy2
          return (
            typeof action.targets === 'string' ||
            typeof action.scope === 'string'
          );
        }
      );

      // Setup legacy conversion
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockImplementation(
        (action) => {
          if (action === actions[0]) {
            return {
              isLegacy: true,
              targetDefinitions: {
                primary: { scope: 'test:scope1', placeholder: 'target' },
              },
            };
          }
          if (action === actions[2]) {
            return {
              isLegacy: true,
              targetDefinitions: {
                primary: { scope: 'test:scope3', placeholder: 'target' },
              },
            };
          }
          return { isLegacy: false };
        }
      );

      // Mock resolutions for legacy actions
      mockDeps.targetResolver.resolveTargets
        .mockResolvedValueOnce({
          success: true,
          value: [{ entityId: 'target1', displayName: 'Target 1' }],
        })
        .mockResolvedValueOnce({
          success: true,
          value: [{ entityId: 'target3', displayName: 'Target 3' }],
        });

      // Setup multi-target resolution
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);
      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['target2']))
      );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'generic',
        getComponent: jest.fn(),
        getComponentData: jest.fn().mockReturnValue({ text: 'Generic' }),
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
