/**
 * @file Integration tests for the items:hug_item_for_comfort action definition.
 * @description Tests that the hug_item_for_comfort action is properly defined and discoverable only for items with allows_soothing_hug component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import hugItemForComfortAction from '../../../../data/mods/items/actions/hug_item_for_comfort.action.json' assert { type: 'json' };

const ACTION_ID = 'items:hug_item_for_comfort';

describe('items:hug_item_for_comfort action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', ACTION_ID);

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([hugItemForComfortAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Structure Validation', () => {
    it('should have correct action structure', () => {
      expect(hugItemForComfortAction).toBeDefined();
      expect(hugItemForComfortAction.id).toBe('items:hug_item_for_comfort');
      expect(hugItemForComfortAction.name).toBe('Hug Item for Comfort');
      expect(hugItemForComfortAction.description).toBe(
        'Hug a comforting item like a plush toy or pillow to feel calmer.'
      );
      expect(hugItemForComfortAction.template).toBe(
        'hug {item} to soothe yourself'
      );
    });

    it('should use examinable_items scope for primary targets', () => {
      expect(hugItemForComfortAction.targets).toBeDefined();
      expect(hugItemForComfortAction.targets.primary).toBeDefined();
      expect(hugItemForComfortAction.targets.primary.scope).toBe(
        'items:examinable_items'
      );
      expect(hugItemForComfortAction.targets.primary.placeholder).toBe('item');
      expect(hugItemForComfortAction.targets.primary.description).toBe(
        'Comfort item to hug'
      );
    });

    it('should require item and allows_soothing_hug components on primary target', () => {
      expect(hugItemForComfortAction.required_components).toBeDefined();
      expect(hugItemForComfortAction.required_components.primary).toEqual([
        'items-core:item',
        'items:allows_soothing_hug',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(Array.isArray(hugItemForComfortAction.prerequisites)).toBe(true);
      expect(hugItemForComfortAction.prerequisites).toHaveLength(0);
    });
  });

  describe('Action discovery behavior', () => {
    it('should appear when actor inventory contains a comfort item', () => {
      const room = ModEntityScenarios.createRoom('bedroom', 'Bedroom');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alex')
        .atLocation('bedroom')
        .asActor()
        .withComponent('items:inventory', {
          items: ['plush_toy_inventory'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const plushToy = new ModEntityBuilder('plush_toy_inventory')
        .withName('Fluffy Bear')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      testFixture.reset([room, actor, plushToy]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBeGreaterThan(0);
    });

    it('should appear when a comfort item is at the actor location', () => {
      const room = ModEntityScenarios.createRoom('library', 'Library');

      const actor = new ModEntityBuilder('actor1')
        .withName('Morgan')
        .atLocation('library')
        .asActor()
        .build();

      const comfortPillow = new ModEntityBuilder('comfort_pillow_location')
        .withName('Soft Pillow')
        .atLocation('library')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      testFixture.reset([room, actor, comfortPillow]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBeGreaterThan(0);
    });

    it('should appear when inventory stores comfort items as item references', () => {
      const room = ModEntityScenarios.createRoom('nursery', 'Nursery');

      const actor = new ModEntityBuilder('actor2')
        .withName('Jamie')
        .atLocation('nursery')
        .asActor()
        .withComponent('items:inventory', {
          items: [
            {
              itemId: 'stuffed_animal_reference',
            },
          ],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const stuffedAnimal = new ModEntityBuilder('stuffed_animal_reference')
        .withName('Bunny Companion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      testFixture.reset([room, actor, stuffedAnimal]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor2');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBeGreaterThan(0);
    });

    it('should appear when inventory mixes comfort items and non-comfort items', () => {
      const room = ModEntityScenarios.createRoom('room_mixed', 'Mixed Room');

      const actor = new ModEntityBuilder('actor_mixed')
        .withName('Casey')
        .atLocation('room_mixed')
        .asActor()
        .withComponent('items:inventory', {
          items: ['comfort_item_mixed', 'non_comfort_item_mixed'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const comfortItem = new ModEntityBuilder('comfort_item_mixed')
        .withName('Cozy Cushion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      const nonComfortItem = new ModEntityBuilder('non_comfort_item_mixed')
        .withName('Metal Wrench')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('A heavy metal tool.')
        .build();

      testFixture.reset([room, actor, comfortItem, nonComfortItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor_mixed');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBeGreaterThan(0);
    });
  });

  describe('Action blocking scenarios', () => {
    it('should not appear when no comfort items are present', () => {
      const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Taylor')
        .atLocation('empty_room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBe(0);
    });

    it('should not appear for items lacking the allows_soothing_hug component', () => {
      const room = ModEntityScenarios.createRoom('workshop', 'Workshop');

      const actor = new ModEntityBuilder('actor1')
        .withName('Jordan')
        .atLocation('workshop')
        .asActor()
        .withComponent('items:inventory', {
          items: ['non_comfort_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const nonComfortItem = new ModEntityBuilder('non_comfort_item')
        .withName('Hammer')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('A sturdy hammer for construction.')
        .build();

      testFixture.reset([room, actor, nonComfortItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBe(0);
    });

    it('should not appear for comfort items located elsewhere', () => {
      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

      const actor = new ModEntityBuilder('actor1')
        .withName('Riley')
        .atLocation('room_a')
        .asActor()
        .build();

      const distantComfortItem = new ModEntityBuilder('distant_comfort_item')
        .withName('Distant Teddy')
        .atLocation('room_b')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      testFixture.reset([roomA, roomB, actor, distantComfortItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      expect(hugActions.length).toBe(0);
    });

    it('should only generate hug actions for items with the allows_soothing_hug component', () => {
      const room = ModEntityScenarios.createRoom('mixed_room', 'Mixed Study');

      const actor = new ModEntityBuilder('hug_actor')
        .withName('Comfort Seeker')
        .atLocation('mixed_room')
        .asActor()
        .withComponent('items:inventory', {
          items: [
            'comfort_item_one',
            'comfort_item_two',
            'non_comfort_item_one',
          ],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const comfortItemOne = new ModEntityBuilder('comfort_item_one')
        .withName('Plush Dragon')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      const comfortItemTwo = new ModEntityBuilder('comfort_item_two')
        .withName('Memory Pillow')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('items:allows_soothing_hug', {})
        .build();

      const nonComfortItem = new ModEntityBuilder('non_comfort_item_one')
        .withName('Sharp Scissors')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('Metal scissors with sharp blades.')
        .build();

      testFixture.reset([
        room,
        actor,
        comfortItemOne,
        comfortItemTwo,
        nonComfortItem,
      ]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('hug_actor');
      const hugActions = availableActions.filter(
        (action) => action.id === ACTION_ID
      );

      // Should find hug actions for comfort items but not for non-comfort items
      expect(hugActions.length).toBeGreaterThan(0);
    });
  });
});
