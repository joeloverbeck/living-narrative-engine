/**
 * @file Complete Phase 3 container workflow integration tests.
 * @description Tests the complete workflow: unlock → open → take from container.
 * Validates state management, perception logging, and action discovery across the workflow.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import openContainerRule from '../../../../data/mods/containers/rules/handle_open_container.rule.json' assert { type: 'json' };
import takeFromContainerRule from '../../../../data/mods/containers/rules/handle_take_from_container.rule.json' assert { type: 'json' };
import putInContainerRule from '../../../../data/mods/containers/rules/handle_put_in_container.rule.json' assert { type: 'json' };
import eventIsActionOpenContainer from '../../../../data/mods/containers/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };
import eventIsActionTakeFromContainer from '../../../../data/mods/containers/conditions/event-is-action-take-from-container.condition.json' assert { type: 'json' };
import eventIsActionPutInContainer from '../../../../data/mods/containers/conditions/event-is-action-put-in-container.condition.json' assert { type: 'json' };

describe('Containers - Complete Container Workflow (Phase 3)', () => {
  let openFixture;
  let takeFixture;
  let putFixture;

  beforeEach(async () => {
    openFixture = await ModTestFixture.forAction(
      'containers',
      'containers:open_container',
      openContainerRule,
      eventIsActionOpenContainer
    );
    takeFixture = await ModTestFixture.forAction(
      'containers',
      'containers:take_from_container',
      takeFromContainerRule,
      eventIsActionTakeFromContainer
    );
    putFixture = await ModTestFixture.forAction(
      'containers',
      'containers:put_in_container',
      putInContainerRule,
      eventIsActionPutInContainer
    );
  });

  afterEach(() => {
    if (openFixture) {
      openFixture.cleanup();
    }
    if (takeFixture) {
      takeFixture.cleanup();
    }
    if (putFixture) {
      putFixture.cleanup();
    }
  });

  describe('unlock → open → take workflow', () => {
    it('should complete full workflow: unlock with key → open → take item', async () => {
      // Setup: Actor with key, locked container with treasure
      const room = new ModEntityBuilder('treasure-vault')
        .asRoom('Treasure Vault')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('treasure-vault')
        .asActor()
        .withComponent('items:inventory', {
          items: ['brass-key-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const chest = new ModEntityBuilder('locked-chest-1')
        .withName('Locked Treasure Chest')
        .atLocation('treasure-vault')
        .withComponent('containers-core:container', {
          contents: ['diamond-1', 'gold-bar-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
          requiresKey: true,
          keyItemId: 'brass-key-1',
        })
        .withComponent('items-core:openable', {})
        .build();

      const diamond = new ModEntityBuilder('diamond-1')
        .withName('Diamond')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      const goldBar = new ModEntityBuilder('gold-bar-1')
        .withName('Gold Bar')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 2.0 })
        .build();

      // Step 1: Open the locked container with key
      openFixture.reset([room, actor, chest, diamond, goldBar]);
      await openFixture.executeAction('test:actor1', 'locked-chest-1');

      // Verify container is now open
      const containerAfterOpen =
        openFixture.entityManager.getEntityInstance('locked-chest-1');
      expect(containerAfterOpen.components['containers-core:container'].isOpen).toBe(
        true
      );

      // Verify container_opened event
      const openedEvent = openFixture.events.find(
        (e) => e.eventType === 'containers:container_opened'
      );
      expect(openedEvent).toBeDefined();
      expect(openedEvent.payload.contents).toEqual(['diamond-1', 'gold-bar-1']);

      // Step 2: Take item from opened container
      const currentActor =
        openFixture.entityManager.getEntityInstance('test:actor1');
      const currentChest =
        openFixture.entityManager.getEntityInstance('locked-chest-1');
      const currentDiamond =
        openFixture.entityManager.getEntityInstance('diamond-1');
      const currentGoldBar =
        openFixture.entityManager.getEntityInstance('gold-bar-1');

      takeFixture.reset([
        room,
        currentActor,
        currentChest,
        currentDiamond,
        currentGoldBar,
      ]);

      await takeFixture.executeAction('test:actor1', 'locked-chest-1', {
        additionalPayload: { secondaryId: 'diamond-1' },
      });

      // Verify item taken successfully
      const actorAfterTake =
        takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfterTake.components['items:inventory'].items).toContain(
        'diamond-1'
      );
      expect(actorAfterTake.components['items:inventory'].items).toContain(
        'brass-key-1'
      ); // Still has key

      // Verify container updated
      const containerAfterTake =
        takeFixture.entityManager.getEntityInstance('locked-chest-1');
      expect(containerAfterTake.components['containers-core:container'].contents).toEqual(
        ['gold-bar-1']
      );
      expect(containerAfterTake.components['containers-core:container'].isOpen).toBe(
        true
      );

      const takeEvent = takeFixture.events.find(
        (event) => event.eventType === 'containers:item_taken_from_container'
      );
      expect(takeEvent).toBeDefined();
      expect(takeEvent.payload.itemEntity).toBe('diamond-1');

      const takeTurnEnded = takeFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(takeTurnEnded).toBeDefined();
      expect(takeTurnEnded.payload.success).toBe(true);

      // Phase 4: Return the item to the container using put_in_container
      const putRoom =
        takeFixture.entityManager.getEntityInstance('treasure-vault');
      const putActor =
        takeFixture.entityManager.getEntityInstance('test:actor1');
      const putChest =
        takeFixture.entityManager.getEntityInstance('locked-chest-1');
      const putDiamond =
        takeFixture.entityManager.getEntityInstance('diamond-1');
      const putGold = takeFixture.entityManager.getEntityInstance('gold-bar-1');

      putFixture.reset([putRoom, putActor, putChest, putDiamond, putGold]);

      await putFixture.executeAction('test:actor1', 'locked-chest-1', {
        additionalPayload: { secondaryId: 'diamond-1' },
      });

      const actorAfterPut =
        putFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfterPut.components['items:inventory'].items).not.toContain(
        'diamond-1'
      );
      expect(actorAfterPut.components['items:inventory'].items).toContain(
        'brass-key-1'
      );

      const containerAfterPut =
        putFixture.entityManager.getEntityInstance('locked-chest-1');
      expect(
        new Set(containerAfterPut.components['containers-core:container'].contents)
      ).toEqual(new Set(['gold-bar-1', 'diamond-1']));
      expect(containerAfterPut.components['containers-core:container'].isOpen).toBe(true);

      const putRuleEvent = putFixture.events.find(
        (event) => event.eventType === 'containers:item_put_in_container'
      );
      expect(putRuleEvent).toBeDefined();
      expect(putRuleEvent.payload.itemEntity).toBe('diamond-1');
      expect(putRuleEvent.payload.containerEntity).toBe('locked-chest-1');

      const putPerceptible = putFixture.events.find(
        (event) =>
          event.eventType === 'core:perceptible_event' &&
          event.payload.perceptionType === 'container.put'
      );
      expect(putPerceptible).toBeDefined();
      expect(putPerceptible.payload.targetId).toBe('locked-chest-1');

      const putTurnEnded = putFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(putTurnEnded).toBeDefined();
      expect(putTurnEnded.payload.success).toBe(true);
    });

    it('should fail to take from closed container (must open first)', async () => {
      const room = new ModEntityBuilder('dungeon').asRoom('Dungeon').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('dungeon')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const chest = new ModEntityBuilder('closed-chest-2')
        .withName('Closed Chest')
        .atLocation('dungeon')
        .withComponent('containers-core:container', {
          contents: ['treasure-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
        })
        .withComponent('items-core:openable', {})
        .build();

      const treasure = new ModEntityBuilder('treasure-1')
        .withName('Treasure')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .build();

      // Try to take from closed container (should fail)
      takeFixture.reset([room, actor, chest, treasure]);

      await takeFixture.executeAction('test:actor1', 'closed-chest-2', {
        additionalPayload: { secondaryId: 'treasure-1' },
      });

      // Verify take failed - item remains in container
      const actorAfter =
        takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).not.toContain(
        'treasure-1'
      );

      const containerAfter =
        takeFixture.entityManager.getEntityInstance('closed-chest-2');
      expect(containerAfter.components['containers-core:container'].contents).toContain(
        'treasure-1'
      );
      expect(containerAfter.components['containers-core:container'].isOpen).toBe(false);
    });

    it('should handle multiple items taken sequentially from same container', async () => {
      const room = new ModEntityBuilder('storage-room')
        .asRoom('Storage')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Charlie')
        .atLocation('storage-room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const crate = new ModEntityBuilder('supply-crate')
        .withName('Supply Crate')
        .atLocation('storage-room')
        .withComponent('containers-core:container', {
          contents: ['potion-1', 'potion-2', 'potion-3'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
        })
        .withComponent('items-core:openable', {})
        .build();

      const potion1 = new ModEntityBuilder('potion-1')
        .withName('Health Potion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.3 })
        .build();

      const potion2 = new ModEntityBuilder('potion-2')
        .withName('Mana Potion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.3 })
        .build();

      const potion3 = new ModEntityBuilder('potion-3')
        .withName('Stamina Potion')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.3 })
        .build();

      // Step 1: Open the crate
      openFixture.reset([room, actor, crate, potion1, potion2, potion3]);
      await openFixture.executeAction('test:actor1', 'supply-crate');

      const crateAfterOpen =
        openFixture.entityManager.getEntityInstance('supply-crate');
      expect(crateAfterOpen.components['containers-core:container'].isOpen).toBe(true);

      // Step 2: Take first potion
      let currentActor =
        openFixture.entityManager.getEntityInstance('test:actor1');
      let currentCrate =
        openFixture.entityManager.getEntityInstance('supply-crate');
      let currentPotions = [
        openFixture.entityManager.getEntityInstance('potion-1'),
        openFixture.entityManager.getEntityInstance('potion-2'),
        openFixture.entityManager.getEntityInstance('potion-3'),
      ];

      takeFixture.reset([room, currentActor, currentCrate, ...currentPotions]);

      await takeFixture.executeAction('test:actor1', 'supply-crate', {
        additionalPayload: { secondaryId: 'potion-1' },
      });

      let actorState =
        takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorState.components['items:inventory'].items).toContain(
        'potion-1'
      );

      // Step 3: Take second potion
      await takeFixture.executeAction('test:actor1', 'supply-crate', {
        additionalPayload: { secondaryId: 'potion-2' },
      });

      actorState = takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorState.components['items:inventory'].items).toContain(
        'potion-2'
      );

      // Step 4: Take third potion
      await takeFixture.executeAction('test:actor1', 'supply-crate', {
        additionalPayload: { secondaryId: 'potion-3' },
      });

      actorState = takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorState.components['items:inventory'].items).toEqual([
        'potion-1',
        'potion-2',
        'potion-3',
      ]);

      // Verify container is now empty
      const crateAfterAll =
        takeFixture.entityManager.getEntityInstance('supply-crate');
      expect(crateAfterAll.components['containers-core:container'].contents).toEqual([]);
    });
  });

  describe('perception logging throughout workflow', () => {
    it('should create perception logs for open and take actions', async () => {
      const room = new ModEntityBuilder('library').asRoom('Library').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Diana')
        .atLocation('library')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const drawer = new ModEntityBuilder('desk-drawer')
        .withName('Desk Drawer')
        .atLocation('library')
        .withComponent('containers-core:container', {
          contents: ['letter-1'],
          capacity: { maxWeight: 10, maxItems: 5 },
          isOpen: false,
        })
        .withComponent('items-core:openable', {})
        .build();

      const letter = new ModEntityBuilder('letter-1')
        .withName('Secret Letter')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      // Open drawer
      openFixture.reset([room, actor, drawer, letter]);
      await openFixture.executeAction('test:actor1', 'desk-drawer');

      // Check for container_opened perception
      const openPerception = openFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'container.open'
      );
      expect(openPerception).toBeDefined();
      expect(openPerception.payload.locationId).toBe('library');
      expect(openPerception.payload.actorId).toBe('test:actor1');
      expect(openPerception.payload.targetId).toBe('desk-drawer');

      // Take letter
      const currentActor =
        openFixture.entityManager.getEntityInstance('test:actor1');
      const currentDrawer =
        openFixture.entityManager.getEntityInstance('desk-drawer');
      const currentLetter =
        openFixture.entityManager.getEntityInstance('letter-1');

      takeFixture.reset([room, currentActor, currentDrawer, currentLetter]);

      await takeFixture.executeAction('test:actor1', 'desk-drawer', {
        additionalPayload: { secondaryId: 'letter-1' },
      });

      // Check for item_taken_from_container perception
      const takePerception = takeFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.perceptionType === 'container.take'
      );
      expect(takePerception).toBeDefined();
      expect(takePerception.payload.locationId).toBe('library');
      expect(takePerception.payload.actorId).toBe('test:actor1');
      expect(takePerception.payload.targetId).toBe('desk-drawer');
    });
  });

  describe('container state validation', () => {
    it('should enforce container must be open before taking items', async () => {
      const room = new ModEntityBuilder('shop').asRoom('Shop').build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Eve')
        .atLocation('shop')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const closedBox = new ModEntityBuilder('closed-box')
        .withName('Closed Box')
        .atLocation('shop')
        .withComponent('containers-core:container', {
          contents: ['apple-1'],
          capacity: { maxWeight: 10, maxItems: 5 },
          isOpen: false,
        })
        .withComponent('items-core:openable', {})
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('Apple')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.2 })
        .build();

      takeFixture.reset([room, actor, closedBox, apple]);

      // Try to take from closed container
      await takeFixture.executeAction('test:actor1', 'closed-box', {
        additionalPayload: { secondaryId: 'apple-1' },
      });

      // Verify take failed
      const actorAfter =
        takeFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorAfter.components['items:inventory'].items).not.toContain(
        'apple-1'
      );

      const boxAfter =
        takeFixture.entityManager.getEntityInstance('closed-box');
      expect(boxAfter.components['containers-core:container'].contents).toContain(
        'apple-1'
      );
    });

    it('should prevent opening already-open containers', async () => {
      const room = new ModEntityBuilder('warehouse')
        .asRoom('Warehouse')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Frank')
        .atLocation('warehouse')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const openCrate = new ModEntityBuilder('open-crate')
        .withName('Open Crate')
        .atLocation('warehouse')
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
        })
        .withComponent('items-core:openable', {})
        .build();

      openFixture.reset([room, actor, openCrate]);

      // Try to open already-open container
      await openFixture.executeAction('test:actor1', 'open-crate');

      // Verify container remains open (no state change)
      const crateAfter =
        openFixture.entityManager.getEntityInstance('open-crate');
      expect(crateAfter.components['containers-core:container'].isOpen).toBe(true);

      // Verify no container_opened event (already was open)
      const openedEvent = openFixture.events.find(
        (e) => e.eventType === 'containers:container_opened'
      );
      expect(openedEvent).toBeUndefined();
    });
  });
});
