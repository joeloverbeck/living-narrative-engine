/**
 * @file Integration tests for the affection:push_target_playfully action and rule.
 * @description Verifies the playful shove action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handlePushTargetPlayfullyRule from '../../../../data/mods/affection/rules/handle_push_target_playfully.rule.json';
import eventIsActionPushTargetPlayfully from '../../../../data/mods/affection/conditions/event-is-action-push-target-playfully.condition.json';

const ACTION_ID = 'affection:push_target_playfully';

describe('affection:push_target_playfully action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handlePushTargetPlayfullyRule,
      eventIsActionPushTargetPlayfully
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createCloseActors(['Amelia', 'Jonah'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    const expectedMessage = 'Amelia pushes Jonah playfully.';
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });

  it('rejects the playful push when the actor is hugging their target', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Amelia')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['target1'] })
      .withComponent('hugging-states:hugging', {
        embraced_entity_id: 'target1',
        initiated: true,
        consented: true,
      })
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Jonah')
      .atLocation('room1')
      .asActor()
      .withComponent('personal-space-states:closeness', { partners: ['actor1'] })
      .withComponent('hugging-states:being_hugged', {
        hugging_entity_id: 'actor1',
        consented: true,
      })
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*hugging-states:hugging/i);
  });
});
