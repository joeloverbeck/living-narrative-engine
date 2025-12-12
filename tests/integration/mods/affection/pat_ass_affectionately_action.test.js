/**
 * @file Integration tests for the affection:pat_ass_affectionately action and rule.
 * @description Verifies the affectionate ass pat action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';

const ACTION_ID = 'affection:pat_ass_affectionately';

describe('affection:pat_ass_affectionately action integration', () => {
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

    const expectedMessage = "Avery pats Rowan's ass affectionately.";

    expect(testFixture.events).toHaveActionSuccess(expectedMessage);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('conservatory');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });
});
