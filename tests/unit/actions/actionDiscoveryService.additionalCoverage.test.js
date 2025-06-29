import { beforeEach, expect, it } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// Additional coverage tests for ActionDiscoveryService

describeActionDiscoverySuite(
  'ActionDiscoveryService additional coverage',
  (getBed) => {
    beforeEach(() => {
      const bed = getBed();
      bed.mocks.getActorLocationFn.mockReturnValue('room1');
    });

    it('returns empty result when actor entity is null or missing id', async () => {
      const bed = getBed();

      const resultNull = await bed.service.getValidActions(null, {});
      const resultMissing = await bed.service.getValidActions({}, {});

      expect(resultNull).toEqual({ actions: [], errors: [], trace: null });
      expect(resultMissing).toEqual({ actions: [], errors: [], trace: null });
      expect(bed.mocks.logger.error).toHaveBeenCalledTimes(2);
      expect(bed.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'getValidActions called with invalid actor entity.'
        )
      );
    });

    it('provides a discovery context with getActor helper', async () => {
      const bed = getBed();
      const actor = { id: 'actor1' };

      const def = { id: 'noop', commandVerb: 'wait', scope: 'none' };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scope, entity, ctx) => {
          // invoke getActor to ensure the arrow function is executed
          expect(ctx.getActor()).toBe(actor);
          return [{ type: 'none', entityId: null }];
        }
      );
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'wait',
      });

      await bed.service.getValidActions(actor, {});
    });

    it('collects formatting errors returned by formatActionCommandFn', async () => {
      const bed = getBed();
      const actor = { id: 'actor1' };

      const def = { id: 'bad', commandVerb: 'bad', scope: 'target' };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue([
        { type: 'entity', entityId: 't1' },
      ]);
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: false,
        error: new Error('nope'),
        details: { reason: 'bad' },
      });

      const result = await bed.service.getValidActions(actor, {});

      expect(result.actions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: 't1',
        error: expect.any(Error),
        details: { reason: 'bad' },
      });
      expect(bed.mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to format command for action 'bad' with target 't1'."
        )
      );
    });
  }
);
