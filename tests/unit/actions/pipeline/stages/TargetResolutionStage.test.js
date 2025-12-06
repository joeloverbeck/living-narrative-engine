/**
 * @file Tests for TargetResolutionStage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionStage } from '../../../../../src/actions/pipeline/stages/TargetResolutionStage.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';
import { ERROR_PHASES } from '../../../../../src/actions/errors/actionErrorTypes.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';
import '../../../../../tests/common/actionResultMatchers.js';

describe('TargetResolutionStage', () => {
  let stage;
  let mockTargetResolutionService;
  let mockErrorContextBuilder;
  let mockLogger;
  let mockTrace;
  let mockActor;
  let mockActionContext;

  beforeEach(() => {
    mockTargetResolutionService = {
      resolveTargets: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTrace = {
      step: jest.fn(),
      info: jest.fn(),
    };

    mockActor = {
      id: 'test-actor',
    };

    mockActionContext = {};

    stage = new TargetResolutionStage(
      mockTargetResolutionService,
      mockErrorContextBuilder,
      mockLogger
    );
  });

  describe('constructor', () => {
    it('should create a TargetResolutionStage with correct name', () => {
      expect(stage.name).toBe('TargetResolution');
    });
  });

  describe('execute', () => {
    describe('when candidateActions is null or undefined', () => {
      it('should return empty result with warning for null candidateActions', async () => {
        const context = {
          actor: mockActor,
          candidateActions: null,
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const result = await stage.execute(context);

        expect(result).toEqual(
          PipelineResult.success({
            data: { actionsWithTargets: [] },
            errors: [],
          })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'TargetResolutionStage received invalid candidateActions'
          ),
          expect.any(Object)
        );
      });

      it('should return empty result with warning for undefined candidateActions', async () => {
        const context = {
          actor: mockActor,
          candidateActions: undefined,
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const result = await stage.execute(context);

        expect(result).toEqual(
          PipelineResult.success({
            data: { actionsWithTargets: [] },
            errors: [],
          })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'TargetResolutionStage received invalid candidateActions'
          ),
          expect.any(Object)
        );
      });

      it('should return empty result with warning for non-array candidateActions', async () => {
        const context = {
          actor: mockActor,
          candidateActions: 'not-an-array',
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const result = await stage.execute(context);

        expect(result).toEqual(
          PipelineResult.success({
            data: { actionsWithTargets: [] },
            errors: [],
          })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'TargetResolutionStage received invalid candidateActions'
          ),
          expect.any(Object)
        );
      });
    });

    describe('when candidateActions contains null actions', () => {
      it('should skip null action definitions', async () => {
        const validAction = { id: 'valid-action', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [null, validAction, undefined],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        mockTargetResolutionService.resolveTargets.mockReturnValue(
          ActionResult.success([ActionTargetContext.forEntity('target-entity')])
        );

        const result = await stage.execute(context);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Skipping null action definition in candidateActions'
        );
        expect(result.data.actionsWithTargets).toHaveLength(1);
        expect(result.data.actionsWithTargets[0].actionDef).toBe(validAction);
      });
    });

    describe('when action has scope "none"', () => {
      it('should create ActionTargetContext.noTarget() without calling targetResolutionService', async () => {
        const noneAction = { id: 'core:wait', scope: 'none' };
        const context = {
          actor: mockActor,
          candidateActions: [noneAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const result = await stage.execute(context);

        expect(
          mockTargetResolutionService.resolveTargets
        ).not.toHaveBeenCalled();
        expect(result.data.actionsWithTargets).toHaveLength(1);

        const actionWithTargets = result.data.actionsWithTargets[0];
        expect(actionWithTargets.actionDef).toBe(noneAction);
        expect(actionWithTargets.targetContexts).toHaveLength(1);

        const targetContext = actionWithTargets.targetContexts[0];
        expect(targetContext).toBeInstanceOf(ActionTargetContext);
        expect(targetContext.type).toBe('none');
        expect(targetContext.entityId).toBeNull();

        expect(mockTrace.info).toHaveBeenCalledWith(
          "Action 'core:wait' has 'none' scope - no target resolution needed",
          expect.any(String)
        );
      });

      it('should handle multiple actions with scope "none"', async () => {
        const waitAction = { id: 'core:wait', scope: 'none' };
        const passAction = { id: 'core:pass', scope: 'none' };
        const context = {
          actor: mockActor,
          candidateActions: [waitAction, passAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(2);

        result.data.actionsWithTargets.forEach((actionWithTargets) => {
          expect(actionWithTargets.targetContexts).toHaveLength(1);
          const targetContext = actionWithTargets.targetContexts[0];
          expect(targetContext).toBeInstanceOf(ActionTargetContext);
          expect(targetContext.type).toBe('none');
          expect(targetContext.entityId).toBeNull();
        });
      });
    });

    describe('when action has non-none scope', () => {
      it('should call targetResolutionService and return targets', async () => {
        const entityAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [entityAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const expectedTargets = [
          ActionTargetContext.forEntity('target-entity'),
        ];
        mockTargetResolutionService.resolveTargets.mockReturnValue(
          ActionResult.success(expectedTargets)
        );

        const result = await stage.execute(context);

        expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith(
          'entity',
          mockActor,
          mockActionContext,
          mockTrace,
          'movement:go'
        );

        expect(result.data.actionsWithTargets).toHaveLength(1);
        const actionWithTargets = result.data.actionsWithTargets[0];
        expect(actionWithTargets.actionDef).toBe(entityAction);
        expect(actionWithTargets.targetContexts).toBe(expectedTargets);
      });

      it('should handle actions with zero targets', async () => {
        const entityAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [entityAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        mockTargetResolutionService.resolveTargets.mockReturnValue(
          ActionResult.success([])
        );

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(0);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Action 'movement:go' resolved to 0 targets. Skipping."
        );
        expect(mockTrace.info).toHaveBeenCalledWith(
          "Action 'movement:go' has no valid targets",
          expect.any(String)
        );
      });

      it('should handle targetResolutionService errors', async () => {
        const entityAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [entityAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const resolutionError = new Error('Target resolution failed');
        mockTargetResolutionService.resolveTargets.mockReturnValue(
          ActionResult.failure(resolutionError)
        );

        const expectedErrorContext = { error: 'context' };
        mockErrorContextBuilder.buildErrorContext.mockReturnValue(
          expectedErrorContext
        );

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(expectedErrorContext);

        expect(mockErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
          error: resolutionError,
          actionDef: entityAction,
          actorId: mockActor.id,
          phase: ERROR_PHASES.VALIDATION,
          trace: mockTrace,
          additionalContext: {
            stage: 'target_resolution',
            scope: 'entity',
          },
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error resolving scope for action 'movement:go'",
          { errors: [resolutionError] }
        );
      });

      it('should log and skip actions when resolveTargets returns null result', async () => {
        const nullResultAction = { id: 'movement:invalid', scope: 'entity' };
        const validAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [nullResultAction, validAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const expectedTargets = [
          ActionTargetContext.forEntity('resolved-target'),
        ];

        mockTargetResolutionService.resolveTargets
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(ActionResult.success(expectedTargets));

        const result = await stage.execute(context);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "TargetResolutionService.resolveTargets returned null/undefined for action 'movement:invalid'"
        );
        expect(result.data.actionsWithTargets).toHaveLength(1);
        expect(result.data.actionsWithTargets[0]).toEqual({
          actionDef: validAction,
          targetContexts: expectedTargets,
        });
        expect(
          mockTargetResolutionService.resolveTargets
        ).toHaveBeenCalledTimes(2);
      });

      it('should preserve existing error contexts without rebuilding them', async () => {
        const entityAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [entityAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const existingErrorContext = {
          message: 'prebuilt error context',
          timestamp: Date.now(),
          phase: ERROR_PHASES.VALIDATION,
        };

        mockTargetResolutionService.resolveTargets.mockReturnValue({
          success: false,
          errors: [existingErrorContext],
        });

        const result = await stage.execute(context);

        expect(result.errors).toEqual([existingErrorContext]);
        expect(
          mockErrorContextBuilder.buildErrorContext
        ).not.toHaveBeenCalled();
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error resolving scope for action 'movement:go'",
          { errors: [existingErrorContext] }
        );
      });

      it('should handle exceptions thrown by targetResolutionService', async () => {
        const entityAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [entityAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const thrownError = new Error('Service threw exception');
        mockTargetResolutionService.resolveTargets.mockImplementation(() => {
          throw thrownError;
        });

        const expectedErrorContext = { error: 'context' };
        mockErrorContextBuilder.buildErrorContext.mockReturnValue(
          expectedErrorContext
        );

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(expectedErrorContext);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Exception in targetResolutionService for action 'movement:go': Service threw exception",
          expect.objectContaining({
            actionDef: entityAction,
            error: thrownError,
          })
        );
      });
    });

    describe('mixed scope scenarios', () => {
      it('should handle mix of none and entity scoped actions', async () => {
        const waitAction = { id: 'core:wait', scope: 'none' };
        const goAction = { id: 'movement:go', scope: 'entity' };
        const context = {
          actor: mockActor,
          candidateActions: [waitAction, goAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        const entityTargets = [ActionTargetContext.forEntity('target-entity')];
        mockTargetResolutionService.resolveTargets.mockReturnValue(
          ActionResult.success(entityTargets)
        );

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(2);

        // Check wait action (scope: none)
        const waitResult = result.data.actionsWithTargets.find(
          (a) => a.actionDef.id === 'core:wait'
        );
        expect(waitResult.targetContexts).toHaveLength(1);
        expect(waitResult.targetContexts[0]).toBeInstanceOf(
          ActionTargetContext
        );
        expect(waitResult.targetContexts[0].type).toBe('none');

        // Check go action (scope: entity)
        const goResult = result.data.actionsWithTargets.find(
          (a) => a.actionDef.id === 'movement:go'
        );
        expect(goResult.targetContexts).toBe(entityTargets);

        // Verify service only called for non-none actions
        expect(
          mockTargetResolutionService.resolveTargets
        ).toHaveBeenCalledTimes(1);
        expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith(
          'entity',
          mockActor,
          mockActionContext,
          mockTrace,
          'movement:go'
        );
      });
    });

    describe('logging and tracing', () => {
      it('should log debug information about received context', async () => {
        const context = {
          actor: mockActor,
          candidateActions: [],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        await stage.execute(context);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('TargetResolutionStage context keys:'),
          expect.objectContaining({
            candidateActionsType: 'object',
            candidateActionsIsArray: true,
            candidateActionsLength: 0,
          })
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TargetResolutionStage received 0 candidate actions',
          expect.objectContaining({
            candidateActionIds: [],
          })
        );
      });

      it('should trace execution steps', async () => {
        const waitAction = { id: 'core:wait', scope: 'none' };
        const context = {
          actor: mockActor,
          candidateActions: [waitAction],
          actionContext: mockActionContext,
          trace: mockTrace,
        };

        await stage.execute(context);

        expect(mockTrace.step).toHaveBeenCalledWith(
          'Resolving targets for 1 candidate actions',
          expect.stringContaining('TargetResolutionStage.execute')
        );

        expect(mockTrace.info).toHaveBeenCalledWith(
          'Target resolution completed: 1 actions with targets, 0 errors',
          expect.stringContaining('TargetResolutionStage.execute')
        );
      });

      it('should handle missing trace gracefully', async () => {
        const waitAction = { id: 'core:wait', scope: 'none' };
        const context = {
          actor: mockActor,
          candidateActions: [waitAction],
          actionContext: mockActionContext,
          // No trace provided
        };

        const result = await stage.execute(context);

        expect(result.data.actionsWithTargets).toHaveLength(1);
        // Should not throw errors when trace is undefined
      });
    });
  });
});
