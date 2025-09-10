/**
 * @file Integration tests for the intimacy:brush_hand rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import brushHandRule from '../../../../../data/mods/intimacy/rules/brush_hand.rule.json';
import eventIsActionBrushHand from '../../../../../data/mods/intimacy/conditions/event-is-action-brush-hand.condition.json';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('handle_brush_hand rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forRule(
      'intimacy',
      'intimacy:brush_hand',
      brushHandRule,
      eventIsActionBrushHand
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('condition evaluates correctly', () => {
    // Test that the condition works correctly
    const condition = eventIsActionBrushHand.logic;
    const mockLogger = createMockLogger();
    const jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    // Check what the condition expects
    expect(condition).toEqual({
      '==': [{ var: 'event.payload.actionId' }, 'intimacy:brush_hand'],
    });

    // The event structure for attempt_action events
    const matchingData = {
      event: {
        payload: {
          actionId: 'intimacy:brush_hand',
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

  it('performs brush hand action successfully', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth'], {
      location: 'room1',
    });

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
    const scenario = testFixture.createCloseActors(['Alice', 'Beth'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    testFixture.assertPerceptibleEvent({
      descriptionText: "Alice brushes Beth's hand with their own.",
      locationId: 'room1',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });
  });

  it('rule does not fire for different action', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Beth'], {
      location: 'room1',
    });

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'intimacy:different_action',
      targetId: scenario.target.id,
      originalInput: 'different_action target',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('works with multiple actors in location', async () => {
    const scenario = testFixture.createMultiActorScenario(
      ['Alice', 'Beth', 'Charlie'],
      {
        location: 'room1',
      }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
  });

  it('works with different actor and target names', async () => {
    const scenario = testFixture.createCloseActors(['John', 'Mary'], {
      location: 'room1',
    });

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "John brushes Mary's hand with their own."
    );
  });
});
