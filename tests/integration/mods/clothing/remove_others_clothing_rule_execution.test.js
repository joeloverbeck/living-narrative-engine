/**
 * @file Integration tests for clothing:remove_others_clothing rule execution.
 * @description Tests the rule behavior when the action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import removeOthersClothingRule from '../../../../data/mods/clothing/rules/handle_remove_others_clothing.rule.json';
import eventIsActionRemoveOthersClothing from '../../../../data/mods/clothing/conditions/event-is-action-remove-others-clothing.condition.json';

describe('clothing:remove_others_clothing rule execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing',
      removeOthersClothingRule,
      eventIsActionRemoveOthersClothing
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('successfully removes clothing from primary target', async () => {
    // Create scenario with two close actors
    const scenario = testFixture.createCloseActors(['Alice', 'Bob'], {
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

    testFixture.reset([scenario.actor, scenario.target, clothingEntity]);

    // Alice removes Bob's shirt
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_others_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'shirt1',
      originalInput: "remove Bob's shirt",
    });

    // Verify perceptible event
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Alice');
    expect(perceptibleEvent.payload.descriptionText).toContain('Bob');
    expect(perceptibleEvent.payload.descriptionText).toContain('shirt');
    expect(perceptibleEvent.payload.locationId).toBe('bedroom');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
  });

  it('works with different entity names and locations', async () => {
    const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
      location: 'garden',
    });

    const clothingEntity = {
      id: 'jacket1',
      components: {
        'core:name': { text: 'jacket' },
        'core:position': { locationId: 'garden' },
      },
    };

    testFixture.reset([scenario.actor, scenario.target, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_others_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'jacket1',
      originalInput: "remove James's jacket",
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Sarah');
    expect(perceptibleEvent.payload.descriptionText).toContain('James');
    expect(perceptibleEvent.payload.descriptionText).toContain('jacket');
    expect(perceptibleEvent.payload.locationId).toBe('garden');
  });

  it('action only fires for correct action ID', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Try with a different action
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_clothing',
      targetId: scenario.target.id,
      originalInput: 'remove clothing',
    });

    // Should not have any perceptible events from our rule
    testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
  });

  it('formats message correctly with formal names', async () => {
    const scenario = testFixture.createCloseActors(
      ['Sir Lancelot', 'Lady Guinevere'],
      {
        location: 'castle_chamber',
      }
    );

    const clothingEntity = {
      id: 'gown1',
      components: {
        'core:name': { text: 'gown' },
        'core:position': { locationId: 'castle_chamber' },
      },
    };

    testFixture.reset([scenario.actor, scenario.target, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_others_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'gown1',
      originalInput: "remove Lady Guinevere's gown",
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('Sir Lancelot');
    expect(perceptibleEvent.payload.descriptionText).toContain(
      'Lady Guinevere'
    );
    expect(perceptibleEvent.payload.descriptionText).toContain('gown');
  });

  it('sets correct target ID for perception', async () => {
    const scenario = testFixture.createCloseActors(['Emily', 'Michael'], {
      location: 'park',
    });

    const clothingEntity = {
      id: 'hat1',
      components: {
        'core:name': { text: 'hat' },
        'core:position': { locationId: 'park' },
      },
    };

    testFixture.reset([scenario.actor, scenario.target, clothingEntity]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'clothing:remove_others_clothing',
      primaryId: scenario.target.id,
      secondaryId: 'hat1',
      originalInput: "remove Michael's hat",
    });

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
    expect(perceptibleEvent.payload.locationId).toBe('park');
  });
});
