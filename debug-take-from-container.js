import { ModTestFixture } from './tests/common/mods/ModTestFixture.js';
import { ModEntityBuilder } from './tests/common/mods/ModEntityBuilder.js';
import openContainerRule from './data/mods/items/rules/handle_open_container.rule.json' assert { type: 'json' };
import takeFromContainerRule from './data/mods/items/rules/handle_take_from_container.rule.json' assert { type: 'json' };
import eventIsActionOpen from './data/mods/items/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };
import eventIsActionTake from './data/mods/items/conditions/event-is-action-take-from-container.condition.json' assert { type: 'json' };

async function debug() {
  // Create test fixture for take_from_container
  const testFixture = await ModTestFixture.forAction(
    'items',
    'items:take_from_container',
    takeFromContainerRule,
    eventIsActionTake
  );

  // Setup entities
  const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName('Alice')
    .atLocation('saloon1')
    .asActor()
    .withComponent('items:inventory', {
      items: [],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const container = new ModEntityBuilder('chest-1')
    .withName('Treasure Chest')
    .atLocation('saloon1')
    .withComponent('items:container', {
      contents: ['gold-bar-1', 'letter-1'],
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen: true,
    })
    .withComponent('items:openable', {})
    .build();

  testFixture.reset([room, actor, container]);

  console.log('\n=== BEFORE ACTION ===');
  console.log('Container contents:', testFixture.entityManager.getEntityInstance('chest-1').components['items:container'].contents);
  console.log('Actor inventory:', testFixture.entityManager.getEntityInstance('test:actor1').components['items:inventory'].items);

  // Execute take action
  await testFixture.executeAction('test:actor1', 'chest-1', { secondaryTargetId: 'gold-bar-1' });

  console.log('\n=== AFTER ACTION ===');
  console.log('Container contents:', testFixture.entityManager.getEntityInstance('chest-1').components['items:container'].contents);
  console.log('Actor inventory:', testFixture.entityManager.getEntityInstance('test:actor1').components['items:inventory'].items);

  console.log('\n=== EVENTS ===');
  testFixture.events.forEach((e, i) => {
    console.log(`Event ${i}:`, e.eventType);
    if (e.eventType === 'core:system_error_occurred') {
      console.log('  Error:', e.payload.error);
      console.log('  Context:', e.payload.context);
    }
  });

  testFixture.cleanup();
}

debug().catch(console.error);
