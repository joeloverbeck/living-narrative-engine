/**
 * @file Integration tests for metabolism hunger operators
 * @description Tests is_hungry, is_digesting conditions, and can_consume operator
 * for validating hunger states, digestion status, and consumption eligibility.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import { IsHungryOperator } from '../../../../src/logic/operators/isHungryOperator.js';
import { CanConsumeOperator } from '../../../../src/logic/operators/canConsumeOperator.js';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';
import jsonLogic from 'json-logic-js';

// Import the condition file to test is_digesting
import isDigestingCondition from '../../../../data/mods/metabolism/conditions/is_digesting.condition.json' assert { type: 'json' };

describe('metabolism hunger operators integration', () => {
  let testBed;
  let entityManager;
  let actorDefinition;
  let foodDefinition;
  let isHungryOperator;
  let canConsumeOperator;

  const registerDefinition = (definition) => {
    testBed.registry.store('entityDefinitions', definition.id, definition);
  };

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;

    actorDefinition = new EntityDefinition('test:actor', {
      description: 'Test actor with metabolism',
      components: {},
    });

    foodDefinition = new EntityDefinition('test:food', {
      description: 'Test food item',
      components: {},
    });

    registerDefinition(actorDefinition);
    registerDefinition(foodDefinition);

    isHungryOperator = new IsHungryOperator({
      entityManager,
      logger: testBed.logger,
    });

    canConsumeOperator = new CanConsumeOperator({
      entityManager,
      logger: testBed.logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  /**
   * Helper: Create actor with metabolism components
   *
   * @param instanceId
   * @param config
   */
  const createMetabolismActor = async (instanceId, config = {}) => {
    const {
      currentEnergy = 50,
      maxEnergy = 100,
      baseBurnRate = 5,
      bufferStorage = [],
      bufferCapacity = 10,
      hungerState = 'neutral',
      acceptedFuelTags = ['food', 'drink'],
    } = config;

    const actor = await entityManager.createEntityInstance(actorDefinition.id, {
      instanceId,
    });

    await entityManager.addComponent(actor.id, 'metabolism:metabolic_store', {
      current_energy: currentEnergy,
      max_energy: maxEnergy,
      base_burn_rate: baseBurnRate,
      buffer_storage: bufferStorage,
      buffer_capacity: bufferCapacity,
    });

    await entityManager.addComponent(actor.id, 'metabolism:fuel_converter', {
      capacity: bufferCapacity,
      conversion_rate: 10,
      efficiency: 1.0,
      accepted_fuel_tags: acceptedFuelTags,
      metabolic_efficiency_multiplier: 1.0,
    });

    await entityManager.addComponent(actor.id, 'metabolism:hunger_state', {
      state: hungerState,
      energyPercentage: (currentEnergy / maxEnergy) * 100,
      turnsInState: 0,
      starvationDamage: 0,
    });

    return actor;
  };

  /**
   * Helper: Create food item with fuel_source component
   *
   * @param instanceId
   * @param config
   */
  const createFoodItem = async (instanceId, config = {}) => {
    const { bulk = 2, energyContent = 20, fuelTags = ['food'] } = config;

    const food = await entityManager.createEntityInstance(foodDefinition.id, {
      instanceId,
    });

    await entityManager.addComponent(food.id, 'metabolism:fuel_source', {
      bulk,
      energy_content: energyContent,
      fuel_tags: fuelTags,
    });

    return food;
  };

  describe('is_hungry operator', () => {
    it('returns true for hungry state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'hungry',
        currentEnergy: 20,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('returns true for starving state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'starving',
        currentEnergy: 5,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('returns true for critical state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'critical',
        currentEnergy: 0,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(true);
    });

    it('returns false for neutral state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'neutral',
        currentEnergy: 50,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('returns false for satiated state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'satiated',
        currentEnergy: 80,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('returns false for gluttonous state', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'gluttonous',
        currentEnergy: 100,
      });

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('returns false for entity without hunger_state component', async () => {
      const actor = await entityManager.createEntityInstance(
        actorDefinition.id,
        {
          instanceId: 'no-metabolism-actor',
        }
      );

      const context = { actor: { id: actor.id } };
      const result = isHungryOperator.evaluate(['actor'], context);

      expect(result).toBe(false);
    });

    it('works with JSON Logic var expression', async () => {
      const actor = await createMetabolismActor('actor-1', {
        hungerState: 'hungry',
      });

      const context = { entityId: actor.id };
      const result = isHungryOperator.evaluate([{ var: 'entityId' }], context);

      expect(result).toBe(true);
    });
  });

  describe('is_digesting condition (buffer_storage check)', () => {
    it('returns true when buffer has content', async () => {
      const actor = await createMetabolismActor('actor-1', {
        bufferStorage: [{ bulk: 2, energy_content: 20 }],
      });

      const entity = entityManager.getEntityInstance(actor.id);
      const context = { entity };

      const result = jsonLogic.apply(isDigestingCondition.logic, context);

      expect(result).toBe(true);
    });

    it('returns false when buffer is empty', async () => {
      const actor = await createMetabolismActor('actor-1', {
        bufferStorage: [],
      });

      const entity = entityManager.getEntityInstance(actor.id);
      const context = { entity };

      const result = jsonLogic.apply(isDigestingCondition.logic, context);

      expect(result).toBe(false);
    });

    it('returns true with multiple items in buffer', async () => {
      const actor = await createMetabolismActor('actor-1', {
        bufferStorage: [
          { bulk: 1, energy_content: 10 },
          { bulk: 2, energy_content: 20 },
          { bulk: 1, energy_content: 15 },
        ],
      });

      const entity = entityManager.getEntityInstance(actor.id);
      const context = { entity };

      const result = jsonLogic.apply(isDigestingCondition.logic, context);

      expect(result).toBe(true);
    });
  });

  describe('can_consume operator', () => {
    describe('fuel tag validation', () => {
      it('returns true when fuel tags match', async () => {
        const actor = await createMetabolismActor('actor-1', {
          acceptedFuelTags: ['food', 'drink'],
          bufferCapacity: 10,
          bufferStorage: [],
        });

        const food = await createFoodItem('bread-1', {
          fuelTags: ['food'],
          bulk: 2,
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(true);
      });

      it('returns false when fuel tags do not match', async () => {
        const actor = await createMetabolismActor('actor-1', {
          acceptedFuelTags: ['food'], // Only accepts food
        });

        const potion = await createFoodItem('potion-1', {
          fuelTags: ['potion'], // Potion is not accepted
          bulk: 1,
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: potion.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('accepts item with multiple matching tags', async () => {
        const actor = await createMetabolismActor('actor-1', {
          acceptedFuelTags: ['food', 'organic'],
        });

        const apple = await createFoodItem('apple-1', {
          fuelTags: ['food', 'fruit', 'organic'],
          bulk: 1,
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: apple.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(true);
      });
    });

    describe('buffer capacity validation', () => {
      it('returns true when buffer has enough capacity', async () => {
        const actor = await createMetabolismActor('actor-1', {
          bufferCapacity: 10,
          bufferStorage: [{ bulk: 3, energy_content: 30 }], // 3/10 used
        });

        const food = await createFoodItem('small-meal', {
          bulk: 5, // Needs 5 space, 7 available
          fuelTags: ['food'],
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(true);
      });

      it('returns false when buffer capacity exceeded', async () => {
        const actor = await createMetabolismActor('actor-1', {
          bufferCapacity: 10,
          bufferStorage: [{ bulk: 8, energy_content: 80 }], // 8/10 used
        });

        const largeMeal = await createFoodItem('large-meal', {
          bulk: 5, // Needs 5 space, only 2 available
          fuelTags: ['food'],
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: largeMeal.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('returns false when buffer is completely full', async () => {
        const actor = await createMetabolismActor('actor-1', {
          bufferCapacity: 10,
          bufferStorage: [{ bulk: 10, energy_content: 100 }], // 10/10 used
        });

        const food = await createFoodItem('snack', {
          bulk: 1,
          fuelTags: ['food'],
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('allows exactly filling remaining capacity', async () => {
        const actor = await createMetabolismActor('actor-1', {
          bufferCapacity: 10,
          bufferStorage: [{ bulk: 7, energy_content: 70 }], // 7/10 used
        });

        const food = await createFoodItem('exactly-fits', {
          bulk: 3, // Exactly 3 available
          fuelTags: ['food'],
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(true);
      });
    });

    describe('missing components', () => {
      it('returns false when consumer lacks fuel_converter', async () => {
        const actor = await entityManager.createEntityInstance(
          actorDefinition.id,
          {
            instanceId: 'no-converter',
          }
        );

        await entityManager.addComponent(
          actor.id,
          'metabolism:metabolic_store',
          {
            buffer_storage: [],
            buffer_capacity: 10,
          }
        );
        // No fuel_converter component

        const food = await createFoodItem('food-1', { fuelTags: ['food'] });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('returns false when consumer lacks metabolic_store', async () => {
        const actor = await entityManager.createEntityInstance(
          actorDefinition.id,
          {
            instanceId: 'no-store',
          }
        );

        await entityManager.addComponent(
          actor.id,
          'metabolism:fuel_converter',
          {
            accepted_fuel_tags: ['food'],
          }
        );
        // No metabolic_store component

        const food = await createFoodItem('food-1', { fuelTags: ['food'] });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('returns false when item lacks fuel_source', async () => {
        const actor = await createMetabolismActor('actor-1');

        const nonConsumable = await entityManager.createEntityInstance(
          foodDefinition.id,
          { instanceId: 'non-consumable' }
        );
        // No fuel_source component

        const context = {
          consumer: { id: actor.id },
          item: { id: nonConsumable.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('handles empty fuel_tags array on item', async () => {
        const actor = await createMetabolismActor('actor-1', {
          acceptedFuelTags: ['food'],
        });

        const food = await createFoodItem('no-tags', {
          fuelTags: [], // Empty tags array
          bulk: 1,
        });

        const context = {
          consumer: { id: actor.id },
          item: { id: food.id },
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('handles invalid parameters gracefully', () => {
        const context = {
          consumer: null,
          item: null,
        };
        const result = canConsumeOperator.evaluate(
          ['consumer', 'item'],
          context
        );

        expect(result).toBe(false);
      });

      it('handles missing context keys', () => {
        const result = canConsumeOperator.evaluate(['consumer', 'item'], {});

        expect(result).toBe(false);
      });
    });
  });
});
