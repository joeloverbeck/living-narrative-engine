/**
 * @file Integration tests for complete hunger cycle
 * @description Tests the full cycle: hungry → eat → digest → satiated
 * Verifies energy increases from digestion over multiple turns and
 * hunger state improves as energy increases.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { TURN_STARTED_ID } from '../../../../src/constants/eventIds.js';

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
 *
 * @param entityManager
 * @param eventBus
 * @param logger
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

describe('complete hunger cycle integration', () => {
  let testEnv;

  /**
   * Helper: Creates actor entity with metabolism components
   *
   * @param id
   * @param name
   * @param config
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
   * Helper: Dispatch turn_started event for an entity
   *
   * @param entityId
   */
  const dispatchTurnStarted = async (entityId) => {
    await testEnv.eventBus.dispatch(TURN_STARTED_ID, {
      entityId,
      entityType: 'ai',
    });
    // Wait for async rule processing
    await new Promise((resolve) => setTimeout(resolve, 50));
  };

  /**
   * Helper: Simulate eating food by adding to buffer storage
   *
   * @param entityId
   * @param foodBulk
   * @param energyContent
   */
  const simulateEating = (entityId, foodBulk, energyContent) => {
    const entity = testEnv.entityManager.getEntityInstance(entityId);
    const metabolicStore = entity.components['metabolism:metabolic_store'];

    const newBufferStorage = [
      ...(metabolicStore.buffer_storage || []),
      { bulk: foodBulk, energy_content: energyContent },
    ];

    testEnv.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
      ...metabolicStore,
      buffer_storage: newBufferStorage,
    });
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
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('full cycle: hungry → eat → digest → satiated', () => {
    it('completes full hunger recovery cycle over multiple turns', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      // Start hungry with low energy
      const actor = createMetabolismActor('test:actor1', 'HungryActor', {
        currentEnergy: 20, // 20% - hungry state
        maxEnergy: 100,
        baseBurnRate: 2, // Low burn rate so digestion outpaces it
        hungerState: 'hungry',
        energyPercentage: 20,
      });

      testEnv.reset([room, actor]);

      // Verify initial state is hungry
      let entity = testEnv.entityManager.getEntityInstance('test:actor1');
      expect(entity.components['metabolism:hunger_state'].state).toBe('hungry');

      // Simulate eating high-energy food
      simulateEating('test:actor1', 5, 80); // 5 bulk with 80 energy

      // Process several turns to digest food
      for (let i = 0; i < 5; i++) {
        await dispatchTurnStarted('test:actor1');
      }

      // Check final state
      entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const finalState = entity.components['metabolism:hunger_state'].state;
      const finalEnergy =
        entity.components['metabolism:metabolic_store'].current_energy;

      // After eating 80 energy worth of food and burning 2 * 5 = 10 energy
      // Net energy gain should be positive, resulting in improved state
      expect(finalEnergy).toBeGreaterThan(20);

      // State should improve from 'hungry' to at least 'neutral' or better
      expect(['neutral', 'satiated', 'gluttonous']).toContain(finalState);
    });

    it('transitions through expected states during recovery', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      // Start starving
      const actor = createMetabolismActor('test:actor1', 'StarvingActor', {
        currentEnergy: 5, // 5% - starving state
        maxEnergy: 100,
        baseBurnRate: 0, // No burn to simplify testing
        conversionRate: 20, // Fast digestion
        hungerState: 'starving',
        energyPercentage: 5,
      });

      testEnv.reset([room, actor]);

      const stateHistory = [];

      // Record initial state
      let entity = testEnv.entityManager.getEntityInstance('test:actor1');
      stateHistory.push(entity.components['metabolism:hunger_state'].state);

      // Add food to buffer and process turns
      simulateEating('test:actor1', 3, 100); // 3 bulk with 100 energy

      for (let i = 0; i < 10; i++) {
        await dispatchTurnStarted('test:actor1');
        entity = testEnv.entityManager.getEntityInstance('test:actor1');
        const currentState = entity.components['metabolism:hunger_state'].state;
        if (stateHistory[stateHistory.length - 1] !== currentState) {
          stateHistory.push(currentState);
        }
      }

      // Should have progressed through multiple states
      expect(stateHistory.length).toBeGreaterThan(1);
      expect(stateHistory[0]).toBe('starving');

      // Final state should be improved
      const finalState = stateHistory[stateHistory.length - 1];
      expect(['hungry', 'neutral', 'satiated', 'gluttonous']).toContain(
        finalState
      );
    });
  });

  describe('energy increases from digestion over multiple turns', () => {
    it('steadily increases energy as buffer is digested', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'DigestingActor', {
        currentEnergy: 30,
        maxEnergy: 100,
        baseBurnRate: 0, // No burn to isolate digestion effect
        bufferStorage: [{ bulk: 10, energy_content: 50 }], // Pre-loaded buffer
        conversionRate: 2, // Digest 2 bulk per turn
        efficiency: 1.0,
      });

      testEnv.reset([room, actor]);

      const energyHistory = [];

      // Record energy over multiple turns
      for (let i = 0; i < 6; i++) {
        const entity = testEnv.entityManager.getEntityInstance('test:actor1');
        energyHistory.push(
          entity.components['metabolism:metabolic_store'].current_energy
        );
        await dispatchTurnStarted('test:actor1');
      }

      // Energy should increase each turn
      for (let i = 1; i < energyHistory.length; i++) {
        expect(energyHistory[i]).toBeGreaterThanOrEqual(energyHistory[i - 1]);
      }

      // Final energy should be higher than initial
      expect(energyHistory[energyHistory.length - 1]).toBeGreaterThan(
        energyHistory[0]
      );
    });

    it('caps energy at max_energy during digestion', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'OverfedActor', {
        currentEnergy: 90,
        maxEnergy: 100,
        baseBurnRate: 0,
        bufferStorage: [{ bulk: 5, energy_content: 50 }], // Lots of energy to digest
        conversionRate: 10, // Fast digestion
        efficiency: 1.0,
      });

      testEnv.reset([room, actor]);

      // Process turns
      await dispatchTurnStarted('test:actor1');
      await dispatchTurnStarted('test:actor1');

      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const finalEnergy =
        entity.components['metabolism:metabolic_store'].current_energy;

      // Energy should be capped at max
      expect(finalEnergy).toBeLessThanOrEqual(100);
    });
  });

  describe('hunger state improves as energy increases', () => {
    it('improves hunger state as energy percentage rises', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      // Start at hungry threshold (25%)
      const actor = createMetabolismActor('test:actor1', 'RecoveringActor', {
        currentEnergy: 25,
        maxEnergy: 100,
        baseBurnRate: 0,
        conversionRate: 20,
        hungerState: 'hungry',
        energyPercentage: 25,
      });

      testEnv.reset([room, actor]);

      // Add substantial food
      simulateEating('test:actor1', 5, 60);

      // Process turn
      await dispatchTurnStarted('test:actor1');

      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const hungerState = entity.components['metabolism:hunger_state'];

      // Energy should have increased significantly
      expect(hungerState.energyPercentage).toBeGreaterThan(25);

      // State should have improved (at least to neutral)
      expect(['neutral', 'satiated', 'gluttonous']).toContain(
        hungerState.state
      );
    });

    it('reaches satiated state when energy exceeds 75%', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'WellFedActor', {
        currentEnergy: 70,
        maxEnergy: 100,
        baseBurnRate: 0,
        conversionRate: 20,
        hungerState: 'neutral',
        energyPercentage: 70,
      });

      testEnv.reset([room, actor]);

      // Add food to push over 75%
      simulateEating('test:actor1', 2, 20);

      // Process turn
      await dispatchTurnStarted('test:actor1');

      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const hungerState = entity.components['metabolism:hunger_state'];

      // Should be satiated (75-100%)
      expect(hungerState.state).toBe('satiated');
      expect(hungerState.energyPercentage).toBeGreaterThanOrEqual(75);
    });
  });

  describe('edge cases in hunger cycle', () => {
    it('handles empty buffer digestion gracefully', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'EmptyBufferActor', {
        currentEnergy: 50,
        maxEnergy: 100,
        baseBurnRate: 5,
        bufferStorage: [], // No food to digest
      });

      testEnv.reset([room, actor]);

      // Process turn - should not throw
      await expect(dispatchTurnStarted('test:actor1')).resolves.not.toThrow();

      // Energy should only decrease due to burn, not increase from digestion
      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const finalEnergy =
        entity.components['metabolism:metabolic_store'].current_energy;
      expect(finalEnergy).toBe(45); // 50 - 5 burn rate
    });

    it('handles multiple food items in buffer', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'FullBufferActor', {
        currentEnergy: 30,
        maxEnergy: 100,
        baseBurnRate: 0,
        bufferStorage: [
          { bulk: 2, energy_content: 20 },
          { bulk: 3, energy_content: 30 },
          { bulk: 1, energy_content: 10 },
        ],
        conversionRate: 3, // Digest 3 bulk per turn
        efficiency: 1.0,
      });

      testEnv.reset([room, actor]);

      // Process turn
      await dispatchTurnStarted('test:actor1');

      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = entity.components['metabolism:metabolic_store'];

      // Should have gained energy
      expect(metabolicStore.current_energy).toBeGreaterThan(30);

      // Buffer should have reduced
      const totalBulk = metabolicStore.buffer_storage.reduce(
        (sum, item) => sum + item.bulk,
        0
      );
      expect(totalBulk).toBeLessThan(6); // Started with 2+3+1=6 bulk
    });

    it('handles zero efficiency digestion', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor(
        'test:actor1',
        'IneffectiveDigester',
        {
          currentEnergy: 30,
          maxEnergy: 100,
          baseBurnRate: 0,
          bufferStorage: [{ bulk: 5, energy_content: 50 }],
          conversionRate: 5,
          efficiency: 0, // No energy gained from digestion
        }
      );

      testEnv.reset([room, actor]);

      // Process turn
      await dispatchTurnStarted('test:actor1');

      const entity = testEnv.entityManager.getEntityInstance('test:actor1');
      const metabolicStore = entity.components['metabolism:metabolic_store'];

      // Energy should not have increased (efficiency is 0)
      expect(metabolicStore.current_energy).toBe(30);

      // Buffer should still have been consumed
      const totalBulk = metabolicStore.buffer_storage.reduce(
        (sum, item) => sum + item.bulk,
        0
      );
      expect(totalBulk).toBeLessThan(5);
    });
  });
});
