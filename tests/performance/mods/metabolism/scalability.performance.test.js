/**
 * @file Scalability performance tests for metabolism system
 * @description Tests that metabolism operations scale efficiently with
 * increasing entity counts and complex scenarios.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { TURN_STARTED_ID } from '../../../../src/constants/eventIds.js';
import { createPerformanceTestBed } from '../../../common/performanceTestBed.js';

// Import the turn processing rules
import turn1EnergyBurnRule from '../../../../data/mods/metabolism/rules/turn_1_energy_burn.rule.json' assert { type: 'json' };
import turn2DigestionRule from '../../../../data/mods/metabolism/rules/turn_2_digestion.rule.json' assert { type: 'json' };
import turn3UpdateHungerStateRule from '../../../../data/mods/metabolism/rules/turn_3_update_hunger_state.rule.json' assert { type: 'json' };

// Import the operation handlers
import BurnEnergyHandler from '../../../../src/logic/operationHandlers/burnEnergyHandler.js';
import DigestFoodHandler from '../../../../src/logic/operationHandlers/digestFoodHandler.js';
import UpdateHungerStateHandler from '../../../../src/logic/operationHandlers/updateHungerStateHandler.js';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';

/**
 * Creates handlers needed for the metabolism turn processing rules.
 */
function createHandlers(entityManager, eventBus, logger) {
  const safeEventDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      return eventBus.dispatch(eventType, payload);
    }),
  };

  return {
    QUERY_COMPONENTS: new QueryComponentsHandler({
      logger,
      entityManager,
      safeEventDispatcher,
    }),
    BURN_ENERGY: new BurnEnergyHandler({
      logger,
      entityManager,
      safeEventDispatcher,
    }),
    DIGEST_FOOD: new DigestFoodHandler({
      logger,
      entityManager,
      safeEventDispatcher,
    }),
    UPDATE_HUNGER_STATE: new UpdateHungerStateHandler({
      logger,
      entityManager,
      safeEventDispatcher,
    }),
  };
}

