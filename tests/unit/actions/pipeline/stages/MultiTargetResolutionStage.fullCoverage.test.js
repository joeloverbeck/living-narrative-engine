import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import TargetResolutionResultBuilder from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';

/**
 * @file Full coverage tests for MultiTargetResolutionStage
 * Targets uncovered lines: 162, 190, 593, 673, 701-710, 899, 948-966
 */

describe('MultiTargetResolutionStage - Full Coverage', () => {
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

    // Create stage instance
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
      targetResolutionResultBuilder: mockDeps.targetResolutionResultBuilder,
    });

    // Create mock context
    mockContext = {
      actor: {
        id: 'player',
        getComponent: jest.fn(),
        getComponentData: jest.fn(() => null),
      },
      actionContext: {
        currentLocation: 'room',
        location: 'room',
      },
      candidateActions: [],
      data: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Action-Aware Tracing with Legacy Detection (line 162)', () => {
    it('should capture legacy detection when trace has captureLegacyDetection method', async () => {
      // Setup action-aware trace with captureLegacyDetection
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const legacyAction = {
        id: 'legacy-action',
        targets: 'actor.location.actors[]', // String targets for legacy
        scope: 'actor.location',
      };

      mockContext.candidateActions = [legacyAction];
      mockContext.trace = mockTrace;

      // Setup legacy action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: legacyAction.targets, placeholder: 'target' },
          },
        }
      );

      // Setup target resolver to return success
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([
          {
            type: 'entity',
            entityId: 'enemy1',
            displayName: 'Enemy',
            placeholder: 'target',
          },
        ])
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify captureLegacyDetection was called (line 162)
      expect(mockTrace.captureLegacyDetection).toHaveBeenCalledWith(
        'legacy-action',
        expect.objectContaining({
          hasStringTargets: true,
          hasScopeOnly: false,
          hasLegacyFields: false,
          detectedFormat: 'string_targets',
          requiresConversion: true,
        })
      );
    });
  });

  describe('Action-Aware Tracing with Legacy Conversion (line 190)', () => {
    it('should capture legacy conversion when trace has captureLegacyConversion method', async () => {
      // Setup action-aware trace with captureLegacyConversion
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        captureLegacyConversion: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const legacyAction = {
        id: 'legacy-action-2',
        scope: 'actor.location.actors[]', // Scope-only legacy format
      };

      mockContext.candidateActions = [legacyAction];
      mockContext.trace = mockTrace;

      // Setup legacy action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      const conversionResult = {
        isLegacy: true,
        targetDefinitions: {
          primary: { scope: legacyAction.scope, placeholder: 'target' },
        },
        error: null,
      };
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        conversionResult
      );
      mockDeps.legacyTargetCompatibilityLayer.getMigrationSuggestion.mockReturnValue(
        'Migrate to modern multi-target format'
      );

      // Setup target resolver to return success
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([
          {
            type: 'entity',
            entityId: 'npc1',
            displayName: 'NPC',
            placeholder: 'target',
          },
        ])
      );

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        'NPC'
      );
      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'npc1',
        components: {},
      });

      // Execute
      await stage.executeInternal(mockContext);

      // Verify captureLegacyConversion was called (line 190)
      expect(mockTrace.captureLegacyConversion).toHaveBeenCalledWith(
        'legacy-action-2',
        expect.objectContaining({
          isLegacy: true,
          originalAction: legacyAction,
          targetDefinitions: conversionResult.targetDefinitions,
          processingTime: expect.any(Number),
          error: null,
          migrationSuggestion: 'Migrate to modern multi-target format',
          success: true,
        })
      );
    });
  });

  describe('Scope Evaluation Capture for contextFrom Targets (line 593)', () => {
    it('should capture scope evaluation for targets with contextFrom dependencies', async () => {
      // Setup action-aware trace with captureScopeEvaluation and captureMultiTargetResolution
      const mockTrace = {
        captureActionData: jest.fn(),
        captureScopeEvaluation: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const multiTargetAction = {
        id: 'multi-target-action',
        targets: {
          primary: {
            scope: 'actor.location.actors[]',
            placeholder: 'primaryTarget',
          },
          secondary: {
            scope: 'target.inventory.items[]',
            placeholder: 'secondaryTarget',
            contextFrom: 'primary', // This target depends on primary
          },
        },
      };

      mockContext.candidateActions = [multiTargetAction];
      mockContext.trace = mockTrace;

      // Setup multi-target action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
      ]);

      // Setup primary target resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['actor1', 'actor2']))
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        components: {},
      }));

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Display_${id}`
      );

      // Setup secondary target resolution (contextFrom primary)
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['item1']))
      );
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['item2']))
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify captureScopeEvaluation was called for contextFrom target (line 593)
      expect(mockTrace.captureScopeEvaluation).toHaveBeenCalledWith(
        'multi-target-action',
        'secondary',
        expect.objectContaining({
          scope: 'target.inventory.items[]',
          context: 'primary',
          resultCount: 2,
          evaluationTimeMs: expect.any(Number),
          cacheHit: false,
        })
      );
    });
  });

  describe('Scope Evaluation Capture for Regular Targets (line 673)', () => {
    it('should capture scope evaluation for regular targets without contextFrom', async () => {
      // Setup action-aware trace with captureScopeEvaluation and captureMultiTargetResolution
      const mockTrace = {
        captureActionData: jest.fn(),
        captureScopeEvaluation: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const multiTargetAction = {
        id: 'regular-target-action',
        targets: {
          primary: {
            scope: 'actor.location.items[]',
            placeholder: 'targetItem',
          },
        },
      };

      mockContext.candidateActions = [multiTargetAction];
      mockContext.trace = mockTrace;

      // Setup multi-target action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Setup target resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['item1', 'item2', 'item3']))
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        components: {},
      }));

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Display_${id}`
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify captureScopeEvaluation was called for regular target (line 673)
      expect(mockTrace.captureScopeEvaluation).toHaveBeenCalledWith(
        'regular-target-action',
        'primary',
        expect.objectContaining({
          scope: 'actor.location.items[]',
          context: 'actor',
          resultCount: 3,
          evaluationTimeMs: expect.any(Number),
          cacheHit: false,
        })
      );
    });
  });

  describe('Multi-Target Resolution with Context Dependencies (lines 701-710)', () => {
    it('should capture multi-target resolution with hasContextDependencies flag', async () => {
      // Setup action-aware trace with captureMultiTargetResolution
      const mockTrace = {
        captureActionData: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
        captureScopeEvaluation: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const multiTargetAction = {
        id: 'complex-multi-target',
        targets: {
          primary: {
            scope: 'actor.followers[]',
            placeholder: 'follower',
          },
          secondary: {
            scope: 'target.weapons[]',
            placeholder: 'weapon',
            contextFrom: 'primary', // Has context dependency
          },
          tertiary: {
            scope: 'actor.location.exits[]',
            placeholder: 'exit',
            // No contextFrom, so no dependency
          },
        },
      };

      mockContext.candidateActions = [multiTargetAction];
      mockContext.trace = mockTrace;

      // Setup multi-target action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
        'secondary',
        'tertiary',
      ]);

      // Setup primary target resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['follower1']))
      );

      // Setup secondary target resolution (with contextFrom)
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['weapon1']))
      );

      // Setup tertiary target resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValueOnce(
        ActionResult.success(new Set(['exit1', 'exit2']))
      );

      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        components: {},
      }));

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Display_${id}`
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify captureMultiTargetResolution was called with hasContextDependencies (lines 701-710)
      expect(mockTrace.captureMultiTargetResolution).toHaveBeenCalledWith(
        'complex-multi-target',
        expect.objectContaining({
          targetKeys: ['primary', 'secondary', 'tertiary'],
          resolvedCounts: {
            primary: 1,
            secondary: 1,
            tertiary: 2,
          },
          totalTargets: 4,
          resolutionOrder: ['primary', 'secondary', 'tertiary'],
          hasContextDependencies: true, // This is the key flag from lines 709-710
          resolutionTimeMs: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling in Trace Capture (line 899)', () => {
    it('should handle errors when capturing trace resolution error fails', async () => {
      // Setup action-aware trace that throws error
      const mockTrace = {
        captureActionData: jest.fn().mockImplementation(() => {
          throw new Error('Trace capture failed');
        }),
        captureLegacyDetection: jest.fn(),
        captureLegacyConversion: jest.fn(),
        captureScopeEvaluation: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const badAction = {
        id: 'bad-action',
        targets: {
          primary: {
            scope: 'invalid.scope[]',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [badAction];
      mockContext.trace = mockTrace;

      // Setup multi-target action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Setup scope resolution to fail
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.failure('Invalid scope')
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify warning was logged when trace capture failed (line 899)
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'TargetResolutionTracingOrchestrator: Failed to capture target resolution error'
        ),
        expect.any(Error)
      );
    });
  });

  describe('#analyzeLegacyFormat Helper Method (lines 948-966)', () => {
    it('should analyze legacy format with string targets', async () => {
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const stringTargetsAction = {
        id: 'string-targets-action',
        targets: 'actor.location.actors[]', // String targets
      };

      mockContext.candidateActions = [stringTargetsAction];
      mockContext.trace = mockTrace;

      // Setup legacy action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: {
              scope: stringTargetsAction.targets,
              placeholder: 'target',
            },
          },
        }
      );

      // Setup target resolver
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([])
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify the legacy detection was called with correct format analysis
      expect(mockTrace.captureLegacyDetection).toHaveBeenCalledWith(
        'string-targets-action',
        expect.objectContaining({
          detectedFormat: 'string_targets', // Lines 963
        })
      );
    });

    it('should analyze legacy format with scope property only', async () => {
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const scopeOnlyAction = {
        id: 'scope-only-action',
        scope: 'actor.location.actors[]', // Scope property without targets
      };

      mockContext.candidateActions = [scopeOnlyAction];
      mockContext.trace = mockTrace;

      // Setup legacy action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: scopeOnlyAction.scope, placeholder: 'target' },
          },
        }
      );

      // Setup target resolver
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([])
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify the legacy detection was called with correct format analysis
      expect(mockTrace.captureLegacyDetection).toHaveBeenCalledWith(
        'scope-only-action',
        expect.objectContaining({
          detectedFormat: 'scope_property', // Lines 964
        })
      );
    });

    it('should analyze legacy format with targetType/targetCount', async () => {
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const legacyTargetTypeAction = {
        id: 'legacy-type-action',
        targetType: 'entity',
        targetCount: 1,
      };

      mockContext.candidateActions = [legacyTargetTypeAction];
      mockContext.trace = mockTrace;

      // Setup legacy action behavior
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

      // Setup target resolver
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([])
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify the legacy detection was called with correct format analysis
      expect(mockTrace.captureLegacyDetection).toHaveBeenCalledWith(
        'legacy-type-action',
        expect.objectContaining({
          detectedFormat: 'legacy_target_type', // Lines 965
        })
      );
    });

    it('should analyze modern format', async () => {
      const mockTrace = {
        captureActionData: jest.fn(),
        captureLegacyDetection: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
      };

      const modernAction = {
        id: 'modern-action',
        targets: {
          primary: {
            scope: 'actor.location.actors[]',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [modernAction];
      mockContext.trace = mockTrace;

      // Setup as legacy to test the detection logic
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: false,
          targetDefinitions: modernAction.targets,
        }
      );

      // Setup target resolver
      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([])
      );

      // Execute
      await stage.executeInternal(mockContext);

      // Verify the legacy detection was called with modern format analysis
      expect(mockTrace.captureLegacyDetection).toHaveBeenCalledWith(
        'modern-action',
        expect.objectContaining({
          detectedFormat: 'modern', // Lines 966
        })
      );
    });
  });

  describe('Edge Cases and Additional Coverage', () => {
    it('should handle error in post-resolution summary capture (line 948)', async () => {
      // This test covers the catch block in #capturePostResolutionSummary
      // Setup legacy action to ensure we have tracedActionCount > 0
      const mockTrace = {
        captureActionData: jest.fn(),
        captureMultiTargetResolution: jest.fn(),
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const action = {
        id: 'test-action',
        targets: {
          primary: {
            scope: 'actor.location',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [action];
      mockContext.trace = mockTrace;

      // Setup multi-target action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Setup successful resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity1']))
      );

      mockDeps.entityManager.getEntityInstance.mockReturnValue({
        id: 'entity1',
        components: {},
      });

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockReturnValue(
        'Entity 1'
      );

      // Mock the logger.debug to throw an error only when called with summary data
      mockDeps.logger.debug.mockImplementation((message) => {
        // Only throw on the post-resolution summary call
        if (message && message.includes('Captured post-resolution summary')) {
          throw new Error('Logger error');
        }
        // Otherwise, do nothing (normal mock behavior)
      });

      // Execute - should not throw despite the logger error
      await stage.executeInternal(mockContext);

      // Verify the warning was logged (line 948)
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        'Failed to capture post-resolution summary for tracing',
        expect.any(Error)
      );
    });

    it('should handle missing entity instances during resolution', async () => {
      const multiTargetAction = {
        id: 'missing-entity-action',
        targets: {
          primary: {
            scope: 'actor.location.actors[]',
            placeholder: 'target',
          },
        },
      };

      mockContext.candidateActions = [multiTargetAction];

      // Setup multi-target action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );
      mockDeps.targetDependencyResolver.getResolutionOrder.mockReturnValue([
        'primary',
      ]);

      // Setup scope resolution
      mockDeps.unifiedScopeResolver.resolve.mockResolvedValue(
        ActionResult.success(new Set(['entity1', 'entity2', 'entity3']))
      );

      // Make some entities return null
      mockDeps.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity2') return null; // Missing entity
        return { id, components: {} };
      });

      mockDeps.targetDisplayNameResolver.getEntityDisplayName.mockImplementation(
        (id) => `Display_${id}`
      );

      // Execute
      const result = await stage.executeInternal(mockContext);

      // Verify only valid entities are included
      expect(result.success).toBe(true);
      expect(
        result.data.actionsWithTargets[0].resolvedTargets.primary
      ).toHaveLength(2); // Only entity1 and entity3
    });

    it('should handle trace methods that are missing', async () => {
      // Setup trace without some methods
      const mockTrace = {
        captureActionData: jest.fn(),
        // Missing captureLegacyDetection, captureLegacyConversion, etc.
        step: jest.fn(),
        info: jest.fn(),
      };

      const legacyAction = {
        id: 'legacy-no-trace',
        targets: 'actor.location',
      };

      mockContext.candidateActions = [legacyAction];
      mockContext.trace = mockTrace;

      // Setup legacy action
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          isLegacy: true,
          targetDefinitions: {
            primary: { scope: legacyAction.targets, placeholder: 'target' },
          },
        }
      );

      mockDeps.targetResolver.resolveTargets.mockResolvedValue(
        ActionResult.success([])
      );

      // Execute - should not throw even if trace methods are missing
      const result = await stage.executeInternal(mockContext);

      expect(result.success).toBe(true);
      // Should not have called missing methods
      expect(mockTrace.captureLegacyDetection).toBeUndefined();
    });
  });
});
