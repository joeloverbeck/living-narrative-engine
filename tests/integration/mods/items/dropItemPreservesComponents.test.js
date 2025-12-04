/**
 * @file Integration tests for component preservation during item drop
 * @description Verifies that dropping an item preserves all marker components
 * needed for pickup action discovery.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('Items - Drop Item Component Preservation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await testFixture.loadDependencyConditions([
      'items:event-is-action-drop-wielded-item',
    ]);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should preserve items:item marker component when dropped', async () => {
    // Setup: Actor with item in inventory (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Execute drop action
    await testFixture.executeAction('test:actor1', 'letter-1');

    // Verify: Item should retain items:item marker component
    const droppedItem = testFixture.entityManager.getEntityInstance('letter-1');
    expect(droppedItem.components['items:item']).toBeDefined();
  });

  it('should preserve items:portable marker component when dropped', async () => {
    // Setup: Actor with item in inventory (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Bob')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['gun-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const item = new ModEntityBuilder('gun-1')
      .withName('Gun')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1.2 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Execute drop action
    await testFixture.executeAction('test:actor1', 'gun-1');

    // Verify: Item should retain items:portable marker component
    const droppedItem = testFixture.entityManager.getEntityInstance('gun-1');
    expect(droppedItem.components['items:portable']).toBeDefined();
  });

  it('should preserve core:weight component when dropped', async () => {
    // Setup: Actor with item in inventory (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Charlie')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['key-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const item = new ModEntityBuilder('key-1')
      .withName('Key')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.02 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Execute drop action
    await testFixture.executeAction('test:actor1', 'key-1');

    // Verify: Item should retain core:weight component with correct value
    const droppedItem = testFixture.entityManager.getEntityInstance('key-1');
    expect(droppedItem.components['core:weight']).toBeDefined();
    expect(droppedItem.components['core:weight'].weight).toBe(0.02);
  });

  it('should preserve all components when dropping item', async () => {
    // Setup: Actor with item in inventory (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Diana')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Execute drop action
    await testFixture.executeAction('test:actor1', 'letter-1');

    // Verify: All components should be preserved
    const droppedItem = testFixture.entityManager.getEntityInstance('letter-1');

    // Position component should be added
    expect(droppedItem.components['core:position']).toBeDefined();
    expect(droppedItem.components['core:position'].locationId).toBe('saloon1');

    // Marker components should be preserved
    expect(droppedItem.components['items:item']).toBeDefined();
    expect(droppedItem.components['items:portable']).toBeDefined();

    // Weight component should be preserved
    expect(droppedItem.components['core:weight']).toBeDefined();
    expect(droppedItem.components['core:weight'].weight).toBe(0.05);

    // Name and description should be preserved
    expect(droppedItem.components['core:name']).toBeDefined();
  });

  it('should preserve components when dropping multiple items', async () => {
    // Setup: Actor with multiple items in inventory (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('Eve')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1', 'gun-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();
    const letter = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();
    const gun = new ModEntityBuilder('gun-1')
      .withName('Gun')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1.2 })
      .build();

    testFixture.reset([room, actor, ...handEntities, letter, gun]);

    // Drop both items
    await testFixture.executeAction('test:actor1', 'letter-1');
    await testFixture.executeAction('test:actor1', 'gun-1');

    // Verify: Both items should have all components preserved
    const droppedLetter = testFixture.entityManager.getEntityInstance('letter-1');
    const droppedGun = testFixture.entityManager.getEntityInstance('gun-1');

    // Letter components
    expect(droppedLetter.components['items:item']).toBeDefined();
    expect(droppedLetter.components['items:portable']).toBeDefined();
    expect(droppedLetter.components['core:weight']).toBeDefined();
    expect(droppedLetter.components['core:position']).toBeDefined();

    // Gun components
    expect(droppedGun.components['items:item']).toBeDefined();
    expect(droppedGun.components['items:portable']).toBeDefined();
    expect(droppedGun.components['core:weight']).toBeDefined();
    expect(droppedGun.components['core:position']).toBeDefined();
  });
});
