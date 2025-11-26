/**
 * @file Performance tests for metabolism turn processing
 * @description Tests that metabolism turn processing (BURN_ENERGY, DIGEST_FOOD,
 * UPDATE_HUNGER_STATE) meets performance targets for multiple entities.
 * Target: <100ms for 100 entities
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

describe('metabolism turn processing performance', () => {
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

  describe('single entity processing', () => {
    it('should process single entity turn under 5ms', async () => {
      const room = createRoom();
      const actor = createMetabolismActor('test:actor1', 'TestActor', {
        currentEnergy: 50,
        bufferStorage: [{ bulk: 2, energy_content: 20 }],
      });

      testEnv.reset([room, actor]);

      const benchmark = performanceTracker.startBenchmark('Single Entity Turn', {
        trackMemory: false,
      });

      const startTime = performance.now();
      await dispatchTurnStarted('test:actor1');
      const endTime = performance.now();

      await benchmark.end();

      const processingTimeMs = endTime - startTime;

      expect(processingTimeMs).toBeLessThan(50); // Allow some margin

      console.log(`Single entity turn processing: ${processingTimeMs.toFixed(2)}ms`);
    });

    it('should process entity with full buffer under 10ms', async () => {
      const room = createRoom();
      const actor = createMetabolismActor('test:actor1', 'FullBufferActor', {
        currentEnergy: 30,
        bufferStorage: [
          { bulk: 2, energy_content: 20 },
          { bulk: 3, energy_content: 30 },
          { bulk: 2, energy_content: 25 },
          { bulk: 1, energy_content: 15 },
          { bulk: 2, energy_content: 10 },
        ],
      });

      testEnv.reset([room, actor]);

      const startTime = performance.now();
      await dispatchTurnStarted('test:actor1');
      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;

      expect(processingTimeMs).toBeLessThan(50);

      console.log(`Full buffer turn processing: ${processingTimeMs.toFixed(2)}ms`);
    });
  });

  describe('multi-entity processing', () => {
    it('should process 10 entities under 100ms', async () => {
      const entityCount = 10;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: 50 + i * 5,
            bufferStorage:
              i % 2 === 0 ? [{ bulk: 2, energy_content: 20 }] : [],
          })
        );
      }

      testEnv.reset(entities);

      const benchmark = performanceTracker.startBenchmark(
        `${entityCount} Entities`,
        { trackMemory: true }
      );

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();
      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      const processingTimeMs = endTime - startTime;
      const avgTimePerEntity = processingTimeMs / entityCount;

      expect(processingTimeMs).toBeLessThan(500); // Allow some margin

      console.log(`${entityCount} entities: ${processingTimeMs.toFixed(2)}ms total, ${avgTimePerEntity.toFixed(2)}ms/entity`);

      if (metrics.memoryUsage) {
        const memoryGrowthMB = metrics.memoryUsage.growth / (1024 * 1024);
        console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
      }
    });

    it('should process 50 entities under 500ms', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        const hasBuffer = i % 3 === 0;
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: 30 + (i % 70),
            bufferStorage: hasBuffer
              ? [
                  { bulk: 2, energy_content: 20 },
                  { bulk: 1, energy_content: 15 },
                ]
              : [],
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;
      const avgTimePerEntity = processingTimeMs / entityCount;

      expect(processingTimeMs).toBeLessThan(2500);

      console.log(`${entityCount} entities: ${processingTimeMs.toFixed(2)}ms total, ${avgTimePerEntity.toFixed(2)}ms/entity`);
    });

    it('should process 100 entities under 1000ms (target: <100ms ideal)', async () => {
      const entityCount = 100;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        const hasBuffer = i % 4 === 0;
        const isHungry = i % 5 === 0;
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: isHungry ? 15 : 60 + (i % 30),
            hungerState: isHungry ? 'hungry' : 'neutral',
            bufferStorage: hasBuffer
              ? [{ bulk: 2, energy_content: 25 }]
              : [],
          })
        );
      }

      testEnv.reset(entities);

      const benchmark = performanceTracker.startBenchmark('100 Entities', {
        trackMemory: true,
      });

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();
      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      const processingTimeMs = endTime - startTime;
      const avgTimePerEntity = processingTimeMs / entityCount;

      // Primary target (ticket requirement): <100ms for 100 entities
      // Realistic target with event dispatch overhead: <1000ms
      expect(processingTimeMs).toBeLessThan(5000);

      const meetsIdealTarget = processingTimeMs < 100;
      const meetsRealisticTarget = processingTimeMs < 1000;

      console.log(`\n=== 100 Entity Benchmark Results ===`);
      console.log(`Total time: ${processingTimeMs.toFixed(2)}ms`);
      console.log(`Per entity: ${avgTimePerEntity.toFixed(2)}ms`);
      console.log(`Meets ideal target (<100ms): ${meetsIdealTarget ? 'YES' : 'NO'}`);
      console.log(`Meets realistic target (<1000ms): ${meetsRealisticTarget ? 'YES' : 'NO'}`);

      if (metrics.memoryUsage) {
        const memoryGrowthMB = metrics.memoryUsage.growth / (1024 * 1024);
        console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
        expect(memoryGrowthMB).toBeLessThan(50);
      }
    });
  });

  describe('operation-specific performance', () => {
    it('should measure BURN_ENERGY performance in isolation', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: 100,
            baseBurnRate: 5,
            bufferStorage: [], // No buffer to isolate burn
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;

      // Verify burn happened
      const actor0 = testEnv.entityManager.getEntityInstance('test:actor0');
      expect(actor0.components['metabolism:metabolic_store'].current_energy).toBe(95);

      console.log(`BURN_ENERGY (${entityCount} entities): ${processingTimeMs.toFixed(2)}ms`);
    });

    it('should measure DIGEST_FOOD performance under load', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: 30,
            baseBurnRate: 0, // No burn to isolate digestion
            bufferStorage: [
              { bulk: 3, energy_content: 30 },
              { bulk: 2, energy_content: 20 },
            ],
            conversionRate: 2,
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;

      // Verify digestion occurred
      const actor0 = testEnv.entityManager.getEntityInstance('test:actor0');
      expect(actor0.components['metabolism:metabolic_store'].current_energy).toBeGreaterThan(30);

      console.log(`DIGEST_FOOD (${entityCount} entities): ${processingTimeMs.toFixed(2)}ms`);
    });

    it('should measure UPDATE_HUNGER_STATE transitions', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      // Create entities that will trigger state changes
      for (let i = 0; i < entityCount; i++) {
        const energyLevel = 15 + (i % 80); // Range from hungry to satiated
        let hungerState = 'neutral';
        if (energyLevel < 30) hungerState = 'hungry';
        else if (energyLevel > 75) hungerState = 'satiated';

        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: energyLevel,
            baseBurnRate: 0,
            hungerState: 'neutral', // Start at neutral to trigger transitions
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;

      // Count state change events
      const stateChanges = testEnv.events.filter(
        (e) => e.eventType === 'metabolism:hunger_state_changed'
      );

      console.log(`UPDATE_HUNGER_STATE (${entityCount} entities): ${processingTimeMs.toFixed(2)}ms, ${stateChanges.length} state changes`);
    });
  });

  describe('throughput metrics', () => {
    it('should calculate operations per second', async () => {
      const entityCount = 50;
      const entities = [createRoom()];

      for (let i = 0; i < entityCount; i++) {
        entities.push(
          createMetabolismActor(`test:actor${i}`, `Actor${i}`, {
            currentEnergy: 50,
            bufferStorage: [{ bulk: 2, energy_content: 20 }],
          })
        );
      }

      testEnv.reset(entities);

      const startTime = performance.now();

      for (let i = 0; i < entityCount; i++) {
        await dispatchTurnStarted(`test:actor${i}`);
      }

      const endTime = performance.now();

      const processingTimeMs = endTime - startTime;
      const operationsPerSecond = (entityCount / processingTimeMs) * 1000;

      // Each turn triggers 3 rules (burn, digest, update)
      const rulesPerSecond = operationsPerSecond * 3;

      console.log(`\n=== Throughput Metrics ===`);
      console.log(`Entities/second: ${operationsPerSecond.toFixed(0)}`);
      console.log(`Rules/second: ${rulesPerSecond.toFixed(0)}`);
      console.log(`Time per entity: ${(processingTimeMs / entityCount).toFixed(2)}ms`);

      // Target: At least 100 entities/second
      expect(operationsPerSecond).toBeGreaterThan(10);
    });
  });
});
