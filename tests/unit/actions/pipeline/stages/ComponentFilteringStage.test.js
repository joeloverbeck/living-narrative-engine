/**
 * @file Unit tests for ComponentFilteringStage
 * @see src/actions/pipeline/stages/ComponentFilteringStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ComponentFilteringStage } from '../../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';

describe('ComponentFilteringStage', () => {
  let stage;
  let mockActionIndex;
  let mockErrorContextBuilder;
  let mockLogger;
  let mockEntityManager;
  let mockActor;
  let mockTrace;

  beforeEach(() => {
    mockActionIndex = {
      getCandidateActions: jest.fn(),
      getCandidateActionsWithDiagnostics: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        error: 'Mock error context',
        phase: ERROR_PHASES.DISCOVERY,
        actorId: 'test-actor',
        actionDef: { id: 'candidateRetrieval', name: 'Candidate Retrieval' },
        additionalContext: {
          stage: 'component_filtering',
        },
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getAllComponentTypesForEntity: jest
        .fn()
        .mockReturnValue(['core:actor', 'core:position']),
    };

    mockActor = {
      id: 'test-actor-123',
      components: ['core:actor', 'core:position'],
    };

    mockTrace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      data: jest.fn(),
    };

    stage = new ComponentFilteringStage(
      mockActionIndex,
      mockErrorContextBuilder,
      mockLogger,
      mockEntityManager
    );
  });

  describe('Constructor & Basic Setup', () => {
    it('should create a ComponentFilteringStage instance with correct name', () => {
      expect(stage).toBeInstanceOf(ComponentFilteringStage);
      expect(stage.name).toBe('ComponentFiltering');
    });

    it('should store injected dependencies', () => {
      // Dependencies are private, but we can verify through behavior
      expect(stage).toBeDefined();
    });
  });

  describe('Successful Execution', () => {
    it('should successfully filter and return candidate actions', async () => {
      const candidateActions = [
        { id: 'action1', name: 'Move' },
        { id: 'action2', name: 'Look' },
        { id: 'action3', name: 'Inventory' },
      ];

      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);
      expect(result.data.candidateActions).toHaveLength(3);
    });

    it('should handle empty candidate actions array', async () => {
      mockActionIndex.getCandidateActions.mockReturnValue([]);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual([]);
      expect(result.continueProcessing).toBe(false);
    });

    it('should call ActionIndex.getCandidateActions with correct parameters', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionIndex.getCandidateActions).toHaveBeenCalledWith(
        mockActor,
        mockTrace
      );
      expect(mockActionIndex.getCandidateActions).toHaveBeenCalledTimes(1);
    });

    it('should log debug information about candidate count', async () => {
      const candidateActions = [
        { id: 'action1', name: 'Action 1' },
        { id: 'action2', name: 'Action 2' },
      ];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Found ${candidateActions.length} candidate actions for actor ${mockActor.id}`
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle ActionIndex.getCandidateActions throwing an error', async () => {
      const testError = new Error('Failed to get candidate actions');
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw testError;
      });

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        error: 'Mock error context',
        phase: ERROR_PHASES.DISCOVERY,
        actorId: 'test-actor',
        actionDef: { id: 'candidateRetrieval', name: 'Candidate Retrieval' },
        additionalContext: {
          stage: 'component_filtering',
        },
      });
    });

    it('should build error context with correct parameters when error occurs', async () => {
      const testError = new Error('ActionIndex failure');
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw testError;
      });

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: testError,
        actionDef: { id: 'candidateRetrieval', name: 'Candidate Retrieval' },
        actorId: mockActor.id,
        phase: 'discovery',
        trace: mockTrace,
        additionalContext: {
          stage: 'component_filtering',
        },
      });
    });

    it('should log error when ActionIndex.getCandidateActions fails', async () => {
      const testError = new Error('Test error message');
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw testError;
      });

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error retrieving candidate actions: ${testError.message}`,
        testError
      );
    });

    it('should return failure PipelineResult with error contexts array', async () => {
      const testError = new Error('Catastrophic failure');
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw testError;
      });

      const errorContext = {
        error: 'Test error context',
        phase: ERROR_PHASES.DISCOVERY,
        actorId: mockActor.id,
      };
      mockErrorContextBuilder.buildErrorContext.mockReturnValue(errorContext);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([errorContext]);
    });
  });

  describe('Tracing Integration', () => {
    it('should record trace steps during execution', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockTrace.step).toHaveBeenCalledWith(
        `Filtering actions for actor ${mockActor.id} based on components`,
        'ComponentFilteringStage.execute'
      );
    });

    it('should record success trace with candidate count', async () => {
      const candidateActions = [
        { id: 'action1', name: 'Action 1' },
        { id: 'action2', name: 'Action 2' },
        { id: 'action3', name: 'Action 3' },
      ];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockTrace.success).toHaveBeenCalledWith(
        `Component filtering completed: ${candidateActions.length} candidates`,
        'ComponentFilteringStage.execute',
        { candidateCount: candidateActions.length }
      );
    });

    it('should record trace info when no candidate actions found', async () => {
      mockActionIndex.getCandidateActions.mockReturnValue([]);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      await stage.executeInternal(context);

      expect(mockTrace.info).toHaveBeenCalledWith(
        'No candidate actions found for actor',
        'ComponentFilteringStage.execute'
      );
    });

    it('should work without trace context', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        // No trace provided
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);
      // Should not throw errors even without trace
    });
  });

  describe('Edge Cases', () => {
    it('should handle context with missing actor gracefully by throwing error', async () => {
      const context = {
        // No actor provided
        trace: mockTrace,
      };

      // The stage will fail when trying to access actor.id in the trace step
      await expect(stage.executeInternal(context)).rejects.toThrow();
    });

    it('should handle context with null actor gracefully by throwing error', async () => {
      const context = {
        actor: null,
        trace: mockTrace,
      };

      // The stage will fail when trying to access actor.id in the trace step
      await expect(stage.executeInternal(context)).rejects.toThrow();
    });

    it('should handle ActionIndex returning null by throwing error', async () => {
      mockActionIndex.getCandidateActions.mockReturnValue(null);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      // Should catch the error and return failure result
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalled();
    });

    it('should handle ActionIndex returning undefined by throwing error', async () => {
      mockActionIndex.getCandidateActions.mockReturnValue(undefined);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      // Should catch the error and return failure result
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalled();
    });

    it('should continue processing when candidate actions are found', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      // continueProcessing defaults to true for successful results
      expect(result.continueProcessing).toBe(true);
    });

    it('should handle large numbers of candidate actions', async () => {
      const largeCandidateActions = Array.from({ length: 1000 }, (_, i) => ({
        id: `action${i}`,
        name: `Action ${i}`,
      }));

      mockActionIndex.getCandidateActions.mockReturnValue(
        largeCandidateActions
      );

      const context = {
        actor: mockActor,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toHaveLength(1000);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Found 1000 candidate actions for actor ${mockActor.id}`
      );
    });
  });

  describe('Action-Aware Tracing', () => {
    let mockActionAwareTrace;

    beforeEach(() => {
      mockActionAwareTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        data: jest.fn(),
        captureActionData: jest.fn(),
      };
    });

    it('should detect action-aware trace and capture component data', async () => {
      const candidateActions = [
        {
          id: 'movement:go',
          name: 'Go',
          required_components: { actor: ['core:position'] },
          forbidden_components: { actor: [] },
        },
        {
          id: 'core:look',
          name: 'Look',
          required_components: { actor: [] },
          forbidden_components: { actor: ['core:blind'] },
        },
      ];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:position',
      ]);

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Verify EntityManager was called to get actor components
      expect(
        mockEntityManager.getAllComponentTypesForEntity
      ).toHaveBeenCalledWith(mockActor.id);

      // Verify captureActionData was called for each candidate action
      // Note: Each action gets TWO calls - one for component analysis, one for performance data (ACTTRA-018)
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledTimes(4);

      // Check first action capture
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'movement:go',
        expect.objectContaining({
          stage: 'component_filtering',
          actorId: mockActor.id,
          actorComponents: ['core:actor', 'core:position'],
          requiredComponents: ['core:position'],
          forbiddenComponents: [],
          componentMatchPassed: true,
          missingComponents: [],
          forbiddenComponentsPresent: [],
          analysisMethod: 'post-processing',
          timestamp: expect.any(Number),
        })
      );

      // Check second action capture
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'core:look',
        expect.objectContaining({
          stage: 'component_filtering',
          actorId: mockActor.id,
          actorComponents: ['core:actor', 'core:position'],
          requiredComponents: [],
          forbiddenComponents: ['core:blind'],
          componentMatchPassed: true,
          missingComponents: [],
          forbiddenComponentsPresent: [],
          analysisMethod: 'post-processing',
          timestamp: expect.any(Number),
        })
      );

      // Check performance data captures (ACTTRA-018)
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'stage_performance',
        'movement:go',
        expect.objectContaining({
          stage: 'component_filtering',
          duration: expect.any(Number),
          timestamp: expect.any(Number),
          itemsProcessed: 2,
          stageName: 'ComponentFiltering',
        })
      );

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'stage_performance',
        'core:look',
        expect.objectContaining({
          stage: 'component_filtering',
          duration: expect.any(Number),
          timestamp: expect.any(Number),
          itemsProcessed: 2,
          stageName: 'ComponentFiltering',
        })
      );
    });

    it('should work normally without action-aware trace', async () => {
      const candidateActions = [{ id: 'movement:go', name: 'Go' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace, // Regular trace, not action-aware
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // EntityManager should NOT be called for regular traces
      expect(
        mockEntityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
    });

    it('should handle missing required components in trace data', async () => {
      const candidateActions = [
        {
          id: 'core:climb',
          name: 'Climb',
          required_components: { actor: ['core:position', 'core:climbing'] },
          forbidden_components: { actor: [] },
        },
      ];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:position',
        // Note: 'core:climbing' is missing
      ]);

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'core:climb',
        expect.objectContaining({
          actorComponents: ['core:actor', 'core:position'],
          requiredComponents: ['core:position', 'core:climbing'],
          missingComponents: ['core:climbing'], // Should detect missing component
          componentMatchPassed: true, // Still true because it's in candidateActions
        })
      );
    });

    it('should handle forbidden components present in trace data', async () => {
      const candidateActions = [
        {
          id: 'core:stealth',
          name: 'Stealth',
          required_components: { actor: [] },
          forbidden_components: { actor: ['core:noisy'] },
        },
      ];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue([
        'core:actor',
        'core:position',
        'core:noisy', // Has a forbidden component (but still in candidates somehow)
      ]);

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'core:stealth',
        expect.objectContaining({
          forbiddenComponents: ['core:noisy'],
          forbiddenComponentsPresent: ['core:noisy'], // Should detect forbidden component
          componentMatchPassed: true, // Still true because it's in candidateActions
        })
      );
    });

    it('should handle EntityManager errors gracefully', async () => {
      const candidateActions = [{ id: 'movement:go', name: 'Go' }];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });
      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(() => {
        throw new Error('EntityManager error');
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      // Should still succeed even if EntityManager fails
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Should log warning about failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get actor components for tracing')
      );

      // Should still capture action data with empty components
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'movement:go',
        expect.objectContaining({
          actorComponents: [], // Empty due to error
        })
      );
    });

    it('should handle captureActionData errors gracefully', async () => {
      const candidateActions = [{ id: 'movement:go', name: 'Go' }];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });
      mockActionAwareTrace.captureActionData.mockImplementation(() => {
        throw new Error('Capture error');
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      // Should still succeed even if capture fails
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Should log warning about capture failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture component analysis')
      );
    });

    it('should not capture data if trace lacks captureActionData method', async () => {
      const candidateActions = [{ id: 'movement:go', name: 'Go' }];

      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      // Trace without captureActionData method
      const incompleteTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        // No captureActionData method
      };

      const context = {
        actor: mockActor,
        trace: incompleteTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Should not call EntityManager if trace isn't fully action-aware
      expect(
        mockEntityManager.getAllComponentTypesForEntity
      ).not.toHaveBeenCalled();
    });

    it('should handle empty candidateActions with action-aware trace', async () => {
      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: [],
        rejected: [],
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual([]);
      expect(result.continueProcessing).toBe(false);

      // Should not capture any action data when no candidates
      expect(mockActionAwareTrace.captureActionData).not.toHaveBeenCalled();
    });

    it('should handle null EntityManager gracefully', async () => {
      // Create stage without EntityManager
      const stageWithoutEM = new ComponentFilteringStage(
        mockActionIndex,
        mockErrorContextBuilder,
        mockLogger,
        null // No EntityManager
      );

      const candidateActions = [{ id: 'movement:go', name: 'Go' }];

      // Use diagnostic method since action-aware trace is present
      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stageWithoutEM.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Should still capture action data with empty components
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering',
        'movement:go',
        expect.objectContaining({
          actorComponents: [], // Empty because no EntityManager
        })
      );
    });
  });

  describe('Diagnostic Mode (ACTDISDIAFAIFAS-006)', () => {
    let mockActionAwareTrace;

    beforeEach(() => {
      mockActionAwareTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        data: jest.fn(),
        captureActionData: jest.fn(),
      };
    });

    it('should use getCandidateActionsWithDiagnostics when action-aware trace is present', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      const rejected = [];

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected,
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);
      expect(
        mockActionIndex.getCandidateActionsWithDiagnostics
      ).toHaveBeenCalledWith(mockActor, mockActionAwareTrace);
      // Regular getCandidateActions should NOT be called when diagnostics is used
      expect(mockActionIndex.getCandidateActions).not.toHaveBeenCalled();
    });

    it('should use getCandidateActions when no action-aware trace (performance protection)', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: mockTrace, // Regular trace, not action-aware
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockActionIndex.getCandidateActions).toHaveBeenCalledWith(
        mockActor,
        mockTrace
      );
      // Diagnostic method should NOT be called
      expect(
        mockActionIndex.getCandidateActionsWithDiagnostics
      ).not.toHaveBeenCalled();
    });

    it('should capture rejected actions in trace when diagnostics enabled', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      const rejected = [
        {
          actionId: 'personal-space:get_close',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['personal-space-states:closeness'],
          actorHasComponents: ['personal-space-states:closeness'],
        },
      ];

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected,
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      // Should capture rejection diagnostics
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering_rejections',
        'stage',
        expect.objectContaining({
          stageName: 'ComponentFilteringStage',
          diagnostics: {
            rejectedActions: [
              {
                actionId: 'personal-space:get_close',
                reason: 'FORBIDDEN_COMPONENT',
                forbiddenComponents: ['personal-space-states:closeness'],
                actorHasComponents: ['personal-space-states:closeness'],
              },
            ],
          },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should track multiple rejections in trace', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      const rejected = [
        {
          actionId: 'action-a',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['comp1'],
          actorHasComponents: ['comp1'],
        },
        {
          actionId: 'action-b',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['comp2'],
          actorHasComponents: ['comp2'],
        },
        {
          actionId: 'action-c',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['comp3'],
          actorHasComponents: ['comp3'],
        },
      ];

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected,
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'component_filtering_rejections',
        'stage',
        expect.objectContaining({
          diagnostics: {
            rejectedActions: expect.arrayContaining([
              expect.objectContaining({ actionId: 'action-a' }),
              expect.objectContaining({ actionId: 'action-b' }),
              expect.objectContaining({ actionId: 'action-c' }),
            ]),
          },
        })
      );
    });

    it('should not capture rejection data when rejection array is empty', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      const rejected = []; // Empty - all actions passed

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected,
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      // Should NOT capture rejection data when array is empty
      const rejectionCalls = mockActionAwareTrace.captureActionData.mock.calls.filter(
        (call) => call[0] === 'component_filtering_rejections'
      );
      expect(rejectionCalls).toHaveLength(0);
    });

    it('should handle captureActionData error for rejections gracefully', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      const rejected = [
        {
          actionId: 'rejected-action',
          reason: 'FORBIDDEN_COMPONENT',
          forbiddenComponents: ['comp'],
          actorHasComponents: ['comp'],
        },
      ];

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected,
      });

      // Make captureActionData throw for rejections
      mockActionAwareTrace.captureActionData.mockImplementation((type) => {
        if (type === 'component_filtering_rejections') {
          throw new Error('Capture failed');
        }
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      // Should still succeed even if rejection capture fails
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual(candidateActions);

      // Should log warning about failure
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture rejection diagnostics')
      );
    });

    it('should maintain backward compatibility - existing tests still pass', async () => {
      // This test verifies that the stage output format hasn't changed
      const candidateActions = [
        { id: 'action1', name: 'Move' },
        { id: 'action2', name: 'Look' },
      ];

      mockActionIndex.getCandidateActionsWithDiagnostics.mockReturnValue({
        candidates: candidateActions,
        rejected: [],
      });

      const context = {
        actor: mockActor,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      // Output structure must be identical to before
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('candidateActions');
      expect(result.data.candidateActions).toEqual(candidateActions);
      expect(result.continueProcessing).toBe(true);
    });

    it('should use getCandidateActions when trace is null (no overhead)', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      const context = {
        actor: mockActor,
        trace: null,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockActionIndex.getCandidateActions).toHaveBeenCalled();
      expect(
        mockActionIndex.getCandidateActionsWithDiagnostics
      ).not.toHaveBeenCalled();
    });

    it('should use getCandidateActions when trace lacks captureActionData method', async () => {
      const candidateActions = [{ id: 'action1', name: 'Test Action' }];
      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);

      // Trace without captureActionData method
      const incompleteTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
      };

      const context = {
        actor: mockActor,
        trace: incompleteTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockActionIndex.getCandidateActions).toHaveBeenCalled();
      expect(
        mockActionIndex.getCandidateActionsWithDiagnostics
      ).not.toHaveBeenCalled();
    });
  });
});
