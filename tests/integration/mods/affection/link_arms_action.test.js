/**
 * @file Integration tests for the affection:link_arms action and rule.
 * @description Validates rule execution and perceptible events for linking arms.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import handleLinkArmsRule from '../../../../data/mods/affection/rules/handle_link_arms.rule.json';
import eventIsActionLinkArms from '../../../../data/mods/affection/conditions/event-is-action-link-arms.condition.json';

const ACTION_ID = 'affection:link_arms';

describe('affection:link_arms action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleLinkArmsRule,
      eventIsActionLinkArms
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('links arms successfully between close actors', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'living_room',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Alice links arms with Bob.'
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: 'Alice links arms with Bob.',
      locationId: 'living_room',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('formats message correctly for different names', async () => {
    const scenario = testFixture.createCloseActors(
      ['Sir Lancelot', 'Lady Guinevere'],
      {
        location: 'castle_hall',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent.payload.message).toBe(
      'Sir Lancelot links arms with Lady Guinevere.'
    );
  });

  it('emits perceptible event with correct perception metadata', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('handles multiple close partners without mixing results', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Bob', 'Charlie'],
      {
        location: 'room1',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    let perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice links arms with Bob.'
    );

    testFixture.events.length = 0;

    await testFixture.executeAction(
      scenario.actor.id,
      scenario.observers[0].id
    );

    perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice links arms with Charlie.'
    );
  });

  it('only fires when the link arms action ID matches', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'hugging:hug_tight',
      targetId: scenario.target.id,
      originalInput: 'hug_tight target',
    });

    const linkArmsEvents = testFixture.events.filter(
      (e) =>
        e.eventType === 'core:perceptible_event' &&
        e.payload.descriptionText === 'Alice links arms with Bob.'
    );
    expect(linkArmsEvents).toHaveLength(0);
  });

  it('aligns success and perceptible messaging', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    const expectedMessage = 'Diana links arms with Victor.';
    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });

  it('rejects linking arms when the actor is hugging someone', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['target1'] })
      .withComponent('positioning:hugging', {
        embraced_entity_id: 'target1',
        initiated: true,
        consented: true,
      })
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['actor1'] })
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'actor1',
        consented: true,
      })
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*positioning:hugging/i);
  });
});
