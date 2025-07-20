import { beforeEach, expect, it, describe } from '@jest/globals';
import { describeActionCandidateProcessorSuite } from '../../common/actions/actionCandidateProcessorTestBed.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

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
      });
      expect(result.value.actions[1]).toEqual({
        id: 'attack',
        name: 'Attack',
        command: 'attack enemy2',
        description: 'Attack an enemy',
        params: { targetId: 'enemy2' },
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
  });
});
