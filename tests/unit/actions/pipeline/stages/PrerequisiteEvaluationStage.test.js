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
        expect(result.data.candidateActions).toEqual([candidateActions[1]]);
        expect(result.data.prerequisiteErrors).toHaveLength(1);
        expect(result.errors).toHaveLength(1);

        expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
          error: testError,
          actionDef: candidateActions[0],
          actorId: mockActor.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: mockTrace,
          additionalContext: {
            stage: 'prerequisite_evaluation',
          },
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error checking prerequisites for action 'action1': Prerequisite evaluation failed",
          expect.any(Object)
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

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          // trace is undefined
        };

        const result = await stage.executeInternal(context);

        expect(result).toBeInstanceOf(PipelineResult);
        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual(candidateActions);
        expect(result.data.prerequisiteErrors).toEqual([]);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledWith(
          candidateActions[0].prerequisites,
          candidateActions[0],
          mockActor,
          undefined
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
});
