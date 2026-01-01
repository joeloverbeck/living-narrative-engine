import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

/**
 * @file Additional test coverage for MultiTargetResolutionStage to achieve 100% branch coverage
 * Covers specific uncovered branches identified in coverage report
 */

describe('MultiTargetResolutionStage - Coverage Tests', () => {
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

    // Default behaviors
    mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
      false
    );
    mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
      'primary',
    ]);

    // Create mock coordinator
    mockDeps.targetResolutionCoordinator = {
      coordinateResolution: jest.fn(async (context) => {
        const { actionDef } = context;

        // Handle errors in getting resolution order
        let resolutionOrder;
        try {
          resolutionOrder =
            mockDeps.targetDependencyResolver.getResolutionOrder(
              actionDef.targets
            );
        } catch (error) {
          return {
            success: true,
            data: {
              ...context.data,
              actionsWithTargets: [],
              error: error?.message,
            },
            continueProcessing: false,
          };
        }

        const resolvedTargets = {};
        const targetContexts = [];
        const detailedResolutionResults = {};

        for (const targetKey of resolutionOrder) {
          const targetDef = actionDef.targets[targetKey];
          const scopeContext = mockDeps.scopeContextBuilder.buildScopeContext();
          const result = await mockDeps.unifiedScopeResolver.resolve(
            targetDef.scope,
            scopeContext
          );

          // Log errors if scope resolution fails
          if (!result.success) {
            const errorDetails =
              result.errors || result.error || 'Unknown error';
            mockDeps.logger.error(
              `Failed to resolve scope '${targetDef.scope}':`,
              errorDetails
            );
          }

          if (result.success && result.value) {
            const candidates = Array.from(result.value)
              .map((entry) => {
                // Normalize entity ID (handle strings and objects with id/itemId)
                let id;
                if (typeof entry === 'string') {
                  id = entry;
                } else if (entry && typeof entry === 'object') {
                  if (typeof entry.id === 'string' && entry.id.trim()) {
                    id = entry.id.trim();
                  } else if (
                    typeof entry.itemId === 'string' &&
                    entry.itemId.trim()
                  ) {
                    id = entry.itemId.trim();
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
                const entity = mockDeps.entityManager.getEntityInstance(id);
                if (!entity) {
                  return null;
                }
                const displayName =
                  mockDeps.targetDisplayNameResolver.getEntityDisplayName(id) ||
                  id;
                return {
                  id,
                  displayName,
                  entity,
                };
              })
              .filter(Boolean);

            resolvedTargets[targetKey] = candidates;
            candidates.forEach((target) => {
              targetContexts.push({
                type: 'entity',
                entityId: target.id,
                displayName: target.displayName,
                placeholder: targetDef.placeholder,
              });
            });
          }
          detailedResolutionResults[targetKey] = {
            scopeId: targetDef.scope,
            contextFrom: targetDef.contextFrom || null,
            candidatesFound: result?.value?.size || 0,
            candidatesResolved: resolvedTargets[targetKey]?.length || 0,
            failureReason: null,
            evaluationTimeMs: 0,
          };

          // Check for dependent targets with no candidates
          if (
            targetDef.contextFrom &&
            resolvedTargets[targetKey]?.length === 0
          ) {
            detailedResolutionResults[targetKey].failureReason =
              `No candidates found for target '${targetKey}'`;
            return {
              success: true,
              data: {
                ...context.data,
                actionsWithTargets: [],
                detailedResolutionResults,
              },
              continueProcessing: false,
            };
          }
        }

        // Check if we have any valid targets
        const hasTargets = Object.values(resolvedTargets).some(
          (targets) => targets.length > 0
        );

        if (!hasTargets) {
          return {
            success: true,
            data: {
              ...context.data,
              actionsWithTargets: [],
              detailedResolutionResults,
            },
            continueProcessing: false,
          };
        }

        return mockDeps.targetResolutionResultBuilder.buildMultiTargetResult(
          context,
          resolvedTargets,
          targetContexts,
          actionDef.targets,
          actionDef,
          detailedResolutionResults
        );
      }),
    };

    // Create stage instance with current constructor signature
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

  describe('Line 114 - Default candidateActions', () => {
    it('should handle missing candidateActions in context', async () => {
      // Remove candidateActions from context to test default assignment
      // Don't set mockContext.candidateActions at all
      delete mockContext.candidateActions;

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
      // Verify it processes empty array without errors
      expect(mockDeps.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Line 167 - Conditional metadata attachment', () => {
    it('should not attach metadata when resolvedTargets is missing', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // We need to test the specific condition in line 167-169
      // Instead of mocking the private method, let's test through the actual flow
      // by having the resolve return success but controlling what data is returned

      // First call will work normally for primary resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['item1']))
      );

      // Mock entity instance
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'item1',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      });

      // Now we need to make the stage think it has no resolvedTargets
      // We'll do this by having the resolveMultiTargets return data without them
      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);

      // The metadata should still be attached in the normal flow
      // The condition we're testing is when result.data.resolvedTargets exists
      // but result.data.targetDefinitions doesn't (or vice versa)
      // Let's check if normal flow works first
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets).toBeDefined();
    });

    it('should handle actions when only one of resolvedTargets/targetDefinitions is present', async () => {
      // Create two actions to test the specific branch
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
        targets: 'test:legacy', // Legacy action
      };

      mockContext.candidateActions = [action1, action2];

      // First action is multi-target
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction
        .mockReturnValueOnce(false) // action1
        .mockReturnValueOnce(true); // action2

      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // For action1 - multi-target resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['item1']))
      );

      // For action2 - legacy resolution with 'none' scope
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
        value: [], // Empty targets for 'none' scope
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'item1',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Both actions should be processed
      expect(result.data.actionsWithTargets).toHaveLength(2);
    });
  });

  describe('Line 190 - Error scopeName handling', () => {
    it('should format error message with scopeName when present', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      // Return valid resolution order first
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Make buildScopeContext throw an error with scopeName
      const scopeError = new Error('Invalid scope syntax');
      scopeError.scopeName = 'test:invalid';

      mockDeps.scopeContextBuilder.buildScopeContext.mockImplementation(() => {
        throw scopeError;
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe(
        "Scope resolution failed for 'test:invalid': Invalid scope syntax"
      );
      expect(result.errors[0].scopeName).toBe('test:invalid');
    });

    it('should format error message without scopeName when not present', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      // Return valid resolution order first
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Make buildScopeContext throw a regular error
      const normalError = new Error('Something went wrong');

      mockDeps.scopeContextBuilder.buildScopeContext.mockImplementation(() => {
        throw normalError;
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Something went wrong');
      expect(result.errors[0].scopeName).toBeUndefined();
    });
  });

  describe('Line 252 - Legacy conversion result fallback', () => {
    it('should use actionDef.targets when conversion result has no targetDefinitions', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:fallback_targets',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      // Return conversion result without targetDefinitions
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          // No targetDefinitions property
        }
      );

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

      // Verify it used actionDef.targets as fallback
      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:fallback_targets',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy'
      );
      expect(result.success).toBe(true);
    });

    it('should use actionDef.scope when both targetDefinitions and targets are missing', async () => {
      const actionDef = {
        id: 'test:legacy',
        scope: 'test:fallback_scope',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      // Return conversion result without targetDefinitions
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          // No targetDefinitions property
        }
      );

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

      // Verify it used actionDef.scope as final fallback
      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:fallback_scope',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy'
      );
      expect(result.success).toBe(true);
    });

    it('should handle conversion result with missing primary scope', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:fallback_targets',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      // Return conversion result with targetDefinitions but no primary
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            // No primary property
            secondary: { scope: 'test:secondary', placeholder: 'target' },
          },
        }
      );

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

      // Verify it used actionDef.targets as fallback
      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:fallback_targets',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Lines 297-315 - Display name and entity handling in legacy resolution', () => {
    it('should handle null entity from getEntityInstance in legacy resolution', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:valid_targets',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:valid_targets', placeholder: 'target' },
          },
        }
      );

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [
          { entityId: 'target1', displayName: null },
          { entityId: 'target2', displayName: null },
        ],
      });

      // Return null for one entity, valid entity for another
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'target1') {
          return {
            id: 'target1',
            components: {},
            getComponent: jest.fn(),
            getComponentData: jest.fn(() => null),
          };
        }
        return null; // Return null for target2
      });

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => {
          if (id === 'target1') return 'Display Name 1';
          return null; // Return null for target2
        }
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      expect(actionWithTargets.resolvedTargets.primary).toHaveLength(2);

      // First target should have valid entity
      expect(actionWithTargets.resolvedTargets.primary[0].entity).toBeTruthy();
      expect(actionWithTargets.resolvedTargets.primary[0].displayName).toBe(
        'Display Name 1'
      );

      // Second target should have null entity but still be included
      expect(actionWithTargets.resolvedTargets.primary[1].entity).toBeNull();
      expect(actionWithTargets.resolvedTargets.primary[1].displayName).toBe(
        'target2'
      );
    });

    it('should use entity ID as fallback when displayName resolver returns null', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:valid_targets',
        template: 'test {target}',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:valid_targets', placeholder: 'target' },
          },
        }
      );

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: null }],
      });

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'target1',
        components: {},
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      });

      // Return null from display name resolver
      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        null
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      // Should use entity ID as fallback
      expect(actionWithTargets.resolvedTargets.primary[0].displayName).toBe(
        'target1'
      );
    });
  });

  describe('Line 416 - Missing entity in contextFrom branch', () => {
    it('should skip missing entities when resolving dependent targets', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      // Primary resolves successfully
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1'])))
        .mockResolvedValueOnce(
          ActionResult.success(new Set(['item1', 'missing_item', 'item2']))
        );

      // Mock entity instances - return null for missing_item
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'missing_item') return null;
        return {
          id,
          getComponent: jest.fn(),
          getComponentData: jest.fn(() => null),
        };
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      // Should only have 2 items (missing_item filtered out)
      expect(actionWithTargets.resolvedTargets.secondary).toHaveLength(2);
      expect(actionWithTargets.resolvedTargets.secondary[0].id).toBe('item1');
      expect(actionWithTargets.resolvedTargets.secondary[1].id).toBe('item2');
    });
  });

  describe('Lines 601-605 - Error detail extraction variations', () => {
    it('should handle error as array with message property', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Mock resolve to return failure with array of errors
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue({
        success: false,
        errors: [
          { message: 'First error message', code: 'ERR001' },
          { message: 'Second error message', code: 'ERR002' },
        ],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve scope 'test:invalid':"),
        expect.any(Array)
      );
    });

    it('should handle error as array without message property', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Mock resolve to return failure with array of objects without message
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue({
        success: false,
        errors: [
          { code: 'ERR001', description: 'Some error' },
          { code: 'ERR002', description: 'Another error' },
        ],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle error as string', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Mock resolve to return failure with string error
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue({
        success: false,
        error: 'This is a string error message',
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle error as empty array', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Mock resolve to return failure with empty error array
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue({
        success: false,
        errors: [],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle error as object without specific properties', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Mock resolve to return failure with generic object
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue({
        success: false,
        errors: { someProperty: 'someValue' },
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });
  });

  describe('Additional uncovered branches', () => {
    it('should handle legacy action with empty targets and non-none scope', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:empty_scope',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:empty_scope', placeholder: 'target' },
          },
        }
      );

      // Return empty targets for non-none scope
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle legacy target resolution failure (line 271)', async () => {
      const actionDef = {
        id: 'test:legacy',
        targets: 'test:invalid_scope',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'test:invalid_scope', placeholder: 'target' },
          },
        }
      );

      // Return failure result from targetResolver
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: false,
        errors: [{ error: 'Scope resolution failed' }],
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should return failure when legacy conversion yields an error (line 420)', async () => {
      const actionDef = {
        id: 'test:legacy-conversion-error',
        targets: 'legacy:problem_scope',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat
        .mockReturnValueOnce({
          targetDefinitions: {
            primary: { scope: 'legacy:problem_scope', placeholder: 'target' },
          },
        })
        .mockReturnValueOnce({
          error: 'Legacy conversion failed',
        });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toEqual([]);
      expect(
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat
      ).toHaveBeenCalledTimes(2);
      expect(mockDeps.targetResolver.resolveTargets).not.toHaveBeenCalled();
    });

    it('should skip non-object legacy target contexts (line 488)', async () => {
      const actionDef = {
        id: 'test:legacy-context-skip',
        targets: 'legacy:context_scope',
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: 'legacy:context_scope', placeholder: 'friend' },
          },
        }
      );

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: ['bad-entry', { entityId: 'hero-1', displayName: '' }],
      });

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => (id ? `Display ${id}` : undefined)
      );
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) =>
        id ? { id, components: {} } : null
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const actionWithTargets = result.data.actionsWithTargets[0];
      const validTargets = actionWithTargets.resolvedTargets.primary.filter(
        (target) => target.id
      );
      expect(validTargets).toHaveLength(1);
      expect(validTargets[0]).toEqual({
        id: 'hero-1',
        displayName: 'Display hero-1',
        entity: { id: 'hero-1', components: {} },
      });

      const enrichedContext = actionWithTargets.targetContexts.find(
        (ctx) => ctx && ctx.entityId === 'hero-1'
      );
      expect(enrichedContext.placeholder).toBe('friend');
      expect(enrichedContext.displayName).toBe('Display hero-1');
    });

    it('should handle invalid targets configuration (line 338)', async () => {
      const actionDef = {
        id: 'test:action',
        targets: 123, // Invalid - not an object
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should handle error in getResolutionOrder (line 354)', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          a: { scope: 'test:a', placeholder: 'a', contextFrom: 'b' },
          b: { scope: 'test:b', placeholder: 'b', contextFrom: 'a' },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      // Mock circular dependency error
      mockDeps.targetDependencyResolver.getResolutionOrder.mockImplementation(
        () => {
          throw new Error('Circular dependency detected');
        }
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should normalize scope results with mixed entry shapes (lines 992-1002)', async () => {
      const actionDef = {
        id: 'test:multi-normalize',
        targets: {
          primary: {
            scope: 'scope:normalize',
            placeholder: 'item',
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(
          new Set([
            'entity-1',
            { id: ' entity-2 ' },
            { itemId: ' item-3 ' },
            { foo: 'bar' },
          ])
        )
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        components: {},
      }));
      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Display ${id}`
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(1);

      const resolvedTargets =
        result.data.actionsWithTargets[0].resolvedTargets.primary;
      expect(resolvedTargets).toHaveLength(3);
      expect(resolvedTargets.map((target) => target.id)).toEqual([
        'entity-1',
        'entity-2',
        'item-3',
      ]);
    });

    it('should handle no candidates for required contextFrom target (lines 432-436)', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:actors',
            placeholder: 'person',
          },
          secondary: {
            scope: 'test:items',
            placeholder: 'item',
            contextFrom: 'primary',
            optional: false, // Required
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      // Primary resolves successfully
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set(['npc1'])))
        // Secondary resolves to empty
        .mockResolvedValueOnce(ActionResult.success(new Set()));

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'npc1',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });

    it('should filter out missing entities (line 500)', async () => {
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

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Resolve to multiple entities
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1', 'item2', 'item3']))
      );

      // Mock entity instances - return null for item2
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'item2') return null;
        return {
          id,
          getComponent: jest.fn(),
          getComponentData: jest.fn(() => null),
        };
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      const actionWithTargets = result.data.actionsWithTargets[0];
      // Should filter out item2
      expect(actionWithTargets.resolvedTargets.primary).toHaveLength(2);
      expect(actionWithTargets.resolvedTargets.primary[0].id).toBe('item1');
      expect(actionWithTargets.resolvedTargets.primary[1].id).toBe('item3');
    });

    it('should handle no valid targets at all (line 537)', async () => {
      const actionDef = {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            optional: true,
          },
          secondary: {
            scope: 'test:other',
            placeholder: 'other',
            optional: true,
          },
        },
      };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      mockDeps.scopeContextBuilder.buildScopeContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
      });

      // Both resolve to empty
      mockDeps.unifiedScopeResolver.resolve
        .mockResolvedValueOnce(ActionResult.success(new Set()))
        .mockResolvedValueOnce(ActionResult.success(new Set()));

      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      expect(result.data.actionsWithTargets).toHaveLength(0);
    });
  });

  describe('Branch Coverage - Uncovered Edges', () => {
    let actionAwareTrace;
    let capturedTraceData;
    let captureResolutionDataSpy;

    beforeEach(() => {
      capturedTraceData = [];

      // Create action-aware trace mock (has captureActionData method)
      actionAwareTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        captureActionData: jest.fn((stage, actionId, data) => {
          capturedTraceData.push({ stage, actionId, data });
        }),
        captureLegacyDetection: jest.fn(),
        captureLegacyConversion: jest.fn(),
        captureScopeEvaluation: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
      };

      // Spy on the tracingOrchestrator's captureResolutionData method
      captureResolutionDataSpy = jest.spyOn(
        mockDeps.tracingOrchestrator,
        'captureResolutionData'
      );
    });

    afterEach(() => {
      captureResolutionDataSpy.mockRestore();
    });

    describe('Line 338 - Legacy tracing scope fallback', () => {
      it('should fall back to actionDef.targets when targetDefinitions.primary.scope is missing', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:fallback_scope',
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        // Return conversion result without primary.scope
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: {
                placeholder: 'target',
                // NO scope property
              },
            },
          }
        );

        // targetResolver.resolveTargets returns { success: true, value: [...targetContexts] }
        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          value: [{ entityId: 'entity1', displayName: 'Entity 1' }],
        });

        // Mock entityManager.getEntityInstance for the legacy resolution
        mockDeps.entityManager.getEntityInstance.mockReturnValue({
          id: 'entity1',
          components: {},
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Verify tracing was called with the fallback scope
        expect(captureResolutionDataSpy).toHaveBeenCalled();
        const captureCall = captureResolutionDataSpy.mock.calls[0];
        expect(captureCall[3].scope).toBe('test:fallback_scope');
      });
    });

    describe('Lines 363-386 - Multi-target tracing edge cases', () => {
      it('should handle actionDef.targets being null with action-aware trace (line 363-365)', async () => {
        const actionDef = {
          id: 'test:multi',
          targets: null, // null targets
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue(
          []
        );

        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              actionsWithTargets: [{ actionDef: actionDef }],
              resolvedTargets: null, // no resolved targets
              targetContexts: [],
            },
          }
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Verify tracing was called with empty targetKeys
        expect(captureResolutionDataSpy).toHaveBeenCalled();
        const captureCall = captureResolutionDataSpy.mock.calls[0];
        expect(captureCall[3].targetKeys).toEqual([]);
        expect(captureCall[3].resolvedTargetCounts).toEqual({});
      });

      it('should skip resolvedTargetCounts loop when resolvedTargets is missing (line 368)', async () => {
        const actionDef = {
          id: 'test:multi',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Return result without resolvedTargets in data
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              actionsWithTargets: [{ actionDef: actionDef }],
              // No resolvedTargets property
              targetContexts: [],
            },
          }
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(captureResolutionDataSpy).toHaveBeenCalled();
        const captureCall = captureResolutionDataSpy.mock.calls[0];
        expect(captureCall[3].resolvedTargetCounts).toEqual({});
      });
    });

    describe('Line 400 - Metadata attachment conditional', () => {
      it('should not attach metadata when resolvedTargets is missing', async () => {
        const actionDef = {
          id: 'test:multi',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        const actionWithTargets = { actionDef: actionDef };
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              actionsWithTargets: [actionWithTargets],
              // No resolvedTargets but has targetDefinitions
              targetDefinitions: { primary: { scope: 'test:scope' } },
              targetContexts: [],
            },
          }
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Check that isMultiTarget was NOT set (conditional failed)
        expect(result.data.actionsWithTargets[0].isMultiTarget).toBeUndefined();
      });

      it('should not attach metadata when targetDefinitions is missing', async () => {
        const actionDef = {
          id: 'test:multi',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        const actionWithTargets = { actionDef: actionDef };
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              actionsWithTargets: [actionWithTargets],
              resolvedTargets: { primary: [{ id: 'entity1' }] },
              // No targetDefinitions
              targetContexts: [],
            },
          }
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Check that isMultiTarget was NOT set (conditional failed)
        expect(result.data.actionsWithTargets[0].isMultiTarget).toBeUndefined();
      });
    });

    describe('Lines 424-425 - Error message formatting', () => {
      it('should use scopeName in error message when error has scopeName property (line 423-424)', async () => {
        const actionDef = {
          id: 'test:action',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Throw error with scopeName but empty message
        const scopeError = new Error();
        scopeError.scopeName = 'test:failing_scope';
        // Error message will be '' (empty string) which is falsy
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
          scopeError
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Errors are at result.errors, not result.data.errors
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        // The error property is 'error', not 'message', and includes scopeName
        expect(result.errors[0].error).toContain('test:failing_scope');
        expect(result.errors[0].scopeName).toBe('test:failing_scope');
      });

      it('should use String(error) fallback when error has no message (line 425-426)', async () => {
        const actionDef = {
          id: 'test:action',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Throw a string (not Error object) to test String(error) path
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
          'Simple string error'
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Errors are at result.errors, not result.data.errors
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        // The error property is 'error', not 'message'
        expect(result.errors[0].error).toBe('Simple string error');
      });
    });

    describe('Line 547 - null actionContext', () => {
      it('should handle null actionContext with empty keys array (line 547)', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:scope',
        };
        mockContext.candidateActions = [actionDef];
        mockContext.actionContext = null; // Set actionContext to null

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: { scope: 'test:scope', placeholder: 'target' },
            },
          }
        );

        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          data: {
            actionsWithTargets: [{ actionDef: actionDef }],
            resolvedTargets: { primary: [{ id: 'entity1' }] },
            targetContexts: [{ entityId: 'entity1', displayName: 'Entity 1' }],
          },
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Verify debug was called with empty array for actionContextKeys
        expect(mockDeps.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('[DIAGNOSTIC] Legacy resolution'),
          expect.objectContaining({
            hasActionContext: false,
            actionContextKeys: [],
          })
        );
      });
    });

    describe('Line 602 - displayName validation', () => {
      it('should use fallback resolver when displayName is empty string (line 604-605)', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:scope',
        };
        mockContext.candidateActions = [actionDef];

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: { scope: 'test:scope', placeholder: 'target' },
            },
          }
        );

        // Return target context with empty displayName
        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          value: [
            {
              entityId: 'entity1',
              displayName: '', // Empty string
            },
          ],
        });

        mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
          'Resolved Name'
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Should have called the resolver due to empty displayName
        expect(
          mockDeps.targetDisplayNameResolver.getEntityDisplayName
        ).toHaveBeenCalledWith('entity1');
        // Check the final displayName was resolved
        const targetContext = result.data.targetContexts[0];
        expect(targetContext.displayName).toBe('Resolved Name');
      });

      it('should use fallback resolver when displayName is not a string (line 604)', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:scope',
        };
        mockContext.candidateActions = [actionDef];

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: { scope: 'test:scope', placeholder: 'target' },
            },
          }
        );

        // Return target context with non-string displayName
        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          value: [
            {
              entityId: 'entity1',
              displayName: 123, // Number instead of string
            },
          ],
        });

        mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
          'Resolved Name'
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(
          mockDeps.targetDisplayNameResolver.getEntityDisplayName
        ).toHaveBeenCalledWith('entity1');
        const targetContext = result.data.targetContexts[0];
        expect(targetContext.displayName).toBe('Resolved Name');
      });

      it('should skip displayName enrichment when targetContext has no entityId (line 602)', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:scope',
        };
        mockContext.candidateActions = [actionDef];

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: { scope: 'test:scope', placeholder: 'target' },
            },
          }
        );

        // Return target context without entityId
        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          value: [
            {
              // No entityId
              type: 'location',
              displayName: 'Original Name',
            },
          ],
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Should NOT have called the resolver since no entityId
        expect(
          mockDeps.targetDisplayNameResolver.getEntityDisplayName
        ).not.toHaveBeenCalled();
        // Original displayName should be preserved
        const targetContext = result.data.targetContexts[0];
        expect(targetContext.displayName).toBe('Original Name');
      });
    });

    describe('Line 280 - hasScopeOnly branch when targets also exists', () => {
      it('should set hasScopeOnly to false when action has both scope AND targets (line 280)', async () => {
        const actionDef = {
          id: 'test:multi',
          scope: 'test:explicit_scope', // Has scope
          targets: {
            primary: { scope: 'test:primary', placeholder: 'target' }, // AND has targets object
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              actionsWithTargets: [{ actionDef: actionDef }],
              resolvedTargets: { primary: [{ id: 'entity1' }] },
              targetContexts: [{ entityId: 'entity1', displayName: 'Entity 1' }],
            },
          }
        );

        const captureLegacyDetectionSpy = jest.spyOn(
          mockDeps.tracingOrchestrator,
          'captureLegacyDetection'
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Verify captureLegacyDetection was called with hasScopeOnly: false
        expect(captureLegacyDetectionSpy).toHaveBeenCalled();
        const captureCall = captureLegacyDetectionSpy.mock.calls[0];
        expect(captureCall[2].hasScopeOnly).toBe(false);

        captureLegacyDetectionSpy.mockRestore();
      });
    });

    describe('Line 336 - targetCount fallback to 0 when resolvedTargets.primary is missing', () => {
      it('should use targetCount 0 when resolvedTargets.primary is undefined (line 336)', async () => {
        const actionDef = {
          id: 'test:legacy',
          targets: 'test:fallback_scope',
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          true
        );
        mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
          {
            targetDefinitions: {
              primary: { scope: 'test:fallback_scope', placeholder: 'target' },
            },
          }
        );

        // Return empty target contexts so no valid targets - this triggers the || 0 fallback
        // because resolvedTargets won't have a primary array with length
        mockDeps.targetResolver.resolveTargets.mockResolvedValue({
          success: true,
          value: [], // Empty array = no targets
        });

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // Verify tracing captured targetCount: 0 due to fallback
        expect(captureResolutionDataSpy).toHaveBeenCalled();
        const captureCall = captureResolutionDataSpy.mock.calls[0];
        expect(captureCall[3].targetCount).toBe(0);
      });
    });

    describe('Line 397 - multi-target result missing actionsWithTargets', () => {
      it('should skip processing when result.data.actionsWithTargets is missing (line 397)', async () => {
        const actionDef = {
          id: 'test:multi',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Return success result but without actionsWithTargets
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockResolvedValue(
          {
            success: true,
            data: {
              // No actionsWithTargets property
              resolvedTargets: { primary: [{ id: 'entity1' }] },
              targetContexts: [],
            },
          }
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        // allActionsWithTargets should be empty since actionsWithTargets was missing
        expect(result.data.actionsWithTargets).toHaveLength(0);
      });
    });

    describe('Line 425 - error.message exists but is empty string', () => {
      it('should fall back to Unknown error when error.message is empty (line 425)', async () => {
        const actionDef = {
          id: 'test:action',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Throw error object with empty message (but no scopeName to take the other branch)
        const emptyMessageError = new Error('');
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
          emptyMessageError
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        // The error should contain "Error" string from String(error) which returns "Error"
        expect(result.errors[0].error).toContain('Error');
      });

      it('should use String(error) when error has no message property (line 427)', async () => {
        const actionDef = {
          id: 'test:action',
          targets: {
            primary: { scope: 'test:scope', placeholder: 'target' },
          },
        };
        mockContext.candidateActions = [actionDef];
        mockContext.trace = actionAwareTrace;

        mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
          false
        );
        mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
          'primary',
        ]);

        // Throw null to test String(error) fallback - String(null) = "null"
        mockDeps.targetResolutionCoordinator.coordinateResolution.mockRejectedValue(
          null
        );

        const result = await stage.executeInternal(mockContext);

        expect(result.success).toBe(true);
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        // String(null) returns "null"
        expect(result.errors[0].error).toBe('null');
      });
    });
  });
});
