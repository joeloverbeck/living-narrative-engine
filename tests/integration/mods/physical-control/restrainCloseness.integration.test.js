import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import handleRestrainTargetRule from '../../../../data/mods/physical-control/rules/handle_restrain_target.rule.json' assert { type: 'json' };
import restrainCondition from '../../../../data/mods/physical-control/conditions/event-is-action-restrain-target.condition.json' assert { type: 'json' };

const ACTION_ID = 'physical-control:restrain_target';

const forceOutcome =
  (outcome = 'SUCCESS') =>
  (params, ctx) => {
    ctx.evaluationContext.context[params.result_variable] = {
      outcome,
      roll: 1,
      threshold: 100,
      margin: -99,
      isCritical: outcome === 'CRITICAL_SUCCESS',
      actorSkill: 10,
      targetSkill: 0,
      breakdown: {},
    };
  };

describe('physical-control:restrain_target closeness handling', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture(
      'physical-control',
      ACTION_ID,
      handleRestrainTargetRule,
      restrainCondition
    );
    await testFixture.initialize();
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('merges actor and target into a closeness circle on success', async () => {
    const room = ModEntityScenarios.createRoom('room1', 'Training Room');
    const actor = new ModEntityBuilder('test:holder')
      .withName('Holder')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:grappling_skill', { value: 10 })
      .build();
    const target = new ModEntityBuilder('test:captive')
      .withName('Captive')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:defense_skill', { value: 5 })
      .build();

    testFixture.reset([room, actor, target]);

    testFixture.testEnv.operationRegistry.register(
      'RESOLVE_OUTCOME',
      forceOutcome('SUCCESS')
    );

    await testFixture.executeAction(actor.id, target.id, {
      skipDiscovery: true,
      skipValidation: true,
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actor.id);
    const targetAfter = testFixture.entityManager.getEntityInstance(target.id);

    expect(actorAfter.components['personal-space-states:closeness'].partners).toEqual([
      target.id,
    ]);
    expect(targetAfter.components['personal-space-states:closeness'].partners).toEqual([
      actor.id,
    ]);
  });
});
