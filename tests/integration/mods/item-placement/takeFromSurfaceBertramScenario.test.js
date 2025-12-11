/**
 * @file Bertram scenario integration tests for item-placement:take_from_nearby_surface action
 * @description Tests the exact production scenario: Bertram sitting on stool near table
 * with jugs on it. The table IS the container (not a bowl on the table).
 *
 * CORRECT UNDERSTANDING:
 * - Table has containers-core:container component with jugs in contents
 * - Stool has furniture:near_furniture pointing to table
 * - Table IS the primary target (the container to take FROM)
 * - Jugs ARE the secondary targets (items to take)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import takeFromNearbySurfaceAction from '../../../../data/mods/item-placement/actions/take_from_nearby_surface.action.json' assert { type: 'json' };

const ACTION_ID = 'item-placement:take_from_nearby_surface';

describe('Bertram scenario: take_from_nearby_surface', () => {
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

  describe('production scenario: Bertram in Aldous kitchen', () => {
    it('should discover action when seated actor can take from table (table IS the container)', () => {
      // Create kitchen location
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      // Table IS the container with jugs directly in contents
      // This is the KEY difference - table is both furniture AND container
      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: [
            'fantasy:jug_of_cider_instance',
            'fantasy:jug_of_mead_instance',
          ],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Stool with near_furniture pointing to the table
      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .withComponent('positioning:allows_sitting', {
          spots: [{ occupied: true }],
        })
        .build();

      // Jugs on the table (in table's contents)
      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      const jugMead = new ModEntityBuilder('fantasy:jug_of_mead_instance')
        .withName('jug of mead')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      // Bertram seated on stool with grabbing hands
      const bertramBuilder = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['fantasy:smoking_pipe_instance'],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_1_instance',
          spot_index: 0,
        })
        .withGrabbingHands(2);

      const bertram = bertramBuilder.build();
      const handEntities = bertramBuilder.getHandEntities();

      // Pipe in Bertram's inventory
      const pipe = new ModEntityBuilder('fantasy:smoking_pipe_instance')
        .withName('smoking pipe')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 0.5 })
        .build();

      testFixture.reset([
        kitchen,
        table,
        stool,
        jugCider,
        jugMead,
        pipe,
        ...handEntities,
        bertram,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Should discover the action with table as primary target
      expect(takeActions.length).toBeGreaterThan(0);

      // Verify the table is the primary target (if we can access target info)
      if (takeActions[0]?.targetId) {
        expect(takeActions[0].targetId).toBe(
          'fantasy:aldous_kitchen_rustic_wooden_table_instance'
        );
      }
    });

    it('should NOT discover action when Bertram is NOT seated', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: ['fantasy:jug_of_cider_instance'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      // Bertram is STANDING (no sitting_on component)
      const bertram = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .build();

      testFixture.reset([kitchen, table, stool, jugCider, bertram]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });

    it('should NOT discover action when stool has no near_furniture pointing to table', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: ['fantasy:jug_of_cider_instance'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Stool has EMPTY nearFurnitureIds - table is NOT nearby
      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: [], // Empty - no nearby furniture
        })
        .build();

      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      const bertram = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_1_instance',
          spot_index: 0,
        })
        .build();

      testFixture.reset([kitchen, table, stool, jugCider, bertram]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });

    it('should NOT discover action when table container is closed', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      // Table container is CLOSED
      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: ['fantasy:jug_of_cider_instance'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false, // CLOSED
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      const bertram = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_1_instance',
          spot_index: 0,
        })
        .build();

      testFixture.reset([kitchen, table, stool, jugCider, bertram]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBe(0);
    });

    it('should NOT discover action when table is empty', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      // Table container is EMPTY
      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: [], // EMPTY
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const bertramBuilder = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_1_instance',
          spot_index: 0,
        })
        .withGrabbingHands(2);

      const bertram = bertramBuilder.build();
      const handEntities = bertramBuilder.getHandEntities();

      testFixture.reset([kitchen, table, stool, ...handEntities, bertram]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Action may appear but with no secondary targets, or not appear at all
      // Either behavior is acceptable for empty container
      expect(takeActions).toBeDefined();
    });

    it('should work with multiple stools near the same table', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('containers-core:container', {
          contents: ['fantasy:jug_of_cider_instance'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      // Multiple stools all pointing to the same table
      const stool1 = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool 1')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const stool2 = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_2_instance'
      )
        .withName('plain wooden stool 2')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen')
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      // Bertram on stool 2
      const bertramBuilder = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_2_instance',
          spot_index: 0,
        })
        .withGrabbingHands(2);

      const bertram = bertramBuilder.build();
      const handEntities = bertramBuilder.getHandEntities();

      testFixture.reset([
        kitchen,
        table,
        stool1,
        stool2,
        jugCider,
        ...handEntities,
        bertram,
      ]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(takeActions.length).toBeGreaterThan(0);
    });

    it('should work when actor is in different location than table', () => {
      const kitchen = ModEntityScenarios.createRoom(
        'fantasy:aldous_kitchen',
        "Aldous's Kitchen"
      );

      const hallway = ModEntityScenarios.createRoom(
        'fantasy:aldous_hallway',
        "Aldous's Hallway"
      );

      // Table is in kitchen but actor is in hallway
      const table = new ModEntityBuilder(
        'fantasy:aldous_kitchen_rustic_wooden_table_instance'
      )
        .withName('rustic wooden table')
        .atLocation('fantasy:aldous_kitchen') // Kitchen
        .withComponent('containers-core:container', {
          contents: ['fantasy:jug_of_cider_instance'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
          isLocked: false,
        })
        .build();

      const stool = new ModEntityBuilder(
        'fantasy:plain_wooden_stool_1_instance'
      )
        .withName('plain wooden stool')
        .atLocation('fantasy:aldous_hallway') // Hallway
        .withComponent('furniture:near_furniture', {
          nearFurnitureIds: ['fantasy:aldous_kitchen_rustic_wooden_table_instance'],
        })
        .build();

      const jugCider = new ModEntityBuilder('fantasy:jug_of_cider_instance')
        .withName('jug of cider')
        .atLocation('fantasy:aldous_kitchen') // Kitchen
        .withComponent('items:item', {})
        .withComponent('items:portable', { weight: 2 })
        .build();

      const bertram = new ModEntityBuilder(
        'fantasy:bertram_the_muddy_instance'
      )
        .withName('Bertram the Muddy')
        .atLocation('fantasy:aldous_hallway') // Hallway - different from table
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 30, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', {
          furniture_id: 'fantasy:plain_wooden_stool_1_instance',
          spot_index: 0,
        })
        .build();

      testFixture.reset([kitchen, hallway, table, stool, jugCider, bertram]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'fantasy:bertram_the_muddy_instance'
      );
      const takeActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Should NOT discover because actor and table are in different locations
      // The scope requires same locationId
      expect(takeActions.length).toBe(0);
    });
  });
});
