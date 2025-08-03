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
  let mockActor;
  let mockTrace;

  beforeEach(() => {
    mockActionIndex = {
      getCandidateActions: jest.fn(),
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
      mockLogger
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
});
