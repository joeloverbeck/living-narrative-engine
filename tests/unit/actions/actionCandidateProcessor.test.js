import { beforeEach, expect, it, describe } from '@jest/globals';
import { describeActionCandidateProcessorSuite } from '../../common/actions/actionCandidateProcessorTestBed.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';

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

    it('returns result with prerequisites-failed cause when prerequisites fail without error', () => {
      const bed = getBed();
      const actionDef = {
        id: 'test',
        prerequisites: [{ op: 'test' }],
        scope: 'none',
      };
      const actorEntity = { id: 'actor' };
      const context = {};

      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(false);

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        actions: [],
        errors: [],
        cause: 'prerequisites-failed',
      });
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
  });
});
