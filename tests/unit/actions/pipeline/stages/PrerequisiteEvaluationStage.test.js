/**
 * @file Unit tests for PrerequisiteEvaluationStage
 * @see src/actions/pipeline/stages/PrerequisiteEvaluationStage.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrerequisiteEvaluationStage } from '../../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';

describe('PrerequisiteEvaluationStage', () => {
  let stage;
  let mockPrerequisiteService;
  let mockErrorContextBuilder;
  let mockLogger;
  let mockActor;
  let mockTrace;
  let mockActionAwareTrace;

  beforeEach(() => {
    mockPrerequisiteService = {
      evaluate: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        error: 'Mock error context',
        phase: ERROR_PHASES.VALIDATION,
        actorId: 'test-actor',
        actionDef: { id: 'test-action', name: 'Test Action' },
        additionalContext: {
          stage: 'prerequisite_evaluation',
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
    };

    mockActionAwareTrace = {
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      captureActionData: jest.fn(),
    };

    stage = new PrerequisiteEvaluationStage(
      mockPrerequisiteService,
      mockErrorContextBuilder,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should create a stage with correct name and dependencies', () => {
      expect(stage.name).toBe('PrerequisiteEvaluation');
      expect(stage).toBeInstanceOf(PrerequisiteEvaluationStage);
    });
  });

  describe('executeInternal', () => {
    describe('actions with no prerequisites', () => {
      it('should pass through actions without prerequisites', async () => {
        const candidateActions = [
          { id: 'action1', name: 'Action 1' },
          { id: 'action2', name: 'Action 2', prerequisites: [] },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual(candidateActions);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).not.toHaveBeenCalled();
      });
    });

    describe('actions with valid prerequisites', () => {
      it('should include actions that pass prerequisite evaluation', async () => {
        const candidateActions = [
          {
            id: 'action1',
            name: 'Action 1',
            prerequisites: [{ condition: 'some condition' }],
          },
          {
            id: 'action2',
            name: 'Action 2',
            prerequisites: [{ condition: 'another condition' }],
          },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual(candidateActions);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledTimes(2);
        expect(mockTrace.success).toHaveBeenCalledTimes(2);
      });
    });

    describe('actions with failed prerequisites', () => {
      it('should exclude actions that fail prerequisite evaluation', async () => {
        const candidateActions = [
          {
            id: 'action1',
            name: 'Action 1',
            prerequisites: [{ condition: 'failing condition' }],
          },
          {
            id: 'action2',
            name: 'Action 2',
            prerequisites: [{ condition: 'passing condition' }],
          },
        ];

        mockPrerequisiteService.evaluate
          .mockReturnValueOnce(false) // action1 fails
          .mockReturnValueOnce(true); // action2 passes

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual([candidateActions[1]]);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledTimes(2);
        expect(mockTrace.success).toHaveBeenCalledTimes(1);
        expect(mockTrace.info).toHaveBeenCalledWith(
          "Action 'action1' failed prerequisite check",
          'PrerequisiteEvaluationStage.execute'
        );
      });
    });

    describe('error handling', () => {
      it('should handle errors from prerequisite service and continue processing', async () => {
        const candidateActions = [
          {
            id: 'action1',
            name: 'Action 1',
            prerequisites: [{ condition: 'error condition' }],
          },
          {
            id: 'action2',
            name: 'Action 2',
            prerequisites: [{ condition: 'valid condition' }],
          },
        ];

        const testError = new Error('Prerequisite evaluation failed');
        mockPrerequisiteService.evaluate
          .mockImplementationOnce(() => {
            throw testError;
          })
          .mockReturnValueOnce(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        // Only action2 should pass since action1 failed due to error
        expect(result.data.candidateActions).toEqual([candidateActions[1]]);
        // Errors are now handled internally - no errors added to prerequisiteErrors array
        expect(result.data.prerequisiteErrors).toHaveLength(0);
        expect(result.errors).toHaveLength(0);

        // Error context builder should not be called since errors are handled internally
        expect(
          mockErrorContextBuilder.buildErrorContext
        ).not.toHaveBeenCalled();

        // Logger should still record the error for debugging
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error evaluating prerequisites for action 'action1'",
          testError
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty candidate actions array', async () => {
        const context = {
          actor: mockActor,
          candidateActions: [],
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual([]);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).not.toHaveBeenCalled();
      });

      it('should handle mixed actions (some pass, some fail, some without prerequisites)', async () => {
        const candidateActions = [
          { id: 'action1', name: 'No Prerequisites' },
          {
            id: 'action2',
            name: 'Failing Prerequisites',
            prerequisites: [{ condition: 'fail' }],
          },
          {
            id: 'action3',
            name: 'Passing Prerequisites',
            prerequisites: [{ condition: 'pass' }],
          },
          { id: 'action4', name: 'Empty Prerequisites', prerequisites: [] },
        ];

        mockPrerequisiteService.evaluate
          .mockReturnValueOnce(false) // action2 fails
          .mockReturnValueOnce(true); // action3 passes

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual([
          candidateActions[0], // no prerequisites
          candidateActions[2], // passed prerequisites
          candidateActions[3], // empty prerequisites
        ]);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledTimes(2);
      });

      it('should handle context without trace', async () => {
        const candidateActions = [
          {
            id: 'action1',
            name: 'Action 1',
            prerequisites: [{ condition: 'some condition' }],
          },
        ];

        // Clear any previous mock calls and setup return value
        mockPrerequisiteService.evaluate.mockClear();

        // Set up mock to throw error to test the error handling path
        // Since the production code catches errors internally, the action should be excluded
        mockPrerequisiteService.evaluate.mockImplementation(() => {
          throw new Error('Mock prerequisite evaluation error');
        });

        const context = {
          actor: mockActor,
          candidateActions,
          // trace is undefined
        };

        const result = await stage.executeInternal(context);

        // The prerequisite service should be called
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledTimes(1);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledWith(
          candidateActions[0].prerequisites,
          candidateActions[0],
          mockActor,
          undefined
        );

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        // Action should be excluded due to error, but no errors in prerequisiteErrors (handled internally)
        expect(result.data.candidateActions).toEqual([]);
        expect(result.data.prerequisiteErrors).toEqual([]);

        // Logger should record the internal error
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error evaluating prerequisites for action 'action1'",
          expect.any(Error)
        );
      });
    });

    describe('logging and tracing', () => {
      it('should log debug messages about evaluation progress', async () => {
        const candidateActions = [
          {
            id: 'action1',
            name: 'Action 1',
            prerequisites: [{ condition: 'some condition' }],
          },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        await stage.executeInternal(context);

        expect(mockTrace.step).toHaveBeenCalledWith(
          'Evaluating prerequisites for 1 candidate actions',
          'PrerequisiteEvaluationStage.execute'
        );

        expect(mockTrace.info).toHaveBeenCalledWith(
          'Prerequisite evaluation completed: 1 valid actions, 0 errors',
          'PrerequisiteEvaluationStage.execute'
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Prerequisite evaluation complete: 1/1 actions passed'
        );
      });
    });
  });

  describe('Action Tracing Enhancement', () => {
    it('should detect ActionAwareStructuredTrace and enable prerequisite tracing', async () => {
      const candidateActions = [
        {
          id: 'core:cast_spell',
          prerequisites: [{ '>=': [{ var: 'mana' }, 10] }],
        },
      ];

      mockPrerequisiteService.evaluate.mockReturnValue(true);

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalled();
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:cast_spell',
        expect.objectContaining({
          hasPrerequisites: true,
          evaluationPassed: true,
        })
      );
    });

    it('should work normally with standard StructuredTrace', async () => {
      const candidateActions = [{ id: 'core:test_action' }];

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockTrace.step).toHaveBeenCalled();
    });

    it('should capture detailed prerequisite data for traced actions', async () => {
      const candidateActions = [
        {
          id: 'core:cast_spell',
          prerequisites: [
            { '>=': [{ var: 'actor.mana' }, 10] },
            { '==': [{ var: 'actor.canCastMagic' }, true] },
          ],
        },
      ];

      mockPrerequisiteService.evaluate.mockReturnValue(true);

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:cast_spell',
        expect.objectContaining({
          stage: 'prerequisite_evaluation',
          actorId: mockActor.id,
          hasPrerequisites: true,
          evaluationPassed: true,
          prerequisiteCount: 2,
        })
      );
    });

    it('should capture actions with no prerequisites', async () => {
      const candidateActions = [
        {
          id: 'core:look',
          // No prerequisites
        },
      ];

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:look',
        expect.objectContaining({
          hasPrerequisites: false,
          evaluationPassed: true,
          evaluationReason: 'No prerequisites defined',
        })
      );
    });

    it('should capture prerequisite evaluation failures', async () => {
      const candidateActions = [
        {
          id: 'core:cast_spell',
          prerequisites: [{ '>=': [{ var: 'actor.mana' }, 100] }],
        },
      ];

      mockPrerequisiteService.evaluate.mockReturnValue(false);

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:cast_spell',
        expect.objectContaining({
          evaluationPassed: false,
          evaluationReason: expect.stringContaining('prerequisites failed'),
        })
      );
    });

    it('should capture performance timing information', async () => {
      const candidateActions = [
        { id: 'core:test_action', prerequisites: [{ var: 'test' }] },
      ];

      mockPrerequisiteService.evaluate.mockReturnValue(true);

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      await stage.executeInternal(context);

      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:test_action',
        expect.objectContaining({
          evaluationTimeMs: expect.any(Number),
        })
      );
    });

    it('should handle prerequisite service errors gracefully', async () => {
      const candidateActions = [
        { id: 'core:error_action', prerequisites: [{ var: 'test' }] },
      ];

      mockPrerequisiteService.evaluate.mockImplementation(() => {
        throw new Error('Prerequisite service error');
      });

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true); // Stage should continue despite errors
      // Action should be excluded since error occurred
      expect(result.data.candidateActions).toEqual([]);

      // The production code doesn't capture trace data in the error path currently
      // It only logs the error internally
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error evaluating prerequisites for action 'core:error_action'",
        expect.any(Error)
      );

      // Trace capture is NOT called in the current error path
      expect(mockActionAwareTrace.captureActionData).not.toHaveBeenCalled();
    });

    it('should continue when trace capture fails', async () => {
      const failingTrace = {
        ...mockActionAwareTrace,
        captureActionData: jest.fn().mockImplementation(() => {
          throw new Error('Trace capture failure');
        }),
      };

      const candidateActions = [{ id: 'core:test_action' }];

      const context = {
        actor: mockActor,
        candidateActions,
        trace: failingTrace,
      };

      const result = await stage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture'),
        expect.any(Error)
      );
    });

    it('should handle malformed prerequisite structures', async () => {
      const candidateActions = [
        {
          id: 'core:malformed_action',
          prerequisites: null, // Malformed prerequisites
        },
      ];

      const context = {
        actor: mockActor,
        candidateActions,
        trace: mockActionAwareTrace,
      };

      const result = await stage.executeInternal(context);
      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toContain(candidateActions[0]);
    });
  });
});
