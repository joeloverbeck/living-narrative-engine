/**
 * @file Integration tests for metabolism turn processing rules
 * @description Tests that turn_1_energy_burn, turn_2_digestion, and turn_3_update_hunger_state
 * rules correctly trigger on core:turn_started events and update entity state.
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
      // Actually dispatch to eventBus for testing
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

describe('metabolism turn processing integration', () => {
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

  describe('BURN_ENERGY operation via turn_1_energy_burn rule', () => {
    it('reduces current_energy each turn based on base_burn_rate', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'TestActor', {
        currentEnergy: 100,
        maxEnergy: 100,
        baseBurnRate: 10,
      });

      testEnv.reset([room, actor]);

      const initialEnergy =
        testEnv.entityManager.getEntityInstance('test:actor1').components[
          'metabolism:metabolic_store'
        ].current_energy;

      expect(initialEnergy).toBe(100);

      await dispatchTurnStarted('test:actor1');

      const updatedEntity =
        testEnv.entityManager.getEntityInstance('test:actor1');
      const newEnergy =
        updatedEntity.components['metabolism:metabolic_store'].current_energy;

      // Energy should decrease by base_burn_rate (10) per turn
      expect(newEnergy).toBe(90);
    });

    it('clamps energy at minimum 0 when burning', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'HungryActor', {
        currentEnergy: 5,
        maxEnergy: 100,
        baseBurnRate: 10,
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const updatedEntity =
        testEnv.entityManager.getEntityInstance('test:actor1');
      const newEnergy =
        updatedEntity.components['metabolism:metabolic_store'].current_energy;

      // Energy should not go below 0
      expect(newEnergy).toBe(0);
    });

    it('dispatches metabolism:energy_burned event', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'TestActor', {
        currentEnergy: 50,
        baseBurnRate: 5,
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const burnEvent = testEnv.events.find(
        (e) => e.eventType === 'metabolism:energy_burned'
      );
      expect(burnEvent).toBeDefined();
      expect(burnEvent.payload).toMatchObject({
        entityId: 'test:actor1',
        energyBurned: 5,
        newEnergy: 45,
      });
    });
  });

  describe('DIGEST_FOOD operation via turn_2_digestion rule', () => {
    it('converts buffer_storage to energy each turn', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'DigestingActor', {
        currentEnergy: 30,
        maxEnergy: 100,
        baseBurnRate: 0, // Set to 0 to isolate digestion effect
        bufferStorage: [{ bulk: 2, energy_content: 20 }],
        conversionRate: 10,
        efficiency: 1.0,
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const digestEvent = testEnv.events.find(
        (e) => e.eventType === 'metabolism:food_digested'
      );
      expect(digestEvent).toBeDefined();
    });

    it('does not dispatch digestion event when buffer is empty', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'EmptyBufferActor', {
        currentEnergy: 50,
        baseBurnRate: 5,
        bufferStorage: [], // Empty buffer
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      // Should NOT have digestion event since buffer was empty
      const digestEvents = testEnv.events.filter(
        (e) => e.eventType === 'metabolism:food_digested'
      );
      expect(digestEvents).toHaveLength(0);
    });
  });

  describe('UPDATE_HUNGER_STATE operation via turn_3_update_hunger_state rule', () => {
    it('updates hunger state based on energy percentage', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'StateUpdateActor', {
        currentEnergy: 80,
        maxEnergy: 100,
        baseBurnRate: 0, // Prevent energy change
        hungerState: 'neutral', // Start at neutral
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const updatedEntity =
        testEnv.entityManager.getEntityInstance('test:actor1');
      const hungerState = updatedEntity.components['metabolism:hunger_state'];

      // 80/100 = 80% energy, should be 'satiated' (75-100%)
      expect(hungerState.state).toBe('satiated');
      expect(hungerState.energyPercentage).toBe(80);
    });

    it('dispatches hunger_state_changed event when state changes', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'StateChangeActor', {
        currentEnergy: 20,
        maxEnergy: 100,
        baseBurnRate: 0,
        hungerState: 'neutral', // Will change to 'hungry' (10-30%)
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const stateChangeEvents = testEnv.events.filter(
        (e) => e.eventType === 'metabolism:hunger_state_changed'
      );

      expect(stateChangeEvents.length).toBeGreaterThan(0);
      expect(stateChangeEvents[0].payload).toMatchObject({
        entityId: 'test:actor1',
        newState: 'hungry',
      });
    });

    it('increments turnsInState when state remains the same', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'StableActor', {
        currentEnergy: 50, // 50% = neutral state
        maxEnergy: 100,
        baseBurnRate: 0,
        hungerState: 'neutral',
        turnsInState: 2,
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      const updatedEntity =
        testEnv.entityManager.getEntityInstance('test:actor1');
      const hungerState = updatedEntity.components['metabolism:hunger_state'];

      // State should remain neutral, turnsInState should increment
      expect(hungerState.state).toBe('neutral');
      expect(hungerState.turnsInState).toBe(3);
    });
  });

  describe('processing order correctness', () => {
    it('processes operations in order: burn → digest → update state', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'OrderTestActor', {
        currentEnergy: 50,
        maxEnergy: 100,
        baseBurnRate: 5,
        bufferStorage: [{ bulk: 1, energy_content: 10 }],
        hungerState: 'neutral',
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      // Check event order
      const eventTypes = testEnv.events.map((e) => e.eventType);

      const burnIndex = eventTypes.indexOf('metabolism:energy_burned');
      const digestIndex = eventTypes.indexOf('metabolism:food_digested');
      const stateIndex = eventTypes.indexOf('metabolism:hunger_state_changed');

      // Burn should come before digest (if both exist)
      if (burnIndex >= 0 && digestIndex >= 0) {
        expect(burnIndex).toBeLessThan(digestIndex);
      }

      // Digest should come before state update (if both exist)
      if (digestIndex >= 0 && stateIndex >= 0) {
        expect(digestIndex).toBeLessThan(stateIndex);
      }

      // Burn should come before state update (if both exist)
      if (burnIndex >= 0 && stateIndex >= 0) {
        expect(burnIndex).toBeLessThan(stateIndex);
      }
    });

    it('executes all three turn rules in sequence', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const actor = createMetabolismActor('test:actor1', 'FullProcessActor', {
        currentEnergy: 60,
        maxEnergy: 100,
        baseBurnRate: 5,
        bufferStorage: [{ bulk: 1, energy_content: 15 }],
        conversionRate: 10,
        hungerState: 'neutral',
      });

      testEnv.reset([room, actor]);

      await dispatchTurnStarted('test:actor1');

      // Verify burn event occurred
      const burnEvent = testEnv.events.find(
        (e) => e.eventType === 'metabolism:energy_burned'
      );
      expect(burnEvent).toBeDefined();

      // Verify digest event occurred (buffer had content)
      const digestEvent = testEnv.events.find(
        (e) => e.eventType === 'metabolism:food_digested'
      );
      expect(digestEvent).toBeDefined();

      // State update should have occurred (may or may not dispatch changed event)
      const updatedEntity =
        testEnv.entityManager.getEntityInstance('test:actor1');
      expect(updatedEntity.components['metabolism:hunger_state']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles entity without metabolism components gracefully', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const nonMetabolismActor = {
        id: 'test:actor1',
        components: {
          'core:actor': {},
          'core:name': { value: 'BasicActor' },
          'core:position': { locationId: 'test:room1' },
        },
      };

      testEnv.reset([room, nonMetabolismActor]);

      // Should not throw, rules should simply not execute
      await expect(dispatchTurnStarted('test:actor1')).resolves.not.toThrow();

      // No metabolism events should be dispatched
      const metabolismEvents = testEnv.events.filter(
        (e) => e.eventType && e.eventType.startsWith('metabolism:')
      );
      expect(metabolismEvents).toHaveLength(0);
    });

    it('handles entity with partial metabolism components', async () => {
      const room = {
        id: 'test:room1',
        components: { 'core:location': {} },
      };
      const partialActor = {
        id: 'test:actor1',
        components: {
          'core:actor': {},
          'core:name': { value: 'PartialActor' },
          'core:position': { locationId: 'test:room1' },
          'metabolism:metabolic_store': {
            current_energy: 50,
            max_energy: 100,
            base_burn_rate: 5,
            buffer_storage: [],
            buffer_capacity: 10,
          },
          // Missing fuel_converter component
        },
      };

      testEnv.reset([room, partialActor]);

      await expect(dispatchTurnStarted('test:actor1')).resolves.not.toThrow();
    });
  });
});
