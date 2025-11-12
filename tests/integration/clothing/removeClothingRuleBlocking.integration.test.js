import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import handleRemoveClothingRule from '../../../data/mods/clothing/rules/handle_remove_clothing.rule.json' assert { type: 'json' };
import eventIsActionRemoveClothing from '../../../data/mods/clothing/conditions/event-is-action-remove-clothing.condition.json' assert { type: 'json' };
import handleRemoveOthersClothingRule from '../../../data/mods/clothing/rules/handle_remove_others_clothing.rule.json' assert { type: 'json' };
import eventIsActionRemoveOthersClothing from '../../../data/mods/clothing/conditions/event-is-action-remove-others-clothing.condition.json' assert { type: 'json' };

describe('Remove Clothing Rule - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing',
      handleRemoveClothingRule,
      eventIsActionRemoveClothing
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should emit action_failed event when trying to remove blocked clothing', async () => {
    // Arrange: Create actor with belt blocking pants
    const actor = {
      id: 'actor1',
      components: {
        'core:name': { text: 'John' },
        'core:position': { locationId: 'room1' },
        'clothing:equipment': {
          equipped: {
            torso_lower: { accessories: ['belt1'] },
            legs: { base: ['pants1'] }
          }
        }
      }
    };

    const belt = {
      id: 'belt1',
      components: {
        'core:name': { text: 'belt' },
        'core:position': { locationId: 'room1' },
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' }
        },
        'clothing:blocks_removal': {
          blockedSlots: [{
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first'
          }]
        }
      }
    };

    const pants = {
      id: 'pants1',
      components: {
        'core:name': { text: 'pants' },
        'core:position': { locationId: 'room1' },
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' }
        }
      }
    };

    fixture.reset([actor, belt, pants]);

    // Act: Try to remove pants via action
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'clothing:remove_clothing',
      targetId: 'pants1',
      originalInput: 'remove pants'
    });

    // Assert: Should have action_execution_failed event, not perceptible_event
    const failedEvent = fixture.events.find(e => e.eventType === 'core:action_execution_failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent.payload.reason).toBe('removal_blocked');
    expect(failedEvent.payload.message).toContain('blocked');

    // Should NOT have perceptible event (action didn't succeed)
    const perceptibleEvent = fixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent).toBeUndefined();
  });

  it('should successfully remove clothing when not blocked', async () => {
    // Arrange: Create actor with just a shirt (no blockers)
    const actor = {
      id: 'actor1',
      components: {
        'core:name': { text: 'John' },
        'core:position': { locationId: 'room1' },
        'clothing:equipment': {
          equipped: {
            torso_upper: { base: ['shirt1'] }
          }
        }
      }
    };

    const shirt = {
      id: 'shirt1',
      components: {
        'core:name': { text: 'shirt' },
        'core:position': { locationId: 'room1' },
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' }
        }
      }
    };

    fixture.reset([actor, shirt]);

    // Act: Remove shirt
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'clothing:remove_clothing',
      targetId: 'shirt1',
      originalInput: 'remove shirt'
    });

    // Assert: Should have perceptible_event (success)
    const perceptibleEvent = fixture.events.find(e => e.eventType === 'core:perceptible_event');
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toContain('John');
    expect(perceptibleEvent.payload.descriptionText).toContain('shirt');
  });
});

describe('Remove Others Clothing Rule - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing',
      handleRemoveOthersClothingRule,
      eventIsActionRemoveOthersClothing
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should emit action_failed when trying to remove blocked clothing from another person', async () => {
    // Arrange: Create actor and target with blocked clothing
    const actor = {
      id: 'actor1',
      components: {
        'core:name': { text: 'John' },
        'core:position': { locationId: 'room1' }
      }
    };

    const target = {
      id: 'target1',
      components: {
        'core:name': { text: 'Jane' },
        'core:position': { locationId: 'room1' },
        'clothing:equipment': {
          equipped: {
            torso_lower: { accessories: ['belt1'] },
            legs: { base: ['pants1'] }
          }
        }
      }
    };

    const belt = {
      id: 'belt1',
      components: {
        'core:name': { text: 'belt' },
        'core:position': { locationId: 'room1' },
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'torso_lower' }
        },
        'clothing:blocks_removal': {
          blockedSlots: [{
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first'
          }]
        }
      }
    };

    const pants = {
      id: 'pants1',
      components: {
        'core:name': { text: 'pants' },
        'core:position': { locationId: 'room1' },
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' }
        }
      }
    };

    fixture.reset([actor, target, belt, pants]);

    // Act: John tries to remove Jane's pants
    await fixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: 'clothing:remove_others_clothing',
      primaryId: 'target1',
      secondaryId: 'pants1',
      originalInput: "remove Jane's pants"
    });

    // Assert
    const failedEvent = fixture.events.find(e => e.eventType === 'core:action_execution_failed');
    expect(failedEvent).toBeDefined();
    expect(failedEvent.payload.reason).toBe('removal_blocked');
  });
});
