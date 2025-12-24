import { describe, it, expect, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ModTestFixture - Auto-Registration Integration', () => {
  let testFixture;

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('should discover action when scopes auto-registered', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down',
      null,
      null,
      { autoRegisterScopes: true }
    );

    // Create simple scenario with actor and furniture
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();
    const furniture = new ModEntityBuilder('bench1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', { spots: [null, null] })
      .build();

    testFixture.reset([room, actor, furniture]);

    // Act
    const availableActions = testFixture.discoverActions('actor1');

    // Assert
    expect(availableActions.map((a) => a.id)).toContain('sitting:sit_down');
  });

  it('should work with multiple scope categories', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down',
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy'],
      }
    );

    // Create simple scenario with actor and furniture
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();
    const furniture = new ModEntityBuilder('bench1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', { spots: [null, null] })
      .build();

    testFixture.reset([room, actor, furniture]);

    // Act
    const availableActions = testFixture.discoverActions('actor1');

    // Assert
    expect(availableActions.map((a) => a.id)).toContain('sitting:sit_down');
  });

  it('should maintain backward compatibility with manual registration', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down'
    );
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Create simple scenario with actor and furniture
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();
    const furniture = new ModEntityBuilder('bench1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('sitting:allows_sitting', { spots: [null, null] })
      .build();

    testFixture.reset([room, actor, furniture]);

    // Act
    const availableActions = testFixture.discoverActions('actor1');

    // Assert
    expect(availableActions.map((a) => a.id)).toContain('sitting:sit_down');
  });

  it('should not discover action when scopes not registered', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'sitting',
      'sitting:sit_down',
      null,
      null,
      { autoRegisterScopes: false }
    );

    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Act
    const availableActions = testFixture.discoverActions(scenario.actor.id);

    // Assert - without scope registration, actions won't be discovered
    expect(availableActions.map((a) => a.id)).not.toContain(
      'sitting:sit_down'
    );
  });

  it('should work with inventory scopes using "items" alias', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:pick_up_item',
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['items', 'positioning'],
      }
    );

    // Create room manually to control the scenario
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    // Create actor with grabbing hands (required for pick_up_item prerequisite)
    const actorBuilder = new ModEntityBuilder('actor_pickup')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withGrabbingHands(1)
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    // Create item on the ground
    const sword = new ModEntityBuilder('sword1')
      .withName('Sword')
      .atLocation('room1')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 2 })
      .build();

    testFixture.reset([room, actor, ...handEntities, sword]);

    // Act
    const availableActions = testFixture.discoverActions('actor_pickup');

    // Assert
    expect(availableActions.map((a) => a.id)).toContain('item-handling:pick_up_item');
  });

  it('should work with inventory scopes using "inventory" category', async () => {
    // Arrange
    testFixture = await ModTestFixture.forAction(
      'item-handling',
      'item-handling:drop_item',
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['inventory', 'positioning'],
      }
    );

    const scenario = testFixture.createDropItemScenario({
      actorName: 'Alice',
      itemName: 'Sword',
      location: 'room1',
    });

    // Act
    const availableActions = testFixture.discoverActions(scenario.actor.id);

    // Assert
    expect(availableActions.map((a) => a.id)).toContain('item-handling:drop_item');
  });
});
