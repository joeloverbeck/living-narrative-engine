import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import handleLetGoRule from '../../../../data/mods/physical-control/rules/handle_let_go_of_restrained_target.rule.json' assert { type: 'json' };
import letGoCondition from '../../../../data/mods/physical-control/conditions/event-is-action-let-go-of-restrained-target.condition.json' assert { type: 'json' };
import letGoAction from '../../../../data/mods/physical-control/actions/let_go_of_restrained_target.action.json' assert { type: 'json' };

const ACTION_ID = 'physical-control:let_go_of_restrained_target';

describe('handle_let_go_of_restrained_target outcome behavior', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture(
      'physical-control',
      ACTION_ID,
      handleLetGoRule,
      letGoCondition
    );
    await testFixture.initialize();
  });

  afterEach(() => {
    if (
      testFixture?.testEnv?.unifiedScopeResolver?.__letGoOutcomeOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__letGoOutcomeOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const primeRestraint = (options = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Training Room');

    const actorBuilder = new ModEntityBuilder('test:holder')
      .withName(options.actorName || 'Holder')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor();

    const actor = actorBuilder.build();

    const targetBuilder = new ModEntityBuilder('test:captive')
      .withName(options.targetName || 'Captive')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor();

    const target = targetBuilder.build();

    if (options.includeRestraint !== false) {
      actor.components['physical-control-states:restraining'] = {
        restrained_entity_id: target.id,
        initiated: true,
      };
      target.components['physical-control-states:being_restrained'] = {
        restraining_entity_id: actor.id,
      };
    }

    if (options.includeCloseness) {
      actor.components['personal-space-states:closeness'] = { partners: [target.id] };
      target.components['personal-space-states:closeness'] = { partners: [actor.id] };
    }

    testFixture.reset([room, actor, target]);
    return { room, actor, target };
  };

  const configureScopeResolution = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    testEnv.actionIndex.buildIndex([letGoAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__letGoOutcomeOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__letGoOutcomeOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'physical-control:restrained_entity_i_am_holding') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const { entityManager } = testEnv;
        const actorEntity = entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return { success: true, value: new Set() };
        }

        const restraining =
          actorEntity.components?.['physical-control-states:restraining'] || null;
        const targetId = restraining?.restrained_entity_id;
        if (!targetId) {
          return { success: true, value: new Set() };
        }

        const targetEntity = entityManager.getEntityInstance(targetId);
        const beingRestrained =
          targetEntity?.components?.['physical-control-states:being_restrained'] || null;
        if (
          !targetEntity ||
          beingRestrained?.restraining_entity_id !== actorId
        ) {
          return { success: true, value: new Set() };
        }

        return { success: true, value: new Set([targetId]) };
      }

      return originalResolve(scopeName, context);
    };
  };

  it('removes restraint components, unlocks grabbing, regenerates descriptions, and emits success messaging', async () => {
    const { actor, target } = primeRestraint();
    configureScopeResolution();

    const unlockSpy = jest.fn().mockResolvedValue(undefined);
    testFixture.testEnv.operationRegistry.register(
      'UNLOCK_GRABBING',
      unlockSpy
    );

    await testFixture.executeAction(actor.id, target.id, {
      skipValidation: true,
    });

    const actorInstance = testFixture.entityManager.getEntityInstance(actor.id);
    const targetInstance = testFixture.entityManager.getEntityInstance(
      target.id
    );

    expect(actorInstance).toNotHaveComponent('physical-control-states:restraining');
    expect(targetInstance).toNotHaveComponent('physical-control-states:being_restrained');

    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(unlockSpy).toHaveBeenCalledWith(
      {
        actor_id: actor.id,
        count: 2,
        item_id: target.id,
      },
      expect.any(Object)
    );

    const expectedMessage =
      'Holder lets go of Captive, leaving them unrestrained.';

    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      locationId: 'room1',
      perceptionType: 'physical.target_action',
      actorId: actor.id,
      targetId: target.id,
    });

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent?.payload?.message).toBe(expectedMessage);
  });

  it('still succeeds and logs when restraint components are already missing', async () => {
    const { actor, target } = primeRestraint({ includeRestraint: false });
    configureScopeResolution();

    await testFixture.executeAction(actor.id, target.id, {
      skipValidation: true,
    });

    const expectedMessage =
      'Holder lets go of Captive, leaving them unrestrained.';
    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent?.payload?.message).toBe(expectedMessage);
    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      locationId: 'room1',
      perceptionType: 'physical.target_action',
      actorId: actor.id,
      targetId: target.id,
    });
  });

  it('breaks any closeness circle between actor and target', async () => {
    const { actor, target } = primeRestraint({ includeCloseness: true });
    configureScopeResolution();

    await testFixture.executeAction(actor.id, target.id, {
      skipValidation: true,
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actor.id);
    const targetAfter = testFixture.entityManager.getEntityInstance(target.id);

    expect(actorAfter.components['personal-space-states:closeness']).toBeUndefined();
    expect(targetAfter.components['personal-space-states:closeness']).toBeUndefined();
  });
});
