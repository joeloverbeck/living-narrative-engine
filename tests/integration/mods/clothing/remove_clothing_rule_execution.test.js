/**
 * @file Integration tests for clothing:remove_clothing rule execution.
 * @description Tests the rule behavior focusing on sense-aware perceptible event dispatching.
 * Note: Full UNEQUIP_CLOTHING operation testing is done in tests/integration/clothing/
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import handleRemoveClothingRule from '../../../../data/mods/clothing/rules/handle_remove_clothing.rule.json' assert { type: 'json' };
import eventIsActionRemoveClothing from '../../../../data/mods/clothing/conditions/event-is-action-remove-clothing.condition.json' assert { type: 'json' };

describe('clothing:remove_clothing rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing',
      handleRemoveClothingRule,
      eventIsActionRemoveClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('dispatches perceptible event with correct perspective-aware fields', async () => {
    // Create scenario with actor
    const scenario = testFixture.createStandardActorTarget(['Alex', 'shirt'], {
      location: 'bedroom',
    });

    // Create a clothing item entity
    const clothingEntity = {
      id: 'shirt1',
      components: {
        'core:name': { text: 'shirt' },
        'core:position': { locationId: 'bedroom' },
      },
    };

    testFixture.reset([scenario.actor, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_clothing',
      targetId: 'shirt1',
      originalInput: 'remove shirt',
    });

    // Verify perceptible event was dispatched
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Alex removes their shirt.'
    );
    expect(perceptibleEvent.payload.targetId).toBe('shirt1');
    expect(perceptibleEvent.payload.perceptionType).toBe('physical.self_action');
    expect(perceptibleEvent.payload.locationId).toBe('bedroom');
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createStandardActorTarget(['Sarah', 'coat'], {
      location: 'garden',
    });

    const clothingEntity = {
      id: 'coat1',
      components: {
        'core:name': { text: 'coat' },
        'core:position': { locationId: 'garden' },
      },
    };

    testFixture.reset([scenario.actor, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_clothing',
      targetId: 'coat1',
      originalInput: 'remove coat',
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Sarah');
    expect(perceptibleEvent.payload.descriptionText).toContain('coat');
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Try with a different action ID
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:put_on_clothing',
      targetId: scenario.target.id,
      originalInput: 'put on clothing',
    });

    // Should not have perceptible events from our rule (only attempt_action)
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    // Explicit assertion to satisfy linter
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeUndefined();
  });

  it('formats message correctly with possessive language', async () => {
    const scenario = testFixture.createStandardActorTarget(
      ['Sir Lancelot', 'tunic'],
      {
        location: 'castle_chamber',
      }
    );

    const clothingEntity = {
      id: 'tunic1',
      components: {
        'core:name': { text: 'tunic' },
        'core:position': { locationId: 'castle_chamber' },
      },
    };

    testFixture.reset([scenario.actor, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_clothing',
      targetId: 'tunic1',
      originalInput: 'remove tunic',
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    // Rule uses "removes their" for possessive form
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sir Lancelot removes their tunic.'
    );
  });

  it('dispatches success event to UI', async () => {
    const scenario = testFixture.createStandardActorTarget(['Emily', 'scarf'], {
      location: 'park',
    });

    const clothingEntity = {
      id: 'scarf1',
      components: {
        'core:name': { text: 'scarf' },
        'core:position': { locationId: 'park' },
      },
    };

    testFixture.reset([scenario.actor, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_clothing',
      targetId: 'scarf1',
      originalInput: 'remove scarf',
    });

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe('Emily removes their scarf.');
  });
});
