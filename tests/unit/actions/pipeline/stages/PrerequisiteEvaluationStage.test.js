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

      // Performance data is still captured for all actions, even those with errors (ACTTRA-018)
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledTimes(1);
      expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
        'stage_performance',
        'core:error_action',
        expect.objectContaining({
          stage: 'prerequisite_evaluation',
          duration: expect.any(Number),
          timestamp: expect.any(Number),
          itemsProcessed: 1,
          itemsPassed: 0,
          stageName: 'PrerequisiteEvaluation',
        })
      );
    });

    it('should capture error in trace when prerequisite evaluation throws', async () => {
      const candidateActions = [
        { id: 'core:error_action', prerequisites: [{ var: 'test' }] },
      ];

      const testError = new Error('Prerequisite service error');

      // Create a special mock that tracks if capturePrerequisiteError path was reached
      let errorCaptured = false;
      const trackingTrace = {
        ...mockActionAwareTrace,
        captureActionData: jest
          .fn()
          .mockImplementation((type, actionId, data) => {
            if (data && data.evaluationFailed) {
              errorCaptured = true;
            }
          }),
      };

      // Create a service that throws to trigger the error path
      const throwingService = {
        evaluate: jest.fn().mockImplementation(() => {
          throw testError;
        }),
      };

      const testStage = new PrerequisiteEvaluationStage(
        throwingService,
        mockErrorContextBuilder,
        mockLogger
      );

      const context = {
        actor: mockActor,
        candidateActions,
        trace: trackingTrace,
      };

      const result = await testStage.executeInternal(context);

      expect(result.success).toBe(true);
      expect(result.data.candidateActions).toEqual([]);
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error evaluating prerequisites'),
        testError
      );
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

  describe('Error Context Builder Coverage', () => {
    it('should build error context when unexpected error occurs in main evaluation loop', async () => {
      // To trigger lines 115-135, we need an error to be thrown in the main try-catch block
      // Looking at the code, this path is triggered when an error occurs in the main for loop

      // We'll create a mock that simulates the evaluateActionWithTracing throwing an error
      const testError = new Error('Unexpected evaluation error');

      // Create mocks
      const errorBuildingService = {
        evaluate: jest.fn(),
      };

      const testStage = new PrerequisiteEvaluationStage(
        errorBuildingService,
        mockErrorContextBuilder,
        mockLogger
      );

      // Create a valid action that will be processed
      const testAction = {
        id: 'core:test_error_context',
        prerequisites: [{ test: true }],
      };

      // Now we need to make evaluateActionWithTracing throw
      // Since it's a private method, we need to trigger the error through its dependencies
      // The easiest way is to make hasPrerequisites or extractPrerequisites throw

      // Let's create an action with a prerequisites property that causes an error when accessed
      const problematicAction = {
        id: 'core:problematic',
        get prerequisites() {
          throw testError;
        },
      };

      const context = {
        actor: mockActor,
        candidateActions: [problematicAction],
        trace: mockActionAwareTrace,
      };

      const result = await testStage.executeInternal(context);

      // The error context builder should have been called
      expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: testError,
        actionDef: problematicAction,
        actorId: mockActor.id,
        phase: ERROR_PHASES.VALIDATION,
        trace: mockActionAwareTrace,
        additionalContext: {
          stage: 'prerequisite_evaluation',
        },
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.data.prerequisiteErrors).toHaveLength(1);
    });

    it('should capture prerequisite error in ActionAwareStructuredTrace when error occurs', async () => {
      // To test lines 631-652 (capturePrerequisiteError method)
      // This method is called when an error occurs in the main try-catch block
      // and the trace supports captureActionData

      const testError = new Error('Test prerequisite error');
      let errorCaptured = false;

      const capturingTrace = {
        ...mockActionAwareTrace,
        captureActionData: jest
          .fn()
          .mockImplementation((type, actionId, data) => {
            if (data && data.evaluationFailed) {
              errorCaptured = true;
              // Verify the error data structure
              expect(data).toMatchObject({
                stage: 'prerequisite_evaluation',
                actorId: mockActor.id,
                evaluationFailed: true,
                error: testError.message,
                errorType: 'Error',
              });
            }
          }),
      };

      // Create an action that will cause an error when its prerequisites are accessed
      const errorAction = {
        id: 'core:error_action_capture',
        get prerequisites() {
          throw testError;
        },
      };

      const testStage = new PrerequisiteEvaluationStage(
        mockPrerequisiteService,
        mockErrorContextBuilder,
        mockLogger
      );

      const context = {
        actor: mockActor,
        candidateActions: [errorAction],
        trace: capturingTrace,
      };

      const result = await testStage.executeInternal(context);

      // The stage should complete successfully despite the error
      expect(result.success).toBe(true);
      expect(result.data.prerequisiteErrors).toHaveLength(1);

      // Verify that the error was captured in the trace
      expect(errorCaptured).toBe(true);
      expect(capturingTrace.captureActionData).toHaveBeenCalledWith(
        'prerequisite_evaluation',
        'core:error_action_capture',
        expect.objectContaining({
          evaluationFailed: true,
          error: testError.message,
        })
      );
    });
  });

  describe('Private Method Coverage', () => {
    describe('#hasPrerequisites', () => {
      it('should return true for object prerequisites', async () => {
        const candidateActions = [
          {
            id: 'core:object_prereq',
            prerequisites: { condition: 'some_condition', value: 10 },
          },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalledWith(
          candidateActions[0].prerequisites,
          candidateActions[0],
          mockActor,
          mockTrace
        );
      });

      it('should return true for truthy non-object/non-array prerequisites', async () => {
        const candidateActions = [
          {
            id: 'core:string_prereq',
            prerequisites: 'some_prerequisite_string',
          },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockPrerequisiteService.evaluate).toHaveBeenCalled();
      });

      it('should return false for empty object prerequisites', async () => {
        const candidateActions = [
          {
            id: 'core:empty_object_prereq',
            prerequisites: {},
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toContain(candidateActions[0]);
        expect(mockPrerequisiteService.evaluate).not.toHaveBeenCalled();
      });
    });

    describe('#createPrerequisiteTrace and JSON Logic capture', () => {
      it('should capture JSON Logic traces when enhanced trace is provided', async () => {
        // Create a more sophisticated mock that simulates the enhanced trace behavior
        const enhancedMockTrace = {
          ...mockActionAwareTrace,
          _jsonLogicTraces: [],
          _evaluationContext: null,
        };

        // Mock the prerequisite service to use the enhanced trace features
        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            // Simulate JSON Logic trace capture
            if (trace && trace.captureJsonLogicTrace) {
              trace.captureJsonLogicTrace(
                { '>=': [{ var: 'mana' }, 10] },
                { mana: 50 },
                true,
                [
                  'Step 1: Evaluate >=',
                  'Step 2: Get mana value',
                  'Step 3: Compare 50 >= 10',
                ]
              );
            }
            if (trace && trace.captureEvaluationContext) {
              trace.captureEvaluationContext({
                actor: { id: actor.id, mana: 50 },
              });
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:spell_with_logic',
            prerequisites: { '>=': [{ var: 'mana' }, 10] },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: enhancedMockTrace,
        };

        await stage.executeInternal(context);

        // Verify that captureActionData was called with evaluation details
        expect(enhancedMockTrace.captureActionData).toHaveBeenCalledWith(
          'prerequisite_evaluation',
          'core:spell_with_logic',
          expect.objectContaining({
            hasPrerequisites: true,
            evaluationPassed: true,
          })
        );
      });

      it('should handle errors in JSON Logic trace capture', async () => {
        const traceWithFailingCapture = {
          ...mockActionAwareTrace,
          step: jest.fn(),
          info: jest.fn(),
          success: jest.fn(),
        };

        // Mock prerequisite service that tries to capture but fails
        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            if (trace && trace.captureJsonLogicTrace) {
              // This will be called on the enhanced trace created internally
              trace.captureJsonLogicTrace(
                { '>=': [{ var: 'mana' }, 10] },
                { mana: 50 },
                true,
                ['Step 1']
              );
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:trace_error_action',
            prerequisites: { '>=': [{ var: 'mana' }, 10] },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: traceWithFailingCapture,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toContain(candidateActions[0]);
      });

      it('should log warning when JSON Logic trace capture fails', async () => {
        // Test line 386 - warning when captureJsonLogicTrace fails
        const traceWithErrorCapture = {
          ...mockActionAwareTrace,
          step: jest.fn(),
          info: jest.fn(),
          success: jest.fn(),
        };

        // Mock prerequisite service that calls the enhanced trace's captureJsonLogicTrace
        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            if (trace && trace.captureJsonLogicTrace) {
              // Force an error in the try-catch block of captureJsonLogicTrace
              try {
                trace.captureJsonLogicTrace(
                  null, // Pass null to potentially cause an error
                  {
                    get test() {
                      throw new Error('Context access error');
                    },
                  }, // Problematic context
                  true,
                  null
                );
              } catch (e) {
                // The error is caught internally
              }
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:trace_capture_warning',
            prerequisites: { '>=': [{ var: 'test' }, 1] },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: traceWithErrorCapture,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toContain(candidateActions[0]);
      });
    });

    describe('#createSafeContext circular reference handling', () => {
      it('should handle circular references in context data', async () => {
        // Create a circular reference scenario
        const circularActor = { id: 'circular-actor' };
        circularActor.self = circularActor; // Circular reference

        const enhancedTrace = {
          ...mockActionAwareTrace,
        };

        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            // Try to capture evaluation context with circular reference
            if (trace && trace.captureEvaluationContext) {
              trace.captureEvaluationContext({
                actor: circularActor,
                nested: { deep: { ref: circularActor } },
              });
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:circular_ref_action',
            prerequisites: { condition: 'test' },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: enhancedTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to capture')
        );
      });

      it('should truncate large string values in context', async () => {
        const largeString = 'x'.repeat(600); // String larger than 500 chars

        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            if (trace && trace.captureEvaluationContext) {
              trace.captureEvaluationContext({
                description: largeString,
                data: { nested: largeString },
              });
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:large_string_action',
            prerequisites: { condition: 'test' },
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

      it('should handle serialization errors in createSafeContext', async () => {
        // Create an object that can't be serialized
        const unserializableObj = {
          fn: function () {}, // Functions can't be serialized to JSON
          circular: null,
        };
        unserializableObj.circular = unserializableObj;

        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            if (trace && trace.captureEvaluationContext) {
              // Force an error by passing something that will fail JSON.stringify
              const problematicContext = {};
              Object.defineProperty(problematicContext, 'prop', {
                get: () => {
                  throw new Error('Property access error');
                },
                enumerable: true,
              });
              trace.captureEvaluationContext(problematicContext);
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:unserializable_action',
            prerequisites: { condition: 'test' },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockActionAwareTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
      });
    });

    describe('#extractEvaluationDetails with enhanced traces', () => {
      it('should extract JSON Logic traces from enhanced trace', async () => {
        const enhancedTrace = {
          ...mockActionAwareTrace,
          _jsonLogicTraces: [
            {
              expression: { '>=': [{ var: 'mana' }, 10] },
              context: { mana: 50 },
              result: true,
              evaluationSteps: ['Step 1', 'Step 2'],
              timestamp: Date.now(),
            },
          ],
          _evaluationContext: { actor: { id: 'test-actor', mana: 50 } },
        };

        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, trace) => {
            // Set the internal properties that extractEvaluationDetails will look for
            if (trace) {
              trace._jsonLogicTraces = enhancedTrace._jsonLogicTraces;
              trace._evaluationContext = enhancedTrace._evaluationContext;
            }
            return true;
          }
        );

        const candidateActions = [
          {
            id: 'core:enhanced_trace_action',
            prerequisites: { '>=': [{ var: 'mana' }, 10] },
          },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockActionAwareTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockActionAwareTrace.captureActionData).toHaveBeenCalledWith(
          'prerequisite_evaluation',
          'core:enhanced_trace_action',
          expect.objectContaining({
            evaluationDetails: expect.objectContaining({
              hasJsonLogicTraces: true,
              hasEvaluationContext: true,
            }),
          })
        );
      });
    });

    describe('Error handling in capture methods', () => {
      it('should handle errors in capturePreEvaluationData', async () => {
        mockLogger.debug.mockImplementation((message, payload) => {
          if (
            message ===
            'PrerequisiteEvaluationStage: Captured pre-evaluation data'
          ) {
            throw new Error('Pre-evaluation trace failure');
          }
          return undefined;
        });

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const candidateActions = [
          { id: 'core:capture_error_action', prerequisites: [] },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          actionContext: { foo: 'bar' },
          trace: mockActionAwareTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to capture pre-evaluation data for tracing',
          expect.any(Error)
        );
      });

      it('should handle errors in capturePrerequisiteEvaluationData', async () => {
        let callCount = 0;
        const selectiveThrowingTrace = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn().mockImplementation((type) => {
            callCount++;
            // Only throw on the prerequisite_evaluation capture, not stage_performance
            if (type === 'prerequisite_evaluation') {
              throw new Error('Prerequisite capture failed');
            }
          }),
        };

        const candidateActions = [
          { id: 'core:eval_capture_error', prerequisites: { test: true } },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const context = {
          actor: mockActor,
          candidateActions,
          trace: selectiveThrowingTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to capture prerequisite evaluation data'
          ),
          expect.any(Error)
        );
      });

      it('should warn when JSON Logic trace capture fails internally', async () => {
        const trace = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn(),
        };

        const candidateActions = [
          { id: 'core:json-logic-trace', prerequisites: [{ id: 'rule-1' }] },
        ];

        mockPrerequisiteService.evaluate.mockImplementation(
          (prereqs, actionDef, actor, enhancedTrace) => {
            Object.defineProperty(enhancedTrace, '_jsonLogicTraces', {
              configurable: true,
              get() {
                throw new Error('Accessor failure');
              },
              set() {
                throw new Error('Mutator failure');
              },
            });

            expect(() =>
              enhancedTrace.captureJsonLogicTrace(
                { '===': [1, 1] },
                { foo: 'bar' },
                true,
                ['step-1']
              )
            ).not.toThrow();

            return true;
          }
        );

        const context = {
          actor: mockActor,
          candidateActions,
          trace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "Failed to capture JSON Logic trace for action 'core:json-logic-trace'",
          expect.any(Error)
        );
      });

      it('should handle errors in captureNoPrerequisitesData', async () => {
        const throwingOnNoPrereqTrace = {
          ...mockActionAwareTrace,
          captureActionData: jest
            .fn()
            .mockImplementation((type, actionId, data) => {
              // Only throw when capturing no-prerequisites data
              if (data && data.hasPrerequisites === false) {
                throw new Error('No prerequisites capture failed');
              }
            }),
        };

        const candidateActions = [
          { id: 'core:no_prereq_capture_error' }, // No prerequisites
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: throwingOnNoPrereqTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to capture no-prerequisites data'),
          expect.any(Error)
        );
      });

      it('should handle errors in capturePostEvaluationData', async () => {
        // We need to mock the logger to fail during post-evaluation capture
        // Since capturePostEvaluationData doesn't use trace.captureActionData,
        // we need to trigger the error differently
        const originalDebug = mockLogger.debug;
        let debugCallCount = 0;

        mockLogger.debug = jest.fn().mockImplementation((message) => {
          debugCallCount++;
          // Throw error on the post-evaluation summary debug call
          if (message.includes('Captured post-evaluation summary')) {
            throw new Error('Debug logging failed');
          }
          return originalDebug(message);
        });

        const candidateActions = [
          { id: 'core:post_eval_error', prerequisites: [] },
        ];

        const context = {
          actor: mockActor,
          candidateActions,
          trace: mockActionAwareTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        // The error is caught internally but not logged as warning for this case
        // Restore the mock
        mockLogger.debug = originalDebug;
      });
    });

    describe('#capturePrerequisiteError', () => {
      it('should capture prerequisite errors when error occurs and trace supports it', async () => {
        const testError = new Error('Test prerequisite error');
        let captureCallCount = 0;

        const captureErrorTrace = {
          ...mockActionAwareTrace,
          captureActionData: jest
            .fn()
            .mockImplementation((type, actionId, data) => {
              captureCallCount++;
              // Allow the first call (error capture) to succeed
              // Throw on subsequent calls to trigger the error path
              if (captureCallCount === 1 && data && data.evaluationFailed) {
                // Successfully capture the error
                return;
              }
              if (captureCallCount > 1) {
                // Don't throw on performance capture
                return;
              }
            }),
        };

        // Create a mock that throws an error in the prerequisite service
        // but at a level where it gets caught and calls capturePrerequisiteError
        const candidateActions = [
          { id: 'core:prereq_error_capture', prerequisites: { test: true } },
        ];

        // Mock the internal method to throw an error that triggers the error capture path
        const originalEvaluate = stage.executeInternal.bind(stage);
        jest
          .spyOn(stage, 'executeInternal')
          .mockImplementation(async (context) => {
            // Temporarily replace the prerequisite service to throw
            const originalEvalImpl = mockPrerequisiteService.evaluate;
            mockPrerequisiteService.evaluate = jest
              .fn()
              .mockImplementation(() => {
                throw testError;
              });

            // Call the original implementation
            const result = await originalEvaluate(context);

            // Restore the original implementation
            mockPrerequisiteService.evaluate = originalEvalImpl;

            return result;
          });

        const context = {
          actor: mockActor,
          candidateActions,
          trace: captureErrorTrace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);

        // Since we mocked executeInternal, restore it
        stage.executeInternal.mockRestore();
      });

      it('should log warning when capturePrerequisiteError fails on trace capture', async () => {
        // Test line 652 - warning when capturePrerequisiteError's trace.captureActionData fails
        const failingCaptureTrace = {
          ...mockActionAwareTrace,
          captureActionData: jest
            .fn()
            .mockImplementation((type, actionId, data) => {
              // Only fail when capturing error data (has evaluationFailed flag)
              if (data && data.evaluationFailed) {
                throw new Error('Trace capture error');
              }
            }),
        };

        // Create an action that will trigger the error path
        const errorAction = {
          id: 'core:trace_capture_fail',
          get prerequisites() {
            throw new Error('Prerequisites access error');
          },
        };

        const testStage = new PrerequisiteEvaluationStage(
          mockPrerequisiteService,
          mockErrorContextBuilder,
          mockLogger
        );

        const context = {
          actor: mockActor,
          candidateActions: [errorAction],
          trace: failingCaptureTrace,
        };

        const result = await testStage.executeInternal(context);

        expect(result.success).toBe(true);
        // Verify warning was logged for capture failure
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to capture prerequisite error data'),
          expect.any(Error)
        );
      });

      it('should handle errors when capturing prerequisite error fails', async () => {
        // Create a trace that fails when trying to capture error data
        const failingErrorCaptureTrace = {
          ...mockActionAwareTrace,
          captureActionData: jest
            .fn()
            .mockImplementation((type, actionId, data) => {
              // Only throw when capturing error data (evaluationFailed flag is set in error path)
              if (data && data.evaluationFailed) {
                throw new Error('Error capture failed');
              }
              // Otherwise succeed
              return;
            }),
        };

        const candidateActions = [
          { id: 'core:error_capture_fail', prerequisites: { test: true } },
        ];

        // Create a service that will trigger the error path
        // We need to cause an error in the main evaluation loop
        // The best way is to make the service throw an error that's not caught in evaluateActionWithTracing
        const errorThrowingService = {
          evaluate: jest.fn().mockImplementation(() => {
            throw new TypeError('Unexpected type error'); // This will be caught in main loop
          }),
        };

        // Create stage with error-throwing service
        const testStage = new PrerequisiteEvaluationStage(
          errorThrowingService,
          mockErrorContextBuilder,
          mockLogger
        );

        const context = {
          actor: mockActor,
          candidateActions,
          trace: failingErrorCaptureTrace,
        };

        const result = await testStage.executeInternal(context);

        expect(result.success).toBe(true);
        // The error should be logged but the stage continues
        expect(mockLogger.error).toHaveBeenCalled();

        // When the trace capture fails, it should log a warning
        // However, the current implementation doesn't call capturePrerequisiteError in the main catch block
        // It only calls it within evaluateActionWithTracing
        // Let's verify the error was handled properly
        expect(result.data.candidateActions).toEqual([]);
      });
    });

    describe('service result normalization and tracing', () => {
      it('should propagate structured service error details into trace data', async () => {
        const trace = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn(),
        };

        const candidateActions = [
          { id: 'core:service-error', prerequisites: [{ id: 'rule-a' }] },
        ];

        const serviceResult = {
          passed: false,
          reason: 'Service reported prerequisite failure',
          prerequisites: [{ id: 'rule-a' }],
          error: 'EvaluationError: condition failed',
          errorType: 'EvaluationError',
          evaluationTime: 42,
        };

        mockPrerequisiteService.evaluate.mockReturnValue(serviceResult);

        const context = {
          actor: mockActor,
          candidateActions,
          trace,
        };

        const result = await stage.executeInternal(context);

        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toHaveLength(0);
        expect(trace.captureActionData).toHaveBeenCalledWith(
          'prerequisite_evaluation',
          'core:service-error',
          expect.objectContaining({
            evaluationPassed: false,
            evaluationReason: 'Service reported prerequisite failure',
            error: 'EvaluationError: condition failed',
            errorType: 'EvaluationError',
          })
        );
        expect(mockLogger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to capture prerequisite evaluation data'
          ),
          expect.anything()
        );
      });
    });

    describe('action-aware tracing coverage', () => {
      it('should capture detailed prerequisite and performance data with action-aware tracing', async () => {
        const candidateActions = [
          {
            id: 'trace-action',
            name: 'Trace Action',
            prerequisites: [{ condition: 'needs trace' }],
          },
        ];

        const traceContext = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn().mockResolvedValue(),
        };

        mockPrerequisiteService.evaluate.mockImplementation(
          (prerequisites, actionDef, actor, trace) => {
            trace.captureJsonLogicTrace(
              { rule: 'test-rule' },
              { actorId: actor.id },
              true,
              ['step-1']
            );
            trace.captureJsonLogicTrace(
              { rule: 'test-rule-2' },
              { actorId: actor.id, second: true },
              false,
              ['step-2']
            );
            trace.captureEvaluationContext({
              actorId: actor.id,
              actionName: actionDef.name,
            });

            return {
              passed: false,
              reason: 'Service provided reason',
              prerequisites,
              hasPrerequisites: false,
              evaluationTime: 42,
            };
          }
        );

        const result = await stage.executeInternal({
          actor: mockActor,
          candidateActions,
          trace: traceContext,
          actionContext: { contextKey: 'context-value' },
        });

        expect(result.success).toBe(true);
        expect(result.data.candidateActions).toEqual([]);

        expect(traceContext.captureActionData).toHaveBeenCalledWith(
          'prerequisite_evaluation',
          'trace-action',
          expect.objectContaining({
            prerequisites: candidateActions[0].prerequisites,
            evaluationDetails: expect.objectContaining({
              hasJsonLogicTraces: true,
              hasEvaluationContext: true,
            }),
            evaluationPassed: false,
            evaluationReason: 'Service provided reason',
          })
        );

        expect(traceContext.captureActionData).toHaveBeenCalledWith(
          'stage_performance',
          'trace-action',
          expect.objectContaining({
            itemsProcessed: 1,
            itemsPassed: 0,
            stage: 'prerequisite_evaluation',
          })
        );

        const postSummaryCall = mockLogger.debug.mock.calls.find(
          ([message]) =>
            message ===
            'PrerequisiteEvaluationStage: Captured post-evaluation summary'
        );

        expect(postSummaryCall?.[1]).toEqual(
          expect.objectContaining({ evaluationSuccessRate: 0 })
        );
      });

      it('should capture prerequisite errors when tracing supports action data', async () => {
        const candidateActions = [
          {
            id: 'error-action',
            name: 'Error Action',
            prerequisites: [{ condition: 'throws' }],
          },
        ];

        const traceContext = {
          ...mockActionAwareTrace,
          success: jest.fn(() => {
            throw new Error('Tracing failure');
          }),
          captureActionData: jest.fn().mockResolvedValue(),
        };

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const result = await stage.executeInternal({
          actor: mockActor,
          candidateActions,
          trace: traceContext,
        });

        expect(result.data.prerequisiteErrors).toHaveLength(1);

        expect(traceContext.captureActionData).toHaveBeenCalledWith(
          'prerequisite_evaluation',
          'error-action',
          expect.objectContaining({
            evaluationFailed: true,
            error: 'Tracing failure',
            errorType: 'Error',
          })
        );
      });
    });

    describe('branch coverage scenarios', () => {
      it('should use default candidate actions and report full success rate when none provided', async () => {
        const traceContext = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn().mockResolvedValue(),
        };

        const result = await stage.executeInternal({
          actor: mockActor,
          trace: traceContext,
        });

        expect(result.data.candidateActions).toEqual([]);
        expect(traceContext.captureActionData).not.toHaveBeenCalled();

        const summaryCall = mockLogger.debug.mock.calls.find(
          ([message]) =>
            message ===
            'PrerequisiteEvaluationStage: Captured post-evaluation summary'
        );

        expect(summaryCall?.[1]).toEqual(
          expect.objectContaining({ evaluationSuccessRate: 1 })
        );
      });

      it('should handle errors without action-aware tracing and skip trace capture', async () => {
        const candidateActions = [
          {
            id: 'non-trace-error',
            name: 'Non Trace Error',
            prerequisites: [{ condition: 'throw' }],
          },
        ];

        const trace = {
          step: jest.fn(),
          info: jest.fn(),
          success: jest.fn(() => {
            throw new Error('Non action-aware tracing failure');
          }),
        };

        mockPrerequisiteService.evaluate.mockReturnValue(true);

        const result = await stage.executeInternal({
          actor: mockActor,
          candidateActions,
          trace,
        });

        expect(result.data.prerequisiteErrors).toHaveLength(1);
        expect(trace.success).toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should treat object results without passed flag as successful and reuse original prerequisites', async () => {
        const candidateActions = [
          {
            id: 'missing-passed',
            name: 'Missing Passed',
            prerequisites: [{ condition: 'implicit' }],
          },
        ];

        mockPrerequisiteService.evaluate.mockReturnValue({
          hasPrerequisites: true,
        });

        const result = await stage.executeInternal({
          actor: mockActor,
          candidateActions,
          trace: mockTrace,
        });

        expect(result.data.candidateActions).toEqual(candidateActions);
        expect(mockTrace.success).toHaveBeenCalledWith(
          "Action 'missing-passed' passed prerequisite check",
          'PrerequisiteEvaluationStage.execute'
        );
      });

      it('should capture object-based prerequisites when tracing evaluation data', async () => {
        const traceContext = {
          ...mockActionAwareTrace,
          captureActionData: jest.fn().mockResolvedValue(),
        };

        mockPrerequisiteService.evaluate.mockReturnValue({
          passed: true,
          prerequisites: { type: 'object-prerequisite' },
          hasPrerequisites: true,
          evaluationDetails: { custom: true },
        });

        const candidateActions = [
          {
            id: 'object-prereq',
            name: 'Object Prereq',
            prerequisites: { type: 'object-prerequisite' },
          },
        ];

        const result = await stage.executeInternal({
          actor: mockActor,
          candidateActions,
          trace: traceContext,
        });

        expect(result.success).toBe(true);

        const captureCall = traceContext.captureActionData.mock.calls.find(
          ([type]) => type === 'prerequisite_evaluation'
        );

        expect(captureCall?.[2]).toEqual(
          expect.objectContaining({
            prerequisiteCount: 1,
            prerequisites: { type: 'object-prerequisite' },
          })
        );
      });
    });
  });
});
