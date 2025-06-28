import { beforeEach, expect, it, jest, describe } from '@jest/globals';
import { describeActionCandidateProcessorSuite } from '../../common/actions/actionCandidateProcessorTestBed.js';

describeActionCandidateProcessorSuite('ActionCandidateProcessor', (getBed) => {
  beforeEach(() => {
    const bed = getBed();
    bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
    bed.mocks.formatActionCommandFn.mockReturnValue({
      ok: true,
      value: 'doit',
    });
    bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([]);
  });

  describe('process', () => {
    it('returns null when action has no targets', () => {
      const bed = getBed();
      const actionDef = { id: 'test', scope: 'none' };
      const actorEntity = { id: 'actor' };
      const context = {};

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result).toBeNull();
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

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([
        { type: 'entity', entityId: 'enemy1' },
        { type: 'entity', entityId: 'enemy2' },
      ]);
      bed.mocks.formatActionCommandFn.mockImplementation((def, target) => ({
        ok: true,
        value: `${def.commandVerb} ${target.entityId}`,
      }));

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result).not.toBeNull();
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toEqual({
        id: 'attack',
        name: 'Attack',
        command: 'attack enemy1',
        description: 'Attack an enemy',
        params: { targetId: 'enemy1' },
      });
      expect(result.actions[1]).toEqual({
        id: 'attack',
        name: 'Attack',
        command: 'attack enemy2',
        description: 'Attack an enemy',
        params: { targetId: 'enemy2' },
      });
      expect(result.errors).toHaveLength(0);
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

      expect(result).not.toBeNull();
      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        actionId: 'test',
        targetId: null,
        error: error,
        details: null,
      });
    });

    it('returns null when prerequisites fail without error', () => {
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

      expect(result).toBeNull();
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

      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([
        { type: 'entity', entityId: 'target1' },
        { type: 'entity', entityId: 'target2' },
      ]);
      bed.mocks.formatActionCommandFn.mockImplementation((def, target) => {
        if (target.entityId === 'target1') {
          return { ok: true, value: 'test target1' };
        }
        return {
          ok: false,
          error: 'Format failed',
          details: { targetId: target.entityId },
        };
      });

      const result = bed.service.process(actionDef, actorEntity, context);

      expect(result).not.toBeNull();
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].command).toBe('test target1');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        actionId: 'test',
        targetId: 'target2',
        error: 'Format failed',
        details: { targetId: 'target2' },
      });
    });
  });
});
