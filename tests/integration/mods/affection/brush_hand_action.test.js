/**
 * @file Integration tests for the affection:brush_hand action and rule.
 * @description Tests the rule execution after the brush_hand action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import brushHandRule from '../../../../data/mods/affection/rules/brush_hand.rule.json';
import eventIsActionBrushHand from '../../../../data/mods/affection/conditions/event-is-action-brush-hand.condition.json';

function createActorWithHandAnatomy(id, name, location, partners = []) {
  const torsoId = `${id}-torso`;
  const handId = `${id}-hand`;

  const entity = new ModEntityBuilder(id)
    .withName(name)
    .atLocation(location)
    .withLocationComponent(location)
    .asActor()
    .withComponent('personal-space-states:closeness', { partners })
    .withBody(torsoId)
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [handId], subType: 'torso' })
    .atLocation(location)
    .withLocationComponent(location)
    .build();

  const hand = new ModEntityBuilder(handId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'hand' })
    .atLocation(location)
    .withLocationComponent(location)
    .build();

  return { entity, parts: [torso, hand] };
}

describe('affection:brush_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      'affection:brush_hand',
      brushHandRule,
      eventIsActionBrushHand
    );

    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'affection',
      'actors_with_hands_in_intimacy'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes brush hand action between close actors', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Alice', 'Bob'],
      ['torso', 'hand'],
      { location: 'room1' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toContain('hand');
  });

  it('handles multiple close actors correctly', async () => {
    const location = 'room1';
    const actor = createActorWithHandAnatomy('actor1', 'Alice', location, [
      'target1',
      'observer1',
    ]);
    const target = createActorWithHandAnatomy('target1', 'Bob', location, [
      'actor1',
    ]);
    const observer = createActorWithHandAnatomy(
      'observer1',
      'Charlie',
      location,
      ['actor1']
    );

    const room = new ModEntityBuilder(location).asRoom('Test Room').build();
    testFixture.reset([
      room,
      actor.entity,
      target.entity,
      observer.entity,
      ...actor.parts,
      ...target.parts,
      ...observer.parts,
    ]);
    const scenario = {
      actor: actor.entity,
      target: target.entity,
      observers: [observer.entity],
    };

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Diana', 'Victor'],
      ['torso', 'hand'],
      { location: 'library' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    // Both should have the same descriptive message
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });

  it('is not discoverable when the target has no hand anatomy', () => {
    const scenario = testFixture.createCloseActors(['Handless', 'Target']);
    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const ids = availableActions.map((action) => action.id);

    expect(ids).not.toContain('affection:brush_hand');
  });

  it('rejects the action when the actor is being hugged', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actorData = createActorWithHandAnatomy('actor1', 'Alice', 'room1', [
      'target1',
    ]);
    actorData.entity.components['positioning:being_hugged'] = {
      hugging_entity_id: 'target1',
    };

    const targetData = createActorWithHandAnatomy('target1', 'Bob', 'room1', [
      'actor1',
    ]);

    testFixture.reset([
      room,
      actorData.entity,
      targetData.entity,
      ...actorData.parts,
      ...targetData.parts,
    ]);

    await expect(
      testFixture.executeAction(actorData.entity.id, targetData.entity.id)
    ).rejects.toThrow(/forbidden component.*positioning:being_hugged/i);
  });

  it('rejects the action when the actor is currently hugging someone', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actorData = createActorWithHandAnatomy('actor1', 'Alice', 'room1', [
      'target1',
    ]);
    actorData.entity.components['positioning:hugging'] = {
      embraced_entity_id: 'target1',
      initiated: true,
      consented: true,
    };

    const targetData = createActorWithHandAnatomy('target1', 'Bob', 'room1', [
      'actor1',
    ]);
    targetData.entity.components['positioning:being_hugged'] = {
      hugging_entity_id: 'actor1',
      consented: true,
    };

    testFixture.reset([
      room,
      actorData.entity,
      targetData.entity,
      ...actorData.parts,
      ...targetData.parts,
    ]);

    await expect(
      testFixture.executeAction(actorData.entity.id, targetData.entity.id)
    ).rejects.toThrow(/forbidden component.*positioning:hugging/i);
  });
});