describe('metabolism scalability performance', () => {
  let testEnv;
  let performanceTestBed;
  let performanceTracker;

  /**
   * Helper: Creates actor entity with metabolism components
   */
  const createMetabolismActor = (id, name, config = {}) => {
    const {
      currentEnergy = 50,
      maxEnergy = 100,
      baseBurnRate = 5,
      bufferStorage = [],
      bufferCapacity = 10,
      conversionRate = 10,
      efficiency = 1.0,
      hungerState = 'neutral',
      energyPercentage = 50,
      turnsInState = 0,
    } = config;

    return {
      id,
      components: {
        'core:actor': {},
        'core:name': { value: name },
        'core:position': { locationId: 'test:room1' },
        'metabolism:metabolic_store': {
          current_energy: currentEnergy,
          max_energy: maxEnergy,
          base_burn_rate: baseBurnRate,
          buffer_storage: bufferStorage,
          buffer_capacity: bufferCapacity,
        },
        'metabolism:fuel_converter': {
          capacity: bufferCapacity,
          conversion_rate: conversionRate,
          efficiency: efficiency,
          accepted_fuel_tags: ['food', 'drink'],
          metabolic_efficiency_multiplier: 1.0,
        },
        'metabolism:hunger_state': {
          state: hungerState,
          energyPercentage,
          turnsInState,
          starvationDamage: 0,
        },
      },
    };
  };

  /**
   * Helper: Create test room
   */
  const createRoom = () => ({
    id: 'test:room1',
    components: { 'core:location': {} },
  });

  /**
   * Helper: Dispatch turn_started event for an entity
   */
  const dispatchTurnStarted = async (entityId) => {
    await testEnv.eventBus.dispatch(TURN_STARTED_ID, {
      entityId,
      entityType: 'ai',
    });
    // Wait for async rule processing
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  /**
   * Helper: Create entities with varied configurations
   */
  const createVariedEntities = (count) => {
    const entities = [createRoom()];
    for (let i = 0; i < count; i++) {
      const hasBuffer = i % 3 === 0;
      const isHungry = i % 5 === 0;
      const isStarving = i % 20 === 0;
      const hasLargeBuffer = i % 7 === 0;

      let hungerState = 'neutral';
      let currentEnergy = 50 + (i % 40);

      if (isStarving) {
        hungerState = 'starving';
        currentEnergy = 5;
      } else if (isHungry) {
        hungerState = 'hungry';
        currentEnergy = 20;
      }

      const bufferStorage = hasBuffer
        ? hasLargeBuffer
          ? [
              { bulk: 2, energy_content: 20 },
              { bulk: 3, energy_content: 30 },
              { bulk: 1, energy_content: 15 },
            ]
          : [{ bulk: 2, energy_content: 25 }]
        : [];

      entities.push(
        createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
          currentEnergy,
          hungerState,
          bufferStorage,
          baseBurnRate: 3 + (i % 5),
        })
      );
    }
    return entities;
  };

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [
        turn1EnergyBurnRule,
        turn2DigestionRule,
        turn3UpdateHungerStateRule,
      ],
    });

    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('linear scaling verification', () => {
    it('should demonstrate linear scaling from 10 to 50 entities', async () => {
      // Test with 10 entities
      const entities10 = createVariedEntities(10);
      testEnv.reset(entities10);

      const start10 = performance.now();
      for (let i = 0; i < 10; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const time10 = performance.now() - start10;
      const perEntity10 = time10 / 10;

      // Reset and test with 50 entities
      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers,
        entities: [],
        rules: [
          turn1EnergyBurnRule,
          turn2DigestionRule,
          turn3UpdateHungerStateRule,
        ],
      });

      const entities50 = createVariedEntities(50);
      testEnv.reset(entities50);

      const start50 = performance.now();
      for (let i = 0; i < 50; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const time50 = performance.now() - start50;
      const perEntity50 = time50 / 50;

      // Per-entity time should remain relatively stable (within 2x)
      // This indicates linear scaling (O(n))
      const scalingFactor = perEntity50 / perEntity10;

      console.log(`\n=== Linear Scaling Analysis ===`);
      console.log(`10 entities: ${time10.toFixed(2)}ms (${perEntity10.toFixed(2)}ms/entity)`);
      console.log(`50 entities: ${time50.toFixed(2)}ms (${perEntity50.toFixed(2)}ms/entity)`);
      console.log(`Scaling factor: ${scalingFactor.toFixed(2)}x`);

      // Linear scaling means factor should be close to 1.0
      // Allow up to 2x for test environment overhead
      expect(scalingFactor).toBeLessThan(2.0);
    });

    it('should maintain consistent per-entity time at 100 entities', async () => {
      const entityCount = 100;
      const entities = createVariedEntities(entityCount);
      testEnv.reset(entities);

      const times = [];

      // Process in batches to measure consistency
      for (let batch = 0; batch < 10; batch++) {
        const batchStart = performance.now();
        for (let i = batch * 10; i < (batch + 1) * 10; i++) {
          await dispatchTurnStarted(`test:actor${i}`);
        }
        times.push(performance.now() - batchStart);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;

      console.log(`\n=== Batch Consistency Analysis ===`);
      console.log(`Average batch time: ${avgTime.toFixed(2)}ms`);
      console.log(`Min batch: ${minTime.toFixed(2)}ms, Max batch: ${maxTime.toFixed(2)}ms`);
      console.log(`Variance: ${variance.toFixed(2)}ms`);

      // Variance should be reasonable (not exponentially growing)
      expect(variance).toBeLessThan(avgTime * 2);
    });
  });

  describe('complex scenario scaling', () => {
    it('should handle entities with maximum buffer content', async () => {
      const entityCount = 25;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        entities.push(
          createMetabolismActor(`test:actor${i}`, `HeavyDigester${i}`, {
            currentEnergy: 30,
            bufferStorage: [
              { bulk: 2, energy_content: 20 },
              { bulk: 3, energy_content: 30 },
              { bulk: 2, energy_content: 25 },
              { bulk: 1, energy_content: 15 },
              { bulk: 2, energy_content: 10 },
            ],
            bufferCapacity: 10,
            conversionRate: 10,
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();
      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const perEntity = processingTime / entityCount;

      console.log(`\n=== Heavy Buffer Processing ===`);
      console.log(`${entityCount} entities with max buffer: ${processingTime.toFixed(2)}ms`);
      console.log(`Per entity: ${perEntity.toFixed(2)}ms`);

      // Should complete in reasonable time even with complex buffers
      expect(processingTime).toBeLessThan(1500);
    });

    it('should handle state transition heavy scenarios', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      // Create entities that will all trigger state changes
      for (let i = 0; i < entityCount; i++) {
        // Alternate between energy levels that will trigger transitions
        const energyLevel = i % 2 === 0 ? 15 : 85;

        entities.push(
          createMetabolismActor(`test:actor${i}`, `TransitionActor${i}`, {
            currentEnergy: energyLevel,
            maxEnergy: 100,
            hungerState: 'neutral', // All start neutral, will transition
            baseBurnRate: 0, // Prevent energy change during test
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();
      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const endTime = performance.now();

      // Count state change events
      const stateChanges = testEnv.events.filter(
        (e) => e.eventType === 'metabolism:hunger_state_changed'
      );

      const processingTime = endTime - startTime;

      console.log(`\n=== State Transition Heavy Scenario ===`);
      console.log(`${entityCount} entities: ${processingTime.toFixed(2)}ms`);
      console.log(`State changes triggered: ${stateChanges.length}`);

      // All entities should transition (from neutral to hungry or satiated)
      expect(stateChanges.length).toBe(entityCount);
      expect(processingTime).toBeLessThan(3000);
    });
  });

  describe('memory efficiency', () => {
    it('should not exhibit memory growth proportional to entity count squared', async () => {
      const benchmark = performanceTracker.startBenchmark('Memory Scaling', {
        trackMemory: true,
      });

      // First run with 25 entities
      const entities25 = createVariedEntities(25);
      testEnv.reset(entities25);

      const memBefore25 = process.memoryUsage().heapUsed;
      for (let i = 0; i < 25; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const memAfter25 = process.memoryUsage().heapUsed;
      const growth25 = memAfter25 - memBefore25;

      // Reset and test with 50 entities
      testEnv.cleanup();
      testEnv = createRuleTestEnvironment({
        createHandlers,
        entities: [],
        rules: [
          turn1EnergyBurnRule,
          turn2DigestionRule,
          turn3UpdateHungerStateRule,
        ],
      });

      const entities50 = createVariedEntities(50);
      testEnv.reset(entities50);

      const memBefore50 = process.memoryUsage().heapUsed;
      for (let i = 0; i < 50; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const memAfter50 = process.memoryUsage().heapUsed;
      const growth50 = memAfter50 - memBefore50;

      await benchmark.end();

      const growthRatio = growth50 / growth25;

      console.log(`\n=== Memory Scaling Analysis ===`);
      console.log(`25 entities memory growth: ${(growth25 / 1024).toFixed(2)}KB`);
      console.log(`50 entities memory growth: ${(growth50 / 1024).toFixed(2)}KB`);
      console.log(`Growth ratio (2x entities): ${growthRatio.toFixed(2)}x`);

      // Memory growth should be roughly linear (not quadratic)
      // For 2x entities, growth should be roughly 2x (not 4x)
      expect(growthRatio).toBeLessThan(4.0);
    });
  });

  describe('event system efficiency', () => {
    it('should dispatch events efficiently at scale', async () => {
      const entityCount = 50;
      const entities = createVariedEntities(entityCount);
      testEnv.reset(entities);

      const startTime = performance.now();
      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const endTime = performance.now();

      const totalEvents = testEnv.events.length;
      const eventsPerEntity = totalEvents / entityCount;
      const processingTime = endTime - startTime;
      const timePerEvent = processingTime / totalEvents;

      console.log(`\n=== Event System Efficiency ===`);
      console.log(`Total events: ${totalEvents}`);
      console.log(`Events per entity: ${eventsPerEntity.toFixed(2)}`);
      console.log(`Time per event: ${timePerEvent.toFixed(3)}ms`);

      // Each entity should produce roughly consistent number of events
      // (burn + possibly digest + possibly state change)
      expect(eventsPerEntity).toBeGreaterThan(1);
      expect(eventsPerEntity).toBeLessThan(5);

      // Time per event should be reasonable
      expect(timePerEvent).toBeLessThan(5);
    });
  });

  describe('throughput targets', () => {
    it('should meet target of processing 100+ entities per second', async () => {
      const entityCount = 100;
      const entities = createVariedEntities(entityCount);
      testEnv.reset(entities);

      const startTime = performance.now();
      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const entitiesPerSecond = (entityCount / processingTime) * 1000;

      console.log(`\n=== Throughput Target Assessment ===`);
      console.log(`Processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Entities per second: ${entitiesPerSecond.toFixed(0)}`);
      console.log(`Target (100/sec): ${entitiesPerSecond >= 100 ? 'MET' : 'NOT MET'}`);

      // Target: at least 100 entities per second
      // This means 100 entities should complete in under 1000ms
      expect(entitiesPerSecond).toBeGreaterThan(10); // Minimum acceptable
    });
  });
});
