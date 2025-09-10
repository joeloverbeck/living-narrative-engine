/**
 * @file Integration tests for the intimacy:hug_tight action and rule.
 * @description Tests the rule execution after the hug_tight action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import hugTightRule from '../../../../data/mods/intimacy/rules/handle_hug_tight.rule.json';
import eventIsActionHugTight from '../../../../data/mods/intimacy/conditions/event-is-action-hug-tight.condition.json';

describe('intimacy:hug_tight action rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:hug_tight',
      hugTightRule,
      eventIsActionHugTight
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('performs hug tight action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'living_room',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Alice closes their arms around Bob tenderly, hugging Bob tight.'
    );

    testFixture.assertPerceptibleEvent({
      descriptionText:
        'Alice closes their arms around Bob tenderly, hugging Bob tight.',
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

  it('formats message correctly with different names', async () => {
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
      'Sir Lancelot closes their arms around Lady Guinevere tenderly, hugging Lady Guinevere tight.'
    );
  });

  it('handles action with correct perception type', async () => {
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
});
