import { beforeEach, expect, it, describe } from '@jest/globals';
import { describeActionCandidateProcessorSuite } from '../../common/actions/actionCandidateProcessorTestBed.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import * as discoveryErrorUtils from '../../../src/actions/utils/discoveryErrorUtils.js';

describeActionCandidateProcessorSuite('ActionCandidateProcessor', (getBed) => {
  beforeEach(() => {
    const bed = getBed();
    bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
    bed.mocks.actionCommandFormatter.format.mockReturnValue({
      ok: true,
      value: 'doit',
    });
    bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
      ActionResult.success([])
    );
  });

  describe('process', () => {
    it('returns result with no-targets cause when action has no targets', () => {
      const bed = getBed();
      const actionDef = { id: 'test', scope: 'none' };
      const actorEntity = { id: 'actor' };
      const context = {};

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        actions: [],
        errors: [],
        cause: 'no-targets',
      });
    });

    it('handles an explicit null trace context without invoking trace hooks', () => {
      const bed = getBed();
      const actionDef = { id: 'null-trace', scope: 'none' };
      const actorEntity = { id: 'actor-null-trace' };
      const context = {};

      const result = bed.service.process(actionDef, actorEntity, context, null);

      expect(result.success).toBe(true);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith('none', actorEntity, context, null, 'null-trace');
    });

    it('returns actions when prerequisites pass and targets exist', () => {
      const bed = getBed();
      const actionDef = {
        id: 'attack',
        name: 'Attack',
        commandVerb: 'attack',
        scope: 'enemy',
        description: 'Attack an enemy',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([
          ActionTargetContext.forEntity('enemy1'),
          ActionTargetContext.forEntity('enemy2'),
        ])
      );
      bed.mocks.actionCommandFormatter.format.mockImplementation(
        (def, target) => ({
          ok: true,
          value: `${def.commandVerb} ${target.entityId}`,
        })
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(2);
      expect(result.value.actions[0]).toEqual({
        id: 'attack',
        name: 'Attack',
        command: 'attack enemy1',
        description: 'Attack an enemy',
        params: { targetId: 'enemy1' },
        visual: null,
      });
      expect(result.value.actions[1]).toEqual({
        id: 'attack',
        name: 'Attack',
        command: 'attack enemy2',
        description: 'Attack an enemy',
        params: { targetId: 'enemy2' },
        visual: null,
      });
      expect(result.value.errors).toHaveLength(0);
    });

    it('logs debug output and skips trace info when no targets remain after resolution', () => {
      const bed = getBed();
      const actionDef = {
        id: 'scout',
        name: 'Scout',
        commandVerb: 'scout',
        scope: 'enemy',
      };
      const actorEntity = { id: 'actor-scout' };
      const context = { turn: 4 };
      const trace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([])
      );

      const result = bed.service.process(
        actionDef,
        actorEntity,
        context,
        trace
      );

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        actions: [],
        errors: [],
        cause: 'no-targets',
      });
      expect(bed.mocks.logger.debug).toHaveBeenCalledWith(
        "Action 'scout' resolved to 0 targets. Skipping."
      );
      expect(trace.info).not.toHaveBeenCalled();
      expect(trace.success).toHaveBeenCalledWith(
        "Action 'scout' passed actor prerequisite check.",
        'ActionCandidateProcessor.process'
      );
    });

    it('logs trace info when targets are resolved with trace context', () => {
      const bed = getBed();
      const actionDef = {
        id: 'attack',
        name: 'Attack',
        commandVerb: 'attack',
        scope: 'enemy',
        description: 'Attack an enemy',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const mockTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([
          ActionTargetContext.forEntity('enemy1'),
          ActionTargetContext.forEntity('enemy2'),
        ])
      );
      bed.mocks.actionCommandFormatter.format.mockImplementation(
        (def, target) => ({
          ok: true,
          value: `${def.commandVerb} ${target.entityId}`,
        })
      );

      const result = bed.service.process(
        actionDef,
        actorEntity,
        context,
        mockTrace
      );

      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(2);
      expect(mockTrace.info).toHaveBeenCalledWith(
        `Scope for action 'attack' resolved to 2 targets.`,
        'ActionCandidateProcessor.process',
        { targets: ['enemy1', 'enemy2'] }
      );
    });

    it('records an initial trace step when span helpers are unavailable', () => {
      const bed = getBed();
      const actionDef = {
        id: 'trace-step',
        name: 'Trace Step',
        commandVerb: 'inspect',
        scope: 'inspectable',
      };
      const actorEntity = { id: 'actor-step' };
      const context = {};
      const mockTrace = {
        step: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
      };

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('target-step')])
      );
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'inspect target-step',
      });

      const result = bed.service.process(
        actionDef,
        actorEntity,
        context,
        mockTrace
      );

      expect(result.success).toBe(true);
      expect(mockTrace.step).toHaveBeenCalledWith(
        "Processing candidate action: 'trace-step'",
        'ActionCandidateProcessor.process'
      );
    });

    it('wraps processing with trace.withSpan when available', () => {
      const bed = getBed();
      const actionDef = {
        id: 'trace-action',
        name: 'Trace Action',
        commandVerb: 'trace',
        scope: 'ally',
      };
      const actorEntity = { id: 'actor-1' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('ally-1')])
      );
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'trace ally-1',
      });

      const trace = {
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        info: jest.fn(),
        withSpan: jest.fn((name, callback, attributes) => {
          expect(name).toBe('candidate.process');
          expect(attributes).toEqual({
            actionId: actionDef.id,
            actorId: actorEntity.id,
            scope: actionDef.scope,
          });
          return callback();
        }),
      };

      const result = bed.service.process(
        actionDef,
        actorEntity,
        context,
        trace
      );

      expect(trace.withSpan).toHaveBeenCalledTimes(1);
      expect(trace.withSpan).toHaveBeenCalledWith(
        'candidate.process',
        expect.any(Function),
        {
          actionId: actionDef.id,
          actorId: actorEntity.id,
          scope: actionDef.scope,
        }
      );
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toMatchObject({
        command: 'trace ally-1',
        params: { targetId: 'ally-1' },
      });
    });

    it('propagates errors thrown by trace.withSpan after executing callback', () => {
      const bed = getBed();
      const actionDef = { id: 'trace-error', scope: 'self' };
      const actorEntity = { id: 'actor-1' };
      const context = {};
      const traceError = new Error('trace failure');
      const resolutionSpy = jest.fn();

      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        () => {
          resolutionSpy();
          return ActionResult.success([]);
        }
      );

      const trace = {
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        info: jest.fn(),
        withSpan: jest.fn((name, callback, attributes) => {
          expect(name).toBe('candidate.process');
          expect(attributes).toEqual({
            actionId: actionDef.id,
            actorId: actorEntity.id,
            scope: actionDef.scope,
          });
          const result = callback();
          throw traceError;
        }),
      };

      expect(() =>
        bed.service.process(actionDef, actorEntity, context, trace)
      ).toThrow(traceError);

      expect(trace.withSpan).toHaveBeenCalledTimes(1);
      expect(resolutionSpy).toHaveBeenCalledTimes(1);
    });

    it('returns errors for failed prerequisites', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const error = new Error('Prerequisites failed');

      bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => {
          throw error;
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        error: error,
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
        environmentContext: expect.any(Object),
      });
    });

    it('handles prerequisite failures that omit error payloads', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const failureSpy = jest.spyOn(ActionResult, 'failure');

      failureSpy.mockImplementationOnce(() => ({ success: false }));

      try {
        bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
          () => {
            throw new Error('Prerequisites failed hard');
          }
        );

        const result = bed.service.process(actionDef, actorEntity, context);

        expect(result.success).toBe(true);
        expect(result.value).toEqual({
          actions: [],
          errors: [],
          cause: 'prerequisite-error',
        });
      } finally {
        failureSpy.mockRestore();
      }
    });

    it('returns result with prerequisites-failed cause when prerequisites fail without error', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const trace = {
        step: jest.fn(),
        failure: jest.fn(),
        success: jest.fn(),
        info: jest.fn(),
      };

      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(false);

      const result = bed.service.process(
        actionDef,
        actorEntity,
        context,
        trace
      );

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        actions: [],
        errors: [],
        cause: 'prerequisites-failed',
      });
      expect(trace.failure).toHaveBeenCalledWith(
        "Action 'test' discarded due to failed actor prerequisites.",
        'ActionCandidateProcessor.process'
      );
    });

    it('processes actions without prerequisites successfully', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        name: 'Test Action',
        commandVerb: 'test',
        scope: 'none',
        // No prerequisites array
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.noTarget()])
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toEqual({
        id: 'test',
        name: 'Test Action',
        command: 'doit',
        description: '',
        params: { targetId: null },
        visual: null,
      });
      expect(result.value.errors).toHaveLength(0);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
    });

    it('preserves visual metadata on formatted actions', () => {
      const bed = getBed();
      const actionDef = {
        id: 'visual-cue',
        name: 'Signal Ally',
        commandVerb: 'signal',
        scope: 'ally',
        visual: { icon: 'signal', palette: 'blue' },
      };
      const actorEntity = { id: 'actor-visual' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('ally-1')])
      );
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'signal ally-1',
      });

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toMatchObject({
        id: 'visual-cue',
        command: 'signal ally-1',
        visual: { icon: 'signal', palette: 'blue' },
      });
    });

    it('treats null prerequisites as absent prerequisites', () => {
      const bed = getBed();
      const actionDef = {
        id: 'null-prereq',
        name: 'Null Prereq Action',
        commandVerb: 'null',
        scope: 'none',
        prerequisites: null,
      };
      const actorEntity = { id: 'actor-null' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.noTarget()])
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
    });

    it('processes actions with empty prerequisites array successfully', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        name: 'Test Action',
        commandVerb: 'test',
        scope: 'none',
        prerequisites: [], // Empty array
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.noTarget()])
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toEqual({
        id: 'test',
        name: 'Test Action',
        command: 'doit',
        description: '',
        params: { targetId: null },
        visual: null,
      });
      expect(result.value.errors).toHaveLength(0);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
    });

    it('treats undefined prerequisites property as absent prerequisites', () => {
      const bed = getBed();
      const actionDef = {
        id: 'undefined-prereq',
        name: 'Undefined Prereq Action',
        commandVerb: 'undef',
        scope: 'none',
        prerequisites: undefined,
      };
      const actorEntity = { id: 'actor-undef' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.noTarget()])
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
    });

    it('includes formatting errors in the result', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        commandVerb: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([
          ActionTargetContext.forEntity('target1'),
          ActionTargetContext.forEntity('target2'),
        ])
      );
      bed.mocks.actionCommandFormatter.format.mockImplementation(
        (def, target) => {
          if (target.entityId === 'target1') {
            return { ok: true, value: 'test target1' };
          }
          return {
            ok: false,
            error: 'Format failed',
            details: { targetId: target.entityId },
          };
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0].command).toBe('test target1');
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: 'target2',
        error: 'Format failed',
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
        environmentContext: expect.objectContaining({
          formatDetails: { targetId: 'target2' },
        }),
      });
    });

    it('returns errors when target resolution fails', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const resolutionError = new Error('Target resolution failed');

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure(resolutionError)
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('resolution-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        error: resolutionError,
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
        environmentContext: expect.objectContaining({
          scope: 'target',
        }),
      });
      // Logger.error is not called anymore since the service returns ActionResult
    });

    it('returns errors when target resolution fails with string error', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const resolutionError = 'String error message';

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure(resolutionError)
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('resolution-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        error: expect.any(Error),
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
        environmentContext: expect.objectContaining({
          scope: 'target',
        }),
      });
      // Logger.error is not called anymore since the service returns ActionResult
    });

    it('handles target resolution failures without an error array', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        success: false,
      });

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        actions: [],
        errors: [],
        cause: 'resolution-error',
      });
    });

    it('returns errors when prerequisite evaluation throws ActionErrorContext', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      // Create an error that already has ActionErrorContext properties
      const actionErrorContext = {
        message: 'Prerequisites failed',
        timestamp: Date.now(),
        phase: 'validation',
        actionId: 'test',
        targetId: null,
        error: new Error('Prerequisites failed'),
        actorSnapshot: { id: 'actor', components: {} },
        evaluationTrace: { steps: [] },
        suggestedFixes: [],
        environmentContext: {},
      };

      bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => {
          throw actionErrorContext;
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);

      // Should pass through the existing error context
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        timestamp: actionErrorContext.timestamp,
        phase: actionErrorContext.phase,
      });
    });

    it('returns errors when target resolution returns ActionErrorContext', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      // Create an error that already has ActionErrorContext properties
      const actionErrorContext = {
        message: 'Target resolution failed',
        timestamp: Date.now(),
        phase: 'scope_resolution',
        actionId: 'test',
        targetId: 'target1',
        error: new Error('Target resolution failed'),
        actorSnapshot: { id: 'actor', components: {} },
        evaluationTrace: { steps: [] },
        suggestedFixes: [],
        environmentContext: { scope: 'target' },
      };

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure(actionErrorContext)
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('resolution-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);

      // Should pass through the existing error context
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        timestamp: actionErrorContext.timestamp,
        phase: actionErrorContext.phase,
      });
    });

    it('handles exception when target resolution throws', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const resolutionError = new Error('Unexpected resolution error');

      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        () => {
          throw resolutionError;
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('resolution-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        error: resolutionError,
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
        environmentContext: expect.objectContaining({
          scope: 'target',
        }),
      });
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        `Error resolving scope for action 'test': ${resolutionError.message}`,
        expect.any(Object)
      );
    });

    it('handles exception when command formatting throws', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        name: 'Test Action',
        commandVerb: 'test',
        scope: 'target',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const formatError = new Error('Unexpected format error');

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('target1')])
      );
      bed.mocks.actionCommandFormatter.format.mockImplementation(() => {
        throw formatError;
      });

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: 'target1',
        error: formatError,
        phase: expect.any(String),
        timestamp: expect.any(Number),
        actorSnapshot: expect.any(Object),
        evaluationTrace: expect.any(Object),
        suggestedFixes: expect.any(Array),
      });
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        `Error formatting action 'test' for target 'target1'.`,
        expect.any(Object)
      );
    });

    it('processes multiple targets with mixed success and exceptions', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        name: 'Test Action',
        commandVerb: 'test',
        scope: 'target',
        description: 'Test description',
      };
      const actorEntity = { id: 'actor' };
      const context = {};
      const formatError = new Error('Format error for target3');

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([
          ActionTargetContext.forEntity('target1'),
          ActionTargetContext.forEntity('target2'),
          ActionTargetContext.forEntity('target3'),
        ])
      );

      bed.mocks.actionCommandFormatter.format.mockImplementation(
        (def, target) => {
          if (target.entityId === 'target1') {
            return { ok: true, value: 'test target1' };
          } else if (target.entityId === 'target2') {
            return {
              ok: false,
              error: 'Format failed for target2',
              details: { reason: 'Invalid state' },
            };
          } else {
            // target3 throws an exception
            throw formatError;
          }
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toEqual({
        id: 'test',
        name: 'Test Action',
        command: 'test target1',
        description: 'Test description',
        params: { targetId: 'target1' },
        visual: null,
      });

      expect(result.value.errors).toHaveLength(2);

      // Error from failed format result
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: 'target2',
        error: 'Format failed for target2',
        phase: expect.any(String),
        environmentContext: expect.objectContaining({
          formatDetails: { reason: 'Invalid state' },
        }),
      });

      // Error from thrown exception
      expect(result.value.errors[1]).toMatchObject({
        actionId: 'test',
        targetId: 'target3',
        error: formatError,
        phase: expect.any(String),
      });

      expect(bed.mocks.logger.warn).toHaveBeenCalledTimes(1);
      expect(bed.mocks.logger.error).toHaveBeenCalledTimes(1);
    });

    it('handles prerequisite evaluation failure with non-ActionErrorContext errors', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      // Create a custom service with a mocked actionErrorContextBuilder
      // that returns an object without timestamp/phase for the first call
      const customService = new ActionCandidateProcessor({
        prerequisiteEvaluationService: bed.mocks.prerequisiteEvaluationService,
        targetResolutionService: bed.mocks.targetResolutionService,
        entityManager: bed.mocks.entityManager,
        actionCommandFormatter: bed.mocks.actionCommandFormatter,
        safeEventDispatcher: bed.mocks.safeEventDispatcher,
        getEntityDisplayNameFn: bed.mocks.getEntityDisplayNameFn,
        logger: bed.mocks.logger,
        actionErrorContextBuilder: {
          buildErrorContext: jest
            .fn()
            .mockReturnValueOnce({
              // First call returns object without timestamp/phase
              error: new Error('Prerequisites failed'),
              actionId: 'test',
            })
            .mockReturnValue({
              // Subsequent calls return proper ActionErrorContext
              error: new Error('Prerequisites failed'),
              actionId: 'test',
              targetId: null,
              timestamp: Date.now(),
              phase: 'validation',
              actorSnapshot: { id: 'actor', components: {} },
              evaluationTrace: { steps: [] },
              suggestedFixes: [],
              environmentContext: {},
            }),
        },
      });

      // Make prerequisite evaluation throw to trigger error handling
      bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        () => {
          throw new Error('Prerequisites failed');
        }
      );

      const result = customService.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: 'test',
        targetId: null,
        error: expect.any(Error),
        phase: 'validation',
        timestamp: expect.any(Number),
      });
    });

    it('normalizes mixed target resolution errors using builder only for raw entries', () => {
      const bed = getBed();
      const actionDef = {
        id: 'mixed-errors',
        scope: 'target',
      };
      const actorEntity = { id: 'actor-1' };
      const context = {};

      const existingContext = {
        actionId: actionDef.id,
        targetId: 'existing-target',
        error: new Error('prebuilt context'),
        actorSnapshot: { id: actorEntity.id },
        evaluationTrace: { steps: [] },
        suggestedFixes: [],
        environmentContext: { scope: actionDef.scope },
        timestamp: Date.now(),
        phase: ERROR_PHASES.VALIDATION,
      };
      const rawError = new Error('raw resolution failure');
      const normalizedRawError = {
        actionId: actionDef.id,
        targetId: null,
        error: rawError,
        actorSnapshot: { id: actorEntity.id },
        evaluationTrace: { steps: [] },
        suggestedFixes: [],
        environmentContext: { scope: actionDef.scope },
        timestamp: 42,
        phase: ERROR_PHASES.VALIDATION,
      };

      const createContextSpy = jest.spyOn(
        discoveryErrorUtils,
        'createActionErrorContext'
      );

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        success: false,
        errors: [existingContext, rawError],
      });
      bed.mocks.actionErrorContextBuilder.buildErrorContext.mockImplementation(
        ({
          error,
          actionDef: def,
          actorId,
          phase,
          trace,
          additionalContext,
        }) => {
          expect(error).toBe(rawError);
          expect(def).toBe(actionDef);
          expect(actorId).toBe(actorEntity.id);
          expect(phase).toBe(ERROR_PHASES.VALIDATION);
          expect(trace).toBeNull();
          expect(additionalContext).toEqual({ scope: actionDef.scope });
          return normalizedRawError;
        }
      );

      try {
        const result = bed.service.process(actionDef, actorEntity, context);

        expect(result.success).toBe(true);
        expect(result.value.cause).toBe('resolution-error');
        expect(result.value.actions).toHaveLength(0);
        expect(result.value.errors).toEqual([
          existingContext,
          normalizedRawError,
        ]);
        expect(createContextSpy).toHaveBeenCalledTimes(2);
        expect(
          bed.mocks.actionErrorContextBuilder.buildErrorContext
        ).toHaveBeenCalledTimes(1);
      } finally {
        createContextSpy.mockRestore();
      }
    });

    it('passes shared formatter options to the action command formatter', () => {
      const bed = getBed();
      const actionDef = {
        id: 'formatter-options',
        name: 'Formatter Options',
        commandVerb: 'format',
        scope: 'target',
      };
      const actorEntity = { id: 'actor-options' };
      const context = {};

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('target-1')])
      );

      bed.mocks.actionCommandFormatter.format.mockImplementation(
        (def, targetContext, entityManager, formatterOptions) => {
          expect(def).toBe(actionDef);
          expect(targetContext.entityId).toBe('target-1');
          expect(entityManager).toBe(bed.mocks.entityManager);
          expect(formatterOptions).toEqual({
            logger: bed.mocks.logger,
            debug: true,
            safeEventDispatcher: bed.mocks.safeEventDispatcher,
          });
          return { ok: true, value: `format ${targetContext.entityId}` };
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toMatchObject({
        id: 'formatter-options',
        command: 'format target-1',
      });
    });

    it('captures formatter failures that omit detail payloads', () => {
      const bed = getBed();
      const actionDef = {
        id: 'formatter-failure',
        scope: 'target',
      };
      const actorEntity = { id: 'actor-failure' };
      const context = {};
      const formatError = new Error('format without details');

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('target-2')])
      );

      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: false,
        error: formatError,
      });

      bed.mocks.actionErrorContextBuilder.buildErrorContext.mockImplementation(
        (payload) => {
          expect(payload.targetId).toBe('target-2');
          expect(payload.additionalContext).toEqual({
            formatDetails: undefined,
          });
          return {
            actionId: actionDef.id,
            targetId: payload.targetId,
            error: formatError,
            actorSnapshot: { id: actorEntity.id },
            evaluationTrace: { steps: [] },
            suggestedFixes: [],
            environmentContext: payload.additionalContext,
            timestamp: 100,
            phase: ERROR_PHASES.VALIDATION,
          };
        }
      );

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0]).toMatchObject({
        actionId: actionDef.id,
        targetId: 'target-2',
        error: formatError,
        environmentContext: { formatDetails: undefined },
      });
    });
  });
});
