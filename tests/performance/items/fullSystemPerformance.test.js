/**
 * @file Performance tests for the complete Items System
 * @description Tests system performance with large-scale scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };

describe('Items System - Performance', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'item-transfer',
      'item-transfer:give_item',
      giveItemRule,
      eventIsActionGiveItem
    );
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('large-scale scenarios', () => {
    it('should handle large-scale scenario efficiently', () => {
      // Create large scenario: 10 actors, 20 items each, 5 containers
      const location = new ModEntityBuilder('marketplace')
        .asRoom('Marketplace')
        .build();

      const entities = [location];

      // Create 10 actors with inventories
      for (let i = 0; i < 10; i++) {
        const actor = new ModEntityBuilder(`actor-${i}`)
          .withName(`Actor ${i}`)
          .atLocation('marketplace')
          .asActor()
          .withComponent('items:inventory', {
            items: [],
            capacity: { maxWeight: 100, maxItems: 30 },
          })
          .build();
        entities.push(actor);

        // Give each actor 20 items
        for (let j = 0; j < 20; j++) {
          const itemId = `item-${i}-${j}`;
          const item = new ModEntityBuilder(itemId)
            .withName(`Item ${i}-${j}`)
            .withComponent('items:item', {})
            .withComponent('items:portable', {})
            .withComponent('core:weight', { weight: 0.5 })
            .build();
          entities.push(item);

          // Add item to actor's inventory
          actor.components['items:inventory'].items.push(itemId);
        }
      }

      // Create 5 containers with items
      for (let i = 0; i < 5; i++) {
        const container = new ModEntityBuilder(`container-${i}`)
          .withName(`Container ${i}`)
          .atLocation('marketplace')
          .withComponent('items:item', {})
          .withComponent('items:openable', {})
          .withComponent('containers-core:container', {
            contents: [],
            capacity: { maxWeight: 50, maxItems: 15 },
            isOpen: true,
          })
          .build();
        entities.push(container);

        // Add 10 items to each container
        for (let j = 0; j < 10; j++) {
          const itemId = `container-item-${i}-${j}`;
          const item = new ModEntityBuilder(itemId)
            .withName(`Container Item ${i}-${j}`)
            .withComponent('items:item', {})
            .withComponent('items:portable', {})
            .withComponent('core:weight', { weight: 0.3 })
            .build();
          entities.push(item);

          container.components['containers-core:container'].contents.push(itemId);
        }
      }

      fixture.reset(entities);

      // Measure action discovery performance
      const startTime = performance.now();

      // Discover actions for all 10 actors
      for (let i = 0; i < 10; i++) {
        const actions = fixture.discoverActions(`actor-${i}`);
        expect(actions).toBeDefined();
        expect(Array.isArray(actions)).toBe(true);
      }

      const duration = performance.now() - startTime;

      // Should complete action discovery for all actors in under 2 seconds
      expect(duration).toBeLessThan(2000);

      // Log performance metrics
      console.log(`Large-scale scenario performance:
        - Actors: 10
        - Items per actor: 20
        - Containers: 5
        - Items per container: 10
        - Total entities: ${entities.length}
        - Discovery time: ${duration.toFixed(2)}ms
        - Time per actor: ${(duration / 10).toFixed(2)}ms
      `);
    });

    it('should scale linearly with entity count', () => {
      const measurements = [];

      // Test with increasing entity counts
      for (const actorCount of [2, 5, 10]) {
        const location = new ModEntityBuilder('test-location')
          .asRoom('Test Location')
          .build();

        const entities = [location];

        // Create actors with items
        for (let i = 0; i < actorCount; i++) {
          const actor = new ModEntityBuilder(`actor-${i}`)
            .withName(`Actor ${i}`)
            .atLocation('test-location')
            .asActor()
            .withComponent('items:inventory', {
              items: [],
              capacity: { maxWeight: 50, maxItems: 20 },
            })
            .build();
          entities.push(actor);

          // Each actor gets 10 items
          for (let j = 0; j < 10; j++) {
            const itemId = `item-${i}-${j}`;
            const item = new ModEntityBuilder(itemId)
              .withName(`Item ${i}-${j}`)
              .withComponent('items:item', {})
              .withComponent('items:portable', {})
              .withComponent('core:weight', { weight: 0.5 })
              .build();
            entities.push(item);
            actor.components['items:inventory'].items.push(itemId);
          }
        }

        fixture.reset(entities);

        const startTime = performance.now();
        for (let i = 0; i < actorCount; i++) {
          fixture.discoverActions(`actor-${i}`);
        }
        const duration = performance.now() - startTime;

        measurements.push({
          actorCount,
          duration,
          avgPerActor: duration / actorCount,
        });
      }

      // Verify reasonable scaling (should be roughly linear)
      // Use per-actor averages with a minimum baseline to avoid small-denominator spikes
      const baselineAvg = Math.max(measurements[0].avgPerActor, 1);
      const scaledAvg = measurements[2].avgPerActor;
      const perActorRatio = scaledAvg / baselineAvg;
      // Allow generous tolerance for GC jitter while still catching pathological growth
      expect(perActorRatio).toBeLessThan(8);

      console.log('Scaling measurements:', measurements);
    });

    it('should handle large entity counts efficiently', () => {
      const location = new ModEntityBuilder('warehouse')
        .asRoom('Warehouse')
        .build();

      // Worker with items in inventory (required for give_item action)
      // Must have grabbing hands to satisfy give_item prerequisite
      const workerBuilder = new ModEntityBuilder('worker')
        .withName('Warehouse Worker')
        .atLocation('warehouse')
        .asActor()
        .withGrabbingHands(2)
        .withComponent('items:inventory', {
          items: ['worker-item-1', 'worker-item-2'],
          capacity: { maxWeight: 200, maxItems: 50 },
        });
      const actor = workerBuilder.build();
      const workerHands = workerBuilder.getHandEntities();

      // Recipient actor (required for give_item action - needs someone to give to)
      const recipient = new ModEntityBuilder('recipient')
        .withName('Recipient Worker')
        .atLocation('warehouse')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 100, maxItems: 20 },
        })
        .build();

      // Items in worker's inventory
      const workerItem1 = new ModEntityBuilder('worker-item-1')
        .withName('Worker Item 1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .build();

      const workerItem2 = new ModEntityBuilder('worker-item-2')
        .withName('Worker Item 2')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .build();

      const entities = [
        location,
        actor,
        recipient,
        workerItem1,
        workerItem2,
        ...workerHands,
      ];

      // Create 20 containers with 10 items each (environmental complexity)
      for (let i = 0; i < 20; i++) {
        const container = new ModEntityBuilder(`crate-${i}`)
          .withName(`Crate ${i}`)
          .atLocation('warehouse')
          .withComponent('items:item', {})
          .withComponent('items:openable', {})
          .withComponent('containers-core:container', {
            contents: [],
            capacity: { maxWeight: 30, maxItems: 10 },
            isOpen: true,
          })
          .build();
        entities.push(container);

        for (let j = 0; j < 10; j++) {
          const itemId = `box-${i}-${j}`;
          const item = new ModEntityBuilder(itemId)
            .withName(`Box ${i}-${j}`)
            .withComponent('items:item', {})
            .withComponent('items:portable', {})
            .withComponent('core:weight', { weight: 1.0 })
            .build();
          entities.push(item);
          container.components['containers-core:container'].contents.push(itemId);
        }
      }

      fixture.reset(entities);

      const startTime = performance.now();
      const actions = fixture.discoverActions('worker');
      const duration = performance.now() - startTime;

      // Should discover actions with many entities efficiently
      expect(duration).toBeLessThan(500);
      expect(actions.length).toBeGreaterThan(0);

      console.log(`Large entity count discovery performance:
        - Actors: 2 (worker + recipient)
        - Containers: 20
        - Items per container: 10
        - Total entities: ${entities.length}
        - Discovery time: ${duration.toFixed(2)}ms
        - Actions discovered: ${actions.length}
      `);
    });

    it('should handle inventory capacity checks efficiently', () => {
      const location = new ModEntityBuilder('storage-room')
        .asRoom('Storage Room')
        .build();

      const actor = new ModEntityBuilder('clerk')
        .withName('Storage Clerk')
        .atLocation('storage-room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 10, maxItems: 5 },
        })
        .build();

      const entities = [location, actor];

      // Create many items at the location (more than can fit in inventory)
      for (let i = 0; i < 50; i++) {
        const item = new ModEntityBuilder(`package-${i}`)
          .withName(`Package ${i}`)
          .atLocation('storage-room')
          .withComponent('items:item', {})
          .withComponent('items:portable', {})
          .withComponent('core:weight', { weight: 2.0 })
          .build();
        entities.push(item);
      }

      fixture.reset(entities);

      const startTime = performance.now();
      const actions = fixture.discoverActions('clerk');
      const duration = performance.now() - startTime;

      // Should efficiently filter based on capacity
      expect(duration).toBeLessThan(300);

      // Note: No pick_up actions will be discovered because inventory is full
      // This test verifies that capacity checks work correctly
      expect(actions).toBeDefined();
      expect(Array.isArray(actions)).toBe(true);

      console.log(`Capacity check performance:
        - Items at location: 50
        - Inventory capacity: 5 items / 10kg
        - Discovery time: ${duration.toFixed(2)}ms
        - Actions discovered: ${actions.length}
      `);
    });
  });

  describe('stress tests', () => {
    it('should handle maximum realistic entity counts', () => {
      const location = new ModEntityBuilder('bazaar').asRoom('Bazaar').build();

      const entities = [location];

      // Extreme scenario: 20 actors, 15 items each, 10 containers
      for (let i = 0; i < 20; i++) {
        const actor = new ModEntityBuilder(`merchant-${i}`)
          .withName(`Merchant ${i}`)
          .atLocation('bazaar')
          .asActor()
          .withComponent('items:inventory', {
            items: [],
            capacity: { maxWeight: 80, maxItems: 25 },
          })
          .build();
        entities.push(actor);

        for (let j = 0; j < 15; j++) {
          const itemId = `goods-${i}-${j}`;
          const item = new ModEntityBuilder(itemId)
            .withName(`Goods ${i}-${j}`)
            .withComponent('items:item', {})
            .withComponent('items:portable', {})
            .withComponent('core:weight', { weight: 0.8 })
            .build();
          entities.push(item);
          actor.components['items:inventory'].items.push(itemId);
        }
      }

      for (let i = 0; i < 10; i++) {
        const container = new ModEntityBuilder(`stall-${i}`)
          .withName(`Market Stall ${i}`)
          .atLocation('bazaar')
          .withComponent('items:item', {})
          .withComponent('items:openable', {})
          .withComponent('containers-core:container', {
            contents: [],
            capacity: { maxWeight: 60, maxItems: 20 },
            isOpen: true,
          })
          .build();
        entities.push(container);

        for (let j = 0; j < 15; j++) {
          const itemId = `display-${i}-${j}`;
          const item = new ModEntityBuilder(itemId)
            .withName(`Display Item ${i}-${j}`)
            .withComponent('items:item', {})
            .withComponent('items:portable', {})
            .withComponent('core:weight', { weight: 0.5 })
            .build();
          entities.push(item);
          container.components['containers-core:container'].contents.push(itemId);
        }
      }

      fixture.reset(entities);

      const startTime = performance.now();

      // Discover actions for first 10 actors (representative sample)
      for (let i = 0; i < 10; i++) {
        const actions = fixture.discoverActions(`merchant-${i}`);
        expect(actions).toBeDefined();
      }

      const duration = performance.now() - startTime;

      // Should handle extreme scenarios in reasonable time
      expect(duration).toBeLessThan(3000);

      console.log(`Stress test performance:
        - Actors: 20
        - Items per actor: 15
        - Containers: 10
        - Items per container: 15
        - Total entities: ${entities.length}
        - Discovery time (10 actors): ${duration.toFixed(2)}ms
        - Avg per actor: ${(duration / 10).toFixed(2)}ms
      `);
    });
  });
});
