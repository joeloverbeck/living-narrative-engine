import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

describe('MultiTargetResolutionStage - Missing Scope Handling', () => {
  let stage;
  let mockDeps;
  let mockContext;

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

    // Create mock targetResolutionCoordinator with proper implementation
    mockDeps.targetResolutionCoordinator = {
      coordinateResolution: jest.fn().mockImplementation(async (context) => {
        try {
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

          let resolutionOrder;
          try {
            resolutionOrder = mockDeps.targetDependencyResolver.getResolutionOrder(targetDefinitions);
          } catch (error) {
            resolutionOrder = Object.keys(targetDefinitions);
          }

          if (!resolutionOrder || resolutionOrder.length === 0) {
            resolutionOrder = Object.keys(targetDefinitions);
          }

          for (const targetKey of resolutionOrder) {
            const targetDef = targetDefinitions[targetKey];

            try {
              const scopeResult = await mockDeps.unifiedScopeResolver.resolve(
                targetDef.scope,
                { actor, location: context.actionContext?.location }
              );

              if (scopeResult.success) {
                const entityIds = Array.from(scopeResult.value);
                resolvedTargets[targetKey] = entityIds
                  .map((id) => {
                    const entity = mockDeps.entityManager.getEntityInstance(id);
                    if (!entity) return null;

                    const displayName = mockDeps.targetDisplayNameResolver.getEntityDisplayName(id);
                    targetContexts.push({
                      type: 'entity',
                      entityId: id,
                      displayName,
                      placeholder: targetDef.placeholder,
                    });

                    return { id, displayName, entity };
                  })
                  .filter(t => t !== null);
              } else {
                const errorInfo = scopeResult.errors?.[0] || { error: 'Unknown scope resolution error' };
                mockDeps.logger.error(`Failed to resolve scope '${targetDef.scope}':`, errorInfo);
                throw errorInfo;
              }
            } catch (error) {
              mockDeps.logger.error(`Error evaluating scope '${targetDef.scope}':`, error);
              throw error;
            }
          }

          const hasEmptyRequiredTarget = Object.entries(targetDefinitions).some(
            ([key, def]) => {
              const isOptional = def.optional === true;
              const hasNoCandidates = !resolvedTargets[key] || resolvedTargets[key].length === 0;
              return !isOptional && hasNoCandidates;
            }
          );

          if (hasEmptyRequiredTarget) {
            return mockDeps.targetResolutionResultBuilder.buildFinalResult(
              context,
              [],
              [],
              null,
              null,
              []
            );
          }

          return mockDeps.targetResolutionResultBuilder.buildMultiTargetResult(
            context,
            resolvedTargets,
            targetContexts,
            targetDefinitions,
            actionDef,
            undefined
          );
        } catch (err) {
          throw err;
        }
      }),
    };

    // Setup default mock behaviors
    mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
      actor: { id: 'player', components: {} },
      location: { id: 'room', components: {} },
    });

    // Create stage instance
    stage = new MultiTargetResolutionStage(mockDeps);

    // Setup default context
    mockContext = {
      candidateActions: [],
      actor: { id: 'player', components: {} },
      actionContext: {
        currentLocation: { id: 'room', components: {} },
      },
      data: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing Scope Detection', () => {
    it('should fail with clear error when multi-target action references non-existent scope', async () => {
      // Arrange
      const actionWithMissingScope = {
        id: 'test:action_with_missing_scope',
        name: 'Test Action',
        targets: {
          primary: {
            scope: 'non_existent:scope_name',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [actionWithMissingScope];

      // Setup as multi-target action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Mock scope resolution to fail
      mockDeps.unifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.failure({
          message:
            "Missing scope definition: Scope 'non_existent:scope_name' not found or has no expression",
          name: 'ScopeNotFoundError',
          phase: 'VALIDATION',
          scopeName: 'non_existent:scope_name',
        })
      );

      // Act
      const result = await stage.execute(mockContext);

      // Assert
      expect(result.success).toBe(true); // Pipeline succeeds but with no actions
      expect(result.data.actionsWithTargets).toEqual([]);
      // Verify error was logged (may be logged multiple times in coordinator + stage)
      expect(mockDeps.logger.error).toHaveBeenCalled();
      expect(mockDeps.logger.error.mock.calls.some(call =>
        call[0].includes("Failed to resolve scope 'non_existent:scope_name'") ||
        call[0].includes("Error evaluating scope 'non_existent:scope_name'")
      )).toBe(true);
    });

    it('should fail with clear error when legacy action references non-existent scope', async () => {
      // Arrange
      const legacyActionWithMissingScope = {
        id: 'test:legacy_action_missing_scope',
        name: 'Legacy Test Action',
        scope: 'affection:close_actors', // This scope doesn't exist
      };

      mockContext.candidateActions = [legacyActionWithMissingScope];

      // Setup as legacy action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: {
              scope: 'affection:close_actors',
              placeholder: 'target',
            },
          },
        }
      );

      // Mock target resolver to fail (for legacy actions)
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.failure([
          {
            message:
              "Missing scope definition: Scope 'affection:close_actors' not found",
            name: 'ScopeNotFoundError',
            phase: 'VALIDATION',
          },
        ])
      );

      // Act
      const result = await stage.execute(mockContext);

      // Assert
      expect(result.success).toBe(true); // Pipeline continues but returns failure for this action
      expect(result.data.actionsWithTargets).toEqual([]);
      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'affection:close_actors',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy_action_missing_scope'
      );
    });

    it('should fail when any target scope is missing', async () => {
      // Arrange
      const actionWithMissingScope = {
        id: 'test:target_missing_scope',
        name: 'Action with Missing Target Scope',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'actor',
          },
          secondary: {
            scope: 'missing:scope',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [actionWithMissingScope];

      // Setup as multi-target action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      // Mock primary scope resolution to succeed
      mockDeps.unifiedScopeResolver.resolve
        .mockReturnValueOnce(ActionResult.success(new Set(['player'])))
        .mockReturnValueOnce(
          ActionResult.failure([
            {
              message:
                "Missing scope definition: Scope 'missing:scope' not found",
              name: 'ScopeNotFoundError',
              phase: 'VALIDATION',
              scopeName: 'missing:scope',
            },
          ])
        );

      // Act
      const result = await stage.execute(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]); // No actions due to scope error

      // The error is logged (new architecture may log at multiple levels)
      expect(mockDeps.logger.error).toHaveBeenCalled();
      expect(mockDeps.logger.error.mock.calls.some(call =>
        call[0].includes("Failed to resolve scope 'missing:scope'") ||
        call[0].includes("Error evaluating scope 'missing:scope'")
      )).toBe(true);
    });

    it('should log error and exclude action when scope resolution fails', async () => {
      // Arrange
      const actionWithContext = {
        id: 'test:action_for_error_context',
        name: 'Action for Error Context',
        targets: {
          primary: {
            scope: 'undefined:scope_with_context',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [actionWithContext];

      // Setup as multi-target action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Mock scope resolution to fail with context
      mockDeps.unifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.failure({
          message:
            "Missing scope definition: Scope 'undefined:scope_with_context' not found",
          name: 'ScopeNotFoundError',
          phase: 'VALIDATION',
          scopeName: 'undefined:scope_with_context',
          actionId: 'test:action_for_error_context',
        })
      );

      // Act
      const result = await stage.execute(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]); // Action is excluded

      // The error is logged (not silent anymore)
      expect(mockDeps.logger.error).toHaveBeenCalled();
      expect(mockDeps.logger.error.mock.calls.some(call =>
        call[0].includes('Error evaluating scope')
      )).toBe(true);
    });

    it('should handle multiple actions where some have missing scopes', async () => {
      // Arrange
      const validAction = {
        id: 'test:valid_action',
        name: 'Valid Action',
        targets: {
          primary: {
            scope: 'self',
            placeholder: 'actor',
          },
        },
      };

      const invalidAction = {
        id: 'test:invalid_action',
        name: 'Invalid Action',
        targets: {
          primary: {
            scope: 'missing:scope',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [validAction, invalidAction];

      // Setup both as multi-target actions
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Mock scope resolutions
      mockDeps.unifiedScopeResolver.resolve
        .mockReturnValueOnce(ActionResult.success(new Set(['player']))) // Valid action succeeds
        .mockReturnValueOnce(
          ActionResult.failure({
            // Invalid action fails
            message:
              "Missing scope definition: Scope 'missing:scope' not found",
            name: 'ScopeNotFoundError',
          })
        );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'player',
        components: {},
      });

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        'Player'
      );

      // Act
      const result = await stage.execute(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);
      expect(result.data.actionsWithTargets[0].actionDef.id).toBe(
        'test:valid_action'
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        "Failed to resolve scope 'missing:scope':",
        expect.any(Object)
      );
    });
  });

  describe('Error Propagation', () => {
    it('should no longer silently fail when scope is missing', async () => {
      // This test verifies that errors are now thrown and logged instead of being silently swallowed

      const action = {
        id: 'affection:brush_hand',
        name: 'Brush hand',
        targets: {
          primary: {
            scope: 'affection:close_actors', // Non-existent scope
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [action];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Simulate scope not found
      mockDeps.unifiedScopeResolver.resolve.mockReturnValue(
        ActionResult.failure({
          message:
            "Missing scope definition: Scope 'affection:close_actors' not found",
          name: 'ScopeNotFoundError',
        })
      );

      const result = await stage.execute(mockContext);

      // Pipeline succeeds but action is excluded
      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);

      // The error is now properly logged (not silent)
      expect(mockDeps.logger.error).toHaveBeenCalled();
      expect(mockDeps.logger.error.mock.calls.some(call =>
        call[0].includes("Failed to resolve scope 'affection:close_actors'") ||
        call[0].includes('Error evaluating scope')
      )).toBe(true);
    });
  });
});
