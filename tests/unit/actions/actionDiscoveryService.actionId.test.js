import { beforeEach, expect, it } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

describeActionDiscoverySuite(
  'ActionDiscoveryService params exposure',
  (getBed) => {
    const dummyActionDef = {
      id: 'core:attack',
      name: 'Attack',
      commandVerb: 'attack',
      description: 'Attack target',
      scope: 'enemies',
    };

    beforeEach(() => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        dummyActionDef,
      ]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.success([ActionTargetContext.forEntity('rat123')])
      );
      bed.mocks.actionCommandFormatter.format.mockReturnValue({
        ok: true,
        value: 'attack rat123',
      });
      bed.mocks.getActorLocationFn.mockReturnValue('some-room');
    });

    it('should include params.targetId for entity-scoped actions', async () => {
      const bed = getBed();
      const actor = { id: 'player1' };
      const context = { jsonLogicEval: {} };

      const result = await bed.service.getValidActions(actor, context);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toMatchObject({
        id: 'core:attack',
        params: { targetId: 'rat123' },
      });
    });
  }
);
