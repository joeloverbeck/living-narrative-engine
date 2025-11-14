import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetResolutionTracingOrchestrator from '../../../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';

describe('MultiTargetResolutionStage - Action Tracing', () => {
  let stage;
  let mockDeps;
  let mockContext;
  let mockTrace;
  let capturedTraceData;

  beforeEach(() => {
    capturedTraceData = [];

    // Create mock trace with action-aware capabilities
    mockTrace = {
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

    // Create mock dependencies
    mockDeps = {
      targetDependencyResolver: {
        getResolutionOrder: jest.fn().mockReturnValue(['primary']),
      },
      legacyTargetCompatibilityLayer: {
        isLegacyAction: jest.fn(),
        convertLegacyFormat: jest.fn(),
        getMigrationSuggestion: jest.fn(),
      },
      scopeContextBuilder: {
        buildScopeContext: jest.fn().mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
        }),
        buildScopeContextForSpecificPrimary: jest.fn().mockReturnValue({
          actor: { id: 'player' },
          location: { id: 'room' },
        }),
      },
      targetDisplayNameResolver: {
        getEntityDisplayName: jest
          .fn()
          .mockImplementation((id) => `${id}_display`),
      },
      unifiedScopeResolver: {
        resolve: jest.fn().mockResolvedValue({
          success: true,
          value: new Set(['entity1', 'entity2']),
        }),
      },
      entityManager: {
        getEntityInstance: jest.fn().mockImplementation((id) => ({
          id,
          type: 'entity',
        })),
      },
      targetResolver: {
        resolveTargets: jest.fn().mockResolvedValue({
          success: true,
          value: [
            { entityId: 'entity1', type: 'entity' },
            { entityId: 'entity2', type: 'entity' },
          ],
        }),
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

    // Create stage instance
    stage = new MultiTargetResolutionStage(mockDeps);

    // Create mock context
    mockContext = {
      actor: { id: 'player' },
      actionContext: { location: 'room' },
      candidateActions: [],
      trace: mockTrace,
      data: {},
    };
  });

  describe('Trace Detection', () => {
    it('should detect ActionAwareStructuredTrace correctly', async () => {
      mockContext.candidateActions = [
        { id: 'test_action', targets: { primary: { scope: 'test_scope' } } },
      ];

      await stage.executeInternal(mockContext);

      expect(mockDeps.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Action tracing enabled'),
        expect.objectContaining({ actorId: 'player' })
      );
    });

    it('should not enable tracing when captureActionData is not available', async () => {
      mockContext.trace = { step: jest.fn(), info: jest.fn() }; // No captureActionData
      mockContext.candidateActions = [
        { id: 'test_action', targets: { primary: { scope: 'test_scope' } } },
      ];

      await stage.executeInternal(mockContext);

      expect(capturedTraceData).toHaveLength(0);
      expect(mockDeps.logger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Action tracing enabled'),
        expect.any(Object)
      );
    });
  });

  describe('Legacy Action Tracing', () => {
    it('should capture trace data for legacy actions', async () => {
      const actionDef = { id: 'legacy_action', scope: 'legacy_scope' };
      mockContext.candidateActions = [actionDef];

      // Setup legacy action behavior
      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'legacy_scope', placeholder: 'target' },
          },
        }
      );

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      // Check that trace data was captured
      expect(targetResolutionData).toHaveLength(1);
      const traceData = targetResolutionData[0];

      expect(traceData.stage).toBe('target_resolution');
      expect(traceData.actionId).toBe('legacy_action');
      expect(traceData.data.isLegacy).toBe(true);
      expect(traceData.data.resolutionSuccess).toBe(true);
      expect(traceData.data.scope).toBe('legacy_scope');
      expect(traceData.data.targetCount).toBe(2); // Two entities resolved
    });

    it('should capture legacy action with no targets', async () => {
      const actionDef = { id: 'legacy_action_no_targets', scope: 'none' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: {
            primary: { scope: 'none', placeholder: 'target' },
          },
        }
      );
      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [],
      });

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      expect(targetResolutionData).toHaveLength(1);
      const traceData = targetResolutionData[0];

      expect(traceData.data.targetCount).toBe(0);
      expect(traceData.data.resolutionSuccess).toBe(true);
    });
  });

  describe('Multi-Target Action Tracing', () => {
    it('should capture trace data for multi-target actions', async () => {
      const actionDef = {
        id: 'multi_action',
        targets: {
          primary: { scope: 'primary_scope' },
          secondary: { scope: 'secondary_scope' },
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

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      expect(targetResolutionData).toHaveLength(1);
      const traceData = targetResolutionData[0];

      expect(traceData.stage).toBe('target_resolution');
      expect(traceData.actionId).toBe('multi_action');
      expect(traceData.data.isLegacy).toBe(false);
      expect(traceData.data.resolutionSuccess).toBe(true);
      expect(traceData.data.targetKeys).toEqual(['primary', 'secondary']);
      expect(traceData.data.resolvedTargetCounts).toEqual({
        primary: 2,
        secondary: 2,
      });
      expect(traceData.data.targetCount).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should capture resolution errors in trace', async () => {
      const actionDef = { id: 'error_action', scope: 'error_scope' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'error_scope' } },
        }
      );

      const testError = new Error('Resolution failed');
      testError.scopeName = 'error_scope';
      mockDeps.targetResolver.resolveTargets.mockRejectedValue(testError);

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      // Should capture error data
      expect(targetResolutionData).toHaveLength(1);
      const errorTrace = targetResolutionData[0];

      expect(errorTrace.data.resolutionFailed).toBe(true);
      expect(errorTrace.data.error).toBe('Resolution failed');
      expect(errorTrace.data.scopeName).toBe('error_scope');
    });

    it('should continue processing when trace capture fails', async () => {
      const actionDef = { id: 'test_action', scope: 'test_scope' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'test_scope' } },
        }
      );

      // Make trace capture throw an error
      mockTrace.captureActionData = jest.fn(() => {
        throw new Error('Trace capture failed');
      });

      const result = await stage.executeInternal(mockContext);

      // Should still succeed despite trace failure
      expect(result.success).toBe(true);
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture'),
        expect.any(Error)
      );
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal overhead when tracing is disabled', async () => {
      mockContext.trace = { step: jest.fn(), info: jest.fn() }; // No captureActionData

      // Create many actions
      mockContext.candidateActions = Array.from({ length: 20 }, (_, i) => ({
        id: `action_${i}`,
        targets: { primary: { scope: `scope_${i}` } },
      }));

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        false
      );

      const startTime = Date.now();
      await stage.executeInternal(mockContext);
      const endTime = Date.now();

      // Allow a more generous upper bound to avoid flakiness on slower
      // shared runners while still enforcing the stage stays performant.
      expect(endTime - startTime).toBeLessThan(200); // Should be fast
      expect(capturedTraceData).toHaveLength(0);
    });

    it('should capture timing information in trace data', async () => {
      const actionDef = { id: 'timed_action', scope: 'test_scope' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'test_scope' } },
        }
      );

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      const traceData = targetResolutionData[0];
      expect(traceData.data.resolutionTimeMs).toBeDefined();
      expect(typeof traceData.data.resolutionTimeMs).toBe('number');
      expect(traceData.data.resolutionTimeMs).toBeGreaterThanOrEqual(0);
      expect(traceData.data.timestamp).toBeDefined();
    });
  });

  describe('Performance Data Capture (ACTTRA-018)', () => {
    it('should capture performance data for each action', async () => {
      const actionDef = { id: 'perf_action', scope: 'test_scope' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'test_scope' } },
        }
      );

      await stage.executeInternal(mockContext);

      // Filter for performance data entries
      const performanceData = capturedTraceData.filter(
        (d) => d.stage === 'stage_performance'
      );

      expect(performanceData).toHaveLength(1);
      const perfData = performanceData[0];

      expect(perfData.actionId).toBe('perf_action');
      expect(perfData.data.stage).toBe('multi_target_resolution');
      expect(perfData.data.stageName).toBe('MultiTargetResolution');
      expect(perfData.data.duration).toBeDefined();
      expect(typeof perfData.data.duration).toBe('number');
      expect(perfData.data.itemsProcessed).toBe(1);
      expect(perfData.data.itemsResolved).toBe(1);
      expect(perfData.data.timestamp).toBeDefined();
    });

    it('should capture performance data for multiple actions', async () => {
      const action1 = { id: 'perf_action_1', scope: 'test_scope_1' };
      const action2 = {
        id: 'perf_action_2',
        targets: { primary: { scope: 'test_scope_2' } },
      };

      mockContext.candidateActions = [action1, action2];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction
        .mockReturnValueOnce(true) // action1
        .mockReturnValueOnce(false); // action2

      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'test_scope_1' } },
        }
      );

      await stage.executeInternal(mockContext);

      // Filter for performance data entries
      const performanceData = capturedTraceData.filter(
        (d) => d.stage === 'stage_performance'
      );

      expect(performanceData).toHaveLength(2);

      const perf1 = performanceData.find((d) => d.actionId === 'perf_action_1');
      const perf2 = performanceData.find((d) => d.actionId === 'perf_action_2');

      expect(perf1).toBeDefined();
      expect(perf2).toBeDefined();
      expect(perf1.data.itemsProcessed).toBe(2);
      expect(perf2.data.itemsProcessed).toBe(2);
    });

    it('should not break if performance capture fails', async () => {
      const actionDef = { id: 'fail_perf_action', scope: 'test_scope' };
      mockContext.candidateActions = [actionDef];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction.mockReturnValue(
        true
      );
      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'test_scope' } },
        }
      );

      // Mock captureActionData to throw an error for performance data
      const originalCaptureActionData = mockTrace.captureActionData;
      mockTrace.captureActionData = jest.fn((stage, actionId, data) => {
        if (stage === 'stage_performance') {
          throw new Error('Performance capture failed');
        }
        originalCaptureActionData(stage, actionId, data);
      });

      const result = await stage.executeInternal(mockContext);

      // Should still succeed despite performance capture failure
      expect(result.success).toBe(true);

      // Should still have target resolution data
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );
      expect(targetResolutionData).toHaveLength(1);
    });
  });

  describe('Mixed Action Types', () => {
    it('should trace both legacy and multi-target actions in same batch', async () => {
      const legacyAction = { id: 'legacy', scope: 'legacy_scope' };
      const multiAction = {
        id: 'multi',
        targets: { primary: { scope: 'multi_scope' } },
      };

      mockContext.candidateActions = [legacyAction, multiAction];

      mockDeps.legacyTargetCompatibilityLayer.isLegacyAction
        .mockReturnValueOnce(true) // legacy
        .mockReturnValueOnce(false); // multi

      mockDeps.legacyTargetCompatibilityLayer.convertLegacyFormat.mockReturnValue(
        {
          targetDefinitions: { primary: { scope: 'legacy_scope' } },
        }
      );

      await stage.executeInternal(mockContext);

      // Filter out performance data entries (ACTTRA-018)
      const targetResolutionData = capturedTraceData.filter(
        (d) => d.stage === 'target_resolution'
      );

      expect(targetResolutionData).toHaveLength(2);

      const legacyTrace = targetResolutionData.find(
        (t) => t.actionId === 'legacy'
      );
      const multiTrace = targetResolutionData.find(
        (t) => t.actionId === 'multi'
      );

      expect(legacyTrace.data.isLegacy).toBe(true);
      expect(multiTrace.data.isLegacy).toBe(false);
    });
  });
});
