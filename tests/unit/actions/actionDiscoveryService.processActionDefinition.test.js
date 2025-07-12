import { beforeEach, expect, it, jest } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

describeActionDiscoverySuite(
  'ActionDiscoveryService - getValidActions',
  (getBed) => {
    beforeEach(() => {
      const bed = getBed();
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'doit',
      });
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        targets: [],
      });
      bed.mocks.getActorLocationFn.mockReturnValue({
        id: 'room1',
        getComponentData: jest.fn(),
      });
    });

    it('handles scope resolution errors and continues processing', async () => {
      const bed = getBed();
      const failingDef = {
        id: 'fail',
        name: 'Fail',
        template: 'fail',
        scope: 'badScope',
      };
      const okDef = { id: 'ok', name: 'Wait', template: 'wait', scope: 'none' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        failingDef,
        okDef,
      ]);
      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scope) => {
          if (scope === 'badScope') return { targets: [] };
          if (scope === 'none')
            return { targets: [{ type: 'none', entityId: null }] };
          return { targets: [] };
        }
      );

      const result = await bed.service.getValidActions({ id: 'actor' }, {});

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('ok');
      expect(result.errors).toHaveLength(0);
      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith(
        'badScope',
        { id: 'actor' },
        expect.anything(),
        null
      );
      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith('none', { id: 'actor' }, expect.anything(), null);
    });

    it('uses the target resolution service for scoped actions', async () => {
      const bed = getBed();
      const def = {
        id: 'attack',
        name: 'Attack',
        template: 'attack {target}',
        scope: 'monster',
      };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        targets: [{ type: 'entity', entityId: 'monster1' }],
      });
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'attack monster1',
      });
      const result = await bed.service.getValidActions(
        { id: 'actor' },
        { jsonLogicEval: {} }
      );

      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith(
        'monster',
        { id: 'actor' },
        expect.objectContaining({
          currentLocation: {
            id: 'room1',
            getComponentData: expect.any(Function),
          },
          getActor: expect.any(Function),
          jsonLogicEval: {},
        }),
        null
      );
      expect(result.actions).toEqual([
        {
          id: 'attack',
          name: 'Attack',
          command: 'attack monster1',
          description: '',
          params: { targetId: 'monster1' },
        },
      ]);
    });

    it('continues discovery when one candidate throws an error', async () => {
      const bed = getBed();
      const badDef = { id: 'bad', name: 'Bad', template: 'bad', scope: 'none' };
      const okDef = { id: 'ok', name: 'Wait', template: 'wait', scope: 'none' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        badDef,
        okDef,
      ]);
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        targets: [{ type: 'none', entityId: null }],
      });
      bed.mocks.actionCommandFormatter.format.mockImplementation((def) => {
        if (def.id === 'bad') throw new Error('boom');
        return { ok: true, value: def.template };
      });

      const result = await bed.service.getValidActions({ id: 'actor' }, {});

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('ok');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: null,
        details: null,
      });
      expect(result.errors[0].error).toBeInstanceOf(Error);
    });

    it('captures errors thrown during prerequisite evaluation', async () => {
      const bed = getBed();
      const badDef = {
        id: 'bad',
        name: 'Bad',
        template: 'bad',
        scope: 'none',
        prerequisites: [{}],
      };
      const okDef = { id: 'ok', name: 'Wait', template: 'wait', scope: 'none' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        badDef,
        okDef,
      ]);
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue({
        targets: [{ type: 'none', entityId: null }],
      });
      bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        (_, def) => {
          if (def.id === 'bad') throw new Error('kaboom');
          return true;
        }
      );

      const result = await bed.service.getValidActions({ id: 'actor' }, {});

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('ok');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        actionId: 'bad',
        targetId: null,
      });
      expect(result.errors[0].error).toBeInstanceOf(Error);
      expect(bed.mocks.logger.error).toHaveBeenCalled();
    });
  }
);
