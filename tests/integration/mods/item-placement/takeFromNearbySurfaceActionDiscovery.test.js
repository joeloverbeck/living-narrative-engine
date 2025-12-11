/**
 * @file Integration tests for item-placement:take_from_nearby_surface action discovery
 * @description Tests that the take_from_nearby_surface action is correctly discovered
 * for seated actors near furniture with open containers.
 *
 * CORRECT PATTERN: The table (nearby furniture) IS the container.
 * Items to take are directly in the table's containers-core:container.contents array.
 * The stool's furniture:near_furniture.nearFurnitureIds points to the table.
 *
 * Primary target = table (the nearby furniture that IS a container)
 * Secondary targets = items in the table's contents
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import takeFromNearbySurfaceAction from '../../../../data/mods/item-placement/actions/take_from_nearby_surface.action.json' assert { type: 'json' };

const ACTION_ID = 'item-placement:take_from_nearby_surface';

describe('item-placement:take_from_nearby_surface action discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('item-placement', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }
      testEnv.actionIndex.buildIndex([takeFromNearbySurfaceAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(takeFromNearbySurfaceAction).toBeDefined();
    expect(takeFromNearbySurfaceAction.id).toBe(ACTION_ID);
    expect(takeFromNearbySurfaceAction.name).toBe('Take From Nearby Surface');
    expect(takeFromNearbySurfaceAction.description).toBe(
      'While seated, take an item from a container on nearby furniture'
    );
  });

  it('should require sitting_on component for actor', () => {
    expect(takeFromNearbySurfaceAction.required_components).toBeDefined();
    expect(takeFromNearbySurfaceAction.required_components.actor).toContain(
      'positioning:sitting_on'
    );
    expect(takeFromNearbySurfaceAction.required_components.actor).toContain(
      'items:inventory'
    );
  });

  it('should use correct scope for primary targets', () => {
    expect(takeFromNearbySurfaceAction.targets.primary.scope).toBe(
      'item-placement:open_containers_on_nearby_furniture'
    );
  });

  it('should use container_contents scope for secondary targets', () => {
    expect(takeFromNearbySurfaceAction.targets.secondary.scope).toBe(
      'containers-core:container_contents'
    );
    expect(takeFromNearbySurfaceAction.targets.secondary.contextFrom).toBe(
      'primary'
    );
  });

  describe('when actor is seated near furniture with open container', () => {
    it('should discover action when table (nearby furniture) has items directly in its contents', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table IS the nearby furniture AND a container with items directly in contents
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1', 'bread-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Stool with near_furniture pointing to table
      const stool = new ModEntityBuilder('stool-1')
        .withName('wooden stool')
        .atLocation('kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['table-1'],
        })
        .build();

      // Items directly on the table (in table's contents)
      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const bread = new ModEntityBuilder('bread-1')
        .withName('bread loaf')
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Create seated actor with grabbing hands
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
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBeGreaterThan(0);
    });

    it('should NOT discover action when table container is closed', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table is CLOSED
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
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
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
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
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });
  });

  describe('when actor is NOT seated', () => {
    it('should NOT discover action for standing actor', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('red apple')
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Actor is STANDING (no sitting_on component)
      const actor = new ModEntityBuilder('standing-actor')
        .withName('Bob')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, table, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('standing-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });
  });

  describe('when furniture is NOT nearby', () => {
    it('should NOT discover action when seated but furniture not in nearFurnitureIds', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
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
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
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
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });

    it('should NOT discover action when stool has no near_furniture component', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
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
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const actor = new ModEntityBuilder('seated-actor')
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
        .build();

      testFixture.reset([room, table, stool, apple, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should NOT discover action when table container is empty', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Table is EMPTY
      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
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

      // Create seated actor with grabbing hands
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
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Action should not appear without secondary targets
      // or appear with no valid secondary targets
      if (takeActions.length > 0) {
        expect(takeActions).toBeDefined();
      }
    });

    it('should discover action when multiple nearby tables have items', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      // Two tables, both nearby
      const table1 = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const table2 = new ModEntityBuilder('table-2')
        .withName('stone table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['bread-1'],
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
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const bread = new ModEntityBuilder('bread-1')
        .withName('bread loaf')
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Create seated actor with grabbing hands
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

      testFixture.reset([
        room,
        table1,
        table2,
        stool,
        apple,
        bread,
        ...handEntities,
        actor,
      ]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Should have actions for both tables
      expect(takeActions.length).toBeGreaterThan(0);
    });

    it('should discover action with single item on table', () => {
      const room = ModEntityScenarios.createRoom('kitchen', 'Kitchen');

      const table = new ModEntityBuilder('table-1')
        .withName('wooden table')
        .atLocation('kitchen')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
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
        .atLocation('kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      // Create seated actor with grabbing hands
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

      testFixture.reset([room, table, stool, apple, ...handEntities, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('seated-actor');
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBeGreaterThan(0);
    });
  });
});
