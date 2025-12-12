/**
 * @file Integration tests for the caressing:caress_cheek_softly action and rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import caressСheekSoftlyRule from '../../../../data/mods/caressing/rules/handle_caress_cheek_softly.rule.json';
import eventIsActionCaressСheekSoftly from '../../../../data/mods/caressing/conditions/event-is-action-caress-cheek-softly.condition.json';

describe('caressing:caress_cheek_softly action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'caressing',
      'caressing:caress_cheek_softly',
      caressСheekSoftlyRule,
      eventIsActionCaressСheekSoftly
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully executes caress cheek softly action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice caresses Bob's cheek softly."
    );
  });

  it('validates perceptible event message matches action success message', async () => {
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

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      perceptibleEvent.payload.descriptionText
    );
  });

  it('validates event metadata is correctly populated', async () => {
    const scenario = testFixture.createCloseActors(['Emma', 'Oliver'], {
      location: 'garden',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('garden');
    expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
