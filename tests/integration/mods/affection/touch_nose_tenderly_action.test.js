/**
 * @file Integration tests for the affection:touch_nose_tenderly action and rule.
 * @description Verifies the tender nose touch action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

const ACTION_ID = 'affection:touch_nose_tenderly';

describe('affection:touch_nose_tenderly action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('affection', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createCloseActors(['Avery', 'Rowan'], {
      location: 'conservatory',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const expectedMessage = "Avery touches the tip of Rowan's nose tenderly.";

    expect(testFixture.events).toHaveActionSuccess(expectedMessage);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
    expect(perceptibleEvent.payload.locationId).toBe('conservatory');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });

  it('includes correct metadata in perceptible event', async () => {
    const scenario = testFixture.createCloseActors(['Isabella', 'Lucas'], {
      location: 'library',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
    expect(perceptibleEvent.payload.locationId).toBe('library');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });

});
