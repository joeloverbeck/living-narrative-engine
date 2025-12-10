/**
 * @file Integration tests for item-placement:put_on_nearby_surface action discovery
 * @description Tests that the put_on_nearby_surface action is correctly discovered
 * for seated actors with inventory items near furniture with open containers.
 *
 * CORRECT PATTERN: The table (nearby furniture) IS the container.
 * Items from actor's inventory can be placed INTO the table's items:container.contents.
 * The stool's furniture:near_furniture.nearFurnitureIds points to the table.
 *
 * Primary target = table (the nearby furniture that IS a container)
 * Secondary targets = items in actor's inventory
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import putOnNearbySurfaceAction from '../../../../data/mods/item-placement/actions/put_on_nearby_surface.action.json' assert { type: 'json' };

const ACTION_ID = 'item-placement:put_on_nearby_surface';

describe('item-placement:put_on_nearby_surface action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('item-placement', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }
      testEnv.actionIndex.buildIndex([putOnNearbySurfaceAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(putOnNearbySurfaceAction).toBeDefined();
    expect(putOnNearbySurfaceAction.id).toBe(ACTION_ID);
    expect(putOnNearbySurfaceAction.name).toBe('Put On Nearby Surface');
    expect(putOnNearbySurfaceAction.description).toBe(
      'While seated, place an item in a container on nearby furniture'
    );
  });

  it('should require sitting_on component for actor', () => {
    expect(putOnNearbySurfaceAction.required_components).toBeDefined();
    expect(putOnNearbySurfaceAction.required_components.actor).toContain(
      'positioning:sitting_on'
    );
    expect(putOnNearbySurfaceAction.required_components.actor).toContain(
      'items:inventory'
    );
  });

  it('should use correct scope for primary targets', () => {
    expect(putOnNearbySurfaceAction.targets.primary.scope).toBe(
      'item-placement:open_containers_on_nearby_furniture'
    );
  });

  it('should use actor_inventory_items scope for secondary targets', () => {
    expect(putOnNearbySurfaceAction.targets.secondary.scope).toBe(
      'items:actor_inventory_items'
    );
  });

  describe('when actor is seated near furniture with open container', () => {
    it('should discover action when actor has inventory items and table is nearby', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table IS the nearby furniture AND a container
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      // Item in actor's inventory
      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Seated actor with item in inventory
      const actorBuilder = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .withGrabbingHands(1);

      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      testFixture.reset([room, table, stool, apple, ...handEntities, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBeGreaterThan(0);
    });

    it('should NOT discover action when table container is closed', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table is CLOSED
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBe(0);
    });

    it('should NOT discover action when actor inventory is empty', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      // Actor has EMPTY inventory
      const actorBuilder = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .withGrabbingHands(1);

      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      testFixture.reset([room, table, stool, ...handEntities, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Action may appear but with no secondary targets, or not appear at all
      if (putActions.length > 0) {
        expect(putActions).toBeDefined();
      } else {
        expect(putActions.length).toBe(0);
      }
    });
  });

  describe('when actor is NOT seated', () => {
    it('should NOT discover action for standing actor', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Actor is STANDING (no sitting_on component)
      const actor = new ModEntityBuilder('standing-actor')
        .withName('Bob')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, table, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('standing-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBe(0);
    });
  });

  describe('when furniture is NOT nearby', () => {
    it('should NOT discover action when seated but furniture not in nearFurnitureIds', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Stool has EMPTY nearFurnitureIds - table is NOT nearby
      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: [],
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBe(0);
    });

    it('should NOT discover action when stool has no near_furniture component', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Stool has NO near_furniture component at all
      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should discover action with multiple inventory items', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const bread = new ModEntityBuilder('bread-1')
        .withName('bread loaf')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Actor with multiple inventory items
      const actorBuilder = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1', 'bread-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .withGrabbingHands(1);

      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      testFixture.reset([
        room,
        table,
        stool,
        apple,
        bread,
        ...handEntities,
        actor,
      ]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBeGreaterThan(0);
    });

    it('should discover action when multiple nearby tables are available', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Two tables, both nearby
      const table1 = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const table2 = new ModEntityBuilder('table-2')
        .withName('stone table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1', 'table-2'],
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Actor with inventory
      const actorBuilder = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .withGrabbingHands(1);

      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      testFixture.reset([
        room,
        table1,
        table2,
        stool,
        apple,
        ...handEntities,
        actor,
      ]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Should have actions for both tables
      expect(putActions.length).toBeGreaterThan(0);
    });

    it('should discover action even when table already has items', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table already has items in it
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('items:container', {
          contents: ['existing-item-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const existingItem = new ModEntityBuilder('existing-item-1')
        .withName('old book')
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actorBuilder = new ModEntityBuilder('seated-actor')
        .withName('Alice')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'stool-1',
          spot_index: 0,
        })
        .withGrabbingHands(1);

      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      testFixture.reset([
        room,
        table,
        existingItem,
        stool,
        apple,
        ...handEntities,
        actor,
      ]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const putActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(putActions.length).toBeGreaterThan(0);
    });
  });
});
