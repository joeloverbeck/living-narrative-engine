/**
 * @file Integration tests for the items:read_item action definition.
 * @description Tests that the read_item action is properly defined and discoverable only for readable items.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import readItemAction from '../../../../data/mods/items/actions/read_item.action.json' assert { type: 'json' };

describe('items:read_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:read_item');

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([readItemAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(readItemAction).toBeDefined();
    expect(readItemAction.id).toBe('items:read_item');
    expect(readItemAction.name).toBe('Read Item');
    expect(readItemAction.description).toBe(
      "Read an item's readable text to learn its contents."
    );
    expect(readItemAction.template).toBe('read {item}');
  });

  it('should use examinable scope for primary targets', () => {
    expect(readItemAction.targets).toBeDefined();
    expect(readItemAction.targets.primary).toBeDefined();
    expect(readItemAction.targets.primary.scope).toBe(
      'items:examinable_items'
    );
    expect(readItemAction.targets.primary.placeholder).toBe('item');
    expect(readItemAction.targets.primary.description).toBe(
      'Readable item to read'
    );
  });

  it('should require item and readable components on primary target', () => {
    expect(readItemAction.required_components).toBeDefined();
    expect(readItemAction.required_components.primary).toEqual([
      'items:item',
      'items:readable',
    ]);
  });

  it('should have empty prerequisites array', () => {
    expect(Array.isArray(readItemAction.prerequisites)).toBe(true);
    expect(readItemAction.prerequisites).toHaveLength(0);
  });

  describe('Action discovery behavior', () => {
    it('should appear when actor inventory contains a readable item', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Reading Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Reader')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['readable_item_inventory'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const readableItem = new ModEntityBuilder('readable_item_inventory')
        .withName('Journal Page')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Day 12: Supplies are running low.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should appear when inventory stores readable items as item references', () => {
      const room = ModEntityScenarios.createRoom('room2', 'Reference Library');

      const actor = new ModEntityBuilder('actor2')
        .withName('Archivist')
        .atLocation('room2')
        .asActor()
        .withComponent('items:inventory', {
          items: [
            {
              itemId: 'readable_item_reference',
            },
          ],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const readableItem = new ModEntityBuilder('readable_item_reference')
        .withName('Encoded Tablet')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Tablet Entry: Rotate the sigil thrice to unlock the vault.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor2');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should appear when a readable item is at the actor location', () => {
      const room = ModEntityScenarios.createRoom('library', 'Library');

      const actor = new ModEntityBuilder('actor1')
        .withName('Scholar')
        .atLocation('library')
        .asActor()
        .build();

      const readableItem = new ModEntityBuilder('readable_item_location')
        .withName('Pinned Notice')
        .atLocation('library')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'All visitors must sign the guest book.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should not appear when no readable items are present', () => {
      const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Wanderer')
        .atLocation('empty_room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBe(0);
    });

    it('should not appear for items lacking the readable component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Workshop');

      const actor = new ModEntityBuilder('actor1')
        .withName('Artisan')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['non_readable_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const nonReadableItem = new ModEntityBuilder('non_readable_item')
        .withName('Metal Ingot')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withDescription('A heavy block of refined metal.')
        .build();

      testFixture.reset([room, actor, nonReadableItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBe(0);
    });

    it('should not appear for readable items located elsewhere', () => {
      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

      const actor = new ModEntityBuilder('actor1')
        .withName('Separated')
        .atLocation('room_a')
        .asActor()
        .build();

      const readableItem = new ModEntityBuilder('distant_readable_item')
        .withName('Sealed Ledger')
        .atLocation('room_b')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:readable', {
          text: 'Ledger Entry 4B: Shipment delayed by storms.',
        })
        .build();

      testFixture.reset([roomA, roomB, actor, readableItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'items:read_item'
      );

      expect(readActions.length).toBe(0);
    });
  });
});
