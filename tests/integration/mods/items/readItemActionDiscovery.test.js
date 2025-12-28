/**
 * @file Integration tests for the reading:read_item action definition.
 * @description Tests that the read_item action is properly defined and discoverable only for readable items.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { ActionDiscoveryService } from '../../../../src/actions/actionDiscoveryService.js';
import readItemAction from '../../../../data/mods/reading/actions/read_item.action.json' assert { type: 'json' };

describe('reading:read_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('reading', 'reading:read_item');

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
    expect(readItemAction.id).toBe('reading:read_item');
    expect(readItemAction.name).toBe('Read Item');
    expect(readItemAction.description).toBe(
      "Read an item's readable text to learn its contents."
    );
    expect(readItemAction.template).toBe('read {item}');
  });

  it('should use examinable scope for primary targets', () => {
    expect(readItemAction.targets).toBeDefined();
    expect(readItemAction.targets.primary).toBeDefined();
    expect(readItemAction.targets.primary.scope).toBe('items:examinable_items');
    expect(readItemAction.targets.primary.placeholder).toBe('item');
    expect(readItemAction.targets.primary.description).toBe(
      'Readable item to read'
    );
  });

  it('should require item and readable components on primary target', () => {
    expect(readItemAction.required_components).toBeDefined();
    expect(readItemAction.required_components.primary).toEqual([
      'items-core:item',
      'reading:readable',
    ]);
  });

  it('should have lighting prerequisites', () => {
    expect(Array.isArray(readItemAction.prerequisites)).toBe(true);
    expect(readItemAction.prerequisites).toHaveLength(1);
    expect(readItemAction.prerequisites[0].logic).toEqual({
      isActorLocationLit: ['actor'],
    });
    expect(readItemAction.prerequisites[0].failure_message).toBe(
      'It is too dark to read anything.'
    );
  });

  describe('Action discovery behavior', () => {
    it('should appear when actor inventory contains a readable item', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Reading Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Reader')
        .atLocation('room1')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['readable_item_inventory'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const readableItem = new ModEntityBuilder('readable_item_inventory')
        .withName('Journal Page')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Day 12: Supplies are running low.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should appear when inventory stores readable items as item references', () => {
      const room = ModEntityScenarios.createRoom('room2', 'Reference Library');

      const actor = new ModEntityBuilder('actor2')
        .withName('Archivist')
        .atLocation('room2')
        .asActor()
        .withComponent('inventory:inventory', {
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
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Tablet Entry: Rotate the sigil thrice to unlock the vault.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor2');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should appear when inventory mixes readable and non-readable items', () => {
      const room = ModEntityScenarios.createRoom(
        'room_mixed',
        'Mixed Inventory Study'
      );

      const actor = new ModEntityBuilder('actor_mixed')
        .withName('Collector')
        .atLocation('room_mixed')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['readable_item_mixed', 'non_readable_item_mixed'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const readableItem = new ModEntityBuilder('readable_item_mixed')
        .withName('Annotated Blueprint')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Margin notes detail secret maintenance tunnels beneath the manor.',
        })
        .build();

      const nonReadableItem = new ModEntityBuilder('non_readable_item_mixed')
        .withName('Solid Brass Gear')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('A heavy gear with grease-stained teeth.')
        .build();

      testFixture.reset([room, actor, readableItem, nonReadableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor_mixed');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
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
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'All visitors must sign the guest book.',
        })
        .build();

      testFixture.reset([room, actor, readableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
      );

      expect(readActions.length).toBeGreaterThan(0);
    });

    it('should not appear when no readable items are present', () => {
      const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Wanderer')
        .atLocation('empty_room')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
      );

      expect(readActions.length).toBe(0);
    });

    it('should not appear for items lacking the readable component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Workshop');

      const actor = new ModEntityBuilder('actor1')
        .withName('Artisan')
        .atLocation('room1')
        .asActor()
        .withComponent('inventory:inventory', {
          items: ['non_readable_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const nonReadableItem = new ModEntityBuilder('non_readable_item')
        .withName('Metal Ingot')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('A heavy block of refined metal.')
        .build();

      testFixture.reset([room, actor, nonReadableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
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
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Ledger Entry 4B: Shipment delayed by storms.',
        })
        .build();

      testFixture.reset([roomA, roomB, actor, readableItem]);
      configureActionDiscovery();

      const availableActions =
        testFixture.testEnv.getAvailableActions('actor1');
      const readActions = availableActions.filter(
        (action) => action.id === 'reading:read_item'
      );

      expect(readActions.length).toBe(0);
    });

    it('should only generate read commands for items with the readable component', async () => {
      const room = ModEntityScenarios.createRoom('mixed_room', 'Mixed Study');

      const actor = new ModEntityBuilder('reader_actor')
        .withName('Focused Reader')
        .atLocation('mixed_room')
        .asActor()
        .withComponent('inventory:inventory', {
          items: [
            'readable_item_one',
            'readable_item_two',
            'non_readable_item_one',
          ],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const readableItemOne = new ModEntityBuilder('readable_item_one')
        .withName('Annotated Diary Page')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Entry #17: The code is hidden beneath the lantern.',
        })
        .build();

      const readableItemTwo = new ModEntityBuilder('readable_item_two')
        .withName('Encoded Telegram')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('reading:readable', {
          text: 'Signal received. Proceed at dawn.',
        })
        .build();

      const nonReadableItem = new ModEntityBuilder('non_readable_item_one')
        .withName('Polished River Stone')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withDescription('Smoothed by time and water, cool to the touch.')
        .build();

      const entities = [
        room,
        actor,
        readableItemOne,
        readableItemTwo,
        nonReadableItem,
      ];

      // Build a minimal discovery service that mirrors how the real pipeline
      // would enumerate candidate targets and format read commands.
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const entityManager = new SimpleEntityManager(entities);
      const actorEntity = entityManager.getEntityInstance('reader_actor');

      const orchestrator = {
        async discoverActions(currentActor) {
          const inventory = entityManager.getComponentData(
            currentActor.id,
            'inventory:inventory'
          );

          const candidateIds = Array.isArray(inventory?.items)
            ? inventory.items
            : [];

          const actions = [];

          for (const candidateId of candidateIds) {
            const itemEntity = entityManager.getEntityInstance(candidateId);
            if (!itemEntity) {
              continue;
            }

            const hasRequiredComponents =
              readItemAction.required_components.primary.every((componentId) =>
                itemEntity.hasComponent(componentId)
              );

            if (!hasRequiredComponents) {
              continue;
            }

            const nameComponent = itemEntity.getComponentData('core:name');
            const itemName =
              nameComponent?.name || nameComponent?.text || candidateId;
            const command = readItemAction.template.replace('{item}', itemName);

            actions.push({
              id: readItemAction.id,
              name: readItemAction.name,
              command,
              params: { targetId: candidateId },
            });
          }

          return { actions, errors: [], trace: null };
        },
      };

      const discoveryService = new ActionDiscoveryService({
        entityManager,
        logger,
        actionPipelineOrchestrator: orchestrator,
        traceContextFactory: () => ({
          info: jest.fn(),
          step: jest.fn(),
          success: jest.fn(),
          error: jest.fn(),
          withSpanAsync: async (_name, fn) => fn(),
        }),
      });

      const result = await discoveryService.getValidActions(actorEntity, {});

      const readCommands = result.actions
        .filter((action) => action.id === 'reading:read_item')
        .map((action) => action.command)
        .sort();

      expect(readCommands).toEqual([
        'read Annotated Diary Page',
        'read Encoded Telegram',
      ]);
      expect(
        readCommands.includes('read Polished River Stone') ||
          readCommands.includes('read non_readable_item_one')
      ).toBe(false);
    });
  });
});
