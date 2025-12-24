/**
 * @file Integration tests for clothing:put_on_clothing action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'clothing:put_on_clothing';

describe('clothing:put_on_clothing action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('clothing', ACTION_ID);
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('is discoverable when a wearable is in inventory even if the slot is occupied', async () => {
    const actorBuilder = new ModEntityBuilder('actor_put_on_discovery')
      .withName('Drew')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', {
        equipped: {
          torso_upper: { base: 'vest_1' },
        },
      })
      .withComponent('inventory:inventory', {
        items: ['shirt_1'],
        capacity: { maxWeight: 10, maxItems: 5 },
      })
      .withComponent('core:position', { locationId: 'room_alpha' });

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const occupyingLayer = new ModEntityBuilder('vest_1')
      .withName('vest')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    const wearableInInventory = new ModEntityBuilder('shirt_1')
      .withName('shirt')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([
      actor,
      ...handEntities,
      occupyingLayer,
      wearableInInventory,
    ]);

    const actions = await testFixture.discoverActions(actor.id);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
  });

  it('is blocked when the actor has a forbidden restraint component', async () => {
    const actorBuilder = new ModEntityBuilder('actor_put_on_restrained')
      .withName('River')
      .asActor()
      .withGrabbingHands(2)
      .withComponent('clothing:equipment', { equipped: {} })
      .withComponent('inventory:inventory', {
        items: ['hat_1'],
        capacity: { maxWeight: 5, maxItems: 5 },
      })
      .withComponent('physical-control-states:being_restrained', {});

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const wearable = new ModEntityBuilder('hat_1')
      .withName('hat')
      .withComponent('clothing:wearable', {
        layer: 'base',
        equipmentSlots: { primary: 'head' },
      })
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build();

    testFixture.reset([actor, ...handEntities, wearable]);

    const actions = await testFixture.discoverActions(actor.id);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
