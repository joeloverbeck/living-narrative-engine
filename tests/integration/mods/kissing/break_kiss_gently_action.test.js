/**
 * @file Integration tests for the kissing:break_kiss_gently action and rule.
 * @description Tests the rule execution after the break_kiss_gently action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import breakKissGentlyRule from '../../../../data/mods/kissing/rules/break_kiss_gently.rule.json';
import eventIsActionBreakKissGently from '../../../../data/mods/kissing/conditions/event-is-action-break-kiss-gently.condition.json';

describe('kissing:break_kiss_gently action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      'kissing:break_kiss_gently',
      breakKissGentlyRule,
      eventIsActionBreakKissGently
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('removes kissing component when breaking kiss', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'bedroom',
    });

    // Add kissing component first (simulating active kiss)
    scenario.actor.components['kissing:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['kissing:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // Verify component removed from both actors
    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['kissing:kissing']).toBeUndefined();
    expect(targetInstance.components['kissing:kissing']).toBeUndefined();
  });

  it('generates correct perceptible event for breaking kiss', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
      location: 'bedroom',
    });

    // Add kissing component first
    scenario.actor.components['kissing:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['kissing:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
  });

  it('validates perceptible event message matches action success message', async () => {
    const scenario = testFixture.createCloseActors(['Diana', 'Victor'], {
      location: 'library',
    });

    // Add kissing component first
    scenario.actor.components['kissing:kissing'] = {
      partner: scenario.target.id,
      initiator: true,
    };
    scenario.target.components['kissing:kissing'] = {
      partner: scenario.actor.id,
      initiator: false,
    };

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
});
