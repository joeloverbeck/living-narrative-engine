/**
 * @file Integration tests for the intimacy:peck_on_lips rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import peckOnLipsRule from '../../../../../data/mods/intimacy/rules/peck_on_lips.rule.json';
import eventIsActionPeckOnLips from '../../../../../data/mods/intimacy/conditions/event-is-action-peck_on_lips.condition.json';

/**
 * Creates handlers needed for the peck_on_lips rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @returns {object} Handlers object
 */
describe('handle_peck_on_lips rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:peck_on_lips',
      peckOnLipsRule,
      eventIsActionPeckOnLips
    );
  });

  afterEach(async () => {
    if (testFixture) {
      await testFixture.cleanup();
    }
  });

  it('condition evaluates correctly', () => {
    // Test that the condition works correctly
    const condition = eventIsActionPeckOnLips.logic;
    const jsonLogicService = new JsonLogicEvaluationService({
      logger: testFixture.logger,
    });

    // Check what the condition expects
    expect(condition).toEqual({
      '==': [{ var: 'event.payload.actionId' }, 'intimacy:peck_on_lips'],
    });

    // The event structure for attempt_action events
    const matchingData = {
      event: {
        payload: {
          actionId: 'intimacy:peck_on_lips',
        },
      },
    };

    expect(jsonLogicService.evaluate(condition, matchingData)).toBe(true);

    // Should not match when actionId is different
    const nonMatchingData = {
      event: {
        payload: {
          actionId: 'intimacy:different_action',
        },
      },
    };
    expect(jsonLogicService.evaluate(condition, nonMatchingData)).toBe(false);
  });

  it('performs peck on lips action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );
  });

  it('perceptible event contains correct message', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alice gives Beth a quick, affectionate peck on the lips.'
    );
  });

  it('rule does not fire for different action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Dispatch event directly with different actionId to test that rule doesn't trigger
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:different_action',
      targetId: scenario.target.id,
      originalInput: 'different_action target',
    });

    const types = testFixture.events.map((e) => e.eventType);
    expect(types).not.toContain('core:perceptible_event');
    expect(types).not.toContain('core:display_successful_action_result');
    expect(types).not.toContain('core:turn_ended');
  });

  it('works with multiple actors in location', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth']);

    // Add an observer in the same location
    const observerId = testFixture.entityManager.createEntity();
    testFixture.entityManager.addComponent(observerId, 'core:name', {
      text: 'Charlie',
    });
    testFixture.entityManager.addComponent(observerId, 'core:position', {
      locationId: scenario.actor.components['core:position'].locationId,
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe(
      scenario.actor.components['core:position'].locationId
    );
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
  });

  it('works with different actor and target names', async () => {
    const scenario = testFixture.createCloseActors(['John', 'Mary']);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'John gives Mary a quick, affectionate peck on the lips.'
    );
  });
});
