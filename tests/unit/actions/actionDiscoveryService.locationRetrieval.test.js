import { beforeEach, expect, test, jest } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';

describeActionDiscoverySuite(
  'ActionDiscoveryService – scoped discovery',
  (getBed) => {
    const actionDefs = [
      {
        id: 'core:go',
        name: 'Go',
        commandVerb: 'go',
        scope: 'directions',
        description: 'Move to another location',
        prerequisites: [{ logic: { '==': [1, 1] } }],
      },
      {
        id: 'core:wait',
        name: 'Wait',
        commandVerb: 'wait',
        scope: 'none',
        prerequisites: [{ logic: { '==': [1, 1] } }],
      },
    ];

    beforeEach(() => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue(actionDefs);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        (scope) => {
          if (scope === 'directions') {
            return ActionResult.success([
              ActionTargetContext.forEntity('loc-2'),
              ActionTargetContext.forEntity('loc-3'),
            ]);
          }
          if (scope === 'none') {
            return ActionResult.success([ActionTargetContext.noTarget()]);
          }
          return ActionResult.success([]);
        }
      );
      bed.mocks.actionCommandFormatter.format.mockImplementation((def, ctx) => {
        return ctx.entityId
          ? { ok: true, value: `${def.commandVerb} ${ctx.entityId}` }
          : { ok: true, value: def.commandVerb };
      });
      bed.mocks.getActorLocationFn.mockReturnValue({
        id: 'loc-1',
        getComponentData: jest.fn(),
      });
    });

    test('discovers scoped actions based on scope resolution', async () => {
      const bed = getBed();
      const actor = { id: 'actor-1' };
      const context = { jsonLogicEval: {} };

      const result = await bed.service.getValidActions(actor, context);

      const goActions = result.actions.filter((a) => a.id === 'core:go');
      expect(goActions).toHaveLength(2);

      const goAction1 = goActions.find((a) => a.params.targetId === 'loc-2');
      expect(goAction1).toBeDefined();
      expect(goAction1.command).toBe('go loc-2');
      expect(goAction1.params.targetId).toBe('loc-2');

      const goAction2 = goActions.find((a) => a.params.targetId === 'loc-3');
      expect(goAction2).toBeDefined();
      expect(goAction2.command).toBe('go loc-3');
      expect(goAction2.params.targetId).toBe('loc-3');

      const waitAction = result.actions.find((a) => a.id === 'core:wait');
      expect(waitAction).toBeDefined();
      expect(waitAction.command).toBe('wait');

      expect(bed.mocks.logger.error).not.toHaveBeenCalled();
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).toHaveBeenCalledTimes(2);
    });
  }
);
