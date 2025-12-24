/**
 * @file Integration tests for aiming event dispatching in items mod
 * Tests that item_aimed and aim_lowered events are properly dispatched with correct payloads
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Items Mod - Aiming Events', () => {
  let aimFixture;
  let lowerAimFixture;

  beforeEach(async () => {
    aimFixture = await ModTestFixture.forAction('items', 'items:aim_item');
    lowerAimFixture = await ModTestFixture.forAction(
      'items',
      'items:lower_aim'
    );
  });

  afterEach(() => {
    if (aimFixture) {
      aimFixture.cleanup();
    }
    if (lowerAimFixture) {
      lowerAimFixture.cleanup();
    }
  });

  it('should dispatch item_aimed event when aiming', async () => {
    // Tests that the handle_aim_item rule dispatches the item_aimed event
    const { actor, target } = aimFixture.createStandardActorTarget([
      'Actor Name',
      'Target Name',
    ]);

    // Create an aimable item (pistol)
    const pistolId = aimFixture.createEntity({
      id: 'weapons:pistol',
      name: 'Pistol',
      components: {
        'items-core:item': {},
        'items-core:portable': {},
        'items:aimable': {},
      },
    });

    // Add required components for aiming
    aimFixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
      items: [pistolId],
      maxWeightKg: 50,
    });

    // Execute the aim action
    await aimFixture.executeAction(actor.id, target.id, {
      skipDiscovery: true,
      additionalPayload: {
        secondaryId: pistolId,
      },
    });

    // Verify aimed_at component was added to the item
    const aimedAtComponent = aimFixture.entityManager.getComponent(
      pistolId,
      'items:aimed_at'
    );
    expect(aimedAtComponent).toBeDefined();
    expect(aimedAtComponent.targetId).toBe(target.id);
    expect(aimedAtComponent.aimedBy).toBe(actor.id);

    // Verify event was dispatched with correct payload
    const itemAimedEvents = aimFixture.events.filter(
      (e) => e.eventType === 'items-core:item_aimed'
    );
    expect(itemAimedEvents).toHaveLength(1);
    expect(itemAimedEvents[0].payload).toMatchObject({
      actorEntity: actor.id,
      itemEntity: pistolId,
      targetEntity: target.id,
    });
    expect(itemAimedEvents[0].payload.timestamp).toBeDefined();
    expect(typeof itemAimedEvents[0].payload.timestamp).toBe('string');
  });

  it('should dispatch aim_lowered event when lowering aim', async () => {
    // Tests that the handle_lower_aim rule dispatches the aim_lowered event
    const { actor, target } = lowerAimFixture.createStandardActorTarget([
      'Actor Name',
      'Target Name',
    ]);

    // Create an aimable item (pistol) that is already aimed
    const pistolId = lowerAimFixture.createEntity({
      id: 'weapons:pistol',
      name: 'Pistol',
      components: {
        'items-core:item': {},
        'items-core:portable': {},
        'items:aimable': {},
        'items:aimed_at': {
          targetId: target.id,
          aimedBy: actor.id,
        },
      },
    });

    // Add required components
    lowerAimFixture.entityManager.addComponent(actor.id, 'inventory:inventory', {
      items: [pistolId],
      maxWeightKg: 50,
    });

    // Execute the lower aim action
    await lowerAimFixture.executeAction(actor.id, pistolId, {
      skipDiscovery: true,
    });

    // Verify aimed_at component was removed from the item
    const aimedAtComponent = lowerAimFixture.entityManager.getComponent(
      pistolId,
      'items:aimed_at'
    );
    expect(aimedAtComponent).toBeNull();

    // Verify event was dispatched with correct payload
    const aimLoweredEvents = lowerAimFixture.events.filter(
      (e) => e.eventType === 'items:aim_lowered'
    );
    expect(aimLoweredEvents).toHaveLength(1);
    expect(aimLoweredEvents[0].payload).toMatchObject({
      actorEntity: actor.id,
      itemEntity: pistolId,
      previousTargetEntity: target.id,
    });
    expect(aimLoweredEvents[0].payload.timestamp).toBeDefined();
    expect(typeof aimLoweredEvents[0].payload.timestamp).toBe('string');
  });
});
