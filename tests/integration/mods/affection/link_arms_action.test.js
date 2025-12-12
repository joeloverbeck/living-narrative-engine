/**
 * @file Integration tests for the affection:link_arms action and rule.
 * @description Validates rule execution and perceptible events for linking arms.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
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

    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'affection',
      'actors_with_arm_subtypes_facing_each_other_or_behind_target'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('links arms successfully between close actors', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'arm', 'arm'],
      { location: 'living_room' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe('Alice links arms with Bob.');

    testFixture.assertPerceptibleEvent({
      descriptionText: 'Alice links arms with Bob.',
      locationId: 'living_room',
      perceptionType: 'physical.target_action',
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
    const scenario = testFixture.createAnatomyScenario(
      ['Sir Lancelot', 'Lady Guinevere'],
      ['torso', 'arm', 'arm'],
      { location: 'castle_hall' }
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
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'arm', 'arm'],
      { location: 'garden' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('handles multiple close partners without mixing results', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'arm', 'arm'],
      { location: 'room1' }
    );
    const observer = new ModEntityBuilder('observer1')
      .withName('Charlie')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('positioning:closeness', {
        partners: [scenario.actor.id],
      })
      .withBody('observer1-torso')
      .build();
    const observerTorso = new ModEntityBuilder('observer1-torso')
      .asBodyPart({
        parent: null,
        children: ['observer1-arm'],
        subType: 'torso',
      })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();
    const observerArm = new ModEntityBuilder('observer1-arm')
      .asBodyPart({ parent: 'observer1-torso', children: [], subType: 'arm' })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();
    observer.components['positioning:closeness'] = {
      partners: [scenario.actor.id],
    };
    scenario.actor.components['positioning:closeness'].partners.push(
      observer.id
    );
    scenario.observers = [observer];
    testFixture.reset([
      ...scenario.allEntities,
      observer,
      observerTorso,
      observerArm,
    ]);

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
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'arm', 'arm'],
      { location: 'room1' }
    );

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
    const scenario = testFixture.createAnatomyScenario(
      ['Diana', 'Victor'],
      ['torso', 'arm', 'arm'],
      { location: 'library' }
    );

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
      .withLocationComponent('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['target1'] })
      .withComponent('positioning:hugging', {
        embraced_entity_id: 'target1',
        initiated: true,
        consented: true,
      })
      .withBody('actor1-torso')
      .build();
    const actorTorso = new ModEntityBuilder('actor1-torso')
      .asBodyPart({ parent: null, children: ['actor1-arm'], subType: 'torso' })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();
    const actorArm = new ModEntityBuilder('actor1-arm')
      .asBodyPart({ parent: 'actor1-torso', children: [], subType: 'arm' })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('positioning:closeness', { partners: ['actor1'] })
      .withComponent('positioning:being_hugged', {
        hugging_entity_id: 'actor1',
        consented: true,
      })
      .withBody('target1-torso')
      .build();
    const targetTorso = new ModEntityBuilder('target1-torso')
      .asBodyPart({ parent: null, children: ['target1-arm'], subType: 'torso' })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();
    const targetArm = new ModEntityBuilder('target1-arm')
      .asBodyPart({ parent: 'target1-torso', children: [], subType: 'arm' })
      .atLocation('room1')
      .withLocationComponent('room1')
      .build();

    testFixture.reset([
      room,
      actor,
      target,
      actorTorso,
      actorArm,
      targetTorso,
      targetArm,
    ]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*positioning:hugging/i);
  });
});
