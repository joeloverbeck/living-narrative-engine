/**
 * @file Integration tests for the affection:brush_hair_behind_ear action and rule.
 * @description Verifies the brush hair behind ear action produces the expected narrative output.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import handleBrushHairBehindEarRule from '../../../../data/mods/affection/rules/handle_brush_hair_behind_ear.rule.json';
import eventIsActionBrushHairBehindEar from '../../../../data/mods/affection/conditions/event-is-action-brush-hair-behind-ear.condition.json';

const ACTION_ID = 'affection:brush_hair_behind_ear';

const EXPECTED_ALLOWED_EVENTS = [
  'core:attempt_action',
  'core:perceptible_event',
  'core:display_successful_action_result',
  'core:action_success',
  'core:turn_ended',
];

describe('affection:brush_hair_behind_ear action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'affection',
      ACTION_ID,
      handleBrushHairBehindEarRule,
      eventIsActionBrushHairBehindEar
    );

    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'affection',
      'close_actors_with_hair_or_entity_kneeling_before_actor'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('emits matching success and perceptible messages when executed', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Amelia', 'Jonah'],
      ['torso', 'hair'],
      { location: 'garden' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(successEvent).toBeDefined();
    expect(perceptibleEvent).toBeDefined();

    const expectedMessage =
      "Amelia brushes a stray lock of hair behind Jonah's ear.";
    expect(successEvent.payload.message).toBe(expectedMessage);
    expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
  });

  it('includes correct metadata in perceptible event', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Isabella', 'Lucas'],
      ['torso', 'hair'],
      { location: 'library' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const perceptibleEvent = testFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'action_target_general'
    );
    expect(perceptibleEvent.payload.locationId).toBe('library');
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
  });

  it('only triggers for brush_hair_behind_ear action', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Ava', 'Mason'],
      ['torso', 'hair'],
      { location: 'study' }
    );

    // Execute different action
    await testFixture.executeAction(
      scenario.actor.id,
      scenario.target.id,
      'affection:ruffle_hair_playfully'
    );

    const ruleEvents = testFixture.events.filter((event) =>
      event.payload?.logMessage?.includes('brushes a stray lock')
    );

    expect(ruleEvents).toHaveLength(0);
  });

  it('produces only expected events', async () => {
    const scenario = testFixture.createAnatomyScenario(
      ['Charlotte', 'Ethan'],
      ['torso', 'hair'],
      { location: 'park' }
    );

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    // This assertion function throws if unexpected events are found
    expect(() =>
      testFixture.assertOnlyExpectedEvents(EXPECTED_ALLOWED_EVENTS)
    ).not.toThrow();
  });
});
