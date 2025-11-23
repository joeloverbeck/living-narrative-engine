/**
 * @file Integration tests for aiming event dispatching in items mod
 * Tests that item_aimed and aim_lowered events are properly dispatched with correct payloads
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Items Mod - Aiming Events', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:aim_item');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  it('should dispatch item_aimed event when aiming', async () => {
    // Tests that the handle_aim_item rule dispatches the item_aimed event
    const { actor, target } = fixture.createStandardActorTarget([
      'Actor Name',
      'Target Name',
    ]);

    // Create an aimable item (pistol)
    const pistol = fixture.entityFactory.createEntity('weapons:pistol', {
      name: 'Pistol',
    });

    // Add required components for aiming
    fixture.entityManager.addComponent(actor.id, 'items:inventory', {
      items: [pistol.id],
      maxWeightKg: 50,
    });
    fixture.entityManager.addComponent(pistol.id, 'items:item', {});
    fixture.entityManager.addComponent(pistol.id, 'items:portable', {});
    fixture.entityManager.addComponent(pistol.id, 'items:aimable', {});

    // Execute the aim action
    await fixture.executeAction(actor.id, {
      primary: target.id,
      secondary: pistol.id,
    });

    // Verify aimed_at component was added to the item
    const aimedAtComponent = fixture.entityManager.getComponent(
      pistol.id,
      'items:aimed_at'
    );
    expect(aimedAtComponent).toBeDefined();
    expect(aimedAtComponent.targetId).toBe(target.id);
    expect(aimedAtComponent.aimedBy).toBe(actor.id);

    // Verify event was dispatched with correct payload
    const events = fixture.getDispatchedEvents('items:item_aimed');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      actorEntity: actor.id,
      itemEntity: pistol.id,
      targetEntity: target.id,
    });
    expect(events[0].payload.timestamp).toBeDefined();
    expect(typeof events[0].payload.timestamp).toBe('number');
  });

  it('should dispatch aim_lowered event when lowering aim', async () => {
    // Tests that the handle_lower_aim rule dispatches the aim_lowered event
    const { actor, target } = fixture.createStandardActorTarget([
      'Actor Name',
      'Target Name',
    ]);

    // Create an aimable item (pistol) that is already aimed
    const pistol = fixture.entityFactory.createEntity('weapons:pistol', {
      name: 'Pistol',
    });

    // Add required components
    fixture.entityManager.addComponent(actor.id, 'items:inventory', {
      items: [pistol.id],
      maxWeightKg: 50,
    });
    fixture.entityManager.addComponent(pistol.id, 'items:item', {});
    fixture.entityManager.addComponent(pistol.id, 'items:portable', {});
    fixture.entityManager.addComponent(pistol.id, 'items:aimable', {});
    fixture.entityManager.addComponent(pistol.id, 'items:aimed_at', {
      targetId: target.id,
      aimedBy: actor.id,
    });

    // Execute the lower aim action
    await fixture.executeAction(actor.id, {
      primary: pistol.id,
    });

    // Verify aimed_at component was removed from the item
    const aimedAtComponent = fixture.entityManager.getComponent(
      pistol.id,
      'items:aimed_at'
    );
    expect(aimedAtComponent).toBeUndefined();

    // Verify event was dispatched with correct payload
    const events = fixture.getDispatchedEvents('items:aim_lowered');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      actorEntity: actor.id,
      itemEntity: pistol.id,
      previousTargetEntity: target.id,
    });
    expect(events[0].payload.timestamp).toBeDefined();
    expect(typeof events[0].payload.timestamp).toBe('number');
  });
});
