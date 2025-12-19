import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import breakFreeRule from '../../../../data/mods/physical-control/rules/handle_break_free_from_restraint.rule.json' assert { type: 'json' };
import breakFreeCondition from '../../../../data/mods/physical-control/conditions/event-is-action-break-free-from-restraint.condition.json' assert { type: 'json' };

const ACTION_ID = 'physical-control:break_free_from_restraint';

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
      targetSkill: 10,
      breakdown: {},
    };
  };

describe('physical-control:break_free_from_restraint closeness handling', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture(
      'physical-control',
      ACTION_ID,
      breakFreeRule,
      breakFreeCondition
    );
    await testFixture.initialize();
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('removes closeness between restrained actor and restrainer on success', async () => {
    const room = ModEntityScenarios.createRoom('room1', 'Training Room');
    const actor = new ModEntityBuilder('test:restrained')
      .withName('Restrained')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:grappling_skill', { value: 8 })
      .withComponent('positioning:being_restrained', {
        restraining_entity_id: 'test:holder',
      })
      .closeToEntity('test:holder')
      .build();

    const target = new ModEntityBuilder('test:holder')
      .withName('Holder')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:grappling_skill', { value: 12 })
      .withComponent('positioning:restraining', {
        restrained_entity_id: 'test:restrained',
        initiated: true,
      })
      .closeToEntity('test:restrained')
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

    expect(actorAfter.components['personal-space-states:closeness']).toBeUndefined();
    expect(targetAfter.components['personal-space-states:closeness']).toBeUndefined();
  });
});
