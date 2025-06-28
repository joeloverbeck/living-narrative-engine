import { beforeEach, expect, it, jest } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

describeActionDiscoverySuite(
  'ActionDiscoveryService - getValidActions',
  (getBed) => {
    beforeEach(() => {
      const bed = getBed();
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.formatActionCommandFn.mockReturnValue({
        ok: true,
        value: 'doit',
      });
      bed.mocks.targetResolutionService.resolveTargets.mockResolvedValue([]);
      bed.mocks.getActorLocationFn.mockReturnValue({
        id: 'room1',
        getComponentData: jest.fn(),
      });
    });

    it('handles scope resolution errors and continues processing', async () => {
      const bed = getBed();
      const failingDef = { id: 'fail', commandVerb: 'fail', scope: 'badScope' };
      const okDef = { id: 'ok', commandVerb: 'wait', scope: 'none' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        failingDef,
        okDef,
      ]);
      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        async (scope) => {
          if (scope === 'badScope') return [];
          if (scope === 'none') return [{ type: 'none', entityId: null }];
          return [];
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
      const def = { id: 'attack', commandVerb: 'attack', scope: 'monster' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([def]);
      bed.mocks.targetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'entity', entityId: 'monster1' },
      ]);
      bed.mocks.formatActionCommandFn.mockReturnValue({
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
          name: 'attack',
          command: 'attack monster1',
          description: '',
          params: { targetId: 'monster1' },
        },
      ]);
    });

    it('continues discovery when one candidate throws an error', async () => {
      const bed = getBed();
      const badDef = { id: 'bad', commandVerb: 'bad', scope: 'none' };
      const okDef = { id: 'ok', commandVerb: 'wait', scope: 'none' };

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        badDef,
        okDef,
      ]);
      bed.mocks.targetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'none', entityId: null },
      ]);
      bed.mocks.formatActionCommandFn.mockImplementation((def) => {
        if (def.id === 'bad') throw new Error('boom');
        return { ok: true, value: def.commandVerb };
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
  }
);
