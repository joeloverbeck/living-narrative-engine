/**
 * @file Integration tests for grabbing:grab_neck_target rule execution.
 * @description Verifies runtime state changes and perceptible events for each outcome.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'grabbing:grab_neck_target';
const ROOM_ID = 'room1';

const forceOutcome = (fixture, outcome) => {
  fixture.testEnv.operationRegistry.register(
    'RESOLVE_OUTCOME',
    (params, executionContext) => {
      const resultVariable = params?.result_variable || 'attackResult';
      if (!executionContext?.evaluationContext?.context) {
        return;
      }

      executionContext.evaluationContext.context[resultVariable] = {
        outcome,
        roll: 1,
        threshold: 1,
        margin: 0,
        isCritical: outcome === 'CRITICAL_SUCCESS' || outcome === 'FUMBLE',
        modifiers: [],
      };
    }
  );
};

const captureLockCalls = (fixture) => {
  const calls = [];
  fixture.testEnv.operationRegistry.register('LOCK_GRABBING', (params) => {
    calls.push(params);
    return Promise.resolve(true);
  });
  return calls;
};

const getPerceptibleEvent = (fixture) =>
  fixture.events.find((event) => event.eventType === 'core:perceptible_event');

describe('grabbing:grab_neck_target rule execution', () => {
  let fixture;

  const setupScenario = () => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');
    const actorId = 'test:actor';
    const targetId = 'test:target';

    const actorBuilder = new ModEntityBuilder(actorId)
      .withName('Actor')
      .asActor()
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('skills:grappling_skill', { value: 15 })
      .withGrabbingHands(1)
      .closeToEntity(targetId);

    const targetBuilder = new ModEntityBuilder(targetId)
      .withName('Target')
      .asActor()
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .withComponent('skills:mobility_skill', { value: 5 })
      .closeToEntity(actorId);

    const actor = actorBuilder.build();
    const target = targetBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    fixture.reset([room, actor, target, ...handEntities]);
    fixture.clearEvents();

    return { actorId, targetId, handEntities };
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('grabbing', ACTION_ID);
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('applies CRITICAL_SUCCESS effects and dispatches perceptible event', async () => {
    const { actorId, targetId } = setupScenario();
    const lockCalls = captureLockCalls(fixture);
    forceOutcome(fixture, 'CRITICAL_SUCCESS');

    await fixture.executeAction(actorId, targetId);

    const grabbingNeck = fixture.entityManager.getComponentData(
      actorId,
      'grabbing-states:grabbing_neck'
    );
    const neckGrabbed = fixture.entityManager.getComponentData(
      targetId,
      'grabbing-states:neck_grabbed'
    );

    expect(grabbingNeck).toEqual({
      grabbed_entity_id: targetId,
      initiated: true,
      consented: false,
    });
    expect(neckGrabbed).toEqual({
      grabbing_entity_id: actorId,
      consented: false,
    });

    expect(lockCalls).toHaveLength(1);
    expect(lockCalls[0]).toMatchObject({
      actor_id: actorId,
      count: 1,
      item_id: targetId,
    });

    const perceptibleEvent = getPerceptibleEvent(fixture);
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Actor lunges forward with predatory speed, seizing Target's neck in an iron grip!"
    );
    expect(perceptibleEvent.payload.actorDescription).toBe(
      "I lunge forward with predatory speed, seizing Target's neck in an iron grip!"
    );
    expect(perceptibleEvent.payload.targetDescription).toBe(
      "Actor lunges forward with predatory speed, seizing my neck in an iron grip!"
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory: 'I hear a sudden scuffle and a choking sound nearby.',
      tactile: 'I feel the impact of bodies colliding nearby.',
    });
  });

  it('applies SUCCESS effects and dispatches perceptible event', async () => {
    const { actorId, targetId } = setupScenario();
    const lockCalls = captureLockCalls(fixture);
    forceOutcome(fixture, 'SUCCESS');

    await fixture.executeAction(actorId, targetId);

    const grabbingNeck = fixture.entityManager.getComponentData(
      actorId,
      'grabbing-states:grabbing_neck'
    );
    const neckGrabbed = fixture.entityManager.getComponentData(
      targetId,
      'grabbing-states:neck_grabbed'
    );

    expect(grabbingNeck).toEqual({
      grabbed_entity_id: targetId,
      initiated: true,
      consented: false,
    });
    expect(neckGrabbed).toEqual({
      grabbing_entity_id: actorId,
      consented: false,
    });

    expect(lockCalls).toHaveLength(1);
    expect(lockCalls[0]).toMatchObject({
      actor_id: actorId,
      count: 1,
      item_id: targetId,
    });

    const perceptibleEvent = getPerceptibleEvent(fixture);
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Actor reaches out and grabs Target's neck, gaining a firm hold."
    );
    expect(perceptibleEvent.payload.actorDescription).toBe(
      "I reach out and grab Target's neck, gaining a firm hold."
    );
    expect(perceptibleEvent.payload.targetDescription).toBe(
      'Actor reaches out and grabs my neck, gaining a firm hold.'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory: 'I hear sounds of a brief struggle nearby.',
      tactile: 'I feel vibrations of physical contact nearby.',
    });
  });

  it('applies FAILURE effects and dispatches perceptible event', async () => {
    const { actorId, targetId } = setupScenario();
    const lockCalls = captureLockCalls(fixture);
    forceOutcome(fixture, 'FAILURE');

    await fixture.executeAction(actorId, targetId);

    expect(
      fixture.entityManager.getComponentData(
        actorId,
        'grabbing-states:grabbing_neck'
      )
    ).toBeNull();
    expect(
      fixture.entityManager.getComponentData(
        targetId,
        'grabbing-states:neck_grabbed'
      )
    ).toBeNull();

    expect(lockCalls).toHaveLength(0);

    const perceptibleEvent = getPerceptibleEvent(fixture);
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Actor reaches for Target's neck, but Target manages to evade the grab."
    );
    expect(perceptibleEvent.payload.actorDescription).toBe(
      "I reach for Target's neck, but they manage to evade my grab."
    );
    expect(perceptibleEvent.payload.targetDescription).toBe(
      'Actor reaches for my neck, but I manage to evade the grab.'
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory: 'I hear shuffling and movement nearby.',
    });
  });

  it('applies FUMBLE effects and dispatches perceptible event', async () => {
    const { actorId, targetId } = setupScenario();
    const lockCalls = captureLockCalls(fixture);
    forceOutcome(fixture, 'FUMBLE');

    await fixture.executeAction(actorId, targetId);

    const fallen = fixture.entityManager.getComponentData(
      actorId,
      'recovery-states:fallen'
    );
    expect(fallen).toEqual({});
    expect(
      fixture.entityManager.getComponentData(
        actorId,
        'grabbing-states:grabbing_neck'
      )
    ).toBeNull();
    expect(
      fixture.entityManager.getComponentData(
        targetId,
        'grabbing-states:neck_grabbed'
      )
    ).toBeNull();

    expect(lockCalls).toHaveLength(0);

    const perceptibleEvent = getPerceptibleEvent(fixture);
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Actor lunges recklessly at Target's throat, completely overextending and crashing to the ground!"
    );
    expect(perceptibleEvent.payload.actorDescription).toBe(
      "I lunge recklessly at Target's throat, completely overextending and crashing to the ground!"
    );
    expect(perceptibleEvent.payload.targetDescription).toBe(
      "Actor lunges recklessly at my throat, completely overextending and crashing to the ground!"
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory: 'I hear someone stumble and fall heavily nearby.',
      tactile: 'I feel the thud of someone hitting the ground nearby.',
    });
  });
});
